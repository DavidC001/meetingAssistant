"""Repository layer for search database operations."""
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..meetings import models as meeting_models


class SearchRepository:
    """Repository for executing search queries against the database."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Meeting queries
    # ------------------------------------------------------------------

    def get_completed_meetings(
        self,
        folder: str | None = None,
        date_from=None,
        date_to=None,
    ) -> list[meeting_models.Meeting]:
        """Fetch completed meetings with optional filters."""
        query = self.db.query(meeting_models.Meeting).filter(meeting_models.Meeting.status == "completed")
        if folder:
            query = query.filter(meeting_models.Meeting.folder == folder)
        if date_from:
            query = query.filter(meeting_models.Meeting.meeting_date >= date_from)
        if date_to:
            query = query.filter(meeting_models.Meeting.meeting_date <= date_to)
        return query.all()

    def get_meetings_by_ids(self, meeting_ids: list[int]) -> list[meeting_models.Meeting]:
        """Return meetings for a given list of IDs."""
        return self.db.query(meeting_models.Meeting).filter(meeting_models.Meeting.id.in_(meeting_ids)).all()

    def search_meetings_by_title(self, meeting_ids: list[int], pattern: str) -> list[meeting_models.Meeting]:
        """Search meeting titles within a set of meeting IDs."""
        return (
            self.db.query(meeting_models.Meeting)
            .filter(
                meeting_models.Meeting.id.in_(meeting_ids),
                meeting_models.Meeting.filename.ilike(pattern),
            )
            .all()
        )

    def search_meetings_by_notes(self, meeting_ids: list[int], pattern: str) -> list[meeting_models.Meeting]:
        """Search meeting notes within a set of meeting IDs."""
        return (
            self.db.query(meeting_models.Meeting)
            .filter(
                meeting_models.Meeting.id.in_(meeting_ids),
                meeting_models.Meeting.notes.ilike(pattern),
            )
            .all()
        )

    def search_meeting_titles_quick(self, pattern: str, limit: int) -> list[meeting_models.Meeting]:
        """Quick-search completed meeting titles for autocomplete."""
        return (
            self.db.query(meeting_models.Meeting)
            .filter(
                meeting_models.Meeting.status == "completed",
                meeting_models.Meeting.filename.ilike(pattern),
            )
            .limit(limit)
            .all()
        )

    # ------------------------------------------------------------------
    # Transcription queries
    # ------------------------------------------------------------------

    def search_transcriptions_full_text(
        self, meeting_ids: list[int], pattern: str
    ) -> list[meeting_models.Transcription]:
        """Search transcription full text within a set of meeting IDs."""
        return (
            self.db.query(meeting_models.Transcription)
            .filter(
                meeting_models.Transcription.meeting_id.in_(meeting_ids),
                meeting_models.Transcription.full_text.ilike(pattern),
            )
            .all()
        )

    def search_transcriptions_summary(self, meeting_ids: list[int], pattern: str) -> list[meeting_models.Transcription]:
        """Search transcription summaries within a set of meeting IDs."""
        return (
            self.db.query(meeting_models.Transcription)
            .filter(
                meeting_models.Transcription.meeting_id.in_(meeting_ids),
                meeting_models.Transcription.summary.ilike(pattern),
            )
            .all()
        )

    def get_transcription_ids_for_meetings(self, meeting_ids: list[int]) -> list[tuple[int, int]]:
        """Return (transcription_id, meeting_id) pairs for a set of meeting IDs."""
        rows = (
            self.db.query(
                meeting_models.Transcription.id,
                meeting_models.Transcription.meeting_id,
            )
            .filter(meeting_models.Transcription.meeting_id.in_(meeting_ids))
            .all()
        )
        return [(r.id, r.meeting_id) for r in rows]

    def get_transcription_by_id(self, transcription_id: int) -> meeting_models.Transcription | None:
        """Get a single transcription by its ID."""
        return (
            self.db.query(meeting_models.Transcription)
            .filter(meeting_models.Transcription.id == transcription_id)
            .first()
        )

    # ------------------------------------------------------------------
    # Action item queries
    # ------------------------------------------------------------------

    def search_action_items(self, transcription_ids: list[int], pattern: str) -> list[meeting_models.ActionItem]:
        """Search action items by task, owner, or notes within given transcription IDs."""
        return (
            self.db.query(meeting_models.ActionItem)
            .filter(
                meeting_models.ActionItem.transcription_id.in_(transcription_ids),
                or_(
                    meeting_models.ActionItem.task.ilike(pattern),
                    meeting_models.ActionItem.owner.ilike(pattern),
                    meeting_models.ActionItem.notes.ilike(pattern),
                ),
            )
            .all()
        )

    def search_action_items_quick(self, pattern: str, limit: int) -> list[meeting_models.ActionItem]:
        """Quick-search action item tasks for autocomplete."""
        return (
            self.db.query(meeting_models.ActionItem)
            .filter(meeting_models.ActionItem.task.ilike(pattern))
            .limit(limit)
            .all()
        )
