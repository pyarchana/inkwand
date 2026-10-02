"""Thin async wrapper around the google-genai SDK for calling Gemma."""

import logging
import os

from google import genai
from google.genai import errors, types

log = logging.getLogger("inkwand.llm")

DEFAULT_MODEL = "gemma-4-26b-a4b-it"
TIMEOUT_MS = 180_000
# Gemma 4 always thinks before answering, and thinking counts against this
# limit, so it has to be generous or the answer gets cut off.
DEFAULT_MAX_TOKENS = 8192


class LLMError(Exception):
    """An error with a message that is safe to show to the user."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise LLMError(
                "Live writing is not set up yet: GEMINI_API_KEY is missing on the server.",
                status_code=503,
            )
        _client = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(timeout=TIMEOUT_MS)
        )
    return _client


def model_id() -> str:
    return os.getenv("GEMMA_MODEL") or DEFAULT_MODEL


async def generate(
    prompt: str, *, temperature: float = 0.6, max_tokens: int = DEFAULT_MAX_TOKENS
) -> str:
    client = _get_client()
    try:
        response = await client.aio.models.generate_content(
            model=model_id(),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=temperature, max_output_tokens=max_tokens
            ),
        )
    except errors.APIError as e:
        log.warning("Gemini API error %s: %s", e.code, e)
        if e.code == 429:
            raise LLMError(
                "Too many requests on the free tier right now. "
                "Please wait a minute and try again.",
                status_code=429,
            ) from e
        if e.code in (401, 403):
            raise LLMError("The API key looks invalid.", status_code=503) from e
        if e.code == 404:
            raise LLMError(
                f"The model '{model_id()}' was not found. Check GEMMA_MODEL.", status_code=503
            ) from e
        if e.code == 504:
            raise LLMError(
                "The model took too long to answer. Please try again.", status_code=504
            ) from e
        raise LLMError("The model is having a bad moment. Please try again shortly.") from e
    except Exception as e:  # network errors, timeouts
        log.warning("LLM call failed: %r", e)
        raise LLMError("Could not reach the model. Check your connection and try again.") from e

    text = (response.text or "").strip()
    if not text:
        finish = response.candidates[0].finish_reason if response.candidates else None
        log.warning("Empty reply from model (finish_reason=%s)", finish)
        raise LLMError("The model thought too long and ran out of room. Please try again.")
    return text
