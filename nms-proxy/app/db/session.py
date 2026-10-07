"""
SQLAlchemy database session & engine configuration.
Mendukung SQLite secara default dan PostgreSQL via DATABASE_URL.
"""
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

try:
    from app.config import get_settings
except (ImportError, ValueError):
    try:
        from config import get_settings
    except (ImportError, ValueError):
        from ..config import get_settings


settings = get_settings()

db_url = settings.database_url
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency injection session database untuk router FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
