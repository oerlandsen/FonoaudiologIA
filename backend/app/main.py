"""FastAPI application entry point."""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.models.schemas import HealthResponse, ExampleResponse, TranscriptionResponse, WordInfo
from app.services.eleven_labs import ElevenLabsService


app = FastAPI(
    title="Marraqueta API",
    description="FastAPI microservice",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="healthy")


@app.get("/", response_model=ExampleResponse, tags=["example"])
async def root() -> ExampleResponse:
    """Root endpoint example."""
    return ExampleResponse(message="Hello from Marraqueta API")


@app.post("/transcript", response_model=TranscriptionResponse, tags=["transcription"])
async def transcript(audio: UploadFile = File(...)) -> TranscriptionResponse:
    """Transcribe audio file using ElevenLabs speech-to-text."""
    try:
        # Read audio file as bytes
        audio_data = await audio.read()
        
        # Initialize service and transcribe
        service = ElevenLabsService()
        transcription_response = service.transcribe(audio_data)
        print(transcription_response)
        
        # Extract words information
        words = []
        if hasattr(transcription_response, 'words') and transcription_response.words:
            for word_info in transcription_response.words:
                words.append(WordInfo(
                    word=word_info.text,
                    start=word_info.start,
                    end=word_info.end,
                    type=word_info.type,
                ))
        
        # Calculate audio duration and word count
        audio_s = None
        n_words = None
        if words:
            audio_s = words[-1].end - words[0].start
            n_words = len(transcription_response.text.split())
        
        return TranscriptionResponse(
            text=transcription_response.text,
            words=words,
            audio_s=audio_s,
            n_words=n_words,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
