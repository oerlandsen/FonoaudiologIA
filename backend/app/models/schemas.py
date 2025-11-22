"""Pydantic models for request/response validation."""
from pydantic import BaseModel, Field
from typing import List, Optional


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str = Field(..., description="Service status", example="healthy")


class ExampleResponse(BaseModel):
    """Example response model."""

    message: str = Field(..., description="Response message", example="Hello from Marraqueta API")
    item_id: int | None = Field(None, description="Item ID", example=1)


class WordInfo(BaseModel):
    """Word information from transcription."""

    word: str = Field(..., description="The transcribed word")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    type: str = Field(..., description="Word type")


class TranscriptionResponse(BaseModel):
    """Transcription response model."""

    text: str = Field(..., description="Full transcription text")
    words: List[WordInfo] = Field(..., description="List of words with timing information")
    audio_s: Optional[float] = Field(None, description="Audio duration in seconds")
    n_words: Optional[int] = Field(None, description="Number of words")

