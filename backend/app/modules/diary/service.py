"""Service layer for diary business logic."""
from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple
import re
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from .repository import DiaryRepository, DiaryActionItemSnapshotRepository
from .schemas import (
    DiaryEntryCreate,
    DiaryEntryUpdate,
    DiaryReminderResponse,
    ActionItemsDailySummary,
    ActionItemSnapshot,
    ActionItemStatusChange
)
from .models import DiaryEntry
from app.modules.meetings.models import ActionItem


def extract_action_item_ids_from_content(content: str) -> Tuple[List[int], List[int]]:
    """
    Extract action item IDs from markdown content.
    
    Returns:
        Tuple of (worked_on_ids, completed_ids)
        - worked_on_ids: All action items mentioned (checked or unchecked)
        - completed_ids: Only checked action items
    """
    if not content:
        return [], []
    
    # Pattern: - [ ] **task** _(Action Item #123)_ or - [x] **task** _(Action Item #123)_
    pattern = r'-\s*\[([ xX])\].*?\(Action Item #(\d+)\)'
    
    worked_on_ids = []
    completed_ids = []
    
    for match in re.finditer(pattern, content, re.IGNORECASE):
        checkbox_state = match.group(1).strip()
        item_id = int(match.group(2))
        
        worked_on_ids.append(item_id)
        
        # Check if checkbox is marked (x or X)
        if checkbox_state.lower() == 'x':
            completed_ids.append(item_id)
    
    return worked_on_ids, completed_ids


class DiaryService:
    """Service for diary-related business logic."""
    
    # Default work days (0=Monday to 4=Friday)
    DEFAULT_WORK_DAYS = [0, 1, 2, 3, 4]
    
    @staticmethod
    def is_work_day(check_date: date, work_days: Optional[List[int]] = None) -> bool:
        """Check if a date is a work day."""
        if work_days is None:
            work_days = DiaryService.DEFAULT_WORK_DAYS
        
        # weekday() returns 0=Monday to 6=Sunday
        return check_date.weekday() in work_days
    
    @staticmethod
    def get_previous_work_day(
        from_date: date,
        work_days: Optional[List[int]] = None
    ) -> date:
        """Calculate previous work day (skip weekends and non-work days)."""
        if work_days is None:
            work_days = DiaryService.DEFAULT_WORK_DAYS
        
        previous_date = from_date - timedelta(days=1)
        
        # Keep going back until we find a work day
        while not DiaryService.is_work_day(previous_date, work_days):
            previous_date = previous_date - timedelta(days=1)
        
        return previous_date
    
    @staticmethod
    def get_missing_diary_dates(
        db: Session,
        days_back: int = 7,
        work_days: Optional[List[int]] = None
    ) -> List[date]:
        """Find work days without diary entries."""
        if work_days is None:
            work_days = DiaryService.DEFAULT_WORK_DAYS
        
        end_date = date.today()
        start_date = end_date - timedelta(days=days_back)
        
        return DiaryRepository.get_missing_work_day_dates(
            db,
            start_date,
            end_date,
            work_days
        )
    
    @staticmethod
    def check_reminder(
        db: Session,
        work_days: Optional[List[int]] = None
    ) -> DiaryReminderResponse:
        """Check if a reminder should be shown for missing diary entry."""
        if work_days is None:
            work_days = DiaryService.DEFAULT_WORK_DAYS
        
        today = date.today()
        
        # Only check on work days
        if not DiaryService.is_work_day(today, work_days):
            return DiaryReminderResponse(should_show_reminder=False)
        
        # Get previous work day
        previous_work_day = DiaryService.get_previous_work_day(today, work_days)
        
        # Check if diary entry exists for previous work day
        entry = DiaryRepository.get_entry_by_date(db, previous_work_day)
        
        # Check if entry is missing or has no content
        if not entry or (not entry.content and not entry.reminder_dismissed):
            # Get action items summary for that day
            action_items_summary = DiaryService.get_action_items_for_date(
                db,
                previous_work_day
            )
            
            return DiaryReminderResponse(
                should_show_reminder=True,
                missing_date=previous_work_day,
                previous_work_day=previous_work_day,
                action_items_summary=action_items_summary
            )
        
        # Check if reminder was dismissed
        if entry and entry.reminder_dismissed:
            return DiaryReminderResponse(should_show_reminder=False)
        
        return DiaryReminderResponse(should_show_reminder=False)
    
    @staticmethod
    def get_action_items_for_date(
        db: Session,
        target_date: date
    ) -> ActionItemsDailySummary:
        """
        Get action items activity for a specific date.
        
        Filters:
        - In progress items (all)
        - Items due today or overdue
        
        Note: Since ActionItem model doesn't have timestamp fields,
        this returns current snapshot of action items.
        For historical tracking, use DiaryActionItemSnapshot.
        """
        today_str = target_date.isoformat()
        
        # Get items that are currently in progress
        in_progress_items = db.query(ActionItem).filter(
            ActionItem.status == "in-progress"
        ).all()
        
        # Get completed items (including those not yet due)
        completed_items = db.query(ActionItem).filter(
            ActionItem.status == "completed"
        ).all()
        
        # Get pending items that are due today or overdue
        pending_items = db.query(ActionItem).filter(
            ActionItem.status == "pending",
            ActionItem.due_date <= today_str
        ).all()
        
        # Convert to snapshot format
        in_progress_snapshots = [
            DiaryService._action_item_to_snapshot(item)
            for item in in_progress_items
        ]
        
        completed_snapshots = [
            DiaryService._action_item_to_snapshot(item)
            for item in completed_items
        ]
        
        # For "created items", show pending items due today
        created_snapshots = [
            DiaryService._action_item_to_snapshot(item)
            for item in pending_items
        ]
        
        # Status changes can only be tracked if we have DiaryActionItemSnapshots
        status_changes = []
        
        return ActionItemsDailySummary(
            date=target_date,
            in_progress_items=in_progress_snapshots,
            completed_items=completed_snapshots,
            created_items=created_snapshots,
            status_changes=status_changes
        )
    
    @staticmethod
    def _action_item_to_snapshot(action_item: ActionItem) -> ActionItemSnapshot:
        """Convert ActionItem model to ActionItemSnapshot schema."""
        return ActionItemSnapshot(
            id=action_item.id,
            task=action_item.task,
            owner=action_item.owner,
            status=action_item.status,
            priority=action_item.priority,
            due_date=action_item.due_date  # Already a string in the model
        )
    
    @staticmethod
    def generate_diary_template(
        db: Session,
        target_date: date
    ) -> str:
        """Generate a diary template with standard sections."""
        template_lines = [
            f"# Work Diary - {target_date.strftime('%A, %B %d, %Y')}",
            "",
            "## Worked on:",
            "",
            "_Drag action items here from the right panel_",
            "",
            "## Notes",
            "",
            "",
            "## Highlights",
            "",
            "- ",
            "",
            "## Blockers/Challenges",
            "",
            "- ",
            ""
        ]
        
        return "\n".join(template_lines)
