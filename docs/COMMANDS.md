# 📋 Cheatsheet Commandes - Bijoux AI

## 🎯 Commandes Fréquentes

### Démarrage Rapide

```powershell
# Backend
cd apps\python-api
.\venv\Scripts\activate
python src/api/server.py

# Frontend (nouveau terminal)
cd apps\web
npm run dev
```

## 🐍 Backend Python

### Environnement Virtuel

```powershell
# Créer
python -m venv venv

# Activer (Windows)
.\venv\Scripts\activate

# Désactiver
deactivate
```

### Dépendances

```powershell
# Installer
pip install -r requirements.txt

# Ajouter package
pip install nom_package
pip freeze > requirements.txt
```

### Serveur Flask

```powershell
# Développement
python src/api/server.py

# Production (Gunicorn)
gunicorn -c gunicorn_config.py src.api.wsgi:app
```

### Tests

```powershell
# Tous les tests
pytest

# Avec coverage
pytest --cov=src

# Tests spécifiques
pytest tests/unit/test.py
```

## ⚛️ Frontend Next.js

### Développement

```powershell
# Démarrer serveur dev
npm run dev

# Build production
npm run build

# Démarrer production
npm start

# Linter
npm run lint
```

### Dépendances

```powershell
# Installer
npm install

# Ajouter package
npm install nom_package

# Mettre à jour
npm update

# Audit sécurité
npm audit
npm audit fix
```

## 🐳 Redis (Docker)

### Container Management

```powershell
# Démarrer
docker run -d -p 6379:6379 --name bijoux-redis redis:latest

# Arrêter
docker stop bijoux-redis

# Redémarrer
docker restart bijoux-redis

# Logs
docker logs bijoux-redis
```

### Redis CLI

```powershell
# Ping
docker exec -it bijoux-redis redis-cli ping

# Infos
docker exec -it bijoux-redis redis-cli info

# Vider cache
docker exec -it bijoux-redis redis-cli FLUSHALL
```

## 🔧 Git

### Workflow Standard

```powershell
# Status
git status

# Ajouter fichiersgit add .

# Commit
git commit -m "Message descriptif"

# Push
git push
```

## 🛠️ Maintenance

### Nettoyage

```powershell
# Frontend
cd apps\web
Remove-Item node_modules, .next -Recurse -Force
npm install

# Backend
cd apps\python-api
Remove-Item venv -Recurse -Force
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```
