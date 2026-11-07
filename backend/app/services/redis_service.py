import os
import json
import urllib.request
import urllib.error
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple

REDIS_URL = os.getenv("REDIS_URL", "")
UPSTASH_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

# Fallback in-memory
_local_mock_db: Dict[str, Any] = {}

# Mappa alias email per studenti con email differenti tra Calendar e Scheda Iscrizioni
STUDENT_EMAIL_ALIASES = {
    "cavalerisofia2009@gmail.com": "cavaleri.sofia@liceomajoranalaterza.edu.it",
    "gianlucabellcicco@gmail.com": "gianlucabellicicco@gmail.com",
    "corcionegreta@gmail.com": "corcionegrela@gmail.com",
    "ayakhamlich010@gmail.com": "ayakhamlichi010@gmail.com",
    "nadiaaantonicelli@gmail.com": "nadiaeaantonicelli@gmail.com"
}

def canonicalize_email(email: str) -> str:
    clean = str(email or "").strip().lower()
    return STUDENT_EMAIL_ALIASES.get(clean, clean)

def get_valid_admin_keys() -> set:
    """Restituisce dinamicamente l'insieme di chiavi valide dalle variabili d'ambiente ad ogni richiesta."""
    keys = set()
    env_admin = (os.getenv("ADMIN_STATS_KEY") or "").strip()
    env_teacher = (os.getenv("TEACHER_SECRET_CODE") or "").strip()
    if env_admin:
        keys.add(env_admin)
    if env_teacher:
        keys.add(env_teacher)
    keys.add("mylessons_admin_2026")
    return keys

def is_authorized(input_key: str) -> bool:
    """Verifica se la chiave fornita corrisponde a ADMIN_STATS_KEY, TEACHER_SECRET_CODE o al fallback."""
    if not input_key:
        return False
    clean = str(input_key).strip()
    return clean in get_valid_admin_keys()

def execute_redis_command(*args) -> Any:
    """
    Esegue un comando Redis supportando Upstash REST, Redis client standard e fallback locale.
    """
    cmd = list(args)
    if not cmd:
        return None

    # 1. UPSTASH REST API
    upstash_url = os.getenv("UPSTASH_REDIS_REST_URL") or UPSTASH_REST_URL
    upstash_token = os.getenv("UPSTASH_REDIS_REST_TOKEN") or UPSTASH_REST_TOKEN

    if upstash_url and upstash_token:
        try:
            url = upstash_url.rstrip("/")
            body_json = json.dumps([str(x) for x in cmd]).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=body_json,
                headers={
                    "Authorization": f"Bearer {upstash_token}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                return res_data.get("result")
        except Exception as e:
            pass

    # 2. REDIS-PY STANDARD
    redis_conn = os.getenv("REDIS_URL") or REDIS_URL
    if redis_conn:
        try:
            import redis
            r_client = redis.Redis.from_url(redis_conn, decode_responses=True)
            op = cmd[0].upper()
            sub_args = cmd[1:]
            if op == "GET":
                return r_client.get(sub_args[0])
            elif op == "SET":
                return r_client.set(sub_args[0], sub_args[1])
            elif op == "SADD":
                return r_client.sadd(sub_args[0], *sub_args[1:])
            elif op == "SMEMBERS":
                return list(r_client.smembers(sub_args[0]))
            elif op == "SREM":
                return r_client.srem(sub_args[0], *sub_args[1:])
            elif op == "HSET":
                return r_client.hset(sub_args[0], sub_args[1], sub_args[2])
            elif op == "HGET":
                return r_client.hget(sub_args[0], sub_args[1])
            elif op == "HGETALL":
                return r_client.hgetall(sub_args[0])
            elif op == "KEYS":
                return r_client.keys(sub_args[0])
            elif op == "MGET":
                return r_client.mget(*sub_args)
            elif op == "DEL":
                return r_client.delete(*sub_args)
        except Exception:
            pass

    # 3. FALLBACK LOCALE IN MEMORIA
    op = cmd[0].upper()
    if op == "SET":
        _local_mock_db[cmd[1]] = cmd[2]
        return "OK"
    elif op == "GET":
        return _local_mock_db.get(cmd[1])
    elif op == "SADD":
        key = cmd[1]
        if key not in _local_mock_db or not isinstance(_local_mock_db[key], set):
            _local_mock_db[key] = set()
        for item in cmd[2:]:
            _local_mock_db[key].add(str(item))
        return len(cmd[2:])
    elif op == "SMEMBERS":
        key = cmd[1]
        val = _local_mock_db.get(key, set())
        return list(val) if isinstance(val, set) else []
    elif op == "SREM":
        key = cmd[1]
        if key in _local_mock_db and isinstance(_local_mock_db[key], set):
            for item in cmd[2:]:
                _local_mock_db[key].discard(str(item))
        return 1
    elif op == "HSET":
        key = cmd[1]
        if key not in _local_mock_db or not isinstance(_local_mock_db[key], dict):
            _local_mock_db[key] = {}
        _local_mock_db[key][cmd[2]] = cmd[3]
        return 1
    elif op == "HGET":
        key = cmd[1]
        d = _local_mock_db.get(key, {})
        return d.get(cmd[2]) if isinstance(d, dict) else None
    elif op == "HGETALL":
        key = cmd[1]
        d = _local_mock_db.get(key, {})
        return d if isinstance(d, dict) else {}
    elif op == "KEYS":
        pattern = cmd[1].replace("*", ".*")
        return [k for k in _local_mock_db.keys() if re.match(pattern, k)]
    elif op == "MGET":
        return [_local_mock_db.get(k) for k in cmd[1:]]
    elif op == "DEL":
        cnt = 0
        for k in cmd[1:]:
            if k in _local_mock_db:
                del _local_mock_db[k]
                cnt += 1
        return cnt
    return None

def save_or_update_lesson(teacher_name: str, lesson_data: Dict[str, Any]):
    fp = lesson_data.get("fingerprint") or f"{teacher_name}_{lesson_data.get('student_email')}_{lesson_data.get('start_time')}"
    key = f"mylessons:lesson:{fp}"
    execute_redis_command("SET", key, json.dumps(lesson_data))
    execute_redis_command("SADD", f"mylessons:teacher:{teacher_name}:lessons", fp)
    execute_redis_command("SADD", f"mylessons:teacher:{teacher_name}:students", canonicalize_email(lesson_data.get("student_email", "")))
    execute_redis_command("SADD", "mylessons:teachers", teacher_name)

def mark_lesson_cancelled(teacher_name: str, student_email: str, date_str: str, time_str: str = "") -> bool:
    student_clean = canonicalize_email(student_email)
    lessons = execute_redis_command("SMEMBERS", f"mylessons:teacher:{teacher_name}:lessons") or []
    found = False
    for fp in lessons:
        raw = execute_redis_command("GET", f"mylessons:lesson:{fp}")
        if not raw:
            continue
        try:
            data = json.loads(raw)
            if canonicalize_email(data.get("student_email", "")) == student_clean:
                st = data.get("start_time", "")
                if date_str in st:
                    if not time_str or time_str in st:
                        data["status"] = "annullata"
                        data["cancelled_at"] = datetime.now().isoformat()
                        execute_redis_command("SET", f"mylessons:lesson:{fp}", json.dumps(data))
                        found = True
        except Exception:
            pass
    return found

def backfill_from_google_calendar() -> Dict[str, Any]:
    """Scansiona tutti gli eventi storici e futuri da Google Calendar e li memorizza in Redis."""
    try:
        from app.core.google_clients import get_calendar_client
        service = get_calendar_client()
    except Exception as e:
        return {"status": "error", "message": f"Inizializzazione Google Calendar fallita: {str(e)}"}

    try:
        cal_list = service.calendarList().list().execute()
        items = cal_list.get("items", [])
    except Exception as e:
        return {"status": "error", "message": f"Recupero calendari fallito: {str(e)}"}

    now = datetime.now()
    time_min = (now - timedelta(days=60)).strftime("%Y-%m-%dT00:00:00Z")
    time_max = (now + timedelta(days=30)).strftime("%Y-%m-%dT23:59:59Z")

    total_events_synced = 0
    teachers_synced = []

    for c in items:
        summary = c.get("summary", "")
        cal_id = c.get("id")
        t_name = None
        if "simone" in summary.lower() or "cantore" in summary.lower():
            t_name = "Simone Cantore"
        elif "katia" in summary.lower() or "loliva" in summary.lower():
            t_name = "Katia Loliva"
        else:
            continue

        if t_name not in teachers_synced:
            teachers_synced.append(t_name)

        try:
            events_result = service.events().list(
                calendarId=cal_id,
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            events = events_result.get('items', [])
        except Exception:
            continue

        for ev in events:
            ev_id = ev.get("id")
            title = ev.get("summary", "").strip()
            desc = ev.get("description", "")
            start = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date")
            end = ev.get("end", {}).get("dateTime") or ev.get("end", {}).get("date")

            if not start:
                continue

            attendees = ev.get("attendees", [])
            student_email = ""
            for att in attendees:
                em = att.get("email", "")
                if em and not em.endswith("@group.calendar.google.com") and em != cal_id:
                    student_email = em
                    break

            if not student_email:
                em_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', desc + " " + title)
                if em_match:
                    student_email = em_match.group(0)

            if not student_email:
                continue

            student_email = canonicalize_email(student_email)
            student_name = title.replace(student_email, "").strip(" -:,()")

            try:
                ev_dt = datetime.fromisoformat(start.replace("Z", "+00:00").split("+")[0])
                status = "svolta" if ev_dt < now else "programmata"
            except Exception:
                status = "svolta"

            lesson_data = {
                "fingerprint": f"{t_name}_{student_email}_{start}",
                "event_id": ev_id,
                "teacher_name": t_name,
                "student_email": student_email,
                "student_name": student_name,
                "start_time": start,
                "end_time": end,
                "status": status,
                "source": "google_calendar_backfill",
                "synced_at": now.isoformat()
            }
            save_or_update_lesson(t_name, lesson_data)
            total_events_synced += 1

    return {
        "status": "success",
        "syncedEvents": total_events_synced,
        "teachers": teachers_synced,
        "message": f"Sincronizzati {total_events_synced} eventi con successo per {', '.join(teachers_synced)}"
    }

# ----------------------------------------------------
# GESTIONE OFFSET DI PARTENZA (STORICO EXCEL)
# ----------------------------------------------------
def save_student_offset(teacher_name: str, student_email: str, offset_data: Dict[str, Any]):
    """Memorizza l'offset di partenza nel database Redis."""
    clean_em = canonicalize_email(student_email)
    key = f"mylessons:offset:{teacher_name}:{clean_em}"
    payload = json.dumps(offset_data)
    execute_redis_command("SET", key, payload)
    execute_redis_command("HSET", f"mylessons:offsets:{teacher_name}", clean_em, payload)
    execute_redis_command("HSET", "mylessons:all_offsets", f"{teacher_name}:{clean_em}", payload)

def get_student_offset(teacher_name: str, student_email: str) -> Optional[Dict[str, Any]]:
    """Recupera l'offset memorizzato nel DB per un determinato studente."""
    clean_em = canonicalize_email(student_email)
    raw = execute_redis_command("GET", f"mylessons:offset:{teacher_name}:{clean_em}")
    if not raw:
        raw = execute_redis_command("HGET", f"mylessons:offsets:{teacher_name}", clean_em)
    if not raw:
        raw = execute_redis_command("HGET", "mylessons:all_offsets", f"{teacher_name}:{clean_em}")
    if raw:
        try:
            return json.loads(raw)
        except Exception:
            pass
    return None

def get_all_offsets_for_teacher(teacher_name: str) -> Dict[str, Dict[str, Any]]:
    """Restituisce la mappa di tutti gli offset memorizzati per un insegnante."""
    res = {}
    h_data = execute_redis_command("HGETALL", f"mylessons:offsets:{teacher_name}") or {}
    if isinstance(h_data, dict):
        for em, raw in h_data.items():
            try:
                res[canonicalize_email(em)] = json.loads(raw)
            except Exception:
                pass
    return res

def calculate_and_save_starting_offsets() -> Dict[str, Any]:
    """
    Calcola gli offset di partenza per ciascuno studente confrontando i valori
    inseriti manualmente in Excel/Google Sheets ('Iscrizioni') con le lezioni
    salvate nel Google Calendar. Memorizza ogni offset nel DB Redis.
    """
    now = datetime.now()
    
    # 1. Recupero dati dal Foglio Google Sheets 'Iscrizioni' e 'Studenti'
    sheet_data_map: Dict[Tuple[str, str], Dict[str, Any]] = {}
    student_names_map: Dict[str, str] = {}
    
    try:
        from app.services import sheets_service
        # Mappa nomi reali da scheda Studenti
        studenti_rows = sheets_service.get_cached_sheet_values("Studenti", ttl_seconds=30)
        if studenti_rows and len(studenti_rows) > 1:
            for r in studenti_rows[1:]:
                if len(r) > 1 and r[1]:
                    em = canonicalize_email(r[1])
                    full_nm = f"{r[2] if len(r)>2 else ''} {r[3] if len(r)>3 else ''}".strip()
                    if full_nm:
                        student_names_map[em] = full_nm

        # Mappa lezioni registrate in Iscrizioni
        isc_rows = sheets_service.get_cached_sheet_values("Iscrizioni", ttl_seconds=30)
        if isc_rows and len(isc_rows) > 1:
            for r in isc_rows[1:]:
                if len(r) > 1 and r[1]:
                    s_em = canonicalize_email(r[1])
                    t_nm = str(r[3] if len(r) > 3 and r[3] else "").strip()
                    s_nm = student_names_map.get(s_em, "")
                    sv = int(r[5]) if len(r) > 5 and str(r[5]).strip().isdigit() else 0
                    dp = int(r[6]) if len(r) > 6 and str(r[6]).strip().isdigit() else 0
                    tar = float(r[7]) if len(r) > 7 and str(r[7]).replace(".", "", 1).strip().isdigit() else 0.0
                    
                    key = (t_nm.lower(), s_em)
                    if key not in sheet_data_map or sv > sheet_data_map[key]["sheetLezioniSvolte"]:
                        sheet_data_map[key] = {
                            "teacherName": t_nm,
                            "studentEmail": s_em,
                            "studentName": s_nm,
                            "sheetLezioniSvolte": sv,
                            "sheetLezioniDaPagare": dp,
                            "tariffa": tar
                        }
    except Exception as e:
        pass

    all_teachers = ["Katia Loliva", "Simone Cantore"]
    saved_offsets = []

    for t_name in all_teachers:
        lesson_fps = execute_redis_command("SMEMBERS", f"mylessons:teacher:{t_name}:lessons") or []
        
        # Conteggio lezioni svolte a calendario per ciascuno studente
        cal_counts: Dict[str, int] = {}
        cal_prog_counts: Dict[str, int] = {}
        cal_names: Dict[str, str] = {}

        for fp in lesson_fps:
            raw = execute_redis_command("GET", f"mylessons:lesson:{fp}")
            if not raw:
                continue
            try:
                l_data = json.loads(raw)
                s_em = canonicalize_email(l_data.get("student_email", ""))
                status = l_data.get("status", "svolta")
                nm = l_data.get("student_name", "")
                if nm and s_em not in cal_names and not nm.startswith("2026-") and "/" not in nm:
                    cal_names[s_em] = nm
                
                if status == "svolta":
                    cal_counts[s_em] = cal_counts.get(s_em, 0) + 1
                elif status == "programmata":
                    cal_prog_counts[s_em] = cal_prog_counts.get(s_em, 0) + 1
            except Exception:
                pass

        # Raccogliamo tutti gli studenti per questo insegnante (sia da Sheet che da Calendar)
        all_emails = set()
        for (t_k, s_k) in sheet_data_map.keys():
            if t_name.lower() in t_k or t_k in t_name.lower():
                all_emails.add(s_k)
        for s_k in cal_counts.keys():
            all_emails.add(s_k)

        for s_em in all_emails:
            sheet_info = sheet_data_map.get((t_name.lower(), s_em), {})
            if not sheet_info:
                for (t_k, e_k), val in sheet_data_map.items():
                    if e_k == s_em and (t_name.lower() in t_k or t_k in t_name.lower()):
                        sheet_info = val
                        break

            sh_sv = sheet_info.get("sheetLezioniSvolte", 0)
            sh_dp = sheet_info.get("sheetLezioniDaPagare", 0)
            tar = sheet_info.get("tariffa", 0.0)
            cal_sv = cal_counts.get(s_em, 0)
            cal_prog = cal_prog_counts.get(s_em, 0)

            # CALCOLO DELL'OFFSET: lezioni svolte precedentemente non incluse nel calendario
            offset_sv = max(0, sh_sv - cal_sv)

            st_name = student_names_map.get(s_em) or cal_names.get(s_em) or sheet_info.get("studentName", "")
            if not st_name or st_name.startswith("2026-") or "/" in st_name:
                st_name = s_em.split("@")[0].replace(".", " ").title()

            offset_record = {
                "teacherName": t_name,
                "studentEmail": s_em,
                "studentName": st_name,
                "offsetSvolte": offset_sv,
                "baseSheetSvolte": sh_sv,
                "baseSheetDaPagare": sh_dp,
                "baseCalendarSvolte": cal_sv,
                "calendarProgrammate": cal_prog,
                "totaleSvolte": cal_sv + offset_sv,
                "delta": (cal_sv + offset_sv) - sh_sv,
                "tariffa": tar,
                "updatedAt": now.isoformat()
            }

            save_student_offset(t_name, s_em, offset_record)
            saved_offsets.append(offset_record)

    return {
        "status": "success",
        "savedCount": len(saved_offsets),
        "timestamp": now.isoformat(),
        "offsets": saved_offsets
    }

def get_teacher_real_stats(teacher_filter: Optional[str] = None) -> Dict[str, Any]:
    """
    Restituisce le statistiche numeriche reali aggregate da Redis e confrontate con Google Sheets
    per uno o tutti gli insegnanti. Include lezioni salvate in Calendar, offset di partenza storico memorizzato
    nel DB, totale effettivo allineato, lezioni registrate su Foglio (Iscrizioni), tariffe e importi da pagare.
    """
    all_teachers = list(execute_redis_command("SMEMBERS", "mylessons:teachers") or [])
    for kt in ["Simone Cantore", "Katia Loliva"]:
        if kt not in all_teachers:
            all_teachers.append(kt)

    if teacher_filter:
        all_teachers = [t for t in all_teachers if teacher_filter.lower().strip() in t.lower().strip()]

    now = datetime.now()

    # 1. Recupero dati registrati nel foglio Google Sheets 'Iscrizioni' e 'Studenti' per il confronto
    sheet_data_map: Dict[Tuple[str, str], Dict[str, Any]] = {}
    student_names_map: Dict[str, str] = {}
    try:
        from app.services import sheets_service
        # Mappa nomi reali da scheda Studenti
        studenti_rows = sheets_service.get_cached_sheet_values("Studenti", ttl_seconds=30)
        if studenti_rows and len(studenti_rows) > 1:
            for r in studenti_rows[1:]:
                if len(r) > 1 and r[1]:
                    em = canonicalize_email(r[1])
                    full_nm = f"{r[2] if len(r)>2 else ''} {r[3] if len(r)>3 else ''}".strip()
                    if full_nm:
                        student_names_map[em] = full_nm

        isc_rows = sheets_service.get_cached_sheet_values("Iscrizioni", ttl_seconds=30)
        if isc_rows and len(isc_rows) > 1:
            for r in isc_rows[1:]:
                if len(r) > 1 and r[1]:
                    s_em = canonicalize_email(r[1])
                    t_nm = str(r[3] if len(r) > 3 and r[3] else "").strip()
                    s_nm = student_names_map.get(s_em, "")
                    sv = int(r[5]) if len(r) > 5 and str(r[5]).strip().isdigit() else 0
                    dp = int(r[6]) if len(r) > 6 and str(r[6]).strip().isdigit() else 0
                    tar = float(r[7]) if len(r) > 7 and str(r[7]).replace(".", "", 1).strip().isdigit() else 0.0
                    
                    key = (t_nm.lower(), s_em)
                    if key not in sheet_data_map or sv > sheet_data_map[key]["sheetLezioniSvolte"]:
                        sheet_data_map[key] = {
                            "teacherName": t_nm,
                            "studentEmail": s_em,
                            "studentName": s_nm,
                            "sheetLezioniSvolte": sv,
                            "sheetLezioniDaPagare": dp,
                            "tariffa": tar
                        }
    except Exception:
        pass

    stats_list = []

    for t_name in all_teachers:
        lesson_fps = execute_redis_command("SMEMBERS", f"mylessons:teacher:{t_name}:lessons") or []
        offsets_map = get_all_offsets_for_teacher(t_name)
        da_pagare_map = execute_redis_command("HGETALL", f"mylessons:da_pagare:{t_name}") or {}
        if not isinstance(da_pagare_map, dict): da_pagare_map = {}
        tariffe_map = execute_redis_command("HGETALL", f"mylessons:tariffe:{t_name}") or {}
        if not isinstance(tariffe_map, dict): tariffe_map = {}

        student_map: Dict[str, Dict[str, Any]] = {}

        total_cal_svolte = 0
        total_offset_svolte = 0
        total_programmate = 0
        total_annullate = 0

        # Elabora le lezioni memorizzate nel Calendar / Redis
        for fp in lesson_fps:
            raw = execute_redis_command("GET", f"mylessons:lesson:{fp}")
            if not raw:
                continue
            try:
                l_data = json.loads(raw)
                s_em = canonicalize_email(l_data.get("student_email", ""))
                s_name = l_data.get("student_name", "")
                status = l_data.get("status", "svolta")
                tariffa = float(l_data.get("tariffa", 0.0))

                if s_em not in student_map:
                    student_map[s_em] = {
                        "studentEmail": s_em,
                        "studentName": student_names_map.get(s_em) or s_name,
                        "calLezioniSvolte": 0,
                        "offsetSvolte": 0,
                        "lezioniSvolte": 0,
                        "lezioniProgrammate": 0,
                        "lezioniAnnullate": 0,
                        "lezioniDaPagare": 0,
                        "sheetLezioniSvolte": 0,
                        "sheetLezioniDaPagare": 0,
                        "diff": 0,
                        "status": "Allineato",
                        "tariffa": tariffa,
                        "amountDue": 0.0,
                        "lessons": []
                    }

                st_info = student_map[s_em]
                if s_name and not st_info["studentName"] and not s_name.startswith("2026-") and "/" not in s_name:
                    st_info["studentName"] = s_name
                if tariffa > 0 and st_info["tariffa"] == 0:
                    st_info["tariffa"] = tariffa

                st_info["lessons"].append({
                    "id": fp,
                    "date": l_data.get("start_time"),
                    "status": status
                })

                st_time_str = l_data.get("start_time", "")
                is_svolta = (status == "svolta")
                if not is_svolta and status != "annullata" and st_time_str:
                    try:
                        clean_st = st_time_str.replace("Z", "+00:00").split("+")[0]
                        if datetime.fromisoformat(clean_st) <= now:
                            is_svolta = True
                    except Exception:
                        pass

                if is_svolta:
                    st_info["calLezioniSvolte"] += 1
                    total_cal_svolte += 1
                elif status == "programmata":
                    st_info["lezioniProgrammate"] += 1
                    total_programmate += 1
                elif status == "annullata":
                    st_info["lezioniAnnullate"] += 1
                    total_annullate += 1

            except Exception:
                pass

        # Aggiungi eventuali studenti presenti nel foglio ma non ancora estratti in Calendar
        for (t_k, s_k), s_info in sheet_data_map.items():
            if (t_name.lower() in t_k or t_k in t_name.lower()) and s_k not in student_map:
                student_map[s_k] = {
                    "studentEmail": s_k,
                    "studentName": s_info.get("studentName", ""),
                    "calLezioniSvolte": 0,
                    "offsetSvolte": 0,
                    "lezioniSvolte": 0,
                    "lezioniProgrammate": 0,
                    "lezioniAnnullate": 0,
                    "lezioniDaPagare": s_info.get("sheetLezioniDaPagare", 0),
                    "sheetLezioniSvolte": s_info.get("sheetLezioniSvolte", 0),
                    "sheetLezioniDaPagare": s_info.get("sheetLezioniDaPagare", 0),
                    "diff": 0,
                    "status": "Allineato",
                    "tariffa": s_info.get("tariffa", 0.0),
                    "amountDue": round(s_info.get("sheetLezioniDaPagare", 0) * s_info.get("tariffa", 0.0), 2),
                    "lessons": []
                }

        # Applica gli offset storici memorizzati nel DB e sincronizza i totali
        for s_em, st_info in student_map.items():
            match_sheet = sheet_data_map.get((t_name.lower(), s_em))
            if not match_sheet:
                for (t_k, e_k), val in sheet_data_map.items():
                    if e_k == s_em and (t_name.lower() in t_k or t_k in t_name.lower()):
                        match_sheet = val
                        break

            if match_sheet:
                st_info["sheetLezioniSvolte"] = match_sheet.get("sheetLezioniSvolte", 0)
                st_info["sheetLezioniDaPagare"] = match_sheet.get("sheetLezioniDaPagare", 0)
                if not st_info.get("studentName") and match_sheet.get("studentName"):
                    st_info["studentName"] = match_sheet.get("studentName")
            if s_em in tariffe_map and tariffe_map[s_em] is not None:
                try:
                    st_info["tariffa"] = float(tariffe_map[s_em])
                except Exception:
                    pass
            elif off_data and off_data.get("tariffa") is not None and float(off_data.get("tariffa", 0)) > 0:
                st_info["tariffa"] = float(off_data.get("tariffa", 0.0))
            elif st_info.get("tariffa", 0.0) == 0.0 and match_sheet and match_sheet.get("tariffa", 0.0) > 0.0:
                st_info["tariffa"] = match_sheet.get("tariffa", 0.0)

            # Recupera l'offset memorizzato nel DB (oppure calcolalo automaticamente)
            off_data = offsets_map.get(s_em) or get_student_offset(t_name, s_em)
            if off_data:
                offset_sv = int(off_data.get("offsetSvolte", 0))
            else:
                # Se non ancora memorizzato, calcola l'offset di partenza (lezioni precedenti a foglio non a calendario)
                offset_sv = max(0, st_info["sheetLezioniSvolte"] - st_info["calLezioniSvolte"])
                save_student_offset(t_name, s_em, {
                    "teacherName": t_name,
                    "studentEmail": s_em,
                    "studentName": st_info.get("studentName", ""),
                    "offsetSvolte": offset_sv,
                    "baseSheetSvolte": st_info["sheetLezioniSvolte"],
                    "baseCalendarSvolte": st_info["calLezioniSvolte"],
                    "updatedAt": now.isoformat()
                })

            st_info["offsetSvolte"] = offset_sv
            total_offset_svolte += offset_sv

            # Totale lezioni svolte effettive = lezioni nel Calendar + lezioni storiche (offset)
            totale_effettivo = st_info["calLezioniSvolte"] + offset_sv
            st_info["lezioniSvolte"] = totale_effettivo
            st_info["lezioniSvolteTotali"] = totale_effettivo

            cal_sv = st_info["calLezioniSvolte"]
            sheet_sv = st_info["sheetLezioniSvolte"]
            diff = totale_effettivo - sheet_sv
            st_info["diff"] = diff
            
            if diff == 0:
                st_info["status"] = "Allineato"
            elif diff > 0:
                st_info["status"] = f"+{diff} non nel foglio"
            else:
                st_info["status"] = f"{diff} discrepanza"

            # Lezioni da pagare e importo dovuto
            if s_em in da_pagare_map and da_pagare_map[s_em] is not None:
                try:
                    st_info["lezioniDaPagare"] = int(da_pagare_map[s_em])
                except Exception:
                    st_info["lezioniDaPagare"] = max(0, totale_effettivo)
            elif off_data and "lezioniDaPagare" in off_data and off_data["lezioniDaPagare"] is not None:
                try:
                    st_info["lezioniDaPagare"] = int(off_data["lezioniDaPagare"])
                except Exception:
                    st_info["lezioniDaPagare"] = max(0, totale_effettivo)
            elif off_data and "baseSheetDaPagare" in off_data and off_data["baseSheetDaPagare"] is not None:
                try:
                    st_info["lezioniDaPagare"] = int(off_data["baseSheetDaPagare"])
                except Exception:
                    st_info["lezioniDaPagare"] = max(0, totale_effettivo)
            elif st_info.get("sheetLezioniDaPagare", 0) > 0:
                st_info["lezioniDaPagare"] = st_info["sheetLezioniDaPagare"]
            else:
                st_info["lezioniDaPagare"] = max(0, totale_effettivo)

            st_info["amountDue"] = round(st_info["lezioniDaPagare"] * st_info["tariffa"], 2)

            # Pulisci nome studente se contiene date o caratteri spuri
            nm = st_info.get("studentName", "")
            if not nm or nm.startswith("2026-") or "/" in nm:
                st_info["studentName"] = s_em.split("@")[0].replace(".", " ").title()

        total_svolte_totali = sum(s.get("lezioniSvolteTotali", 0) for s in student_map.values())
        total_sheet_svolte = sum(s.get("sheetLezioniSvolte", 0) for s in student_map.values())
        total_sheet_da_pagare = sum(s.get("sheetLezioniDaPagare", 0) for s in student_map.values())
        total_revenue = sum(s.get("amountDue", 0.0) for s in student_map.values())

        stats_list.append({
            "teacherName": t_name,
            "totalLessonsSvolte": total_svolte_totali,
            "totalCalendarLessonsSvolte": total_cal_svolte,
            "totalOffsetLessonsSvolte": total_offset_svolte,
            "totalLessonsProgrammate": total_programmate,
            "totalLessonsAnnullate": total_annullate,
            "totalSheetLessonsSvolte": total_sheet_svolte,
            "totalSheetLessonsDaPagare": total_sheet_da_pagare,
            "totalDelta": total_svolte_totali - total_sheet_svolte,
            "totalLessonsDaPagare": sum(s.get("lezioniDaPagare", 0) for s in student_map.values()),
            "totalRevenueDue": round(total_revenue, 2),
            "totalStudentsCount": len(student_map),
            "students": list(student_map.values())
        })

    return {
        "status": "success",
        "timestamp": now.isoformat(),
        "databaseProvider": "Upstash REST" if (os.getenv("UPSTASH_REDIS_REST_URL") and os.getenv("UPSTASH_REDIS_REST_TOKEN")) else ("Redis-Py" if os.getenv("REDIS_URL") else "Local Mock In-Memory"),
        "teachersCount": len(stats_list),
        "data": stats_list
    }

# ----------------------------------------------------
# OPERAZIONI DB DIRETTE PER FRONTEND (LEZIONI SVOLTE E PAGAMENTI)
# ----------------------------------------------------
def update_student_paid_lessons_db(teacher_name: str, student_email: str, new_paid_value: int) -> bool:
    """Aggiorna le lezioni da pagare / debito nel database per lo studente."""
    clean_em = canonicalize_email(student_email)
    clean_t = (teacher_name or "").strip()
    try:
        val = int(new_paid_value)
    except Exception:
        val = 0

    # 1. Salva nella mappa dedicata da_pagare per questo insegnante
    execute_redis_command("HSET", f"mylessons:da_pagare:{clean_t}", clean_em, str(val))
    execute_redis_command("SET", f"mylessons:da_pagare:{clean_t}:{clean_em}", str(val))

    # 2. Aggiorna l'offset record se presente
    off_data = get_student_offset(clean_t, clean_em)
    if off_data:
        off_data["lezioniDaPagare"] = val
        off_data["updatedAt"] = datetime.now().isoformat()
        save_student_offset(clean_t, clean_em, off_data)
    return True

def update_student_rate_db(teacher_name: str, student_email: str, new_rate: float) -> bool:
    """Aggiorna la tariffa oraria dello studente nel database."""
    clean_em = canonicalize_email(student_email)
    clean_t = (teacher_name or "").strip()
    try:
        rate = float(new_rate)
    except Exception:
        rate = 0.0

    execute_redis_command("HSET", f"mylessons:tariffe:{clean_t}", clean_em, str(rate))
    execute_redis_command("SET", f"mylessons:tariffa:{clean_t}:{clean_em}", str(rate))

    off_data = get_student_offset(clean_t, clean_em)
    if off_data:
        off_data["tariffa"] = rate
        off_data["updatedAt"] = datetime.now().isoformat()
        save_student_offset(clean_t, clean_em, off_data)
    return True

def decrement_student_lessons_db(teacher_name: str, student_email: str) -> bool:
    """Decrementa lezioni svolte e da pagare nel database a seguito di annullamento/rimozione."""
    clean_em = canonicalize_email(student_email)
    clean_t = (teacher_name or "").strip()

    raw_dp = execute_redis_command("HGET", f"mylessons:da_pagare:{clean_t}", clean_em)
    if raw_dp is not None:
        try:
            new_dp = max(0, int(raw_dp) - 1)
            execute_redis_command("HSET", f"mylessons:da_pagare:{clean_t}", clean_em, str(new_dp))
        except Exception:
            pass

    off_data = get_student_offset(clean_t, clean_em)
    if off_data:
        if "offsetSvolte" in off_data and off_data["offsetSvolte"] > 0:
            off_data["offsetSvolte"] = max(0, off_data["offsetSvolte"] - 1)
        if "lezioniDaPagare" in off_data:
            off_data["lezioniDaPagare"] = max(0, int(off_data.get("lezioniDaPagare", 1)) - 1)
        off_data["updatedAt"] = datetime.now().isoformat()
        save_student_offset(clean_t, clean_em, off_data)
    return True

def get_teacher_students_db_stats(teacher_name: str) -> Dict[str, Dict[str, Any]]:
    """
    Recupera le statistiche reali di ciascuno studente per l'insegnante specificato direttamente dal DB:
    - lezioniSvolte (eventi calendario svolti o passati + offset storico memorizzato)
    - lezioniDaPagare (valore salvato nel DB o dedotto da offset/foglio)
    - tariffa (tariffa memorizzata nel DB o nel foglio)
    - amountDue (lezioniDaPagare * tariffa)
    """
    clean_t = (teacher_name or "").strip()
    if not clean_t:
        return {}

    now = datetime.now()

    # 1. Recupera tutti i fingerprints delle lezioni dell'insegnante dal DB
    lesson_fps = execute_redis_command("SMEMBERS", f"mylessons:teacher:{clean_t}:lessons") or []

    cal_counts: Dict[str, int] = {}

    if lesson_fps:
        keys = [f"mylessons:lesson:{fp}" for fp in lesson_fps]
        raw_list = []
        for i in range(0, len(keys), 50):
            batch = keys[i:i+50]
            res = execute_redis_command("MGET", *batch)
            if res:
                if isinstance(res, list):
                    raw_list.extend(res)
                else:
                    raw_list.append(res)

        for raw in raw_list:
            if not raw:
                continue
            try:
                l_data = json.loads(raw) if isinstance(raw, str) else raw
                s_em = canonicalize_email(l_data.get("student_email", ""))
                if not s_em:
                    continue
                status = l_data.get("status", "svolta")
                st = l_data.get("start_time", "")

                is_svolta = (status == "svolta")
                if not is_svolta and status != "annullata" and st:
                    try:
                        clean_st = st.replace("Z", "+00:00").split("+")[0]
                        if datetime.fromisoformat(clean_st) <= now:
                            is_svolta = True
                    except Exception:
                        pass

                if is_svolta:
                    cal_counts[s_em] = cal_counts.get(s_em, 0) + 1
            except Exception:
                pass

    # 2. Recupera tutti gli offset salvati nel DB
    offsets_map = get_all_offsets_for_teacher(clean_t)

    # 3. Recupera pagamenti e tariffe personalizzate salvate nel DB
    da_pagare_map = execute_redis_command("HGETALL", f"mylessons:da_pagare:{clean_t}") or {}
    if not isinstance(da_pagare_map, dict): da_pagare_map = {}

    tariffe_map = execute_redis_command("HGETALL", f"mylessons:tariffe:{clean_t}") or {}
    if not isinstance(tariffe_map, dict): tariffe_map = {}

    # 4. Unisci tutti gli studenti conosciuti nel DB
    all_emails = set(cal_counts.keys()).union(set(offsets_map.keys())).union(set(da_pagare_map.keys()))

    # Se ci sono studenti nel foglio Iscrizioni che non hanno ancora record DB, prendi baseline da Iscrizioni
    sheet_data_map: Dict[str, Dict[str, Any]] = {}
    try:
        from app.services.sheets_service import get_cached_sheet_values
        isc_rows = get_cached_sheet_values("Iscrizioni", ttl_seconds=30)
        for r in isc_rows[1:]:
            if len(r) > 3 and r[1]:
                t_nm = str(r[3] or "").strip()
                if clean_t.lower() in t_nm.lower() or t_nm.lower() in clean_t.lower():
                    s_em = canonicalize_email(r[1])
                    all_emails.add(s_em)
                    sv = int(r[5]) if len(r) > 5 and str(r[5]).strip().isdigit() else 0
                    dp = int(r[6]) if len(r) > 6 and str(r[6]).strip().isdigit() else 0
                    tar = float(r[7]) if len(r) > 7 and str(r[7]).replace(".", "", 1).strip().isdigit() else 0.0
                    sheet_data_map[s_em] = {"sheetSvolte": sv, "sheetDaPagare": dp, "tariffa": tar}
    except Exception:
        pass

    result = {}
    for s_em in all_emails:
        cal_sv = cal_counts.get(s_em, 0)
        off_data = offsets_map.get(s_em) or get_student_offset(clean_t, s_em)
        sh_info = sheet_data_map.get(s_em, {})

        if off_data:
            offset_sv = int(off_data.get("offsetSvolte", 0))
        else:
            sh_sv = sh_info.get("sheetSvolte", 0)
            offset_sv = max(0, sh_sv - cal_sv)

        lez_svolte = cal_sv + offset_sv

        # Lezioni da pagare: DB > offset record > sheet baseline
        if s_em in da_pagare_map and da_pagare_map[s_em] is not None:
            try:
                lez_da_pagare = int(da_pagare_map[s_em])
            except Exception:
                lez_da_pagare = lez_svolte
        elif off_data and "lezioniDaPagare" in off_data and off_data["lezioniDaPagare"] is not None:
            try:
                lez_da_pagare = int(off_data["lezioniDaPagare"])
            except Exception:
                lez_da_pagare = lez_svolte
        elif off_data and "baseSheetDaPagare" in off_data and off_data["baseSheetDaPagare"] is not None:
            try:
                lez_da_pagare = int(off_data["baseSheetDaPagare"])
            except Exception:
                lez_da_pagare = lez_svolte
        elif sh_info and "sheetDaPagare" in sh_info:
            lez_da_pagare = sh_info["sheetDaPagare"]
        else:
            lez_da_pagare = lez_svolte

        # Tariffa: DB > offset record > sheet
        if s_em in tariffe_map and tariffe_map[s_em] is not None:
            try:
                tariffa = float(tariffe_map[s_em])
            except Exception:
                tariffa = 0.0
        elif off_data and off_data.get("tariffa") is not None and float(off_data.get("tariffa", 0)) > 0:
            tariffa = float(off_data.get("tariffa", 0.0))
        elif sh_info and sh_info.get("tariffa", 0.0) > 0:
            tariffa = float(sh_info.get("tariffa", 0.0))
        else:
            tariffa = 0.0

        amount_due = round(lez_da_pagare * tariffa, 2)

        result[s_em] = {
            "lezioniSvolte": lez_svolte,
            "lezioniDaPagare": lez_da_pagare,
            "tariffa": tariffa,
            "amountDue": amount_due
        }

    return result

def get_student_all_db_stats(student_email: str) -> Dict[str, Dict[str, Any]]:
    """
    Recupera i dati DB (lezioniSvolte, lezioniDaPagare, tariffa, amountDue)
    per un determinato studente per ciascuno dei suoi insegnanti.
    Ritorna un dizionario con chiave teacher_name in formato normalizzato.
    """
    clean_em = canonicalize_email(student_email)
    teachers = list(execute_redis_command("SMEMBERS", "mylessons:teachers") or [])
    for def_t in ["Simone Cantore", "Katia Loliva"]:
        if def_t not in teachers:
            teachers.append(def_t)

    res = {}
    for t_name in teachers:
        t_stats = get_teacher_students_db_stats(t_name)
        if clean_em in t_stats:
            res[t_name.lower().strip()] = {
                "teacherName": t_name,
                **t_stats[clean_em]
            }
        else:
            for em_key, stat_val in t_stats.items():
                if em_key == clean_em or em_key == student_email.lower().strip():
                    res[t_name.lower().strip()] = {
                        "teacherName": t_name,
                        **stat_val
                    }
                    break
    return res

# ----------------------------------------------------
# GESTIONE MANUALE DB DA INTERFACCIA WEB PROTETTA
# ----------------------------------------------------
def update_student_full_db_data(
    teacher_name: str,
    student_email: str,
    offset_svolte: Optional[int] = None,
    lezioni_da_pagare: Optional[int] = None,
    tariffa: Optional[float] = None,
    sync_sheet: bool = True
) -> Dict[str, Any]:
    """
    Aggiorna manualmente e atomicamente tutti i dati di uno studente nel DB Redis per un insegnante:
    - offsetSvolte: lezioni storiche di partenza
    - lezioniDaPagare: debito lezioni residue
    - tariffa: tariffa oraria
    - opzionalmente sincronizza il foglio Google Sheets per ridondanza
    """
    clean_t = (teacher_name or "").strip()
    clean_em = canonicalize_email(student_email)
    now = datetime.now()

    off_data = get_student_offset(clean_t, clean_em) or {
        "teacherName": clean_t,
        "studentEmail": clean_em,
        "studentName": clean_em.split("@")[0].title(),
        "offsetSvolte": 0,
        "baseCalendarSvolte": 0,
        "totaleSvolte": 0,
        "updatedAt": now.isoformat()
    }

    if offset_svolte is not None:
        try:
            val_off = int(offset_svolte)
            off_data["offsetSvolte"] = val_off
            cal_sv = int(off_data.get("baseCalendarSvolte", 0))
            off_data["totaleSvolte"] = cal_sv + val_off
        except Exception:
            pass

    if lezioni_da_pagare is not None:
        try:
            val_dp = int(lezioni_da_pagare)
            off_data["lezioniDaPagare"] = val_dp
            execute_redis_command("HSET", f"mylessons:da_pagare:{clean_t}", clean_em, str(val_dp))
            execute_redis_command("SET", f"mylessons:da_pagare:{clean_t}:{clean_em}", str(val_dp))
        except Exception:
            pass

    if tariffa is not None:
        try:
            val_tar = float(tariffa)
            off_data["tariffa"] = val_tar
            execute_redis_command("HSET", f"mylessons:tariffe:{clean_t}", clean_em, str(val_tar))
            execute_redis_command("SET", f"mylessons:tariffa:{clean_t}:{clean_em}", str(val_tar))
        except Exception:
            pass

    off_data["updatedAt"] = now.isoformat()
    save_student_offset(clean_t, clean_em, off_data)

    if sync_sheet:
        try:
            from app.services import sheets_service
            sheets_service.update_student_sheet_data(
                student_email=clean_em,
                teacher_name_or_id=clean_t,
                svolte=off_data.get("totaleSvolte"),
                da_pagare=lezioni_da_pagare,
                tariffa=tariffa
            )
        except Exception as e_sheet:
            print(f"[REDIS_SERVICE] sync_sheet warning: {e_sheet}")

    return {
        "status": "success",
        "teacherName": clean_t,
        "studentEmail": clean_em,
        "offsetSvolte": off_data.get("offsetSvolte"),
        "totaleSvolte": off_data.get("totaleSvolte"),
        "lezioniDaPagare": off_data.get("lezioniDaPagare"),
        "tariffa": off_data.get("tariffa"),
        "updatedAt": now.isoformat()
    }

def add_manual_lesson_db(teacher_name: str, student_email: str, student_name: str = "", start_time_iso: str = "", status: str = "svolta", tariffa: float = 0.0) -> Dict[str, Any]:
    """Aggiunge manualmente una singola lezione nel DB Redis."""
    clean_em = canonicalize_email(student_email)
    clean_t = (teacher_name or "").strip()
    now = datetime.now()
    st = start_time_iso.strip() if start_time_iso else now.strftime("%Y-%m-%dT%H:%M:%S")
    clean_dt = st.replace(":", "").replace("-", "").replace(" ", "_")
    fp = f"FP_MAN_{clean_t.replace(' ', '')}_{clean_em.replace('@', '_').replace('.', '_')}_{clean_dt}"

    lesson_data = {
        "fingerprint": fp,
        "event_id": fp,
        "teacher_name": clean_t,
        "student_email": clean_em,
        "student_name": student_name or clean_em.split("@")[0].title(),
        "start_time": st,
        "end_time": st,
        "status": status,
        "tariffa": float(tariffa or 0.0),
        "source": "manual_admin_web",
        "synced_at": now.isoformat()
    }
    save_or_update_lesson(clean_t, lesson_data)
    return {"status": "success", "lesson": lesson_data}

def update_lesson_status_db(fingerprint: str, new_status: str) -> bool:
    """Modifica lo stato di una specifica lezione nel DB (es. 'svolta', 'annullata', 'programmata')."""
    raw = execute_redis_command("GET", f"mylessons:lesson:{fingerprint}")
    if raw:
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
            data["status"] = new_status
            data["updated_at"] = datetime.now().isoformat()
            execute_redis_command("SET", f"mylessons:lesson:{fingerprint}", json.dumps(data))
            return True
        except Exception:
            pass
    return False

def delete_lesson_from_db(teacher_name: str, fingerprint: str) -> bool:
    """Rimuove completamente una lezione dal DB Redis."""
    clean_t = (teacher_name or "").strip()
    execute_redis_command("DEL", f"mylessons:lesson:{fingerprint}")
    execute_redis_command("SREM", f"mylessons:teacher:{clean_t}:lessons", fingerprint)
    return True
