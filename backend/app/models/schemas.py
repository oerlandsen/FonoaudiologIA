"""Pydantic models for request/response validation."""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str = Field(..., description="Service status", example="healthy")


class WordInfo(BaseModel):
    """Word information from transcription."""

    word: str = Field(..., description="The transcribed word")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    type: str = Field(..., description="Word type")


class MetricScore(BaseModel):
    """Individual metric score."""

    raw: float = Field(..., description="Raw metric value")
    score: float = Field(..., description="Normalized score (0-100)")


class DimensionScores(BaseModel):
    """Dimension scores aggregated from metrics."""

    clarity: Optional[float] = Field(None, description="Clarity dimension score")
    rhythm: Optional[float] = Field(None, description="Rhythm dimension score")
    vocabulary: Optional[float] = Field(None, description="Vocabulary dimension score")

    class Config:
        """Allow extra fields for dynamic dimensions."""
        extra = "allow"


class MetricsResponse(BaseModel):
    """Speech metrics response model."""

    metrics: Dict[str, MetricScore] = Field(..., description="Individual metric scores")
    dimensions: DimensionScores = Field(..., description="Aggregated dimension scores")
    metadata: Dict = Field(..., description="Additional metadata")


class TranscriptionResponse(BaseModel):
    """Transcription response model."""

    text: str = Field(..., description="Full transcription text")
    words: List[WordInfo] = Field(..., description="List of words with timing information")
    audio_s: Optional[float] = Field(None, description="Audio duration in seconds")
    n_words: Optional[int] = Field(None, description="Number of words")
    metrics: Optional[MetricsResponse] = Field(None, description="Speech metrics (optional)")

