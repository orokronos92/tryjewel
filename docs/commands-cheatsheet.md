# Commands Reference - Bijoux AI

## Frontend Commands

```bash
cd tryjewel

# Development
npm run dev                    # Start dev server (localhost:3000)
npm run build                  # Build for production
npm start                      # Start production server
npm run lint                   # Run ESLint

# Add shadcn/ui components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add select
npx shadcn-ui@latest add radio-group
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add skeleton
n```

## Backend Commands

```bash
cd python-api

# Virtual environment
python3.11 -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run server
python src/api/server.py

# Linting
flake8 src/
black src/
```

## Mobile Testing with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Expose frontend (in tryjewel/)
ngrok http 3000

# Expose backend (in separate terminal, python-api/)
ngrok http 5000

# Use the generated URLs on mobile devices
# Frontend: https://xxx.ngrok.io
# Backend: https://yyy.ngrok.io
```

## Testing

```bash
# Frontend tests (when added)
npm test

# Backend tests
pytest
pytest --cov=src

# Performance test
# Run manual FPS/latency checks in browser console
```
