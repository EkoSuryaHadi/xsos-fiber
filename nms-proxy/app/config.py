"""
Konfigurasi environment untuk NMS Proxy.
Semua nilai dibaca dari environment variable / file .env.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Koneksi ke NMS ---
    nms_base_url: str = "https://nms2-sandbox.xenoptics.co/api/v2"
    nms_username: str
    nms_password: str
    nms_login_mode: str | None = None  # "readonly" jika ingin login read-only

    # --- Keamanan proxy ini sendiri ---
    # Proxy ini menyimpan kredensial admin NMS, jadi wajib dilindungi.
    # Semua request ke /live/* dan /control/* harus menyertakan header:
    #   X-API-Key: <proxy_api_key>
    proxy_api_key: str
 
    # --- Persistensi Basis Data Bisnis (SQLite / PostgreSQL) ---
    database_url: str = "sqlite:///./nms_business.db"

    # --- CORS: origin yang boleh memanggil proxy ini (mis. dashboard) ---
    allowed_origins: str = "http://localhost:3000,http://localhost:3001,http://localhost:5173"

    # --- Cache ringan untuk endpoint GET agar tidak membanjiri NMS ---
    cache_ttl_seconds: float = 5.0

    # --- Guard untuk endpoint controlling (connect/disconnect) ---
    # Jika False, endpoint /control/* akan menolak semua request (default aman).
    enable_control_endpoints: bool = False

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
