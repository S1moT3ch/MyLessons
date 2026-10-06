import re
import time
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any
from app.core.google_clients import get_main_spreadsheet, get_schedule_spreadsheet
from app.config import DAY_MAP

_sheet_cache: Dict[str, Tuple[List, float]] = {}
_persistent_backup: Dict[str, List] = {}

_schedule_cache: Dict[str, Tuple[List, float]] = {}
_persistent_schedules: Dict[str, List] = {}

def normalize_fb_key(teacher_name: str, giorno: str, ora: str, email: str) -> str:
    """Restituisce una chiave normalizzata priva di accenti, spaziature anomale e maiuscole."""
    clean_t = re.sub(r"[^a-zA-Z0-9]", "", str(teacher_name)).lower()
    clean_g = re.sub(r"[^a-zA-Z0-9]", "", str(giorno)).lower()
    clean_g = clean_g.replace("ì", "i").replace("è", "e").replace("é", "e").replace("à", "a").replace("ò", "o").replace("ù", "u")
    clean_o = re.sub(r"[^0-9]", "", str(ora))
    clean_e = str(email).strip().lower()
    return f"{clean_t}_{clean_g}_{clean_o}_{clean_e}"

def get_cached_sheet_values(sheet_name: str, ttl_seconds: int = 25) -> List[List[str]]:
    """Recupera i valori del foglio con cache in-memory e scudo anti-429 Quota Exceeded."""
    now = time.time()
    if sheet_name in _sheet_cache:
        vals, expiry = _sheet_cache[sheet_name]
        if now < expiry:
            return vals

    try:
        ss = get_main_spreadsheet()
        sheet = ss.worksheet(sheet_name)
        vals = sheet.get_all_values()
        _sheet_cache[sheet_name] = (vals, now + ttl_seconds)
        _persistent_backup[sheet_name] = vals
        return vals
    except Exception as e:
        if sheet_name in _persistent_backup:
            print(f"[SHEETS_SERVICE] Google 429 Quota o errore su '{sheet_name}'. Servito da cache persistente: {e}")
            return _persistent_backup[sheet_name]
        print(f"[SHEETS_SERVICE] Google 429 o errore su '{sheet_name}'. Ritorno array vuoto di sicurezza: {e}")
        return []

def get_cached_teacher_schedule(teacher_name: str, ttl_seconds: int = 25) -> List[List[str]]:
    """Recupera la matrice oraria del docente con cache e protezione 429."""
    now = time.time()
    clean_t = teacher_name.strip()
    if clean_t in _schedule_cache:
        vals, expiry = _schedule_cache[clean_t]
        if now < expiry:
            return vals

    try:
        ss = get_schedule_spreadsheet()
        sheet = ss.worksheet(clean_t)
        vals = sheet.get_all_values()
        _schedule_cache[clean_t] = (vals, now + ttl_seconds)
        _persistent_schedules[clean_t] = vals
        return vals
    except Exception as e:
        if clean_t in _persistent_schedules:
            print(f"[SHEETS_SERVICE] Google 429 o errore su orario '{clean_t}'. Servito da backup: {e}")
            return _persistent_schedules[clean_t]
        return []

def invalidate_sheet_cache(sheet_name: Optional[str] = None):
    global _sheet_cache, _schedule_cache
    if sheet_name:
        _sheet_cache.pop(sheet_name, None)
    else:
        _sheet_cache.clear()
        _schedule_cache.clear()

def get_teachers_list() -> List[Dict]:
    rows = get_cached_sheet_values("Insegnanti", ttl_seconds=30)
    return [
        {"id": r[0], "email": r[1], "name": f"{r[2]} {r[3]}".strip()}
        for r in rows[1:] if len(r) >= 4 and r[0]
    ]

def check_user_role(email: str) -> Tuple[bool, Optional[str]]:
    clean_email = email.lower().strip()
    for sheet_name, role_name in [("Insegnanti", "Insegnante"), ("Studenti", "Studente")]:
        try:
            rows = get_cached_sheet_values(sheet_name, ttl_seconds=30)
            for r in rows[1:]:
                if len(r) > 1 and r[1].lower().strip() == clean_email:
                    return True, role_name
        except Exception:
            continue
    return False, None

def get_student_subscriptions(student_email: str) -> List[Dict]:
    from app.services.schedule_service import format_iso_date
    rows = get_cached_sheet_values("Iscrizioni", ttl_seconds=20)
    return [
        {"teacherId": r[2], "teacherName": r[3], "date": format_iso_date(r[4]) if len(r) > 4 else ""}
        for r in rows[1:] if len(r) > 4 and r[1].lower().strip() == student_email.lower().strip()
    ]

def get_student_balances(student_email: str) -> List[Dict]:
    iscrizioni = get_cached_sheet_values("Iscrizioni", ttl_seconds=20)[1:]
    insegnanti = get_cached_sheet_values("Insegnanti", ttl_seconds=30)[1:]

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
    invalidate_sheet_cache("Iscrizioni")
    sheet = get_main_spreadsheet().worksheet("Iscrizioni")
    rows = sheet.get_all_values()
    for idx, r in enumerate(rows[1:], start=2):
        if len(r) > 2 and r[1].lower().strip() == student_email.lower().strip() and str(r[2]).strip() == str(teacher_id):
            sheet.update_cell(idx, 7, new_value)
            return True
    return False

def update_student_rate(student_email: str, teacher_id: str, new_rate: Any) -> bool:
    invalidate_sheet_cache("Iscrizioni")
    sheet = get_main_spreadsheet().worksheet("Iscrizioni")
    rows = sheet.get_all_values()
    for idx, r in enumerate(rows[1:], start=2):
        if len(r) > 2 and r[1].lower().strip() == student_email.lower().strip() and str(r[2]).strip() == str(teacher_id):
            sheet.update_cell(idx, 8, new_rate)
            return True
    return False

def save_or_update_feedback(teacher_name: str, giorno: str, ora: str, email: str, status: str, note: str, pref: str):
    invalidate_sheet_cache("Feedback")
    clean_time = re.sub(r"[^0-9]", "", ora) if ora else "0000"
    unique_key = f"{teacher_name.strip()}-{giorno.strip()}-{clean_time}-{email.lower().strip()}"
    norm_target = normalize_fb_key(teacher_name, giorno, ora, email)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    sheet = get_main_spreadsheet().worksheet("Feedback")
    rows = sheet.get_all_values()
    found_idx = -1
    for idx, r in enumerate(rows[1:], start=2):
        if not r or not r[0]:
            continue
        parts = r[0].split("-")
        if len(parts) >= 4 and normalize_fb_key(parts[0], parts[1], parts[2], parts[3]) == norm_target:
            found_idx = idx
            break
        elif r[0].strip() == unique_key:
            found_idx = idx
            break

    if found_idx == -1:
        sheet.append_row([unique_key, status, note, pref, timestamp])
    else:
        sheet.update([[unique_key, status, note, pref, timestamp]], f"A{found_idx}:E{found_idx}")

def remove_feedback(teacher_name: str, giorno: str, ora: str, student_name: str = "", student_email: str = "") -> bool:
    invalidate_sheet_cache("Feedback")
    ss = get_main_spreadsheet()
    clean_email = student_email.lower().strip() if student_email else ""
    if not clean_email and student_name:
        studenti = get_cached_sheet_values("Studenti", ttl_seconds=30)[1:]
        for r in studenti:
            if len(r) >= 4 and f"{r[2]} {r[3]}".lower().strip() == student_name.lower().strip():
                clean_email = r[1].lower().strip()
                break
    if not clean_email:
        return False

    norm_target = normalize_fb_key(teacher_name, giorno, ora, clean_email)
    sheet_fb = ss.worksheet("Feedback")
    rows = sheet_fb.get_all_values()

    for idx, r in enumerate(rows[1:], start=2):
        if not r or not r[0]:
            continue
        parts = r[0].split("-")
        if (len(parts) >= 4 and normalize_fb_key(parts[0], parts[1], parts[2], parts[3]) == norm_target) or (clean_email in r[0] and (ora in r[0] or normalize_fb_key(teacher_name, giorno, "", clean_email) in r[0])):
            sheet_fb.delete_rows(idx)
            return True
    return False

def update_feedbacks_on_schedule_change(teacher_name: str, old_schedule_data: List[List[str]], new_schedules: List[Dict]):
    """
    Sincronizza e aggiorna automaticamente le righe della tabella Feedback quando il docente
    sposta o elimina slot orari nell'orario settimanale.
    """
    try:
        invalidate_sheet_cache("Feedback")
        
        old_slots_by_email: Dict[str, List[Dict]] = {}
        for g, col_ora in DAY_MAP.items():
            col_em = col_ora + 1
            for r in range(1, len(old_schedule_data)):
                if col_ora < len(old_schedule_data[r]) and col_em < len(old_schedule_data[r]):
                    ora_val = str(old_schedule_data[r][col_ora]).strip()
                    em_val = str(old_schedule_data[r][col_em]).strip()
                    if ora_val and em_val:
                        for em in em_val.split(","):
                            clean_em = em.strip().lower()
                            if clean_em and "@" in clean_em:
                                old_slots_by_email.setdefault(clean_em, []).append({"giorno": g, "ora": ora_val})

        new_slots_by_email: Dict[str, List[Dict]] = {}
        for item in new_schedules:
            g = item.get("giorno", "")
            ora_val = str(item.get("ora", "")).strip()
            em_val = str(item.get("email", "")).strip()
            if g and ora_val and em_val:
                for em in em_val.split(","):
                    clean_em = em.strip().lower()
                    if clean_em and "@" in clean_em:
                        new_slots_by_email.setdefault(clean_em, []).append({"giorno": g, "ora": ora_val})

        ss = get_main_spreadsheet()
        sheet_fb = ss.worksheet("Feedback")
        fb_rows = sheet_fb.get_all_values()
        if len(fb_rows) <= 1:
            return

        all_involved_emails = set(list(old_slots_by_email.keys()) + list(new_slots_by_email.keys()))
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        rows_to_delete = []
        updates = []

        for row_idx, r in enumerate(fb_rows[1:], start=2):
            if not r or not r[0]:
                continue
            key = r[0].strip()
            parts = key.split("-")
            if len(parts) < 4:
                continue

            fb_teacher, fb_giorno, fb_ora, fb_email = parts[0].strip(), parts[1].strip(), parts[2].strip(), parts[3].strip().lower()
            if fb_teacher.lower() != teacher_name.lower() or fb_email not in all_involved_emails:
                continue

            old_slots = old_slots_by_email.get(fb_email, [])
            new_slots = new_slots_by_email.get(fb_email, [])

            norm_fb_key = normalize_fb_key(fb_teacher, fb_giorno, fb_ora, fb_email)
            still_exists_identical = any(
                normalize_fb_key(teacher_name, s["giorno"], s["ora"], fb_email) == norm_fb_key
                for s in new_slots
            )

            if still_exists_identical:
                continue

            unmatched_new = [
                s for s in new_slots
                if not any(s["giorno"] == os["giorno"] and s["ora"] == os["ora"] for os in old_slots)
            ]

            if unmatched_new:
                target_new_slot = unmatched_new[0]
                new_clean_ora = re.sub(r"[^0-9]", "", target_new_slot["ora"])
                new_unique_key = f"{teacher_name.strip()}-{target_new_slot['giorno'].strip()}-{new_clean_ora}-{fb_email}"
                
                new_status = "Confermata"
                old_note = r[2] if len(r) > 2 else ""
                new_note = f"{old_note} (Spostata a {target_new_slot['giorno']} {target_new_slot['ora']})".strip()
                pref = r[3] if len(r) > 3 else ""

                updates.append({
                    "range": f"A{row_idx}:E{row_idx}",
                    "values": [[new_unique_key, new_status, new_note, pref, now_str]]
                })
            else:
                rows_to_delete.append(row_idx)

        for u in updates:
            sheet_fb.update(u["values"], u["range"])

        for r_idx in sorted(rows_to_delete, reverse=True):
            sheet_fb.delete_rows(r_idx)

    except Exception as e:
        print(f"[SHEETS_SERVICE] Errore update_feedbacks_on_schedule_change: {e}")
