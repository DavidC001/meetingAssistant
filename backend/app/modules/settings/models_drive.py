"""
Database models for Google Drive integration.
"""

from sqlalchemy import Column, String, DateTime, Boolean, Integer
from sqlalchemy.sql import func

from ...database import Base


class GoogleDriveCredentials(Base):
    """Model for storing Google Drive OAuth credentials."""
    
    __tablename__ = "google_drive_credentials"
    
    user_id = Column(String, primary_key=True, index=True, default="default")
    credentials_json = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class GoogleDriveSyncConfig(Base):
    """Model for storing Google Drive synchronization configuration."""
    
    __tablename__ = "google_drive_sync_config"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, default="default")
    sync_folder_id = Column(String, nullable=True)
    processed_folder_id = Column(String, nullable=True)
    enabled = Column(Boolean, default=False)
    auto_process = Column(Boolean, default=True)
    sync_mode = Column(String, default="manual")  # 'manual' or 'scheduled'
    sync_time = Column(String, default="04:00")  # Time in HH:MM format (24-hour)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class GoogleDriveProcessedFile(Base):
    """Model for tracking files that have been processed from Google Drive."""
    
    __tablename__ = "google_drive_processed_files"
    
    id = Column(Integer, primary_key=True, index=True)
    drive_file_id = Column(String, unique=True, index=True, nullable=False)
    drive_file_name = Column(String, nullable=False)
    meeting_id = Column(Integer, nullable=True)  # Reference to the created meeting
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
    moved_to_processed = Column(Boolean, default=False)
