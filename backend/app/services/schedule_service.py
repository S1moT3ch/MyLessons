import re
from typing import List, Dict, Any
from app.config import DAY_MAP, CANONICAL_DAYS, normalize_day
from app.core.google_clients import get_main_spreadsheet, get_schedule_spreadsheet
from app.services.calendar_service import sync_schedules_to_calendar

def format_iso_date(raw_val: Any) -> str:
    """Converte qualsiasi formato di data in ISO 8601 (YYYY-MM-DDTHH:mm:ss) per evitare Invalid Date nel frontend."""
    if not raw_val:
        return ""
    s = str(raw_val).strip()
    if not s:
        return ""

    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        return s.replace(" ", "T")

    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?", s)
    if m:
        day, month, year, h, minute, sec = m.groups()
        h = h or "12"
        minute = minute or "00"
        sec = sec or "00"
        return f"{year}-{int(month):02d}-{int(day):02d}T{int(h):02d}:{int(minute):02d}:{int(sec):02d}"

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
        for giorno in CANONICAL_DAYS:
            col_idx = DAY_MAP[giorno]
            header[col_idx] = giorno
            header[col_idx + 1] = "Studente (Email)"
        sheet.insert_row(header, 1)
        return sheet

def get_teacher_subscribers_with_counts(teacher_id: str) -> List[Dict]:
    from app.services.sheets_service import get_cached_sheet_values, get_cached_teacher_schedule
    
    try:
        iscrizioni = get_cached_sheet_values("Iscrizioni", ttl_seconds=25)
    except Exception:
        iscrizioni = []
    try:
        studenti = get_cached_sheet_values("Studenti", ttl_seconds=30)
    except Exception:
        studenti = []

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
            data = get_cached_teacher_schedule(teacher_name, ttl_seconds=20)
            col_indices = [DAY_MAP[g] + 1 for g in CANONICAL_DAYS]
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
    for g in CANONICAL_DAYS:
        col_email = DAY_MAP[g] + 1
        for r in range(1, len(old_data)):
            if col_email < len(old_data[r]):
                cell = old_data[r][col_email].lower().strip()
                if cell:
                    for em in cell.split(","):
                        clean = em.strip()
                        if clean and "@" in clean:
                            old_counts[clean] = old_counts.get(clean, 0) + 1

    # Deduplicazione slot in ingresso per chiave (giorno, ora)
    seen_slots = {}
    for item in all_schedules:
        g = normalize_day(item.get("giorno", ""))
        ora = str(item.get("ora", "")).strip()
        if not g or not ora:
            continue
        key = (g, ora)
        raw_em = item.get("email", "")
        emails = [e.strip().lower() for e in raw_em.split(",") if e.strip() and "@" in e]
        if key not in seen_slots:
            seen_slots[key] = emails
        else:
            for e in emails:
                if e not in seen_slots[key]:
                    seen_slots[key].append(e)

    new_counts = {}
    for (giorno, ora), emails in seen_slots.items():
        for clean in emails:
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

    # Scrivi la matrice pulita senza righe doppie
    matrix = [[""] * 12 for _ in range(50)]
    for (giorno, ora), emails in sorted(seen_slots.items(), key=lambda x: (CANONICAL_DAYS.index(x[0][0]) if x[0][0] in CANONICAL_DAYS else 99, x[0][1])):
        if giorno in DAY_MAP:
            start_col = DAY_MAP[giorno]
            for r in range(50):
                if not matrix[r][start_col]:
                    matrix[r][start_col] = ora
                    matrix[r][start_col + 1] = ",".join(emails)
                    break

    sheet_schedule.update(matrix, "A2:L51")

    # Sincronizza e aggiorna automaticamente le righe Feedback
    try:
        from app.services.sheets_service import update_feedbacks_on_schedule_change, invalidate_sheet_cache
        clean_schedules_list = [
            {"giorno": g, "ora": o, "email": ",".join(ems)}
            for (g, o), ems in seen_slots.items()
        ]
        update_feedbacks_on_schedule_change(teacher_name, old_data, clean_schedules_list)
        invalidate_sheet_cache()
    except Exception as err:
        print(f"[SCHEDULE_SERVICE] Errore sincronizzazione feedback: {err}")

    if calendar_id:
        clean_schedules_list = [
            {"giorno": g, "ora": o, "email": ",".join(ems)}
            for (g, o), ems in seen_slots.items()
        ]
        sync_schedules_to_calendar(calendar_id, teacher_name, clean_schedules_list)

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
    col_indices = [DAY_MAP[g] + 1 for g in CANONICAL_DAYS]
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
        if len(r) > 7 and r[7]:
            calendar_id = r[7]
            teacher_name = f"{r[2]} {r[3]}".strip() if len(r) >= 4 else ""
            if not teacher_name:
                continue
            try:
                sheet = ss_schedule.worksheet(teacher_name)
                matrix = sheet.get_all_values()
                schedules = []
                for g, col_ora, col_em in day_columns:
                    for row_idx in range(1, len(matrix)):
                        if col_ora < len(matrix[row_idx]) and matrix[row_idx][col_ora]:
                            ora = matrix[row_idx][col_ora].strip()
                            email = matrix[row_idx][col_em].strip() if col_em < len(matrix[row_idx]) else ""
                            if ora:
                                schedules.append({"giorno": g, "ora": ora, "email": email})
                sync_schedules_to_calendar(calendar_id, teacher_name, schedules)
                results.append({"teacher": teacher_name, "status": "synced", "count": len(schedules)})
            except Exception as e:
                results.append({"teacher": teacher_name, "status": "error", "error": str(e)})

    return results
