"""
Google Drive integration router.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...core.integrations.google_drive import GoogleDriveService
from ...database import get_db
from . import crud_drive

router = APIRouter(
    prefix="/google-drive",
    tags=["google-drive"],
)


# Pydantic schemas
class GoogleDriveAuthResponse(BaseModel):
    """Response for Google Drive authorization."""

    auth_url: str


class GoogleDriveStatusResponse(BaseModel):
    """Response for Google Drive status."""

    authenticated: bool
    configured: bool
    sync_enabled: bool
    sync_folder_id: str | None
    processed_folder_id: str | None
    last_sync_at: datetime | None
    sync_mode: str
    sync_time: str


class GoogleDriveSyncConfigRequest(BaseModel):
    """Request to update Google Drive sync configuration."""

    sync_folder_id: str | None = None
    processed_folder_id: str | None = None
    enabled: bool = False
    auto_process: bool = True
    sync_mode: str = "manual"
    sync_time: str = "04:00"


class GoogleDriveFileInfo(BaseModel):
    """Information about a Google Drive file."""

    id: str
    name: str
    mimeType: str
    size: str | None
    createdTime: str
    modifiedTime: str
    webViewLink: str


class ProcessedFileInfo(BaseModel):
    """Information about a processed file."""

    drive_file_id: str
    drive_file_name: str
    meeting_id: int | None
    processed_at: datetime
    moved_to_processed: bool


@router.get("/auth", response_model=GoogleDriveAuthResponse)
def get_google_drive_auth_url(db: Session = Depends(get_db)):
    """Get the Google Drive OAuth authorization URL."""
    service = GoogleDriveService(db)

    try:
        auth_url = service.get_authorization_url()
        return GoogleDriveAuthResponse(auth_url=auth_url)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/callback")
def handle_google_drive_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Handle the OAuth2 callback from Google Drive."""
    service = GoogleDriveService(db)

    try:
        # Prefer using the code directly to avoid state persistence issues
        success = service.handle_oauth_callback(code=code)
        if success:
            return {"message": "Successfully authenticated with Google Drive", "authenticated": True}
        else:
            raise HTTPException(status_code=400, detail="Failed to authenticate with Google Drive")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")


@router.post("/disconnect")
def disconnect_google_drive(db: Session = Depends(get_db)):
    """Disconnect from Google Drive by removing stored credentials."""
    service = GoogleDriveService(db)
    service.disconnect()
    return {"message": "Successfully disconnected from Google Drive", "authenticated": False}


@router.get("/status", response_model=GoogleDriveStatusResponse)
def get_google_drive_status(db: Session = Depends(get_db)):
    """Get the current status of Google Drive integration."""
    service = GoogleDriveService(db)
    config = crud_drive.get_google_drive_sync_config(db)

    return GoogleDriveStatusResponse(
        authenticated=service.is_authenticated(),
        configured=config is not None and config.sync_folder_id is not None,
        sync_enabled=config.enabled if config else False,
        sync_folder_id=config.sync_folder_id if config else None,
        processed_folder_id=config.processed_folder_id if config else None,
        last_sync_at=config.last_sync_at if config else None,
        sync_mode=config.sync_mode if config else "manual",
        sync_time=config.sync_time if config else "04:00",
    )


@router.post("/config")
def update_google_drive_config(config: GoogleDriveSyncConfigRequest, db: Session = Depends(get_db)):
    """Update Google Drive sync configuration."""
    service = GoogleDriveService(db)

    if not service.is_authenticated():
        raise HTTPException(status_code=401, detail="Not authenticated with Google Drive")

    # If enabling sync, validate that folders are configured
    if config.enabled and not config.sync_folder_id:
        raise HTTPException(status_code=400, detail="Sync folder ID is required when enabling sync")

    # Save configuration to database
    db_config = crud_drive.save_google_drive_sync_config(
        db,
        sync_folder_id=config.sync_folder_id,
        processed_folder_id=config.processed_folder_id,
        enabled=config.enabled,
        auto_process=config.auto_process,
        sync_mode=config.sync_mode,
        sync_time=config.sync_time,
    )

    return {
        "message": "Google Drive sync configuration updated",
        "config": {
            "sync_folder_id": db_config.sync_folder_id,
            "processed_folder_id": db_config.processed_folder_id,
            "enabled": db_config.enabled,
            "auto_process": db_config.auto_process,
            "sync_mode": db_config.sync_mode,
            "sync_time": db_config.sync_time,
        },
    }


@router.get("/folders/{folder_id}/files", response_model=list[GoogleDriveFileInfo])
def list_files_in_folder(folder_id: str, db: Session = Depends(get_db)):
    """List all files in a specific Google Drive folder."""
    service = GoogleDriveService(db)

    if not service.is_authenticated():
        raise HTTPException(status_code=401, detail="Not authenticated with Google Drive")

    try:
        files = service.list_files_in_folder(folder_id)
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")


@router.post("/sync")
def trigger_sync(db: Session = Depends(get_db)):
    """Manually trigger a Google Drive sync."""
    from ...tasks import sync_google_drive_folder

    service = GoogleDriveService(db)
    config = crud_drive.get_google_drive_sync_config(db)

    if not service.is_authenticated():
        raise HTTPException(status_code=401, detail="Not authenticated with Google Drive")

    if not config or not config.sync_folder_id:
        raise HTTPException(status_code=400, detail="Google Drive sync is not configured")

    # Trigger the background sync task with force=True for manual triggers
    task_result = sync_google_drive_folder.apply_async(args=[True])

    return {"message": "Google Drive sync started", "task_id": task_result.id}


@router.get("/processed-files", response_model=list[ProcessedFileInfo])
def get_processed_files(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    """Get a list of files that have been processed from Google Drive."""
    files = crud_drive.get_processed_files(db, limit=limit)
    return files
