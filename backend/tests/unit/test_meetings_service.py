"""Unit tests for meetings service write orchestration."""

from types import SimpleNamespace

import pytest

from app.modules.meetings import models
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
class TestMeetingServiceSpeakers:
    def test_add_speaker_persists_via_repository(self, db_session, sample_meeting):
        service = MeetingService(db_session)

        created = service.add_speaker(sample_meeting.id, name="Alice", label="SPEAKER_01")
        speakers = service.get_speakers(sample_meeting.id)

        assert created.id is not None
        assert any(s.id == created.id for s in speakers)
