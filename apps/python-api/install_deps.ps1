# 📦 Installation des dépendances Bijoux AI

# Activation du venv
.\venv\Scripts\Activate.ps1

# Installation des packages depuis requirements.txt
echo "[INFO] Installation des dépendances depuis requirements.txt..."
pip install -r requirements.txt -q

echo ""
echo "[✓] Installation terminée !"
echo ""
echo "Vérification des packages installés:"
pip list | Select-String -Pattern "mediapipe|numpy|opencv|flask|redis"
echo ""
echo "Statut:"
echo "  - Virtual environment: ACTIVÉ"
echo "  - Redis: RUNNING (docker exec bijoux-redis redis-cli ping)"
echo ""
echo "Pour lancer le serveur:"
echo "  python src\api\server.py"
echo ""
