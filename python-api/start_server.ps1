# 📦 Démarrage du serveur Bijoux AI
# Ce script configure le PYTHONPATH et lance le serveur
# IMPORTANT: Exécuter ce script depuis le dossier C:\AR_jewel\python-api

echo "======================================"
echo "🚀 Démarrage Bijoux AI Backend"
echo "======================================"
echo ""

# Déterminer le répertoire du script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = Split-Path -Parent $scriptDir

# 1. Déterminer le répertoire du script et vérifier qu'on est dans python-api
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
cd $scriptDir
echo "[0/4] Répertoire du projet: $pwd"
echo ""

# 2. Vérifier que nous sommes bien dans python-api
if (-not (Test-Path .\venv\Scripts\Activate.ps1)) {
    echo "   ✗ ERREUR: Veuillez exécuter ce script depuis le dossier python-api"
    exit 1
}
echo "   ✓ Position correcte vérifiée"
echo ""

# 3. Activer venv
echo "[1/4] Activation du venv..."
.\venv\Scripts\Activate.ps1
echo "   ✓ Venv activé"
echo ""

# 4. Configurer PYTHONPATH
echo "[2/4] Configuration du PYTHONPATH..."
$env:PYTHONPATH = "$scriptDir\src"
echo "   ✓ PYTHONPATH = $env:PYTHONPATH"
echo ""

# 5. Vérifier que server.py existe
if (-not (Test-Path .\src\api\server.py)) {
    echo "   ✗ ERREUR: server.py non trouvé"
    exit 1
}
echo "   ✓ server.py trouvé"
echo ""

# 6. Lancer le serveur
echo "[3/4] Démarrage du serveur Flask..."
echo ""
echo "======================================"
echo "Serveur en cours d'exécution..."
echo "Appuyez sur CTRL+C pour arrêter"
echo "======================================"
echo ""

.\venv\Scripts\python.exe src\api\server.py
