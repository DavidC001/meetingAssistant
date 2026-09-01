"""Unit tests for transcript formatting / speaker-name substitution helpers."""

import pytest

from app.core.processing.transcript_formatter import (
    replace_speaker_mentions,
    update_speaker_name_in_transcript,
)


@pytest.mark.unit
class TestUpdateSpeakerNameInTranscript:
    def test_replaces_simple_colon_format(self):
        transcript = "SPEAKER_00: Hello everyone.\nSPEAKER_01: Hi there."
        result = update_speaker_name_in_transcript(transcript, "SPEAKER_00", "Alice")
        assert result == "Alice: Hello everyone.\nSPEAKER_01: Hi there."

    def test_replaces_timestamp_format(self):
        transcript = "SPEAKER_00 (0.03s - 2.88s): Hello everyone."
        result = update_speaker_name_in_transcript(transcript, "SPEAKER_00", "Alice")
        assert result == "Alice (0.03s - 2.88s): Hello everyone."

    def test_word_boundary_safe_prefix_label(self):
        # SPEAKER_0 is a prefix of SPEAKER_01 and must not corrupt it.
        transcript = "SPEAKER_0: Hi there\nSPEAKER_01: Hello back"
        result = update_speaker_name_in_transcript(transcript, "SPEAKER_0", "Nick")
        assert result == "Nick: Hi there\nSPEAKER_01: Hello back"

    def test_noop_for_missing_speaker(self):
        transcript = "SPEAKER_00: Hello everyone."
        result = update_speaker_name_in_transcript(transcript, "SPEAKER_99", "Alice")
        assert result == transcript

    def test_handles_none_and_empty_inputs(self):
        assert update_speaker_name_in_transcript("", "SPEAKER_00", "Alice") == ""
        assert update_speaker_name_in_transcript(None, "SPEAKER_00", "Alice") is None
        assert update_speaker_name_in_transcript("text", "", "Alice") == "text"
        assert update_speaker_name_in_transcript("text", "SPEAKER_00", "") == "text"


@pytest.mark.unit
class TestReplaceSpeakerMentions:
    def test_replaces_mention_in_free_text(self):
        summary = "SPEAKER_00 opened the meeting and set the agenda."
        result = replace_speaker_mentions(summary, "SPEAKER_00", "Alice")
        assert result == "Alice opened the meeting and set the agenda."

    def test_replaces_multiple_mentions(self):
        summary = "SPEAKER_00 spoke first. Later, SPEAKER_00 summarized the decisions."
        result = replace_speaker_mentions(summary, "SPEAKER_00", "Alice")
        assert result == "Alice spoke first. Later, Alice summarized the decisions."

    def test_replaces_mention_in_parentheses(self):
        summary = "The plan (proposed by SPEAKER_00) was approved."
        result = replace_speaker_mentions(summary, "SPEAKER_00", "Alice")
        assert result == "The plan (proposed by Alice) was approved."

    def test_word_boundary_safe_prefix_label(self):
        # SPEAKER_0 must not match inside SPEAKER_01.
        summary = "SPEAKER_0 greeted SPEAKER_01 at the start of the call."
        result = replace_speaker_mentions(summary, "SPEAKER_0", "Nick")
        assert result == "Nick greeted SPEAKER_01 at the start of the call."

    def test_word_boundary_safe_does_not_match_within_longer_word(self):
        summary = "The SPEAKER_001 device was mentioned."
        result = replace_speaker_mentions(summary, "SPEAKER_00", "Alice")
        assert result == summary

    def test_noop_when_old_and_new_are_equal(self):
        summary = "Alice spoke first."
        assert replace_speaker_mentions(summary, "Alice", "Alice") == summary

    def test_handles_none_and_empty_inputs(self):
        assert replace_speaker_mentions("", "SPEAKER_00", "Alice") == ""
        assert replace_speaker_mentions(None, "SPEAKER_00", "Alice") is None
        assert replace_speaker_mentions("text", "", "Alice") == "text"
        assert replace_speaker_mentions("text", "SPEAKER_00", "") == "text"
