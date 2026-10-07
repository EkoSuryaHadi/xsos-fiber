@echo off
echo ========================================================
echo   Starting Cloudflare Tunnel for NMS Backend Proxy (:8005)
echo ========================================================
cloudflared tunnel --url http://localhost:8005
pause
