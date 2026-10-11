"""Text-to-speech for the mock interview: reads a question aloud with ElevenLabs.
The frontend falls back to the browser's built-in voice whenever this returns an error."""
from __future__ import annotations

import logging
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from common import settings
from common.auth import Caller, require_role

log = logging.getLogger("tts")
router = APIRouter()


class TtsBody(BaseModel):
    text: str = Field(min_length=1, max_length=500)


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
