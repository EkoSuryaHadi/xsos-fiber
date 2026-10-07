@echo off
echo ==========================================================
echo   Starting Cloudflare Tunnel for NMS Dashboard (:3000)
echo ==========================================================
cloudflared tunnel --url http://localhost:3000
pause
