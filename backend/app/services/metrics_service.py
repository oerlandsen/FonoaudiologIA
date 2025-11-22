"""Metrics service layer with pre-loaded resources for fast processing."""
import asyncio
import json
import os
import re
from typing import Dict, Any, Optional, Set, List
import spacy
from app.metrics.scores import measure_speech_metrics

# Module-level cache (persists across requests on EC2)
_nlp: Optional[Any] = None
_parameters: Optional[Dict[str, Any]] = None
_filler_words: Optional[Set[str]] = None


def _load_parameters(parameters_path: str) -> Dict[str, Any]:
    """Load parameters.json configuration."""
    if not os.path.exists(parameters_path):
        raise FileNotFoundError(f"parameters.json not found at: {parameters_path}")

    with open(parameters_path, "r", encoding="utf-8") as f:
        params = json.load(f)

    if not isinstance(params, dict):
        raise ValueError("parameters.json must contain a JSON object at the top level.")

    return params


def _load_filler_words_set(filler_words_path: str) -> Set[str]:
    """Load filler_words.json and return as a set for fast lookups."""
    if not os.path.exists(filler_words_path):
        raise FileNotFoundError(f"filler_words.json not found at: {filler_words_path}")

    with open(filler_words_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict):
        filler_list = data.get("filler_words", [])
    elif isinstance(data, list):
        filler_list = data
    else:
        raise ValueError(
            "filler_words.json must be either a list of strings or "
            'an object with key "filler_words".'
        )

    # Normalize and convert to set for O(1) lookups
    return {w.strip().lower() for w in filler_list if isinstance(w, str) and w.strip()}


def _load_resources():
    """Load all resources once at module import."""
    global _nlp, _parameters, _filler_words

    try:
        if _nlp is None:
            print("Loading spaCy Spanish model...")
            _nlp = spacy.load("es_core_news_sm")
            print("spaCy model loaded successfully")
    except Exception as e:
        print(f"Warning: Failed to load spaCy model: {e}")
        print("Model will be loaded on first use. Run: python -m spacy download es_core_news_sm")

    try:
        if _parameters is None:
            # Get path relative to metrics directory
            metrics_dir = os.path.join(os.path.dirname(__file__), "..", "metrics")
            parameters_path = os.path.join(metrics_dir, "parameters.json")
            _parameters = _load_parameters(parameters_path)
            print("Parameters loaded successfully")
    except Exception as e:
        print(f"Warning: Failed to load parameters: {e}")

    try:
        if _filler_words is None:
            # Get path relative to metrics directory
            metrics_dir = os.path.join(os.path.dirname(__file__), "..", "metrics")
            filler_words_path = os.path.join(metrics_dir, "filler_words.json")
            _filler_words = _load_filler_words_set(filler_words_path)
            print(f"Filler words loaded successfully ({len(_filler_words)} words)")
    except Exception as e:
        print(f"Warning: Failed to load filler words: {e}")


def _count_filler_words_cached(transcription: str, filler_words_set: Set[str]) -> int:
    """Count filler words using cached set."""
    if not transcription:
        return 0

    # Simple tokenizer (same as in count_filler_words.py)
    tokenizer_pattern = re.compile(r"[^\w']+", flags=re.UNICODE)

    def tokenize(text: str) -> List[str]:
        if not text:
            return []
        text = text.lower()
        text = tokenizer_pattern.sub(" ", text)
        return text.split()

    tokens = tokenize(transcription)
    return sum(1 for tok in tokens if tok.lower() in filler_words_set)


def _compute_metrics_sync(
    audio_ms: int,
    transcription: Optional[str] = None,
    reference_transcription: Optional[str] = None,
    summary: Optional[str] = None,
    raw_counts: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Synchronous wrapper for measure_speech_metrics using cached resources."""
    # Use cached resources
    nlp = _nlp
    parameters = _parameters
    filler_words_set = _filler_words

    # Only require parameters and filler_words - spaCy is optional (needed only for lexical_variability)
    if parameters is None or filler_words_set is None:
        raise RuntimeError("Required resources not loaded. Call _load_resources() first.")
    
    # Warn if spaCy is not available (needed for lexical_variability metric)
    if nlp is None:
        print("Warning: spaCy model not loaded. Lexical variability metric will be skipped.")

    # Prepare raw_counts with pre-computed filler words if needed
    computed_counts = raw_counts.copy() if raw_counts else {}
    
    if transcription and "num_filler_words" not in computed_counts:
        computed_counts["num_filler_words"] = _count_filler_words_cached(
            transcription, filler_words_set
        )

    # Get paths for fallback (though we're using cached versions)
    metrics_dir = os.path.join(os.path.dirname(__file__), "..", "metrics")
    parameters_path = os.path.join(metrics_dir, "parameters.json")
    filler_words_path = os.path.join(metrics_dir, "filler_words.json")

    # Call with cached resources
    result = measure_speech_metrics(
        audio_ms=audio_ms,
        transcription=transcription,
        reference_transcription=reference_transcription,
        summary=summary,
        raw_counts=computed_counts,
        parameters_path=parameters_path,
        filler_words_path=filler_words_path,
        _cached_nlp=nlp,
        _cached_parameters=parameters,
        _cached_filler_words=filler_words_set,
    )

    return result


async def calculate_metrics(
    audio_ms: int,
    transcription: Optional[str] = None,
    reference_transcription: Optional[str] = None,
    summary: Optional[str] = None,
    raw_counts: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Async wrapper for metrics calculation.
    
    Runs CPU-bound work in thread pool to avoid blocking event loop.
    
    Args:
        audio_ms: Audio duration in milliseconds
        transcription: Transcribed text
        reference_transcription: Reference/golden transcription (optional)
        summary: Summary text (optional, fallback for lexical analysis)
        raw_counts: Pre-computed counts (optional)
    
    Returns:
        Dict with metrics, dimensions, and metadata
    """
    # Ensure required resources are loaded (try again if they failed on import)
    # Note: spaCy is optional - only needed for lexical_variability metric
    if _parameters is None or _filler_words is None:
        try:
            _load_resources()
        except Exception as e:
            raise RuntimeError(
                f"Failed to load required metrics resources: {e}. "
                "Ensure parameters.json and filler_words.json are available."
            )
    
    # Try to load spaCy if not already loaded (optional)
    if _nlp is None:
        try:
            _load_resources()  # This will try to load spaCy again
        except Exception:
            # spaCy loading failed, but that's OK - we can still calculate other metrics
            pass

    # Run CPU-bound work in thread pool
    return await asyncio.to_thread(
        _compute_metrics_sync,
        audio_ms,
        transcription,
        reference_transcription,
        summary,
        raw_counts,
    )


def get_resources_status() -> Dict[str, bool]:
    """Check if all resources are loaded."""
    return {
        "spacy_model": _nlp is not None,
        "parameters": _parameters is not None,
        "filler_words": _filler_words is not None,
    }

