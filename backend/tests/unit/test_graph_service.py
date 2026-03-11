"""
Unit tests for the Graph service.
"""

import pytest

from app.modules.graph.service import extract_meeting_ids_from_notes


@pytest.mark.unit
class TestExtractMeetingIdsFromNotes:
    """Tests for the note-to-meeting reference extraction helper."""

    def test_extract_hash_pattern(self):
        notes = "See #meeting-42 for details."

        class FakeMeeting:
            def __init__(self, mid):
                self.id = mid
                self.filename = f"m{mid}.wav"

        meetings = [FakeMeeting(42), FakeMeeting(99)]
        ids = extract_meeting_ids_from_notes(notes, meetings)
        assert 42 in ids

    def test_extract_no_references(self):
        notes = "Nothing special here."
        ids = extract_meeting_ids_from_notes(notes, [])
        assert ids == []

    def test_extract_empty_notes(self):
        ids = extract_meeting_ids_from_notes("", [])
        assert ids == []

    def test_extract_none_notes(self):
        ids = extract_meeting_ids_from_notes(None, [])
        assert ids == []
