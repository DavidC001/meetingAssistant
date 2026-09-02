from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from .core.config import config

_engine_kwargs = {"echo": config.database.echo}
if not config.database.url.startswith("sqlite"):
    # SQLite's default pool classes don't accept pool_size/max_overflow. Pipeline tasks
    # (app/tasks.py) hold a session open for up to an hour while doing GPU work with no
    # queries in flight; pool_pre_ping/pool_recycle keep a connection dropped during that
    # idle window from surfacing as a hard failure on the next query.
    _engine_kwargs.update(
        pool_size=config.database.pool_size,
        max_overflow=config.database.max_overflow,
        pool_recycle=config.database.pool_recycle,
        pool_pre_ping=config.database.pool_pre_ping,
    )

engine = create_engine(config.database.url, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency to get a DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
