"""
Pytest configuration and shared fixtures for Meeting Assistant tests.

This file provides:
- Database fixtures for testing
- API client fixtures
- Sample data fixtures
- Common test utilities
"""

import asyncio
import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import config
from app.database import Base, get_db
from app.main import app
from app.models import ActionItem, DiaryEntry, Meeting, User

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
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create a test client with database session override."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


# ============================================================================
# Sample Data Fixtures
# ============================================================================


@pytest.fixture
def sample_user(db_session: Session) -> User:
    """Create a sample user for testing."""
    user = User(email="test@example.com", name="Test User", is_active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_meeting(db_session: Session) -> Meeting:
    """Create a sample meeting for testing."""
    meeting = Meeting(
        title="Test Meeting",
        description="A test meeting",
        status="completed",
        date="2024-01-15",
        duration=60,
        participants=["Alice", "Bob"],
        topics=["Topic 1", "Topic 2"],
        summary="Meeting summary",
        key_points=["Point 1", "Point 2"],
        decisions=["Decision 1"],
        next_steps=["Step 1"],
    )
    db_session.add(meeting)
    db_session.commit()
    db_session.refresh(meeting)
    return meeting


@pytest.fixture
def sample_action_item(db_session: Session, sample_meeting: Meeting) -> ActionItem:
    """Create a sample action item for testing."""
    action_item = ActionItem(
        meeting_id=sample_meeting.id,
        description="Test action item",
        assignee="Test User",
        priority="high",
        status="pending",
        due_date="2024-02-01",
    )
    db_session.add(action_item)
    db_session.commit()
    db_session.refresh(action_item)
    return action_item


@pytest.fixture
def sample_diary_entry(db_session: Session) -> DiaryEntry:
    """Create a sample diary entry for testing."""
    entry = DiaryEntry(
        date="2024-01-15",
        content="Test diary entry",
        mood="productive",
        productivity_score=8,
        highlights=["Highlight 1"],
        challenges=["Challenge 1"],
        learnings=["Learning 1"],
        action_items_worked_on=[],
        action_items_completed=[],
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry


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
def sample_audio_file(tmp_path):
    """Create a sample audio file for testing."""
    audio_file = tmp_path / "test_audio.mp3"
    audio_file.write_bytes(b"fake audio content")
    return audio_file


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
