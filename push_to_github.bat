@echo off
title Push PHA INDIA to GitHub
cd /d "%~dp0"
set PATH=C:\Users\sanka\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd;%PATH%
echo ================================================================
echo  PHA INDIA PRIVATE LIMITED - GitHub Repository Push
echo  Target: https://github.com/SSachin444/press-shop-production
echo  Branch: main
echo ================================================================
echo.
git push -u origin main
echo.
pause
