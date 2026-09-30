# MyLessons Backend (Python / FastAPI / Vercel)

Backend Python modulare serverless progettato per sostituire completamente Google Apps Script (GAS), riducendo la latenza da ~4 secondi a ~150-250ms.

## 📁 Struttura del Progetto

```
backend/
├── api/
│   └── index.py                  # Entrypoint serverless per Vercel
├── app/
│   ├── __init__.py
│   ├── config.py                 # Costanti e configurazioni ambiente
│   ├── core/
│   │   ├── auth.py               # Verifica crittografica locale token Google
│   │   └── google_clients.py     # Inizializzazione Service Account, Sheets e Calendar
│   ├── services/
│   │   ├── sheets_service.py     # Operazioni CRUD su Fogli Google principali
│   │   ├── schedule_service.py   # Gestione orari, conteggio lezioni e reset settimanale
│   │   ├── calendar_service.py   # Sincronizzazione automatica eventi Google Calendar
│   │   └── ai_service.py         # Ottimizzatore orari con Google Gemini Flash
│   └── routers/
│       └── legacy_dispatcher.py  # Router di compatibilità 100% per frontend MyLessons
├── requirements.txt              # Dipendenze Python
├── vercel.json                   # Configurazione deploy Vercel
└── .env.example                  # Template variabili d'ambiente
```

---

## 🚀 Setup e Deploy su Vercel

### 1. Prerequisiti Google Cloud
1. Abilita nel tuo progetto Google Cloud le seguenti 3 API:
   - **Google Sheets API**
   - **Google Calendar API**
   - **Google Drive API**
2. Crea un **Service Account** in *API e Servizi > Credenziali*, crea una **Chiave JSON** e scarica il file.
3. Condividi i tuoi 2 fogli di calcolo (`SPREADSHEET_ID` e `SCHEDULE_FILE_ID`) con l'email del Service Account (`xxx@xxx.iam.gserviceaccount.com`) con ruolo **Editor**.

### 2. Deploy su Vercel
Puoi effettuare il deploy tramite CLI o GitHub:
```bash
cd backend
npm i -g vercel
vercel
```

Nella dashboard del progetto su Vercel, imposta in **Settings > Environment Variables**:
- `GOOGLE_SERVICE_ACCOUNT_JSON`: L'intero contenuto testuale del file JSON delle credenziali.
- `SPREADSHEET_ID`: `17RZrxa7JDhWd0k87iirsQyRgw7BHITsZmLlxtHd9-Ak`
- `SCHEDULE_FILE_ID`: `18wneQH_rKonfhfJ_btFidGtKZPzWuTlAmbgA3E_IbiQ`
- `MY_CLIENT_ID`: `379683469811-hs18j22vq9rnqvvl4a6kq0mvi8aenkao.apps.googleusercontent.com`
- `GEMINI_API_KEY`: `AIzaSyBwdlidfRS1lPRnqjuEm4OVABA9NlSjG-s`
- `TEACHER_SECRET_CODE`: Il codice segreto docente impostato.

### 3. Collegamento al Frontend React
In `src/components/config/config.js` del frontend:
```javascript
export const BACKEND_URL = "https://tuo-progetto.vercel.app/api";
```

---

## 💻 Test in Locale (Opzionale)

```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Su Windows
pip install -r requirements.txt
copy .env.example .env      # Configura le tue variabili in .env
uvicorn api.index:app --reload --port 8000
```
L'API sarà disponibile su `http://localhost:8000`.
