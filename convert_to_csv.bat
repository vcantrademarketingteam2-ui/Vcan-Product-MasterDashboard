@echo off
echo.
echo === VCAN Product Master — Excel to CSV ===
echo.

python convert_to_csv.py
if %errorlevel% neq 0 (
    echo.
    echo *** FAILED — ตรวจสอบว่า Python และ openpyxl ติดตั้งแล้วหรือยัง ***
    echo     pip install openpyxl
    echo.
)

echo.
pause
