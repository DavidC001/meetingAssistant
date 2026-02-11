"""
Calendar module router.
Manages calendar action items and Google Calendar integration.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ... import models
from ...core.integrations.google_calendar import GoogleCalendarService
from ...database import get_db
from ..meetings import crud as meetings_crud
from ..meetings import schemas as meetings_schemas
from . import crud, schemas

# Main router that includes sub-routers
router = APIRouter()

# Sub-router for /calendar endpoints
calendar_router = APIRouter(
    prefix="/calendar",
    tags=["calendar"],
)


# --- Calendar Router Endpoints ---


@calendar_router.get("/action-items", response_model=list[meetings_schemas.ActionItemWithMeeting])
def get_all_action_items(
    status: str | None = Query(None, description="Filter by status: pending, in_progress, completed, cancelled"),
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
):
    """
    Get all action items across all meetings with meeting information.
    Useful for calendar view that shows all action items with their source meeting.
    """
    action_items = meetings_crud.get_all_action_items(db, skip=skip, limit=limit, status=status)

    # Enrich action items with meeting information
    result = []
    for item in action_items:
        item_dict = {
            "id": item.id,
            "transcription_id": item.transcription_id,
            "task": item.task,
            "owner": item.owner,
            "due_date": item.due_date,
            "status": item.status,
            "priority": item.priority,
            "notes": item.notes,
            "is_manual": item.is_manual,
            "google_calendar_event_id": item.google_calendar_event_id,
            "synced_to_calendar": item.synced_to_calendar,
            "last_synced_at": item.last_synced_at,
            "meeting_id": None,
            "meeting_title": None,
            "meeting_date": None,
        }

        # Get meeting info through transcription relationship
        if item.transcription and item.transcription.meeting:
            meeting = item.transcription.meeting
            item_dict["meeting_id"] = meeting.id
            item_dict["meeting_title"] = meeting.filename
            item_dict["meeting_date"] = meeting.meeting_date

        result.append(item_dict)

    return result


@calendar_router.get("/action-items/{item_id}", response_model=meetings_schemas.ActionItem)
def get_action_item(item_id: int, db: Session = Depends(get_db)):
    """Get a specific action item by ID."""
    action_item = meetings_crud.get_action_item(db, item_id)
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    return action_item


@calendar_router.post("/action-items", response_model=meetings_schemas.ActionItem)
def create_standalone_action_item(action_item: meetings_schemas.ActionItemCreate, db: Session = Depends(get_db)):
    """
    Create a standalone action item not tied to any specific meeting.
    This is useful for creating tasks directly from the calendar view.
    """
    # Create action item without a transcription_id (standalone task)
    db_action_item = models.ActionItem(
        transcription_id=None,
        task=action_item.task,
        owner=action_item.owner,
        due_date=action_item.due_date,
        status=action_item.status or "pending",
        priority=action_item.priority,
        notes=action_item.notes,
        is_manual=True,
        synced_to_calendar=False,
    )
    db.add(db_action_item)
    db.commit()
    db.refresh(db_action_item)

    return db_action_item


@calendar_router.put("/action-items/{item_id}", response_model=meetings_schemas.ActionItem)
def update_action_item(
    item_id: int, action_item_update: meetings_schemas.ActionItemUpdate, db: Session = Depends(get_db)
):
    """
    Update an action item (e.g., change due date, status, priority, etc.).
    This is useful for drag-and-drop calendar interactions.
    """
    action_item = meetings_crud.update_action_item(db, item_id, action_item_update)
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")

    # If the item is synced to Google Calendar, update the event
    if action_item.synced_to_calendar and action_item.google_calendar_event_id:
        try:
            calendar_service = GoogleCalendarService(db)
            if calendar_service.is_connected():
                # Verify the action item belongs to the current user before updating calendar
                user_info = calendar_service.get_user_info()
                user_email = user_info.get("email") if user_info else None

                if action_item.owner and user_email:
                    # Get email for the owner (handles both name and email formats)
                    owner_email = crud.get_email_for_name(db, action_item.owner)
                    item_owner = owner_email.strip().lower()
                    current_user = user_email.strip().lower()

                    if item_owner != current_user:
                        # Don't update calendar if task is not owned by current user
                        # Just return the updated action item without syncing
                        return action_item

                # Get meeting title for context
                transcription = (
                    db.query(models.Transcription)
                    .filter(models.Transcription.id == action_item.transcription_id)
                    .first()
                )
                meeting_title = None
                if transcription and transcription.meeting:
                    meeting_title = transcription.meeting.filename

                calendar_service.update_event(action_item.google_calendar_event_id, action_item, meeting_title)
        except Exception as e:
            print(f"Error updating Google Calendar event: {e}")
            # Don't fail the request if calendar sync fails

    return action_item


@calendar_router.delete("/action-items/{item_id}", status_code=204)
def delete_action_item(item_id: int, db: Session = Depends(get_db)):
    """
    Delete an action item.
    If the item is synced to Google Calendar, also removes the calendar event.
    """
    action_item = meetings_crud.get_action_item(db, item_id)
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")

    # If synced to Google Calendar, remove the event first
    if action_item.synced_to_calendar and action_item.google_calendar_event_id:
        try:
            calendar_service = GoogleCalendarService(db)
            if calendar_service.is_connected():
                calendar_service.delete_event(action_item.google_calendar_event_id)
        except Exception as e:
            print(f"Error deleting Google Calendar event: {e}")
            # Continue with deletion even if calendar sync fails

    # Delete from database
    meetings_crud.delete_action_item(db, item_id)
    return None


# Google Calendar Authentication Endpoints


@calendar_router.get("/google/status", response_model=schemas.GoogleCalendarStatus)
def get_google_calendar_status(db: Session = Depends(get_db)):
    """Check if Google Calendar is connected."""
    calendar_service = GoogleCalendarService(db)

    if not calendar_service.is_connected():
        return schemas.GoogleCalendarStatus(is_connected=False)

    user_info = calendar_service.get_user_info()
    return schemas.GoogleCalendarStatus(
        is_connected=True, calendar_id="primary", email=user_info.get("email") if user_info else None
    )


@calendar_router.get("/google/auth-url", response_model=schemas.GoogleCalendarAuthUrl)
def get_google_auth_url(db: Session = Depends(get_db)):
    """Get the Google Calendar OAuth2 authorization URL."""
    try:
        calendar_service = GoogleCalendarService(db)
        auth_url = calendar_service.get_authorization_url()
        return schemas.GoogleCalendarAuthUrl(auth_url=auth_url)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@calendar_router.post("/google/authorize")
def authorize_google_calendar(auth_code: schemas.GoogleCalendarAuthCode, db: Session = Depends(get_db)):
    """Complete Google Calendar OAuth2 authorization."""
    calendar_service = GoogleCalendarService(db)

    success = calendar_service.authorize_with_code(auth_code.code)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to authorize with Google Calendar")

    return {"message": "Successfully connected to Google Calendar"}


@calendar_router.post("/google/disconnect")
def disconnect_google_calendar(db: Session = Depends(get_db)):
    """Disconnect from Google Calendar."""
    calendar_service = GoogleCalendarService(db)
    calendar_service.disconnect()
    return {"message": "Disconnected from Google Calendar"}


# Action Item Sync Endpoints


@calendar_router.post("/action-items/{item_id}/sync")
def sync_action_item_to_calendar(item_id: int, db: Session = Depends(get_db)):
    """Sync a specific action item to Google Calendar."""
    calendar_service = GoogleCalendarService(db)

    if not calendar_service.is_connected():
        raise HTTPException(status_code=400, detail="Not connected to Google Calendar. Please authorize first.")

    action_item = meetings_crud.get_action_item(db, item_id)
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")

    # Get the current user's email from Google Calendar
    user_info = calendar_service.get_user_info()
    user_email = user_info.get("email") if user_info else None

    # Check if the action item is assigned to the current user
    if action_item.owner and user_email:
        # Get email for the owner (handles both name and email formats)
        owner_email = crud.get_email_for_name(db, action_item.owner)

        # Normalize both emails for comparison (case-insensitive)
        item_owner = owner_email.strip().lower()
        current_user = user_email.strip().lower()

        if item_owner != current_user:
            raise HTTPException(
                status_code=403,
                detail=f"Cannot sync action item. This task is assigned to '{action_item.owner}' ({owner_email}), but you are logged in as '{user_email}'. Only tasks assigned to you can be synced to your calendar.",
            )
    elif not action_item.owner:
        raise HTTPException(
            status_code=400,
            detail="Cannot sync action item without an assigned owner. Please assign the task to someone first.",
        )

    # Get meeting title for context
    transcription = (
        db.query(models.Transcription).filter(models.Transcription.id == action_item.transcription_id).first()
    )
    meeting_title = None
    if transcription and transcription.meeting:
        meeting_title = transcription.meeting.filename

    try:
        # If already synced, update; otherwise create new
        if action_item.synced_to_calendar and action_item.google_calendar_event_id:
            calendar_service.update_event(action_item.google_calendar_event_id, action_item, meeting_title)
        else:
            event_id = calendar_service.create_event_from_action_item(action_item, meeting_title)
            meetings_crud.update_action_item_calendar_sync(db, item_id, event_id, True)

        return {"message": "Action item synced to Google Calendar", "event_id": action_item.google_calendar_event_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync to Google Calendar: {str(e)}")


@calendar_router.delete("/action-items/{item_id}/sync")
def unsync_action_item_from_calendar(item_id: int, db: Session = Depends(get_db)):
    """Remove an action item from Google Calendar."""
    calendar_service = GoogleCalendarService(db)

    action_item = meetings_crud.get_action_item(db, item_id)
    if not action_item:
        raise HTTPException(status_code=404, detail="Action item not found")

    if not action_item.synced_to_calendar or not action_item.google_calendar_event_id:
        raise HTTPException(status_code=400, detail="Action item is not synced to calendar")

    if not calendar_service.is_connected():
        # Just update the database status if not connected
        meetings_crud.update_action_item_calendar_sync(db, item_id, None, False)
        return {"message": "Action item marked as unsynced (Google Calendar not connected)"}

    try:
        calendar_service.delete_event(action_item.google_calendar_event_id)
        meetings_crud.update_action_item_calendar_sync(db, item_id, None, False)
        return {"message": "Action item removed from Google Calendar"}
    except Exception as e:
        # Update database even if deletion fails
        meetings_crud.update_action_item_calendar_sync(db, item_id, None, False)
        return {"message": f"Action item marked as unsynced, but calendar deletion failed: {str(e)}"}


@calendar_router.post("/sync-all")
def sync_all_action_items(
    status: str | None = Query("pending", description="Sync items with this status"), db: Session = Depends(get_db)
):
    """Sync all pending action items assigned to the current user to Google Calendar."""
    calendar_service = GoogleCalendarService(db)

    if not calendar_service.is_connected():
        raise HTTPException(status_code=400, detail="Not connected to Google Calendar. Please authorize first.")

    # Get the current user's email from Google Calendar
    user_info = calendar_service.get_user_info()
    user_email = user_info.get("email") if user_info else None

    if not user_email:
        raise HTTPException(status_code=500, detail="Unable to retrieve user email from Google Calendar.")

    action_items = crud.get_all_action_items(db, status=status)

    synced_count = 0
    failed_count = 0
    skipped_count = 0

    for action_item in action_items:
        if action_item.synced_to_calendar:
            continue  # Skip already synced items

        # Check if the action item is assigned to the current user
        if not action_item.owner:
            skipped_count += 1
            continue  # Skip items without an owner

        # Get email for the owner (handles both name and email formats)
        owner_email = crud.get_email_for_name(db, action_item.owner)

        # Normalize both emails for comparison (case-insensitive)
        item_owner = owner_email.strip().lower()
        current_user = user_email.strip().lower()

        if item_owner != current_user:
            skipped_count += 1
            continue  # Skip items not assigned to the current user

        # Get meeting title
        transcription = (
            db.query(models.Transcription).filter(models.Transcription.id == action_item.transcription_id).first()
        )
        meeting_title = None
        if transcription and transcription.meeting:
            meeting_title = transcription.meeting.filename

        try:
            event_id = calendar_service.create_event_from_action_item(action_item, meeting_title)
            meetings_crud.update_action_item_calendar_sync(db, action_item.id, event_id, True)
            synced_count += 1
        except Exception as e:
            print(f"Failed to sync action item {action_item.id}: {e}")
            failed_count += 1

    return {
        "message": f"Synced {synced_count} action items to Google Calendar (skipped {skipped_count} items not assigned to you)",
        "synced": synced_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "user_email": user_email,
    }


# Include sub-routers in the main router
router.include_router(calendar_router)
