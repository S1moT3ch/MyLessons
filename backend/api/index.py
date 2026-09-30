import sys
from pathlib import Path

# Aggiunge la root directory al sys.path per importare correttamente il package 'app'
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.legacy_dispatcher import router as legacy_router

app = FastAPI(
    title="MyLessons API",
    version="2.0.0",
    description="Backend Python modulare serverless per MyLessons"
)

# Configurazione CORS aperta per SPA React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrazione router di compatibilità (supporta GET / e POST / con action)
app.include_router(legacy_router)
