# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bijoux AI** - AR Virtual Try-On application for jewelry
- Local development structure with `tryjewel/` as the main app directory
- Stack: Next.js 16 (App Router) + Python (MediaPipe) for AR tracking
- Frontend: 2500+ lines TypeScript, Backend: 2000+ lines Python
- Documentation stored in `docs/` directory
- Test coverage target: >80% for Phase 1, validated for Phase 2

## Directory Structure

```
C:\AR_jewel/
├── .claude/                       # Claude Code configuration
│   ├── agents/                   # Agent definitions
│   ├── skills/                   # Custom skills
│   └── settings.local.json       # Local settings
├── docs/                         # Project documentation
│   ├── bijoux-ai-prd-v2-ultra-optimized.md  # Complete PRD (Section 1.x)
│   ├── PHASE-0-PLAN.md          # Phase 0 implementation plan
│   ├── PHASE-1-PLAN.md          # Phase 1 implementation plan
│   ├── PHASE-1-TODO.md          # Phase 1 todo list
│   ├── PHASE-1-PROGRESS.md      # Phase 1 progress tracker
│   ├── PHASE-2-PLAN.md          # Phase 2 implementation plan
│   ├── PHASE-2-TODO.md          # Phase 2 todo list (UPDATED: COMPLETE)
│   ├── PHASE-2-COMPLETE.md      # Phase 2 final summary (NEW)
│   ├── API-SPECIFICATIONS.md    # API documentation
│   ├── TRACKER-ARCHITECTURE.md  # Architecture documentation
│   ├── TESTING-STRATEGY.md      # Test strategy
│   ├── BENCHMARK-RESULTS.md     # Performance results
│   ├── commands-cheatsheet.md   # Commands reference
│   ├── MIGRATION-PHASE1-2.md    # Migration guide (venv Redis)
│   └── answer.md                # Backend questions answers
├── python-api/                  # Python Flask backend (Phase 1)
│   ├── venv/                    # Python virtual environment (CRITICAL: IN THIS FOLDER)
│   │   ├── Scripts/             # Windows Python scripts
│   │   ├── Lib/                 # Python libraries
│   │   └── pyvenv.cfg           # Virtual env config
│   ├── src/
│   │   ├── api/                 # API routes
│   │   │   ├── __init__.py
│   │   │   ├── server.py
│   │   │   ├── wsgi.py
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── health.py    # GET /health endpoint
│   │   │       ├── tracking.py  # POST /api/track endpoint
│   │   │       └── websocket.py # Socket.IO handlers
│   │   ├── trackers/            # MediaPipe trackers
│   │   │   ├── __init__.py
│   │   │   ├── base_tracker.py  # Abstract base class
│   │   │   └── hand_tracker.py  # Hand tracking implementation (260+ lines)
│   │   ├── processors/          # Data processors
│   │   │   ├── __init__.py
│   │   │   └── finger_mapper.py # Finger landmark mapping
│   │   ├── config/              # Configuration
│   │   │   ├── __init__.py
│   │   │   ├── settings.py      # Flask config (CORS, Redis, env)
│   │   │   └── mediapipe_config.py # MediaPipe parameters
│   │   ├── utils/               # Utilities
│   │   │   ├── __init__.py
│   │   │   ├── logger.py        # Loguru configuration
│   │   │   ├── cache.py         # Redis cache wrapper (100ms TTL)
│   │   │   ├── performance.py   # @track_performance decorator
│   │   │   └── validators.py    # Pydantic schemas
│   │   └── models/              # Data models
│   │       ├── __init__.py
│   │       ├── tracking_result.py # Pydantic models (HandResult, JewelryPosition)
│   │       └── finger_selection.py # Finger selection models
│   ├── tests/                  # Test suite
│   │   ├── __init__.py
│   │   ├── unit/
│   │   │   ├── __init__.py
│   │   │   └── test_hand_tracker.py
│   │   └── integration/        # API/WebSocket tests
│   │       ├── __init__.py
│   │       └── (test files)
│   ├── scripts/               # Utility scripts
│   │   ├── __init__.py
│   │   └── benchmark.py       # Performance benchmarking
│   ├── requirements.txt       # Python dependencies (UPDATED VERSIONS)
│   ├── requirements-dev.txt   # Dev dependencies
│   ├── .flake8               # Python linter config
│   └── start_server.ps1      # PowerShell startup script (NEW)
├── tryjewel/                  # Next.js 16 frontend (Phase 2)
│   ├── app/                   # App Router pages
│   │   ├── gallery/           # Gallery page (NEW)
│   │   │   └── page.tsx       # Gallery interface (236 lines)
│   │   ├── tracking/          # Tracking page (NEW)
│   │   │   └── page.tsx       # Main AR interface (238 lines)
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home/Landing page
│   │   ├── loading.tsx        # Loading component
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   ├── jewelry-selector.tsx  # Jewelry selection grid (NEW)
│   │   ├── camera-feed.tsx       # WebRTC camera (NEW)
│   │   ├── tracking-overlay.tsx  # React Three Fiber 3D (NEW)
│   │   ├── gallery.tsx           # Gallery management (452 lines, NEW)
│   │   └── ui/                   # shadcn/ui components (11 components)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── select.tsx
│   │       ├── radio-group.tsx
│   │       ├── skeleton.tsx
│   │       ├── separator.tsx
│   │       ├── badge.tsx
│   │       ├── sonner.tsx
│   │       ├── scroll-area.tsx   # NEW (installed)
│   │       └── toast.tsx         # NEW (useToast hook)
│   ├── hooks/                 # React hooks
│   │   └── use-tracking.ts    # Complete tracking hooks (524 lines, NEW)
│   ├── stores/                # Zustand state management (NEW)
│   │   ├── jewelry-store.ts   # Jewelry selection store
│   │   ├── tracking-store.ts  # WebSocket tracking store
│   │   ├── camera-store.ts    # WebRTC camera store
│   │   └── gallery-store.ts   # Gallery screenshot store
│   ├── lib/                   # Library functions
│   │   ├── schemas/           # Validation schemas (NEW)
│   │   │   └── tracking.schema.ts
│   │   └── utils.ts           # Utility functions
│   ├── public/                # Static assets
│   ├── package.json           # Dependencies (UPDATED: 19 packages)
│   ├── tailwind.config.ts     # Tailwind configuration
│   ├── .prettierrc            # Prettier config
│   └── next.config.ts         # Next.js config
├── CLAUDE.md              # Claude Code guide (THIS FILE - UPDATED)
├── README.md              # Project README
├── MIGRATION-PHASE1-2.md  # venv/Redis migration guide
└── (git not used)         # Local development only
```

## Commands

### Frontend Development Commands
```bash
cd tryjewel

# Development
npm run dev        # Start dev server on http://localhost:3000 (Turbopack)
npm run build      # Build for production
npm start          # Start production server
npm run lint       # Run ESLint

# Dependencies
npm install <package>              # Install new package
npm install @radix-ui/react-*      # shadcn/ui components
npm list                           # View installed packages
```

### Backend Development Commands
```bash
cd python-api

# Server startup (CRITICAL: Use PowerShell script or PYTHONPATH)
.\start_server.ps1                 # RECOMMENDED: Sets PYTHONPATH automatically
# OR
$env:PYTHONPATH="$PWD/src"; python src/api/server.py  # Manual

# Testing (when implemented)
pytest tests/unit/                 # Unit tests
pytest tests/integration/          # Integration tests
pytest --cov=src                   # Coverage report
flake8 src/                        # Linting

# Dependencies
pip install -r requirements.txt    # Install from requirements
pip install <package>              # Install single package
pip list                           # View installed packages
```

### Development Dependencies (Critical Versions)
**Frontend:**
- Next.js: 16.0.3
- React: 18.3.1 (downgraded from 19 for R3F compatibility)
- TypeScript: ^5
- Tailwind CSS: ^4 with custom gold palette
- React Three Fiber: 8.15.19
- React Three Drei: 9.88.17
- Three.js: 0.181.1
- Zustand: ^5.0.8 (state management, persisted)
- @tanstack/react-query: ^5.90.10 (API calls, caching)
- Socket.IO Client: ^4.8.1 (WebSocket)
- @radix-ui/*: 10 components installed
- lucide-react: ^0.553.0 (650+ icons)
- zod: ^4.1.12 (validation)
- react-hook-form: ^7.66.0 (forms)
- sonner: ^2.0.7 (toasts)
- Total: 19 packages

**Backend:**
- Python: 3.10+
- Flask: 3.0.0
- Redis: 7.2+ (Docker container: bijoux-redis)
- MediaPipe: 0.10.21 (tracking)
- numpy: 1.26.4 (compatibility)
- opencv-python: 4.11.0.86 (image processing)
- Pydantic: 2.5+ (validation)
- Loguru: 0.7.2 (logging)
- python-socketio: 5.11 (WebSocket)
- pytest: ^8.0 (testing)
- flake8: ^7.0 (linting)
- coverage: ^7.0 (coverage)
-
- Total: 15+ packages

## Architecture

### AR Application Flow
1. User selects jewelry type (ring/bracelet/earring/necklace)
2. Chooses placement (hand/finger for rings, left/right ear for earrings)
3. Webcam captures video stream
4. Python backend (MediaPipe) processes frames for landmark detection
5. Three.js renders 3D jewelry models overlayed on video
6. User can capture screenshots saved to local IndexedDB gallery

### Key Components
- **Frontend**: Next.js App Router, Zustand for state, React Three Fiber for 3D
- **Backend**: Python Flask with MediaPipe for computer vision
- **Communication**: WebSocket for real-time tracking
- **Storage**: IndexedDB for local screenshot gallery
- **3D Models**: GLB files with PBR materials

### Performance Optimizations
- Web Workers for image processing
- OffscreenCanvas for Three.js rendering
- Service Worker for offline caching
- Redis caching for tracking results (100ms TTL)

## Documentation Access

All project specifications are in `docs/bijoux-ai-prd-v2-optimized.md`. This includes:
- Complete phase breakdown (0-9)
- Technical architecture
- API specifications
- UI/UX requirements
- Definition of Done for each phase

When working on features, always refer to the PRD for detailed implementation guidance.

## Development Workflow

1. **Phase 0 COMPLETED** - Setup complet (Next.js 16 + React 18 + Python backend structure)
2. **Phase 1 COMPLETED** - Backend Python Flask avec API REST + WebSocket
3. **Phase 2 COMPLETED** - Frontend Next.js avec stores, hooks, components (2500+ lignes)
4. Suivre les dépendances de phase comme indiqué dans le PRD
5. Tests frontend/backend/maintenant possible
6. Backend et frontend peuvent être développés en paralléle initialement
7. Coverage cible: Tests backend >80%, frontend fonctionnel
8. Performance cible: Latence <50ms, 60 FPS rendering

## Phase 0 Completion Checklist

✅ **Frontend**
- Next.js 16.0.3 + React 18.3.1 (downgraded for compatibility)
- TypeScript configuré
- Tailwind CSS 4 avec thème personnalisé (couleurs gold)
- shadcn/ui installé (8 composants)
- React Three Fiber 8.15 + Drei 9.88 + Three.js 0.181
- ESLint + Prettier configurés
- Zustand, React Hook Form, Socket.IO installés

✅ **Backend**
- Structure Python créée (api/, trackers/, processors/, models/, utils/, config/)
- requirements.txt + requirements-dev.txt créés
- .flake8 configuré
- Virtual environment existant à racine (CRITICAL: a été déplacé dans python-api/venv/)
- Fichier start_server.ps1 créé pour gestion PYTHONPATH

✅ **Documentation**
- CLAUDE.md mis à jour avec structure complète
- README.md créé avec commandes et setup
- PHASE-0-PLAN.md dans docs/
- commands-cheatsheet.md dans docs/

✅ **Tools**
- Git non utilisé (développement local)
- ngrok prêt pour tests mobile
- VPS config reporté à Phase 7

## Claude Code Configuration

This repository uses Claude Code for development. Key settings:
- Allowed commands: `Bash(dir)` for directory access
- Custom agents and skills defined in `.claude/` directory
- Documentation stored in `docs/` for persistence
