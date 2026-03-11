"""
Unit tests for the base repository and exceptions modules.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.base.exceptions import (
    MeetingAssistantError,
    MeetingNotFoundError,
    NotFoundError,
    ProcessingError,
    ValidationError,
)
from app.core.base.repository import BaseRepository, get_or_404

# =====================================================================
# BaseRepository tests
# =====================================================================


@pytest.mark.unit
class TestBaseRepository:
    """Tests for BaseRepository CRUD operations using a mock model."""

    def _make_repo(self):
        model = MagicMock()
        model.__name__ = "FakeModel"
        db = MagicMock()
        return BaseRepository(model, db), model, db

    def test_get_existing(self):
        repo, model, db = self._make_repo()
        fake_obj = MagicMock(id=1)
        db.query.return_value.filter.return_value.first.return_value = fake_obj
        assert repo.get(1) == fake_obj

    def test_get_none(self):
        repo, model, db = self._make_repo()
        db.query.return_value.filter.return_value.first.return_value = None
        assert repo.get(999) is None

    def test_get_or_raise_found(self):
        repo, model, db = self._make_repo()
        fake_obj = MagicMock(id=1)
        db.query.return_value.filter.return_value.first.return_value = fake_obj
        assert repo.get_or_raise(1) == fake_obj

    def test_get_or_raise_not_found(self):
        repo, model, db = self._make_repo()
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(NotFoundError):
            repo.get_or_raise(999)

    def test_get_or_raise_custom_error_class(self):
        repo, model, db = self._make_repo()
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(MeetingNotFoundError):
            repo.get_or_raise(999, error_class=MeetingNotFoundError)

    def test_get_all(self):
        repo, model, db = self._make_repo()
        items = [MagicMock(), MagicMock()]
        db.query.return_value.offset.return_value.limit.return_value.all.return_value = items
        assert repo.get_all(skip=0, limit=10) == items

    def test_create(self):
        repo, model, db = self._make_repo()
        schema_in = MagicMock()
        schema_in.model_dump.return_value = {"name": "test"}
        repo.create(obj_in=schema_in)
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_create_with_dict_fallback(self):
        """When obj_in has neither model_dump nor dict, it should be cast to dict."""
        repo, model, db = self._make_repo()
        schema_in = {"name": "test"}
        repo.create(obj_in=schema_in)
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_update(self):
        repo, model, db = self._make_repo()
        db_obj = MagicMock()
        db_obj.name = "old"
        schema_in = MagicMock()
        schema_in.model_dump.return_value = {"name": "new"}
        repo.update(db_obj=db_obj, obj_in=schema_in)
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_delete_existing(self):
        repo, model, db = self._make_repo()
        fake_obj = MagicMock(id=1)
        db.query.return_value.filter.return_value.first.return_value = fake_obj
        result = repo.delete(id=1)
        db.delete.assert_called_once_with(fake_obj)
        db.commit.assert_called_once()
        assert result == fake_obj

    def test_delete_not_found(self):
        repo, model, db = self._make_repo()
        db.query.return_value.filter.return_value.first.return_value = None
        assert repo.delete(id=999) is None

    def test_exists(self):
        repo, model, db = self._make_repo()
        db.query.return_value.scalar.return_value = True
        assert repo.exists(1) is True

    def test_count_no_filters(self):
        repo, model, db = self._make_repo()
        db.query.return_value.count.return_value = 5
        assert repo.count() == 5

    def test_count_with_filters(self):
        repo, model, db = self._make_repo()
        model.status = "completed"
        db.query.return_value.filter.return_value.count.return_value = 3
        assert repo.count(filters={"status": "completed"}) == 3

    def test_search(self):
        repo, model, db = self._make_repo()
        model.name = MagicMock()
        items = [MagicMock()]
        # Mock the full query chain that search() uses. The or_() call inside
        # search() cannot accept MagicMock objects, so we patch it.
        from unittest.mock import patch

        with patch("app.core.base.repository.or_") as mock_or:
            mock_or.return_value = MagicMock()
            db.query.return_value.filter.return_value.offset.return_value.limit.return_value.all.return_value = items
            result = repo.search(search_term="test", search_columns=["name"], skip=0, limit=10)
            assert result == items
            mock_or.assert_called_once()


# =====================================================================
# get_or_404 helper
# =====================================================================


@pytest.mark.unit
class TestGetOr404:
    def test_found(self):
        db = MagicMock()
        model = MagicMock()
        model.__name__ = "Meeting"
        obj = MagicMock(id=1)
        db.query.return_value.filter.return_value.first.return_value = obj
        assert get_or_404(db, model, 1) == obj

    def test_not_found(self):
        db = MagicMock()
        model = MagicMock()
        model.__name__ = "Meeting"
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            get_or_404(db, model, 999)
        assert exc_info.value.status_code == 404

    def test_custom_message(self):
        db = MagicMock()
        model = MagicMock()
        model.__name__ = "Meeting"
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc_info:
            get_or_404(db, model, 999, error_message="Custom error")
        assert "Custom error" in str(exc_info.value.detail)


# =====================================================================
# Exception hierarchy
# =====================================================================


@pytest.mark.unit
class TestExceptions:
    def test_base_error(self):
        err = MeetingAssistantError("boom")
        assert str(err) == "boom"
        assert err.http_status == 500

    def test_base_error_to_http(self):
        err = MeetingAssistantError("Server error")
        http_exc = err.to_http_exception()
        assert http_exc.status_code == 500

    def test_not_found_error(self):
        err = NotFoundError("Meeting", 42)
        assert "42" in str(err)
        assert err.http_status == 404

    def test_meeting_not_found(self):
        err = MeetingNotFoundError(7)
        assert err.resource_type == "Meeting"
        assert err.resource_id == 7

    def test_validation_error(self):
        err = ValidationError("bad input")
        assert err.http_status == 400

    def test_processing_error(self):
        original = RuntimeError("oops")
        err = ProcessingError("failed", original_error=original)
        assert err.original_error is original

    def test_repr(self):
        err = NotFoundError("User", 5)
        assert "NotFoundError" in repr(err)
