from typing import Dict, Any, Optional
import spacy

# Load Spanish model once (you can also inject nlp from outside)
def load_spanish_nlp(model_name: str = "es_core_news_sm"):
    return spacy.load(model_name)


def compute_spanish_lexical_variability(
    text: str,
    nlp=None,
    pos_weights: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Measure lexical variability in Spanish text using:
      - Stopword vs content words
      - POS-based repetition per class
      - Weighted average penalty (content words weighted higher)

    Returns a dict with:
      - distinct_1_all
      - distinct_1_no_stopwords  (Distinct-1 sin stopwords)
      - distinct_1_stopwords_only
      - lexical_variability_score (0–100, higher = more varied)
      - pos_stats: per-POS repetition info
      - token_counts: total/content/stopwords
      - weights_used: final POS weights
    """
    if not text or not text.strip():
        return {
            "distinct_1_all": 0.0,
            "distinct_1_no_stopwords": 0.0,
            "distinct_1_stopwords_only": 0.0,
            "lexical_variability_score": 0.0,
            "pos_stats": {},
            "token_counts": {
                "total_tokens": 0,
                "content_tokens": 0,
                "stopword_tokens": 0,
            },
            "weights_used": pos_weights or {},
        }

    if nlp is None:
        nlp = load_spanish_nlp()

    doc = nlp(text)

    # Keep only alphabetic tokens (no punctuation, numbers, etc.)
    tokens = [t for t in doc if t.is_alpha]
    if not tokens:
        return {
            "distinct_1_all": 0.0,
            "distinct_1_no_stopwords": 0.0,
            "distinct_1_stopwords_only": 0.0,
            "lexical_variability_score": 0.0,
            "pos_stats": {},
            "token_counts": {
                "total_tokens": 0,
                "content_tokens": 0,
                "stopword_tokens": 0,
            },
            "weights_used": pos_weights or {},
        }

    def lemma_lower(tok):
        return (tok.lemma_ or tok.text).lower()

    # ---- Stopwords vs content words ----
    content_tokens = [t for t in tokens if not t.is_stop]
    stopword_tokens = [t for t in tokens if t.is_stop]

    def distinct_ratio(ts):
        if not ts:
            return 0.0
        lemmas = [lemma_lower(t) for t in ts]
        return len(set(lemmas)) / len(lemmas)

    # Distinct-1 metrics
    distinct_1_all = distinct_ratio(tokens)
    distinct_1_no_stop = distinct_ratio(content_tokens)
    distinct_1_stop = distinct_ratio(stopword_tokens)

    # ---- Repetition per POS ----
    pos_stats: Dict[str, Dict[str, Any]] = {}
    for tok in tokens:
        pos = tok.pos_  # e.g. NOUN, VERB, DET, ADP, PRON...
        if pos not in pos_stats:
            pos_stats[pos] = {"count": 0, "lemmas": []}
        pos_stats[pos]["count"] += 1
        pos_stats[pos]["lemmas"].append(lemma_lower(tok))

    for pos, stats in pos_stats.items():
        count = stats["count"]
        lemmas = stats["lemmas"]
        unique_lemmas = len(set(lemmas))
        distinct_pos = unique_lemmas / count if count > 0 else 0.0
        # Repetition penalty: 0 = all unique, 1 = all repeated
        repetition_penalty = 1.0 - distinct_pos

        stats["unique_lemmas"] = unique_lemmas
        stats["distinct_ratio"] = distinct_pos
        stats["repetition_penalty"] = repetition_penalty
        del stats["lemmas"]

    # ---- Weights: content words vs function words ----
    # Suggested defaults (you can tweak):
    default_weights: Dict[str, float] = {
        # Content words (penalize repetition more)
        "NOUN": 1.8,   # sustantivos
        "PROPN": 1.8,  # nombres propios
        "VERB": 1.5,   # verbos
        "AUX": 1.0,    # verbos auxiliares
        "ADJ": 1.4,    # adjetivos
        "ADV": 1.1,    # adverbios de contenido

        # Function words / stopwords (penalize repetition less)
        "DET": 0.2,    # artículos: el, la, los...
        "ADP": 0.2,    # preposiciones: de, en, a...
        "PRON": 0.3,   # pronombres frecuentes
        "CCONJ": 0.2,  # y, o
        "SCONJ": 0.2,  # que, porque
        "PART": 0.2,
        "INTJ": 0.3,
        "NUM": 0.5,
        "SYM": 0.1,
        "PUNCT": 0.0,
        "X": 0.5
    }

    # Allow user to override or add weights
    if pos_weights:
        default_weights.update(pos_weights)

    # ---- Global weighted penalty and final score ----
    total_weight = 0.0
    weighted_penalty_sum = 0.0

    for pos, stats in pos_stats.items():
        w = default_weights.get(pos, 1.0)  # default weight for unknown POS
        total_weight += w
        weighted_penalty_sum += w * stats["repetition_penalty"]
        stats["weight"] = w

    if total_weight > 0:
        global_penalty = weighted_penalty_sum / total_weight
    else:
        global_penalty = 0.0

    # Convert penalty into a 0–100 score (higher = more lexical variability)
    lexical_score = (1.0 - global_penalty) * 100.0
    lexical_score = max(0.0, min(100.0, lexical_score))

    return {
        "distinct_1_all": distinct_1_all,
        "distinct_1_no_stopwords": distinct_1_no_stop,
        "distinct_1_stopwords_only": distinct_1_stop,
        "lexical_variability_score": lexical_score,
        "pos_stats": pos_stats,
        "token_counts": {
            "total_tokens": len(tokens),
            "content_tokens": len(content_tokens),
            "stopword_tokens": len(stopword_tokens),
        },
        "weights_used": default_weights,
    }


if __name__ == "__main__":
    # Small example
    sample_text = (
        "El reembolso de gastos médicos es importante. "
        "Cuando hablamos de reembolso, muchas personas piensan solo en reembolso, "
        "reembolso, reembolso, y se olvidan del acceso oportuno a la salud."
    )

    nlp = load_spanish_nlp()
    result = compute_spanish_lexical_variability(sample_text, nlp=nlp)

    print("Distinct-1 (todos):", result["distinct_1_all"])
    print("Distinct-1 sin stopwords:", result["distinct_1_no_stopwords"])
    print("Score global de variabilidad léxica:", result["lexical_variability_score"])
    print("\nPOS stats (NOUN, DET, etc.):")
    for pos, stats in result["pos_stats"].items():
        print(pos, stats)
