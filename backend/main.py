from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from common import settings
from routers import admin, briefs, chat, faculty, interview, student, tts, whatif

app = FastAPI(title="Elevra.ai API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.ALLOWED_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True}


for module in (whatif, admin, faculty, chat, briefs, student, interview, tts):
    app.include_router(module.router)
