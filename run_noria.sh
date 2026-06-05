#!/bin/bash

# Noria — Localhost Launcher for macOS and Linux

echo "==================================================="
echo "              STARTING NORIA LOCALHOST             "
echo "==================================================="
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed!"
    echo "Please install Python 3."
    exit 1
fi

echo "[1/3] Installing/updating Node.js dependencies..."
npm install --no-audit --no-fund
if [ $? -ne 0 ]; then
    echo "[WARNING] npm install had some issues, continuing anyway..."
fi
echo

echo "[2/3] Installing/updating Python dependencies..."
python3 -m pip install -r requirements.txt --quiet
if [ $? -ne 0 ]; then
    echo "[WARNING] pip install had some issues, continuing anyway..."
fi
echo

echo "[3/3] Launching Noria Control Center..."
echo "Close this terminal to stop Noria."
echo

# Open browser and start Streamlit app
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8501
elif command -v open &> /dev/null; then
    open http://localhost:8501
fi

python3 -m streamlit run app.py
