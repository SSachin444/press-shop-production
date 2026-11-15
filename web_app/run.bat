@echo off
title PHA INDIA - PRESS SHOP MFG-2 (Web App Server)
echo =====================================================================
echo  PHA INDIA PRIVATE LIMITED - Web App Production Server
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/2] Checking Python Virtual Environment...
if not exist "venv\Scripts\python.exe" (
    if exist "..\venv\Scripts\python.exe" (
        set "PYTHON_CMD=..\venv\Scripts\python.exe"
    ) else (
        echo Creating virtual environment...
        python -m venv venv
        call venv\Scripts\activate.bat
        pip install -r requirements.txt
        set "PYTHON_CMD=venv\Scripts\python.exe"
    )
) else (
    set "PYTHON_CMD=venv\Scripts\python.exe"
)

echo [2/2] Launching PHA India Backend and Application Server...
start "PHA India Web App Server" cmd /k ""%PYTHON_CMD%" backend\app.py"

timeout /t 3 >nul
echo.
echo =====================================================================
echo Application is now live and operational!
echo Local PC Web URL:   http://127.0.0.1:5000
echo =====================================================================
start http://127.0.0.1:5000
pause
