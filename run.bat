@echo off
title PHA INDIA - PRESS SHOP MFG-2 System
echo =====================================================================
echo  PHA INDIA PRIVATE LIMITED
echo  PRESS SHOP MFG-2 Production & Shopfloor Management System
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/2] Checking Python Virtual Environment...
if not exist "venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r web_app\backend\requirements.txt
)

echo [2/2] Launching PHA India Backend and Application Server...
start "PHA India MES Server" cmd /k ""%~dp0venv\Scripts\python.exe" "%~dp0web_app\backend\app.py""

timeout /t 3 >nul
echo.
echo =====================================================================
echo Application is now live and operational!
echo Local PC Web URL:   http://127.0.0.1:5000
echo WiFi Android / Web: http://10.71.103.50:5000
echo =====================================================================
start http://127.0.0.1:5000
pause
