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

        ss_main = get_main_spreadsheet()
        fb_rows = ss_main.worksheet("Feedback").get_all_values()
        fb_map = {
            r[0]: {"status": r[1] if len(r)>1 else "", "note": r[2] if len(r)>2 else "", "preferenza": r[3] if len(r)>3 else ""}
            for r in fb_rows[1:] if r and auth_email in r[0]
        }

        ss_sched = get_schedule_spreadsheet()
        sheets = [ss_sched.worksheet(t) for t in target_teachers] if target_teachers else ss_sched.worksheets()

        result = []
        for s in sheets:
            data = s.get_all_values()
            t_name = s.title
            for g, col_ora in DAY_MAP.items():
                col_em = col_ora + 1
                for r in range(1, len(data)):
                    if col_em < len(data[r]) and data[r][col_em]:
                        if auth_email in [e.strip().lower() for e in data[r][col_em].split(",")]:
                            ora_fmt = str(data[r][col_ora]).strip()
                            clean_time = re.sub(r"[^0-9]", "", ora_fmt)
                            clean_day = g.lower().strip().replace("ì", "i")
                            key = f"{t_name}-{clean_day}-{clean_time}-{auth_email}"
                            result.append({
                                "giorno": g,
                                "ora": ora_fmt,
                                "teacherName": t_name,
                                "feedbacks": [fb_map.get(key, {"status": "In attesa", "note": ""})]
                            })
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
        sheet = schedule_service.get_or_create_teacher_sheet(teacher_name)
        data = sheet.get_all_values()
        if len(data) < 2:
            return JSONResponse({"status": "success", "data": []})

        studenti = get_main_spreadsheet().worksheet("Studenti").get_all_values()[1:]
        nomi_map = {r[1].lower().strip(): f"{r[2]} {r[3]}".strip() for r in studenti if len(r) >= 4 and r[1]}

        result = []
        for g in ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"]:
            col_ora = DAY_MAP[g]
            col_em = col_ora + 1
            for r in range(1, len(data)):
                if col_ora < len(data[r]) and data[r][col_ora]:
                    ora_str = str(data[r][col_ora]).strip()
                    emails_str = data[r][col_em] if col_em < len(data[r]) else ""
                    em_list = [e.strip() for e in emails_str.split(",") if e.strip()]
                    students_arr = [{"email": e, "nome": nomi_map.get(e.lower(), e)} for e in em_list]
                    result.append({
                        "giorno": g,
                        "ora": ora_str,
                        "email": emails_str,
                        "students": students_arr,
                        "nome": students_arr[0]["nome"] if students_arr else ""
                    })
        return JSONResponse({"status": "success", "data": result})

    if action == "getStudentBalances":
        return JSONResponse({"status": "success", "data": sheets_service.get_student_balances(params.get("studentEmail", ""))})

    if action == "getTeacherFeedbackSummary":
        t_name = params.get("teacherName", "").lower().strip()
        ss = get_main_spreadsheet()
        fb_data = ss.worksheet("Feedback").get_all_values()[1:]
        std_data = ss.worksheet("Studenti").get_all_values()[1:]

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
        success = sheets_service.remove_feedback(body.get("teacherName", ""), body.get("giorno", ""), body.get("ora", ""), body.get("studentName", ""))
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
