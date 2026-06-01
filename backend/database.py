import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env file (no-op in production where vars are injected)
load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.error("⚠️  DATABASE_URL is not set — database operations will fail.")
    # Use a dummy URL so the app starts; all DB calls will fail gracefully
    DATABASE_URL = "postgresql://localhost/placeholder"

# Create SQLAlchemy engine
# pool_size=2: keep small for Supabase free tier (max 20 connections total)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # Drop stale connections before using
    pool_size=2,
    max_overflow=3,
    pool_timeout=30,
    pool_recycle=1800,    # Recycle connections every 30 min (avoids idle timeouts)
)

# Session factory — each request will get its own session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all ORM models
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that provides a database session per request.
    Ensures the session is always closed after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
