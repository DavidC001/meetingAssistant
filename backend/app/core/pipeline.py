import logging
import tempfile
import time
from pathlib import Path
from datetime import datetime

from sqlalchemy.orm import Session

from .. import crud, schemas
from ..models import ProcessingStage, MeetingStatus
from . import diarization, transcription, analysis, utils
from .export import export_meeting_data
from .calendar import generate_ics_calendar
from .text_analysis import detect_topic, extract_keywords, identify_speakers, analyze_meeting_sentiment
from .retry import retry_file_operation
from .checkpoint import CheckpointManager

# Setup logging
logger = logging.getLogger(__name__)

@retry_file_operation(max_retries=3, delay=1.0)
def run_processing_pipeline(db: Session, meeting_id: int):
    """
    The enhanced processing pipeline for a meeting with checkpointing support.
    Orchestrates the entire workflow from audio processing to analysis with all features.
    Can resume from interruption points using saved checkpoints.
    """
    logger.info(f"Starting enhanced processing pipeline for meeting_id: {meeting_id}")

    # Initialize checkpoint manager
    checkpoint_manager = CheckpointManager(meeting_id)
    
    # Check if we can resume from a previous checkpoint
    resume_stage = checkpoint_manager.get_resume_point(db)
    if resume_stage:
        logger.info(f"Resuming processing from stage: {resume_stage}")
    else:
        logger.info("Starting processing from the beginning")

    # Get meeting from DB
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise ValueError(f"Meeting with ID {meeting_id} not found.")

    # Check if processing is already complete AND successful
    is_completed = (meeting.status == MeetingStatus.COMPLETED.value and
                   meeting.transcription and 
                   meeting.transcription.summary and 
                   meeting.transcription.full_text and 
                   meeting.transcription.action_items)
    
    if is_completed:
        logger.info(f"Meeting {meeting_id} already has transcription, processing complete")
        # Ensure progress is properly set
        crud.update_meeting_processing_details(
            db, meeting_id,
            overall_progress=100.0,
            stage_progress=100.0,
            current_stage=ProcessingStage.ANALYSIS.value
        )
        return True
    
    # If the meeting is in FAILED state, allow reprocessing
    if meeting.status == MeetingStatus.FAILED.value:
        logger.info(f"Meeting {meeting_id} previously failed, restarting processing...")
        crud.update_meeting_status(db, meeting_id, MeetingStatus.PROCESSING)
        
        # Check if we have existing transcription - if so, we can skip straight to analysis
        has_transcription = (meeting.transcription and 
                            meeting.transcription.full_text)
        
        if has_transcription and not resume_stage:
            logger.info(f"Meeting {meeting_id} has existing transcription, will retry from analysis stage")
            resume_stage = "analysis"  # Force resume from analysis stage
        
        crud.update_meeting_processing_details(
            db, meeting_id,
            error_message=None,  # Clear previous error
            processing_logs=['Restarting processing after previous failure'],
            overall_progress=75.0 if has_transcription else 0.0,
            stage_progress=0.0
        )

    input_file_path = Path(meeting.filepath)
    meeting_filename = meeting.filename

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        wav_audio_path = tmp_path / f"{input_file_path.stem}.wav"
        
        # Create exports directory
        exports_dir = tmp_path / "exports"
        exports_dir.mkdir(exist_ok=True)

        # Initialize variables that might be loaded from checkpoints
        diarization_segments = None
        full_transcript = None
        dominant_language = None
        estimated_duration_minutes = None

        # Get file metadata for duration estimation (if not already done)
        if not resume_stage or resume_stage == "conversion":
            try:
                metadata = utils.get_file_metadata(input_file_path)
                estimated_duration_minutes = getattr(metadata, 'duration', 0) / 60 if hasattr(metadata, 'duration') else None
                if estimated_duration_minutes:
                    crud.update_meeting_processing_details(
                        db, meeting_id,
                        estimated_duration=round(estimated_duration_minutes, 1)
                    )
                    # Save metadata as checkpoint
                    checkpoint_manager.save_checkpoint("metadata", {
                        "estimated_duration_minutes": estimated_duration_minutes
                    })
            except Exception as e:
                logger.warning(f"Could not extract file metadata: {e}")
        else:
            # Load metadata from checkpoint
            metadata_checkpoint = checkpoint_manager.load_checkpoint("metadata")
            if metadata_checkpoint:
                estimated_duration_minutes = metadata_checkpoint.get("estimated_duration_minutes")

        # 1. Convert input file to WAV audio format for processing
        if not resume_stage or resume_stage == "conversion":
            logger.info("Converting file to WAV format...")
            crud.update_meeting_processing_details(
                db, meeting_id,
                current_stage=ProcessingStage.CONVERSION.value,
                stage_start_time=time.time(),
                stage_progress=0.0,
                overall_progress=5.0,
                processing_logs=['Starting file conversion...']
            )
            
            utils.convert_to_audio(input_file_path, wav_audio_path)
            
            # Also create MP3 for playback (storage-efficient, streamable format)
            try:
                from .config import config
                audio_dir = Path(config.upload.upload_dir) / "audio"
                audio_dir.mkdir(parents=True, exist_ok=True)
                mp3_filename = f"{input_file_path.stem}_audio.mp3"
                mp3_path = audio_dir / mp3_filename
                
                logger.info(f"Creating MP3 for playback: {mp3_path}")
                utils.convert_to_mp3(input_file_path, mp3_path)
                
                # Update meeting with audio filepath
                meeting.audio_filepath = str(mp3_path)
                db.commit()
                logger.info(f"MP3 playback file created: {mp3_path}")
            except Exception as e:
                logger.warning(f"Failed to create MP3 playback file: {e}")
                # Don't fail the entire process if MP3 creation fails
            
            # Save conversion checkpoint
            checkpoint_manager.save_checkpoint("conversion", {
                "wav_audio_path": str(wav_audio_path),
                "completed": True
            }, metadata={"stage": "conversion", "file_size": input_file_path.stat().st_size})
            
            crud.update_meeting_processing_details(
                db, meeting_id,
                stage_progress=100.0,
                overall_progress=25.0,
                processing_logs=['File conversion completed']
            )
            logger.info(f"Successfully converted to {wav_audio_path}")
        else:
            # Copy the original file to our temporary location for processing
            utils.convert_to_audio(input_file_path, wav_audio_path)
            logger.info("Skipped conversion stage (using checkpoint)")

        # 2. Perform speaker diarization (with caching and retry)
        if not resume_stage or resume_stage in ["conversion", "diarization"]:
            # Check if we have a diarization checkpoint
            diarization_checkpoint = checkpoint_manager.load_checkpoint("diarization")
            if diarization_checkpoint and checkpoint_manager.validate_checkpoint("diarization"):
                logger.info("Loading diarization results from checkpoint...")
                diarization_segments = diarization_checkpoint
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    current_stage=ProcessingStage.DIARIZATION.value,
                    stage_progress=100.0,
                    overall_progress=50.0,
                    processing_logs=[f'Diarization loaded from checkpoint - {len(diarization_segments)} segments found']
                )
            else:
                logger.info("Performing speaker diarization...")
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    current_stage=ProcessingStage.DIARIZATION.value,
                    stage_start_time=time.time(),
                    stage_progress=0.0,
                    overall_progress=25.0,
                    processing_logs=['Starting speaker diarization...']
                )
                
                # Parse number of speakers parameter
                num_speakers = None
                if meeting.number_of_speakers and meeting.number_of_speakers != "auto":
                    try:
                        num_speakers = int(meeting.number_of_speakers)
                    except ValueError:
                        logger.warning(f"Invalid number_of_speakers: {meeting.number_of_speakers}, using auto-detect")
                
                # Create a progress callback for diarization
                def diarization_progress_callback(progress: int, message: str):
                    crud.update_meeting_processing_details(
                        db, meeting_id,
                        stage_progress=float(progress),
                        processing_logs=[f'Diarization: {message}']
                    )
                
                diarization_segments = diarization.diarize_audio(
                    str(wav_audio_path), 
                    num_speakers=num_speakers, 
                    progress_callback=diarization_progress_callback,
                    db_session=db,
                    meeting_id=meeting_id
                )
                
                # Save diarization checkpoint
                checkpoint_manager.save_checkpoint("diarization", diarization_segments, metadata={
                    "stage": "diarization",
                    "num_segments": len(diarization_segments),
                    "num_speakers": num_speakers
                })
                
                # Create Speaker records from diarization segments
                unique_speakers = set(segment["speaker"] for segment in diarization_segments)
                logger.info(f"Creating {len(unique_speakers)} speaker records...")
                
                # Clear existing speakers for this meeting (in case of reprocessing)
                from .. import models
                db.query(models.Speaker).filter(models.Speaker.meeting_id == meeting_id).delete()
                
                # Create a speaker record for each unique speaker detected
                for speaker_label in sorted(unique_speakers):
                    speaker = models.Speaker(
                        meeting_id=meeting_id,
                        name=speaker_label,  # Initially, name equals label
                        label=speaker_label
                    )
                    db.add(speaker)
                
                db.commit()
                logger.info(f"Created {len(unique_speakers)} speaker records")
                
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    stage_progress=100.0,
                    overall_progress=50.0,
                    processing_logs=[f'Diarization completed - {len(diarization_segments)} segments found, {len(unique_speakers)} speakers identified']
                )
                logger.info(f"Diarization complete with {len(diarization_segments)} segments.")
        else:
            # Load diarization from checkpoint
            diarization_segments = checkpoint_manager.load_checkpoint("diarization")
            if not diarization_segments:
                # If checkpoint doesn't exist, create a default segment for the whole transcript
                # This can happen when retrying analysis after failure
                logger.warning("Diarization checkpoint not available, using default segment")
                diarization_segments = [{"speaker": "Speaker 1", "start": 0, "end": 0}]
            logger.info(f"Skipped diarization stage (using checkpoint with {len(diarization_segments)} segments)")

        # 3. Transcribe the audio based on diarization (with caching)
        if not resume_stage or resume_stage in ["conversion", "diarization", "transcription"]:
            # Check if we have a transcription checkpoint
            transcription_checkpoint = checkpoint_manager.load_checkpoint("transcription")
            if transcription_checkpoint and checkpoint_manager.validate_checkpoint("transcription"):
                logger.info("Loading transcription results from checkpoint...")
                full_transcript = transcription_checkpoint["full_transcript"]
                dominant_language = transcription_checkpoint["dominant_language"]
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    current_stage=ProcessingStage.TRANSCRIPTION.value,
                    stage_progress=100.0,
                    overall_progress=75.0,
                    processing_logs=['Transcription loaded from checkpoint']
                )
            else:
                logger.info("Compiling transcript...")
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    current_stage=ProcessingStage.TRANSCRIPTION.value,
                    stage_start_time=time.time(),
                    stage_progress=0.0,
                    overall_progress=50.0,
                    processing_logs=['Starting transcription...']
                )
                
                # Create a progress callback for transcription
                def transcription_progress_callback(current: int, total: int):
                    if total > 0:
                        stage_progress = round((current / total) * 100.0, 1)
                        overall_progress = round(50.0 + (stage_progress * 0.25), 1)  # Transcription is 25% of overall
                        crud.update_meeting_processing_details(
                            db, meeting_id,
                            stage_progress=stage_progress,
                            overall_progress=overall_progress,
                            processing_logs=[f'Transcribing segment {current}/{total} ({stage_progress:.1f}%)']
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
                
                # Get model configuration for whisper model selection
                model_config = None
                if meeting.model_configuration_id:
                    model_config = crud.get_model_configuration(db, meeting.model_configuration_id)
                if not model_config:
                    # Fall back to default configuration
                    model_config = crud.get_default_model_configuration(db)
                
                # Determine whisper model size
                whisper_model_size = model_config.whisper_model if model_config else "base"
                
                # Create WhisperConfig with the specified language and model
                whisper_config = transcription.WhisperConfig(
                    model_size=whisper_model_size,
                    language=transcription_language
                )
                
                full_transcript, dominant_language = transcription.compile_transcript(
                    str(wav_audio_path),
                    diarization_segments,
                    whisper_config=whisper_config,
                    progress_callback=transcription_progress_callback
                )
                
                # Save transcription checkpoint
                checkpoint_manager.save_checkpoint("transcription", {
                    "full_transcript": full_transcript,
                    "dominant_language": dominant_language
                }, metadata={
                    "stage": "transcription",
                    "language": transcription_language,
                    "transcript_length": len(full_transcript)
                })
                
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    stage_progress=100.0,
                    overall_progress=75.0,
                    processing_logs=['Transcription completed']
                )
                logger.info("Transcription complete.")
        else:
            # Load transcription from checkpoint
            transcription_checkpoint = checkpoint_manager.load_checkpoint("transcription")
            if transcription_checkpoint:
                full_transcript = transcription_checkpoint["full_transcript"]
                dominant_language = transcription_checkpoint["dominant_language"]
                logger.info("Skipped transcription stage (using checkpoint)")
            else:
                # Try to load from database if checkpoint doesn't exist (e.g., after analysis failure)
                if meeting.transcription and meeting.transcription.full_text:
                    logger.info("Loading transcription from database (checkpoint not available)")
                    full_transcript = meeting.transcription.full_text
                    dominant_language = "en"  # Default, will be overridden by checkpoint if available
                else:
                    raise ValueError("Failed to load transcription from checkpoint or database")

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
        if not resume_stage or resume_stage in ["conversion", "diarization", "transcription", "analysis"]:
            # Check if we have an analysis checkpoint
            analysis_checkpoint = checkpoint_manager.load_checkpoint("analysis")
            if analysis_checkpoint and checkpoint_manager.validate_checkpoint("analysis"):
                logger.info("Loading analysis results from checkpoint...")
                analysis_results = analysis_checkpoint
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    current_stage=ProcessingStage.ANALYSIS.value,
                    stage_progress=100.0,
                    overall_progress=85.0,
                    processing_logs=['AI analysis loaded from checkpoint']
                )
            else:
                logger.info("Analyzing transcript with LLM...")
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    current_stage=ProcessingStage.ANALYSIS.value,
                    stage_start_time=time.time(),
                    stage_progress=0.0,
                    overall_progress=75.0,
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
                
                # Log transcript metadata for monitoring
                transcript_word_count = len(full_transcript.split())
                logger.info(f"Transcript word count: {transcript_word_count}, Duration: {estimated_duration_minutes:.1f} minutes")
                
                # Create a progress callback for analysis
                def analysis_progress_callback(progress: int, message: str):
                    crud.update_meeting_processing_details(
                        db, meeting_id,
                        stage_progress=float(progress),
                        processing_logs=[f'Analysis: {message}']
                    )
                
                # Get model configuration for analysis
                model_config = None
                if meeting.model_configuration_id:
                    model_config = crud.get_model_configuration(db, meeting.model_configuration_id)
                if not model_config:
                    model_config = crud.get_default_model_configuration(db)
                
                # Convert to LLMConfig if we have a model configuration
                llm_config = None
                if model_config:
                    llm_config = analysis.model_config_to_llm_config(model_config, use_analysis=True)
                
                logger.info(f"Sending transcript to LLM for analysis. Length: {len(enhanced_transcript)} chars")
                analysis_results = analysis.analyse_meeting(enhanced_transcript, llm_config=llm_config, progress_callback=analysis_progress_callback)
                
                # Check if analysis failed
                if not analysis_results.get("success", True):
                    error_msg = analysis_results.get("error", "Unknown analysis error")
                    logger.error(f"Analysis failed: {error_msg}")
                    # Don't save checkpoint for failed analysis
                    raise ValueError(f"Analysis failed: {error_msg}")
                
                # Save analysis checkpoint
                checkpoint_manager.save_checkpoint("analysis", analysis_results, metadata={
                    "stage": "analysis",
                    "meeting_topic": meeting_topic,
                    "num_action_items": len(analysis_results.get("action_items", []))
                })
                
                crud.update_meeting_processing_details(
                    db, meeting_id,
                    stage_progress=100.0,
                    overall_progress=85.0,
                    processing_logs=['AI analysis completed']
                )
                logger.info("LLM analysis complete.")
        else:
            # Load analysis from checkpoint
            analysis_checkpoint = checkpoint_manager.load_checkpoint("analysis")
            if not analysis_checkpoint:
                raise ValueError("Failed to load analysis checkpoint")
            analysis_results = analysis_checkpoint
            logger.info("Skipped analysis stage (using checkpoint)")

        # 6. Generate exports and calendar
        logger.info("Generating exports and calendar...")
        
        # Prepare comprehensive data for export
        meeting_date = datetime.fromtimestamp(meeting.created_at.timestamp()) if meeting.created_at else datetime.now()
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
            stage_progress=50.0,
            overall_progress=95.0,
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
        # Check if analysis was successful before marking as completed
        analysis_success = analysis_results.get("success", True)
        crud.create_meeting_transcription(
            db=db,
            meeting_id=meeting_id,
            transcription=transcription_data,
            action_items=action_items_data,
            mark_completed=analysis_success
        )
        
        # Update status based on analysis success
        if analysis_success:
            crud.update_meeting_status(db, meeting_id, MeetingStatus.COMPLETED)
        else:
            crud.update_meeting_status(db, meeting_id, MeetingStatus.FAILED)
            crud.update_meeting_processing_details(
                db, meeting_id,
                error_message=analysis_results.get("error", "Analysis failed"),
                processing_logs=['Analysis failed - meeting can be reprocessed']
            )
            logger.warning(f"Meeting {meeting_id} saved with FAILED status due to analysis error")
        
        # Store export file paths in processing logs (for future retrieval)
        export_info = []
        for fmt, path in export_results.items():
            if path:
                export_info.append(f"Exported {fmt.upper()}: {path}")
        
        if calendar_path:
            export_info.append(f"Calendar: {calendar_path}")
        
        crud.update_meeting_processing_details(
            db, meeting_id,
            stage_progress=100.0,
            overall_progress=100.0,
            processing_logs=export_info if export_info else ['Processing completed successfully']
        )
        
        # Clear checkpoints after successful completion
        checkpoint_manager.clear_checkpoints()
        
        logger.info("Enhanced pipeline finished successfully.")

    return True
