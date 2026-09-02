"""Unit tests for the one-shot LLM transcript analysis module."""

from unittest.mock import AsyncMock

import pytest

from app.core.llm import analysis
from app.core.llm.analysis import AnalysisPrompts, normalize_action_items
from app.core.llm.providers import LLMConfig


@pytest.mark.unit
class TestBuildSystemPrompt:
    def test_includes_known_persons_and_speaker_labels(self):
        prompt = AnalysisPrompts.build_system_prompt(
            known_persons=["Alice Smith", "Bob Jones"],
            speaker_labels=["SPEAKER_00", "SPEAKER_01"],
        )

        assert "Alice Smith" in prompt
        assert "Bob Jones" in prompt
        assert "SPEAKER_00" in prompt
        assert "SPEAKER_01" in prompt
        assert '"speakers"' in prompt
        assert '"sentiment"' in prompt
        assert '"keywords"' in prompt
        assert '"topic"' in prompt
        assert '"title"' in prompt
        assert '"tags"' in prompt
        assert '"folder"' in prompt

    def test_falls_back_gracefully_without_known_context(self):
        prompt = AnalysisPrompts.build_system_prompt(known_persons=None, speaker_labels=None)

        assert "No known participant roster was provided" in prompt
        assert "Use the speaker labels exactly as they appear" in prompt
        assert "No tags exist yet" in prompt
        assert "No folders exist yet" in prompt

    def test_includes_existing_tags_folders_and_projects(self):
        prompt = AnalysisPrompts.build_system_prompt(
            existing_tags=["budget", "hiring"],
            existing_folders={"Q3 Planning": ["Kickoff sync", "Budget review"]},
            projects=[{"name": "Alpha Launch", "description": "New product launch", "tags": ["alpha", "launch"]}],
        )

        assert "budget" in prompt
        assert "hiring" in prompt
        assert "Q3 Planning" in prompt
        assert "Kickoff sync" in prompt
        assert "Alpha Launch" in prompt
        assert "New product launch" in prompt
        assert "alpha, launch" in prompt
        assert "automatically linked to that project" in prompt

    def test_action_item_instructions_require_owner_and_priority(self):
        prompt = AnalysisPrompts.build_system_prompt()

        assert "Every action item must have an owner" in prompt
        assert 'use "medium" if there is no clear signal' in prompt

    def test_includes_meeting_date_for_relative_due_date_resolution(self):
        prompt = AnalysisPrompts.build_system_prompt(meeting_date="2024-01-15")

        assert "This meeting took place on 2024-01-15" in prompt
        assert "resolve it against this date" in prompt

    def test_omits_meeting_date_block_when_not_provided(self):
        prompt = AnalysisPrompts.build_system_prompt(meeting_date=None)

        assert "This meeting took place on" not in prompt


@pytest.mark.unit
class TestAnalyseMeeting:
    def _mock_provider(self, monkeypatch, return_value=None, side_effect=None):
        fake_provider = AsyncMock()
        if side_effect is not None:
            fake_provider.analyze_transcript.side_effect = side_effect
        else:
            fake_provider.analyze_transcript.return_value = return_value

        monkeypatch.setattr(analysis.ProviderFactory, "create_provider", lambda config: fake_provider, raising=True)
        return fake_provider

    def test_parses_full_response_in_one_shot(self, monkeypatch):
        llm_response = {
            "title": "Q3 Roadmap Kickoff",
            "summary": ["Discussed Q3 roadmap", "Agreed on hiring plan"],
            "topic": "Q3 Planning",
            "keywords": ["roadmap", "hiring", "budget"],
            "tags": ["roadmap", "hiring"],
            "folder": "Q3 Planning",
            "decisions": ["Approved the new hire"],
            "action_items": [
                {"task": "Send offer letter", "owner": "Alice Smith", "due_date": "2024-02-01", "priority": "high"}
            ],
            "sentiment": {"overall": "positive", "confidence": 0.8, "rationale": "Team was upbeat"},
            "speakers": {"SPEAKER_00": "Alice Smith", "SPEAKER_01": None},
        }
        self._mock_provider(monkeypatch, return_value=llm_response)

        result = analysis.analyse_meeting(
            "SPEAKER_00: Hi, I'm Alice.",
            llm_config=LLMConfig(provider="openai", model="gpt-4o-mini", api_key="key"),
            known_persons=["Alice Smith"],
            speaker_labels=["SPEAKER_00", "SPEAKER_01"],
            existing_tags=["roadmap"],
            existing_folders={"Q3 Planning": ["Kickoff sync"]},
            projects=[{"name": "Alpha Launch", "description": "Launch project", "tags": ["roadmap"]}],
        )

        assert result["success"] is True
        assert result["title"] == "Q3 Roadmap Kickoff"
        assert result["summary"] == llm_response["summary"]
        assert result["topic"] == "Q3 Planning"
        assert result["keywords"] == ["roadmap", "hiring", "budget"]
        assert result["tags"] == ["roadmap", "hiring"]
        assert result["folder"] == "Q3 Planning"
        assert result["decisions"] == ["Approved the new hire"]
        assert result["action_items"][0]["owner"] == "Alice Smith"
        assert result["sentiment"]["overall"] == "positive"
        assert result["speakers"]["SPEAKER_00"] == "Alice Smith"
        assert result["speakers"]["SPEAKER_01"] is None

    def test_failure_returns_safe_defaults(self, monkeypatch):
        self._mock_provider(monkeypatch, side_effect=RuntimeError("provider unavailable"))

        result = analysis.analyse_meeting(
            "transcript text",
            llm_config=LLMConfig(provider="openai", model="gpt-4o-mini", api_key="key"),
        )

        assert result["success"] is False
        assert result["error"] == "provider unavailable"
        assert result["title"] is None
        assert result["action_items"] == []
        assert result["decisions"] == []
        assert result["keywords"] == []
        assert result["tags"] == []
        assert result["folder"] is None
        assert result["speakers"] == {}
        assert result["sentiment"]["overall"] == "neutral"

    def test_defaults_applied_when_owner_priority_and_due_date_missing(self, monkeypatch):
        """A weak/local model that omits owner, due_date and priority should still yield a
        usable action item: owner falls back to a known speaker, priority defaults to
        'medium', and a missing due_date stays null (the prompt tried, nothing was stated)."""
        llm_response = {
            "action_items": [{"task": "Send the deck to the team"}],
            "speakers": {"SPEAKER_00": "Alice Smith", "SPEAKER_01": None},
        }
        self._mock_provider(monkeypatch, return_value=llm_response)

        result = analysis.analyse_meeting(
            "SPEAKER_00: I'll send the deck.\nSPEAKER_00: Let's do it today.\nSPEAKER_01: Sounds good.",
            llm_config=LLMConfig(provider="openai", model="gpt-4o-mini", api_key="key"),
            speaker_labels=["SPEAKER_00", "SPEAKER_01"],
        )

        assert result["success"] is True
        item = result["action_items"][0]
        # SPEAKER_00 has more turns in the transcript and was identified as Alice Smith.
        assert item["owner"] == "Alice Smith"
        assert item["priority"] == "medium"
        assert item["due_date"] is None

    def test_owner_not_in_speaker_list_falls_back(self, monkeypatch):
        """If the model hallucinates a name that isn't a known speaker label or known
        person, it must not pass through — it should fall back to a legitimate owner."""
        llm_response = {
            "action_items": [{"task": "Follow up with legal", "owner": "Some Random Guy", "priority": "high"}],
            "speakers": {"SPEAKER_00": None},
        }
        self._mock_provider(monkeypatch, return_value=llm_response)

        result = analysis.analyse_meeting(
            "SPEAKER_00: I'll follow up with legal.",
            llm_config=LLMConfig(provider="openai", model="gpt-4o-mini", api_key="key"),
            speaker_labels=["SPEAKER_00"],
        )

        item = result["action_items"][0]
        assert item["owner"] != "Some Random Guy"
        assert item["owner"] == "SPEAKER_00"
        assert item["priority"] == "high"

    def test_malformed_due_date_does_not_raise(self, monkeypatch):
        llm_response = {
            "action_items": [
                {"task": "Bad date", "owner": "SPEAKER_00", "due_date": "2024-13-40"},
                {"task": "Wrong type", "owner": "SPEAKER_00", "due_date": 12345},
                {"task": "Natural language ok", "owner": "SPEAKER_00", "due_date": "end of next month"},
            ],
        }
        self._mock_provider(monkeypatch, return_value=llm_response)

        result = analysis.analyse_meeting(
            "SPEAKER_00: some talk",
            llm_config=LLMConfig(provider="openai", model="gpt-4o-mini", api_key="key"),
            speaker_labels=["SPEAKER_00"],
        )

        assert result["success"] is True
        items = result["action_items"]
        assert items[0]["due_date"] is None  # invalid calendar date discarded, not raised
        assert items[1]["due_date"] is None  # wrong type discarded, not raised
        assert items[2]["due_date"] == "end of next month"  # natural-language fallback kept


@pytest.mark.unit
class TestNormalizeActionItems:
    def test_full_response_preserved_when_owner_is_valid(self):
        items = normalize_action_items(
            [{"task": "Send offer letter", "owner": "Alice Smith", "due_date": "2024-02-01", "priority": "high"}],
            transcript="SPEAKER_00: Hi, I'm Alice.",
            speaker_labels=["SPEAKER_00", "SPEAKER_01"],
            known_persons=["Alice Smith"],
            identified_speakers={"SPEAKER_00": "Alice Smith"},
        )

        assert items == [
            {"task": "Send offer letter", "owner": "Alice Smith", "due_date": "2024-02-01", "priority": "high"}
        ]

    def test_missing_fields_get_defaults(self):
        items = normalize_action_items(
            [{"task": "Do the thing"}],
            transcript="SPEAKER_00: I'll do it.\nSPEAKER_00: Yes.\nSPEAKER_01: OK.",
            speaker_labels=["SPEAKER_00", "SPEAKER_01"],
        )

        assert items[0]["owner"] == "SPEAKER_00"  # most frequent speaker in the transcript
        assert items[0]["priority"] == "medium"
        assert items[0]["due_date"] is None

    def test_owner_outside_known_speakers_falls_back_to_default(self):
        items = normalize_action_items(
            [{"task": "Do the thing", "owner": "Nobody Knows"}],
            transcript="SPEAKER_00: line one.\nSPEAKER_01: line two.\nSPEAKER_01: line three.",
            speaker_labels=["SPEAKER_00", "SPEAKER_01"],
        )

        assert items[0]["owner"] == "SPEAKER_01"  # most frequent speaker, never the hallucinated name

    def test_no_speakers_available_leaves_owner_null_rather_than_inventing(self):
        items = normalize_action_items(
            [{"task": "Do the thing", "owner": "Ghost"}],
            transcript="no speaker labels in this transcript",
            speaker_labels=[],
            known_persons=[],
        )

        assert items[0]["owner"] is None

    def test_malformed_due_date_is_discarded_not_raised(self):
        items = normalize_action_items(
            [
                {"task": "a", "due_date": "not-a-date"},
                {"task": "b", "due_date": "2024-02-30"},  # Feb 30 doesn't exist
                {"task": "c", "due_date": ["2024-02-01"]},  # wrong type
                {"task": "d", "due_date": "2024-02-01"},
            ],
            transcript="",
            speaker_labels=[],
        )

        assert items[0]["due_date"] == "not-a-date"  # kept as natural-language fallback text
        assert items[1]["due_date"] is None  # invalid calendar date
        assert items[2]["due_date"] is None  # wrong type
        assert items[3]["due_date"] == "2024-02-01"

    def test_priority_defaults_to_medium_when_invalid_or_missing(self):
        items = normalize_action_items(
            [
                {"task": "a", "priority": "urgent"},
                {"task": "b", "priority": None},
                {"task": "c"},
                {"task": "d", "priority": "LOW"},
            ],
            transcript="",
            speaker_labels=[],
        )

        assert [i["priority"] for i in items] == ["medium", "medium", "medium", "low"]

    def test_non_dict_action_items_are_skipped_not_raised(self):
        items = normalize_action_items(
            ["just a string", {"task": "valid item"}, None, 42],
            transcript="",
            speaker_labels=[],
        )

        assert len(items) == 1
        assert items[0]["task"] == "valid item"
