@echo off
title Noria — Agentic Control Center
echo ===================================================
echo               STARTING NORIA LOCALHOST             
echo ===================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org/
    pause
    exit /b
)

:: Check if Python is installed
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed!
    echo Please install Python and make sure to check "Add Python to PATH" during installation.
    pause
    exit /b
)

echo [1/3] Installing/updating Node.js dependencies...
call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo [WARNING] npm install had some issues, continuing anyway...
)
echo.

echo [2/3] Installing/updating Python dependencies...
call pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [WARNING] pip install had some issues, continuing anyway...
)
echo.

echo [3/3] Launching Noria Control Center...
echo Close this command window to stop Noria.
echo.

:: Open browser and start Streamlit app
start http://localhost:8501
call streamlit run app.py

pause
