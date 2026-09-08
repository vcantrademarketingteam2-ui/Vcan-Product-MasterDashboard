@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "MSG=%~1"
set "DEFMSG=data: update product master, promo plan and packshots"

echo.
echo ============================================
echo   VCAN Dashboard - Full Update
echo ============================================

REM ---------------------------------------------------------------- 0/6
echo.
echo [0/6] Preflight checks...
set "PREERR="

where py >nul 2>&1
if errorlevel 1 (
    echo   [X] Python launcher "py" not found in PATH
    set PREERR=1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo   [X] npm not found in PATH
    set PREERR=1
)

py -c "import openpyxl, PIL" >nul 2>&1
if errorlevel 1 (
    echo   [X] Missing Python packages. Fix with:
    echo       py -m pip install openpyxl pillow
    set PREERR=1
)

if not exist "Y:\MARKETING\Product Master\Product Master 2026.xlsx" (
    echo   [X] Y: drive source not reachable:
    echo       Y:\MARKETING\Product Master\Product Master 2026.xlsx
    echo       Reconnect the Y: network drive, then run again.
    set PREERR=1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo   [X] Not a git repository - run this file from the project folder
    set PREERR=1
)

if defined PREERR goto fail
echo   OK

REM ---------------------------------------------------------------- 1/6
echo.
echo [1/6] Product master -^> src/data.js + src/retailer_data.js ...
py convert_to_data.py <nul
if errorlevel 1 (
    echo   [X] convert_to_data.py failed
    goto fail
)

REM ---------------------------------------------------------------- 2/6
echo.
echo [2/6] Promotion plans -^> src/promo_data.js + notification_schedule.json ...
py convert_promo.py <nul
if errorlevel 1 (
    echo   [X] convert_promo.py failed
    goto fail
)

REM ---------------------------------------------------------------- 3/6
echo.
echo [3/6] Copying packshots from Y: drive ...
powershell -ExecutionPolicy Bypass -NonInteractive -File "%~dp0copy_packshots.ps1" -NoPause
if errorlevel 1 (
    echo   [X] copy_packshots.ps1 failed
    goto fail
)

REM ---------------------------------------------------------------- 4/6
echo.
echo [4/6] Converting new images to WebP ...
echo. | py convert_to_webp.py
if errorlevel 1 (
    echo   [X] convert_to_webp.py failed
    goto fail
)

REM ---------------------------------------------------------------- 5/6
echo.
echo [5/6] Build check (npm run build) ...
call npm run build
if errorlevel 1 (
    echo   [X] Build failed - NOT committing. Fix the errors above first.
    goto fail
)

REM ---------------------------------------------------------------- 6/6
echo.
echo [6/6] Commit and push ...

git add -A -- src/data.js src/retailer_data.js src/promo_data.js public/notification_schedule.json public/packshots public/retailers
if errorlevel 1 (
    echo   [X] git add failed - nothing staged
    goto fail
)

git diff --cached --quiet
if not errorlevel 1 (
    echo   Nothing changed - dashboard data is already up to date.
    goto done
)

echo   Staging:
git diff --cached --name-status
if not defined MSG set /p "MSG=Commit message (Enter for default): "
if not defined MSG set "MSG=%DEFMSG%"
git commit -m "%MSG%"
if errorlevel 1 (
    echo   [X] git commit failed
    goto fail
)

echo.
echo   Syncing with origin/main before push ...
git pull --rebase --autostash origin main
if errorlevel 1 (
    echo.
    echo   [X] Rebase onto origin/main hit a conflict.
    echo       Your commit is saved. Resolve the conflict, then run:
    echo         git rebase --continue
    echo         git push origin main
    echo       Or abort with:  git rebase --abort
    goto fail
)

git push origin main
if errorlevel 1 (
    echo   [X] Push rejected. Run "git pull --rebase --autostash origin main" and try again.
    goto fail
)

:done
echo.
echo ============================================
echo   Done! Cloudflare deploys in ~2 min
echo ============================================
pause
exit /b 0

:fail
echo.
echo ============================================
echo   FAILED - nothing was pushed.
echo ============================================
pause
exit /b 1
