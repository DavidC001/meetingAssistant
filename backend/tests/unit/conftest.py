"""Minimal conftest for unit tests — avoids loading the full app with ML deps."""

import os

os.environ.setdefault("SKIP_STARTUP_DB_INIT", "1")

from datetime import date

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Must import Base and models BEFORE creating engine (for table metadata)
from app.database import Base

# Import models so they register with Base.metadata
from app.models import ActionItem, DiaryEntry, Meeting, Transcription, UserMapping  # noqa: F401


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    TestingSessionLocal = sessionmaker(bind=connection)
    session = TestingSessionLocal()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def db(db_session):
    return db_session


@pytest.fixture
def sample_meeting(db_session):
    meeting = Meeting(
        filename="test_meeting.wav",
        filepath="/tmp/test_meeting.wav",
        audio_filepath="/tmp/test_meeting.wav",
        status="completed",
        meeting_date=date(2024, 1, 15),
        tags="test,demo",
        folder="test-folder",
        notes="A test meeting",
    )
    db_session.add(meeting)
    db_session.commit()
    db_session.refresh(meeting)

    transcription = Transcription(
        meeting_id=meeting.id,
        summary="Meeting summary",
        full_text="Test transcript content",
    )
    db_session.add(transcription)
    db_session.commit()
    db_session.refresh(meeting)

    meeting.title = "Test Meeting"
    meeting.description = "A test meeting"
    return meeting
