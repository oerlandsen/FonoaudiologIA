# Code Improvements Plan

This document outlines all identified improvements for the FonoaudiologIA backend codebase, organized by priority and category.

## High Priority Fixes

### 1. Critical Bugs
- [ ] **Fix typo in endpoint**: Change `/excercise` to `/exercise` in `backend/app/main.py` (line 110)
- [ ] **Add environment variable validation**: Validate required API keys (`ELEVENLABS_API_KEY`, `OPENAI_API_KEY`) at startup in `backend/app/main.py`
- [ ] **Fix unused parameter**: Remove or use `n_words` parameter in `calculate_audio_duration()` in `backend/app/services/transcript_service.py`

### 2. Security Improvements
- [ ] **Add file upload validation**: Implement file size limits, type validation, and malicious file detection in `/transcript` endpoint (`backend/app/main.py`)
- [ ] **Restrict CORS origins**: Change default CORS configuration from `["*"]` to specific origins in production (`backend/app/config/settings.py`)
- [ ] **Add API key validation**: Check that API keys exist before service initialization in `backend/app/services/eleven_labs.py` and `backend/app/services/open_ai.py`

### 3. Code Quality
- [ ] **Extract tokenization logic**: Create shared utility module for tokenization used in:
  - `backend/app/metrics/scores.py` (lines 72-86)
  - `backend/app/metrics/count_filler_words.py` (lines 6-13)
  - `backend/app/services/metrics_service.py` (lines 92-99)
- [ ] **Fix logger configuration**: Remove redundant logger setup in `backend/app/metrics/scores.py` (lines 143-160) and use dependency injection or shared logger factory
- [ ] **Standardize error handling**: Create consistent error handling patterns across all endpoints in `backend/app/main.py`

## Medium Priority Improvements

### 4. Architecture & Design
- [ ] **Refactor large files**: Split `backend/app/metrics/scores.py` (511 lines) into:
  - Normalization functions module
  - Metric implementations module
  - Main orchestration module
- [ ] **Extract business logic**: Move business logic from `backend/app/main.py` endpoints to service layers
- [ ] **Implement dependency injection**: Replace direct service instantiation with DI container for better testability
- [ ] **Centralize path configuration**: Create configuration module for file paths instead of duplicating path resolution logic

### 5. Database Improvements
- [ ] **Add database migrations**: Implement Alembic for schema versioning instead of `create_tables()`
- [ ] **Add missing indexes**: Create composite indexes on:
  - `Metric(session_id, name)` in `backend/app/models/db_models.py`
  - `Transcription(session_id, stage_id)` in `backend/app/models/db_models.py`
- [ ] **Add foreign key relationship**: Add relationship between `Metric` and `Transcription` models
- [ ] **Fix exercise ID calculation**: Improve logic in `backend/seed.py` to prevent conflicts if stages have >99 exercises

### 6. Error Handling & Resilience
- [ ] **Add transaction management**: Implement proper transaction handling in `/transcript` endpoint to prevent data loss
- [ ] **Improve error messages**: Standardize error response format across all endpoints
- [ ] **Add fallback feedback**: Replace empty string return with meaningful fallback in `backend/app/services/feedback_service.py` (line 139)
- [ ] **Handle resource loading failures**: Improve error handling in `backend/app/services/metrics_service.py` for resource loading failures

### 7. Performance Optimizations
- [ ] **Optimize database queries**: Add pagination or filtering to `calculate_final_scores()` in `backend/app/services/scores_service.py`
- [ ] **Replace random() query**: Use more efficient method for random exercise selection in `/excercise` endpoint
- [ ] **Add caching layer**: Implement caching for:
  - Exercise lookups
  - Parameters/filler words (with refresh mechanism)
- [ ] **Add thread safety**: Add locks for concurrent access to global `_NLP_ES` in `backend/app/metrics/scores.py`

## Low Priority Enhancements

### 8. Testing & Documentation
- [ ] **Add comprehensive tests**: Create test suite for:
  - Metrics calculation (`backend/app/metrics/scores.py`)
  - Database operations
  - Error cases and edge cases
  - Service layer functions
- [ ] **Add API documentation**: Create comprehensive API documentation beyond FastAPI auto-docs
- [ ] **Add README**: Create backend setup/usage guide
- [ ] **Add docstrings**: Complete missing docstrings in modules
- [ ] **Add type checking**: Set up mypy or similar for type validation

### 9. Code Organization
- [ ] **Organize imports**: Standardize import ordering across all files
- [ ] **Add `__all__` exports**: Define public API in modules using `__all__`
- [ ] **Standardize naming**: Consistent use of Spanish/English and underscore prefixes
- [ ] **Extract constants**: Move magic numbers to configuration:
  - Feedback timeout (3.0s) in `backend/app/services/feedback_service.py`
  - Max tokens (80) in `backend/app/services/open_ai.py`
  - WPM estimate (2.5) in `backend/app/services/transcript_service.py`

### 10. Configuration & Environment
- [ ] **Create `.env.example`**: Add example environment file with all required variables
- [ ] **Add settings validation**: Validate database URL format, port range, CORS origins in `backend/app/config/settings.py`
- [ ] **Standardize path handling**: Create consistent path resolution for different deployment environments

### 11. Specific Code Refactoring
- [ ] **Reduce debug logging**: Adjust log levels in `backend/app/metrics/scores.py` (lines 327-330)
- [ ] **Extract prompt building**: Refactor repetitive prompt building in `backend/app/services/feedback_service.py` (lines 41-109)
- [ ] **Simplify dimension calculation**: Extract complex logic in `backend/app/services/scores_service.py` (lines 75-115) to separate functions
- [ ] **Remove unused tuple element**: Clean up `dimension_data` tuple in `backend/app/services/scores_service.py` (4th element always None)
- [ ] **Fix hardcoded paths**: Remove hardcoded paths in `__main__` blocks (e.g., `backend/app/metrics/scores.py` line 468)

## Implementation Notes

### Suggested File Structure
```
backend/
├── app/
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── tokenization.py  # Shared tokenization logic
│   │   └── constants.py     # Magic numbers and constants
│   ├── config/
│   │   └── paths.py         # Centralized path configuration
│   └── metrics/
│       ├── normalization.py
│       ├── implementations.py
│       └── orchestrator.py
```

### Testing Strategy
- Unit tests for utility functions
- Integration tests for API endpoints
- Mock external services (ElevenLabs, OpenAI)
- Test edge cases (empty inputs, invalid data, etc.)

### Migration Strategy
1. Start with high-priority fixes (bugs, security)
2. Add tests for critical paths
3. Refactor incrementally with tests
4. Add documentation as you go

## Estimated Effort

- **High Priority**: 2-3 days
- **Medium Priority**: 1-2 weeks
- **Low Priority**: 2-3 weeks

Total estimated effort: 3-5 weeks (depending on team size and priorities)



