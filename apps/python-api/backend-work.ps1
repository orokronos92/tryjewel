# 📦 Démarrage simple du backend Bijoux AI
echo "======================================"
echo "🚀 Démarrage Bijoux AI Backend"
echo "======================================"
echo ""

# 1. Vérifier qu'on est dans python-api
cd C:\AR_jewel\python-api
echo "Répertoire: $PWD"
echo ""

# 2. Activer venv
echo "Activation du venv..."
. \venv\Scripts\Activate.ps1
echo "✓ Venv activé"
echo ""

# 3. Configurer PYTHONPATH
echo "Configuration PYTHONPATH..."
$env:PYTHONPATH = "C:\AR_jewel\python-api\src"
echo "✓ PYTHONPATH = $env:PYTHONPATH"
echo ""

# 4. Lancer le serveur
echo "Démarrage du serveur..."
echo "Port: 5000"
echo "Redis: localhost:6379"
echo ""
echo "Appuyez sur CTRL+C pour arrêter"
echo "======================================"
echo ""

python src\api\server.py
