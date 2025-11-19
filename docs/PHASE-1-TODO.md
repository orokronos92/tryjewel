# Phase 1 - Todo List (Tracker)

## Status: En Cours
**Date de début:** 17 Novembre 2025
**Objectif:** Completion 100% avec >80% test coverage

---

## Fichiers de configuration

### Config Module
- [x] `src/config/__init__.py` - Module initialization
- [x] `src/config/settings.py` - Flask config (CORS, Redis URL, etc.)
- [x] `src/config/mediapipe_config.py` - MediaPipe parameters constants

### Utils Module
- [x] `src/utils/logger.py` - Loguru configuration with colorization
- [x] `src/utils/__init__.py` - Module initialization
- [x] `src/utils/cache.py` - RedisCache class (get_landmarks, set_landmarks)
- [x] `src/utils/performance.py` - @track_performance decorator
- [x] `src/utils/validators.py` - Pydantic schemas (TrackingRequestSchema, ImageSchema)

### Models Module
- [x] `src/models/__init__.py` - Module initialization
- [x] `src/models/tracking_result.py` - Pydantic models for API responses
- [x] `src/models/finger_selection.py` - Pydantic models finger/hand selection

---

## Fichiers core tracking

### Base Tracker (Section 1.1)
- [x] `src/trackers/__init__.py` - Module initialization
- [x] `src/trackers/base_tracker.py` - BaseTracker ABC class

### Hand Tracker (Section 1.2)
- [x] `src/trackers/hand_tracker.py` - HandTracker implementation
  - MediaPipe Hands initialization
  - _extract_landmarks_3d()
  - _calculate_ring_position() for each finger
  - _calculate_bracelet_position() for wrist
  - Smoothing with moving average (window=5)

### Processor (Section 1.3)
- [x] `src/processors/__init__.py` - Module initialization
- [x] `src/processors/finger_mapper.py` - FingerMapper static class

---

## API Layer (Flask)

### Routes Initialization
- [x] `src/api/routes/__init__.py` - Module initialization

### Health Endpoint (Section 1.4)
- [ ] `src/api/routes/health.py` - GET /health endpoint

### Tracking Endpoint (Section 1.4)
- [ ] `src/api/routes/tracking.py` - POST /api/track endpoint
  - Pydantic validation
  - Image decoding (base64)
  - Route to HandTracker
  - Return jewelry positions

### WebSocket (Section 1.5)
- [ ] `src/api/routes/websocket.py` - SocketIO event handlers
  - connect event
  - track_frame event
  - tracking_results emit
  - tracking_error emit
  - Redis caching (TTL 100ms)

### Flask App
- [ ] `src/api/server.py` - Main Flask app with Blueprints
- [ ] `src/api/wsgi.py` - Gunicorn entry point

---

## Tests

### Unit Tests
- [x] `tests/unit/__init__.py` - Module initialization
- [ ] `tests/unit/test_hand_tracker.py` - Hand tracker unit tests
- [ ] `tests/unit/test_finger_mapper.py` - Finger mapper tests

### Integration Tests
- [x] `tests/integration/__init__.py` - Module initialization
- [ ] `tests/integration/test_api.py` - API endpoint tests
- [ ] `tests/integration/test_websocket.py` - WebSocket tests

---

## Scripts

- [ ] `scripts/benchmark.py` - Performance measurement script
- [ ] `scripts/download_models.py` - Download MediaPipe models

---

## Configuration Files

- [ ] `pytest.ini` - Pytest configuration
- [ ] `.env` - Environment variables (if needed)

---

## Documentation à créer

- [x] `docs/PHASE-1-PLAN.md` - Implementation plan (CREATED)
- [ ] `docs/API-SPECIFICATIONS.md` - API documentation
- [ ] `docs/TRACKER-ARCHITECTURE.md` - Architecture documentation
- [ ] `docs/TESTING-STRATEGY.md` - Test strategy
- [ ] `docs/BENCHMARK-RESULTS.md` - Performance results
- [ ] `docs/PHASE-1-PROGRESS.md` - Progress tracker (update as you go)

---

## Test Coverage Targets

### Target: >80% overall

- [ ] **trackers/hand_tracker.py** - 100% coverage (critical)
- [ ] **processors/finger_mapper.py** - 100% coverage (critical)
- [ ] **api/routes/*.py** - 90% coverage
- [ ] **utils/cache.py** - 90% coverage
- [ ] **utils/performance.py** - 85% coverage
- [ ] **utils/validators.py** - 85% coverage

---

## Definition of Done Checklist

### Functionnal Requirements
- [ ] HandTracker detects hands with >90% precision (measured)
- [ ] Support all fingers: thumb, index, middle, ring, pinky
- [ ] Support bracelet tracking (wrist landmark 0)
- [ ] Finger selection mapping correct for all combinations
- [ ] API `/health` endpoint works
- [ ] API `/api/track` validates and processes correctly
- [ ] WebSocket real-time stable at 10 FPS
- [ ] Redis cache functional (TTL 100ms)
- [ ] Logging operational (Loguru configured)

### Test Requirements
- [ ] Unit tests >80% coverage (measured: `pytest --cov=src`)
- [ ] Integration tests pass (API + WebSocket)
- [ ] All tests pass: `pytest -v` (0 failures)
- [ ] Performance tests: average latency <50ms (measured on 100 frames)

### Quality Requirements
- [ ] Flake8 linting: 0 errors, 0 warnings (`flake8 src/`)
- [ ] Code documentation (docstrings on all public methods)
- [ ] Type hints on all functions
- [ ] Error handling for edge cases
- [ ] Logging for debugging and monitoring

### Documentation Requirements
- [ ] docs/API-SPECIFICATIONS.md completed
- [ ] docs/TRACKER-ARCHITECTURE.md completed
- [ ] docs/TESTING-STRATEGY.md completed
- [ ] docs/BENCHMARK-RESULTS.md with measured numbers
- [ ] Inline comments for complex algorithms

---

## Performance Targets

- [ ] Average latency <50ms per frame
- [ ] P95 latency <60ms
- [ ] P99 latency <80ms
- [ ] Stable WebSocket at 10 FPS
- [ ] Redis cache hit rate >60%
- [ ] Memory usage <500MB for tracking

---

## Commandes de validation

```bash
# Linting
flake8 src/

# Tests
pytest tests/
pytest tests/unit/
pytest tests/integration/

# Coverage
coverage run -m pytest
coverage report --fail-under=80
coverage html  # Generate HTML report

# Benchmarks (when ready)
python scripts/benchmark.py

# Run server (when ready)
python src/api/server.py
# or
python src/api/wsgi.py
```

---

## Progress Tracking

**Date:** 17 Novembre 2025
**Status:** Configuration phase started
**Files created:** 1 / 45+

Tick each task as you complete it. Update this file regularly to track real progress during development.
