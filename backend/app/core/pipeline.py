import logging
import tempfile
import time
from pathlib import Path
from datetime import datetime

from sqlalchemy.orm import Session

from .. import crud, schemas
from ..models import ProcessingStage
from . import diarization, transcription, analysis, utils
from .export import export_meeting_data
from .calendar import generate_ics_calendar
from .text_analysis import detect_topic, extract_keywords, identify_speakers, analyze_meeting_sentiment
from .retry import retry_file_operation

# Setup logging
logger = logging.getLogger(__name__)

@retry_file_operation(max_retries=3, delay=1.0)
def run_processing_pipeline(db: Session, meeting_id: int):
    """
    The enhanced processing pipeline for a meeting.
    Orchestrates the entire workflow from audio processing to analysis with all features.
    """
    logger.info(f"Starting enhanced processing pipeline for meeting_id: {meeting_id}")

    # Get meeting from DB
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise ValueError(f"Meeting with ID {meeting_id} not found.")

    input_file_path = Path(meeting.filepath)
    meeting_filename = meeting.filename

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        wav_audio_path = tmp_path / f"{input_file_path.stem}.wav"
        
        # Create exports directory
        exports_dir = tmp_path / "exports"
        exports_dir.mkdir(exist_ok=True)

        # Get file metadata for duration estimation
        try:
            metadata = utils.get_file_metadata(input_file_path)
            estimated_duration_minutes = getattr(metadata, 'duration', 0) / 60 if hasattr(metadata, 'duration') else None
            if estimated_duration_minutes:
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    estimated_duration=round(estimated_duration_minutes, 1)
                )
        except Exception as e:
            logger.warning(f"Could not extract file metadata: {e}")

        # 1. Convert input file to WAV audio format for processing
        logger.info("Converting file to WAV format...")
        crud.update_meeting_processing_details(
            db, meeting_id,
            current_stage=ProcessingStage.CONVERSION.value,
            stage_start_time=time.time(),
            progress_percentage=5.0,
            processing_logs=['Starting file conversion...']
        )
        
        utils.convert_to_audio(input_file_path, wav_audio_path)
        crud.update_meeting_processing_details(
            db, meeting_id,
            progress_percentage=25.0,
            processing_logs=['File conversion completed']
        )
        logger.info(f"Successfully converted to {wav_audio_path}")

        # 2. Perform speaker diarization (with caching and retry)
        logger.info("Performing speaker diarization...")
        crud.update_meeting_processing_details(
            db, meeting_id,
            current_stage=ProcessingStage.DIARIZATION.value,
            stage_start_time=time.time(),
            progress_percentage=25.0,
            processing_logs=['Starting speaker diarization...']
        )
        
        # Parse number of speakers parameter
        num_speakers = None
        if meeting.number_of_speakers and meeting.number_of_speakers != "auto":
            try:
                num_speakers = int(meeting.number_of_speakers)
            except ValueError:
                logger.warning(f"Invalid number_of_speakers: {meeting.number_of_speakers}, using auto-detect")
        
        diarization_segments = diarization.diarize_audio(str(wav_audio_path), num_speakers=num_speakers)
        crud.update_meeting_processing_details(
            db, meeting_id,
            progress_percentage=50.0,
            processing_logs=[f'Diarization completed - {len(diarization_segments)} segments found']
        )
        logger.info(f"Diarization complete with {len(diarization_segments)} segments.")

        # 3. Transcribe the audio based on diarization (with caching)
        logger.info("Compiling transcript...")
        crud.update_meeting_processing_details(
            db, meeting_id,
            current_stage=ProcessingStage.TRANSCRIPTION.value,
            stage_start_time=time.time(),
            progress_percentage=50.0,
            processing_logs=['Starting transcription...']
        )
        
        # Create a progress callback for transcription
        def transcription_progress_callback(current: int, total: int):
            if total > 0:
                progress = (current / total) * 100.0
                overall_progress = 50.0 + (progress * 0.25)  # Transcription is 25% of overall
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    progress_percentage=overall_progress
                )
        
        # Use meeting's transcription language
        # Map frontend language codes to Whisper language codes
        language_mapping = {
            "en-US": "en", "en-GB": "en", 
            "es-ES": "es", "fr-FR": "fr", "de-DE": "de", 
            "it-IT": "it", "pt-BR": "pt", "zh-CN": "zh", 
            "ja-JP": "ja", "ko-KR": "ko", "ru-RU": "ru", "ar-SA": "ar"
        }
        transcription_language = language_mapping.get(meeting.transcription_language, "en")
        
        full_transcript, dominant_language = transcription.compile_transcript(
            str(wav_audio_path),
            diarization_segments,
            language=transcription_language,
            progress_callback=transcription_progress_callback
        )
        crud.update_meeting_processing_details(
            db, meeting_id,
            progress_percentage=75.0,
            processing_logs=['Transcription completed']
        )
        logger.info("Transcription complete.")

        # 4. Enhanced text analysis
        logger.info("Performing text analysis...")
        
        # Detect meeting topic
        meeting_topic = detect_topic(full_transcript, meeting_filename)
        
        # Extract keywords
        keywords = extract_keywords(full_transcript, max_keywords=15)
        
        # Identify speakers
        speaker_names = identify_speakers(full_transcript)
        
        # Analyze sentiment
        sentiment_analysis = analyze_meeting_sentiment(full_transcript)
        
        logger.info(f"Text analysis complete - Topic: {meeting_topic}, Keywords: {len(keywords)}")

        # 5. Analyze the transcript with an LLM (with enhanced retry and fallback)
        logger.info("Analyzing transcript with LLM...")
        crud.update_meeting_processing_details(
            db, meeting_id,
            current_stage=ProcessingStage.ANALYSIS.value,
            stage_start_time=time.time(),
            progress_percentage=75.0,
            processing_logs=['Starting AI analysis...']
        )
        
        # Add context to transcript for better LLM analysis
        meeting_date = datetime.fromtimestamp(meeting.created_at.timestamp()) if meeting.created_at else datetime.now()
        enhanced_transcript = f"""Meeting: {meeting_topic}
Date: {meeting_date.strftime('%Y-%m-%d %H:%M')}
File: {meeting_filename}
Participants: {len(set(seg['speaker'] for seg in diarization_segments))} speakers
Duration: {estimated_duration_minutes:.1f} minutes

Transcript:
{full_transcript}"""
        
        analysis_results = analysis.analyse_meeting(enhanced_transcript)
        crud.update_meeting_processing_details(
            db, meeting_id,
            progress_percentage=85.0,
            processing_logs=['AI analysis completed']
        )
        logger.info("LLM analysis complete.")

        # 6. Generate exports and calendar
        logger.info("Generating exports and calendar...")
        
        # Prepare comprehensive data for export
        export_data = {
            "meeting_topic": meeting_topic,
            "meeting_date": meeting_date,
            "filename": meeting_filename,
            "transcript": full_transcript,
            "keywords": keywords,
            "speaker_names": speaker_names,
            "sentiment_analysis": sentiment_analysis,
            "dominant_language": dominant_language,
            "estimated_duration_minutes": estimated_duration_minutes,
            **analysis_results  # Include summary, decisions, action_items, etc.
        }
        
        # Export to multiple formats
        base_export_path = exports_dir / f"{input_file_path.stem}_meeting_summary"
        export_formats = ["json", "txt", "docx", "pdf"]
        export_results = export_meeting_data(export_data, str(base_export_path), export_formats)
        
        # Generate calendar for action items
        calendar_path = None
        if analysis_results.get("action_items"):
            calendar_filename = str(exports_dir / f"{input_file_path.stem}_action_items.ics")
            calendar_path = generate_ics_calendar(
                analysis_results["action_items"],
                meeting_date=meeting_date,
                meeting_topic=meeting_topic,
                filename=calendar_filename
            )
        
        crud.update_meeting_processing_details(
            db, meeting_id,
            progress_percentage=95.0,
            processing_logs=['Export files generated']
        )

        # 7. Structure the data for database insertion
        # Combine summary with additional insights
        enhanced_summary = []
        if isinstance(analysis_results.get("summary"), list):
            enhanced_summary.extend(analysis_results["summary"])
        else:
            enhanced_summary.append(str(analysis_results.get("summary", "")))
        
        # Add metadata insights to summary
        enhanced_summary.extend([
            f"Meeting Topic: {meeting_topic}",
            f"Key Keywords: {', '.join(keywords[:5])}" if keywords else "",
            f"Overall Sentiment: {sentiment_analysis.get('sentiment', 'neutral').title()}",
            f"Identified Speakers: {len(speaker_names)} of {len(set(seg['speaker'] for seg in diarization_segments))}"
        ])
        
        # Remove empty strings
        enhanced_summary = [s for s in enhanced_summary if s.strip()]
        
        transcription_data = schemas.TranscriptionCreate(
            summary="\n".join(enhanced_summary),
            full_text=full_transcript
        )

        action_items_data = [
            schemas.ActionItemCreate(**item)
            for item in analysis_results.get("action_items", [])
        ]

        # 8. Save results to the database
        logger.info("Saving results to database...")
        crud.create_meeting_transcription(
            db=db,
            meeting_id=meeting_id,
            transcription=transcription_data,
            action_items=action_items_data
        )
        
        # Store export file paths in processing logs (for future retrieval)
        export_info = []
        for fmt, path in export_results.items():
            if path:
                export_info.append(f"Exported {fmt.upper()}: {path}")
        
        if calendar_path:
            export_info.append(f"Calendar: {calendar_path}")
        
        crud.update_meeting_processing_details(
            db, meeting_id,
            progress_percentage=100.0,
            processing_logs=export_info if export_info else ['Processing completed successfully']
        )
        
        logger.info("Enhanced pipeline finished successfully.")

    return True
