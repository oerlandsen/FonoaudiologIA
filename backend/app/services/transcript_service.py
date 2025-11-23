"""Service functions for transcript endpoint."""
import io
import logging
from typing import Optional, Any, Tuple, Dict
from sqlalchemy.orm import Session
from app.models.schemas import MetricScore, DimensionScores
from app.models.db_models import (
    Exercise as ExerciseModel,
    Transcription as TranscriptionModel,
    Metric as MetricModel,
)

logger = logging.getLogger(__name__)


def calculate_audio_duration(
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


def get_or_create_exercise(
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


def filter_metrics_by_stage(
    all_metrics: Dict[str, MetricScore],
    stage_id: int
) -> Dict[str, MetricScore]:
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


def calculate_dimensions(
    metrics_dict: Dict[str, MetricScore],
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


def save_transcription_and_metrics(
    db: Session,
    stage_id: int,
    exercise_id: int,
    session_id: int,
    transcription_text: str,
    audio_s: Optional[float],
    metrics_dict: Dict[str, MetricScore],
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

