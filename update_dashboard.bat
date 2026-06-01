@echo off
chcp 65001 >nul
echo.
echo ============================================
echo   VCAN Dashboard - Full Update
echo ============================================
echo.

echo [1/4] Converting Excel to data files...
py convert_to_data.py
if errorlevel 1 (
    echo *** FAILED — check convert_to_data.py output ***
    pause & exit /b 1
)

echo.
echo [2/4] Copying packshots from Y: drive...
powershell -ExecutionPolicy Bypass -NonInteractive -File "%~dp0copy_packshots.ps1"

echo.
echo [3/4] Converting new images to WebP...
py convert_to_webp.py
if errorlevel 1 (
    echo *** FAILED — check convert_to_webp.py output ***
    pause & exit /b 1
)

echo.
echo [4/4] Pushing to GitHub (Netlify auto-deploys)...
git add src/data.js src/retailer_data.js
git add public/packshots/*.webp
git add -u
git status
echo.
set /p MSG="Commit message (or Enter for default): "
if "%MSG%"=="" set MSG=data: update product master and packshots
git commit -m "%MSG%"
git push origin main

echo.
echo ============================================
echo   Done! Dashboard updates in ~2 minutes
echo   https://vcanproductmasterdashboard.netlify.app
echo ============================================
pause
