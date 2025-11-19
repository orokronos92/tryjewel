# 📦 Guide d'Installation - Bijoux AI

## Prérequis

- **Windows 10/11** (64-bit)
- **Node.js 20+** ([télécharger](https://nodejs.org/))
- **Python 3.11+** ([télécharger](https://www.python.org/downloads/))
- **Git** ([télécharger](https://git-scm.com/))
- **Docker Desktop** ([télécharger](https://www.docker.com/products/docker-desktop/)) pour Redis

## Installation Étape par Étape

### 1. Cloner le repository

```powershell
git clone https://github.com/orokronos92/tryjewel.git
cd tryjewel
```

### 2. Backend Python

```powershell
cd apps\python-api

# Créer environnement virtuel
python -m venv venv

# Activer (Windows)
.\venv\Scripts\activate

# Installer dépendances
pip install -r requirements.txt

# Copier configuration
copy .env.example .env

# Modifier .env selon vos besoins
notepad .env
```

**Vérification :** Le serveur doit démarrer sans erreurs

```powershell
python src/api/server.py
```

### 3. Frontend Next.js

```powershell
cd ..\web

# Installer dépendances
npm install

# Copier configuration
copy .env.example .env.local

# Modifier .env.local selon vos besoins
notepad .env.local
```

**Vérification :** Le serveur doit démarrer sur http://localhost:3000

```powershell
npm run dev
```

### 4. Redis (Docker)

```powershell
# Démarrer Redis
docker run -d -p 6379:6379 --name bijoux-redis redis:latest

# Tester
docker exec -it bijoux-redis redis-cli ping
# Réponse attendue: PONG
```

## Démarrage

### Backend (Terminal 1)

```powershell
cd apps\python-api
.\venv\Scripts\activate
python src/api/server.py
```

### Frontend (Terminal 2)

```powershell
cd apps\web
npm run dev
```

L'application est accessible à : http://localhost:3000

## Troubleshooting

### Python : "ModuleNotFoundError"
```powershell
pip install -r requirements.txt --force-reinstall
```

### npm : Erreur "gyp ERR!"
```powershell
npm install --global windows-build-tools
```

### Redis : "Could not connect"
```powershell
docker restart bijoux-redis
```

### Frontend : "Module not found"
```powershell
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json
npm install
```
