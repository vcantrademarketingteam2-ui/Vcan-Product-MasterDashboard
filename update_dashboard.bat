@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "MSG=%~1"
set "DEFMSG=data: update product master, promo plan and packshots"
REM Daily LINE status (broadcast to bot followers) via the dashboard worker. Secret lives in the
REM git-ignored .status_secret file; without it the status message is skipped.
set "STATUS_URL=https://vcanproductmasterdashboard.vcan-trademarketingteam2.workers.dev/api/update-status"
set "STEP=preflight checks: Y: drive, Python or npm missing"
set "DETAIL="

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
set "STEP=[1/6] product master Excel"
echo.
echo [1/6] Product master -^> src/data.js + src/retailer_data.js ...
py convert_to_data.py <nul
if errorlevel 1 (
    echo   [X] convert_to_data.py failed
    goto fail
)

REM ---------------------------------------------------------------- 2/6
set "STEP=[2/6] promotion plan Excel"
echo.
echo [2/6] Promotion plans -^> src/promo_data.js + notification_schedule.json ...
py convert_promo.py <nul
if errorlevel 1 (
    echo   [X] convert_promo.py failed
    goto fail
)

REM ---------------------------------------------------------------- 3/6
set "STEP=[3/6] packshot copy"
echo.
echo [3/6] Copying packshots from Y: drive ...
powershell -ExecutionPolicy Bypass -NonInteractive -File "%~dp0copy_packshots.ps1" -NoPause
if errorlevel 1 (
    echo   [X] copy_packshots.ps1 failed
    goto fail
)

REM ---------------------------------------------------------------- 4/6
set "STEP=[4/6] WebP conversion"
echo.
echo [4/6] Converting new images to WebP ...
echo. | py convert_to_webp.py
if errorlevel 1 (
    echo   [X] convert_to_webp.py failed
    goto fail
)

REM ---------------------------------------------------------------- 5/6
set "STEP=[5/6] build check"
echo.
echo [5/6] Build check (npm run build) ...
call npm run build
if errorlevel 1 (
    echo   [X] Build failed - NOT committing. Fix the errors above first.
    goto fail
)

REM ---------------------------------------------------------------- 6/6
set "STEP=[6/6] git commit/push"
echo.
echo [6/6] Commit and push ...

git add -A -- src/data.js src/retailer_data.js src/promo_data.js public/notification_schedule.json public/packshots public/retailers
if errorlevel 1 (
    echo   [X] git add failed - nothing staged
    goto fail
)

set "WARN="
if exist logs\promo_warnings.txt set /p WARN=<logs\promo_warnings.txt

git diff --cached --quiet
if not errorlevel 1 (
    echo   Nothing changed - dashboard data is already up to date.
    set "RESULT=nochange"
    set "DETAIL=%WARN%"
    goto done
)

set "CHG="
git diff --cached --quiet -- src/promo_data.js || set "CHG=%CHG%promo plan, "
git diff --cached --quiet -- src/data.js src/retailer_data.js || set "CHG=%CHG%product master, "
git diff --cached --quiet -- public/notification_schedule.json || set "CHG=%CHG%promo alerts, "
git diff --cached --quiet -- public/retailers || set "CHG=%CHG%retailer logos, "
for /f %%n in ('git diff --cached --name-only -- public/packshots ^| find /c /v ""') do if not "%%n"=="0" set "CHG=%CHG%%%n packshot files, "
if defined CHG set "CHG=%CHG:~0,-2%"
set "RESULT=updated"
set "DETAIL=Changed: %CHG% %WARN%"

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
set "RC=0"
goto finish

:fail
echo.
echo ============================================
echo   FAILED - nothing was pushed.
echo ============================================
set "RESULT=failed"
set "DETAIL=Stopped at: %STEP%. Details in logs\daily_update.log"
set "RC=1"

:finish
if not exist "%~dp0.status_secret" (
    echo   [i] .status_secret missing - LINE status message skipped
    goto end
)
set /p STATUS_SECRET=<"%~dp0.status_secret"
REM Announce only after Cloudflare has deployed (~2 min). ping, not timeout: timeout
REM aborts when stdin is redirected, which is how the scheduled task runs this file.
if "%RESULT%"=="updated" (
    echo   Waiting 3 min for the Cloudflare deploy before announcing on LINE ...
    ping -n 181 127.0.0.1 >nul
)
curl.exe -s -m 20 -o nul -w "  LINE status: HTTP %%{http_code}\n" -H "X-Status-Secret: %STATUS_SECRET%" --data-urlencode "status=%RESULT%" --data-urlencode "detail=%DETAIL%" "%STATUS_URL%"

:end
pause
exit /b %RC%
