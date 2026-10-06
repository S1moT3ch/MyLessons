import re
from typing import List, Dict, Any
from app.config import DAY_MAP
from app.core.google_clients import get_main_spreadsheet, get_schedule_spreadsheet
from app.services.calendar_service import sync_schedules_to_calendar

def format_iso_date(raw_val: Any) -> str:
    """Converte qualsiasi formato di data in ISO 8601 (YYYY-MM-DDTHH:mm:ss) per evitare Invalid Date nel frontend."""
    if not raw_val:
        return ""
    s = str(raw_val).strip()
    if not s:
        return ""

    # 1. Se è già formato ISO tipo 2026-10-05...
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        return s.replace(" ", "T")

    # 2. Formato italiano DD/MM/YYYY o DD/MM/YYYY HH:MM:SS
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?", s)
    if m:
        day, month, year, h, minute, sec = m.groups()
        h = h or "12"
        minute = minute or "00"
        sec = sec or "00"
        return f"{year}-{int(month):02d}-{int(day):02d}T{int(h):02d}:{int(minute):02d}:{int(sec):02d}"

    # 3. Formato inglese Apps Script (es: Mon Oct 05 2026 19:40:00 GMT+0200)
    months = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
        "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"
    }
    m_eng = re.search(r"([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?", s)
    if m_eng:
        m_str, day, year, h, minute, sec = m_eng.groups()
        m_num = months.get(m_str.lower(), "01")
        h = h or "12"
        minute = minute or "00"
        sec = sec or "00"
        return f"{year}-{m_num}-{int(day):02d}T{h}:{minute}:{sec}"

    return s

def get_or_create_teacher_sheet(teacher_name: str):
    ss = get_schedule_spreadsheet()
    try:
        return ss.worksheet(teacher_name)
    except Exception:
        sheet = ss.add_worksheet(title=teacher_name, rows=60, cols=12)
        header = [""] * 12
        for giorno, col_idx in DAY_MAP.items():
            header[col_idx] = giorno
            header[col_idx + 1] = "Studente (Email)"
        sheet.insert_row(header, 1)
        return sheet

def get_teacher_subscribers_with_counts(teacher_id: str) -> List[Dict]:
    ss_main = get_main_spreadsheet()
    iscrizioni = ss_main.worksheet("Iscrizioni").get_all_values()
    studenti = ss_main.worksheet("Studenti").get_all_values()

    nomi_studenti = {r[1].lower().strip(): f"{r[2]} {r[3]}".strip() for r in studenti[1:] if len(r) >= 4 and r[1]}

    teacher_name = ""
    filtered_subs = []
    for r in iscrizioni[1:]:
        if len(r) > 3 and str(r[2]).strip() == teacher_id:
            if not teacher_name and r[3]:
                teacher_name = r[3].strip()
            filtered_subs.append(r)

    weekly_counts = {}
    if teacher_name:
        try:
            sheet = get_or_create_teacher_sheet(teacher_name)
            data = sheet.get_all_values()
            col_indices = [DAY_MAP[g] + 1 for g in DAY_MAP]
            for r in range(1, len(data)):
                for c in col_indices:
                    if c < len(data[r]) and data[r][c]:
                        for email in data[r][c].split(","):
                            clean = email.strip().lower()
                            if clean and "@" in clean:
                                weekly_counts[clean] = weekly_counts.get(clean, 0) + 1
        except Exception:
            pass

    result = []
    for row in filtered_subs:
        email = row[1].lower().strip()
        raw_date = row[4] if len(row) > 4 else ""
        result.append({
            "studentName": nomi_studenti.get(email, "Sconosciuto"),
            "studentEmail": row[1],
            "date": format_iso_date(raw_date),
            "lessonCount": weekly_counts.get(email, 0),
            "lezioniSvolte": int(row[5]) if len(row) > 5 and row[5].isdigit() else 0,
            "lezioniDaPagare": int(row[6]) if len(row) > 6 and row[6].isdigit() else 0,
            "tariffa": float(row[7]) if len(row) > 7 and row[7].replace(".", "", 1).isdigit() else 0
        })
    return result

def save_full_schedule(teacher_name: str, auth_email: str, all_schedules: List[Dict]) -> bool:
    ss_main = get_main_spreadsheet()
    sheet_schedule = get_or_create_teacher_sheet(teacher_name)
    sheet_iscrizioni = ss_main.worksheet("Iscrizioni")

    old_data = sheet_schedule.get_all_values()
    iscrizioni_rows = sheet_iscrizioni.get_all_values()

    sheet_ins = ss_main.worksheet("Insegnanti")
    calendar_id = None
    for r in sheet_ins.get_all_values()[1:]:
        if len(r) > 7 and r[1].lower().strip() == auth_email.lower().strip():
            calendar_id = r[7]
            break

    old_counts = {}
    for giorno, col_idx in DAY_MAP.items():
        col_email = col_idx + 1
        for r in range(1, len(old_data)):
            if col_email < len(old_data[r]):
                cell = old_data[r][col_email].lower().strip()
                if cell:
                    for em in cell.split(","):
                        clean = em.strip()
                        if clean and "@" in clean:
                            old_counts[clean] = old_counts.get(clean, 0) + 1

    new_counts = {}
    for item in all_schedules:
        em_field = item.get("email", "")
        if em_field:
            for em in em_field.split(","):
                clean = em.strip().lower()
                if clean and "@" in clean:
                    new_counts[clean] = new_counts.get(clean, 0) + 1

    all_students = set(list(new_counts.keys()) + list(old_counts.keys()))
    final_diffs = {
        em: new_counts.get(em, 0) - old_counts.get(em, 0)
        for em in all_students if new_counts.get(em, 0) - old_counts.get(em, 0) != 0
    }

    if final_diffs:
        clean_teacher = teacher_name.lower().strip()
        for i in range(1, len(iscrizioni_rows)):
            r = iscrizioni_rows[i]
            if len(r) > 3:
                r_email = r[1].lower().strip()
                r_teacher = r[3].lower().strip()
                if r_email in final_diffs and r_teacher == clean_teacher:
                    diff = final_diffs[r_email]
                    curr_svolte = int(r[5]) if len(r) > 5 and r[5].isdigit() else 0
                    curr_da_pagare = int(r[6]) if len(r) > 6 and r[6].isdigit() else 0
                    r[5] = str(max(0, curr_svolte + diff))
                    r[6] = str(max(0, curr_da_pagare + diff))

        sheet_iscrizioni.update(iscrizioni_rows, "A1")

    matrix = [[""] * 12 for _ in range(50)]
    for item in all_schedules:
        giorno = item.get("giorno")
        if giorno in DAY_MAP:
            start_col = DAY_MAP[giorno]
            for r in range(50):
                if not matrix[r][start_col]:
                    matrix[r][start_col] = str(item.get("ora", ""))
                    matrix[r][start_col + 1] = str(item.get("email", ""))
                    break

    sheet_schedule.update(matrix, "A2:L51")

    # Sincronizza e aggiorna automaticamente le righe Feedback se gli slot sono stati spostati o rimossi
    try:
        from app.services.sheets_service import update_feedbacks_on_schedule_change, invalidate_sheet_cache
        update_feedbacks_on_schedule_change(teacher_name, old_data, all_schedules)
        invalidate_sheet_cache()
    except Exception as err:
        print(f"[SCHEDULE_SERVICE] Errore sincronizzazione feedback: {err}")

    if calendar_id:
        sync_schedules_to_calendar(calendar_id, teacher_name, all_schedules)

    return True

def remove_slot_and_decrement(student_email: str, teacher_name: str) -> bool:
    if not student_email:
        return True
    ss_main = get_main_spreadsheet()
    sheet = ss_main.worksheet("Iscrizioni")
    rows = sheet.get_all_values()
    clean_em = student_email.lower().strip()
    clean_t = teacher_name.lower().strip()

    for idx, r in enumerate(rows[1:], start=2):
        if len(r) > 3 and r[1].lower().strip() == clean_em and r[3].lower().strip() == clean_t:
            svolte = max(0, (int(r[5]) if len(r) > 5 and r[5].isdigit() else 0) - 1)
            da_pagare = max(0, (int(r[6]) if len(r) > 6 and r[6].isdigit() else 0) - 1)
            sheet.update_cell(idx, 6, svolte)
            sheet.update_cell(idx, 7, da_pagare)
            return True
    return False

def reset_schedule_for_week(teacher_name: str, auth_email: str):
    sheet = get_or_create_teacher_sheet(teacher_name)
    data = sheet.get_all_values()
    col_indices = [DAY_MAP[g] + 1 for g in DAY_MAP]
    for r in range(1, len(data)):
        for c in col_indices:
            if c < len(data[r]):
                data[r][c] = ""
    sheet.update(data, "A1")

    ss_main = get_main_spreadsheet()
    for r in ss_main.worksheet("Insegnanti").get_all_values()[1:]:
        if len(r) > 7 and r[1].lower().strip() == auth_email.lower().strip() and r[7]:
            sync_schedules_to_calendar(r[7], teacher_name, [])
            break

def sync_all_teachers_to_calendar() -> List[Dict]:
    ss_main = get_main_spreadsheet()
    ss_schedule = get_schedule_spreadsheet()

    studenti = ss_main.worksheet("Studenti").get_all_values()[1:]
    nomi_map = {r[1].lower().strip(): f"{r[2]} {r[3]}".strip() for r in studenti if len(r) >= 4 and r[1]}

    insegnanti = ss_main.worksheet("Insegnanti").get_all_values()[1:]
    results = []

    day_columns = [
        ("Lunedì", 0, 1),
        ("Martedì", 2, 3),
        ("Mercoledì", 4, 5),
        ("Giovedì", 6, 7),
        ("Venerdì", 8, 9),
        ("Sabato", 10, 11)
    ]

    for r in insegnanti:
        if len(r) >= 4 and r[0]:
            teacher_name = f"{r[2]} {r[3]}".strip()
            cal_id = r[7].strip() if len(r) > 7 else ""

            if not cal_id:
                results.append({"teacherName": teacher_name, "status": "skipped", "reason": "Nessun Calendar ID presente"})
                continue

            try:
                sheet = ss_schedule.worksheet(teacher_name)
            except Exception:
                results.append({"teacherName": teacher_name, "status": "skipped", "reason": f"Foglio orario non trovato per '{teacher_name}'"})
                continue

            data = sheet.get_all_values()
            all_schedules = []

            for giorno, col_ora, col_em in day_columns:
                for row_idx in range(1, len(data)):
                    row_vals = data[row_idx]
                    if col_ora < len(row_vals) and row_vals[col_ora]:
                        ora_str = str(row_vals[col_ora]).strip()
                        emails_str = row_vals[col_em] if col_em < len(row_vals) else ""

                        if ora_str and emails_str:
                            email_list = [e.strip() for e in emails_str.split(",") if e.strip()]
                            for em in email_list:
                                student_name = nomi_map.get(em.lower(), em)
                                all_schedules.append({
                                    "giorno": giorno,
                                    "ora": ora_str,
                                    "email": em,
                                    "nome": student_name
                                })

            sync_schedules_to_calendar(cal_id, teacher_name, all_schedules)

            results.append({
                "teacherName": teacher_name,
                "calendarId": cal_id,
                "status": "synchronized",
                "eventsCount": len(all_schedules),
                "events": [{"giorno": s["giorno"], "ora": s["ora"], "studente": s["nome"]} for s in all_schedules]
            })

    return results
