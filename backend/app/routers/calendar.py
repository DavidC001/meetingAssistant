"""
Calendar router for managing action items and Google Calendar integration.

This module provides endpoints for:
- Viewing and managing action items in a calendar view
- Syncing action items with Google Calendar
- Authenticating with Google Calendar
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from ..core.google_calendar import GoogleCalendarService

router = APIRouter(
    prefix="/calendar",
    tags=["calendar"],
)


@router.get("/action-items", response_model=List[schemas.ActionItem])
def get_all_action_items(
    status: Optional[str] = Query(None, description="Filter by status: pending, in_progress, completed, cancelled"),
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    """
    Get all action items across all meetings.
    Useful for calendar view that shows all action items.
    """
    action_items = crud.get_all_action_items(db, skip=skip, limit=limit, status=status)
    return action_items


@router.get("/action-items/{item_id}", response_model=schemas.ActionItem)
def get_action_item(
    item_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific action item by ID."""
    action_item = crud.get_action_item(db, item_id)
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    return action_item


@router.put("/action-items/{item_id}", response_model=schemas.ActionItem)
def update_action_item(
    item_id: int,
    action_item_update: schemas.ActionItemUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an action item (e.g., change due date, status, priority, etc.).
    This is useful for drag-and-drop calendar interactions.
    """
    action_item = crud.update_action_item(db, item_id, action_item_update)
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    # If the item is synced to Google Calendar, update the event
    if action_item.synced_to_calendar and action_item.google_calendar_event_id:
        try:
            calendar_service = GoogleCalendarService(db)
            if calendar_service.is_connected():
                # Get meeting title for context
                transcription = db.query(models.Transcription).filter(
                    models.Transcription.id == action_item.transcription_id
                ).first()
                meeting_title = None
                if transcription and transcription.meeting:
                    meeting_title = transcription.meeting.filename
                
                calendar_service.update_event(
                    action_item.google_calendar_event_id,
                    action_item,
                    meeting_title
                )
        except Exception as e:
            print(f"Error updating Google Calendar event: {e}")
            # Don't fail the request if calendar sync fails
    
    return action_item


# Google Calendar Authentication Endpoints

@router.get("/google/status", response_model=schemas.GoogleCalendarStatus)
def get_google_calendar_status(db: Session = Depends(get_db)):
    """Check if Google Calendar is connected."""
    calendar_service = GoogleCalendarService(db)
    
    if not calendar_service.is_connected():
        return schemas.GoogleCalendarStatus(is_connected=False)
    
    user_info = calendar_service.get_user_info()
    return schemas.GoogleCalendarStatus(
        is_connected=True,
        calendar_id="primary",
        email=user_info.get('email') if user_info else None
    )


@router.get("/google/auth-url", response_model=schemas.GoogleCalendarAuthUrl)
def get_google_auth_url(db: Session = Depends(get_db)):
    """Get the Google Calendar OAuth2 authorization URL."""
    try:
        calendar_service = GoogleCalendarService(db)
        auth_url = calendar_service.get_authorization_url()
        return schemas.GoogleCalendarAuthUrl(auth_url=auth_url)
    except ValueError as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/google/authorize")
def authorize_google_calendar(
    auth_code: schemas.GoogleCalendarAuthCode,
    db: Session = Depends(get_db)
):
    """Complete Google Calendar OAuth2 authorization."""
    calendar_service = GoogleCalendarService(db)
    
    success = calendar_service.authorize_with_code(auth_code.code)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Failed to authorize with Google Calendar"
        )
    
    return {"message": "Successfully connected to Google Calendar"}


@router.post("/google/disconnect")
def disconnect_google_calendar(db: Session = Depends(get_db)):
    """Disconnect from Google Calendar."""
    calendar_service = GoogleCalendarService(db)
    calendar_service.disconnect()
    return {"message": "Disconnected from Google Calendar"}


# Action Item Sync Endpoints

@router.post("/action-items/{item_id}/sync")
def sync_action_item_to_calendar(
    item_id: int,
    db: Session = Depends(get_db)
):
    """Sync a specific action item to Google Calendar."""
    calendar_service = GoogleCalendarService(db)
    
    if not calendar_service.is_connected():
        raise HTTPException(
            status_code=400,
            detail="Not connected to Google Calendar. Please authorize first."
        )
    
    action_item = crud.get_action_item(db, item_id)
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    # Get meeting title for context
    transcription = db.query(models.Transcription).filter(
        models.Transcription.id == action_item.transcription_id
    ).first()
    meeting_title = None
    if transcription and transcription.meeting:
        meeting_title = transcription.meeting.filename
    
    try:
        # If already synced, update; otherwise create new
        if action_item.synced_to_calendar and action_item.google_calendar_event_id:
            calendar_service.update_event(
                action_item.google_calendar_event_id,
                action_item,
                meeting_title
            )
        else:
            event_id = calendar_service.create_event_from_action_item(
                action_item,
                meeting_title
            )
            crud.update_action_item_calendar_sync(db, item_id, event_id, True)
        
        return {"message": "Action item synced to Google Calendar", "event_id": action_item.google_calendar_event_id}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync to Google Calendar: {str(e)}"
        )


@router.delete("/action-items/{item_id}/sync")
def unsync_action_item_from_calendar(
    item_id: int,
    db: Session = Depends(get_db)
):
    """Remove an action item from Google Calendar."""
    calendar_service = GoogleCalendarService(db)
    
    action_item = crud.get_action_item(db, item_id)
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    
    if not action_item.synced_to_calendar or not action_item.google_calendar_event_id:
        raise HTTPException(status_code=400, detail="Action item is not synced to calendar")
    
    if not calendar_service.is_connected():
        # Just update the database status if not connected
        crud.update_action_item_calendar_sync(db, item_id, None, False)
        return {"message": "Action item marked as unsynced (Google Calendar not connected)"}
    
    try:
        calendar_service.delete_event(action_item.google_calendar_event_id)
        crud.update_action_item_calendar_sync(db, item_id, None, False)
        return {"message": "Action item removed from Google Calendar"}
    except Exception as e:
        # Update database even if deletion fails
        crud.update_action_item_calendar_sync(db, item_id, None, False)
        return {"message": f"Action item marked as unsynced, but calendar deletion failed: {str(e)}"}


@router.post("/sync-all")
def sync_all_action_items(
    status: Optional[str] = Query("pending", description="Sync items with this status"),
    db: Session = Depends(get_db)
):
    """Sync all pending action items to Google Calendar."""
    calendar_service = GoogleCalendarService(db)
    
    if not calendar_service.is_connected():
        raise HTTPException(
            status_code=400,
            detail="Not connected to Google Calendar. Please authorize first."
        )
    
    action_items = crud.get_all_action_items(db, status=status)
    
    synced_count = 0
    failed_count = 0
    
    for action_item in action_items:
        if action_item.synced_to_calendar:
            continue  # Skip already synced items
        
        # Get meeting title
        transcription = db.query(models.Transcription).filter(
            models.Transcription.id == action_item.transcription_id
        ).first()
        meeting_title = None
        if transcription and transcription.meeting:
            meeting_title = transcription.meeting.filename
        
        try:
            event_id = calendar_service.create_event_from_action_item(
                action_item,
                meeting_title
            )
            crud.update_action_item_calendar_sync(db, action_item.id, event_id, True)
            synced_count += 1
        except Exception as e:
            print(f"Failed to sync action item {action_item.id}: {e}")
            failed_count += 1
    
    return {
        "message": f"Synced {synced_count} action items to Google Calendar",
        "synced": synced_count,
        "failed": failed_count
    }
