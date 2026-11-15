@echo off
title PHA INDIA - Live Dev Server
echo =====================================================================
echo  PHA INDIA PRIVATE LIMITED - Full-Stack Dev Mode
echo =====================================================================
echo.
cd /d "%~dp0"
start "PHA Flask Backend (:5000)" "%~dp0venv\Scripts\python.exe" "%~dp0web_app\backend\app.py"
start "PHA Vite Frontend (:5173)" cmd /k "npm run dev"
echo.
echo Flask Backend: http://127.0.0.1:5000
echo React Vite App: http://localhost:5173
echo.
