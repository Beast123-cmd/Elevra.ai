"""One place that talks to Gemini, so every feature fails the same way: LlmUnavailable.

Callers must always have a non-AI fallback. Thinking is switched off on purpose: these are short structured
tasks, and with thinking on the hidden reasoning tokens can use up the whole output budget and return nothing.
"""
from __future__ import annotations

import json
import logging

from common import settings

log = logging.getLogger("elevra.llm")


class LlmUnavailable(Exception):
    """Gemini is not configured, timed out, errored, or returned something unusable."""


_client = None


def _get_client():
    global _client
    if not settings.GEMINI_API_KEY:
        raise LlmUnavailable("GEMINI_API_KEY is not set")
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def generate_json(prompt: str, *, max_tokens: int = 700, temperature: float = 0.2, timeout_s: float = 20.0) -> dict:
    """Ask Gemini for a JSON object. Raises LlmUnavailable for every kind of failure."""
    try:
        from google.genai import types

        response = _get_client().models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=temperature,
                max_output_tokens=max_tokens,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                http_options=types.HttpOptions(timeout=int(timeout_s * 1000)),
            ),
        )
    except LlmUnavailable:
        raise
    except Exception as exc:  # network, quota, bad key, timeout ...
        log.warning("Gemini request failed: %s", type(exc).__name__)
        raise LlmUnavailable(f"Gemini request failed ({type(exc).__name__})") from exc
    text = (response.text or "").strip()
    if not text:
        raise LlmUnavailable("Gemini returned no text")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise LlmUnavailable("Gemini returned invalid JSON") from exc
    if not isinstance(data, dict):
        raise LlmUnavailable("Gemini returned an unexpected JSON shape")
    return data
