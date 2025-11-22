
    FROM python:3.11-slim as builder

    WORKDIR /app
    
    # Install system dependencies (optional but good practice for NLP libs)
    RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        && rm -rf /var/lib/apt/lists/*
    
    # Copy requirements and install Python dependencies
    COPY requirements.txt .
    RUN pip install --no-cache-dir --user -r requirements.txt
    
    # ✅ Install spaCy Spanish model in the builder stage
    RUN python -m spacy download es_core_news_sm
    
    # ------ FINAL STAGE ------
    FROM python:3.11-slim
    
    WORKDIR /app
    
    # Copy installed dependencies from builder
    COPY --from=builder /root/.local /root/.local
    
    # ✅ Ensure PATH includes installed binaries
    ENV PATH=/root/.local/bin:$PATH
    
    # ✅ Install spaCy Spanish model in final stage (ensures it's in the right location)
    RUN python -m spacy download es_core_news_sm
    
    # Copy application code
    COPY app ./app
    
    # Expose port
    EXPOSE 8000
    
    # Health check endpoint
    HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
        CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
    
    # Run the FastAPI app
    CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    