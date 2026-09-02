"""
Integration tests for the audio processing pipeline (transcription.py).

These tests run real Whisper inference (model_size="small") through faster-whisper
instead of mocking it, to catch integration issues that mocks would hide (ffmpeg
segment extraction, model loading, real output shapes). They download the "small"
model on first run and are slower than the rest of the suite.
"""

import math
import struct
import wave
from pathlib import Path

import pytest

from app.core.processing import transcription

SMALL_MODEL = "small"


def _write_tone_wav(file_path: Path, duration_seconds: float, sample_rate: int = 16000, freq: float = 440.0) -> Path:
    """Create a mono WAV file containing a sine tone, for feeding into whisper/ffmpeg."""
    n_samples = int(duration_seconds * sample_rate)
    amplitude = 8000

    with wave.open(str(file_path), "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for i in range(n_samples):
            value = int(amplitude * math.sin(2.0 * math.pi * freq * (i / sample_rate)))
            wav_file.writeframes(struct.pack("<h", value))

    return file_path


@pytest.fixture(scope="module")
def small_whisper_model():
    """Load the real "small" faster-whisper model once for all tests in this module."""
    return transcription._load_whisper(SMALL_MODEL)


@pytest.mark.integration
@pytest.mark.slow
class TestWhisperModelLoading:
    def test_load_whisper_small_model_returns_whisper_model(self, small_whisper_model):
        from faster_whisper import WhisperModel

        assert isinstance(small_whisper_model, WhisperModel)

    def test_load_whisper_is_cached_across_calls(self, small_whisper_model):
        # _load_whisper is @lru_cache'd, so requesting the same size/provider
        # again must return the exact same instance rather than reloading.
        assert transcription._load_whisper(SMALL_MODEL) is small_whisper_model


@pytest.mark.integration
@pytest.mark.slow
class TestExtractSegment:
    def test_extract_segment_produces_requested_duration(self, tmp_path):
        source = _write_tone_wav(tmp_path / "source.wav", duration_seconds=3.0)

        clip_path = transcription._extract_segment(source, start=0.5, end=1.5)
        try:
            with wave.open(str(clip_path), "r") as clip:
                clip_duration = clip.getnframes() / clip.getframerate()
                assert clip.getnchannels() == 1
                assert clip.getframerate() == 16000
            assert clip_duration == pytest.approx(1.0, abs=0.05)
        finally:
            clip_path.unlink(missing_ok=True)

    def test_extract_segment_enforces_minimum_slice_duration(self, tmp_path):
        source = _write_tone_wav(tmp_path / "source.wav", duration_seconds=3.0)

        # Requested duration (0.05s) is below MIN_SLICE_SEC (0.20s).
        clip_path = transcription._extract_segment(source, start=1.0, end=1.05)
        try:
            with wave.open(str(clip_path), "r") as clip:
                clip_duration = clip.getnframes() / clip.getframerate()
            assert clip_duration >= transcription.MIN_SLICE_SEC
        finally:
            clip_path.unlink(missing_ok=True)

    def test_extract_segment_missing_source_raises(self, tmp_path):
        missing_source = tmp_path / "does_not_exist.wav"

        with pytest.raises(FileNotFoundError):
            transcription._extract_segment(missing_source, start=0.0, end=1.0)


@pytest.mark.integration
@pytest.mark.slow
class TestTranscribeLocal:
    def test_transcribe_local_returns_text_and_language(self, tmp_path, small_whisper_model):
        audio_file = _write_tone_wav(tmp_path / "clip.wav", duration_seconds=1.0)

        text, detected_lang = transcription._transcribe_local(audio_file, small_whisper_model)

        assert isinstance(text, str)
        assert isinstance(detected_lang, str)
        assert len(detected_lang) >= 2

    def test_transcribe_local_respects_language_hint(self, tmp_path, small_whisper_model):
        audio_file = _write_tone_wav(tmp_path / "clip.wav", duration_seconds=1.0)

        text, detected_lang = transcription._transcribe_local(audio_file, small_whisper_model, language="en")

        assert isinstance(text, str)
        assert detected_lang == "en"


@pytest.mark.integration
@pytest.mark.slow
class TestCompileTranscriptPipeline:
    def test_compile_transcript_end_to_end_with_small_model(self, tmp_path):
        audio_file = _write_tone_wav(tmp_path / "meeting.wav", duration_seconds=3.0)

        segments = [
            {"start": 0.0, "end": 1.5, "speaker": "SPEAKER_00"},
            {"start": 1.5, "end": 3.0, "speaker": "SPEAKER_01"},
        ]

        progress_calls = []

        def on_progress(current, total):
            progress_calls.append((current, total))

        whisper_config = transcription.WhisperConfig(model_size=SMALL_MODEL, language="en")
        full_transcript, dominant_language = transcription.compile_transcript(
            str(audio_file),
            segments,
            whisper_config=whisper_config,
            num_workers=2,
            progress_callback=on_progress,
        )

        assert isinstance(full_transcript, str)
        assert isinstance(dominant_language, str)

        # Progress must start at 0/total and finish having reported every segment.
        assert progress_calls[0] == (0, len(segments))
        assert progress_calls[-1] == (len(segments), len(segments))
        assert len(progress_calls) == len(segments) + 1

    def test_compile_transcript_skips_near_zero_length_segments(self, tmp_path):
        audio_file = _write_tone_wav(tmp_path / "meeting_short.wav", duration_seconds=2.0)

        # The second segment is below the 0.1s threshold in _transcribe_segment
        # and must be dropped without raising.
        segments = [
            {"start": 0.0, "end": 1.0, "speaker": "SPEAKER_00"},
            {"start": 1.0, "end": 1.05, "speaker": "SPEAKER_01"},
        ]

        whisper_config = transcription.WhisperConfig(model_size=SMALL_MODEL, language="en")
        full_transcript, dominant_language = transcription.compile_transcript(
            str(audio_file), segments, whisper_config=whisper_config, num_workers=2
        )

        assert isinstance(full_transcript, str)
        assert isinstance(dominant_language, str)
        assert "SPEAKER_01" not in full_transcript


@pytest.mark.unit
class TestWhisperConfig:
    def test_valid_model_size_is_kept(self):
        config = transcription.WhisperConfig(model_size="small")
        assert config.model_size == "small"

    def test_invalid_model_size_falls_back_to_base(self):
        config = transcription.WhisperConfig(model_size="not-a-real-size")
        assert config.model_size == "base"
