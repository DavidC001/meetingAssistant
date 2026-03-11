"""
Pytest configuration and shared fixtures for Meeting Assistant tests.

This file provides:
- Database fixtures for testing
- API client fixtures
- Sample data fixtures
- Common test utilities
"""

import asyncio
import math
import os
import struct
import wave
from collections.abc import Generator
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

try:
    from pgvector.sqlalchemy import Vector
except Exception:  # pragma: no cover - pgvector may be unavailable in local test env
    Vector = None

# Avoid external DB startup side effects when importing app.main in tests.
os.environ.setdefault("SKIP_STARTUP_DB_INIT", "1")

from app.core.config import config
from app.core.storage import rag
from app.database import Base, get_db
from app.main import app
from app.models import ActionItem, DiaryEntry, Meeting, Transcription, UserMapping


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, _compiler, **_kw):
    """Allow PostgreSQL JSONB columns to be created on SQLite test databases."""
    return "JSON"


if Vector is not None:

    @compiles(Vector, "sqlite")
    def _compile_vector_sqlite(_type, _compiler, **_kw):
        """Map pgvector columns to BLOB for SQLite-only tests."""
        return "BLOB"

# ============================================================================
# Database Fixtures
# ============================================================================


@pytest.fixture(scope="session")
def test_database_url():
    """Get test database URL from environment or use in-memory SQLite."""
    return os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")


@pytest.fixture(scope="session")
def test_engine(test_database_url):
    """Create a test database engine.

    Uses SQLite in-memory for speed, with proper configuration
    to support concurrent access.
    """
    engine = create_engine(
        test_database_url,
        connect_args={"check_same_thread": False} if "sqlite" in test_database_url else {},
        poolclass=StaticPool if "sqlite" in test_database_url else None,
    )

    # Enable foreign keys for SQLite
    if "sqlite" in test_database_url:

        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    # Create all tables
    Base.metadata.create_all(bind=engine)

    yield engine

    # Drop all tables after tests
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """Create a new database session for each test.

    Automatically rolls back all changes after each test to ensure isolation.
    """
    connection = test_engine.connect()
    transaction = connection.begin()

    # Create session bound to connection
    TestingSessionLocal = sessionmaker(bind=connection)
    session = TestingSessionLocal()

    yield session

    # Rollback transaction and close connection
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def db(db_session: Session) -> Session:
    """Compatibility fixture alias expected by integration tests."""
    return db_session


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create a test client with database session override."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        test_client.close()
        app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def mock_rag_calls(monkeypatch):
    """Prevent integration tests from making external LLM/Ollama network calls."""

    async def _fake_generate_rag_response(*_args, **_kwargs):
        return (
            "Mock assistant response",
            [{"content_type": "tool_result", "snippet": "mock source", "similarity": None, "metadata": {}}],
            ["Can I help with anything else?"],
        )

    monkeypatch.setattr(rag, "generate_rag_response", _fake_generate_rag_response)


# ============================================================================
# Sample Data Fixtures
# ============================================================================


@pytest.fixture
def sample_user(db_session: Session) -> UserMapping:
    """Create a sample user for testing."""
    user = UserMapping(email="test@example.com", name="Test User", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_meeting(db_session: Session) -> Meeting:
    """Create a sample meeting for testing."""
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

    # Backward-compat fields used by older tests.
    meeting.title = "Test Meeting"
    meeting.description = "A test meeting"
    return meeting


@pytest.fixture
def sample_action_item(db_session: Session, sample_meeting: Meeting) -> ActionItem:
    """Create a sample action item for testing."""
    transcription_id = sample_meeting.transcription.id if sample_meeting.transcription else None
    action_item = ActionItem(
        transcription_id=transcription_id,
        task="Test action item",
        owner="Test User",
        priority="high",
        status="pending",
        due_date="2024-02-01",
    )
    db_session.add(action_item)
    db_session.commit()
    db_session.refresh(action_item)

    # Backward-compat fields used by older tests.
    action_item.meeting_id = sample_meeting.id
    action_item.description = action_item.task
    action_item.assignee = action_item.owner
    return action_item


@pytest.fixture
def sample_diary_entry(db_session: Session) -> DiaryEntry:
    """Create a sample diary entry for testing."""
    entry = DiaryEntry(
        date=date(2024, 1, 15),
        content="Test diary entry",
        mood="productive",
        highlights=["Highlight 1"],
        blockers=["Challenge 1"],
        action_items_worked_on=[],
        action_items_completed=[],
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    # Backward-compat fields used by older tests.
    entry.productivity_score = 8
    entry.challenges = ["Challenge 1"]
    entry.learnings = ["Learning 1"]
    return entry


@pytest.fixture
def mock_dataset(db_session: Session):
    """Seed a small realistic dataset for integration-style tests."""
    user = UserMapping(name="Alice Johnson", email="alice@example.com", is_active=True)
    meeting = Meeting(
        filename="weekly_sync.wav",
        filepath="/tmp/weekly_sync.wav",
        audio_filepath="/tmp/weekly_sync.wav",
        status="completed",
        meeting_date=date(2024, 2, 1),
        tags="team,weekly",
        folder="engineering",
        notes="Weekly project sync",
    )
    db_session.add_all([user, meeting])
    db_session.commit()
    db_session.refresh(meeting)

    transcription = Transcription(
        meeting_id=meeting.id,
        summary="Weekly sync summary",
        full_text="Discussed roadmap and blockers.",
    )
    db_session.add(transcription)
    db_session.commit()
    db_session.refresh(transcription)

    action_item = ActionItem(
        transcription_id=transcription.id,
        task="Prepare sprint report",
        owner="Alice Johnson",
        status="pending",
        priority="medium",
        due_date="2024-02-05",
    )
    db_session.add(action_item)
    db_session.commit()
    db_session.refresh(action_item)

    return {
        "users": [user],
        "meetings": [meeting],
        "transcriptions": [transcription],
        "action_items": [action_item],
    }


# ============================================================================
# Mock Fixtures
# ============================================================================


@pytest.fixture
def mock_openai_response():
    """Mock OpenAI API response."""
    return {"choices": [{"message": {"content": '{"summary": "Test summary", "key_points": ["Point 1"]}'}}]}


@pytest.fixture
def mock_embedding_response():
    """Mock embedding API response."""
    return {
        "data": [
            {
                "embedding": [0.1, 0.2, 0.3] * 256  # 768-dimensional vector
            }
        ]
    }


@pytest.fixture
def mock_openai(mock_openai_response):
    """Compatibility fixture alias expected by integration tests."""
    return mock_openai_response


@pytest.fixture
def mock_embeddings(mock_embedding_response):
    """Compatibility fixture alias expected by integration tests."""
    return mock_embedding_response


def _write_mock_wav(file_path: Path, duration_seconds: float = 0.5, sample_rate: int = 16000) -> Path:
    """Create a small valid mono WAV file for upload/transcription tests."""
    n_samples = int(duration_seconds * sample_rate)
    amplitude = 8000
    freq = 440.0

    with wave.open(str(file_path), "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        for i in range(n_samples):
            value = int(amplitude * math.sin(2.0 * math.pi * freq * (i / sample_rate)))
            wav_file.writeframes(struct.pack("<h", value))

    return file_path


@pytest.fixture
def sample_audio_file(tmp_path):
    """Create a valid small WAV audio file for testing."""
    audio_file = tmp_path / "test_audio.wav"
    return _write_mock_wav(audio_file)


@pytest.fixture
def mock_audio_files(tmp_path):
    """Create multiple realistic mock audio files for batch tests."""
    files = [
        _write_mock_wav(tmp_path / "meeting_alpha.wav", duration_seconds=0.4),
        _write_mock_wav(tmp_path / "meeting_beta.wav", duration_seconds=0.6),
    ]
    return files


@pytest.fixture
def sample_transcript():
    """Sample transcript data for testing."""
    return {
        "text": "This is a test transcript.",
        "segments": [
            {"start": 0.0, "end": 2.5, "text": "This is a test", "speaker": "SPEAKER_00"},
            {"start": 2.5, "end": 4.0, "text": "transcript.", "speaker": "SPEAKER_01"},
        ],
        "speakers": ["SPEAKER_00", "SPEAKER_01"],
    }


# ============================================================================
# Configuration Fixtures
# ============================================================================


@pytest.fixture(autouse=True)
def test_config():
    """Override configuration for testing."""
    original_debug = config.debug
    config.debug = True

    yield config

    config.debug = original_debug


# ============================================================================
# Async Fixtures
# ============================================================================


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Utility Functions
# ============================================================================


def assert_valid_meeting_response(response_data: dict):
    """Assert that a meeting response has all required fields."""
    required_fields = ["id", "title", "status", "created_at"]
    for field in required_fields:
        assert field in response_data, f"Missing required field: {field}"


def assert_valid_error_response(response_data: dict):
    """Assert that an error response has proper structure."""
    assert "error" in response_data
    error = response_data["error"]
    assert "code" in error
    assert "message" in error
