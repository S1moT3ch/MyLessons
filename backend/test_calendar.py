import os
import sys
import json
import base64
from datetime import datetime, timedelta
from pathlib import Path

# Carica .env.local se presente
env_local_path = Path("D:/Simone/WebApps/MyLessons/backend/.env.local")
if env_local_path.exists():
    with open(env_local_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip()
                if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                    v = v[1:-1]
                os.environ[k] = v

print("=== TEST ACCESSO GOOGLE CALENDAR ===")

sa_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
if not sa_json:
    print("ERRORE: GOOGLE_SERVICE_ACCOUNT_JSON non trovato nelle variabili d'ambiente.")
    sys.exit(1)

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    import gspread
except ImportError as e:
    print(f"ERRORE: Librerie mancanti: {e}")
    print("Installa le dipendenze: pip install google-auth google-api-python-client gspread")
    sys.exit(1)

try:
    sa_info = json.loads(sa_json)
except Exception:
    sa_info = json.loads(base64.b64decode(sa_json).decode("utf-8"))

print(f"Service Account Email: {sa_info.get('client_email')}")

scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive"
]

creds = service_account.Credentials.from_service_account_info(sa_info, scopes=scopes)
cal_service = build("calendar", "v3", credentials=creds)
gc = gspread.authorize(creds)

# 1. Test Fogli Google
spreadsheet_id = os.getenv("SPREADSHEET_ID")
print(f"\n1. Connessione a Foglio Master ({spreadsheet_id})...")
try:
    ss = gc.open_by_key(spreadsheet_id)
    print(f"-> Foglio aperto con successo: '{ss.title}'")
    sheet_ins = ss.worksheet("Insegnanti")
    rows = sheet_ins.get_all_values()
    print(f"-> Trovati {len(rows)-1} insegnanti registrati.")
except Exception as e:
    print(f"-> ERRORE accesso Fogli: {e}")
    sys.exit(1)

# 2. Verifica Calendari Insegnanti
print("\n2. Verifica Calendari Insegnanti nel foglio:")
teachers = []
for r in rows[1:]:
    if len(r) >= 4:
        t_id = r[0]
        email = r[1]
        nome = f"{r[2]} {r[3]}".strip()
        cal_id = r[7] if len(r) > 7 else ""
        teachers.append({"id": t_id, "email": email, "nome": nome, "cal_id": cal_id})
        print(f"   - Docente: {nome} ({email}) | Calendar ID: '{cal_id}'")

if not teachers:
    print("Nessun docente trovato.")
    sys.exit(0)

# 3. Test interazione Google Calendar API per ciascun docente
print("\n3. Test Interazione Calendar API:")
for t in teachers:
    cal_id = t["cal_id"]
    print(f"\n--- Test Docente: {t['nome']} ---")
    if not cal_id:
        print("   [!] ATTENZIONE: Questo docente non ha un Calendar ID salvato nel foglio 'Insegnanti' (Colonna H)!")
        print("       Questo significa che nessun evento può essere sincronizzato per lui!")
        continue

    try:
        cal = cal_service.calendars().get(calendarId=cal_id).execute()
        print(f"   [OK] Calendario trovato: '{cal.get('summary')}' (Timezone: {cal.get('timeZone')})")
    except Exception as e:
        print(f"   [X] ERRORE lettura calendario '{cal_id}': {e}")
        continue

    # Verifica permessi ACL
    try:
        acl_list = cal_service.acl().list(calendarId=cal_id).execute()
        items = acl_list.get("items", [])
        print(f"   [OK] Regole di condivisione (ACL) trovate: {len(items)}")
        for rule in items:
            scope = rule.get("scope", {})
            print(f"        - Utente: {scope.get('value')} | Ruolo: {rule.get('role')}")
    except Exception as e:
        print(f"   [!] Impossibile leggere ACL: {e}")

    # Lista eventi recenti
    now = datetime.now()
    t_min = (now - timedelta(days=7)).isoformat() + "Z"
    t_max = (now + timedelta(days=21)).isoformat() + "Z"
    try:
        events_res = cal_service.events().list(
            calendarId=cal_id,
            timeMin=t_min,
            timeMax=t_max,
            singleEvents=True
        ).execute()
        events = events_res.get("items", [])
        print(f"   [OK] Eventi presenti tra -7gg e +21gg: {len(events)}")
        for ev in events[:5]:
            start_str = ev.get('start', {}).get('dateTime', ev.get('start', {}).get('date', ''))
            print(f"        * '{ev.get('summary')}' il {start_str}")
        if len(events) > 5:
            print(f"        ... altri {len(events) - 5} eventi.")
    except Exception as e:
        print(f"   [X] ERRORE lettura eventi: {e}")

    # TEST SCRITTURA 1: Creazione evento base
    print("   -> Test creazione evento di prova...")
    start_test = now + timedelta(days=1)
    end_test = start_test + timedelta(minutes=60)
    test_event_body = {
        "summary": "[TEST] Verifica Connessione MyLessons",
        "description": "Evento di test generato dal diagnostico automatico.\n[ID_LESSON_APP]\n[FP:TEST_VERIFY]",
        "start": {"dateTime": start_test.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"},
        "end": {"dateTime": end_test.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"}
    }
    created_id = None
    try:
        created = cal_service.events().insert(calendarId=cal_id, body=test_event_body).execute()
        created_id = created.get("id")
        print(f"   [SUCCESS] Evento di test creato con ID: {created_id}")
    except Exception as e:
        print(f"   [X] ERRORE creazione evento base: {e}")

    # TEST SCRITTURA 2: Test con inviti 'attendees' (se fallisce, svela il problema dei permessi Service Account!)
    if created_id:
        print("   -> Test aggiunta studente come partecipante esterno (attendee)...")
        test_attendee_body = {
            "summary": "[TEST] Verifica Invito Studente",
            "description": "Test con attendee",
            "start": {"dateTime": start_test.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"},
            "end": {"dateTime": end_test.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "Europe/Rome"},
            "attendees": [{"email": "test.studente.mylessons@gmail.com"}]
        }
        try:
            created_att = cal_service.events().insert(
                calendarId=cal_id,
                body=test_attendee_body,
                sendUpdates="all"
            ).execute()
            print(f"   [SUCCESS] Invito partecipante riuscito con ID: {created_att.get('id')}")
            # Rimuovi secondo evento di test
            cal_service.events().delete(calendarId=cal_id, eventId=created_att.get("id")).execute()
        except Exception as e:
            print(f"   [!] ATTENZIONE - ERRORE INVITO PARTECIPANTE: {e}")
            print("       -> ECCO PERCHÈ ALCUNI EVENTI NON VENGONO SALVATI: i Service Account non possono inviare inviti email a partecipanti esterni senza Google Workspace Domain-Wide Delegation!")

        # Pulizia primo evento di test
        try:
            cal_service.events().delete(calendarId=cal_id, eventId=created_id).execute()
            print("   [OK] Evento di prova rimosso con successo.")
        except Exception as e:
            print(f"   [!] Impossibile eliminare evento test: {e}")

print("\n=== FINE DIAGNOSTICA ===")
