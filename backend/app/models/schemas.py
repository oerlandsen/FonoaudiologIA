"""Pydantic models for request/response validation."""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str = Field(..., description="Service status", example="healthy")
    database: str = Field(..., description="Database connection status", example="connected")


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
    
    class Config:
        """Pydantic config."""
        json_schema_extra = {
            "example": {
                "metrics": {
                    "words_per_minute": {"raw": 84.74, "score": 60.82},
                    "filler_word_per_minute": {"raw": 21.18, "score": 0.0}
                },
                "dimensions": {
                    "clarity": None,
                    "rhythm": 30.41,
                    "vocabulary": 0.0
                }
            }
        }


class TranscriptionResponse(BaseModel):
    """Transcription response model."""

    text: str = Field(..., description="Full transcription text")
    audio_s: Optional[float] = Field(None, description="Audio duration in seconds")
    n_words: Optional[int] = Field(None, description="Number of words")
    metrics: Optional[MetricsResponse] = Field(None, description="Speech metrics (optional)")


# Database Model Schemas

class ExerciseCreate(BaseModel):
    """Exercise creation schema."""
    
    stage_id: int = Field(..., description="Stage ID", example=1)
    exercise_id: int = Field(..., description="Exercise ID", example=101)
    exercise_content: str = Field(..., description="Exercise content (text or image name)", example="Read the following text aloud")


class ExerciseResponse(BaseModel):
    """Exercise response schema."""
    
    id: int = Field(..., description="Exercise database ID")
    stage_id: int = Field(..., description="Stage ID")
    exercise_id: int = Field(..., description="Exercise ID")
    exercise_content: str = Field(..., description="Exercise content")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        """Pydantic config."""
        from_attributes = True


class TranscriptionCreate(BaseModel):
    """Transcription creation schema."""
    
    stage_id: int = Field(..., description="Stage ID", example=1)
    transcription: str = Field(..., description="Transcription text", example="This is a sample transcription")
    length: float = Field(..., description="Audio length in seconds", example=45.5)
    exercise_id: int = Field(..., description="Exercise ID", example=101)
    session_id: int = Field(..., description="Session ID", example=1)


class TranscriptionResponseDB(BaseModel):
    """Transcription database response schema."""
    
    id: int = Field(..., description="Transcription database ID")
    stage_id: int = Field(..., description="Stage ID")
    transcription: str = Field(..., description="Transcription text")
    length: float = Field(..., description="Audio length in seconds")
    exercise_id: int = Field(..., description="Exercise ID")
    session_id: int = Field(..., description="Session ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        """Pydantic config."""
        from_attributes = True


class MetricCreate(BaseModel):
    """Metric creation schema."""
    
    stage_id: int = Field(..., description="Stage ID", example=1)
    name: str = Field(..., description="Metric name", example="filler_words")
    value: float = Field(..., description="Metric raw value", example=5.2)
    score: float = Field(..., ge=0, le=100, description="Metric score as percentage (0-100)", example=85.5)
    session_id: int = Field(..., description="Session ID", example=1)


class MetricResponse(BaseModel):
    """Metric response schema."""
    
    id: int = Field(..., description="Metric database ID")
    stage_id: int = Field(..., description="Stage ID")
    name: str = Field(..., description="Metric name")
    value: float = Field(..., description="Metric raw value")
    score: float = Field(..., description="Metric score as percentage (0-100)")
    session_id: int = Field(..., description="Session ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    
    class Config:
        """Pydantic config."""
        from_attributes = True


class SessionResponse(BaseModel):
    """Session response schema."""
    
    session_id: int = Field(..., description="Session ID")
    
    class Config:
        """Pydantic config."""
        from_attributes = True

