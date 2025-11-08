"""
Tests for transcript formatting utilities.
"""
import pytest
from backend.app.core.transcript_formatter import (
    format_transcript_grouped,
    convert_old_transcript_format,
    update_speaker_name_in_transcript
)


def test_format_transcript_grouped_basic():
    """Test basic grouping of consecutive speakers."""
    results = [
        {"speaker": "SPEAKER_00", "start": 0.0, "end": 2.0, "text": "Hello"},
        {"speaker": "SPEAKER_00", "start": 2.5, "end": 4.0, "text": "world"},
        {"speaker": "SPEAKER_01", "start": 4.5, "end": 6.0, "text": "Hi there"},
    ]
    
    expected = "SPEAKER_00: Hello world\nSPEAKER_01: Hi there"
    assert format_transcript_grouped(results) == expected


def test_format_transcript_grouped_multiple_speakers():
    """Test grouping with multiple speaker changes."""
    results = [
        {"speaker": "Alice", "start": 0.0, "end": 2.0, "text": "First"},
        {"speaker": "Alice", "start": 2.5, "end": 4.0, "text": "Second"},
        {"speaker": "Bob", "start": 4.5, "end": 6.0, "text": "Third"},
        {"speaker": "Alice", "start": 6.5, "end": 8.0, "text": "Fourth"},
        {"speaker": "Alice", "start": 8.5, "end": 10.0, "text": "Fifth"},
    ]
    
    expected = "Alice: First Second\nBob: Third\nAlice: Fourth Fifth"
    assert format_transcript_grouped(results) == expected


def test_format_transcript_grouped_empty():
    """Test with empty results."""
    assert format_transcript_grouped([]) == ""


def test_format_transcript_grouped_empty_text():
    """Test filtering out empty text."""
    results = [
        {"speaker": "SPEAKER_00", "start": 0.0, "end": 2.0, "text": "Hello"},
        {"speaker": "SPEAKER_00", "start": 2.5, "end": 4.0, "text": ""},
        {"speaker": "SPEAKER_00", "start": 4.5, "end": 6.0, "text": "world"},
    ]
    
    expected = "SPEAKER_00: Hello world"
    assert format_transcript_grouped(results) == expected


def test_format_transcript_grouped_unordered():
    """Test that results are sorted by start time."""
    results = [
        {"speaker": "SPEAKER_00", "start": 4.0, "end": 6.0, "text": "Third"},
        {"speaker": "SPEAKER_00", "start": 0.0, "end": 2.0, "text": "First"},
        {"speaker": "SPEAKER_00", "start": 2.0, "end": 4.0, "text": "Second"},
    ]
    
    expected = "SPEAKER_00: First Second Third"
    assert format_transcript_grouped(results) == expected


def test_convert_old_transcript_format_basic():
    """Test conversion from old format to new."""
    old = """Fausto Giunchiglia (0.03s - 2.88s): E' una figata, capito?
Fausto Giunchiglia (3.54s - 6.12s): E' girag.
John Doe (7.00s - 9.00s): That makes sense."""
    
    expected = """Fausto Giunchiglia: E' una figata, capito? E' girag.
John Doe: That makes sense."""
    
    assert convert_old_transcript_format(old) == expected


def test_convert_old_transcript_format_multiple_groups():
    """Test conversion with multiple speaker changes."""
    old = """Speaker1 (0.0s - 1.0s): First.
Speaker1 (1.0s - 2.0s): Second.
Speaker2 (2.0s - 3.0s): Third.
Speaker1 (3.0s - 4.0s): Fourth.
Speaker1 (4.0s - 5.0s): Fifth."""
    
    expected = """Speaker1: First. Second.
Speaker2: Third.
Speaker1: Fourth. Fifth."""
    
    assert convert_old_transcript_format(old) == expected


def test_convert_old_transcript_format_already_new():
    """Test that new format transcripts pass through unchanged."""
    new = """Speaker1: First sentence. Second sentence.
Speaker2: Third sentence."""
    
    result = convert_old_transcript_format(new)
    # Should return the same or equivalent format
    assert "Speaker1:" in result
    assert "Speaker2:" in result
    assert "First sentence. Second sentence." in result


def test_convert_old_transcript_format_empty():
    """Test with empty input."""
    assert convert_old_transcript_format("") == ""
    assert convert_old_transcript_format("   \n  \n  ") == ""


def test_convert_old_transcript_format_whitespace():
    """Test handling of various whitespace."""
    old = """  Speaker1 (0.0s - 1.0s): Text here.  
Speaker1 (1.0s - 2.0s): More text.  """
    
    result = convert_old_transcript_format(old)
    assert "Speaker1: Text here. More text." == result


def test_update_speaker_name_in_transcript_simple():
    """Test updating speaker name in simple format."""
    transcript = "SPEAKER_00: Hello world\nSPEAKER_01: Hi there"
    updated = update_speaker_name_in_transcript(transcript, "SPEAKER_00", "Alice")
    
    assert "Alice: Hello world" in updated
    assert "SPEAKER_01: Hi there" in updated


def test_update_speaker_name_in_transcript_with_timestamp():
    """Test updating speaker name in old format with timestamps."""
    transcript = "SPEAKER_00 (0.0s - 1.0s): Hello\nSPEAKER_01 (1.0s - 2.0s): Hi"
    updated = update_speaker_name_in_transcript(transcript, "SPEAKER_00", "Alice")
    
    assert "Alice (0.0s - 1.0s): Hello" in updated
    assert "SPEAKER_01 (1.0s - 2.0s): Hi" in updated


def test_update_speaker_name_in_transcript_multiple_occurrences():
    """Test updating multiple occurrences of a speaker."""
    transcript = """SPEAKER_00: First line
SPEAKER_01: Second line
SPEAKER_00: Third line"""
    
    updated = update_speaker_name_in_transcript(transcript, "SPEAKER_00", "Alice")
    
    assert "Alice: First line" in updated
    assert "SPEAKER_01: Second line" in updated
    assert "Alice: Third line" in updated


def test_update_speaker_name_in_transcript_empty():
    """Test with empty inputs."""
    transcript = "SPEAKER_00: Hello"
    
    # Empty old name
    assert update_speaker_name_in_transcript(transcript, "", "Alice") == transcript
    
    # Empty new name
    assert update_speaker_name_in_transcript(transcript, "SPEAKER_00", "") == transcript
    
    # Empty transcript
    assert update_speaker_name_in_transcript("", "SPEAKER_00", "Alice") == ""


def test_update_speaker_name_in_transcript_special_characters():
    """Test with special characters in names."""
    transcript = "SPEAKER_00: Hello\nDr. Smith: Hi there"
    updated = update_speaker_name_in_transcript(transcript, "Dr. Smith", "Dr. Johnson")
    
    assert "Dr. Johnson: Hi there" in updated


def test_format_transcript_grouped_real_example():
    """Test with a real-world example from the issue."""
    results = [
        {"speaker": "Fausto Giunchiglia", "start": 0.03, "end": 2.88, "text": "E' una figata, capito? E' girag."},
        {"speaker": "Fausto Giunchiglia", "start": 3.54, "end": 6.12, "text": "che è il tirac, il moderno."},
        {"speaker": "Fausto Giunchiglia", "start": 6.41, "end": 9.23, "text": "Lo decomponiamo in questa maniera, vai su."},
        {"speaker": "Fausto Giunchiglia", "start": 10.24, "end": 10.98, "text": "Prezzi giù."},
        {"speaker": "Fausto Giunchiglia", "start": 11.74, "end": 12.47, "text": "Grazie mille"},
        {"speaker": "Fausto Giunchiglia", "start": 12.81, "end": 13.29, "text": "rispondi"},
        {"speaker": "Fausto Giunchiglia", "start": 14.61, "end": 16.08, "text": "Ora, perché questo è importante?"},
        {"speaker": "Fausto Giunchiglia", "start": 16.38, "end": 17.73, "text": "Perché abbiamo quattro tasche."},
        {"speaker": "Fausto Giunchiglia", "start": 18.95, "end": 19.13, "text": "Grazie."},
        {"speaker": "Fausto Giunchiglia", "start": 20.26, "end": 20.84, "text": "Capisci?"},
    ]
    
    result = format_transcript_grouped(results)
    
    # Should be just one line
    lines = result.split('\n')
    assert len(lines) == 1
    
    # Should contain all the text
    assert "E' una figata, capito?" in result
    assert "che è il tirac, il moderno." in result
    assert "Capisci?" in result
    
    # Should start with speaker name
    assert result.startswith("Fausto Giunchiglia:")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
