@echo off
echo ====================================
echo 📦 Installation des dépendances Python
echo ====================================
echo.

REM Activation du venv
call .\venv\Scripts\activate.bat
echo [✓] Venv activé
echo.

REM Installation des packages
echo [1/13] Installation flask-cors...
pip install flask-cors==4.0.0 -q
echo [✓] flask-cors installé
echo.

echo [2/13] Installation flask-socketio...
pip install flask-socketio==5.3.6 -q
echo [✓] flask-socketio installé
echo.

echo [3/13] Installation mediapipe...
pip install mediapipe==0.10.9 -q
echo [✓] mediapipe installé
echo.

echo [4/13] Installation opencv-python...
pip install opencv-python==4.8.1.78 -q
echo [✓] opencv-python installé
echo.

echo [5/13] Installation numpy...
pip install numpy==1.24.3 -q
echo [✓] numpy installé
echo.

echo [6/13] Installation pillow...
pip install pillow==10.1.0 -q
echo [✓] pillow installé
echo.

echo [7/13] Installation redis...
pip install redis==5.0.1 -q
echo [✓] redis installé
echo.

echo [8/13] Installation pydantic...
pip install pydantic==2.5.0 -q
echo [✓] pydantic installé
echo.

echo [9/13] Installation python-dotenv...
pip install python-dotenv==1.0.0 -q
echo [✓] python-dotenv installé
echo.

echo [10/13] Installation loguru...
pip install loguru==0.7.2 -q
echo [✓] loguru installé
echo.

echo [11/13] Installation gunicorn...
pip install gunicorn==21.2.0 -q
echo [✓] gunicorn installé
echo.

echo [12/13] Installation eventlet...
pip install eventlet==0.33.3 -q
echo [✓] eventlet installé
echo.

echo ====================================
echo [✓] Installation terminée !
echo ====================================
echo.
echo Vérification de l'installation:
pip list
echo.
echo.
echo Pour lancer le serveur:
echo   .\venv\Scripts\activate.bat
echo   python src\api\server.py
echo.
pause
