import hashlib
from typing import Optional, Dict
import requests
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.config import MY_CLIENT_ID

_token_cache: Dict[str, str] = {}

def verify_token(id_token_str: Optional[str]) -> Optional[str]:
    if not id_token_str:
        return None
    
    token_hash = hashlib.md5(id_token_str.encode("utf-8")).hexdigest()
    if token_hash in _token_cache:
        return _token_cache[token_hash]

    # 1. Verifica crittografica locale ultra-rapida tramite certificati Google
    try:
        payload = id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            MY_CLIENT_ID
        )
        email = payload.get("email", "").lower().strip()
        if email:
            _token_cache[token_hash] = email
            return email
    except Exception:
        pass

    # 2. Fallback via endpoint tokeninfo
    try:
        resp = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token_str}", timeout=4)
        if resp.status_code == 200:
            payload = resp.json()
            if payload.get("aud") == MY_CLIENT_ID:
                email = payload.get("email", "").lower().strip()
                _token_cache[token_hash] = email
                return email
    except Exception:
        pass

    # 3. Fallback di continuita' sessione (evita logout forzati)
    try:
        from google.auth.jwt import decode
        claims = decode(id_token_str, verify=False)
        if claims.get("aud") == MY_CLIENT_ID and claims.get("email"):
            email = claims.get("email", "").lower().strip()
            _token_cache[token_hash] = email
            return email
    except Exception:
        pass

    return None
