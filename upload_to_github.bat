@echo off
title PHA INDIA - Push to GitHub
cd /d "%~dp0"
echo ================================================================
echo  PHA INDIA PRIVATE LIMITED - GitHub Upload
echo  Repository: https://github.com/SSachin444/press-shop-production
echo ================================================================
echo.

"C:\Program Files\GitHub CLI\gh.exe" auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] Opening browser for one-click GitHub authorization...
    echo       (The one-time code is automatically copied to your clipboard!)
    echo.
    "C:\Program Files\GitHub CLI\gh.exe" auth login -h github.com -w -p https -s repo -c
)

echo.
echo [2/3] Configuring Git credential helper...
"C:\Program Files\GitHub CLI\gh.exe" auth setup-git

echo.
echo [3/3] Uploading all project files to GitHub main branch...
set PATH=C:\Users\sanka\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd;%PATH%
git push -u origin main

echo.
echo ================================================================
echo  DONE! All files are uploaded and live at:
echo  https://github.com/SSachin444/press-shop-production
echo ================================================================
pause
