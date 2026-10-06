import re
from datetime import datetime
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from app.config import TEACHER_SECRET_CODE, DAY_MAP, DAY_ORDER
from app.core.auth import verify_token
from app.services import (
    sheets_service,
    schedule_service,
    calendar_service,
    ai_service
)
from app.core.google_clients import get_main_spreadsheet, get_schedule_spreadsheet

router = APIRouter()

# ----------------------------------------------------
# GET ENDPOINT DISPATCHER (Compatibile 100% con GAS)
# ----------------------------------------------------
@router.get("/")
@router.get("/api")
async def handle_get(request: Request):
    params = dict(request.query_params)
    action = params.get("action")
    id_token_str = params.get("token")

    # 1. Se si apre direttamente l'URL nel browser senza parametri
    if not action and not id_token_str:
        return JSONResponse({
            "status": "online",
            "service": "MyLessons Backend API (Python / FastAPI)",
            "message": "Il backend è attivo e operativo. Per accedere all'applicazione, apri il frontend all'indirizzo http://localhost:3000",
            "frontend_url": "http://localhost:3000"
        })

    if action == "ping":
        return JSONResponse({"status": "pong", "timestamp": datetime.now().isoformat()})

    # Test diagnostico automatico di Google Calendar
    if action == "testCalendar":
        report = calendar_service.run_calendar_diagnostics()
        return JSONResponse(report)

    # Sincronizzazione forzata in blocco da Fogli a Google Calendar
    if action == "syncAllFromSheets":
        results = schedule_service.sync_all_teachers_to_calendar()
        return JSONResponse({"status": "success", "results": results})

    if action == "verifyTeacherCode":
        input_code = params.get("code", "")
        return JSONResponse({"status": "success", "isValid": bool(input_code) and (input_code == TEACHER_SECRET_CODE)})

    if action == "getTeachers":
        return JSONResponse({"status": "success", "data": sheets_service.get_teachers_list()})

    if action == "checkUser":
        exists, role = sheets_service.check_user_role(params.get("email", ""))
        return JSONResponse({"exists": exists, "role": role})

    # Protezione con Token Google
    auth_email = verify_token(id_token_str)
    if not auth_email:
        return JSONResponse({"status": "error", "message": "Non autorizzato: Sessione non valida"}, status_code=401)

    if action == "getStudentPersonalSchedule":
        subs = sheets_service.get_student_subscriptions(auth_email)
        target_teachers = [s["teacherName"] for s in subs if s.get("teacherName")]

        from app.services.sheets_service import normalize_fb_key, get_cached_teacher_schedule, get_cached_sheet_values
        fb_rows = get_cached_sheet_values("Feedback", ttl_seconds=20)
        
        fb_map = {}
        for r in fb_rows[1:]:
            if not r or not r[0]: continue
            raw_key = r[0].strip()
            item_data = {
                "status": r[1] if len(r)>1 else "",
                "note": r[2] if len(r)>2 else "",
                "preferenza": r[3] if len(r)>3 else "",
                "timestamp": r[4] if len(r)>4 else ""
            }
            fb_map[raw_key] = item_data
            parts = raw_key.split("-")
            if len(parts) >= 4:
                norm_key = normalize_fb_key(parts[0], parts[1], parts[2], parts[3])
                fb_map[norm_key] = item_data

        result = []
        for t_name in target_teachers:
            try:
                data = get_cached_teacher_schedule(t_name, ttl_seconds=20)
                if not data or len(data) < 2:
                    continue
                for g, col_ora in DAY_MAP.items():
                    col_em = col_ora + 1
                    for r in range(1, len(data)):
                        if col_em < len(data[r]) and data[r][col_em]:
                            emails_in_slot = [e.strip().lower() for e in data[r][col_em].split(",") if e.strip()]
                            if auth_email in emails_in_slot:
                                ora_fmt = str(data[r][col_ora]).strip()
                                clean_time = re.sub(r"[^0-9]", "", ora_fmt)
                                raw_key = f"{t_name}-{g.strip()}-{clean_time}-{auth_email}"
                                norm_key = normalize_fb_key(t_name, g, ora_fmt, auth_email)

                                fb_obj = fb_map.get(norm_key) or fb_map.get(raw_key)
                                if not fb_obj:
                                    for k, val in fb_map.items():
                                        if auth_email in k and (clean_time in k or ora_fmt in k):
                                            fb_obj = val
                                            break

                                result.append({
                                    "giorno": g,
                                    "ora": ora_fmt,
                                    "teacherName": t_name,
                                    "feedbacks": [fb_obj if fb_obj else {"status": "In attesa", "note": ""}]
                                })
            except Exception as e_sheet:
                print(f"[DISPATCHER] Errore lettura orario '{t_name}': {e_sheet}")

        result.sort(key=lambda x: DAY_ORDER.index(x["giorno"]) if x["giorno"] in DAY_ORDER else 99)
        return JSONResponse({"status": "success", "data": result})

    if action == "getMySubscriptions":
        return JSONResponse({"status": "success", "data": sheets_service.get_student_subscriptions(auth_email)})

    if action == "getTeacherSubscribers":
        teacher_id = str(params.get("teacherId", "")).strip()
        data = schedule_service.get_teacher_subscribers_with_counts(teacher_id)
        return JSONResponse({"status": "success", "data": data})

    if action == "getStudentSchedules":
        teacher_name = params.get("teacherName", "").strip()
        from app.services.sheets_service import get_cached_teacher_schedule, get_cached_sheet_values
        from app.config import CANONICAL_DAYS, DAY_MAP
        data = get_cached_teacher_schedule(teacher_name, ttl_seconds=20)
        if len(data) < 2:
            return JSONResponse({"status": "success", "data": []})

        studenti_rows = get_cached_sheet_values("Studenti", ttl_seconds=30)
        studenti = studenti_rows[1:] if len(studenti_rows) > 1 else []
        nomi_map = {r[1].lower().strip(): f"{r[2]} {r[3]}".strip() for r in studenti if len(r) >= 4 and r[1]}

        result = []
        for g in CANONICAL_DAYS:
            col_ora = DAY_MAP[g]
            col_em = col_ora + 1
            slot_by_time = {}
            for r in range(1, len(data)):
                if col_ora < len(data[r]) and data[r][col_ora]:
                    ora_str = str(data[r][col_ora]).strip()
                    if not ora_str:
                        continue
                    emails_str = data[r][col_em] if col_em < len(data[r]) else ""
                    em_list = [e.strip() for e in emails_str.split(",") if e.strip() and "@" in e]
                    if ora_str not in slot_by_time:
                        slot_by_time[ora_str] = list(em_list)
                    else:
                        for em in em_list:
                            if em not in slot_by_time[ora_str]:
                                slot_by_time[ora_str].append(em)

            for ora_str, emails in sorted(slot_by_time.items(), key=lambda x: x[0]):
                students_arr = [{"email": e, "nome": nomi_map.get(e.lower(), e)} for e in emails]
                result.append({
                    "giorno": g,
                    "ora": ora_str,
                    "email": ",".join(emails),
                    "students": students_arr,
                    "nome": students_arr[0]["nome"] if students_arr else ""
                })
        return JSONResponse({"status": "success", "data": result})

    if action == "getStudentBalances":
        return JSONResponse({"status": "success", "data": sheets_service.get_student_balances(params.get("studentEmail", ""))})

    if action == "getTeacherFeedbackSummary":
        t_name = params.get("teacherName", "").lower().strip()
        from app.services.sheets_service import get_cached_sheet_values
        try:
            fb_rows = get_cached_sheet_values("Feedback", ttl_seconds=20)
            fb_data = fb_rows[1:] if len(fb_rows) > 1 else []
            std_rows = get_cached_sheet_values("Studenti", ttl_seconds=30)
            std_data = std_rows[1:] if len(std_rows) > 1 else []
        except Exception as e_fb:
            print(f"[DISPATCHER] getTeacherFeedbackSummary warning: {e_fb}")
            fb_data = []
            std_data = []

        id_to_name = {}
        id_to_email = {}
        for r in std_data:
            if len(r) >= 4:
                nome = f"{r[2]} {r[3]}".strip()
                if r[0]: id_to_name[r[0].strip()] = nome; id_to_email[r[0].strip()] = r[1].lower().strip()
                if r[1]: id_to_name[r[1].lower().strip()] = nome; id_to_email[r[1].lower().strip()] = r[1].lower().strip()

        result = []
        for r in fb_data:
            key = r[0] if r else ""
            if key.lower().startswith(t_name):
                parts = key.split("-")
                ident = parts[-1].strip().lower()
                result.append({
                    "studentName": id_to_name.get(ident, ident),
                    "studentEmail": id_to_email.get(ident, ident if "@" in ident else ""),
                    "giorno": parts[1] if len(parts) > 1 else "",
                    "ora": parts[2] if len(parts) > 2 else "",
                    "status": r[1] if len(r) > 1 else "",
                    "note": r[2] if len(r) > 2 else "",
                    "preferenza": r[3] if len(r) > 3 else "",
                    "timestamp": r[4] if len(r) > 4 else ""
                })
        return JSONResponse({"status": "success", "data": result})

    return JSONResponse({"status": "error", "message": "Azione non riconosciuta"}, status_code=400)


# ----------------------------------------------------
# POST ENDPOINT DISPATCHER (Compatibile 100% con GAS)
# ----------------------------------------------------
@router.post("/")
@router.post("/api")
async def handle_post(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    action = body.get("action")
    id_token_str = body.get("id_token")
    auth_email = verify_token(id_token_str)

    if action == "saveFullSchedule":
        if not auth_email: return PlainTextResponse("Error: Non autorizzato", status_code=401)
        schedule_service.save_full_schedule(body.get("teacherName", ""), auth_email, body.get("allSchedules", []))
        return PlainTextResponse("Success")

    if action == "updatePaidLessons":
        if not auth_email: return PlainTextResponse("Error: Non autorizzato", status_code=401)
        success = sheets_service.update_paid_lessons(body.get("studentEmail", ""), body.get("teacherId", ""), body.get("newPaidValue"))
        return PlainTextResponse("Success" if success else "Error: Non trovato")

    if action == "updateStudentRate":
        if not auth_email: return PlainTextResponse("Error: Non autorizzato", status_code=401)
        success = sheets_service.update_student_rate(body.get("studentEmail", ""), body.get("teacherId", ""), body.get("newRate"))
        return PlainTextResponse("Success" if success else "Error: Non trovato")

    if action == "resetScheduleForNewWeek":
        if not auth_email: return PlainTextResponse("Error: Non autorizzato", status_code=401)
        schedule_service.reset_schedule_for_week(body.get("teacherName", ""), auth_email)
        return PlainTextResponse("Success")

    if action == "removeSlotAndDecrement":
        if not auth_email: return PlainTextResponse("Error: Non autorizzato", status_code=401)
        schedule_service.remove_slot_and_decrement(body.get("studentEmail", ""), body.get("teacherName", ""))
        return PlainTextResponse("Success")

    if action == "updateStudentFeedback":
        sheets_service.save_or_update_feedback(
            body.get("teacherName", ""), body.get("giorno", ""), body.get("ora", ""),
            body.get("studentEmail", ""), body.get("status", ""), body.get("note", ""), body.get("preferenza", "")
        )
        return PlainTextResponse("Success")

    if action == "resolveFeedback":
        success = sheets_service.remove_feedback(
            teacher_name=body.get("teacherName", ""),
            giorno=body.get("giorno", ""),
            ora=body.get("ora", ""),
            student_name=body.get("studentName", ""),
            student_email=body.get("studentEmail", "")
        )
        return PlainTextResponse("Success" if success else "Error: Non trovato")

    if action == "getAIOptimizedSchedule":
        res = ai_service.get_ai_optimized_schedule(body.get("schedule", []), body.get("feedbacks", []))
        return JSONResponse(res)

    if action == "subscribe":
        if not auth_email: return PlainTextResponse("Error: Non autorizzato", status_code=401)
        ss = get_main_spreadsheet()
        ss.worksheet("Iscrizioni").append_row([
            body.get("studentId"), auth_email, body.get("teacherId"), body.get("teacherName"),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 0, 0
        ])
        return PlainTextResponse("Success")

    # Registrazione utente al primo login
    if id_token_str and not action:
        import requests
        resp = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token_str}", timeout=5).json()
        role = body.get("role", "Studente")
        t_email = resp.get("email", "").lower().strip()
        t_name = f"{resp.get('given_name', '')} {resp.get('family_name', '')}".strip()

        sheet_name = "Insegnanti" if role == "Insegnante" else "Studenti"
        sheet = get_main_spreadsheet().worksheet(sheet_name)
        if not any(r and r[0] == resp.get("sub") for r in sheet.get_all_values()):
            cal_id = ""
            if role == "Insegnante":
                cal_id = calendar_service.create_and_share_teacher_calendar(t_email, t_name) or ""
                schedule_service.get_or_create_teacher_sheet(t_name)
            sheet.append_row([
                resp.get("sub"), t_email, resp.get("given_name", ""), resp.get("family_name", ""),
                resp.get("picture", ""), datetime.now().strftime("%Y-%m-%d %H:%M:%S"), role, cal_id
            ])
        return PlainTextResponse("Success")

    return PlainTextResponse("Error: Azione non gestita", status_code=400)
