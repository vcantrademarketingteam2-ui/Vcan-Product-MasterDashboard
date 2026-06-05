@echo off
chcp 65001 >nul
echo.
echo ============================================
echo   VCAN Dashboard - Full Update
echo ============================================
echo.

echo [1/5] Converting Excel to data.js...
py convert_to_data.py
if errorlevel 1 (
    echo FAILED - check convert_to_data.py
    pause & exit /b 1
)

echo.
echo [2/5] Converting Promotion Plan to promo_data.js...
py convert_promo.py
if errorlevel 1 (
    echo FAILED - check convert_promo.py
    pause & exit /b 1
)

echo.
echo [3/5] Copying packshots from Y: drive...
powershell -ExecutionPolicy Bypass -NonInteractive -File "%~dp0copy_packshots.ps1"

echo.
echo [4/5] Converting new images to WebP...
py convert_to_webp.py
if errorlevel 1 (
    echo FAILED - check convert_to_webp.py
    pause & exit /b 1
)

echo.
echo [5/5] Pushing to GitHub (Cloudflare auto-deploys)...
git add src/data.js src/retailer_data.js src/promo_data.js
git add public/packshots/*.webp
git add -u
git status
echo.
set /p MSG=Commit message (Enter for default): 
if "%MSG%"=="" set MSG=data: update product master, promo plan and packshots
git commit -m "%MSG%"
git push origin main

echo.
echo ============================================
echo   Done! Dashboard updates in ~2 minutes
echo ============================================
pause