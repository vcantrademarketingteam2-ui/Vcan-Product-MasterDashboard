@echo off
cd "C:\Users\V-Can Nantawan\vcan-dashboard"
echo.
echo === VCAN Dashboard Deploy ===
echo.
git add .
git commit -m "update dashboard"
git push
echo.
echo === Done! Netlify is deploying... ===
echo Check: https://vcanproductmasterdashboard.netlify.app
echo.
pause
