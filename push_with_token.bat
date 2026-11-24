@echo off
echo ============================================
echo  PHA INDIA - Push to GitHub
echo ============================================
echo.
echo You need a GitHub Personal Access Token (PAT).
echo.
echo To create one:
echo  1. Go to: https://github.com/settings/tokens/new
echo  2. Note: "PHA INDIA Deploy"
echo  3. Expiration: 90 days
echo  4. Scopes: check "repo" (full control)
echo  5. Click "Generate token" and COPY it
echo.
set /p TOKEN=Paste your GitHub token here: 
echo.
echo Pushing to GitHub...
set GIT=C:\Users\sanka\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe

%GIT% -C "d:\project web" remote set-url origin https://SSachin444:%TOKEN%@github.com/SSachin444/press-shop-production.git
%GIT% -C "d:\project web" push -u origin main

if %errorlevel% == 0 (
    echo.
    echo SUCCESS! Files pushed to GitHub.
    echo Repository: https://github.com/SSachin444/press-shop-production
    echo.
    echo Next step - Deploy on Vercel:
    echo  1. Go to https://vercel.com
    echo  2. Click "Add New Project"
    echo  3. Import from GitHub: SSachin444/press-shop-production
    echo  4. Framework: Vite
    echo  5. Build Command: npm run build
    echo  6. Output Directory: dist
    echo  7. Click Deploy!
) else (
    echo.
    echo Push failed. Check your token and try again.
)

rem Clear token from remote URL for security
%GIT% -C "d:\project web" remote set-url origin https://github.com/SSachin444/press-shop-production.git

echo.
pause
