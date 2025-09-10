import logging
import tempfile
from pathlib import Path

from sqlalchemy.orm import Session

from .. import crud, schemas
from . import diarization, transcription, analysis, utils

# Setup logging
logger = logging.getLogger(__name__)

def run_processing_pipeline(db: Session, meeting_id: int):
    """
    The main processing pipeline for a meeting.
    Orchestrates the entire workflow from audio processing to analysis.
    """
    logger.info(f"Starting processing pipeline for meeting_id: {meeting_id}")

    # Get meeting from DB
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise ValueError(f"Meeting with ID {meeting_id} not found.")

    input_file_path = Path(meeting.filepath)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        wav_audio_path = tmp_path / f"{input_file_path.stem}.wav"

        # 1. Convert input file to WAV audio format for processing
        logger.info("Converting file to WAV format...")
        utils.convert_to_audio(input_file_path, wav_audio_path)
        logger.info(f"Successfully converted to {wav_audio_path}")

        # 2. Perform speaker diarization
        logger.info("Performing speaker diarization...")
        diarization_segments = diarization.diarize_audio(str(wav_audio_path))
        logger.info(f"Diarization complete with {len(diarization_segments)} segments.")

        # 3. Transcribe the audio based on diarization
        logger.info("Compiling transcript...")
        full_transcript, dominant_language = transcription.compile_transcript(
            str(wav_audio_path),
            diarization_segments
        )
        logger.info("Transcription complete.")

        # 4. Analyze the transcript with an LLM
        logger.info("Analyzing transcript with LLM...")
        analysis_results = analysis.analyse_meeting(full_transcript)
        logger.info("LLM analysis complete.")

        # 5. Structure the data for database insertion
        transcription_data = schemas.TranscriptionCreate(
            summary="\n".join(analysis_results.get("summary", [])),
            full_text=full_transcript
        )

        action_items_data = [
            schemas.ActionItemCreate(**item)
            for item in analysis_results.get("action_items", [])
        ]

        # 6. Save results to the database
        logger.info("Saving results to database...")
        crud.create_meeting_transcription(
            db=db,
            meeting_id=meeting_id,
            transcription=transcription_data,
            action_items=action_items_data
        )
        logger.info("Pipeline finished successfully.")

    return True
