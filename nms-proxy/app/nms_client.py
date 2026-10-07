"""
Async client untuk NMS API v2 (Xenoptics XSOS).
Menangani login, refresh token otomatis, dan cache TTL ringan
untuk endpoint GET supaya tidak membanjiri NMS saat banyak
klien (dashboard) polling bersamaan.
"""
import asyncio
import time
from datetime import datetime
from typing import Any

import httpx

try:
    from .config import Settings
except (ImportError, ValueError):
    from config import Settings


class NMSAuthError(Exception):
    pass


class NMSClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._http = httpx.AsyncClient(base_url=settings.nms_base_url, timeout=15.0)
        self._access_token: str | None = None
        self._refresh_token: str | None = None
        self._token_timeout: datetime | None = None
        self._login_lock = asyncio.Lock()
        self._cache: dict[str, tuple[float, Any]] = {}

    async def aclose(self):
        await self._http.aclose()

    async def _login(self):
        payload = {"username": self.settings.nms_username, "password": self.settings.nms_password}
        if self.settings.nms_login_mode:
            payload["mode"] = self.settings.nms_login_mode
        r = await self._http.post("/authentication/login", json=payload)
        if r.status_code == 423 and not self.settings.nms_login_mode:
            # Sesi aktif sebelumnya ada / shared sandbox -> fallback ke mode readonly
            payload["mode"] = "readonly"
            r = await self._http.post("/authentication/login", json=payload)

        if r.status_code != 200:
            raise NMSAuthError(f"Login NMS gagal: {r.status_code} {r.text}")
        data = r.json()["data"]
        self._access_token = data["access_token"]
        self._refresh_token = data.get("refresh_token")
        timeout_str = data.get("user", {}).get("timeout")
        self._token_timeout = datetime.fromisoformat(timeout_str) if timeout_str else None

    async def _refresh(self):
        r = await self._http.post(
            "/authentication/token/refresh",
            headers={"Authorization": f"Bearer {self._access_token}"},
            json={"refresh_token": self._refresh_token},
        )
        if r.status_code != 200:
            # refresh token juga sudah invalid -> login ulang dari nol
            await self._login()
            return
        data = r.json()["data"]
        self._access_token = data["access_token"]
        self._refresh_token = data["refresh_token"]

    async def _ensure_token(self):
        async with self._login_lock:
            if self._access_token is None:
                await self._login()
                return
            # refresh 60 detik sebelum kadaluarsa untuk hindari race
            if self._token_timeout and datetime.now() >= self._token_timeout:
                await self._refresh()

    async def _headers(self) -> dict:
        await self._ensure_token()
        return {"Authorization": f"Bearer {self._access_token}"}

    # ---------------- Cache helper ----------------

    def _cache_get(self, key: str):
        entry = self._cache.get(key)
        if not entry:
            return None
        ts, value = entry
        if time.monotonic() - ts > self.settings.cache_ttl_seconds:
            return None
        return value

    def _cache_set(self, key: str, value: Any):
        self._cache[key] = (time.monotonic(), value)

    # ---------------- Request helpers ----------------

    async def get(self, path: str, params: dict | None = None, use_cache: bool = True) -> Any:
        cache_key = f"GET {path} {params}"
        if use_cache:
            cached = self._cache_get(cache_key)
            if cached is not None:
                return cached

        headers = await self._headers()
        r = await self._http.get(path, headers=headers, params=params)
        if r.status_code == 401:
            # token invalid di tengah jalan -> paksa login ulang, coba sekali lagi
            self._access_token = None
            headers = await self._headers()
            r = await self._http.get(path, headers=headers, params=params)
        r.raise_for_status()
        data = r.json()["data"]
        if use_cache:
            self._cache_set(cache_key, data)
        return data

    async def post(self, path: str, payload: dict | None = None) -> Any:
        headers = await self._headers()
        r = await self._http.post(path, headers=headers, json=payload)
        if r.status_code == 401:
            self._access_token = None
            headers = await self._headers()
            r = await self._http.post(path, headers=headers, json=payload)
        r.raise_for_status()
        return r.json()["data"]

    async def delete(self, path: str, payload: dict | None = None) -> Any:
        headers = await self._headers()
        r = await self._http.request("DELETE", path, headers=headers, json=payload)
        if r.status_code == 401:
            self._access_token = None
            headers = await self._headers()
            r = await self._http.request("DELETE", path, headers=headers, json=payload)
        r.raise_for_status()
        if r.status_code == 204 or not r.content:
            return {"status": "success"}
        data = r.json()
        return data.get("data", data)

    async def logout(self) -> Any:
        """Kirim DELETE /authentication/logout dan hapus session token."""
        try:
            if self._access_token:
                await self.delete("/authentication/logout")
        except Exception:
            pass
        finally:
            self._access_token = None
            self._refresh_token = None
            self._token_timeout = None
            self._cache.clear()
        return {"status": "logged_out"}
