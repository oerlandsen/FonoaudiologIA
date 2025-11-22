"""FastAPI application entry point."""
import io
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.models.schemas import (
    HealthResponse,
    TranscriptionResponse,
    WordInfo,
    MetricsResponse,
    MetricScore,
    DimensionScores,
)
from app.services.eleven_labs import ElevenLabsService
from app.services.metrics_service import calculate_metrics, get_resources_status


app = FastAPI(
    title="Marraqueta API",
    description="FastAPI microservice",
    version="1.0.0",
)

logger = logging.getLogger(__name__)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize application resources at startup."""
    # Create database tables if they don't exist
    try:
        from app.database import create_tables
        create_tables()
        print("✓ Database tables initialized")
    except Exception as e:
        logger.error(f"Failed to create database tables: {str(e)}", exc_info=True)
        print(f"⚠ Warning: Failed to create database tables: {e}")
    
    # Load and verify that metrics resources are loaded at startup
    from app.services.metrics_service import _load_resources
    try:
        _load_resources()
        status = get_resources_status()
        if all(status.values()):
            print("✓ All metrics resources loaded successfully")
        else:
            print(f"⚠ Warning: Some resources not loaded: {status}")
    except Exception as e:
        print(f"⚠ Warning: Failed to load some metrics resources: {e}")
        print("Metrics will attempt to load resources on first use.")


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    # Check database connectivity
    try:
        from sqlalchemy import text
        from app.database import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        db_status = "disconnected"
    
    return HealthResponse(status="healthy", database=db_status)


@app.post("/transcript", response_model=TranscriptionResponse, tags=["transcription"])
async def transcript(
    audio: UploadFile = File(...),
    reference_transcription: Optional[str] = Query(None, description="Reference transcription for precision metric"),
    include_metrics: bool = Query(True, description="Include speech metrics in response"),
) -> TranscriptionResponse:
    """Transcribe audio file using ElevenLabs speech-to-text and calculate speech metrics."""
    try:
        # Read audio file as bytes
        audio_data = await audio.read()
        
        # Initialize service and transcribe
        service = ElevenLabsService()
        transcription_response = service.transcribe(audio_data)
        
        # Extract words information
        words = []
        if hasattr(transcription_response, 'words') and transcription_response.words:
            for word_info in transcription_response.words:
                words.append(WordInfo(
                    word=word_info.text,
                    start=word_info.start,
                    end=word_info.end,
                    type=word_info.type,
                ))
        
        # Calculate audio duration and word count
        audio_s = None
        n_words = None
        if words:
            audio_s = words[-1].end - words[0].start
            n_words = len(transcription_response.text.split())
        elif hasattr(transcription_response, 'text') and transcription_response.text:
            n_words = len(transcription_response.text.split())
        
        # Try to get audio duration from file if words timing is not available
        if audio_s is None:
            try:
                from mutagen import File as MutagenFile
                audio_file = io.BytesIO(audio_data)
                audio_file.seek(0)
                mutagen_file = MutagenFile(audio_file)
                if mutagen_file is not None and hasattr(mutagen_file, 'info') and hasattr(mutagen_file.info, 'length'):
                    audio_s = mutagen_file.info.length
            except (ImportError, Exception):
                pass
            
            # Fallback: estimate duration from word count (~150 WPM = 2.5 words/second)
            if audio_s is None and n_words is not None and n_words > 0:
                audio_s = n_words / 2.5
        
        # Calculate metrics if requested
        metrics_response = None
        if include_metrics and transcription_response.text:
            try:
                # Convert audio_s to milliseconds
                audio_ms = int(audio_s * 1000) if audio_s else None
                
                if audio_ms:
                    raw_counts = {"num_words": n_words}
                    
                    metrics_result = await calculate_metrics(
                        audio_ms=audio_ms,
                        transcription=transcription_response.text,
                        reference_transcription=reference_transcription,
                        raw_counts=raw_counts,
                    )
                    
                    metrics_dict = {
                        name: MetricScore(raw=val["raw"], score=val["score"])
                        for name, val in metrics_result["metrics"].items()
                    }
                    
                    dimensions_dict = metrics_result.get("dimensions", {})
                    dimensions = DimensionScores(
                        clarity=dimensions_dict.get("clarity"),
                        rhythm=dimensions_dict.get("rhythm"),
                        vocabulary=dimensions_dict.get("vocabulary"),
                        **{k: v for k, v in dimensions_dict.items() if k not in ["clarity", "rhythm", "vocabulary"]}
                    )
                    
                    metrics_response = MetricsResponse(
                        metrics=metrics_dict,
                        dimensions=dimensions,
                        metadata=metrics_result.get("metadata", {}),
                    )
            except Exception as e:
                logger.error(f"Metrics calculation failed: {str(e)}", exc_info=True)
        
        return TranscriptionResponse(
            text=transcription_response.text,
            words=words,
            audio_s=audio_s,
            n_words=n_words,
            metrics=metrics_response,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
