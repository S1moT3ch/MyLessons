import os
from typing import Dict, List

SPREADSHEET_ID: str = os.getenv("SPREADSHEET_ID", "17RZrxa7JDhWd0k87iirsQyRgw7BHITsZmLlxtHd9-Ak")
SCHEDULE_FILE_ID: str = os.getenv("SCHEDULE_FILE_ID", "18wneQH_rKonfhfJ_btFidGtKZPzWuTlAmbgA3E_IbiQ")
MY_CLIENT_ID: str = os.getenv("MY_CLIENT_ID", "379683469811-hs18j22vq9rnqvvl4a6kq0mvi8aenkao.apps.googleusercontent.com")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "AIzaSyBwdlidfRS1lPRnqjuEm4OVABA9NlSjG-s")
TEACHER_SECRET_CODE: str = os.getenv("TEACHER_SECRET_CODE", "")

# 6 giorni scolastici canonici
CANONICAL_DAYS: List[str] = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"]
DAY_ORDER: List[str] = CANONICAL_DAYS

def normalize_day(day_str: str) -> str:
    """Normalizza qualsiasi variante (con accento, senza accento, minuscola) al giorno canonico."""
    if not day_str:
        return "Lunedì"
    d = str(day_str).strip().lower()
    if d.startswith("lun"): return "Lunedì"
    if d.startswith("mar"): return "Martedì"
    if d.startswith("mer"): return "Mercoledì"
    if d.startswith("gio"): return "Giovedì"
    if d.startswith("ven"): return "Venerdì"
    if d.startswith("sab"): return "Sabato"
    return "Lunedì"

class NormalizedDayMap(dict):
    """Mappa che supporta lookup trasparente per qualsiasi variante di giorno pur esponendo solo i 6 giorni canonici."""
    def __getitem__(self, key):
        return super().__getitem__(normalize_day(key))
    def __contains__(self, key):
        return super().__contains__(normalize_day(key))
    def get(self, key, default=None):
        return super().get(normalize_day(key), default)

DAY_MAP: Dict[str, int] = NormalizedDayMap({
    "Lunedì": 0,
    "Martedì": 2,
    "Mercoledì": 4,
    "Giovedì": 6,
    "Venerdì": 8,
    "Sabato": 10
})
