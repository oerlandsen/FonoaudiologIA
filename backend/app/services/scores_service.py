"""Service functions for calculating final scores."""
import asyncio
import json
import logging
import os
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.schemas import MetricScore, FinalScoresResponse, DimensionResponse
from app.models.db_models import Metric as MetricModel
from app.services.feedback_service import generate_dimension_feedback

logger = logging.getLogger(__name__)


async def calculate_final_scores(
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
        # Get the directory of this file, then go up one level to find metrics directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        metrics_dir = os.path.join(current_dir, "..", "metrics")
        parameters_path = os.path.abspath(metrics_dir)
        parameters_path = os.path.join(parameters_path, "parameters.json")
        
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
    
    # Group metrics by name (store both raw values and scores)
    metrics_by_name: Dict[str, List[Tuple[float, float]]] = {}
    for metric in session_metrics:
        if metric.name not in metrics_by_name:
            metrics_by_name[metric.name] = []
        metrics_by_name[metric.name].append((metric.value, metric.score))
    
    # Calculate average raw values and scores for each metric
    metrics_averages: Dict[str, MetricScore] = {}
    for metric_name, value_score_pairs in metrics_by_name.items():
        if metric_name in metrics_cfg:
            raw_values = [pair[0] for pair in value_score_pairs]
            scores = [pair[1] for pair in value_score_pairs]
            
            avg_raw = sum(raw_values) / len(raw_values) if raw_values else 0.0
            avg_score = sum(scores) / len(scores) if scores else 0.0
            
            metrics_averages[metric_name] = MetricScore(
                raw=round(avg_raw, 2),
                score=round(avg_score, 2)
            )
    
    # Calculate dimension averages and collect related metrics
    clarity_scores = [
        metrics_averages["precision_transcription"].score
        for _ in range(len(metrics_by_name.get("precision_transcription", [])))
    ] if "precision_transcription" in metrics_averages else []
    clarity = (
        sum(clarity_scores) / len(clarity_scores)
        if clarity_scores else None
    )
    clarity_metrics = (
        {"precision_transcription": metrics_averages["precision_transcription"]}
        if "precision_transcription" in metrics_averages else None
    )
    
    rhythm_scores = []
    rhythm_metrics_dict = {}
    if "words_per_minute" in metrics_averages:
        wpm_count = len(metrics_by_name.get("words_per_minute", []))
        rhythm_scores.extend([metrics_averages["words_per_minute"].score] * wpm_count)
        rhythm_metrics_dict["words_per_minute"] = metrics_averages["words_per_minute"]
    if "filler_word_per_minute" in metrics_averages:
        fpm_count = len(metrics_by_name.get("filler_word_per_minute", []))
        rhythm_scores.extend([metrics_averages["filler_word_per_minute"].score] * fpm_count)
        rhythm_metrics_dict["filler_word_per_minute"] = metrics_averages["filler_word_per_minute"]
    rhythm = (
        sum(rhythm_scores) / len(rhythm_scores)
        if rhythm_scores else None
    )
    rhythm_metrics = rhythm_metrics_dict if rhythm_metrics_dict else None
    
    vocabulary_scores = [
        metrics_averages["lexical_variability"].score
        for _ in range(len(metrics_by_name.get("lexical_variability", [])))
    ] if "lexical_variability" in metrics_averages else []
    vocabulary = (
        sum(vocabulary_scores) / len(vocabulary_scores)
        if vocabulary_scores else None
    )
    vocabulary_metrics = (
        {"lexical_variability": metrics_averages["lexical_variability"]}
        if "lexical_variability" in metrics_averages else None
    )
    
    # Calculate overall dimension (average of clarity, rhythm, vocabulary)
    dimension_scores_for_overall = []
    if clarity is not None:
        dimension_scores_for_overall.append(clarity)
    if rhythm is not None:
        dimension_scores_for_overall.append(rhythm)
    if vocabulary is not None:
        dimension_scores_for_overall.append(vocabulary)
    
    overall = (
        sum(dimension_scores_for_overall) / len(dimension_scores_for_overall)
        if dimension_scores_for_overall else None
    )
    
    # Build final scores response with feedback (parallel async calls)
    dimensions_list = []
    feedback_tasks = []
    dimension_data = []
    
    # Collect all dimensions that need feedback
    if clarity is not None:
        feedback_tasks.append(generate_dimension_feedback("clarity", clarity, clarity_metrics))
        dimension_data.append(("clarity", clarity, clarity_metrics, None))
    
    if rhythm is not None:
        feedback_tasks.append(generate_dimension_feedback("rhythm", rhythm, rhythm_metrics))
        dimension_data.append(("rhythm", rhythm, rhythm_metrics, None))
    
    if vocabulary is not None:
        feedback_tasks.append(generate_dimension_feedback("vocabulary", vocabulary, vocabulary_metrics))
        dimension_data.append(("vocabulary", vocabulary, vocabulary_metrics, None))
    
    if overall is not None:
        feedback_tasks.append(generate_dimension_feedback("overall", overall, None))
        dimension_data.append(("overall", overall, None, None))
    
    # Execute all feedback calls in parallel
    feedbacks = await asyncio.gather(*feedback_tasks, return_exceptions=True)
    
    # Build dimensions list with feedback
    for i, (name, score_val, metrics_val, _) in enumerate(dimension_data):
        feedback = feedbacks[i] if not isinstance(feedbacks[i], Exception) else ""
        if name == "overall":
            dimensions_list.append(DimensionResponse(
                name=name,
                score=round(score_val, 2),
                feedback=feedback,
                metrics=None
            ))
        else:
            dimensions_list.append(DimensionResponse(
                name=name,
                score=round(score_val, 2),
                feedback=feedback,
                metrics=metrics_val
            ))
    
    return FinalScoresResponse(dimensions=dimensions_list)

