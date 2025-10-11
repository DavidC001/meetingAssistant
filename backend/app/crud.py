from sqlalchemy.orm import Session
from . import models, schemas
from sqlalchemy import asc
from sqlalchemy.sql import func

# Meeting CRUD operations
def get_meeting(db: Session, meeting_id: int):
    return db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()

def get_meetings(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Meeting).offset(skip).limit(limit).all()

def create_meeting(db: Session, meeting: schemas.MeetingCreate, file_path: str, file_size: int = None, celery_task_id: str = None):
    db_meeting = models.Meeting(
        filename=meeting.filename,
        filepath=file_path,
        status=models.MeetingStatus.PENDING.value,
        transcription_language=meeting.transcription_language or "en-US",
        number_of_speakers=meeting.number_of_speakers or "auto",
        model_configuration_id=meeting.model_configuration_id,
        file_size=file_size,
        celery_task_id=celery_task_id
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

def update_meeting_status(db: Session, meeting_id: int, status: models.MeetingStatus):
    db_meeting = get_meeting(db, meeting_id)
    if db_meeting:
        db_meeting.status = status.value
        db.commit()
        db.refresh(db_meeting)
    return db_meeting

def update_meeting_progress(db: Session, meeting_id: int, stage: models.ProcessingStage, 
                          stage_progress: float, overall_progress: float):
    db_meeting = get_meeting(db, meeting_id)
    if db_meeting:
        db_meeting.current_stage = stage.value
        db_meeting.stage_progress = stage_progress
        db_meeting.overall_progress = overall_progress
        db.commit()
        db.refresh(db_meeting)
    return db_meeting

def update_meeting(db: Session, meeting_id: int, meeting: schemas.MeetingUpdate):
    db_meeting = get_meeting(db, meeting_id=meeting_id)
    if db_meeting:
        if meeting.filename is not None:
            db_meeting.filename = meeting.filename
        if meeting.transcription_language is not None:
            db_meeting.transcription_language = meeting.transcription_language
        if meeting.number_of_speakers is not None:
            db_meeting.number_of_speakers = meeting.number_of_speakers
        if meeting.model_configuration_id is not None:
            db_meeting.model_configuration_id = meeting.model_configuration_id
        if meeting.tags is not None:
            db_meeting.tags = meeting.tags
        if meeting.folder is not None:
            db_meeting.folder = meeting.folder
        if meeting.notes is not None:
            db_meeting.notes = meeting.notes

        db.commit()
        db.refresh(db_meeting)
    return db_meeting

def delete_meeting(db: Session, meeting_id: int):
    db_meeting = get_meeting(db, meeting_id=meeting_id)
    if db_meeting:
        # Cancel Celery task if it's still running
        if db_meeting.celery_task_id and (db_meeting.status == models.MeetingStatus.PROCESSING.value or db_meeting.status == models.MeetingStatus.PENDING.value):
            try:
                from .worker import celery_app
                celery_app.control.revoke(db_meeting.celery_task_id, terminate=True)
                print(f"Cancelled Celery task {db_meeting.celery_task_id} for meeting {meeting_id}")
            except Exception as e:
                print(f"Error cancelling Celery task {db_meeting.celery_task_id}: {e}")
        
        # Delete related records first to avoid foreign key constraint violations
        # Delete diarization timings
        db.query(models.DiarizationTiming).filter(models.DiarizationTiming.meeting_id == meeting_id).delete()
        
        # Delete the meeting (this will cascade delete transcription and action items due to the cascade settings)
        db.delete(db_meeting)
        db.commit()
    return db_meeting

def update_meeting_task_id(db: Session, meeting_id: int, task_id: str):
    """Update the Celery task ID for a meeting"""
    db_meeting = get_meeting(db, meeting_id)
    if db_meeting:
        db_meeting.celery_task_id = task_id
        db.commit()
        db.refresh(db_meeting)
    return db_meeting

def mark_meeting_embeddings(db: Session, meeting_id: int, *, computed: bool, config_id: int | None = None):
    meeting = get_meeting(db, meeting_id)
    if not meeting:
        return None
    meeting.embeddings_computed = computed
    meeting.embedding_config_id = config_id
    if computed:
        from sqlalchemy.sql import func as sql_func
        meeting.embeddings_updated_at = sql_func.now()
    else:
        meeting.embeddings_updated_at = None
    db.commit()
    db.refresh(meeting)
    return meeting

# Transcription CRUD operations
def create_meeting_transcription(db: Session, meeting_id: int, transcription: schemas.TranscriptionCreate, action_items: list[schemas.ActionItemCreate], mark_completed: bool = True):
    # Update the meeting status to COMPLETED only if requested (i.e., processing succeeded)
    db_meeting = None
    if mark_completed:
        db_meeting = update_meeting_status(db, meeting_id, models.MeetingStatus.COMPLETED)
    else:
        db_meeting = get_meeting(db, meeting_id)
    
    if not db_meeting:
        return None

    # Create the transcription record
    db_transcription = models.Transcription(
        meeting_id=meeting_id,
        summary=transcription.summary,
        full_text=transcription.full_text
    )
    db.add(db_transcription)
    db.commit()
    db.refresh(db_transcription)

    # Create the action items
    for item_data in action_items:
        db_item = models.ActionItem(**item_data.dict(), transcription_id=db_transcription.id)
        db.add(db_item)

    db.commit()
    db.refresh(db_transcription)

    return db_transcription

# Action Item CRUD operations
def create_action_item(db: Session, transcription_id: int, action_item: schemas.ActionItemCreate, is_manual: bool = True):
    db_item = models.ActionItem(
        transcription_id=transcription_id,
        task=action_item.task,
        owner=action_item.owner,
        due_date=action_item.due_date,
        is_manual=is_manual
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def update_action_item(db: Session, item_id: int, action_item_update: schemas.ActionItemUpdate):
    db_item = db.query(models.ActionItem).filter(models.ActionItem.id == item_id).first()
    if not db_item:
        return None
    
    # Update only provided fields
    if action_item_update.task is not None:
        db_item.task = action_item_update.task
    if action_item_update.owner is not None:
        db_item.owner = action_item_update.owner
    if action_item_update.due_date is not None:
        db_item.due_date = action_item_update.due_date
    if action_item_update.status is not None:
        db_item.status = action_item_update.status
    if action_item_update.priority is not None:
        db_item.priority = action_item_update.priority
    if action_item_update.notes is not None:
        db_item.notes = action_item_update.notes
    
    db_item.is_manual = True
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_action_item(db: Session, item_id: int):
    db_item = db.query(models.ActionItem).filter(models.ActionItem.id == item_id).first()
    if not db_item:
        return None
    db.delete(db_item)
    db.commit()
    return db_item

def update_meeting_processing_details(db: Session, meeting_id: int, **kwargs):
    """Update meeting processing details like stage, progress, error messages, etc."""
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not db_meeting:
        return None
    
    # Handle processing_logs specially to append instead of replace, but limit total length
    if 'processing_logs' in kwargs:
        new_logs = kwargs.pop('processing_logs')
        if isinstance(new_logs, list):
            new_logs_str = '\n'.join(new_logs)
        else:
            new_logs_str = str(new_logs)
            
        if db_meeting.processing_logs is None:
            db_meeting.processing_logs = new_logs_str
        else:
            # Append new logs to existing ones
            combined_logs = db_meeting.processing_logs + '\n' + new_logs_str
            # Keep only the last 50 lines to prevent infinite growth
            lines = combined_logs.split('\n')
            if len(lines) > 50:
                lines = lines[-50:]
            db_meeting.processing_logs = '\n'.join(lines)
    
    # Update timestamp fields automatically
    if 'processing_start_time' in kwargs and isinstance(kwargs['processing_start_time'], (int, float)):
        from datetime import datetime
        kwargs['processing_start_time'] = datetime.fromtimestamp(kwargs['processing_start_time'])
    
    if 'stage_start_time' in kwargs and isinstance(kwargs['stage_start_time'], (int, float)):
        from datetime import datetime
        kwargs['stage_start_time'] = datetime.fromtimestamp(kwargs['stage_start_time'])
    
    # Update any other provided fields
    for key, value in kwargs.items():
        if hasattr(db_meeting, key):
            setattr(db_meeting, key, value)
    
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

# Diarization timing CRUD operations
def create_diarization_timing(db: Session, meeting_id: int, audio_duration_seconds: float, 
                             processing_time_seconds: float, num_speakers: int = None, 
                             file_size_bytes: int = None):
    """Record diarization timing data for future predictions."""
    db_timing = models.DiarizationTiming(
        meeting_id=meeting_id,
        audio_duration_seconds=audio_duration_seconds,
        processing_time_seconds=processing_time_seconds,
        num_speakers=num_speakers,
        file_size_bytes=file_size_bytes
    )
    db.add(db_timing)
    db.commit()
    db.refresh(db_timing)
    return db_timing

def get_diarization_timings(db: Session, limit: int = 20):
    """Get recent diarization timing data for calculating averages."""
    return db.query(models.DiarizationTiming).order_by(models.DiarizationTiming.created_at.desc()).limit(limit).all()

def get_average_diarization_rate(db: Session, limit: int = 10):
    """Calculate average processing rate (seconds of processing per second of audio)."""
    timings = get_diarization_timings(db, limit)
    if not timings:
        return None
    
    rates = []
    for timing in timings:
        if timing.audio_duration_seconds > 0:
            rate = timing.processing_time_seconds / timing.audio_duration_seconds
            rates.append(rate)
    
    return sum(rates) / len(rates) if rates else None

# API Key CRUD operations
def get_api_keys(db: Session):
    return db.query(models.APIKey).filter(models.APIKey.is_active == True).all()

def get_api_key(db: Session, key_id: int):
    return db.query(models.APIKey).filter(models.APIKey.id == key_id).first()

def get_api_key_by_name(db: Session, name: str):
    return db.query(models.APIKey).filter(models.APIKey.name == name).first()

def get_api_keys_by_provider(db: Session, provider: str):
    return db.query(models.APIKey).filter(
        models.APIKey.provider == provider,
        models.APIKey.is_active == True
    ).all()

def create_api_key(db: Session, api_key: schemas.APIKeyCreate):
    db_api_key = models.APIKey(**api_key.dict())
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    return db_api_key

def update_api_key(db: Session, key_id: int, api_key_update: schemas.APIKeyUpdate):
    db_api_key = get_api_key(db, key_id)
    if not db_api_key:
        return None
    
    update_data = api_key_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_api_key, field, value)
    
    db.commit()
    db.refresh(db_api_key)
    return db_api_key

def delete_api_key(db: Session, key_id: int):
    db_api_key = get_api_key(db, key_id)
    if not db_api_key:
        return None
    
    # Soft delete by setting is_active to False
    db_api_key.is_active = False
    db.commit()
    return db_api_key

# Model Configuration CRUD operations
def get_model_configurations(db: Session):
    """Get all model configurations"""
    return db.query(models.ModelConfiguration).all()

def get_model_configuration(db: Session, config_id: int):
    """Get a specific model configuration by ID"""
    return db.query(models.ModelConfiguration).filter(models.ModelConfiguration.id == config_id).first()

def get_model_configuration_by_name(db: Session, name: str):
    """Get a model configuration by name"""
    return db.query(models.ModelConfiguration).filter(models.ModelConfiguration.name == name).first()

def get_default_model_configuration(db: Session):
    """Get the default model configuration"""
    return db.query(models.ModelConfiguration).filter(models.ModelConfiguration.is_default == True).first()

def create_model_configuration(db: Session, config: schemas.ModelConfigurationCreate):
    """Create a new model configuration"""
    config_dict = config.dict()
    
    # Handle environment-based API keys (negative IDs) by setting them to None
    # This allows the foreign key constraint to pass while preserving the logic
    if config_dict.get("chat_api_key_id") and config_dict["chat_api_key_id"] < 0:
        config_dict["chat_api_key_id"] = None
    if config_dict.get("analysis_api_key_id") and config_dict["analysis_api_key_id"] < 0:
        config_dict["analysis_api_key_id"] = None
    
    db_config = models.ModelConfiguration(**config_dict)
    
    # If this is the first configuration or explicitly set as default, make it default
    if config.is_default or not get_model_configurations(db):
        # Unset any existing default
        db.query(models.ModelConfiguration).update({models.ModelConfiguration.is_default: False})
        db_config.is_default = True
    
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_model_configuration(db: Session, config_id: int, config_update: schemas.ModelConfigurationUpdate):
    """Update a model configuration"""
    db_config = get_model_configuration(db, config_id)
    if not db_config:
        return None
    
    update_data = config_update.dict(exclude_unset=True)
    
    # Handle environment-based API keys (negative IDs) by setting them to None
    if "chat_api_key_id" in update_data and update_data["chat_api_key_id"] and update_data["chat_api_key_id"] < 0:
        update_data["chat_api_key_id"] = None
    if "analysis_api_key_id" in update_data and update_data["analysis_api_key_id"] and update_data["analysis_api_key_id"] < 0:
        update_data["analysis_api_key_id"] = None
    
    for field, value in update_data.items():
        setattr(db_config, field, value)
    
    # Handle default setting
    if config_update.is_default:
        # Unset any existing default
        db.query(models.ModelConfiguration).update({models.ModelConfiguration.is_default: False})
        db_config.is_default = True
    
    db.commit()
    db.refresh(db_config)
    return db_config

def delete_model_configuration(db: Session, config_id: int):
    """Delete a model configuration"""
    db_config = get_model_configuration(db, config_id)
    if db_config:
        db.delete(db_config)
        db.commit()
    return db_config

def set_default_model_configuration(db: Session, config_id: int):
    """Set a model configuration as default"""
    # Unset any existing default
    db.query(models.ModelConfiguration).update({models.ModelConfiguration.is_default: False})
    
    # Set the new default
    db_config = get_model_configuration(db, config_id)
    if db_config:
        db_config.is_default = True
        db.commit()
        db.refresh(db_config)
    
    return db_config

# Chat Message CRUD operations
def create_chat_message(db: Session, meeting_id: int, role: str, content: str):
    """Create a new chat message"""
    db_message = models.ChatMessage(
        meeting_id=meeting_id,
        role=role,
        content=content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_chat_history(db: Session, meeting_id: int, limit: int = 50):
    """Get chat history for a meeting"""
    return db.query(models.ChatMessage).filter(
        models.ChatMessage.meeting_id == meeting_id
    ).order_by(models.ChatMessage.created_at.asc()).limit(limit).all()

def clear_chat_history(db: Session, meeting_id: int):
    """Clear all chat messages for a meeting"""
    db.query(models.ChatMessage).filter(
        models.ChatMessage.meeting_id == meeting_id
    ).delete()
    db.commit()

# Action Items - Additional CRUD operations
def get_action_item(db: Session, item_id: int):
    """Get a single action item by ID"""
    return db.query(models.ActionItem).filter(models.ActionItem.id == item_id).first()

def get_all_action_items(db: Session, skip: int = 0, limit: int = 1000, status: str = None):
    """Get all action items across all meetings with optional status filter"""
    query = db.query(models.ActionItem)
    if status:
        query = query.filter(models.ActionItem.status == status)
    return query.offset(skip).limit(limit).all()

def update_action_item_calendar_sync(db: Session, item_id: int, event_id: str = None, synced: bool = False):
    """Update action item calendar sync status"""
    from datetime import datetime
    db_item = get_action_item(db, item_id)
    if not db_item:
        return None
    
    db_item.google_calendar_event_id = event_id
    db_item.synced_to_calendar = synced
    db_item.last_synced_at = datetime.now()
    db.commit()
    db.refresh(db_item)
    return db_item

# Google Calendar Credentials CRUD operations
def get_google_calendar_credentials(db: Session, user_id: str = "default"):
    """Get Google Calendar credentials for a user"""
    return db.query(models.GoogleCalendarCredentials).filter(
        models.GoogleCalendarCredentials.user_id == user_id,
        models.GoogleCalendarCredentials.is_active == True
    ).first()

def save_google_calendar_credentials(db: Session, credentials_json: str, calendar_id: str = "primary", user_id: str = "default"):
    """Save or update Google Calendar credentials"""
    # Deactivate existing credentials
    db.query(models.GoogleCalendarCredentials).filter(
        models.GoogleCalendarCredentials.user_id == user_id
    ).update({"is_active": False})
    
    # Create new credentials
    db_creds = models.GoogleCalendarCredentials(
        user_id=user_id,
        credentials_json=credentials_json,
        calendar_id=calendar_id,
        is_active=True
    )
    db.add(db_creds)
    db.commit()
    db.refresh(db_creds)
    return db_creds

def delete_google_calendar_credentials(db: Session, user_id: str = "default"):
    """Delete Google Calendar credentials"""
    db.query(models.GoogleCalendarCredentials).filter(
        models.GoogleCalendarCredentials.user_id == user_id
    ).delete()
    db.commit()

# Attachment CRUD operations
def get_attachment(db: Session, attachment_id: int):
    """Get a single attachment by ID"""
    return db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()

def get_meeting_attachments(db: Session, meeting_id: int):
    """Get all attachments for a meeting"""
    return db.query(models.Attachment).filter(models.Attachment.meeting_id == meeting_id).all()

def create_attachment(db: Session, meeting_id: int, filename: str, filepath: str, file_size: int = None, mime_type: str = None, description: str = None):
    """Create a new attachment"""
    db_attachment = models.Attachment(
        meeting_id=meeting_id,
        filename=filename,
        filepath=filepath,
        file_size=file_size,
        mime_type=mime_type,
        description=description
    )
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)
    return db_attachment

def update_attachment(db: Session, attachment_id: int, description: str = None):
    """Update attachment description"""
    db_attachment = get_attachment(db, attachment_id)
    if db_attachment and description is not None:
        db_attachment.description = description
        db.commit()
        db.refresh(db_attachment)
    return db_attachment

def delete_attachment(db: Session, attachment_id: int):
    """Delete an attachment"""
    db_attachment = get_attachment(db, attachment_id)
    if db_attachment:
        db.delete(db_attachment)
        db.commit()
    return db_attachment

# Embedding configuration CRUD
def list_embedding_configurations(db: Session):
    return db.query(models.EmbeddingConfiguration).order_by(models.EmbeddingConfiguration.created_at.desc()).all()

def get_embedding_configuration(db: Session, config_id: int):
    return db.query(models.EmbeddingConfiguration).filter(models.EmbeddingConfiguration.id == config_id).first()

def get_active_embedding_configuration(db: Session):
    return (
        db.query(models.EmbeddingConfiguration)
        .filter(models.EmbeddingConfiguration.is_active == True)
        .order_by(models.EmbeddingConfiguration.updated_at.desc())
        .first()
    )

def create_embedding_configuration(db: Session, config: schemas.EmbeddingConfigurationCreate):
    if config.is_active:
        db.query(models.EmbeddingConfiguration).update({models.EmbeddingConfiguration.is_active: False})
    db_config = models.EmbeddingConfiguration(**config.dict())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config

def update_embedding_configuration(db: Session, config_id: int, config_update: schemas.EmbeddingConfigurationUpdate):
    db_config = get_embedding_configuration(db, config_id)
    if not db_config:
        return None
    update_data = config_update.dict(exclude_unset=True)
    if update_data.get("is_active"):
        db.query(models.EmbeddingConfiguration).update({models.EmbeddingConfiguration.is_active: False})
    for field, value in update_data.items():
        setattr(db_config, field, value)
    db.commit()
    db.refresh(db_config)
    return db_config

def delete_embedding_configuration(db: Session, config_id: int):
    db_config = get_embedding_configuration(db, config_id)
    if not db_config:
        return None
    db.delete(db_config)
    db.commit()
    return db_config

def clear_meeting_chunks(db: Session, meeting_id: int):
    db.query(models.DocumentChunk).filter(models.DocumentChunk.meeting_id == meeting_id).delete()
    db.commit()

def add_document_chunks(db: Session, chunks: list[models.DocumentChunk]):
    if not chunks:
        return []
    db.add_all(chunks)
    db.commit()
    for chunk in chunks:
        db.refresh(chunk)
    return chunks

def get_document_chunks(db: Session, meeting_id: int | None = None):
    query = db.query(models.DocumentChunk)
    if meeting_id is not None:
        query = query.filter(models.DocumentChunk.meeting_id == meeting_id)
    return query.order_by(asc(models.DocumentChunk.chunk_index)).all()

# Worker configuration helpers
def get_worker_configuration(db: Session):
    config = db.query(models.WorkerConfiguration).order_by(models.WorkerConfiguration.created_at.desc()).first()
    if config:
        return config
    config = models.WorkerConfiguration(max_workers=1)
    db.add(config)
    db.commit()
    db.refresh(config)
    return config

def set_worker_configuration(db: Session, max_workers: int):
    config = get_worker_configuration(db)
    config.max_workers = max_workers
    db.commit()
    db.refresh(config)
    return config

# Global chat helpers
def list_global_chat_sessions(db: Session):
    return db.query(models.GlobalChatSession).order_by(models.GlobalChatSession.updated_at.desc()).all()

def create_global_chat_session(db: Session, title: str | None = None):
    session = models.GlobalChatSession(title=title or "New chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def get_global_chat_session(db: Session, session_id: int):
    return db.query(models.GlobalChatSession).filter(models.GlobalChatSession.id == session_id).first()

def delete_global_chat_session(db: Session, session_id: int):
    session = get_global_chat_session(db, session_id)
    if not session:
        return None
    db.delete(session)
    db.commit()
    return session

def add_global_chat_message(db: Session, session_id: int, role: str, content: str, sources: list | None = None):
    message = models.GlobalChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        sources=sources or []
    )
    db.add(message)
    session = get_global_chat_session(db, session_id)
    if session:
        session.updated_at = func.now()
    db.commit()
    db.refresh(message)
    return message

def get_global_chat_messages(db: Session, session_id: int):
    return (
        db.query(models.GlobalChatMessage)
        .filter(models.GlobalChatMessage.session_id == session_id)
        .order_by(models.GlobalChatMessage.created_at.asc())
        .all()
    )
