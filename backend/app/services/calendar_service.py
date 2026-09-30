import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from app.core.google_clients import get_calendar_client

def get_start_date_from_slot(day_name: str, time_str: str) -> datetime:
    days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"]
    target_idx = days.index(day_name) if day_name in days else 1
    now = datetime.now()
    current_day = (now.weekday() + 1) % 7 
    diff_to_monday = 1 if current_day == 0 else -(current_day - 1)
    base_monday = now + timedelta(days=diff_to_monday)
    target_date = base_monday + timedelta(days=(target_idx - 1))
    
    parts = time_str.split(":")
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
                    clean_day = giorno.lower().strip()
                    clean_email = email.lower().strip()
                    fingerprint = re.sub(r"[^a-zA-Z0-9_]", "", f"FP_{teacher_name}_{clean_day}_{clean_time}_{clean_email}")

                    if fingerprint in calendar_map:
                        del calendar_map[fingerprint]
                    else:
                        event_body = {
                            "summary": student_name,
                            "description": f"Docente: {teacher_name}\nStudente: {email}\n[ID_LESSON_APP]\n[FP:{fingerprint}]",
                            "start": {"dateTime": start_time.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"},
                            "end": {"dateTime": end_time.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"},
                            "attendees": [{"email": email}],
                            "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 0}]}
                        }
                        try:
                            service.events().insert(calendarId=calendar_id, body=event_body, sendUpdates="all").execute()
                        except Exception as ev_err:
                            print(f"Errore inserimento evento: {ev_err}")

        for fp, old_ev in calendar_map.items():
            try:
                service.events().delete(calendarId=calendar_id, eventId=old_ev["id"]).execute()
            except Exception as del_err:
                print(f"Errore rimozione evento {fp}: {del_err}")

    except Exception as e:
        print(f"Errore Sync Calendario: {e}")
