"""Repository layer for graph database operations."""
from sqlalchemy.orm import Session, joinedload

from ... import models


class GraphRepository:
    """Repository for meeting graph data access."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_completed_meetings_with_speakers(self) -> list[models.Meeting]:
        """Fetch all completed meetings with their speakers eagerly loaded."""
        return (
            self.db.query(models.Meeting)
            .options(joinedload(models.Meeting.speakers))
            .filter(models.Meeting.status == models.MeetingStatus.COMPLETED.value)
            .all()
        )

    def get_all_meeting_links(self) -> list[models.MeetingLink]:
        """Fetch all stored meeting-to-meeting links."""
        return self.db.query(models.MeetingLink).all()

    def get_meeting_by_id(self, meeting_id: int) -> models.Meeting | None:
        """Get a meeting by ID."""
        return self.db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()

    def get_link(self, source_id: int, target_id: int) -> models.MeetingLink | None:
        """Find an existing link between two meetings."""
        return (
            self.db.query(models.MeetingLink)
            .filter(
                models.MeetingLink.source_meeting_id == source_id,
                models.MeetingLink.target_meeting_id == target_id,
            )
            .first()
        )

    def create_link(self, source_id: int, target_id: int) -> models.MeetingLink:
        """Create a new meeting link."""
        link = models.MeetingLink(source_meeting_id=source_id, target_meeting_id=target_id)
        self.db.add(link)
        self.db.commit()
        self.db.refresh(link)
        return link

    def delete_link(self, link: models.MeetingLink) -> None:
        """Delete a meeting link."""
        self.db.delete(link)
        self.db.commit()
