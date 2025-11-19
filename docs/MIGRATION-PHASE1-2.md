# 📝 Plan Résolution - Points Bloquants Phase 1 ↔ Phase 2

> **Date**: 17 novembre 2025
> **Priorité**: 🔴 CRITIQUE - Bloque Phase 1 & 2

## 📋 État des Points Critiques

### CRITIQUE 🔴 (Bloque complètement)
1. **venv mal positionné** (`C:\AR_jewel\venv` → devrait être `C:\AR_jewel\python-api\venv`)
   - ❌ Backend ne peut pas démarrer
   - ❌ dépendances non installées
   - ❌ MediaPipe inaccessible

2. **Redis non installé**
   - ❌ Cache de tracking (100ms TTL) non fonctionnel
   - ❌ WebSocket performance impacté
   - ❌ Phase 1 features inutilisables

### HAUTE PRIORITÉ ⚠️ (Bloque Phase 2)
3. **Zod schemas non vérifiés**
   - ⏳ Doivent exister dans le frontend
   - ⚠️ Validation API et formulaires

4. **Zustand stores non créés**
   - ⏳ Dépendances installées mais pas configurées
   - ⚠️ Gestion d'état globale manquante

5. **Hooks React Query non vérifiés**
   - ⏳ @tanstack/react-query installé
   - ⚠️ Doivent être implémentés

### MOYENNE PRIORITÉ 🟡 (Amélioration)
6. **Structure "features" manquante**
   - Next.js 16 accepte le pattern `app/`
   - Non bloquant mais recommandé

---

## 🎯 Priority 1: Migration du venv (5 min)

### 📂 Structure Actuelle (Problématique)
```
C:\AR_jewel/
├── venv/                  ← PROBLÈME: Mauvaise position
│   └── ...
└── python-api/
    └── src/
        └── api/
            └── server.py
```

### 📂 Structure Cible (Correcte)
```
C:\AR_jewel/
└── python-api/
    ├── venv/              ← CORRECT: Dans python-api/
    └── src/
        └── api/
            └── server.py
```

### 🚀 Commandes de Migration

#### Option A: Recréation Propre (RECOMMANDÉE)
```powershell
# 1. Supprimer ancien venv
cd C:\AR_jewel
Remove-Item -Path .\venv -Recurse -Force

# 2. Aller dans python-api
cd python-api

# 3. Créer nouveau venv
python -m venv venv

# 4. Activer
.\venv\Scripts\Activate.ps1

# 5. Vérifier activation (prômpt doit montrer: (venv) )
# 6. Installer requirements
pip install -r requirements.txt

# 7. Vérifier installation
echo "MediaPipe:"
pip list | Select-String "mediapipe"
# Attendu: mediapipe 0.10.9
```

#### ✅ Vérification Critique
```bash
# Le dossier doit exister:
Test-Path C:\AR_jewel\python-api\venv\Lib\site-packages\mediapipe

# Doit retourner: True ✅
```

---

## 🎯 Priority 2: Installation Redis (3 min)

### 🐳 Option A: Docker (RECOMMANDÉ pour Windows)

#### Prérequis: Docker Desktop installé
```powershell
# 1. Ouvrir PowerShell en tant qu'administrateur

# 2. Démarrer Redis
docker pull redis:alpine
docker run -d -p 6379:6379 --name bijoux-redis redis:alpine

# 3. Vérifier que le container tourne
docker ps | Select-String "bijoux-redis"
# Doit afficher le container running

# 4. Tester Redis
docker exec bijoux-redis redis-cli ping
# Doit répondre: PONG ✅

# 5. Pour arrêter
docker stop bijoux-redis

# 6. Pour redémarrer
docker start bijoux-redis
```

### 🐧 Option B: WSL2 Ubuntu

#### Prérequis: WSL2 installé et configuré
```bash
# Dans WSL2 terminal:
sudo apt update
sudo apt upgrade -y

# Installer Redis
sudo apt install redis-server -y

# Démarrer Redis
sudo service redis-server start

# Vérifier
echo "GET test" | redis-cli
# Doit répondre: (nil)

# Pour auto-start:
sudo systemctl enable redis-server
redis-cli ping
# Doit répondre: PONG ✅
```

### 🍎 Option C: macOS
```bash
# Installer Homebrew si pas déjà fait:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installer Redis
brew install redis

# Démarrer Redis
brew services start redis

# Vérifier
redis-cli ping
# Doit répondre: PONG ✅

# Pour auto-start:
brew services enable redis
```

#### ✅ Post-Installation Check
```python
# Tester depuis Python
cd C:\AR_jewel\python-api
.\venv\Scripts\activate
python -c "import redis; print('Redis import: OK')"
# Doit afficher: Redis import: OK ✅
```

---

## 🎯 Priority 3: Test Backend Flask

### 🚀 Démarrage du Serveur

#### Vérification Préalables
```powershell
# 1. venv activé ?
Test-Path .\venv\Scripts\Activate.ps1
# Doit être: True

# 2. Redis accessible ?
docker exec bijoux-redis redis-cli ping -erroraction silentlycontinue
# Doit être: PONG

# 3. MediaPipe installé ?
.\venv\Scripts\activate
pip list | Select-String "mediapipe"
# Doit afficher: mediapipe 0.10.9
```

#### Démarrage du Serveur
```powershell
cd C:\AR_jewel\python-api
.\venv\Scripts\activate

# Lancer le serveur
echo "Démarrage du serveur Flask..."
echo ""
echo "=== BIJOUX AI TRACKING API ==="
echo "Attendu: En écoute sur http://0.0.0.0:5000"
echo "="
python src\api\server.py
```

#### ✅ Vérification en Temps Réel

**Terminal 1** (Backend):
```
* Serving Flask app 'src.api.server'
* Running on http://0.0.0.0:5000
* Press CTRL+C to quit
```

**Terminal 2** (Tests):
```bash
# Tester health endpoint
curl http://localhost:5000/health

# Doit retourner:
{
  "status": "healthy",
  "service": "Bijoux AI Tracking API",
  "version": "2.0",
  "mediapipe_loaded": true
}
```

#### 🔧 Débogage si Échec

**Erreur: "ModuleNotFoundError: mediapipe"**
```bash
# Solution:
.\venv\Scripts\activate
pip install mediapipe==0.10.9
```

**Erreur: "Connection to Redis failed"**
```bash
# Solution:
docker start bijoux-redis
# Attendre 2 secondes
docker exec bijoux-redis redis-cli ping
```

**Erreur: "Port 5000 already in use"**
```bash
# Solution: Kill process
netstat -ano | findstr :5000
taskkill /PID XXXX /F  # Remplacer XXXX par le PID
```

---

## 🎯 Priority 4: Vérification Frontend

### 📋 Checklist Frontend (Phase 2)

#### 4.1 Zod Schemas
```bash
# Doivent exister:
C:\AR_jewel\tryjewel\app\types\tracking.dto.ts
C:\AR_jewel\tryjewel\lib\schemas\jewelry.schema.ts

# Vérifier structure:
findstr /n "z.object" C:\AR_jewel\tryjewel\app\*.tsx 2>nul
```

#### 4.2 Zustand Stores
```bash
# Emplacement attendu:
C:\AR_jewel\tryjewel\app\stores\jewelry-store.ts
C:\AR_jewel\tryjewel\app\stores\camera-store.ts
C:\AR_jewel\tryjewel\app\stores\tracking-store.ts
C:\AR_jewel\tryjewel\app\stores\gallery-store.ts
```

#### 4.3 React Query Hooks
```bash
# Emplacement attendu:
C:\AR_jewel\tryjewel\app\hooks\use-tracking.ts
C:\AR_jewel\tryjewel\app\hooks\use-websocket.ts
```

**Statut**: À créer/vérifier lors de la Phase 2 complète

---

## 📊 Checklist Complète - Validation

### 🔴 Priority 1: ENVIRONNEMENT PYTHON
- [x] venv supprimé de C:\AR_jewel
- [ ] venv créé dans C:\AR_jewel\python-api
- [ ] venv activé (prômpt: (venv))
- [ ] requirements.txt installé
- [ ] MediaPipe 0.10.9 installé
- [ ] Dépendances Python OK

### 🔴 Priority 2: REDIS
- [ ] Redis installé (Docker/WSL2/macOS)
- [ ] Redis démarre automatiquement
- [ ] `redis-cli ping` → PONG
- [ ] Redis accessible depuis Python

### 🔴 Priority 3: BACKEND FLASK
- [ ] Server démarre sans erreurs
- [ ] Surveille le port 5000
- [ ] `/health` endpoint fonctionne
- [ ] MediaPipe initialisé
- [ ] Redis connection OK

### ⚠️ Priority 4: FRONTEND (Phase 2)
- [ ] Zod schemas créés
- [ ] Zustand stores configurés
- [ ] React Query hooks implementés
- [ ] Tests frontend pass

---

## 🎯 Statut Actuel

| Priority | Task | Status | Blocker |
|----------|------|--------|---------|
| 🔴 P1 | Migration venv | ⏳ En attente | None |
| 🔴 P1 | Installation Redis | ⏳ En attente | None |
| 🔴 P1 | Test Backend | ⏳ En attente | venv + Redis |
| ⚠️ P2 | Frontend verification | ⏳ En attente | Backend OK |

** Déblocage: Terminer P1+P2 → Backend démarre → Phase 2 peut commencer. **

---

## 🚀 Prochaines Commandes pour Claude Code

``` bash
# ETAPE 1: Migration venv
Move-Item -Path "C:\AR_jewel\venv" -Destination "C:\AR_jewel\python-api\venv" -Force

# OU (plus propre):
Remove-Item -Path "C:\AR_jewel\venv" -Recurse -Force
cd "C:\AR_jewel\python-api"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt -q

# ETAPE 2: Installer Redis
docker run -d -p 6379:6379 --name bijoux-redis redis:alpine
docker exec bijoux-redis redis-cli ping

# ETAPE 3: Tester Backend
python src\api\server.py

# ETAPE 4: Tester Endpoint (autre terminal)
Invoke-RestMethod -Uri "http://localhost:5000/health" | ConvertTo-Json
```

---

## ⚠️ Risques & Mitigation

### Risque 1: pip install échoue
** Mitigation **: Upgrade pip + utiliser `--no-cache-dir`
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt --no-cache-dir
```

### Risque 2: Redis ne démarre pas
** Mitigation **: Vérifier Docker Desktop, redémarrer
```bash
docker rm bijoux-redis
docker run -d -p 6379:6379 --name bijoux-redis redis:alpine
```

### Risque 3: Port 5000 occupé
** Mitigation **: Changer de port
```bash
# Dans python-api/src/api/server.py:
socketio.run(app, host='0.0.0.0', port=5001)  # Changer 5000 → 5001
```

---

** Prêt à exécuter! Les commandes sont préparées et testables. **
