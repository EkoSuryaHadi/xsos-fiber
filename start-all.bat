@echo off
title Xenoptics IXP Orchestration Platform
echo ========================================================
echo   Launching Xenoptics NMS Stack (Proxy + Dashboard)
echo ========================================================

cd /d "%~dp0"

echo 1. Starting Backend Proxy (:8000)...
start "Xenoptics Proxy :8000" run-backend-proxy.bat

echo 2. Waiting 3 seconds for Proxy to initialize...
timeout /t 3 /nobreak >nul

echo 3. Starting Next.js Dashboard (:3000)...
cd /d "%~dp0nms-dashboard"
start "Xenoptics Dashboard :3000" npm run dev

echo ========================================================
echo   Stack started!
echo   Dashboard: http://localhost:3000
echo   Proxy API: http://localhost:8000/docs
echo ========================================================
timeout /t 5
