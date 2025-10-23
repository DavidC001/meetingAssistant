"""
Scheduled Meetings router for managing upcoming meetings and linking them to uploaded recordings.

This module provides endpoints for:
- Viewing scheduled meetings
- Syncing meetings from Google Calendar
- Linking uploaded recordings to scheduled meetings
- Managing scheduled meetings manually
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from .. import crud, schemas
from ..database import get_db
from ..core.google_calendar import GoogleCalendarService

router = APIRouter(
    prefix="/scheduled-meetings",
    tags=["scheduled-meetings"],
)


@router.get("/", response_model=List[schemas.ScheduledMeetingWithLinkedMeeting])
def get_scheduled_meetings(
    status: Optional[str] = Query(None, description="Filter by status: scheduled, completed, cancelled"),
    upcoming_only: bool = Query(False, description="Show only upcoming meetings"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get all scheduled meetings with optional filtering.
    """
    scheduled_meetings = crud.get_scheduled_meetings(
        db, 
        skip=skip, 
        limit=limit, 
        status=status, 
        upcoming_only=upcoming_only
    )
    return scheduled_meetings


@router.get("/{scheduled_meeting_id}", response_model=schemas.ScheduledMeetingWithLinkedMeeting)
def get_scheduled_meeting(
    scheduled_meeting_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific scheduled meeting by ID."""
    scheduled_meeting = crud.get_scheduled_meeting(db, scheduled_meeting_id)
    if not scheduled_meeting:
        raise HTTPException(status_code=404, detail="Scheduled meeting not found")
    return scheduled_meeting


@router.post("/", response_model=schemas.ScheduledMeeting)
def create_scheduled_meeting(
    scheduled_meeting: schemas.ScheduledMeetingCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new scheduled meeting manually.
    """
    return crud.create_scheduled_meeting(db, scheduled_meeting)


@router.put("/{scheduled_meeting_id}", response_model=schemas.ScheduledMeeting)
def update_scheduled_meeting(
    scheduled_meeting_id: int,
    scheduled_meeting_update: schemas.ScheduledMeetingUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a scheduled meeting.
    """
    scheduled_meeting = crud.update_scheduled_meeting(db, scheduled_meeting_id, scheduled_meeting_update)
    if not scheduled_meeting:
        raise HTTPException(status_code=404, detail="Scheduled meeting not found")
    return scheduled_meeting


@router.delete("/{scheduled_meeting_id}")
def delete_scheduled_meeting(
    scheduled_meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a scheduled meeting.
    """
    success = crud.delete_scheduled_meeting(db, scheduled_meeting_id)
    if not success:
        raise HTTPException(status_code=404, detail="Scheduled meeting not found")
    return {"message": "Scheduled meeting deleted successfully"}


@router.post("/{scheduled_meeting_id}/link/{meeting_id}")
def link_meeting_to_scheduled(
    scheduled_meeting_id: int,
    meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Link an uploaded meeting recording to a scheduled meeting.
    """
    # Verify the meeting exists
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Link the meeting
    scheduled_meeting = crud.link_meeting_to_scheduled(db, meeting_id, scheduled_meeting_id)
    if not scheduled_meeting:
        raise HTTPException(status_code=404, detail="Scheduled meeting not found")
    
    # Update the meeting's meeting_date to match the scheduled time
    from .. import schemas as meeting_schemas
    meeting_update = meeting_schemas.MeetingUpdate(meeting_date=scheduled_meeting.scheduled_time)
    crud.update_meeting(db, meeting_id, meeting_update)
    
    return {"message": "Meeting linked successfully", "scheduled_meeting": scheduled_meeting}


@router.post("/sync-from-google")
def sync_meetings_from_google_calendar(
    days_ahead: int = Query(30, description="How many days ahead to sync"),
    days_back: int = Query(7, description="How many days back to sync"),
    db: Session = Depends(get_db)
):
    """
    Sync meetings from Google Calendar.
    Creates or updates scheduled meetings based on calendar events.
    """
    calendar_service = GoogleCalendarService(db)
    
    if not calendar_service.is_connected():
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    try:
        # Fetch upcoming events
        time_min = datetime.now() - timedelta(days=days_back)
        time_max = datetime.now() + timedelta(days=days_ahead)
        events = calendar_service.fetch_upcoming_events(
            max_results=100, 
            time_min=time_min, 
            time_max=time_max
        )
        
        synced_count = 0
        updated_count = 0
        
        for event in events:
            event_id = event.get('id')
            title = event.get('summary', 'Untitled Meeting')
            description = event.get('description', '')
            location = event.get('location', '')
            
            # Parse start time
            start = event.get('start', {})
            start_time = datetime.fromisoformat(start.get('dateTime', '').replace('Z', '+00:00'))
            
            # Parse end time and calculate duration
            end = event.get('end', {})
            end_time = datetime.fromisoformat(end.get('dateTime', '').replace('Z', '+00:00'))
            duration_minutes = int((end_time - start_time).total_seconds() / 60)
            
            # Get attendees
            attendees = event.get('attendees', [])
            attendee_emails = [a.get('email', '') for a in attendees]
            attendees_str = ', '.join(attendee_emails) if attendee_emails else None
            
            # Get conference link (Google Meet, Zoom, etc.)
            conference_data = event.get('conferenceData', {})
            entry_points = conference_data.get('entryPoints', [])
            meet_link = None
            for entry_point in entry_points:
                if entry_point.get('entryPointType') == 'video':
                    meet_link = entry_point.get('uri')
                    break
            
            # Check if this event already exists
            existing = crud.get_scheduled_meeting_by_calendar_event_id(db, event_id)
            
            if existing:
                # Update existing scheduled meeting
                update_data = schemas.ScheduledMeetingUpdate(
                    title=title,
                    description=description,
                    scheduled_time=start_time,
                    duration_minutes=duration_minutes,
                    location=location,
                    attendees=attendees_str
                )
                crud.update_scheduled_meeting(db, existing.id, update_data)
                updated_count += 1
            else:
                # Create new scheduled meeting
                create_data = schemas.ScheduledMeetingCreate(
                    title=title,
                    description=description,
                    scheduled_time=start_time,
                    duration_minutes=duration_minutes,
                    location=location,
                    attendees=attendees_str,
                    google_calendar_event_id=event_id,
                    google_meet_link=meet_link
                )
                crud.create_scheduled_meeting(db, create_data)
                synced_count += 1
        
        return {
            "message": "Sync completed successfully",
            "synced": synced_count,
            "updated": updated_count,
            "total": synced_count + updated_count
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing from Google Calendar: {str(e)}")


@router.get("/needs-upload/list", response_model=List[schemas.ScheduledMeetingWithLinkedMeeting])
def get_meetings_needing_upload(
    days_back: int = Query(7, description="How many days back to check"),
    db: Session = Depends(get_db)
):
    """
    Get past scheduled meetings that don't have a linked recording yet.
    These are meetings that occurred but haven't been uploaded.
    """
    now = datetime.now(timezone.utc)
    cutoff_time = now - timedelta(days=days_back)
    
    # Get completed/past meetings without a linked recording
    all_scheduled = crud.get_scheduled_meetings(db, limit=1000)
    
    needs_upload = [
        meeting for meeting in all_scheduled
        if meeting.scheduled_time < now
        and meeting.scheduled_time >= cutoff_time
        and meeting.linked_meeting_id is None
        and meeting.status != "cancelled"
    ]
    
    return needs_upload
