import os
import json
import urllib.request
import urllib.error
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

REDIS_URL = os.getenv("REDIS_URL", "")
UPSTASH_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
ADMIN_STATS_KEY = os.getenv("ADMIN_STATS_KEY", "mylessons_admin_2026")
TEACHER_SECRET_CODE = os.getenv("TEACHER_SECRET_CODE", "")

# Memoria di fallback in-memory (per funzionamento locale o prima dell'inserimento credenziali)
_local_mock_db: Dict[str, Any] = {}

def is_authorized(input_key: str) -> bool:
    """Verifica se la chiave fornita corrisponde a ADMIN_STATS_KEY o TEACHER_SECRET_CODE."""
    if not input_key:
        return False
    clean = input_key.strip()
    return clean == ADMIN_STATS_KEY or (TEACHER_SECRET_CODE and clean == TEACHER_SECRET_CODE)

def execute_redis_command(*args) -> Any:
    """
    Esegue un comando Redis supportando:
    1. Upstash REST API (zero dipendenze TCP socket, ideale per Vercel serverless)
    2. Redis client standard (se REDIS_URL è impostato)
    3. Fallback locale in memoria
    """
    cmd = list(args)
    if not cmd:
        return None

    # 1. UPSTASH REST API
    if UPSTASH_REST_URL and UPSTASH_REST_TOKEN:
        try:
            url = UPSTASH_REST_URL.rstrip("/")
            body_json = json.dumps([str(x) for x in cmd]).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=body_json,
                headers={
                    "Authorization": f"Bearer {UPSTASH_REST_TOKEN}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                res_data = json.loads(resp.read().decode("utf-8"))
                return res_data.get("result")
        except Exception as e:
            print(f"[REDIS_UPSTASH_ERR] {e} on cmd {cmd[:2]}")

    # 2. REDIS-PY STANDARD
    if REDIS_URL:
        try:
            import redis
            r = redis.from_url(REDIS_URL, decode_responses=True)
            method = getattr(r, cmd[0].lower(), None)
            if method:
                return method(*cmd[1:])
        except Exception as e:
            print(f"[REDIS_PY_ERR] {e} on cmd {cmd[:2]}")

    # 3. FALLBACK IN-MEMORY MOCK DB
    action = str(cmd[0]).upper()
    key = str(cmd[1]) if len(cmd) > 1 else ""

    if action == "SET":
        val = cmd[2] if len(cmd) > 2 else ""
        _local_mock_db[key] = val
        return "OK"
    elif action == "GET":
        return _local_mock_db.get(key)
    elif action == "SADD":
        members = [str(m) for m in cmd[2:]]
        s = _local_mock_db.setdefault(key, set())
        if isinstance(s, set):
            before = len(s)
            s.update(members)
            return len(s) - before
        return 0
    elif action == "SMEMBERS":
        s = _local_mock_db.get(key, set())
        return list(s) if isinstance(s, (set, list)) else []
    elif action == "DEL":
        return 1 if _local_mock_db.pop(key, None) is not None else 0
    elif action == "HSET":
        h = _local_mock_db.setdefault(key, {})
        if isinstance(h, dict):
            for i in range(2, len(cmd), 2):
                if i + 1 < len(cmd):
                    h[str(cmd[i])] = str(cmd[i+1])
            return 1
        return 0
    elif action == "HGETALL":
        h = _local_mock_db.get(key, {})
        return h if isinstance(h, dict) else {}
    elif action == "KEYS":
        pattern = key.replace("*", ".*")
        return [k for k in _local_mock_db.keys() if re.match(pattern, k)]

    return None

def save_or_update_lesson(teacher_name: str, lesson_data: Dict[str, Any]):
    """Salva una lezione in Redis e aggiorna l'indice dell'insegnante."""
    fingerprint = lesson_data.get("fingerprint") or lesson_data.get("id")
    if not fingerprint:
        return

    key = f"mylessons:lesson:{fingerprint}"
    execute_redis_command("SET", key, json.dumps(lesson_data))
    execute_redis_command("SADD", f"mylessons:teacher:{teacher_name}:lessons", fingerprint)
    execute_redis_command("SADD", "mylessons:teachers", teacher_name)
    if lesson_data.get("student_email"):
        execute_redis_command("SADD", f"mylessons:teacher:{teacher_name}:students", lesson_data["student_email"].lower().strip())

def mark_lesson_cancelled(teacher_name: str, student_email: str, date_str: str, time_str: str = "") -> bool:
    """
    Segna una lezione come annullata per lo studente nella settimana specificata.
    Riconosce la cancellazione e decrementa i conteggi.
    """
    clean_em = student_email.lower().strip()
    clean_t = teacher_name.strip()
    clean_date = date_str.replace("-", "").replace("/", "")

    lesson_keys = execute_redis_command("SMEMBERS", f"mylessons:teacher:{clean_t}:lessons") or []
    matched_fp = None
    for fp in lesson_keys:
        if clean_date in fp and clean_em.replace("@", "").replace(".", "") in fp.replace("@", "").replace(".", ""):
            matched_fp = fp
            break

    if matched_fp:
        raw = execute_redis_command("GET", f"mylessons:lesson:{matched_fp}")
        if raw:
            try:
                data = json.loads(raw)
                data["status"] = "annullata"
                data["cancelled_at"] = datetime.now().isoformat()
                execute_redis_command("SET", f"mylessons:lesson:{matched_fp}", json.dumps(data))
                print(f"[REDIS] Lezione {matched_fp} segnata come ANNULLATA.")
                return True
            except Exception as e:
                print(f"[REDIS] Errore aggiornamento lezione {matched_fp}: {e}")
    return False

def backfill_from_google_calendar() -> Dict[str, Any]:
    """
    Legge tutti gli eventi da Google Calendar per ciascun insegnante con [ID_LESSON_APP],
    estrae lezioni storiche e future e popola il database Redis con i dati reali.
    """
    from app.core.google_clients import get_calendar_client, get_main_spreadsheet
    from app.services.sheets_service import get_cached_sheet_values

    service = get_calendar_client()
    ss_main = get_main_spreadsheet()

    insegnanti_rows = ss_main.worksheet("Insegnanti").get_all_values()[1:]
    iscrizioni_rows = get_cached_sheet_values("Iscrizioni", ttl_seconds=60)[1:]

    # Mappa tariffe: (teacher_name_clean, student_email_clean) -> tariffa
    rate_map = {}
    for r in iscrizioni_rows:
        if len(r) > 7:
            s_em = r[1].lower().strip()
            t_nm = r[3].lower().strip()
            tar = float(r[7]) if r[7].replace(".", "", 1).isdigit() else 0.0
            rate_map[(t_nm, s_em)] = tar

    now = datetime.now()
    time_min = (now - timedelta(days=60)).isoformat() + "Z"
    time_max = (now + timedelta(days=30)).isoformat() + "Z"

    results = []

    for r in insegnanti_rows:
        if len(r) > 7 and r[7]:
            cal_id = r[7].strip()
            teacher_name = f"{r[2]} {r[3]}".strip() if len(r) >= 4 else ""
            if not teacher_name or not cal_id:
                continue

            try:
                events_res = service.events().list(
                    calendarId=cal_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True
                ).execute()

                items = events_res.get("items", [])
                teacher_lessons_saved = 0

                for ev in items:
                    desc = ev.get("description", "")
                    if "[ID_LESSON_APP]" not in desc:
                        continue

                    em_match = re.search(r"Studente:[ \t]*([^\s]+)", desc)
                    student_email = em_match.group(1).lower().strip() if em_match else ""

                    fp_match = re.search(r"\[FP:(.*?)\]", desc)
                    fingerprint = fp_match.group(1) if fp_match else f"FP_{ev.get('id')}"

                    student_name = ev.get("summary", "")
                    start_dt_str = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date", "")
                    end_dt_str = ev.get("end", {}).get("dateTime") or ev.get("end", {}).get("date", "")

                    is_past = False
                    if start_dt_str:
                        try:
                            clean_dt_str = start_dt_str[:19]
                            ev_dt = datetime.strptime(clean_dt_str, "%Y-%m-%dT%H:%M:%S")
                            is_past = ev_dt <= now
                        except Exception:
                            is_past = True

                    status = "svolta" if is_past else "programmata"
                    tariffa = rate_map.get((teacher_name.lower().strip(), student_email), 0.0)

                    lesson_record = {
                        "id": fingerprint,
                        "fingerprint": fingerprint,
                        "cal_event_id": ev.get("id"),
                        "teacher_name": teacher_name,
                        "student_name": student_name,
                        "student_email": student_email,
                        "start_time": start_dt_str,
                        "end_time": end_dt_str,
                        "status": status,
                        "tariffa": tariffa,
                        "synced_at": now.isoformat()
                    }

                    save_or_update_lesson(teacher_name, lesson_record)
                    teacher_lessons_saved += 1

                results.append({
                    "teacher": teacher_name,
                    "calendarId": cal_id,
                    "lessonsIndexed": teacher_lessons_saved
                })

            except Exception as t_err:
                results.append({
                    "teacher": teacher_name,
                    "status": "error",
                    "error": str(t_err)
                })

    return {
        "status": "success",
        "timestamp": now.isoformat(),
        "redisStorage": "Upstash REST" if (UPSTASH_REST_URL and UPSTASH_REST_TOKEN) else ("Redis-Py" if REDIS_URL else "Local Mock In-Memory"),
        "results": results
    }

def get_teacher_real_stats(teacher_filter: Optional[str] = None) -> Dict[str, Any]:
    """
    Restituisce le statistiche numeriche reali aggregate da Redis per uno o tutti gli insegnanti.
    Include lezioni svolte, da pagare, annullate, tariffe e importi dovuti per studente.
    """
    all_teachers = execute_redis_command("SMEMBERS", "mylessons:teachers") or []
    if teacher_filter:
        all_teachers = [t for t in all_teachers if teacher_filter.lower().strip() in t.lower().strip()]

    now = datetime.now()
    stats_list = []

    for t_name in all_teachers:
        lesson_fps = execute_redis_command("SMEMBERS", f"mylessons:teacher:{t_name}:lessons") or []
        student_emails = execute_redis_command("SMEMBERS", f"mylessons:teacher:{t_name}:students") or []

        student_map: Dict[str, Dict[str, Any]] = {}
        for s_em in student_emails:
            student_map[s_em] = {
                "studentEmail": s_em,
                "studentName": "",
                "lezioniSvolte": 0,
                "lezioniProgrammate": 0,
                "lezioniAnnullate": 0,
                "lezioniDaPagare": 0,
                "tariffa": 0.0,
                "amountDue": 0.0,
                "lessons": []
            }

        total_svolte = 0
        total_programmate = 0
        total_annullate = 0
        total_revenue = 0.0

        for fp in lesson_fps:
            raw = execute_redis_command("GET", f"mylessons:lesson:{fp}")
            if not raw:
                continue
            try:
                l_data = json.loads(raw)
                s_em = l_data.get("student_email", "").lower().strip()
                s_name = l_data.get("student_name", "")
                status = l_data.get("status", "svolta")
                tariffa = float(l_data.get("tariffa", 0.0))

                if s_em not in student_map:
                    student_map[s_em] = {
                        "studentEmail": s_em,
                        "studentName": s_name,
                        "lezioniSvolte": 0,
                        "lezioniProgrammate": 0,
                        "lezioniAnnullate": 0,
                        "lezioniDaPagare": 0,
                        "tariffa": tariffa,
                        "amountDue": 0.0,
                        "lessons": []
                    }

                st_info = student_map[s_em]
                if s_name and not st_info["studentName"]:
                    st_info["studentName"] = s_name
                if tariffa > 0:
                    st_info["tariffa"] = tariffa

                st_info["lessons"].append({
                    "id": fp,
                    "date": l_data.get("start_time"),
                    "status": status
                })

                if status == "svolta":
                    st_info["lezioniSvolte"] += 1
                    st_info["lezioniDaPagare"] += 1
                    total_svolte += 1
                elif status == "programmata":
                    st_info["lezioniProgrammate"] += 1
                    total_programmate += 1
                elif status == "annullata":
                    st_info["lezioniAnnullate"] += 1
                    total_annullate += 1

            except Exception:
                pass

        for s_em, st_info in student_map.items():
            st_info["amountDue"] = round(st_info["lezioniDaPagare"] * st_info["tariffa"], 2)
            total_revenue += st_info["amountDue"]

        stats_list.append({
            "teacherName": t_name,
            "totalLessonsSvolte": total_svolte,
            "totalLessonsProgrammate": total_programmate,
            "totalLessonsAnnullate": total_annullate,
            "totalLessonsDaPagare": total_svolte,
            "totalRevenueDue": round(total_revenue, 2),
            "totalStudentsCount": len(student_map),
            "students": list(student_map.values())
        })

    return {
        "status": "success",
        "timestamp": now.isoformat(),
        "databaseProvider": "Upstash REST" if (UPSTASH_REST_URL and UPSTASH_REST_TOKEN) else ("Redis-Py" if REDIS_URL else "Local Mock In-Memory"),
        "teachersCount": len(stats_list),
        "data": stats_list
    }
