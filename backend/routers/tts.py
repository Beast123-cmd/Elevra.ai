"""Voice for the mock interview, using ElevenLabs.

- POST /tts reads a question aloud. The frontend falls back to the browser's built-in voice on any error.
- POST /stt-token hands the browser a single-use token for ElevenLabs Scribe v2 Realtime speech-to-text, so the
  browser can stream the microphone directly without ever seeing the API key. The frontend falls back to the
  browser's own speech recognition on any error."""
from __future__ import annotations

import logging
import re
from functools import lru_cache

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from common import settings
from common.auth import Caller, require_role
from common.db import db

log = logging.getLogger("tts")
router = APIRouter()

MAX_KEYTERMS = 30          # ElevenLabs accepts more, but a short focused list works best
MAX_KEYTERM_CHARS = 20     # ElevenLabs rejects longer keyterms
_TERM = re.compile(r"(?<![\w.])(?:[A-Z][\w.+#/-]*[\w+#]|[a-z]+\.(?:js|io|py)|[A-Z]\+\+|C#)(?![\w])")
_COMMON = {
    "The", "This", "That", "With", "And", "For", "From", "Using", "Used", "Built", "Developed", "Education", "Projects",
    "Project", "Skills", "Experience", "Internship", "Internships", "Achievements", "Summary", "Student", "Expected",
    "Role", "Tech", "Technologies", "Languages", "Tools", "Facts", "None", "Not", "Name", "Bachelor", "Engineering",
}


class TtsBody(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class SttTokenBody(BaseModel):
    session_id: int | None = None


def keyterms_from(text: str) -> list[str]:
    """Likely technical terms and names from a resume summary, used as recognition hints (e.g. Redis, Socket.IO, C++)."""
    out: list[str] = []
    seen: set[str] = set()
    for m in _TERM.findall(text or ""):
        term = m.strip(".-/")
        if 2 <= len(term) <= MAX_KEYTERM_CHARS and term not in _COMMON and term.lower() not in seen:
            seen.add(term.lower())
            out.append(term)
    return out[:MAX_KEYTERMS]


@lru_cache(maxsize=64)
def _speak(text: str) -> bytes:
    """MP3 bytes for the text. Cached so replaying a question doesn't spend credits again."""
    from elevenlabs.client import ElevenLabs

    client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
    audio = client.text_to_speech.convert(voice_id=settings.ELEVENLABS_VOICE_ID, text=text,
                                          model_id=settings.ELEVENLABS_MODEL, output_format="mp3_44100_128")
    return b"".join(audio)


@router.post("/tts")
def tts(body: TtsBody, caller: Caller = Depends(require_role("student"))):
    if not settings.ELEVENLABS_API_KEY or not settings.ELEVENLABS_VOICE_ID:
        raise HTTPException(503, "Voice is not configured")
    try:
        audio = _speak(body.text.strip())
    except Exception as e:  # noqa: BLE001 - any provider failure: the browser voice takes over
        log.warning("tts failed: %s", e)
        raise HTTPException(503, "Voice is temporarily unavailable") from None
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/stt-token")
def stt_token(body: SttTokenBody, caller: Caller = Depends(require_role("student"))):
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(503, "Live transcription is not configured")
    try:
        r = httpx.post("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
                       headers={"xi-api-key": settings.ELEVENLABS_API_KEY}, timeout=10)
        r.raise_for_status()
        token = r.json()["token"]
    except Exception as e:  # noqa: BLE001 - the browser's own recognition takes over
        log.warning("stt token failed: %s", e)
        raise HTTPException(503, "Live transcription is temporarily unavailable") from None

    keyterms: list[str] = []
    if body.session_id is not None:
        rows = db().table("mock_interviews").select("student_id,transcript").eq("id", body.session_id).limit(1).execute().data
        if rows and rows[0]["student_id"] == caller.student_id and isinstance(rows[0]["transcript"], dict):
            keyterms = keyterms_from(rows[0]["transcript"].get("resume", ""))
    return {"token": token, "keyterms": keyterms}
