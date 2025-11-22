# example.py
import os
from dotenv import load_dotenv
from io import BytesIO
from elevenlabs.client import ElevenLabs
import tkinter as tk
from tkinter import filedialog

load_dotenv()

elevenlabs = ElevenLabs(
  api_key=os.getenv("ELEVENLABS_API_KEY"),
)

# Show file picker dialog and read selected file as bytes
root = tk.Tk()
root.withdraw()  # hide the main window
file_path = filedialog.askopenfilename(
    title="Select an audio file",
    filetypes=[("Audio files", "*.mp3 *.wav *.m4a *.flac"), ("All files", "*.*")]
)
if not file_path:
    raise SystemExit("No file selected")

with open(file_path, "rb") as f:
    audio_data = BytesIO(f.read())

# audio_data = BytesIO(audio_input)

transcription_response = elevenlabs.speech_to_text.convert(
    file=audio_data,
    model_id="scribe_v1",
    tag_audio_events=True,
    language_code="spa",
    diarize=True,
)

transcription = {
    "text": transcription_response.text,
}
words = []
for word_info in transcription_response.words:
    words.append({
        "word": word_info.text,
        "start": word_info.start,
        "end": word_info.end,
        "type": word_info.type,
    })
transcription["words"] = words

#print(transcription.text)

def precision(transcription, original_text):
    ref_words = original_text.split()
    hyp_words = transcription["text"].split()
    
    # Setup matrix
    m, n = len(ref_words), len(hyp_words)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    # Compute edit distance at word level
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if ref_words[i - 1] == hyp_words[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,       # deletion
                dp[i][j - 1] + 1,       # insertion
                dp[i - 1][j - 1] + cost # substitution
            )

    wer = dp[m][n] / max(1, m)
    match = max(0.0, (1 - wer) * 100)
    return match

def palabras_por_min(transcription):
    words_count =len(transcription["text"].split())
    start_time = transcription["words"][0]["start"]
    end_time = transcription["words"][-1]["end"]
    duration_minutes = (end_time - start_time) / 60
    wpm = words_count / duration_minutes
    return wpm

def muletillas(transcription):
    pass

def variedad_palabras(transcription):
    pass


# original_text = """Hola, este es un texto de ejemplo para probar la precisión de la transcripción."""
# precision_score = precision(transcription, original_text)
# wpm = palabras_por_min(transcription) 

print(f"Resultados de la transcripción: {transcription['text']}")
print(f"Detalles de la transcripción: {transcription}")
# print(f"Precisión: {precision_score:.2f}%")
# print(f"Palabras por minuto: {wpm:.2f}")