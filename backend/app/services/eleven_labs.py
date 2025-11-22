"""ElevenLabs service layer for transcription."""
from elevenlabs.client import ElevenLabs
import os


class ElevenLabsService:
    """ElevenLabs service class."""

    def __init__(self):
        self.elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

    def transcribe(self, audio_data: bytes):
        """Transcribe audio using ElevenLabs speech-to-text."""
        return self.elevenlabs.speech_to_text.convert(
            file=audio_data,
            model_id="scribe_v1",
            tag_audio_events=True,
            language_code="spa",
            diarize=True,
        )
