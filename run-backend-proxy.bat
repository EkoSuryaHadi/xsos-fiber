@echo off
title Xenoptics NMS Backend Proxy (:8000)
echo ========================================================
echo   Starting Xenoptics NMS Backend Proxy Service
echo   Port: http://127.0.0.1:8000
echo ========================================================

cd /d "%~dp0nms-proxy"

if exist "C:\Python311\python.exe" (
    set "PYTHON_CMD=C:\Python311\python.exe"
) else (
    set "PYTHON_CMD=python"
)

"%PYTHON_CMD%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
