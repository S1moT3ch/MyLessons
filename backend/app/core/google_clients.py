import os
import json
import base64
from typing import Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
import gspread
from app.config import SPREADSHEET_ID, SCHEDULE_FILE_ID

_cached_gc: Optional[gspread.Client] = None
_cached_calendar = None

def get_google_credentials():
    sa_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not sa_json:
        raise ValueError("Variabile GOOGLE_SERVICE_ACCOUNT_JSON non impostata.")
    
    try:
        sa_info = json.loads(sa_json)
    except Exception:
        sa_info = json.loads(base64.b64decode(sa_json).decode("utf-8"))

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/drive"
    ]
    return service_account.Credentials.from_service_account_info(sa_info, scopes=scopes)

def get_gspread_client() -> gspread.Client:
    global _cached_gc
    if _cached_gc is None:
        _cached_gc = gspread.authorize(get_google_credentials())
    return _cached_gc

def get_calendar_client():
    global _cached_calendar
    if _cached_calendar is None:
        _cached_calendar = build("calendar", "v3", credentials=get_google_credentials())
    return _cached_calendar

def get_main_spreadsheet():
    return get_gspread_client().open_by_key(SPREADSHEET_ID)

def get_schedule_spreadsheet():
    return get_gspread_client().open_by_key(SCHEDULE_FILE_ID)
