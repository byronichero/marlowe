"""Whisper STT service – speech-to-text via faster-whisper."""

import logging
import tempfile
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_whisper_model: Any = None


def _get_whisper_model() -> Any:
    """Lazy-load the faster-whisper model (once per process)."""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel

            device = getattr(settings, "whisper_device", "cpu") or "cpu"
            model_size = getattr(settings, "whisper_model_size", "base") or "base"
            _whisper_model = WhisperModel(model_size, device=device, compute_type="int8")
            logger.info("Whisper model loaded: %s on %s", model_size, device)
        except Exception as e:
            logger.exception("Failed to load Whisper model: %s", e)
            raise
    return _whisper_model


def transcribe_audio(audio_bytes: bytes, language: str | None = None) -> str:
    """
    Transcribe audio bytes to text using faster-whisper.

    Args:
        audio_bytes: Raw audio (WAV, MP3, WebM, etc. – decoded by faster-whisper).
        language: Optional ISO 639-1 language code (e.g. "en"); auto-detect if None.

    Returns:
        Transcribed text, or empty string if no speech detected.

    Raises:
        RuntimeError: If the Whisper model fails to load or transcribe.
    """
    model = _get_whisper_model()
    # faster_whisper accepts file path or file-like; use temp file for reliability
    with tempfile.NamedTemporaryFile(suffix=".audio", delete=True) as f:
        f.write(audio_bytes)
        f.flush()
        path = Path(f.name)
        segments, _ = model.transcribe(
            str(path),
            language=language,
            beam_size=1,
            vad_filter=True,
        )
        parts = [s.text.strip() for s in segments if s.text and s.text.strip()]
    return " ".join(parts).strip() if parts else ""
