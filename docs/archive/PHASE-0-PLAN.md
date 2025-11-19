# Phase 0: Setup & Configuration - Implementation Plan

## Overview
**Duration:** 3-5 days (local development, no Git)
**Goal:** Complete development environment setup for Bijoux AI AR application
**Testing:** Will use ngrok for external device testing (mobile)

## Tasks Status

### 1. Repository Structure
- [ ] Create monorepo structure
- [ ] Setup `tryjewel/` as main Next.js app
- [ ] Setup `python-api/` for Flask backend
- [ ] Create `public/assets/` directories for 3D models

### 2. Frontend Setup
- [ ] Configure TypeScript strict mode
- [ ] Install all core dependencies (Zustand, Three.js, Socket.io, etc.)
- [ ] Install dev dependencies (@types/three)
- [ ] Configure ESLint + Prettier
- [ ] Initialize shadcn/ui
- [ ] Setup Tailwind CSS with custom theme (gold palette)

### 3. Backend Setup
- [ ] Create Python virtual environment
- [ ] Install all dependencies (Flask, MediaPipe, OpenCV, etc.)
- [ ] Create requirements.txt
- [ ] Create requirements-dev.txt
- [ ] Setup Flake8 configuration

### 4. Configuration
- [ ] Create .env.local for Next.js
- [ ] Create .env for Python backend
- [ ] Setup Tailwind config with brand colors
- [ ] Configure Next.js with necessary settings

### 5. Documentation
- [ ] Create README.md with setup instructions
- [ ] Create API architecture document
- [ ] Document ngrok setup for mobile testing
- [ ] Create component structure outline

## Definition of Done
- [ ] Frontend builds successfully (`npm run build`)
- [ ] Backend runs without errors (`python server.py`)
- [ ] All dependencies installed and working
- [ ] Test page renders at localhost:3000
- [ ] Documentation complete for local setup

## Notes
- Git/GitHub integration postponed
- Will use ngrok for exposing local dev to mobile devices
- VPS configuration (Phase 7) will come later
- CI/CD will be added when ready for production
