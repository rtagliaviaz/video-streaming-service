from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Database file lives next to the app
DB_PATH = os.getenv("DRM_DB_PATH", "./drm_keys.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # eequired for sqlite + fastapi
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    #FastAPI dependency that provides a DB session per request
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    #Create tables if they don't exist
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)