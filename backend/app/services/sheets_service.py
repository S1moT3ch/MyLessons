import re
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any
from app.core.google_clients import get_main_spreadsheet

def get_teachers_list() -> List[Dict]:
    sheet = get_main_spreadsheet().worksheet("Insegnanti")
    rows = sheet.get_all_values()
    return [
        {"id": r[0], "email": r[1], "name": f"{r[2]} {r[3]}".strip()}
        for r in rows[1:] if len(r) >= 4 and r[0]
    ]

def check_user_role(email: str) -> Tuple[bool, Optional[str]]:
    clean_email = email.lower().strip()
    ss = get_main_spreadsheet()
    for sheet_name, role_name in [("Insegnanti", "Insegnante"), ("Studenti", "Studente")]:
        try:
            sheet = ss.worksheet(sheet_name)
            for r in sheet.get_all_values()[1:]:
                if len(r) > 1 and r[1].lower().strip() == clean_email:
                    return True, role_name
        except Exception:
            continue
    return False, None

def get_student_subscriptions(student_email: str) -> List[Dict]:
    sheet = get_main_spreadsheet().worksheet("Iscrizioni")
    rows = sheet.get_all_values()
    return [
        {"teacherId": r[2], "teacherName": r[3], "date": r[4]}
        for r in rows[1:] if len(r) > 4 and r[1].lower().strip() == student_email.lower().strip()
    ]

def get_student_balances(student_email: str) -> List[Dict]:
    ss = get_main_spreadsheet()
    iscrizioni = ss.worksheet("Iscrizioni").get_all_values()[1:]
    insegnanti = ss.worksheet("Insegnanti").get_all_values()[1:]

    nomi_ins = {r[0]: f"{r[2]} {r[3]}".strip() or r[1] for r in insegnanti if len(r) >= 4 and r[0]}
    
    result = []
    for r in iscrizioni:
        if len(r) > 1 and r[1].lower().strip() == student_email.lower().strip():
            lez_svolte = int(r[5]) if len(r) > 5 and r[5].isdigit() else 0
            lez_da_pagare = int(r[6]) if len(r) > 6 and r[6].isdigit() else 0
            tariffa = float(r[7]) if len(r) > 7 and r[7].replace(".", "", 1).isdigit() else 0
            t_name = r[3] if len(r) > 3 and r[3] else nomi_ins.get(r[2], "Insegnante")
            
            result.append({
                "teacherName": t_name,
                "lezioniSvolte": lez_svolte,
                "lezioniDaPagare": lez_da_pagare,
                "amountDue": lez_da_pagare * tariffa
            })
    return result

def update_paid_lessons(student_email: str, teacher_id: str, new_value: Any) -> bool:
    sheet = get_main_spreadsheet().worksheet("Iscrizioni")
    rows = sheet.get_all_values()
    for idx, r in enumerate(rows[1:], start=2):
        if len(r) > 2 and r[1].lower().strip() == student_email.lower().strip() and str(r[2]).strip() == str(teacher_id):
            sheet.update_cell(idx, 7, new_value)
            return True
    return False

def update_student_rate(student_email: str, teacher_id: str, new_rate: Any) -> bool:
    sheet = get_main_spreadsheet().worksheet("Iscrizioni")
    rows = sheet.get_all_values()
    for idx, r in enumerate(rows[1:], start=2):
        if len(r) > 2 and r[1].lower().strip() == student_email.lower().strip() and str(r[2]).strip() == str(teacher_id):
            sheet.update_cell(idx, 8, new_rate)
            return True
    return False

def save_or_update_feedback(teacher_name: str, giorno: str, ora: str, email: str, status: str, note: str, pref: str):
    clean_time = re.sub(r"[^0-9]", "", ora) if ora else "0000"
    unique_key = f"{teacher_name.strip()}-{giorno.strip()}-{clean_time}-{email.lower().strip()}"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    sheet = get_main_spreadsheet().worksheet("Feedback")
    rows = sheet.get_all_values()
    found_idx = next((idx for idx, r in enumerate(rows[1:], start=2) if r and r[0] == unique_key), -1)

    if found_idx == -1:
        sheet.append_row([unique_key, status, note, pref, timestamp])
    else:
        sheet.update([[status, note, pref, timestamp]], f"B{found_idx}:E{found_idx}")

def remove_feedback(teacher_name: str, giorno: str, ora: str, student_name: str) -> bool:
    ss = get_main_spreadsheet()
    studenti = ss.worksheet("Studenti").get_all_values()[1:]
    student_email = ""
    for r in studenti:
        if len(r) >= 4 and f"{r[2]} {r[3]}".lower().strip() == student_name.lower().strip():
            student_email = r[1].strip()
            break
    if not student_email:
        return False

    clean_ora = re.sub(r"[^0-9]", "", ora)
    search_key = f"{teacher_name.strip()}-{giorno.strip()}-{clean_ora}-{student_email}"
    sheet_fb = ss.worksheet("Feedback")
    rows = sheet_fb.get_all_values()

    for idx, r in enumerate(rows[1:], start=2):
        if r and r[0].strip() == search_key:
            sheet_fb.delete_rows(idx)
            return True
    return False
