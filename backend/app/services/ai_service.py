import json
import requests
from typing import Dict, Any
from app.config import GEMINI_API_KEY

def get_ai_optimized_schedule(schedule_data: Any, feedbacks: Any) -> Dict:
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={GEMINI_API_KEY}"
    prompt = f"""
    Sei un esperto di logistica. Analizza i dati e proponi soluzioni di rischedulazione.
    ORARIO ATTUALE: {json.dumps(schedule_data)}
    RICHIESTE ASSENTI: {json.dumps(feedbacks)}
    COMPITO:
    1. Se la preferenza dello studente è libera nell'orario attuale, proponi lo spostamento.
    2. Se la preferenza è occupata da un altro studente presente nella lista degli assenti, proponi lo scambio (swap).
    3. Ogni studente, dopo la rischedulazione, deve avere lo stesso numero di ore che aveva nell'orario originale.
    RESTITUISCI SOLO UN JSON VALIDO:
    {{
      "proposte": [
        {{ "studente": "Nome", "vecchioOrario": "Ora", "nuovoOrario": "Ora", "nota": "Motivazione" }}
      ]
    }}
    """
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    res = requests.post(api_url, json=payload, timeout=25)
    res_json = res.json()
    raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(raw_text)
