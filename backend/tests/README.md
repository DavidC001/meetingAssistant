# Backend Testing Guide

## Overview

This directory contains all tests for the Meeting Assistant backend. Tests are organized into unit tests, integration tests, and fixtures.

## Structure

```
tests/
├── conftest.py              # Shared pytest fixtures and configuration
├── unit/                    # Unit tests for individual functions/classes
│   └── test_validation.py   # Environment validation tests
├── integration/             # Integration tests for API endpoints
│   └── test_api_meetings.py # Meeting API endpoint tests
└── fixtures/                # Test data and fixtures (to be created)
```

## Running Tests

### Run all tests
```bash
pytest
```

### Run with coverage report
```bash
pytest --cov=app --cov-report=html
```

### Run specific test file
```bash
pytest tests/unit/test_validation.py
```

### Run specific test
```bash
pytest tests/unit/test_validation.py::TestEnvironmentValidator::test_validate_required_success
```

### Run tests by marker
```bash
# Run only unit tests
pytest -m unit

# Run only integration tests
pytest -m integration

# Run only API tests
pytest -m api

# Skip slow tests
pytest -m "not slow"
```

### Run tests in parallel
```bash
pytest -n auto  # Auto-detect CPU count
pytest -n 4     # Use 4 workers
```

## Test Markers

- `@pytest.mark.unit` - Unit tests for individual functions/classes
- `@pytest.mark.integration` - Integration tests for API endpoints and database
- `@pytest.mark.slow` - Tests that take a long time to run
- `@pytest.mark.api` - API endpoint tests
- `@pytest.mark.database` - Database-related tests
- `@pytest.mark.llm` - Tests involving LLM providers
- `@pytest.mark.embedding` - Tests involving embedding generation

## Fixtures

### Database Fixtures
- `test_engine` - Test database engine (session scope)
- `db_session` - Database session for each test (function scope)
- `client` - FastAPI TestClient with database override

### Sample Data Fixtures
- `sample_user` - Creates a test user
- `sample_meeting` - Creates a test meeting
- `sample_action_item` - Creates a test action item
- `sample_diary_entry` - Creates a test diary entry

### Mock Fixtures
- `mock_openai_response` - Mock OpenAI API response
- `mock_embedding_response` - Mock embedding API response
- `sample_audio_file` - Creates a temporary audio file
- `sample_transcript` - Sample transcript data

## Writing Tests

### Unit Test Example
```python
import pytest
from app.modules.meetings.service import MeetingService

@pytest.mark.unit
def test_meeting_service_validation():
    """Test meeting validation logic."""
    service = MeetingService()

    # Test logic here
    assert service.validate_title("Valid Title") is True
```

### Integration Test Example
```python
import pytest
from fastapi import status

@pytest.mark.integration
@pytest.mark.api
def test_create_meeting(client, sample_user):
    """Test creating a meeting via API."""
    meeting_data = {
        "title": "Test Meeting",
        "description": "A test meeting"
    }

    response = client.post("/api/v1/meetings", json=meeting_data)

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["title"] == "Test Meeting"
```

### Using Mocks
```python
from unittest.mock import patch, MagicMock

@pytest.mark.unit
def test_llm_analysis(mock_openai_response):
    """Test LLM analysis with mocked response."""
    with patch('app.core.llm.client.create') as mock_create:
        mock_create.return_value = mock_openai_response

        # Test logic here
        result = analyze_meeting("transcript text")
        assert result["summary"] == "Test summary"
```

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Use Fixtures**: Leverage fixtures for common setup and teardown
3. **Clear Test Names**: Use descriptive test names that explain what is being tested
4. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and assertion phases
5. **Mock External Services**: Mock API calls, file I/O, and external dependencies
6. **Test Edge Cases**: Include tests for boundary conditions and error cases
7. **Keep Tests Fast**: Use mocks and in-memory databases to speed up tests

## Coverage Goals

- **Overall**: 80% code coverage
- **Critical Paths**: 100% coverage for authentication, authorization, data validation
- **Services**: 90% coverage for business logic
- **API Endpoints**: 85% coverage for all endpoints

## Continuous Integration

Tests are automatically run in CI/CD pipelines:
- On pull requests: All tests must pass
- On main branch: Tests run with coverage reporting
- Nightly: Full test suite including slow tests

## Troubleshooting

### Database Connection Issues
If you encounter database connection issues during tests, ensure:
- The TEST_DATABASE_URL environment variable is set (or use default SQLite)
- PostgreSQL is running if using PostgreSQL for tests
- Database migrations are up to date

### Import Errors
If you see import errors:
```bash
# Install dependencies
pip install -r requirements.txt

# Install test dependencies
pip install pytest pytest-asyncio pytest-cov pytest-mock httpx faker
```

### Slow Tests
If tests are running slowly:
```bash
# Run with timing information
pytest --durations=10

# Skip slow tests
pytest -m "not slow"
```

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/14/orm/session_transaction.html)
