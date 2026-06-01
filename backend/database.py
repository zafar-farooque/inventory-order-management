import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in the environment or .env file.")

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # Verifies connections before using them
    pool_size=10,             # Number of connections to keep in the pool
    max_overflow=20,          # Extra connections allowed above pool_size
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
