"""Unit tests for meetings service write orchestration."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.modules.meetings import models, schemas
from app.modules.meetings.service import MeetingService


class _DummyProcessTask:
    def __init__(self):
        self.calls: list[int] = []

    def delay(self, meeting_id: int):
        self.calls.append(meeting_id)
        return SimpleNamespace(id=f"task-{meeting_id}")


@pytest.mark.unit
class TestMeetingServiceDispatch:
    def test_dispatch_processing_updates_task_id(self, db_session, sample_meeting, monkeypatch):
        from app import tasks

        dummy_task = _DummyProcessTask()
        monkeypatch.setattr(tasks, "process_meeting_task", dummy_task)

        service = MeetingService(db_session)
        task_id = service._dispatch_processing(sample_meeting.id)

        refreshed = service.get_meeting_or_404(sample_meeting.id)
        assert task_id == f"task-{sample_meeting.id}"
        assert refreshed.celery_task_id == task_id
        assert dummy_task.calls == [sample_meeting.id]

    def test_restart_processing_dispatches_new_task(self, db_session, sample_meeting, monkeypatch):
        from app import tasks

        dummy_task = _DummyProcessTask()
        monkeypatch.setattr(tasks, "process_meeting_task", dummy_task)

        sample_meeting.status = models.MeetingStatus.FAILED.value
        db_session.commit()

        service = MeetingService(db_session)
        updated = service.restart_processing(sample_meeting.id)

        assert updated.status == models.MeetingStatus.PENDING.value
        assert updated.celery_task_id == f"task-{sample_meeting.id}"
        assert dummy_task.calls == [sample_meeting.id]

    def test_retry_analysis_dispatches_new_task(self, db_session, sample_meeting, monkeypatch):
        from app import tasks

        dummy_task = _DummyProcessTask()
        monkeypatch.setattr(tasks, "process_meeting_task", dummy_task)

        sample_meeting.status = models.MeetingStatus.FAILED.value
        db_session.commit()

        service = MeetingService(db_session)
        updated = service.retry_analysis(sample_meeting.id)

        assert updated.status == models.MeetingStatus.PROCESSING.value
        assert updated.celery_task_id == f"task-{sample_meeting.id}"
        assert dummy_task.calls == [sample_meeting.id]


@pytest.mark.unit
class TestMeetingServiceUpdate:
    def test_update_meeting_persists_title(self, db_session, sample_meeting):
        service = MeetingService(db_session)

        updated = service.update_meeting(sample_meeting.id, schemas.MeetingUpdate(title="Q3 Budget Review"))

        assert updated.title == "Q3 Budget Review"

    def test_update_meeting_does_not_touch_title_when_unset(self, db_session, sample_meeting):
        sample_meeting.title = "Existing Title"
        db_session.commit()
        service = MeetingService(db_session)

        updated = service.update_meeting(sample_meeting.id, schemas.MeetingUpdate(folder="Finance"))

        assert updated.title == "Existing Title"
        assert updated.folder == "Finance"

    def test_update_meeting_updates_summary(self, db_session, sample_meeting):
        service = MeetingService(db_session)

        updated = service.update_meeting(sample_meeting.id, schemas.MeetingUpdate(summary="Corrected summary text."))

        assert updated.transcription.summary == "Corrected summary text."
        # full_text must be untouched by a summary-only update
        assert updated.transcription.full_text == "Test transcript content"

    def test_update_meeting_summary_without_transcription_raises(self, db_session):
        meeting = models.Meeting(
            filename="no_transcription.wav",
            filepath="/tmp/no_transcription.wav",
            status=models.MeetingStatus.PROCESSING.value,
        )
        db_session.add(meeting)
        db_session.commit()
        db_session.refresh(meeting)

        service = MeetingService(db_session)

        with pytest.raises(HTTPException) as exc_info:
            service.update_meeting(meeting.id, schemas.MeetingUpdate(summary="Too early"))
        assert exc_info.value.status_code == 400


@pytest.mark.unit
class TestMeetingServiceSpeakers:
    def test_add_speaker_persists_via_repository(self, db_session, sample_meeting):
        service = MeetingService(db_session)

        created = service.add_speaker(sample_meeting.id, name="Alice", label="SPEAKER_01")
        speakers = service.get_speakers(sample_meeting.id)

        assert created.id is not None
        assert any(s.id == created.id for s in speakers)

    def _make_speaker(self, db_session, meeting_id, name, label):
        speaker = models.Speaker(meeting_id=meeting_id, name=name, label=label)
        db_session.add(speaker)
        db_session.commit()
        db_session.refresh(speaker)
        return speaker

    def _make_action_item(self, db_session, transcription_id, owner, task="Follow up"):
        item = models.ActionItem(transcription_id=transcription_id, task=task, owner=owner)
        db_session.add(item)
        db_session.commit()
        db_session.refresh(item)
        return item

    def test_update_speaker_renames_transcript_summary_and_action_items(self, db_session, sample_meeting):
        sample_meeting.transcription.full_text = "SPEAKER_00: Hello everyone, let's begin."
        sample_meeting.transcription.summary = "SPEAKER_00 opened the meeting and set the agenda."
        db_session.commit()

        speaker = self._make_speaker(db_session, sample_meeting.id, "SPEAKER_00", "SPEAKER_00")
        action_item = self._make_action_item(db_session, sample_meeting.transcription.id, owner="SPEAKER_00")

        service = MeetingService(db_session)
        updated_speaker = service.update_speaker(speaker.id, "Alice", "SPEAKER_00")

        assert updated_speaker.name == "Alice"

        db_session.refresh(sample_meeting.transcription)
        db_session.refresh(action_item)

        assert sample_meeting.transcription.full_text == "Alice: Hello everyone, let's begin."
        assert sample_meeting.transcription.summary == "Alice opened the meeting and set the agenda."
        assert action_item.owner == "Alice"

    def test_update_speaker_is_idempotent_across_double_rename(self, db_session, sample_meeting):
        sample_meeting.transcription.full_text = "SPEAKER_00: Hello everyone."
        sample_meeting.transcription.summary = "SPEAKER_00 opened the meeting."
        db_session.commit()

        speaker = self._make_speaker(db_session, sample_meeting.id, "SPEAKER_00", "SPEAKER_00")
        action_item = self._make_action_item(db_session, sample_meeting.transcription.id, owner="SPEAKER_00")

        service = MeetingService(db_session)

        # First rename: SPEAKER_00 -> Alice. The frontend preserves the existing
        # label when only the display name changes, so label stays "SPEAKER_00".
        service.update_speaker(speaker.id, "Alice", "SPEAKER_00")
        # Second rename: Alice -> Bob.
        service.update_speaker(speaker.id, "Bob", "SPEAKER_00")

        db_session.refresh(sample_meeting.transcription)
        db_session.refresh(action_item)
        db_session.refresh(speaker)

        assert speaker.name == "Bob"
        assert sample_meeting.transcription.full_text == "Bob: Hello everyone."
        assert sample_meeting.transcription.summary == "Bob opened the meeting."
        assert action_item.owner == "Bob"
        # No leftover trace of either previous value.
        assert "Alice" not in sample_meeting.transcription.full_text
        assert "SPEAKER_00" not in sample_meeting.transcription.full_text

    def test_update_speaker_rename_is_word_boundary_safe(self, db_session, sample_meeting):
        # SPEAKER_0 is a prefix of SPEAKER_01 — renaming the former must not
        # corrupt mentions of the latter anywhere in the transcript or summary.
        sample_meeting.transcription.full_text = "SPEAKER_0: Hi there\nSPEAKER_01: Hello back"
        sample_meeting.transcription.summary = "SPEAKER_0 greeted SPEAKER_01 at the start of the call."
        db_session.commit()

        speaker = self._make_speaker(db_session, sample_meeting.id, "SPEAKER_0", "SPEAKER_0")

        service = MeetingService(db_session)
        service.update_speaker(speaker.id, "Nick", "SPEAKER_0")

        db_session.refresh(sample_meeting.transcription)

        assert sample_meeting.transcription.full_text == "Nick: Hi there\nSPEAKER_01: Hello back"
        assert sample_meeting.transcription.summary == "Nick greeted SPEAKER_01 at the start of the call."
