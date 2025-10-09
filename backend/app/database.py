import logging

from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from .core.config import config

engine = create_engine(config.database.url, echo=config.database.echo)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def _ensure_vector_extension() -> None:
    """Enable the pgvector extension when running against PostgreSQL."""

    if not engine.dialect.name.startswith("postgresql"):
        return

    try:
        with engine.connect() as connection:
            connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            connection.commit()
    except Exception as exc:  # pragma: no cover - best effort initialization
        logging.getLogger(__name__).warning(
            "Could not ensure pgvector extension is available: %s", exc
        )


_ensure_vector_extension()

# Dependency to get a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
