from typing import List, Dict
from app.config import DAY_MAP
from app.core.google_clients import get_main_spreadsheet, get_schedule_spreadsheet
from app.services.calendar_service import sync_schedules_to_calendar

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
        result.append({
            "studentName": nomi_studenti.get(email, "Sconosciuto"),
            "studentEmail": row[1],
            "date": row[4] if len(row) > 4 else "",
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

    # 1. Recupero eventuale Calendar ID
    sheet_ins = ss_main.worksheet("Insegnanti")
    calendar_id = None
    for r in sheet_ins.get_all_values()[1:]:
        if len(r) > 7 and r[1].lower().strip() == auth_email.lower().strip():
            calendar_id = r[7]
            break

    # 2. Conteggio vecchio orario direttamente dalle celle
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

    # 3. Conteggio nuovo orario
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

    # 4. Aggiornamento con filtro rigoroso per NOME DOCENTE
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

    # 5. Scrittura matrice (50x12)
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

    # 6. Sincronizzazione calendario
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
