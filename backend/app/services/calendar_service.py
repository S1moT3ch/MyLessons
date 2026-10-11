import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from app.core.google_clients import get_calendar_client, get_google_credentials

DAY_OFFSETS: Dict[str, int] = {
    "lunedi": 0, "lunedì": 0, "lunedǪ": 0,
    "martedi": 1, "martedì": 1, "martedǪ": 1,
    "mercoledi": 2, "mercoledì": 2, "mercoledǪ": 2,
    "giovedi": 3, "giovedì": 3, "giovedǪ": 3,
    "venerdi": 4, "venerdì": 4, "venerdǪ": 4,
    "sabato": 5,
    "domenica": 6
}

def get_reference_monday(now: Optional[datetime] = None) -> datetime:
    """
    Restituisce il Lunedì di inizio della settimana scolastica di riferimento.
    - Se oggi è Domenica (weekday == 6), la settimana di riferimento per le lezioni 
      è quella entrante a partire da domani (Lunedì = now + 1 giorno).
    - Se oggi è da Lunedì (0) a Sabato (5), la settimana di riferimento è quella corrente.
    """
    if now is None:
        now = datetime.now()
    if now.weekday() == 6:
        return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        return (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

def get_start_date_from_slot(day_name: str, time_str: str, now: Optional[datetime] = None) -> datetime:
    clean_day = day_name.lower().strip().replace("ì", "i").replace("Ǫ", "i")
    offset = DAY_OFFSETS.get(clean_day, 0)
    
    ref_monday = get_reference_monday(now)
    target_date = ref_monday + timedelta(days=offset)
    
    clean_time = time_str.strip().replace(".", ":")
    parts = clean_time.split(":")
    h = int(parts[0]) if len(parts) > 0 and parts[0].isdigit() else 0
    m = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    return target_date.replace(hour=h, minute=m, second=0, microsecond=0)

def create_and_share_teacher_calendar(teacher_email: str, teacher_name: str) -> Optional[str]:
    try:
        service = get_calendar_client()
        cal_body = {
            "summary": f"Agenda Lezioni - {teacher_name}",
            "description": f"Calendario sincronizzato con LessonApp per {teacher_name}",
            "timeZone": "Europe/Rome"
        }
        created = service.calendars().insert(body=cal_body).execute()
        cal_id = created.get("id")

        if teacher_email and cal_id:
            rule = {"scope": {"type": "user", "value": teacher_email.lower().strip()}, "role": "writer"}
            try:
                service.acl().insert(calendarId=cal_id, body=rule).execute()
            except Exception as e:
                print(f"Avviso ACL Calendario: {e}")
        return cal_id
    except Exception as e:
        print(f"Errore creazione Calendario: {e}")
        return None

def sync_schedules_to_calendar(calendar_id: str, teacher_name: str, all_schedules: List[Dict]):
    if not calendar_id:
        return
    try:
        service = get_calendar_client()
        now = datetime.now()
        ref_monday = get_reference_monday(now)
        
        # 1. Finestra temporale di sincronizzazione: esattamente la settimana di riferimento (7 giorni)
        start_window = ref_monday
        end_window = ref_monday + timedelta(days=7)

        # 2. Pulizia di sicurezza di eventuali eventi creati per errore nel passato recente (es. la settimana scorsa)
        # che hanno l'indirizzo email come titolo (summary contenente '@') ed etichettati [ID_LESSON_APP]
        try:
            past_start = (ref_monday - timedelta(days=7)).isoformat() + "Z"
            past_end = ref_monday.isoformat() + "Z"
            past_res = service.events().list(
                calendarId=calendar_id,
                timeMin=past_start,
                timeMax=past_end,
                singleEvents=True
            ).execute()
            for pe in past_res.get("items", []):
                pdesc = pe.get("description", "")
                psummary = pe.get("summary", "")
                if "[ID_LESSON_APP]" in pdesc and ("@" in psummary):
                    try:
                        service.events().delete(calendarId=calendar_id, eventId=pe["id"]).execute()
                        print(f"[CALENDAR_SYNC] Rimosso evento errato nel passato con email nel titolo: {psummary} ({pe.get('id')})")
                    except Exception as del_past_err:
                        print(f"[CALENDAR_SYNC] Avviso cancellazione evento passato errato: {del_past_err}")
        except Exception as past_clean_err:
            print(f"[CALENDAR_SYNC] Avviso scansione eventi passati: {past_clean_err}")

        # 3. Mappatura eventi esistenti nella settimana di riferimento
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=start_window.isoformat() + "Z",
            timeMax=end_window.isoformat() + "Z",
            singleEvents=True
        ).execute()

        existing_events = events_result.get("items", [])
        calendar_map = {}

        for event in existing_events:
            desc = event.get("description", "")
            if "[ID_LESSON_APP]" in desc:
                m = re.search(r"\[FP:(.*?)\]", desc)
                if m:
                    calendar_map[m.group(1)] = event

        # 4. Mappa dei nomi studenti (Email -> Nome Cognome) caricata da cache Fogli Studenti
        student_name_map = {}
        try:
            from app.services.sheets_service import get_cached_sheet_values
            studenti_rows = get_cached_sheet_values("Studenti", ttl_seconds=60)
            for r in studenti_rows[1:]:
                if len(r) >= 4 and r[1]:
                    full_n = f"{r[2]} {r[3]}".strip()
                    if full_n:
                        student_name_map[r[1].lower().strip()] = full_n
        except Exception as map_err:
            print(f"[CALENDAR_SYNC] Avviso caricamento mappa studenti: {map_err}")

        # 5. Creazione o aggiornamento eventi per gli slot dell'agenda
        for slot in all_schedules:
            giorno = slot.get("giorno")
            ora = slot.get("ora")
            email_field = slot.get("email", "")
            nome_field = slot.get("nome", "")

            if email_field and ora and giorno:
                start_time = get_start_date_from_slot(giorno, ora, now)
                end_time = start_time + timedelta(minutes=60)
                emails = [e.strip() for e in email_field.split(",") if e.strip()]
                nomi = [n.strip() for n in nome_field.split(",")] if nome_field else []

                for idx, email in enumerate(emails):
                    clean_email = email.lower().strip()
                    s_name = nomi[idx] if idx < len(nomi) and nomi[idx] else ""
                    if not s_name or "@" in s_name:
                        s_name = student_name_map.get(clean_email, "")
                    student_name = s_name if s_name else email

                    clean_time = re.sub(r"[^0-9]", "", ora)
                    clean_day = giorno.lower().strip().replace("ì", "i").replace("Ǫ", "i")
                    target_date_str = start_time.strftime("%Y%m%d")
                    fingerprint = re.sub(r"[^a-zA-Z0-9_]", "", f"FP_{teacher_name}_{target_date_str}_{clean_time}_{clean_email}")
                    legacy_fingerprint = re.sub(r"[^a-zA-Z0-9_]", "", f"FP_{teacher_name}_{clean_day}_{clean_time}_{clean_email}")

                    matched_fp = None
                    if fingerprint in calendar_map:
                        matched_fp = fingerprint
                    elif legacy_fingerprint in calendar_map:
                        matched_fp = legacy_fingerprint

                    if matched_fp:
                        existing_ev = calendar_map[matched_fp]
                        if existing_ev.get("summary") != student_name:
                            try:
                                service.events().patch(
                                    calendarId=calendar_id,
                                    eventId=existing_ev["id"],
                                    body={"summary": student_name}
                                ).execute()
                            except Exception as patch_err:
                                print(f"[CALENDAR_SYNC] Avviso patch summary per {matched_fp}: {patch_err}")
                        del calendar_map[matched_fp]
                    else:
                        base_event_body = {
                            "summary": student_name,
                            "description": f"Docente: {teacher_name}\nStudente: {email}\n[ID_LESSON_APP]\n[FP:{fingerprint}]",
                            "start": {"dateTime": start_time.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"},
                            "end": {"dateTime": end_time.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"},
                            "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 0}]}
                        }

                        created = False
                        try:
                            att_body = {**base_event_body, "attendees": [{"email": email}]}
                            service.events().insert(calendarId=calendar_id, body=att_body, sendUpdates="all").execute()
                            created = True
                        except Exception:
                            pass

                        if not created:
                            try:
                                service.events().insert(calendarId=calendar_id, body=base_event_body).execute()
                                created = True
                            except Exception as ev_err:
                                print(f"Errore critico inserimento evento {fingerprint}: {ev_err}")

        # 6. Rimozione eventi obsoleti per la settimana di riferimento
        for fp, old_ev in calendar_map.items():
            try:
                service.events().delete(calendarId=calendar_id, eventId=old_ev["id"]).execute()
            except Exception as del_err:
                print(f"Errore rimozione evento obsoleto {fp}: {del_err}")

    except Exception as e:
        print(f"Errore Sync Calendario: {e}")

def run_calendar_diagnostics() -> Dict[str, Any]:
    """Test completo di diagnosi per Google Calendar."""
    from app.core.google_clients import get_main_spreadsheet
    creds = get_google_credentials()
    sa_email = getattr(creds, "service_account_email", "unknown")
    report = {
        "status": "success",
        "serviceAccountEmail": sa_email,
        "timestamp": datetime.now().isoformat(),
        "teachers": [],
        "errors": []
    }
    try:
        service = get_calendar_client()
        ss = get_main_spreadsheet()
        rows = ss.worksheet("Insegnanti").get_all_values()

        for idx, r in enumerate(rows[1:], start=2):
            if len(r) >= 4 and r[0]:
                nome = f"{r[2]} {r[3]}".strip()
                email = r[1].strip()
                cal_id = r[7].strip() if len(r) > 7 else ""

                t_info = {
                    "row": idx,
                    "teacherName": nome,
                    "email": email,
                    "calendarId": cal_id,
                    "calendarExists": False,
                    "aclSharing": [],
                    "upcomingEventsCount": 0,
                    "testEventCreated": False,
                    "sampleEvents": [],
                    "notes": []
                }

                if not cal_id:
                    t_info["notes"].append("ATTENZIONE: Colonna H (Calendar ID) vuota!")
                    report["teachers"].append(t_info)
                    continue

                try:
                    cal = service.calendars().get(calendarId=cal_id).execute()
                    t_info["calendarExists"] = True
                    t_info["calendarSummary"] = cal.get("summary")
                    t_info["timeZone"] = cal.get("timeZone")
                except Exception as e:
                    t_info["notes"].append(f"Errore accesso calendario: {str(e)}")
                    report["teachers"].append(t_info)
                    continue

                try:
                    acl_res = service.acl().list(calendarId=cal_id).execute()
                    t_info["aclSharing"] = [
                        {"user": item.get("scope", {}).get("value"), "role": item.get("role")}
                        for item in acl_res.get("items", [])
                    ]
                except Exception as e:
                    t_info["notes"].append(f"Errore lettura ACL: {str(e)}")

                try:
                    now = datetime.now()
                    ref_mon = get_reference_monday(now)
                    ev_res = service.events().list(
                        calendarId=cal_id,
                        timeMin=(ref_mon - timedelta(days=7)).isoformat() + "Z",
                        timeMax=(ref_mon + timedelta(days=21)).isoformat() + "Z",
                        singleEvents=True
                    ).execute()
                    events = ev_res.get("items", [])
                    t_info["upcomingEventsCount"] = len(events)
                    t_info["sampleEvents"] = [
                        {"summary": ev.get("summary"), "start": ev.get("start", {}).get("dateTime", ev.get("start", {}).get("date", ""))}
                        for ev in events[:10]
                    ]
                except Exception as e:
                    t_info["notes"].append(f"Errore lettura eventi: {str(e)}")

                try:
                    test_start = datetime.now() + timedelta(days=3)
                    test_end = test_start + timedelta(minutes=60)
                    test_body = {
                        "summary": "[DIAGNOSTICA] Test Scrittura MyLessons",
                        "description": "Evento temporaneo di test.\n[ID_LESSON_APP]\n[FP:TEST_TEMP]",
                        "start": {"dateTime": test_start.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"},
                        "end": {"dateTime": test_end.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"}
                    }
                    cr = service.events().insert(calendarId=cal_id, body=test_body).execute()
                    t_info["testEventCreated"] = True
                    service.events().delete(calendarId=cal_id, eventId=cr.get("id")).execute()
                except Exception as e:
                    t_info["notes"].append(f"Errore creazione evento test: {str(e)}")

                report["teachers"].append(t_info)

    except Exception as e:
        report["status"] = "error"
        report["errors"].append(str(e))

    return report
