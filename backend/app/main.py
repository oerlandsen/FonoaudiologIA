"""FastAPI application entry point."""
import io
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.config.settings import settings
from app.models.schemas import (
    HealthResponse,
    TranscriptionResponse,
    MetricsResponse,
    MetricScore,
    DimensionScores,
    SessionResponse,
    ExerciseResponse,
)
from app.models.db_models import Transcription as TranscriptionModel, Metric as MetricModel, Exercise as ExerciseModel, Session as SessionModel
from app.database import get_db
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


@app.post("/start", response_model=SessionResponse, tags=["sessions"])
async def create_session(db: Session = Depends(get_db)) -> SessionResponse:
    """Create a new session and return the session_id."""
    try:
        new_session = SessionModel()
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return SessionResponse(session_id=new_session.id)
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")
    
@app.get("/excercise", response_model=ExerciseResponse, tags=["excercises"])
async def get_exercise(
    stage_id: int = Query(..., description="Stage ID"), 
    db: Session = Depends(get_db)) -> ExerciseResponse:
    """Get a random exercise for a given stage_id."""
    try:
        exercise = db.query(ExerciseModel).filter(
            ExerciseModel.stage_id == stage_id
        ).order_by(func.random()).first()
        
        if not exercise:
            raise HTTPException(
                status_code=404, 
                detail=f"No exercises found for stage_id={stage_id}"
            )
        
        return ExerciseResponse(
            id=exercise.id,
            stage_id=exercise.stage_id,
            exercise_id=exercise.exercise_id,
            exercise_content=exercise.exercise_content,
            created_at=exercise.created_at,
            updated_at=exercise.updated_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get exercise: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get exercise: {str(e)}") 

@app.post("/transcript", response_model=TranscriptionResponse, tags=["transcription"])
async def transcript(
    audio: UploadFile = File(...),
    stage_id: int = Form(..., description="Stage ID"),
    exercise_id: int = Form(..., description="Exercise ID"),
    session_id: int = Form(..., description="Session ID"),
    db: Session = Depends(get_db),
) -> TranscriptionResponse:
    """Transcribe audio file and save to database.
    
    1. Transcribes audio using ElevenLabs
    2. Calculates speech metrics (if requested)
    3. Saves transcription and metrics to database
    """
    try:
        # Read audio file as bytes
        audio_data = await audio.read()
        
        # Initialize service and transcribe
        service = ElevenLabsService()
        transcription_response = service.transcribe(audio_data)
        
        # Calculate audio duration and word count
        audio_s = None
        n_words = None
        
        # Try to get audio duration from words timing if available
        if hasattr(transcription_response, 'words') and transcription_response.words:
            words_list = transcription_response.words
            if words_list:
                audio_s = words_list[-1].end - words_list[0].start
        
        # Calculate word count
        if hasattr(transcription_response, 'text') and transcription_response.text:
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
        
        # Get exercise from database (needed for reference_transcription and validation)
        exercise = db.query(ExerciseModel).filter(ExerciseModel.exercise_id == exercise_id).first()
        if not exercise:
            exercise = ExerciseModel(
                stage_id=stage_id,
                exercise_id=exercise_id,
                exercise_content=f"Auto-created exercise {exercise_id}",
            )
            db.add(exercise)
            db.flush()
        
        # Determine reference_transcription based on stage_id
        # stage_id = 1 uses exercise_content as reference for precision calculation
        reference_transcription = None
        if stage_id == 1:
            reference_transcription = exercise.exercise_content
        
        # Calculate metrics based on stage_id
        metrics_response = None
        metrics_dict = {}
        if transcription_response.text:
            try:
                # Convert audio_s to milliseconds
                audio_ms = int(audio_s * 1000) if audio_s else None
                
                if audio_ms:
                    raw_counts = {"num_words": n_words}
                    
                    # Calculate all available metrics
                    metrics_result = await calculate_metrics(
                        audio_ms=audio_ms,
                        transcription=transcription_response.text,
                        reference_transcription=reference_transcription,
                        raw_counts=raw_counts,
                    )
                    
                    # Filter metrics based on stage_id
                    all_metrics = {
                        name: MetricScore(raw=val["raw"], score=val["score"])
                        for name, val in metrics_result["metrics"].items()
                    }
                    
                    # stage_id = 1: precision_transcription, words_per_minute, filler_word_per_minute
                    # stage_id = 2 or 3: words_per_minute, filler_word_per_minute, lexical_variability
                    if stage_id == 1:
                        metrics_dict = {
                            k: v for k, v in all_metrics.items()
                            if k in ["precision_transcription", "words_per_minute", "filler_word_per_minute"]
                        }
                    else:  # stage_id == 2 or 3
                        metrics_dict = {
                            k: v for k, v in all_metrics.items()
                            if k in ["words_per_minute", "filler_word_per_minute", "lexical_variability"]
                        }
                    
                    # Recalculate dimensions based on filtered metrics
                    dimensions_dict = metrics_result.get("dimensions", {})
                    
                    # For stage_id = 1: clarity uses precision, rhythm uses WPM + FPM
                    # For stage_id = 2 or 3: rhythm uses WPM + FPM, vocabulary uses lexical_variability
                    if stage_id == 1:
                        # Calculate clarity from precision if available
                        clarity = None
                        if "precision_transcription" in metrics_dict:
                            clarity = metrics_dict["precision_transcription"].score
                        
                        # Calculate rhythm from WPM and FPM
                        rhythm_scores = [
                            metrics_dict[k].score for k in ["words_per_minute", "filler_word_per_minute"]
                            if k in metrics_dict
                        ]
                        rhythm = sum(rhythm_scores) / len(rhythm_scores) if rhythm_scores else None
                        
                        dimensions = DimensionScores(
                            clarity=clarity,
                            rhythm=rhythm,
                            vocabulary=None,
                        )
                    else:  # stage_id == 2 or 3
                        # Calculate rhythm from WPM and FPM
                        rhythm_scores = [
                            metrics_dict[k].score for k in ["words_per_minute", "filler_word_per_minute"]
                            if k in metrics_dict
                        ]
                        rhythm = sum(rhythm_scores) / len(rhythm_scores) if rhythm_scores else None
                        
                        # Calculate vocabulary from lexical_variability
                        vocabulary = None
                        if "lexical_variability" in metrics_dict:
                            vocabulary = metrics_dict["lexical_variability"].score
                        
                        dimensions = DimensionScores(
                            clarity=None,
                            rhythm=rhythm,
                            vocabulary=vocabulary,
                        )
                    
                    metrics_response = MetricsResponse(
                        metrics=metrics_dict,
                        dimensions=dimensions,
                    )
            except Exception as e:
                logger.error(f"Metrics calculation failed: {str(e)}", exc_info=True)
        
        # Save to database
        try:
            
            # Save transcription
            db_transcription = TranscriptionModel(
                stage_id=stage_id,
                transcription=transcription_response.text,
                length=audio_s if audio_s else 0.0,
                exercise_id=exercise_id,
                session_id=session_id,
            )
            db.add(db_transcription)
            db.flush()
            
            # Save metrics
            for metric_name, metric_score in metrics_dict.items():
                db_metric = MetricModel(
                    stage_id=stage_id,
                    name=metric_name,
                    value=metric_score.raw,
                    score=metric_score.score,
                    session_id=session_id,
                )
                db.add(db_metric)
            
            db.commit()
            logger.info(f"✓ Saved transcription and {len(metrics_dict)} metrics for session_id={session_id}")
        except Exception as db_error:
            db.rollback()
            logger.error(f"✗ Database save failed: {str(db_error)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Failed to save to database: {str(db_error)}")
        
        return TranscriptionResponse(
            text=transcription_response.text,
            audio_s=audio_s,
            n_words=n_words,
            metrics=metrics_response,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
