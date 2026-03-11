"""Service layer for diary business logic."""
import re
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.modules.meetings.models import ActionItem
from app.modules.meetings.service import MeetingService

from .repository import DiaryRepository
from .schemas import ActionItemsDailySummary, ActionItemSnapshot, DiaryReminderResponse


def extract_action_item_ids_from_content(content: str) -> tuple[list[int], list[int]]:
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
    # Using DOTALL to match across newlines in case task description spans multiple lines
    pattern = r"-\s*\[([ xX])\].*?\(Action Item #(\d+)\)"

    worked_on_ids = []
    completed_ids = []

    for match in re.finditer(pattern, content, re.IGNORECASE | re.DOTALL):
        checkbox_state = match.group(1).strip()
        item_id = int(match.group(2))

        worked_on_ids.append(item_id)

        # Check if checkbox is marked (x or X)
        if checkbox_state.lower() == "x":
            completed_ids.append(item_id)

    return worked_on_ids, completed_ids


class DiaryService:
    """Service for diary-related business logic."""

    # Default work days (0=Monday to 4=Friday)
    DEFAULT_WORK_DAYS = [0, 1, 2, 3, 4]

    def __init__(self, db: Session):
        self.db = db
        self.meeting_service = MeetingService(db)

    @staticmethod
    def is_work_day(check_date: date, work_days: list[int] | None = None) -> bool:
        """Check if a date is a work day."""
        if work_days is None:
            work_days = DiaryService.DEFAULT_WORK_DAYS

        # weekday() returns 0=Monday to 6=Sunday
        return check_date.weekday() in work_days

    @staticmethod
    def get_previous_work_day(from_date: date, work_days: list[int] | None = None) -> date:
        """Calculate previous work day (skip weekends and non-work days)."""
        if work_days is None:
            work_days = DiaryService.DEFAULT_WORK_DAYS

        previous_date = from_date - timedelta(days=1)

        # Keep going back until we find a work day
        while not DiaryService.is_work_day(previous_date, work_days):
            previous_date = previous_date - timedelta(days=1)

        return previous_date

    @staticmethod
    def get_missing_diary_dates(db: Session, days_back: int = 7, work_days: list[int] | None = None) -> list[date]:
        """Find work days without diary entries."""
        if work_days is None:
            work_days = DiaryService.DEFAULT_WORK_DAYS

        end_date = date.today()
        start_date = end_date - timedelta(days=days_back)

        return DiaryRepository.get_missing_work_day_dates(db, start_date, end_date, work_days)

    def check_reminder(self, work_days: list[int] | None = None) -> DiaryReminderResponse:
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
        entry = DiaryRepository.get_entry_by_date(self.db, previous_work_day)

        # Check if entry is missing or has no content
        if not entry or (not entry.content and not entry.reminder_dismissed):
            # Get action items summary for that day
            action_items_summary = self.get_action_items_for_date(previous_work_day)

            return DiaryReminderResponse(
                should_show_reminder=True,
                missing_date=previous_work_day,
                previous_work_day=previous_work_day,
                action_items_summary=action_items_summary,
            )

        # Check if reminder was dismissed
        if entry and entry.reminder_dismissed:
            return DiaryReminderResponse(should_show_reminder=False)

        return DiaryReminderResponse(should_show_reminder=False)

    def get_action_items_for_date(self, target_date: date) -> ActionItemsDailySummary:
        """
        Get action items activity for a specific date.

        Returns:
        - In progress items: All items currently with "in-progress" status
        - Completed items: Recently completed items (last 30 days) or items due near this date
        - Created items: Items due today or overdue (pending status)

        Note: "Completed" shows recently completed items so they can be dragged to diary.
        Once saved in diary, they are tracked in action_items_completed field.
        """
        from datetime import timedelta

        today_str = target_date.isoformat()

        # Calculate date range for "recent" completed items (30 days before and 7 days after target date)
        start_range = (target_date - timedelta(days=30)).isoformat()
        end_range = (target_date + timedelta(days=7)).isoformat()

        # Get ALL items that are currently in progress (global status)
        in_progress_items = self.meeting_service.get_action_items(status="in-progress")

        # Get completed items that are either:
        # 1. Due within the date range around target_date, OR
        # 2. Already saved in this diary entry
        diary_entry = DiaryRepository.get_entry_by_date(self.db, target_date)
        saved_completed_ids = (
            diary_entry.action_items_completed if diary_entry and diary_entry.action_items_completed else []
        )

        completed_items = self.meeting_service.get_completed_action_items_in_range_or_ids(
            start_range,
            end_range,
            saved_completed_ids,
        )

        # If no due_date filter matched, get items that were actually completed in this diary
        if saved_completed_ids and not completed_items:
            completed_items = self.meeting_service.get_action_items_by_ids(saved_completed_ids)

        # Get pending items that are due today or overdue
        pending_items = self.meeting_service.get_pending_action_items_due_before(today_str)

        # Convert to snapshot format
        in_progress_snapshots = [DiaryService._action_item_to_snapshot(item) for item in in_progress_items]

        completed_snapshots = [DiaryService._action_item_to_snapshot(item) for item in completed_items]

        # For "created items", show pending items due today
        created_snapshots = [DiaryService._action_item_to_snapshot(item) for item in pending_items]

        # Status changes can only be tracked if we have DiaryActionItemSnapshots
        status_changes = []

        return ActionItemsDailySummary(
            date=target_date,
            in_progress_items=in_progress_snapshots,
            completed_items=completed_snapshots,
            created_items=created_snapshots,
            status_changes=status_changes,
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
            due_date=action_item.due_date,  # Already a string in the model
        )

    # ------------------------------------------------------------------
    # Data-access delegation methods (keep router free of repository imports)
    # ------------------------------------------------------------------

    def get_entries(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        skip: int = 0,
        limit: int = 50,
    ):
        """Fetch paginated diary entries."""
        return DiaryRepository.get_entries(self.db, start_date=start_date, end_date=end_date, skip=skip, limit=limit)

    def count_entries(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> int:
        """Count diary entries matching the date range."""
        return DiaryRepository.count_entries(self.db, start_date=start_date, end_date=end_date)

    def get_entry_by_date(self, entry_date: date):
        """Get diary entry for a specific date."""
        return DiaryRepository.get_entry_by_date(self.db, entry_date)

    def create_entry(self, entry_data):
        """Create a new diary entry."""
        return DiaryRepository.create_entry(self.db, entry_data)

    def update_entry(self, entry, entry_data):
        """Update an existing diary entry."""
        return DiaryRepository.update_entry(self.db, entry, entry_data)

    def delete_entry(self, entry) -> bool:
        """Delete a diary entry."""
        return DiaryRepository.delete_entry(self.db, entry)

    def dismiss_reminder(self, entry_date: date):
        """Dismiss the reminder for a specific date."""
        return DiaryRepository.dismiss_reminder(self.db, entry_date)

    def generate_diary_template(self, target_date: date) -> str:
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
            "",
        ]

        return "\n".join(template_lines)

    @staticmethod
    def get_default_date_range(
        start_date: date | None,
        end_date: date | None,
        days: int = 30,
    ) -> tuple[date, date]:
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=days)
        return start_date, end_date

    def get_statistics_summary(self, start_date: date | None, end_date: date | None) -> dict:
        start_date, end_date = self.get_default_date_range(start_date, end_date)
        entries = self.get_entries(start_date, end_date, skip=0, limit=1000)

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

        total_hours = sum(entry.hours_worked or 0 for entry in entries)
        avg_hours = total_hours / len(entries) if entries else 0

        mood_counts = {}
        for entry in entries:
            if entry.mood:
                mood_counts[entry.mood] = mood_counts.get(entry.mood, 0) + 1

        total_completed = sum(len(entry.action_items_completed or []) for entry in entries)
        arrivals = [entry.arrival_time for entry in entries if entry.arrival_time]
        departures = [entry.departure_time for entry in entries if entry.departure_time]
        productive_days = sorted(
            [(entry.date, len(entry.action_items_completed or [])) for entry in entries],
            key=lambda value: value[1],
            reverse=True,
        )[:5]

        return {
            "total_entries": len(entries),
            "date_range": {"start": start_date, "end": end_date},
            "average_hours_worked": round(avg_hours, 2),
            "total_hours_worked": round(total_hours, 2),
            "mood_distribution": mood_counts,
            "total_action_items_completed": total_completed,
            "average_arrival_time": arrivals[0] if arrivals else None,
            "average_departure_time": departures[0] if departures else None,
            "most_productive_days": [{"date": day, "items_completed": count} for day, count in productive_days],
        }

    def get_statistics_timeline(self, start_date: date | None, end_date: date | None) -> dict:
        start_date, end_date = self.get_default_date_range(start_date, end_date)
        entries = self.get_entries(start_date, end_date, skip=0, limit=1000)

        timeline = []
        for entry in sorted(entries, key=lambda item: item.date):
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
