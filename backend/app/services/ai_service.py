import os
import json
import re
import requests
from typing import Dict, Any

def get_ai_optimized_schedule(schedule_data: Any, feedbacks: Any) -> Dict:
    api_key = os.getenv("GEMINI_API_KEY", "")
    
    # 1. Tentativo con API Google Gemini (modelli supportati v1beta)
    if api_key and not api_key.startswith("AIzaSyBwdlidfRS1lPRnqjuEm4OVABA9NlSjG-s"):
        models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"]
        for model in models:
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            prompt = f"""
Sei un esperto di logistica e scheduling. Analizza i dati e proponi soluzioni di rischedulazione.
ORARIO ATTUALE: {json.dumps(schedule_data)}
RICHIESTE ASSENTI: {json.dumps(feedbacks)}
COMPITO:
1. Se la preferenza dello studente e' libera nell'orario attuale, proponi lo spostamento.
2. Se la preferenza e' occupata da un altro studente presente nella lista degli assenti, proponi lo scambio (swap).
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
            try:
                res = requests.post(api_url, json=payload, timeout=12)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        clean_text = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                        out_json = json.loads(clean_text)
                        out_json["engine"] = f"Gemini LLM ({model})"
                        return out_json
                else:
                    print(f"Gemini {model} returned status {res.status_code}: {res.text[:150]}")
            except Exception as e:
                print(f"Errore chiamata Gemini {model}: {e}")
                continue

    # 2. Algoritmo di Fallback Euristico Locale (Garantisce che la UI non crashi mai)
    proposte = []
    feedbacks_list = feedbacks if isinstance(feedbacks, list) else []
    schedule_list = schedule_data if isinstance(schedule_data, list) else []

    for fb in feedbacks_list:
        nome = fb.get("studentName") or fb.get("nome") or "Studente"
        pref = str(fb.get("preferenza", "")).strip()
        giorno = str(fb.get("giorno", "")).strip()
        ora_vecchia = str(fb.get("ora", "")).strip()
        status = str(fb.get("status", "")).strip()

        if pref and ("assente" in status.lower() or "richiesta" in status.lower() or "in attesa" in status.lower()):
            occupante = None
            for slot in schedule_list:
                if slot.get("giorno") == giorno and slot.get("ora") == pref:
                    occupante = slot.get("nome")
                    break

            vecchio_lbl = f"{giorno} {ora_vecchia}" if ora_vecchia else giorno
            nuovo_lbl = f"{giorno} {pref}"

            if not occupante:
                proposte.append({
                    "studente": nome,
                    "vecchioOrario": vecchio_lbl,
                    "nuovoOrario": nuovo_lbl,
                    "nota": "Slot preferito libero: spostamento diretto proposto"
                })
            else:
                altro_assente = any(
                    (f.get("studentName") == occupante or f.get("nome") == occupante) and "assente" in str(f.get("status", "")).lower()
                    for f in feedbacks_list
                )
                if altro_assente:
                    proposte.append({
                        "studente": nome,
                        "vecchioOrario": vecchio_lbl,
                        "nuovoOrario": nuovo_lbl,
                        "nota": f"Scambio (swap) proposto con {occupante} (anch'esso assente)"
                    })
                else:
                    proposte.append({
                        "studente": nome,
                        "vecchioOrario": vecchio_lbl,
                        "nuovoOrario": nuovo_lbl,
                        "nota": f"Slot occupato da {occupante}; proposta di verifica disponibilità"
                    })

    return {
        "proposte": proposte,
        "engine": "Algoritmo Euristico (Fallback)"
    }
