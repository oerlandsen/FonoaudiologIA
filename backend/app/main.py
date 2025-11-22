"""FastAPI application entry point."""
import io
import json
import logging
import os
from typing import Optional, Any, Tuple
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
from app.metrics.scores import normalize_metric


# ===========================
# Helper functions for /transcript
# ===========================

def _calculate_audio_duration(
    transcription_response: Any,
    audio_data: bytes,
    n_words: Optional[int]
) -> Tuple[Optional[float], Optional[int]]:
    """Calculate audio duration and word count from transcription response.
    
    Returns:
        Tuple of (audio_s, n_words)
    """
    audio_s = None
    word_count = n_words
    
    # Try to get audio duration from words timing if available
    if hasattr(transcription_response, 'words') and transcription_response.words:
        words_list = transcription_response.words
        if words_list:
            audio_s = words_list[-1].end - words_list[0].start
    
    # Calculate word count from transcription text
    if hasattr(transcription_response, 'text') and transcription_response.text:
        word_count = len(transcription_response.text.split())
    
    # Try to get audio duration from file metadata if words timing is not available
    if audio_s is None:
        try:
            from mutagen import File as MutagenFile
            audio_file = io.BytesIO(audio_data)
            audio_file.seek(0)
            mutagen_file = MutagenFile(audio_file)
            if (mutagen_file is not None and 
                hasattr(mutagen_file, 'info') and 
                hasattr(mutagen_file.info, 'length')):
                audio_s = mutagen_file.info.length
        except (ImportError, Exception):
            pass
        
        # Fallback: estimate duration from word count (~150 WPM = 2.5 words/second)
        if audio_s is None and word_count and word_count > 0:
            audio_s = word_count / 2.5
    
    return audio_s, word_count


def _get_or_create_exercise(
    db: Session,
    stage_id: int,
    exercise_id: int
) -> ExerciseModel:
    """Get exercise from database or create it if it doesn't exist."""
    exercise = db.query(ExerciseModel).filter(
        ExerciseModel.exercise_id == exercise_id
    ).first()
    
    if not exercise:
        exercise = ExerciseModel(
            stage_id=stage_id,
            exercise_id=exercise_id,
            exercise_content=f"Auto-created exercise {exercise_id}",
        )
        db.add(exercise)
        db.flush()
    
    return exercise


def _filter_metrics_by_stage(
    all_metrics: dict[str, MetricScore],
    stage_id: int
) -> dict[str, MetricScore]:
    """Filter metrics based on stage_id requirements."""
    if stage_id == 1:
        allowed_metrics = [
            "precision_transcription",
            "words_per_minute",
            "filler_word_per_minute"
        ]
    else:  # stage_id == 2 or 3
        allowed_metrics = [
            "words_per_minute",
            "filler_word_per_minute",
            "lexical_variability"
        ]
    
    return {
        k: v for k, v in all_metrics.items()
        if k in allowed_metrics
    }


def _calculate_dimensions(
    metrics_dict: dict[str, MetricScore],
    stage_id: int
) -> DimensionScores:
    """Calculate dimension scores based on stage_id and filtered metrics."""
    # Calculate rhythm from WPM and FPM (common for all stages)
    rhythm_scores = [
        metrics_dict[k].score
        for k in ["words_per_minute", "filler_word_per_minute"]
        if k in metrics_dict
    ]
    rhythm = sum(rhythm_scores) / len(rhythm_scores) if rhythm_scores else None
    
    if stage_id == 1:
        # Stage 1: clarity from precision, rhythm from WPM + FPM
        clarity = (
            metrics_dict["precision_transcription"].score
            if "precision_transcription" in metrics_dict
            else None
        )
        return DimensionScores(
            clarity=clarity,
            rhythm=rhythm,
            vocabulary=None,
        )
    else:  # stage_id == 2 or 3
        # Stage 2/3: rhythm from WPM + FPM, vocabulary from lexical_variability
        vocabulary = (
            metrics_dict["lexical_variability"].score
            if "lexical_variability" in metrics_dict
            else None
        )
        return DimensionScores(
            clarity=None,
            rhythm=rhythm,
            vocabulary=vocabulary,
        )


def _save_transcription_and_metrics(
    db: Session,
    stage_id: int,
    exercise_id: int,
    session_id: int,
    transcription_text: str,
    audio_s: Optional[float],
    metrics_dict: dict[str, MetricScore],
) -> None:
    """Save transcription and metrics to database."""
    # Save transcription
    db_transcription = TranscriptionModel(
        stage_id=stage_id,
        transcription=transcription_text,
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
    logger.info(
        f"✓ Saved transcription and {len(metrics_dict)} metrics "
        f"for session_id={session_id}"
    )


def _calculate_final_scores(
    db: Session,
    session_id: int
) -> FinalScoresResponse:
    """Calculate final scores for stage_id == 3 by aggregating all session metrics."""
    # Try to use cached parameters from metrics_service first (more efficient)
    try:
        from app.services.metrics_service import _parameters
        if _parameters is not None:
            parameters = _parameters
        else:
            raise AttributeError("Parameters not cached")
    except (ImportError, AttributeError):
        # Fallback: load from file using same path resolution as metrics_service
        metrics_dir = os.path.join(os.path.dirname(__file__), "..", "metrics")
        parameters_path = os.path.join(metrics_dir, "parameters.json")
        # Resolve the path to handle .. correctly
        parameters_path = os.path.abspath(parameters_path)
        
        if not os.path.exists(parameters_path):
            raise FileNotFoundError(
                f"parameters.json not found at: {parameters_path}. "
                f"Current working directory: {os.getcwd()}, "
                f"__file__: {__file__}"
            )
        
        with open(parameters_path, "r", encoding="utf-8") as f:
            parameters = json.load(f)
    
    metrics_cfg = parameters.get("metrics", {})
    
    # Query all metrics for the session
    session_metrics = db.query(MetricModel).filter(
        MetricModel.session_id == session_id
    ).all()
    
    # Group metrics by name
    metrics_by_name: dict[str, list[float]] = {}
    for metric in session_metrics:
        if metric.name not in metrics_by_name:
            metrics_by_name[metric.name] = []
        metrics_by_name[metric.name].append(metric.value)
    
    # Normalize metrics and calculate averages
    normalized_scores: dict[str, list[float]] = {}
    for metric_name, raw_values in metrics_by_name.items():
        if metric_name in metrics_cfg:
            cfg = metrics_cfg[metric_name]
            scores = []
            for raw_value in raw_values:
                try:
                    score = normalize_metric(
                        raw_value=raw_value,
                        min_value=cfg["min_value"],
                        max_value=cfg["max_value"],
                        ideal_min=cfg["ideal_min"],
                        ideal_max=cfg["ideal_max"],
                    )
                    scores.append(score)
                except Exception as e:
                    logger.warning(
                        f"Failed to normalize {metric_name} "
                        f"with value {raw_value}: {e}"
                    )
            
            if scores:
                normalized_scores[metric_name] = scores
    
    # Calculate dimension averages
    clarity_scores = normalized_scores.get("precision_transcription", [])
    clarity = (
        sum(clarity_scores) / len(clarity_scores)
        if clarity_scores else None
    )
    
    rhythm_scores = []
    rhythm_scores.extend(normalized_scores.get("words_per_minute", []))
    rhythm_scores.extend(normalized_scores.get("filler_word_per_minute", []))
    rhythm = (
        sum(rhythm_scores) / len(rhythm_scores)
        if rhythm_scores else None
    )
    
    vocabulary_scores = normalized_scores.get("lexical_variability", [])
    vocabulary = (
        sum(vocabulary_scores) / len(vocabulary_scores)
        if vocabulary_scores else None
    )
    
    # Build final scores response
    dimensions_list = []
    if clarity is not None:
        dimensions_list.append(DimensionResponse(
            name="clarity",
            score=round(clarity, 2),
            feedback=""
        ))
    if rhythm is not None:
        dimensions_list.append(DimensionResponse(
            name="rhythm",
            score=round(rhythm, 2),
            feedback=""
        ))
    if vocabulary is not None:
        dimensions_list.append(DimensionResponse(
            name="vocabulary",
            score=round(vocabulary, 2),
            feedback=""
        ))
    
    return FinalScoresResponse(dimensions=dimensions_list)


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
        audio_s, n_words = _calculate_audio_duration(
            transcription_response,
            audio_data,
            None
        )
        
        # Get or create exercise
        exercise = _get_or_create_exercise(db, stage_id, exercise_id)
        
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
                metrics_dict = _filter_metrics_by_stage(all_metrics, stage_id)
                
                # Calculate dimensions
                dimensions = _calculate_dimensions(metrics_dict, stage_id)
                
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
            _save_transcription_and_metrics(
                db=db,
                stage_id=stage_id,
                exercise_id=exercise_id,
                session_id=session_id,
                transcription_text=transcription_response.text,
                audio_s=audio_s,
                metrics_dict=metrics_dict,
            )
            
            # For stage_id == 3, always return final scores
            if stage_id == 3:
                try:
                    final_scores = _calculate_final_scores(db, session_id)
                    return JSONResponse(content=final_scores.model_dump())
                except Exception as e:
                    logger.error(
                        f"Failed to calculate final scores: {str(e)}",
                        exc_info=True
                    )
                    # Return empty final scores response on error
                    return JSONResponse(
                        content=FinalScoresResponse(dimensions=[]).model_dump()
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
