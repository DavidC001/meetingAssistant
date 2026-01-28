"""
Transcript formatting utilities.
Handles grouping consecutive utterances from the same speaker.
"""
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def format_transcript_grouped(results: list[dict[str, Any]]) -> str:
    """
    Format transcript results by grouping consecutive utterances from the same speaker.
    Removes timestamps and combines text from consecutive segments.

    Args:
        results: List of transcription results with 'speaker', 'start', 'end', and 'text' keys

    Returns:
        Formatted transcript string with grouped speakers
    """
    if not results:
        return ""

    # Sort by start time to ensure correct order
    sorted_results = sorted(results, key=lambda r: r["start"])

    transcript_lines = []
    current_speaker = None
    current_texts = []

    for result in sorted_results:
        speaker = result.get("speaker", "Unknown")
        text = result.get("text", "").strip()

        if not text:
            continue

        if speaker == current_speaker:
            # Same speaker, accumulate text
            current_texts.append(text)
        else:
            # New speaker, flush previous speaker's text
            if current_speaker is not None and current_texts:
                combined_text = " ".join(current_texts)
                transcript_lines.append(f"{current_speaker}: {combined_text}")

            # Start new speaker
            current_speaker = speaker
            current_texts = [text]

    # Flush the last speaker's text
    if current_speaker is not None and current_texts:
        combined_text = " ".join(current_texts)
        transcript_lines.append(f"{current_speaker}: {combined_text}")

    return "\n".join(transcript_lines)


def convert_old_transcript_format(old_transcript: str) -> str:
    """
    Convert old transcript format (with timestamps) to new grouped format.

    Old format:
        Speaker1 (0.03s - 2.88s): Text here.
        Speaker1 (3.54s - 6.12s): More text.
        Speaker2 (7.00s - 9.00s): Different speaker.

    New format:
        Speaker1: Text here. More text.
        Speaker2: Different speaker.

    Args:
        old_transcript: Transcript string in old format

    Returns:
        Transcript string in new grouped format
    """
    if not old_transcript or not old_transcript.strip():
        return ""

    lines = old_transcript.strip().split("\n")

    # Pattern to match: "Speaker (timestamp): text" or "Speaker: text"
    # This handles both old format with timestamps and simple format
    timestamp_pattern = re.compile(r"^(.+?)\s*\([\d.]+s\s*-\s*[\d.]+s\)\s*:\s*(.*)$")
    simple_pattern = re.compile(r"^(.+?)\s*:\s*(.*)$")

    grouped_speakers = {}
    speaker_order = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Try to match timestamp format first
        match = timestamp_pattern.match(line)
        if match:
            speaker = match.group(1).strip()
            text = match.group(2).strip()
        else:
            # Try simple format
            match = simple_pattern.match(line)
            if match:
                speaker = match.group(1).strip()
                text = match.group(2).strip()
            else:
                # Line doesn't match expected format, skip it
                logger.warning(f"Could not parse transcript line: {line}")
                continue

        if not text:
            continue

        # Track speaker order for first appearance
        if speaker not in grouped_speakers:
            speaker_order.append(speaker)
            grouped_speakers[speaker] = []

        grouped_speakers[speaker].append(text)

    # Now group consecutive appearances of the same speaker
    result_lines = []
    current_speaker = None
    current_texts = []

    # Flatten back into sequential order, grouping consecutive same speakers
    for line in lines:
        line = line.strip()
        if not line:
            continue

        match = timestamp_pattern.match(line)
        if not match:
            match = simple_pattern.match(line)

        if not match:
            continue

        speaker = match.group(1).strip()
        text = match.group(2).strip() if match.lastindex >= 2 else ""

        if not text:
            continue

        if speaker == current_speaker:
            # Same speaker, accumulate
            current_texts.append(text)
        else:
            # Different speaker, flush previous
            if current_speaker and current_texts:
                combined = " ".join(current_texts)
                result_lines.append(f"{current_speaker}: {combined}")

            current_speaker = speaker
            current_texts = [text]

    # Flush last speaker
    if current_speaker and current_texts:
        combined = " ".join(current_texts)
        result_lines.append(f"{current_speaker}: {combined}")

    return "\n".join(result_lines)


def update_speaker_name_in_transcript(transcript: str, old_name: str, new_name: str) -> str:
    """
    Update speaker name in a transcript (works with both old and new formats).

    Args:
        transcript: Transcript string
        old_name: Old speaker name to replace
        new_name: New speaker name

    Returns:
        Updated transcript string
    """
    if not transcript or not old_name or not new_name:
        return transcript

    # Pattern 1: Speaker with timestamp format: "SPEAKER_00 (0.01s - 7.29s): text"
    timestamp_pattern = rf"^(\s*){re.escape(old_name)}(\s+\([^)]+\)\s*:)"
    transcript = re.sub(timestamp_pattern, rf"\1{new_name}\2", transcript, flags=re.MULTILINE)

    # Pattern 2: Speaker with simple colon: "SPEAKER_00: text" (our new format)
    simple_pattern = rf"^(\s*){re.escape(old_name)}(\s*:)"
    transcript = re.sub(simple_pattern, rf"\1{new_name}\2", transcript, flags=re.MULTILINE)

    # Pattern 3: Speaker in brackets or parentheses
    bracket_pattern = rf"(\[|\()\s*{re.escape(old_name)}\s*(\]|\))"
    transcript = re.sub(bracket_pattern, rf"\1{new_name}\2", transcript)

    return transcript
