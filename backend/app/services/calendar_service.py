import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from app.core.google_clients import get_calendar_client, get_google_credentials

DAY_OFFSETS: Dict[str, int] = {
    "lunedi": 0, "lunedì": 0,
    "martedi": 1, "martedì": 1,
    "mercoledi": 2, "mercoledì": 2,
    "giovedi": 3, "giovedì": 3,
    "venerdi": 4, "venerdì": 4,
    "sabato": 5,
    "domenica": 6
}

def get_start_date_from_slot(day_name: str, time_str: str) -> datetime:
    clean_day = day_name.lower().strip()
    offset = DAY_OFFSETS.get(clean_day, 0)
    
    now = datetime.now()
    current_weekday = now.weekday()
    monday_current_week = (now - timedelta(days=current_weekday)).replace(hour=0, minute=0, second=0, microsecond=0)
    
    target_date = monday_current_week + timedelta(days=offset)
    
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
        start_window = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end_window = start_window + timedelta(days=21)

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

        for slot in all_schedules:
            giorno = slot.get("giorno")
            ora = slot.get("ora")
            email_field = slot.get("email", "")
            nome_field = slot.get("nome", "")

            if email_field and ora and giorno:
                start_time = get_start_date_from_slot(giorno, ora)
                end_time = start_time + timedelta(minutes=60)
                emails = [e.strip() for e in email_field.split(",") if e.strip()]
                nomi = [n.strip() for n in nome_field.split(",")] if nome_field else []

                for idx, email in enumerate(emails):
                    student_name = nomi[idx] if idx < len(nomi) and nomi[idx] else email
                    clean_time = re.sub(r"[^0-9]", "", ora)
                    clean_day = giorno.lower().strip().replace("ì", "i")
                    clean_email = email.lower().strip()
                    fingerprint = re.sub(r"[^a-zA-Z0-9_]", "", f"FP_{teacher_name}_{clean_day}_{clean_time}_{clean_email}")

                    if fingerprint in calendar_map:
                        del calendar_map[fingerprint]
                    else:
                        base_event_body = {
                            "summary": student_name,
                            "description": f"{teacher_name}\nStudente: {email}\n[ID_LESSON_APP]\n[FP:{fingerprint}]",
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

        for fp, old_ev in calendar_map.items():
            try:
                service.events().delete(calendarId=calendar_id, eventId=old_ev["id"]).execute()
            except Exception as del_err:
                print(f"Errore rimozione evento {fp}: {del_err}")

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
                    ev_res = service.events().list(
                        calendarId=cal_id,
                        timeMin=(now - timedelta(days=7)).isoformat() + "Z",
                        timeMax=(now + timedelta(days=21)).isoformat() + "Z",
                        singleEvents=True
                    ).execute()
                    events = ev_res.get("items", [])
                    t_info["upcomingEventsCount"] = len(events)
                    t_info["sampleEvents"] = [
                        {"summary": ev.get("summary"), "start": ev.get("start", {}).get("dateTime", ev.get("start", {}).get("date", ""))}
                        for ev in events[:5]
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
