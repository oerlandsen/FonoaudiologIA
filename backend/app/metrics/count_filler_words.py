import json
import os
from typing import List
import re 

_TOKENIZER_PATTERN = re.compile(r"[^\w']+", flags=re.UNICODE)

def _tokenize(text: str) -> List[str]:
     if not text:
         return []
     text = text.lower()
     text = _TOKENIZER_PATTERN.sub(" ", text)
     return text.split()


def _load_filler_words(filler_words_path: str) -> List[str]:
    """
    Load filler words from a JSON file.

    Accepted formats:
      1) {"filler_words": ["uh", "um", ...]}
      2) ["uh", "um", ...]  (top-level list)
    """
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

    # Normalize and filter out empty strings
    return [w.strip().lower() for w in filler_list if isinstance(w, str) and w.strip()]


def count_filler_words_from_file(
    transcription: str,
    filler_words_path: str = "filler_words.json"
) -> int:
    """
    Count the number of filler words in a transcription, based on filler_words.json.

    Parameters
    ----------
    transcription : str
        Full text transcription of the audio.
    filler_words_path : str, optional
        Path to filler_words.json. Default is "filler_words.json" in the current directory.

    Returns
    -------
    int
        Total number of tokens in the transcription that match any filler word.

    Notes
    -----
    - Matching is case-insensitive.
    - Filler words are expected to be *single tokens* (e.g., "uh", "um", "like").
    """
    if not transcription:
        return 0

    filler_words = set(_load_filler_words(filler_words_path))
    tokens = _tokenize(transcription)

    count = sum(1 for tok in tokens if tok.lower() in filler_words)
    return count

if __name__ == "__main__":
    # Simple smoke test for count_filler_words_from_file

    example_transcription = """
    Bueno, emm, yo creo que, ahh deberiamos, mmmm, empezar ahora.
    """

    filler_words_path = "filler_words.json"  # adjust if it's in another folder

    try:
        num_fillers = count_filler_words_from_file(
            transcription=example_transcription,
            filler_words_path=filler_words_path,
        )
        print("Example transcription:")
        print(example_transcription.strip())
        print("\nFiller words file:", filler_words_path)
        print("Total filler words found:", num_fillers)
    except FileNotFoundError as e:
        print("ERROR:", e)
    except Exception as e:
        print("Unexpected error while counting filler words:", e)

