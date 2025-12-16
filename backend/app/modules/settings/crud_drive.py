"""
CRUD operations for Google Drive integration.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from .models_drive import GoogleDriveCredentials, GoogleDriveSyncConfig, GoogleDriveProcessedFile


# Google Drive Credentials
def get_google_drive_credentials(db: Session, user_id: str = "default") -> Optional[GoogleDriveCredentials]:
    """Retrieve Google Drive credentials for a user."""
    return db.query(GoogleDriveCredentials).filter(GoogleDriveCredentials.user_id == user_id).first()


def save_google_drive_credentials(db: Session, credentials_json: str, user_id: str = "default") -> GoogleDriveCredentials:
    """Save or update Google Drive credentials for a user."""
    existing = get_google_drive_credentials(db, user_id)
    
    if existing:
        existing.credentials_json = credentials_json
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        credentials = GoogleDriveCredentials(
            user_id=user_id,
            credentials_json=credentials_json
        )
        db.add(credentials)
        db.commit()
        db.refresh(credentials)
        return credentials


def delete_google_drive_credentials(db: Session, user_id: str = "default") -> bool:
    """Delete Google Drive credentials for a user."""
    existing = get_google_drive_credentials(db, user_id)
    if existing:
        db.delete(existing)
        db.commit()
        return True
    return False


# Google Drive Sync Configuration
def get_google_drive_sync_config(db: Session, user_id: str = "default") -> Optional[GoogleDriveSyncConfig]:
    """Retrieve Google Drive sync configuration for a user."""
    return db.query(GoogleDriveSyncConfig).filter(GoogleDriveSyncConfig.user_id == user_id).first()


def save_google_drive_sync_config(
    db: Session,
    sync_folder_id: Optional[str] = None,
    processed_folder_id: Optional[str] = None,
    enabled: bool = False,
    auto_process: bool = True,
    sync_mode: str = "manual",
    sync_time: str = "04:00",
    user_id: str = "default"
) -> GoogleDriveSyncConfig:
    """Save or update Google Drive sync configuration."""
    existing = get_google_drive_sync_config(db, user_id)
    
    if existing:
        if sync_folder_id is not None:
            existing.sync_folder_id = sync_folder_id
        if processed_folder_id is not None:
            existing.processed_folder_id = processed_folder_id
        existing.enabled = enabled
        existing.auto_process = auto_process
        existing.sync_mode = sync_mode
        existing.sync_time = sync_time
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        config = GoogleDriveSyncConfig(
            user_id=user_id,
            sync_folder_id=sync_folder_id,
            processed_folder_id=processed_folder_id,
            enabled=enabled,
            auto_process=auto_process,
            sync_mode=sync_mode,
            sync_time=sync_time
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config


def update_sync_last_run(db: Session, user_id: str = "default") -> None:
    """Update the last sync timestamp."""
    config = get_google_drive_sync_config(db, user_id)
    if config:
        config.last_sync_at = datetime.utcnow()
        db.commit()


# Google Drive Processed Files
def is_file_processed(db: Session, drive_file_id: str) -> bool:
    """Check if a file has already been processed."""
    return db.query(GoogleDriveProcessedFile).filter(
        GoogleDriveProcessedFile.drive_file_id == drive_file_id
    ).first() is not None


def mark_file_as_processed(
    db: Session,
    drive_file_id: str,
    drive_file_name: str,
    meeting_id: Optional[int] = None,
    moved_to_processed: bool = False
) -> GoogleDriveProcessedFile:
    """Mark a file as processed."""
    processed_file = GoogleDriveProcessedFile(
        drive_file_id=drive_file_id,
        drive_file_name=drive_file_name,
        meeting_id=meeting_id,
        moved_to_processed=moved_to_processed
    )
    db.add(processed_file)
    db.commit()
    db.refresh(processed_file)
    return processed_file


def update_processed_file_meeting(db: Session, drive_file_id: str, meeting_id: int) -> Optional[GoogleDriveProcessedFile]:
    """Update the meeting ID for a processed file."""
    processed_file = db.query(GoogleDriveProcessedFile).filter(
        GoogleDriveProcessedFile.drive_file_id == drive_file_id
    ).first()
    
    if processed_file:
        processed_file.meeting_id = meeting_id
        db.commit()
        db.refresh(processed_file)
        return processed_file
    return None


def mark_file_moved_to_processed(db: Session, drive_file_id: str) -> Optional[GoogleDriveProcessedFile]:
    """Mark that a file has been moved to the processed folder."""
    processed_file = db.query(GoogleDriveProcessedFile).filter(
        GoogleDriveProcessedFile.drive_file_id == drive_file_id
    ).first()
    
    if processed_file:
        processed_file.moved_to_processed = True
        db.commit()
        db.refresh(processed_file)
        return processed_file
    return None


def get_processed_files(db: Session, limit: int = 100) -> List[GoogleDriveProcessedFile]:
    """Get a list of processed files."""
    return db.query(GoogleDriveProcessedFile).order_by(
        GoogleDriveProcessedFile.processed_at.desc()
    ).limit(limit).all()
