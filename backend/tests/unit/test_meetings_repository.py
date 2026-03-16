"""Unit tests for meetings repositories."""

from datetime import date, datetime, timedelta

import pytest

from app.modules.meetings import models
from app.modules.meetings.repository import ActionItemRepository


@pytest.mark.unit
class TestActionItemRepositoryUpcoming:
    """Cross-database tests for upcoming action-item queries."""

    def _create_action_item(self, db_session, transcription_id: int, task: str, due_date: str, status: str = "pending"):
        item = models.ActionItem(
            transcription_id=transcription_id,
            task=task,
            owner="owner",
            status=status,
            due_date=due_date,
        )
        db_session.add(item)
        db_session.commit()
        db_session.refresh(item)
        return item

    def _create_meeting_with_transcription(
        self, db_session, filename: str
    ) -> tuple[models.Meeting, models.Transcription]:
        meeting = models.Meeting(
            filename=filename,
            filepath=f"/tmp/{filename}",
            status=models.MeetingStatus.COMPLETED.value,
            meeting_date=date(2024, 1, 15),
        )
        db_session.add(meeting)
        db_session.commit()
        db_session.refresh(meeting)

        transcription = models.Transcription(
            meeting_id=meeting.id,
            summary="summary",
            full_text="transcript",
        )
        db_session.add(transcription)
        db_session.commit()
        db_session.refresh(transcription)
        return meeting, transcription

    def test_get_upcoming_with_meetings_ignores_malformed_due_dates(self, db_session, sample_meeting):
        repo = ActionItemRepository(db_session)
        transcription_id = sample_meeting.transcription.id

        valid_due = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        valid = self._create_action_item(db_session, transcription_id, "valid", valid_due)
        malformed = self._create_action_item(db_session, transcription_id, "bad", "not-a-date")

        items = repo.get_upcoming_with_meetings(before_date=datetime.now() + timedelta(days=14), include_overdue=True)
        returned_ids = {item.id for item, _ in items}

        assert valid.id in returned_ids
        assert malformed.id not in returned_ids

    def test_get_upcoming_with_meetings_respects_now_when_excluding_overdue(self, db_session, sample_meeting):
        repo = ActionItemRepository(db_session)
        transcription_id = sample_meeting.transcription.id

        overdue_due = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        upcoming_due = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        overdue = self._create_action_item(db_session, transcription_id, "overdue", overdue_due)
        upcoming = self._create_action_item(db_session, transcription_id, "upcoming", upcoming_due)

        now = datetime.now()
        items = repo.get_upcoming_with_meetings(
            before_date=now + timedelta(days=14),
            now=now,
            include_overdue=False,
        )
        returned_ids = {item.id for item, _ in items}

        assert upcoming.id in returned_ids
        assert overdue.id not in returned_ids

    def test_get_upcoming_with_meetings_respects_meeting_scope(self, db_session, sample_meeting):
        repo = ActionItemRepository(db_session)
        transcription_id = sample_meeting.transcription.id

        valid_due = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        in_scope = self._create_action_item(db_session, transcription_id, "scoped", valid_due)

        other_meeting, other_transcription = self._create_meeting_with_transcription(db_session, "other_meeting.wav")
        out_scope = self._create_action_item(db_session, other_transcription.id, "other", valid_due)

        items = repo.get_upcoming_with_meetings(
            meeting_ids=[sample_meeting.id],
            before_date=datetime.now() + timedelta(days=14),
            include_overdue=True,
        )
        returned_ids = {item.id for item, _ in items}

        assert in_scope.id in returned_ids
        assert out_scope.id not in returned_ids
        assert other_meeting.id != sample_meeting.id
