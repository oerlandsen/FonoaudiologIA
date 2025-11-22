# Models and Datasets Reference for Backend Implementation

This document provides information about models and datasets that can be used for speech transcription and pronunciation analysis in the backend.

## Speech Transcription Models

### 1. OpenAI Whisper
- **Type**: Open-source, multilingual speech recognition
- **Features**: 
  - Transcribes speech in multiple languages (including Spanish and English)
  - Handles various accents and background noise
  - Can translate non-English speech to English
- **Access**: 
  - API: https://platform.openai.com/docs/guides/speech-to-text
  - Open-source model: https://github.com/openai/whisper
- **Best for**: High-quality transcription with good accuracy

### 2. Google Speech-to-Text API
- **Type**: Cloud-based speech recognition service
- **Features**:
  - Supports 125+ languages including Spanish and English
  - Real-time and batch transcription
  - Custom models for domain-specific vocabulary
- **Access**: https://cloud.google.com/speech-to-text
- **Best for**: Production-ready API with good language support

### 3. Mozilla DeepSpeech
- **Type**: Open-source speech recognition engine
- **Features**:
  - Can be run locally (privacy-friendly)
  - Supports multiple languages
- **Access**: https://github.com/mozilla/DeepSpeech
- **Best for**: On-premise solutions requiring privacy

## Pronunciation Analysis Models

### 1. SoundChoice (G2P Model)
- **Type**: Grapheme-to-Phoneme model
- **Features**:
  - Processes entire sentences
  - Semantic disambiguation
  - Uses BERT embeddings
- **Paper**: https://arxiv.org/abs/2207.13703
- **Best for**: Pronunciation accuracy assessment

### 2. Wav2Vec 2.0
- **Type**: Self-supervised speech representation learning
- **Features**:
  - Can be fine-tuned for pronunciation tasks
  - Works well with limited labeled data
- **Access**: https://github.com/facebookresearch/fairseq/tree/main/examples/wav2vec
- **Best for**: Custom pronunciation analysis models

### 3. Praat (Software Tool)
- **Type**: Phonetic analysis software
- **Features**:
  - Formant analysis
  - Pitch extraction
  - Spectrogram visualization
  - Can be automated via scripting
- **Access**: https://www.fon.hum.uva.nl/praat/
- **Best for**: Detailed phonetic analysis

## Datasets

### 1. Mozilla Common Voice
- **Description**: Crowdsourced multilingual speech dataset
- **Languages**: Spanish, English, and 100+ other languages
- **Size**: Millions of recorded hours
- **License**: CC0 (Public Domain)
- **Access**: https://commonvoice.mozilla.org/
- **Use case**: Training and evaluating speech recognition models

### 2. TIMIT Acoustic-Phonetic Continuous Speech Corpus
- **Description**: 6,300 sentences from 630 American English speakers
- **Features**: 
  - Phonetic and orthographic transcriptions
  - Detailed phonetic annotations
- **License**: Commercial license required
- **Access**: https://catalog.ldc.upenn.edu/LDC93S1
- **Use case**: Pronunciation pattern analysis for English

### 3. Accented English Pronunciation Evaluation Corpus
- **Description**: Word-level pronunciation evaluations from 22 speakers
- **Features**: 
  - Evaluated by linguists
  - Word-by-word pronunciation assessment
- **Access**: https://dataoceanai.com/datasets/asr/accented-english-pronunciation-evaluation-corpus-word-level/
- **Use case**: Pronunciation accuracy evaluation

### 4. US English Pronunciation+POS Lexicon
- **Description**: 150,000 entries with pronunciation transcriptions
- **Features**:
  - CMU ARPABET phonemic system
  - Part-of-speech annotations
- **Access**: https://dataoceanai.com/datasets/lexicon/us-english-pronunciationpos-lexicon/
- **Use case**: Pronunciation reference dictionary

### 5. Pronunciation Lexicon of Loan Words (US English)
- **Description**: 190,328 entries with pronunciation transcriptions
- **Features**: EDINBURGH phonemic system
- **Access**: https://dataoceanai.com/datasets/lexicon/pronunciation-lexicon-of-loan-words-of-us-english/
- **Use case**: Handling loan words and foreign pronunciations

## Recommended Implementation Approach

### For Transcription:
1. **Start with**: OpenAI Whisper API (easiest to integrate, high quality)
2. **Alternative**: Google Speech-to-Text API (if you need more customization)
3. **Privacy-focused**: Mozilla DeepSpeech (if running locally is required)

### For Pronunciation Analysis:
1. **Start with**: Custom model using Common Voice dataset + Wav2Vec 2.0
2. **Reference**: Use pronunciation lexicons for expected pronunciations
3. **Detailed analysis**: Integrate Praat for phonetic features

### Dataset Strategy:
1. **Training**: Use Mozilla Common Voice (Spanish + English)
2. **Evaluation**: Use TIMIT corpus for English (if available)
3. **Reference**: Use pronunciation lexicons for ground truth

## API Integration Notes

The frontend is already prepared to send audio data in the following format:
- `FormData` with audio blob
- Language parameter (`es` or `en`)
- Timestamp metadata

Backend endpoints expected:
- `POST /api/audio/analyze` - Upload and analyze audio
- `GET /api/audio/:id/analysis` - Get analysis results

Response format should match `AudioUploadResponse` type defined in `src/types/audio.ts`.

