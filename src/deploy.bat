@echo off
cd "C:\Users\V-Can Nantawan\vcan-dashboard"
echo.
echo === VCAN Dashboard Deploy ===
echo.

echo [1/3] Building...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo *** BUILD FAILED — fix errors above before deploying ***
    pause
    exit /b 1
)

echo.
echo [2/3] Committing...
git add .
git commit -m "update dashboard"

echo.
echo [3/3] Pushing to GitHub (Netlify auto-deploys)...
git push

echo.
echo === Done! Netlify is deploying... ===
echo Check: https://vcanproductmasterdashboard.netlify.app
echo.
pause
