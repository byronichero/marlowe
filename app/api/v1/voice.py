"""Voice API – STT via Whisper (transcribe audio to text)."""

import asyncio
import logging

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.services.whisper_service import transcribe_audio

logger = logging.getLogger(__name__)

router = APIRouter()

# Max size 25 MB (long recording)
MAX_AUDIO_BYTES = 25 * 1024 * 1024


class TranscribeResponse(BaseModel):
    """Response body for POST /transcribe."""

    text: str


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: UploadFile = File(..., description="Audio file (WAV, MP3, WebM, OGG, etc.)"),
    language: str | None = Query(None, description="ISO 639-1 language code (e.g. en); auto-detect if omitted"),
) -> TranscribeResponse:
    """
    Transcribe speech to text using Whisper (faster-whisper).

    Accepts common formats (WAV, MP3, WebM, OGG). For browser MediaRecorder,
    WebM or OGG are typical. Returns plain text.
    """
    if not audio.content_type and not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
    try:
        body = await audio.read()
    except Exception as e:
        logger.warning("Failed to read uploaded audio: %s", e)
        raise HTTPException(status_code=400, detail="Failed to read audio file") from e
    if len(body) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio too large (max {MAX_AUDIO_BYTES // (1024*1024)} MB)",
        )
    if len(body) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    lang = language.strip() if isinstance(language, str) and language.strip() else None
    try:
        text = await asyncio.to_thread(transcribe_audio, body, lang)
    except Exception as e:
        logger.exception("Transcription failed: %s", e)
        raise HTTPException(status_code=500, detail="Transcription failed") from e
    return TranscribeResponse(text=text or "")
