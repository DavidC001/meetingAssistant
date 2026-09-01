"""
Unit tests for the Graph service.
"""

from datetime import date

import pytest

from app.models import Meeting, Speaker
from app.modules.graph.service import GraphService, extract_meeting_ids_from_notes


@pytest.mark.unit
class TestGetGraphData:
    """Tests for GraphService.get_graph_data against real repository/DB fixtures."""

    def test_returns_nodes_for_completed_meeting_with_speakers(self, db_session, sample_meeting):
        """A completed meeting with speakers should show up as a meeting node
        plus one person node per distinct speaker, linked by has_participant edges."""
        speaker = Speaker(meeting_id=sample_meeting.id, name="Alice Johnson")
        db_session.add(speaker)
        db_session.commit()

        data = GraphService(db_session).get_graph_data()

        assert data["nodes"], "expected at least one node for a completed meeting with speakers"
        meeting_nodes = [n for n in data["nodes"] if n["type"] == "meeting"]
        person_nodes = [n for n in data["nodes"] if n["type"] == "person"]
        assert len(meeting_nodes) == 1
        assert meeting_nodes[0]["id"] == f"meeting-{sample_meeting.id}"
        assert len(person_nodes) == 1
        assert person_nodes[0]["label"] == "Alice Johnson"

        has_participant_edges = [e for e in data["edges"] if e["type"] == "has_participant"]
        assert len(has_participant_edges) == 1
        assert has_participant_edges[0]["source"] == f"meeting-{sample_meeting.id}"
        assert has_participant_edges[0]["target"] == person_nodes[0]["id"]

        assert data["stats"]["meetings"] == 1
        assert data["stats"]["people"] == 1

    def test_excludes_non_completed_meetings(self, db_session):
        """Meetings whose status isn't 'completed' must not appear in the graph."""
        pending_meeting = Meeting(
            filename="pending.wav",
            filepath="/tmp/pending.wav",
            audio_filepath="/tmp/pending.wav",
            status="pending",
            meeting_date=date(2024, 1, 15),
        )
        db_session.add(pending_meeting)
        db_session.commit()

        data = GraphService(db_session).get_graph_data()

        assert data["nodes"] == []
        assert data["edges"] == []
        assert data["stats"]["meetings"] == 0

    def test_empty_dataset_returns_empty_graph(self, db_session):
        """No meetings at all should yield an empty (not erroring) payload."""
        data = GraphService(db_session).get_graph_data()

        assert data == {
            "nodes": [],
            "edges": [],
            "stats": {"meetings": 0, "people": 0, "folders": 0, "tags": 0, "relationships": 0},
        }


@pytest.mark.unit
class TestExtractMeetingIdsFromNotes:
    """Tests for the note-to-meeting reference extraction helper."""

    def test_extract_hash_pattern(self):
        notes = "See #meeting-42 for details."

        class FakeMeeting:
            def __init__(self, mid):
                self.id = mid
                self.filename = f"m{mid}.wav"
                self.title = None

        meetings = [FakeMeeting(42), FakeMeeting(99)]
        ids = extract_meeting_ids_from_notes(notes, meetings)
        assert 42 in ids

    def test_extract_matches_by_title(self):
        notes = "Follow-up from the Q3 Budget Review meeting."

        class FakeMeeting:
            def __init__(self, mid, title=None, filename=None):
                self.id = mid
                self.title = title
                self.filename = filename

        meetings = [
            FakeMeeting(1, title="Q3 Budget Review", filename="rec001.wav"),
            FakeMeeting(2, title="Unrelated Sync", filename="rec002.wav"),
        ]
        ids = extract_meeting_ids_from_notes(notes, meetings)
        assert ids == [1]

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
