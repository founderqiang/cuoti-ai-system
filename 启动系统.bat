@echo off
chcp 65001 >nul
cls

echo ===============================================================
echo   AI Error Attribution and Targeted Variant System
echo   [Startup Script]
echo ===============================================================
echo.

cd /d "%~dp0"

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

REM Check Virtual Environment
if not exist "backend\.venv" (
    echo [INFO] Creating virtual environment...
    python -m venv backend\.venv
)

REM Activate Virtual Environment
call backend\.venv\Scripts\activate.bat

REM Install Dependencies
echo [INFO] Checking dependencies...
pip install -r requirements.txt -q

REM Check Configuration
if not exist "backend\.env" (
    echo.
    echo ---------------------------------------------------------------
    echo [TIP] backend\.env not found!
    echo ---------------------------------------------------------------
    echo.
    if exist "backend\.env.example" (
        copy backend\.env.example backend\.env >nul 2>&1
        echo Created .env from example. Please edit it.
        notepad backend\.env
    )
    pause
    exit /b 0
)

echo.
echo [INFO] Starting services...
echo [INFO] URL: http://localhost:5000
echo [INFO] Press Ctrl+C to stop
echo.

python backend\app.py
pause
