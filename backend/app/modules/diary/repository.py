"""Repository layer for diary database operations."""
from datetime import date, datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func

from .models import DiaryEntry, DiaryActionItemSnapshot
from .schemas import DiaryEntryCreate, DiaryEntryUpdate


def extract_action_item_ids_from_content(content: str):
    """Extract action item IDs from markdown content."""
    import re
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


class DiaryRepository:
    """Repository for diary entry database operations."""
    
    @staticmethod
    def get_entry_by_date(db: Session, entry_date: date) -> Optional[DiaryEntry]:
        """Get diary entry for a specific date."""
        return db.query(DiaryEntry).filter(DiaryEntry.date == entry_date).first()
    
    @staticmethod
    def get_entry_by_id(db: Session, entry_id: int) -> Optional[DiaryEntry]:
        """Get diary entry by ID."""
        return db.query(DiaryEntry).filter(DiaryEntry.id == entry_id).first()
    
    @staticmethod
    def get_entries(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 50
    ) -> List[DiaryEntry]:
        """Get diary entries with optional date range filter."""
        query = db.query(DiaryEntry)
        
        if start_date:
            query = query.filter(DiaryEntry.date >= start_date)
        if end_date:
            query = query.filter(DiaryEntry.date <= end_date)
        
        return query.order_by(desc(DiaryEntry.date)).offset(skip).limit(limit).all()
    
    @staticmethod
    def count_entries(
        db: Session,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> int:
        """Count diary entries with optional date range filter."""
        query = db.query(func.count(DiaryEntry.id))
        
        if start_date:
            query = query.filter(DiaryEntry.date >= start_date)
        if end_date:
            query = query.filter(DiaryEntry.date <= end_date)
        
        return query.scalar()
    
    @staticmethod
    def create_entry(db: Session, entry_data: DiaryEntryCreate) -> DiaryEntry:
        """Create a new diary entry."""
        # Convert Pydantic model to dict, excluding None values that should remain as database NULL
        data_dict = entry_data.model_dump(exclude_none=True)
        
        # Extract action item IDs from content if present
        if 'content' in data_dict and data_dict['content']:
            worked_on_ids, completed_ids = extract_action_item_ids_from_content(data_dict['content'])
            data_dict['action_items_worked_on'] = worked_on_ids if worked_on_ids else None
            data_dict['action_items_completed'] = completed_ids if completed_ids else None
        
        db_entry = DiaryEntry(**data_dict)
        db.add(db_entry)
        db.commit()
        db.refresh(db_entry)
        return db_entry
    
    @staticmethod
    def update_entry(
        db: Session,
        entry: DiaryEntry,
        entry_data: DiaryEntryUpdate
    ) -> DiaryEntry:
        """Update an existing diary entry."""
        # Exclude None values to prevent 'null' string from being set
        update_data = entry_data.model_dump(exclude_unset=True, exclude_none=True)
        
        # Extract action item IDs from content if content is being updated
        if 'content' in update_data and update_data['content']:
            worked_on_ids, completed_ids = extract_action_item_ids_from_content(update_data['content'])
            update_data['action_items_worked_on'] = worked_on_ids if worked_on_ids else None
            update_data['action_items_completed'] = completed_ids if completed_ids else None
        
        for field, value in update_data.items():
            setattr(entry, field, value)
        
        entry.updated_at = datetime.now()
        db.commit()
        db.refresh(entry)
        return entry
    
    @staticmethod
    def delete_entry(db: Session, entry: DiaryEntry) -> bool:
        """Delete a diary entry."""
        db.delete(entry)
        db.commit()
        return True
    
    @staticmethod
    def dismiss_reminder(db: Session, entry_date: date) -> DiaryEntry:
        """Mark reminder as dismissed for a specific date."""
        entry = DiaryRepository.get_entry_by_date(db, entry_date)
        
        if not entry:
            # Create a minimal entry with reminder dismissed
            entry = DiaryEntry(
                date=entry_date,
                reminder_dismissed=True,
                is_work_day=True
            )
            db.add(entry)
        else:
            entry.reminder_dismissed = True
        
        db.commit()
        db.refresh(entry)
        return entry
    
    @staticmethod
    def get_missing_work_day_dates(
        db: Session,
        start_date: date,
        end_date: date,
        work_days: List[int]
    ) -> List[date]:
        """Get work days without diary entries in date range."""
        # Get all existing entries in range
        existing_entries = db.query(DiaryEntry.date).filter(
            and_(
                DiaryEntry.date >= start_date,
                DiaryEntry.date <= end_date
            )
        ).all()
        
        existing_dates = {entry[0] for entry in existing_entries}
        
        # Generate all work days in range
        missing_dates = []
        current_date = start_date
        
        while current_date <= end_date:
            # Check if it's a work day (weekday is 0=Monday to 6=Sunday)
            if current_date.weekday() in work_days and current_date not in existing_dates:
                missing_dates.append(current_date)
            current_date = date.fromordinal(current_date.toordinal() + 1)
        
        return missing_dates


class DiaryActionItemSnapshotRepository:
    """Repository for diary action item snapshot operations."""
    
    @staticmethod
    def create_snapshot(
        db: Session,
        diary_entry_id: int,
        action_item_id: int,
        previous_status: Optional[str],
        current_status: str,
        notes: Optional[str] = None
    ) -> DiaryActionItemSnapshot:
        """Create a snapshot of an action item for a diary entry."""
        snapshot = DiaryActionItemSnapshot(
            diary_entry_id=diary_entry_id,
            action_item_id=action_item_id,
            previous_status=previous_status,
            current_status=current_status,
            notes=notes
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return snapshot
    
    @staticmethod
    def get_snapshots_for_entry(
        db: Session,
        diary_entry_id: int
    ) -> List[DiaryActionItemSnapshot]:
        """Get all action item snapshots for a diary entry."""
        return db.query(DiaryActionItemSnapshot).filter(
            DiaryActionItemSnapshot.diary_entry_id == diary_entry_id
        ).all()
    
    @staticmethod
    def get_snapshots_for_date(
        db: Session,
        entry_date: date
    ) -> List[DiaryActionItemSnapshot]:
        """Get all action item snapshots for a specific date."""
        entry = DiaryRepository.get_entry_by_date(db, entry_date)
        if not entry:
            return []
        
        return DiaryActionItemSnapshotRepository.get_snapshots_for_entry(db, entry.id)
