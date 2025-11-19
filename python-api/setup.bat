@echo off
echo ====================================
echo 📦 Setup Bijoux AI Backend
echo ====================================
echo.

echo [1/5] Activation du venv...
call .\venv\Scripts\activate.bat
echo .
echo [2/5] Installation des dependances...
pip install -r requirements.txt -q
echo .
echo [3/5] Verification MediaPipe...
pip list | findstr /i "mediapipe"
echo .
echo [4/5] Verification Redis...
python -c "import redis; print('Redis: OK')" 2>nul || echo Redis: Not accessible
echo .
echo [5/5] Statut...
echo Venv: ACTIVE
Python: .
echo ====================================
echo ✅ Setup complete !
echo ====================================
echo.
echo Pour lancer le serveur:
echo   python src\api\server.py
echo.
