import os
import json
import re
import requests
from typing import Dict, Any, List

_cached_working_model = None

def _get_available_gemini_models(api_key: str) -> List[str]:
    """Interroga l'API v1beta di Google per scoprire dinamicamente i modelli attivi e supportati."""
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            models_data = res.json().get("models", [])
            active = []
            for m in models_data:
                name = m.get("name", "").replace("models/", "")
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    active.append(name)
            
            # Ordina con priorità per modelli flash (più veloci ed economici)
            active.sort(key=lambda x: (
                0 if "3.8-flash" in x else
                1 if "2.5-flash" in x else
                2 if "flash" in x else
                3 if "pro" in x else 4
            ))
            return active
    except Exception as e:
        print(f"[AI_SERVICE] Impossibile recuperare lista dinamica modelli: {e}")
    return []

def get_ai_optimized_schedule(schedule_data: Any, feedbacks: Any) -> Dict:
    global _cached_working_model
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    
    # 1. Tentativo con API Google Gemini
    if api_key and not api_key.startswith("AIzaSyBwdlidfRS1lPRnqjuEm4OVABA9NlSjG-s") and api_key != "[SENSITIVE]":
        candidate_models = []
        if _cached_working_model:
            candidate_models.append(_cached_working_model)
        
        # Modelli stabili e aggiornati consigliati da Google (Gemini 3.x e 2.5)
        defaults = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest"]
        for m in defaults:
            if m not in candidate_models:
                candidate_models.append(m)

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

        # Prova i candidati iniziali
        for model in list(candidate_models):
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
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
                        _cached_working_model = model
                        return out_json
                elif res.status_code == 404:
                    print(f"[AI_SERVICE] Modello {model} deprecato o non trovato (404). Proseguo con il prossimo.")
                else:
                    print(f"[AI_SERVICE] Gemini {model} ha risposto con codice {res.status_code}: {res.text[:120]}")
            except Exception as e:
                print(f"[AI_SERVICE] Errore chiamata {model}: {e}")

        # Se tutti i candidati predefiniti hanno fallito (es. 404), scopri i modelli attivi da Google
        discovered = _get_available_gemini_models(api_key)
        for model in discovered:
            if model in candidate_models:
                continue
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
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
                        _cached_working_model = model
                        return out_json
            except Exception as e:
                print(f"[AI_SERVICE] Errore con modello scoperto {model}: {e}")

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
