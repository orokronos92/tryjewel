# Phase 1: Backend Python - Core Tracking Implementation Plan

## Overview
**Duration:** 5-7 days (local development)
**Goal:** Complete MediaPipe tracking backend with Flask API + WebSocket
**Files Created:** 21 Python files + 5 documentation files

## Objectives
- ✅ MediaPipe Hands tracking >90% precision
- ✅ API Flask + WebSocket operational (Port 5000)
- ✅ Latency <50ms per frame
- ✅ Support rings AND bracelets
- ✅ Finger Mapper (finger/hand selection)
- ✅ Redis cache (TTL 100ms)
- ✅ >80% test coverage

---

## Documentation Files (Output)

### Input Files (à consulter)
1. docs/bijoux-ai-prd-v2-ultra-optimized.md (Section 1.x)
2. CLAUDE.md (Structure du projet)
3. commands-cheatsheet.md (Commandes Python)

### Output Files (à créer)
1. docs/PHASE-1-PLAN.md (Ce fichier)
2. docs/API-SPECIFICATIONS.md - Endpoints, formats, WebSocket protocols
3. docs/TRACKER-ARCHITECTURE.md - Class hierarchy et design patterns
4. docs/TESTING-STRATEGY.md - Coverage targets et test cases
5. docs/BENCHMARK-RESULTS.md - Performance tests et latences mesurées

---

## Project Structure

```
python-api/
├── src/
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py           # Flask config (CORS, Redis URL)
│   │   └── mediapipe_config.py   # MediaPipe parameters
│   │
│   ├── models/                   # Pydantic models
│   │   ├── __init__.py
│   │   ├── tracking_result.py    # API response schemas
│   │   └── finger_selection.py   # Finger/hand selection models
│   │
│   ├── trackers/                 # MediaPipe trackers
│   │   ├── __init__.py
│   │   ├── base_tracker.py       # (1.1) ABC abstract class
│   │   └── hand_tracker.py       # (1.2) Hands implementation
│   │
│   ├── processors/               # Processing logic
│   │   ├── __init__.py
│   │   └── finger_mapper.py      # (1.3) Maps finger/hand to landmarks
│   │
│   ├── api/                      # Flask application
│   │   ├── __init__.py
│   │   ├── server.py             # (1.4) Main Flask app
│   │   ├── wsgi.py               # Gunicorn entry point
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── health.py         # (1.4) Health check
│   │       ├── tracking.py       # (1.4) Tracking endpoints
│   │       └── websocket.py      # (1.5) SocketIO handlers
│   │
│   └── utils/                    # Utilities
│       ├── __init__.py
│       ├── logger.py             # Loguru configuration
│       ├── cache.py              # (1.6) Redis wrapper
│       ├── performance.py        # (1.7) Performance decorator
│       └── validators.py         # Pydantic schemas
│
├── tests/
│   ├── __init__.py
│   ├── unit/
│   │   ├── __init__.py
│   │   ├── test_hand_tracker.py  # (1.8) Hand tracker tests
│   │   └── test_finger_mapper.py # Finger mapper tests
│   │
│   └── integration/
│       ├── __init__.py
│       ├── test_api.py           # API endpoint tests
│       └── test_websocket.py     # WebSocket tests
│
├── scripts/
│   ├── benchmark.py              # Performance measurements
│   └── download_models.py        # Download MediaPipe models
│
├── requirements.txt              # Déjà créé (Phase 0)
├── requirements-dev.txt          # Déjà créé (Phase 0)
├── .flake8                       # Déjà créé (Phase 0)
└── pytest.ini                    # Configuration pytest
```

---

## Detailed Implementation Tasks

### Week 1, Days 1-2: Infrastructure & Base Classes

#### Day 1: Configuration & Utilities
- [x] **Config Files**
  - [x] `src/config/__init__.py` (empty)
  - [x] `src/utils/__init__.py` (empty)
  - [x] `src/models/__init__.py` (empty)
  - [x] `src/config/settings.py` - Flask config, CORS, Redis URL
  - [x] `src/config/mediapipe_config.py` - MediaPipe parameters constants

- [x] **Logging Setup**
  - [x] `src/utils/logger.py` - Loguru configuration avec colorisation

- [x] **Redis Cache** (Section 1.6)
  - [x] `src/utils/cache.py` - `RedisCache` class avec `get_landmarks()`, `set_landmarks()`

- [x] **Performance Monitoring** (Section 1.7)
  - [x] `src/utils/performance.py` - `@track_performance` decorator

- [x] **Pydantic Models**
  - [x] `src/utils/validators.py` - `TrackingRequestSchema`, `ImageSchema`
  - [x] `src/models/tracking_result.py` - `TrackingResult`, `HandResult`, `JewelryPosition`
  - [x] `src/models/finger_selection.py` - `Finger`, `Hand`, `FingerSelection`

#### Day 2: Base Architecture
- [x] **Base Tracker** (Section 1.1)
  - [x] `src/trackers/__init__.py`
  - [x] `src/trackers/base_tracker.py` - `BaseTracker` ABC

- [x] **Finger Mapper** (Section 1.3)
  - [x] `src/processors/__init__.py`
  - [x] `src/processors/finger_mapper.py` - `FingerMapper` static methods

---

### Week 1, Days 3-4: Core Tracking Implementation

#### Day 3: Hand Tracker (Section 1.2)
- [x] **Hand Tracker Core**
  - [x] `src/trackers/hand_tracker.py` - `HandTracker` class
  - [x] MediaPipe Hands initialization avec optimisations:
    ```python
    mp.solutions.hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        model_complexity=1,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.7
    )
    ```
  - [x] Méthodes:
    - `_extract_landmarks_3d()` - Extract 3D landmarks
    - `_calculate_ring_position()` - Calculate pour chaque doigt
    - `_calculate_bracelet_position()` - Wrist position
    - Smoothing avec moving average (window=5 frames)

- [ ] **Tests Unit Hand Tracker** (Section 1.8)
  - [ ] Créer `tests/unit/__init__.py`
  - [ ] `tests/unit/test_hand_tracker.py` avec tests >80% coverage
  - Tests categories:
    - Test hand detection >90% precision
    - Test finger selection (5 fingers × 2 hands)
    - Test bracelet tracking
    - Test confidence scores validation

#### Day 4: API Layer (Section 1.4)
- [ ] **API Routes Init**
  - [ ] `src/api/routes/__init__.py`

- [ ] **Health Endpoint**
  - [ ] `src/api/routes/health.py` - `/health` endpoint
  - Return: status, service, version, mediapipe_loaded

- [ ] **Tracking Endpoint**
  - [ ] `src/api/routes/tracking.py` - `/api/track` POST
  - Validation avec Pydantic
  - Image decoding base64
  - Routing vers HandTracker
  - Return jewelry positions

- [ ] **Flask App**
  - [ ] `src/api/server.py` - Blueprint registration, CORS, SocketIO
  - [ ] `src/api/wsgi.py` - Gunicorn entry point

---

### Week 2, Days 5-6: WebSocket & Real-time

#### Day 5: WebSocket Implementation (Section 1.5)
- [ ] **SocketIO Handlers**
  - [ ] `src/api/routes/websocket.py` - SocketIO event handlers
  - Events:
    - `connect` - Client connection
    - `track_frame` - Receive frame, track, emit results
    - `tracking_results` - Send results to client
    - `tracking_error` - Error handling
  - Redis caching avec TTL 100ms

- [ ] **Tests Integration**
  - [ ] Créer `tests/integration/__init__.py`
  - [ ] `tests/integration/test_api.py` - Test HTTP endpoints
  - [ ] `tests/integration/test_websocket.py` - Test WebSocket temps réel

#### Day 6: Advanced Testing & Validation
- [ ] **Finger Mapper Tests**
  - [ ] `tests/unit/test_finger_mapper.py` - Test mapping landmarks
  - Vérifier correct indices pour chaque doigt
  - Test hand selection (left/right)

- [ ] **Performance Testing**
  - [ ] `scripts/benchmark.py` - Mesure latence per frame
  - Tests: 100+ frames, calcul moyenne, p95, p99
  - Target: <50ms moyenne

---

### Week 2, Day 7: Documentation & Polish

#### Day 7: Documentation & Validation
- [ ] **API Documentation**
  - [ ] `docs/API-SPECIFICATIONS.md` - Complete API docs (OpenAPI format)
  - [ ] `docs/TRACKER-ARCHITECTURE.md` - Architecture patterns
  - [ ] `docs/TESTING-STRATEGY.md` - Test coverage details

- [ ] **Performance Documentation**
  - [ ] `docs/BENCHMARK-RESULTS.md` - Record all benchmarks
  - [ ] Document: average latency, p95, p99, FPS

- [ ] **Code Quality**
  - [ ] Run `flake8 src/` - Linting
  - [ ] Run `pytest` - All tests pass
  - [ ] Run `pytest --cov=src --cov-report=html` - Coverage >80%

- [ ] **Utils Scripts**
  - [ ] `scripts/download_models.py` - Download MediaPipe models if needed
  - [ ] Make scripts executable

---

## Test Strategy Details

### Coverage Requirements (>80%)
1. **trackers/hand_tracker.py** - 100% (critical)
2. **processors/finger_mapper.py** - 100% (critical)
3. **api/routes/*.py** - 90%
4. **utils/cache.py** - 90%
5. **utils/performance.py** - 85%

### Test Cases
- **Hand Detection**: 20+ images with hands, valider >90% detection
- **Finger Selection**: 10 combinaisons finger/hand
- **Bracelet Tracking**: Wrist position précision
- **API**: Valider toutes les routes, errors, validation
- **WebSocket**: Test 10 FPS stable, reconnect, errors
- **Redis**: Test cache get/set, TTL expiration
- **Performance**: 100 frames, latence <50ms moyenne

---

## Performance Targets

- **Latency**: <50ms per frame (moyenne)
  - Target: 30-40ms pour model_complexity=1
  - p95: <60ms
  - p99: <80ms

- **FPS**: 10 FPS stable (WebSocket)
  - Frame capture: 100ms interval
  - Processing + network: <50ms

- **Tracking Precision**: >90%
  - Hands détectées correctement
  - Landmarks stables

- **Redis Cache**: TTL 100ms
  - Hit rate: target >60%
  - Memory usage: <100MB

---

## Validation Checklist

### Functionnel
- [ ] HandTracker détecte mains avec >90% précision (mesuré)
- [ ] Tous les doigts supportés (thumb, index, middle, ring, pinky)
- [ ] Bracelet tracking sur wrist (landmark 0)
- [ ] Finger selection mapping correct
- [ ] API `/health` fonctionne
- [ ] API `/api/track` valide et traque
- [ ] WebSocket temps réel stable (10 FPS)
- [ ] Redis cache fonctionne (TTL 100ms)
- [ ] Logging Loguru opérationnel

### Tests
- [ ] Unit tests >80% coverage (commande: `pytest --cov=src`)
- [ ] Integration tests passent (API + WebSocket)
- [ ] All tests pass: `pytest -v` (0 failures)
- [ ] Performance tests: latence <50ms (100 frames)

### Qualité
- [ ] Flake8 linting: 0 errors, 0 warnings (commande: `flake8 src/`)
- [ ] Code documentation (docstrings)
- [ ] Type hints partout
- [ ] Error handling robuste
- [ ] Logging approprié

### Documentation
- [ ] docs/API-SPECIFICATIONS.md complète
- [ ] docs/TRACKER-ARCHITECTURE.md complète
- [ ] docs/TESTING-STRATEGY.md avec coverage details
- [ ] docs/BENCHMARK-RESULTS.md avec chiffres mesurés
- [ ] Inline comments pour algorithmes complexes

---

## Dependencies (déjà installées - Phase 0)
- flask==3.0.0
- flask-cors
- flask-socketio==5.3
- mediapipe==0.10.9
- opencv-python==4.8.1.78
- numpy==1.24.3
- pillow==10.1.0
- redis==5.0.1
- pydantic==2.5.0
- python-dotenv
- loguru
- gunicorn
- eventlet
- pytest (dev)
- pytest-cov (dev)

---

## Commandes de développement

```bash
# Activer venv (déjà existant)
cd C:\AR_jewel\python-api
venv\Scripts\activate  # Windows

# Linter
flake8 src/

# Tests
pytest tests/
pytest tests/unit/
pytest tests/integration/

# Coverage
pytest --cov=src --cov-report=html
# Ouvrir htmlcov/index.html

# Benchmarks (lors de la création)
python scripts/benchmark.py

# Démarrer serveur (après implémentation)
python src/api/server.py
# ou
python src/api/wsgi.py
```

---

## Notes de développement

### Important: Ne pas créer de nouveau venv
- Le venv existe déjà: `C:\AR_jewel\venv`
- Utiliser le venv existant

### MediaPipe Models
- Les models sont automatiquement téléchargés lors du premier usage
- Optionnel: `python scripts/download_models.py` pour pré-charger

### Redis Server
- Redis doit être en cours d'exécution pour les tests
- Commande Windows (si installé): `redis-server`
- Alternative: Mock Redis pour tests unitaires

### Testing MediaPipe
- Utiliser des images test (créer fixtures)
- Mock `mediapipe.solutions.hands.Hands` pour tests rapides
- Tests avec vraies images pour validation manuelle

### Performance Optimization
- `model_complexity=1` pour compromis perf/accuracy
- Smoothing window=5 frames pour stabilité
- Redis cache TTL=100ms pour réduire traitement
- WebSocket 10 FPS (pas 30 FPS) pour réduire charge

---

## Tick de progression

Lors de la création de chaque fichier, marquer [X] dans les sections ci-dessus.
Mettre à jour ce fichier (PHASE-1-PLAN.md) avec le statut réel.

**Date début:** 17 Novembre 2025
**Date fin estimée:** 24 Novembre 2025
**Status:** En cours
