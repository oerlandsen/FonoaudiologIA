"""
measurements.py – Speech Metrics Module

Implements:
- measure_speech_metrics(...) as the main entry point
- Generic normalize_metric(...) for 0–100 scoring
- Metrics:
    * precision_transcription
    * words_per_minute
    * filler_word_per_minute  (filler words per minute)
    * lexical_variability     (based on Distinct-1 sin stopwords)
- Dimension aggregation based on parameters.json
"""

from __future__ import annotations

from typing import Optional, Dict, Any, List
import json
import os
import re
from count_filler_words import count_filler_words_from_file
from lexical_variability import compute_spanish_lexical_variability
import spacy

JsonDict = Dict[str, Any]


# --------------------------
# spaCy Spanish model loader
# --------------------------

def load_spanish_nlp(model_name: str = "es_core_news_sm"):
    """Load the Spanish spaCy model."""
    return spacy.load(model_name)


_NLP_ES = None


def get_spanish_nlp():
    """Lazy global loader for the Spanish model (so we only load it once)."""
    global _NLP_ES
    if _NLP_ES is None:
        _NLP_ES = load_spanish_nlp()
    return _NLP_ES


# =========================
#  Helpers: config & tokens
# =========================

def _load_parameters(parameters_path: str) -> JsonDict:
    """
    Load the parameters JSON configuration.

    Expected keys:
      - "metrics": {metric_name: {min_value, max_value, ideal_min, ideal_max}}
      - "dimensions": {dimension_name: [metric_names]}
    """
    if not os.path.exists(parameters_path):
        raise FileNotFoundError(f"parameters.json not found at: {parameters_path}")

    with open(parameters_path, "r", encoding="utf-8") as f:
        params = json.load(f)

    if not isinstance(params, dict):
        raise ValueError("parameters.json must contain a JSON object at the top level.")

    return params


_TOKENIZER_PATTERN = re.compile(r"[^\w']+", flags=re.UNICODE)


def _tokenize(text: str) -> List[str]:
    """
    Simple tokenizer:
      - Lowercases
      - Replaces non-word chars (except apostrophes) with spaces
      - Splits on whitespace
    """
    if not text:
        return []
    text = text.lower()
    text = _TOKENIZER_PATTERN.sub(" ", text)
    return text.split()


# ==========================
#  Normalization: 0–100
# ==========================

def normalize_metric(
    raw_value: float,
    min_value: float,
    max_value: float,
    ideal_min: float,
    ideal_max: float
) -> float:
    """
    Map raw_value -> [0, 100] using piecewise linear scaling.

    - If raw_value is within [ideal_min, ideal_max], score = 100.
    - If raw_value < ideal_min, score increases linearly from 0 at min_value
      to 100 at ideal_min.
    - If raw_value > ideal_max, score decreases linearly from 100 at ideal_max
      to 0 at max_value.
    - Values outside [min_value, max_value] are clipped before scaling.
    """
    if min_value >= max_value:
        raise ValueError(f"min_value ({min_value}) must be < max_value ({max_value}).")
    if ideal_min > ideal_max:
        raise ValueError(f"ideal_min ({ideal_min}) must be <= ideal_max ({ideal_max}).")

    # Clip raw_value to [min_value, max_value]
    v = max(min_value, min(max_value, raw_value))

    # Inside ideal range
    if ideal_min <= v <= ideal_max:
        return 100.0

    # Below ideal range
    if v < ideal_min:
        if ideal_min == min_value:
            # Degenerate case: ideal_min == min_value, any v < ideal_min can't be improved
            return 0.0
        score = 100.0 * (v - min_value) / (ideal_min - min_value)
    else:
        # Above ideal range
        if max_value == ideal_max:
            # Degenerate case: ideal_max == max_value, any v > ideal_max is worst
            return 0.0
        score = 100.0 * (max_value - v) / (max_value - ideal_max)

    # Ensure we stay within [0, 100] even with floating-point noise
    return max(0.0, min(100.0, score))


# ==========================
#  Metric implementations
# ==========================

def _metric_precision_transcription(
    transcription: str,
    reference_transcription: str
) -> float:
    """
    Compute word-level precision (0–100) between transcription (predicted)
    and reference_transcription (golden).

    Precision = 100 * (correct_tokens / total_pred_tokens)
    where "correct" means token matches at the same position.
    """
    pred_tokens = _tokenize(transcription)
    ref_tokens = _tokenize(reference_transcription)

    total_pred = len(pred_tokens)
    if total_pred == 0:
        return 0.0

    aligned_len = min(total_pred, len(ref_tokens))
    correct = sum(1 for i in range(aligned_len) if pred_tokens[i] == ref_tokens[i])

    return 100.0 * correct / total_pred


def _metric_words_per_minute(audio_ms: int, num_words: int) -> Optional[float]:
    """
    Compute words per minute.

    WPM = num_words / audio_minutes
    """
    if audio_ms <= 0:
        return None

    audio_minutes = audio_ms / (1000.0 * 60.0)
    if audio_minutes <= 0:
        return None

    if num_words is None:
        return None

    return float(num_words) / audio_minutes


def _metric_filler_words_per_minute(audio_ms: int, num_filler_words: int) -> Optional[float]:
    """
    Compute filler words per minute.

    FPM = num_filler_words / audio_minutes
    """
    if audio_ms <= 0:
        return None

    audio_minutes = audio_ms / (1000.0 * 60.0)
    if audio_minutes <= 0:
        return None

    if num_filler_words is None:
        return None

    return float(num_filler_words) / audio_minutes


# ==========================
#  Main entry point
# ==========================

def measure_speech_metrics(
    audio_ms: int,
    transcription: Optional[str] = None,
    reference_transcription: Optional[str] = None,
    summary: Optional[str] = None,
    raw_counts: Optional[Dict[str, Any]] = None,
    parameters_path: str = "parameters.json",
    filler_words_path: str = "filler_words.json",
) -> Dict[str, Any]:
    """
    Compute speech metrics, normalize them to scores in [0, 100],
    and aggregate dimension scores.

    Returns a dict with keys:
      - "metrics": {metric_name: {"raw": float, "score": float}}
      - "dimensions": {dimension_name: float or None}
      - "metadata": {...}
    """
    params = _load_parameters(parameters_path)
    metrics_cfg: JsonDict = params.get("metrics", {})
    dims_cfg: JsonDict = params.get("dimensions", {})

    raw_counts = raw_counts or {}

    metrics: Dict[str, Dict[str, float]] = {}
    metadata: Dict[str, Any] = {
        "audio_ms": audio_ms,
        "num_words": None,
        "num_filler_words": None,
        "filler_words_per_minute": None,
        "used_summary_for_lexical_variability": False,
        "lexical_variability_source": None,
        "skipped_metrics": [],
        "lexical_details": None,  # full output from compute_spanish_lexical_variability
    }

    # ------------------------
    # Prepare basic counts
    # ------------------------
    # num_words: use raw_counts if available, otherwise derive from transcription
    num_words = raw_counts.get("num_words")
    if num_words is None and transcription:
        num_words = len(_tokenize(transcription))
    if isinstance(num_words, (int, float)):
        metadata["num_words"] = int(num_words)

    # filler words: use raw_counts if provided, otherwise compute from transcription
    num_filler_words = raw_counts.get("num_filler_words")
    if num_filler_words is None and transcription:
        try:
            num_filler_words = count_filler_words_from_file(
                transcription=transcription,
                filler_words_path=filler_words_path,
            )
        except FileNotFoundError:
            # If filler_words.json is missing, we just skip this metric later
            num_filler_words = None

    if isinstance(num_filler_words, (int, float)):
        metadata["num_filler_words"] = int(num_filler_words)

    # ------------------------
    # 1) Precision transcription
    # ------------------------
    metric_name = "precision_transcription"
    cfg = metrics_cfg.get(metric_name)
    if cfg and transcription and reference_transcription:
        raw_value = _metric_precision_transcription(transcription, reference_transcription)
        score = normalize_metric(
            raw_value,
            cfg["min_value"],
            cfg["max_value"],
            cfg["ideal_min"],
            cfg["ideal_max"],
        )
        metrics[metric_name] = {
            "raw": round(raw_value, 4),
            "score": round(score, 2),
        }
    else:
        metadata["skipped_metrics"].append(metric_name)

    # ------------------------
    # 2) Words per minute
    # ------------------------
    metric_name = "words_per_minute"
    cfg = metrics_cfg.get(metric_name)
    if cfg and num_words is not None and audio_ms is not None:
        wpm_raw = _metric_words_per_minute(audio_ms, int(num_words))
        if wpm_raw is not None:
            score = normalize_metric(
                wpm_raw,
                cfg["min_value"],
                cfg["max_value"],
                cfg["ideal_min"],
                cfg["ideal_max"],
            )
            metrics[metric_name] = {
                "raw": round(wpm_raw, 4),
                "score": round(score, 2),
            }
        else:
            metadata["skipped_metrics"].append(metric_name)
    else:
        metadata["skipped_metrics"].append(metric_name)

    # ------------------------
    # 3) Filler words per minute
    # ------------------------
    # NOTE: metric name remains "filler_word_per_minute".
    metric_name = "filler_word_per_minute"
    cfg = metrics_cfg.get(metric_name)
    if cfg and num_filler_words is not None and audio_ms is not None:
        fpm_raw = _metric_filler_words_per_minute(audio_ms, int(num_filler_words))
        if fpm_raw is not None:
            metadata["filler_words_per_minute"] = round(fpm_raw, 4)
            score = normalize_metric(
                fpm_raw,
                cfg["min_value"],
                cfg["max_value"],
                cfg["ideal_min"],
                cfg["ideal_max"],
            )
            metrics[metric_name] = {
                "raw": round(fpm_raw, 4),
                "score": round(score, 2),
            }
        else:
            metadata["skipped_metrics"].append(metric_name)
    else:
        metadata["skipped_metrics"].append(metric_name)

    # ------------------------
    # 4) Lexical variability (via lexical_variability.compute_spanish_lexical_variability)
    # ------------------------
    metric_name = "lexical_variability"
    cfg = metrics_cfg.get(metric_name)

    text_for_lex = None
    if transcription:
        text_for_lex = transcription
        metadata["used_summary_for_lexical_variability"] = False
    elif summary:
        text_for_lex = summary
        metadata["used_summary_for_lexical_variability"] = True

    if cfg and text_for_lex:
        nlp = get_spanish_nlp()
        lex_details = compute_spanish_lexical_variability(text_for_lex, nlp=nlp)
        metadata["lexical_details"] = lex_details
        metadata["lexical_variability_source"] = "distinct_1_no_stopwords"

        # Use Distinct-1 sin stopwords as the raw value in [0, 1]
        lex_raw = float(lex_details.get("distinct_1_no_stopwords", 0.0))

        score = normalize_metric(
            lex_raw,
            cfg["min_value"],
            cfg["max_value"],
            cfg["ideal_min"],
            cfg["ideal_max"],
        )
        metrics[metric_name] = {
            "raw": round(lex_raw, 4),
            "score": round(score, 2),
        }
    else:
        metadata["skipped_metrics"].append(metric_name)

    # ------------------------
    # 5) Dimensions
    # ------------------------
    dimensions: Dict[str, Optional[float]] = {}
    for dim_name, metric_names in dims_cfg.items():
        scores = [
            metrics[m]["score"]
            for m in metric_names
            if m in metrics and "score" in metrics[m]
        ]
        if scores:
            dimensions[dim_name] = round(sum(scores) / len(scores), 2)
        else:
            dimensions[dim_name] = None

    return {
        "metrics": metrics,
        "dimensions": dimensions,
        "metadata": metadata,
    }


# ======================================
# CLI example: run the full measurement
# ======================================

if __name__ == "__main__":
    # Example Spanish transcription with fillers and some repetition
    transcription = (
        "Bueno, eh, yo creo que, emm, deberíamos, mmm, empezar ahora con el tema de "
        "los reembolsos. El reembolso de gastos médicos es importante, porque sin "
        "reembolso muchas personas no pueden acceder a la salud. A veces hablamos de "
        "reembolso, reembolso, reembolso, y nos olvidamos de la experiencia del paciente."
    )

    filler_words_path = "filler_words.json"      # ajusta si está en otra carpeta
    parameters_path = "parameters.json"

    # 1. Contar muletillas usando count_filler_words_from_file
    try:
        num_fillers = count_filler_words_from_file(
            transcription=transcription,
            filler_words_path=filler_words_path,
        )
        print(f"[Example] Number of filler words (absolute count): {num_fillers}")
    except FileNotFoundError:
        num_fillers = None
        print(f"[Example] WARNING: {filler_words_path} not found. Skipping filler count.")

    # 2. Medir variabilidad léxica detallada usando compute_spanish_lexical_variability
    nlp = get_spanish_nlp()
    lexical_info = compute_spanish_lexical_variability(transcription, nlp=nlp)
    print(f"  Global lexical variability score (0–100): {lexical_info['lexical_variability_score']:.2f}")

    # 3. Ejecutar el pipeline completo de measure_speech_metrics usando parameters.json
    raw_counts = {
        # let measure_speech_metrics infer num_words from transcription
        "num_filler_words": num_fillers,
    }

    try:
        result = measure_speech_metrics(
            audio_ms=60000,  # 60 segundos de audio
            transcription=transcription,
            reference_transcription=(
                "Bueno, yo creo que deberíamos empezar ahora con el tema "
                "de los reembolsos de gastos médicos."
            ),
            summary="Resumen breve sobre reembolsos y acceso a la salud.",
            raw_counts=raw_counts,
            parameters_path=parameters_path,
            filler_words_path=filler_words_path,
        )

        print("\n[Example] Full metrics output (normalized with parameters.json):")
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"\n[Example] Error while running measure_speech_metrics: {e}")
