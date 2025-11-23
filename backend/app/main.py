"""FastAPI application entry point."""
import logging
from typing import Optional, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Form, Depends
from fastapi.responses import JSONResponse
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
    FinalScoresResponse,
    DimensionResponse,
)
from app.models.db_models import Transcription as TranscriptionModel, Metric as MetricModel, Exercise as ExerciseModel, Session as SessionModel
from app.database import get_db
from app.services.eleven_labs import ElevenLabsService
from app.services.metrics_service import calculate_metrics, get_resources_status
from app.services.transcript_service import (
    calculate_audio_duration,
    get_or_create_exercise,
    filter_metrics_by_stage,
    calculate_dimensions,
    save_transcription_and_metrics,
)
from app.services.scores_service import calculate_final_scores


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

@app.get("/results", response_model=FinalScoresResponse, tags=["results"])
async def get_results(
    session_id: int = Query(..., description="Session ID"),
    db: Session = Depends(get_db),
) -> FinalScoresResponse:
    """Get final scores for a session.
    
    Calculates and returns aggregated final scores across all exercises
    in the session, including dimension scores (clarity, rhythm, vocabulary).
    """
    try:
        final_scores = await calculate_final_scores(db, session_id)
        return final_scores
    except Exception as e:
        logger.error(
            f"Failed to calculate final scores: {str(e)}",
            exc_info=True
        )
        # Return empty final scores response on error
        return FinalScoresResponse(dimensions=[])

@app.post("/transcript", tags=["transcription"])
async def transcript(
    audio: UploadFile = File(...),
    stage_id: int = Form(..., description="Stage ID"),
    exercise_id: int = Form(..., description="Exercise ID"),
    session_id: int = Form(..., description="Session ID"),
    db: Session = Depends(get_db),
) -> Any:
    """Transcribe audio file and save to database.
    
    1. Transcribes audio using ElevenLabs
    2. Calculates speech metrics based on stage_id
    3. Saves transcription and metrics to database
    4. Returns FinalScoresResponse if stage_id == 3, otherwise TranscriptionResponse
    """
    try:
        # Read and transcribe audio
        audio_data = await audio.read()
        service = ElevenLabsService()
        transcription_response = service.transcribe(audio_data)
        
        if not transcription_response.text:
            raise HTTPException(
                status_code=400,
                detail="Transcription returned empty text"
            )
        
        # Calculate audio duration and word count
        audio_s, n_words = calculate_audio_duration(
            transcription_response,
            audio_data,
            None
        )
        
        # Get or create exercise
        exercise = get_or_create_exercise(db, stage_id, exercise_id)
        
        # Determine reference transcription for stage_id == 1
        reference_transcription = (
            exercise.exercise_content if stage_id == 1 else None
        )
        
        # Calculate metrics
        metrics_response = None
        metrics_dict: dict[str, MetricScore] = {}
        
        if audio_s:
            try:
                audio_ms = int(audio_s * 1000)
                raw_counts = {"num_words": n_words}
                
                # Calculate all available metrics
                metrics_result = await calculate_metrics(
                    audio_ms=audio_ms,
                    transcription=transcription_response.text,
                    reference_transcription=reference_transcription,
                    raw_counts=raw_counts,
                )
                
                # Convert to MetricScore objects
                all_metrics = {
                    name: MetricScore(raw=val["raw"], score=val["score"])
                    for name, val in metrics_result["metrics"].items()
                }
                
                # Filter metrics based on stage_id
                metrics_dict = filter_metrics_by_stage(all_metrics, stage_id)
                
                # Calculate dimensions
                dimensions = calculate_dimensions(metrics_dict, stage_id)
                
                metrics_response = MetricsResponse(
                    metrics=metrics_dict,
                    dimensions=dimensions,
                )
            except Exception as e:
                logger.error(
                    f"Metrics calculation failed: {str(e)}",
                    exc_info=True
                )
        
        # Save to database
        try:
            save_transcription_and_metrics(
                db=db,
                stage_id=stage_id,
                exercise_id=exercise_id,
                session_id=session_id,
                transcription_text=transcription_response.text,
                audio_s=audio_s,
                metrics_dict=metrics_dict,
            )
            
        
        except Exception as db_error:
            db.rollback()
            logger.error(
                f"✗ Database save failed: {str(db_error)}",
                exc_info=True
            )
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save to database: {str(db_error)}"
            )
        
        # For stage_id != 3, return normal transcription response
        return TranscriptionResponse(
            text=transcription_response.text,
            audio_s=audio_s,
            n_words=n_words,
            metrics=metrics_response,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Transcription failed: {str(e)}",
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}"
        )
