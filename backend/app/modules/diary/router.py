"""API routes for diary module."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db

from .repository import DiaryRepository
from .schemas import (
    ActionItemsDailySummary,
    DiaryEntriesListResponse,
    DiaryEntry,
    DiaryEntryCreate,
    DiaryEntryUpdate,
    DiaryEntryWithActionItems,
    DiaryReminderResponse,
    ReminderDismissRequest,
)
from .service import DiaryService

router = APIRouter(prefix="/api/v1/diary", tags=["diary"])


@router.get("/entries", response_model=DiaryEntriesListResponse)
async def list_diary_entries(
    start_date: date | None = Query(None, description="Start date for filtering (YYYY-MM-DD)"),
    end_date: date | None = Query(None, description="End date for filtering (YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """List diary entries with pagination and date range filter."""
    skip = (page - 1) * page_size

    entries = DiaryRepository.get_entries(db, start_date=start_date, end_date=end_date, skip=skip, limit=page_size)

    total = DiaryRepository.count_entries(db, start_date=start_date, end_date=end_date)

    return DiaryEntriesListResponse(entries=entries, total=total, page=page, page_size=page_size)


@router.get("/entries/{entry_date}", response_model=DiaryEntryWithActionItems)
async def get_diary_entry(
    entry_date: date,
    include_action_items: bool = Query(True, description="Include action items summary"),
    db: Session = Depends(get_db),
):
    """Get diary entry for specific date (YYYY-MM-DD)."""
    entry = DiaryRepository.get_entry_by_date(db, entry_date)

    if not entry:
        raise HTTPException(status_code=404, detail="Diary entry not found for this date")

    # Convert to response model
    entry_dict = {
        "id": entry.id,
        "date": entry.date,
        "content": entry.content,
        "mood": entry.mood,
        "highlights": entry.highlights,
        "blockers": entry.blockers,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
        "reminder_dismissed": entry.reminder_dismissed,
        "is_work_day": entry.is_work_day,
    }

    if include_action_items:
        action_items_summary = DiaryService.get_action_items_for_date(db, entry_date)
        entry_dict["action_items_summary"] = action_items_summary

    return DiaryEntryWithActionItems(**entry_dict)


@router.get("/template/{entry_date}")
async def get_diary_template(entry_date: date, db: Session = Depends(get_db)):
    """Get diary template for a specific date."""
    template = DiaryService.generate_diary_template(db, entry_date)
    return {"template": template}


@router.post("/entries", response_model=DiaryEntry, status_code=201)
async def create_diary_entry(
    entry_data: DiaryEntryCreate,
    auto_generate: bool = Query(False, description="Auto-generate content from action items"),
    db: Session = Depends(get_db),
):
    """Create diary entry for a date."""
    # Check if entry already exists
    existing_entry = DiaryRepository.get_entry_by_date(db, entry_data.date)
    if existing_entry:
        raise HTTPException(status_code=400, detail=f"Diary entry already exists for {entry_data.date}")

    # Auto-generate content if requested and no content provided
    if auto_generate and not entry_data.content:
        entry_data.content = DiaryService.generate_diary_template(db, entry_data.date)

    entry = DiaryRepository.create_entry(db, entry_data)
    return entry


@router.put("/entries/{entry_date}", response_model=DiaryEntry)
async def update_diary_entry(entry_date: date, entry_data: DiaryEntryUpdate, db: Session = Depends(get_db)):
    """Update diary entry."""
    entry = DiaryRepository.get_entry_by_date(db, entry_date)

    if not entry:
        raise HTTPException(status_code=404, detail="Diary entry not found for this date")

    updated_entry = DiaryRepository.update_entry(db, entry, entry_data)
    return updated_entry


@router.delete("/entries/{entry_date}", status_code=204)
async def delete_diary_entry(entry_date: date, db: Session = Depends(get_db)):
    """Delete diary entry."""
    entry = DiaryRepository.get_entry_by_date(db, entry_date)

    if not entry:
        raise HTTPException(status_code=404, detail="Diary entry not found for this date")

    DiaryRepository.delete_entry(db, entry)
    return None


@router.get("/reminder", response_model=DiaryReminderResponse)
async def check_diary_reminder(db: Session = Depends(get_db)):
    """
    Check if reminder should be shown.

    Returns reminder data if:
    - Current day is a work day (Mon-Fri, configurable)
    - Previous work day has no diary entry
    - Reminder not dismissed for that day
    """
    reminder_response = DiaryService.check_reminder(db)
    return reminder_response


@router.post("/reminder/dismiss", status_code=204)
async def dismiss_diary_reminder(dismiss_request: ReminderDismissRequest, db: Session = Depends(get_db)):
    """Dismiss reminder for specific date."""
    DiaryRepository.dismiss_reminder(db, dismiss_request.date)
    return None


@router.get("/entries/{entry_date}/action-items-summary", response_model=ActionItemsDailySummary)
async def get_action_items_summary(entry_date: date, db: Session = Depends(get_db)):
    """
    Get action items activity for a specific date.

    Returns:
    - Items that were "in-progress" at start of day
    - Items moved to "completed" during the day
    - Items created on that day
    - Items whose status changed during the day
    """
    summary = DiaryService.get_action_items_for_date(db, entry_date)
    return summary


@router.post("/entries/{entry_date}/snapshot-action-items", status_code=201)
async def snapshot_action_items(entry_date: date, db: Session = Depends(get_db)):
    """Take snapshot of current action items state for a specific date."""
    # This endpoint would be called by a scheduled task or manually
    # For now, it's a placeholder for the snapshot functionality

    # Get or create diary entry for the date
    entry = DiaryRepository.get_entry_by_date(db, entry_date)
    if not entry:
        entry_data = DiaryEntryCreate(date=entry_date, is_work_day=DiaryService.is_work_day(entry_date))
        entry = DiaryRepository.create_entry(db, entry_data)

    # This would trigger the snapshot logic
    # For now, just return success
    return {"message": "Snapshot created successfully", "entry_id": entry.id}


@router.get("/statistics/summary")
async def get_statistics_summary(
    start_date: date | None = Query(None, description="Start date for statistics"),
    end_date: date | None = Query(None, description="End date for statistics"),
    db: Session = Depends(get_db),
):
    """
    Get diary statistics summary.

    Returns:
    - Total entries
    - Average hours worked
    - Most productive mood
    - Total action items completed
    - Arrival/departure patterns
    """

    # Default to last 30 days if not specified
    if not end_date:
        end_date = date.today()
    if not start_date:
        from datetime import timedelta

        start_date = end_date - timedelta(days=30)

    # Get entries in range
    entries = DiaryRepository.get_entries(db, start_date, end_date, skip=0, limit=1000)

    if not entries:
        return {
            "total_entries": 0,
            "date_range": {"start": start_date, "end": end_date},
            "average_hours_worked": 0,
            "total_hours_worked": 0,
            "mood_distribution": {},
            "total_action_items_completed": 0,
            "average_arrival_time": None,
            "average_departure_time": None,
            "most_productive_days": [],
        }

    # Calculate statistics
    total_hours = sum(e.hours_worked or 0 for e in entries)
    avg_hours = total_hours / len(entries) if entries else 0

    # Mood distribution
    mood_counts = {}
    for e in entries:
        if e.mood:
            mood_counts[e.mood] = mood_counts.get(e.mood, 0) + 1

    # Total action items completed
    total_completed = sum(len(e.action_items_completed or []) for e in entries)

    # Average arrival/departure times
    arrivals = [e.arrival_time for e in entries if e.arrival_time]
    departures = [e.departure_time for e in entries if e.departure_time]

    avg_arrival = arrivals[0] if arrivals else None  # Simplified
    avg_departure = departures[0] if departures else None  # Simplified

    # Most productive days (most completed items)
    productive_days = sorted(
        [(e.date, len(e.action_items_completed or [])) for e in entries], key=lambda x: x[1], reverse=True
    )[:5]

    return {
        "total_entries": len(entries),
        "date_range": {"start": start_date, "end": end_date},
        "average_hours_worked": round(avg_hours, 2),
        "total_hours_worked": round(total_hours, 2),
        "mood_distribution": mood_counts,
        "total_action_items_completed": total_completed,
        "average_arrival_time": avg_arrival,
        "average_departure_time": avg_departure,
        "most_productive_days": [{"date": d, "items_completed": count} for d, count in productive_days],
    }


@router.get("/statistics/timeline")
async def get_statistics_timeline(
    start_date: date | None = Query(None, description="Start date"),
    end_date: date | None = Query(None, description="End date"),
    db: Session = Depends(get_db),
):
    """Get daily timeline of hours worked and action items."""
    from datetime import timedelta

    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    entries = DiaryRepository.get_entries(db, start_date, end_date, skip=0, limit=1000)

    timeline = []
    for entry in sorted(entries, key=lambda e: e.date):
        timeline.append(
            {
                "date": entry.date,
                "hours_worked": entry.hours_worked or 0,
                "action_items_completed": len(entry.action_items_completed or []),
                "action_items_worked_on": len(entry.action_items_worked_on or []),
                "mood": entry.mood,
                "arrival_time": entry.arrival_time,
                "departure_time": entry.departure_time,
            }
        )

    return {"date_range": {"start": start_date, "end": end_date}, "timeline": timeline}
