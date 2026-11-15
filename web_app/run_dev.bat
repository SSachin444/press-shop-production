@echo off
title PHA INDIA - Web App Live Dev Mode
echo =====================================================================
echo  PHA INDIA PRIVATE LIMITED - Full-Stack Dev Mode
echo =====================================================================
echo.
cd /d "%~dp0"

if exist "..\venv\Scripts\python.exe" (
    set "PYTHON_CMD=..\venv\Scripts\python.exe"
) else (
    set "PYTHON_CMD=venv\Scripts\python.exe"
)

start "PHA Flask Backend (:5000)" "%PYTHON_CMD%" backend\app.py
start "PHA Vite Frontend (:5173)" cmd /k "npm.cmd run dev"
echo.
echo Flask Backend: http://127.0.0.1:5000
echo React Vite App: http://localhost:5173
echo.
