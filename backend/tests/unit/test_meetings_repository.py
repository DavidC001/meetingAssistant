"""Unit tests for meetings repositories."""

from datetime import date, datetime, timedelta

import pytest

from app.modules.meetings import models
from app.modules.meetings.repository import (
    ActionItemRepository,
    MeetingRepository,
    SpeakerRepository,
    TranscriptionRepository,
)


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


@pytest.mark.unit
class TestActionItemRepositoryRenameOwner:
    def _create_action_item(self, db_session, transcription_id: int, owner: str | None, task: str = "task"):
        item = models.ActionItem(transcription_id=transcription_id, task=task, owner=owner)
        db_session.add(item)
        db_session.commit()
        db_session.refresh(item)
        return item

    def test_rename_owner_matches_case_insensitively_and_scopes_to_meeting(self, db_session, sample_meeting):
        repo = ActionItemRepository(db_session)
        transcription_id = sample_meeting.transcription.id

        matching = self._create_action_item(db_session, transcription_id, owner="speaker_00")
        other_owner = self._create_action_item(db_session, transcription_id, owner="Bob")
        no_owner = self._create_action_item(db_session, transcription_id, owner=None)

        # Action item in a different meeting sharing the same owner value must
        # not be touched by a rename scoped to sample_meeting.
        other_meeting = models.Meeting(
            filename="other.wav", filepath="/tmp/other.wav", status=models.MeetingStatus.COMPLETED.value
        )
        db_session.add(other_meeting)
        db_session.commit()
        db_session.refresh(other_meeting)
        other_transcription = models.Transcription(meeting_id=other_meeting.id, summary="s", full_text="t")
        db_session.add(other_transcription)
        db_session.commit()
        db_session.refresh(other_transcription)
        out_of_scope = self._create_action_item(db_session, other_transcription.id, owner="SPEAKER_00")

        updated_count = repo.rename_owner_for_meeting(sample_meeting.id, ["SPEAKER_00"], "Alice")

        db_session.refresh(matching)
        db_session.refresh(other_owner)
        db_session.refresh(no_owner)
        db_session.refresh(out_of_scope)

        assert updated_count == 1
        assert matching.owner == "Alice"
        assert other_owner.owner == "Bob"
        assert no_owner.owner is None
        assert out_of_scope.owner == "SPEAKER_00"

    def test_rename_owner_matches_multiple_old_values(self, db_session, sample_meeting):
        repo = ActionItemRepository(db_session)
        transcription_id = sample_meeting.transcription.id

        by_name = self._create_action_item(db_session, transcription_id, owner="Alice")
        by_label = self._create_action_item(db_session, transcription_id, owner="SPEAKER_00")

        updated_count = repo.rename_owner_for_meeting(sample_meeting.id, ["Alice", "SPEAKER_00"], "Bob")

        db_session.refresh(by_name)
        db_session.refresh(by_label)

        assert updated_count == 2
        assert by_name.owner == "Bob"
        assert by_label.owner == "Bob"

    def test_rename_owner_no_matches_returns_zero(self, db_session, sample_meeting):
        repo = ActionItemRepository(db_session)
        updated_count = repo.rename_owner_for_meeting(sample_meeting.id, ["Nobody"], "Alice")
        assert updated_count == 0


@pytest.mark.unit
class TestTranscriptionRepositoryTextFields:
    def test_update_text_fields_updates_only_provided_fields(self, db_session, sample_meeting):
        repo = TranscriptionRepository(db_session)
        transcription_id = sample_meeting.transcription.id

        updated = repo.update_text_fields(transcription_id, summary="New summary only")

        assert updated.summary == "New summary only"
        assert updated.full_text == "Test transcript content"

        updated = repo.update_text_fields(transcription_id, full_text="New transcript only")

        assert updated.full_text == "New transcript only"
        assert updated.summary == "New summary only"

    def test_update_text_fields_missing_transcription_returns_none(self, db_session):
        repo = TranscriptionRepository(db_session)
        assert repo.update_text_fields(999999, summary="x") is None


@pytest.mark.unit
class TestSpeakerRepository:
    def test_get_by_meeting_id_scopes_to_meeting(self, db_session, sample_meeting):
        repo = SpeakerRepository(db_session)
        other_meeting = models.Meeting(
            filename="other.wav", filepath="/tmp/other.wav", status=models.MeetingStatus.COMPLETED.value
        )
        db_session.add(other_meeting)
        db_session.commit()
        db_session.refresh(other_meeting)

        in_scope = repo.create_for_meeting(sample_meeting.id, name="SPEAKER_00", label="SPEAKER_00")
        repo.create_for_meeting(other_meeting.id, name="SPEAKER_00", label="SPEAKER_00")

        speakers = repo.get_by_meeting_id(sample_meeting.id)

        assert [s.id for s in speakers] == [in_scope.id]


@pytest.mark.unit
class TestMeetingRepositoryFolderTitles:
    def _create_completed_meeting(self, db_session, filename: str, folder: str, title: str | None = None):
        meeting = models.Meeting(
            filename=filename,
            filepath=f"/tmp/{filename}",
            title=title,
            status=models.MeetingStatus.COMPLETED.value,
            folder=folder,
        )
        db_session.add(meeting)
        db_session.commit()
        db_session.refresh(meeting)
        return meeting

    def test_get_titles_by_folder_groups_and_falls_back_to_filename(self, db_session):
        repo = MeetingRepository(db_session)
        self._create_completed_meeting(db_session, "standup1.wav", "Team Sync", title="Daily Standup")
        self._create_completed_meeting(db_session, "standup2.wav", "Team Sync", title=None)
        self._create_completed_meeting(db_session, "budget.wav", "Finance", title="Budget Review")

        result = repo.get_titles_by_folder()

        assert set(result["Team Sync"]) == {"Daily Standup", "standup2.wav"}
        assert result["Finance"] == ["Budget Review"]

    def test_get_titles_by_folder_respects_limit_per_folder(self, db_session):
        repo = MeetingRepository(db_session)
        for i in range(5):
            self._create_completed_meeting(db_session, f"m{i}.wav", "Big Folder", title=f"Meeting {i}")

        result = repo.get_titles_by_folder(limit_per_folder=2)

        assert len(result["Big Folder"]) == 2


@pytest.mark.unit
class TestTranscriptionDuplication:
    """
    A meeting has exactly one transcription. Reprocessing used to INSERT a second row
    instead of reusing it, which left the earlier one orphaned but still referencing the
    meeting -- and since Meeting.transcription is uselist=False, the ORM cascade only
    reached one of them, so deleting the meeting failed on transcriptions_meeting_id_fkey.
    """

    def _transcription_data(self, summary="S", full_text="T"):
        from app.modules.meetings import schemas

        return schemas.TranscriptionCreate(summary=summary, full_text=full_text)

    def _action_item(self, task):
        from app.modules.meetings import schemas

        return schemas.ActionItemCreate(task=task, owner="SPEAKER_00")

    def test_reprocessing_reuses_the_existing_transcription(self, db_session, sample_meeting):
        repo = TranscriptionRepository(db_session)

        first = repo.create_with_action_items(
            sample_meeting.id, self._transcription_data("first", "text one"), [self._action_item("a")]
        )
        second = repo.create_with_action_items(
            sample_meeting.id, self._transcription_data("second", "text two"), [self._action_item("b")]
        )

        rows = repo.get_all_for_meeting(sample_meeting.id)
        assert len(rows) == 1, "reprocessing must not leave a second transcription behind"
        assert first.id == second.id
        assert rows[0].summary == "second"
        assert rows[0].full_text == "text two"

    def test_reprocessing_replaces_the_previous_runs_action_items(self, db_session, sample_meeting):
        repo = TranscriptionRepository(db_session)

        repo.create_with_action_items(
            sample_meeting.id,
            self._transcription_data(),
            [self._action_item("stale one"), self._action_item("stale two")],
        )
        transcription = repo.create_with_action_items(
            sample_meeting.id, self._transcription_data(), [self._action_item("fresh")]
        )

        db_session.refresh(transcription)
        assert [item.task for item in transcription.action_items] == ["fresh"]

    def test_a_second_transcription_for_a_meeting_is_rejected(self, db_session, sample_meeting):
        # The unique constraint added in migration 009 is what makes the duplicate state
        # structurally impossible, rather than merely avoided by the repository.
        from sqlalchemy.exc import IntegrityError

        # Nested so the rollback undoes only this savepoint; the fixture owns the outer
        # transaction and rolling that back breaks its teardown.
        savepoint = db_session.begin_nested()
        db_session.add(models.Transcription(meeting_id=sample_meeting.id, summary="dupe", full_text="dupe"))
        with pytest.raises(IntegrityError):
            db_session.flush()
        savepoint.rollback()

    def test_delete_meeting_removes_its_transcription_and_action_items(self, db_session, sample_meeting):
        transcription = TranscriptionRepository(db_session).get_by_meeting(sample_meeting.id)
        db_session.add(models.ActionItem(transcription_id=transcription.id, task="item", owner="SPEAKER_00"))
        db_session.commit()
        transcription_id = transcription.id
        meeting_id = sample_meeting.id

        MeetingRepository(db_session).delete_meeting(meeting_id)

        assert MeetingRepository(db_session).get(meeting_id) is None
        assert TranscriptionRepository(db_session).get_all_for_meeting(meeting_id) == []
        assert (
            db_session.query(models.ActionItem).filter(models.ActionItem.transcription_id == transcription_id).count()
            == 0
        )
