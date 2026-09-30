import os
from typing import Dict, List

SPREADSHEET_ID: str = os.getenv("SPREADSHEET_ID", "17RZrxa7JDhWd0k87iirsQyRgw7BHITsZmLlxtHd9-Ak")
SCHEDULE_FILE_ID: str = os.getenv("SCHEDULE_FILE_ID", "18wneQH_rKonfhfJ_btFidGtKZPzWuTlAmbgA3E_IbiQ")
MY_CLIENT_ID: str = os.getenv("MY_CLIENT_ID", "379683469811-hs18j22vq9rnqvvl4a6kq0mvi8aenkao.apps.googleusercontent.com")
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "AIzaSyBwdlidfRS1lPRnqjuEm4OVABA9NlSjG-s")
TEACHER_SECRET_CODE: str = os.getenv("TEACHER_SECRET_CODE", "")

DAY_MAP: Dict[str, int] = {
    "Lunedì": 0, "Martedì": 2, "Mercoledì": 4,
    "Giovedì": 6, "Venerdì": 8, "Sabato": 10
}

DAY_ORDER: List[str] = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"]
