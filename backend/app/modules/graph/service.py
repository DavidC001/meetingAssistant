"""Service layer for meeting graph business logic."""
import logging
import re

from sqlalchemy.orm import Session

from ... import models
from .repository import GraphRepository

logger = logging.getLogger(__name__)


def extract_meeting_ids_from_notes(notes: str, all_meetings: list[models.Meeting]) -> list[int]:
    """
    Extract meeting IDs from notes by matching patterns like:
    - #meeting-123
    - Meeting #123
    - meeting:123
    - [[Meeting 123]]
    """
    if not notes:
        return []

    meeting_ids: set[int] = set()

    pattern1 = r"#(?:meeting-)?(\d+)"
    for match in re.finditer(pattern1, notes, re.IGNORECASE):
        meeting_ids.add(int(match.group(1)))

    pattern2 = r"meeting:\s*(\d+)"
    for match in re.finditer(pattern2, notes, re.IGNORECASE):
        meeting_ids.add(int(match.group(1)))

    pattern3 = r"\[\[(?:meeting\s*)?(\d+)\]\]"
    for match in re.finditer(pattern3, notes, re.IGNORECASE):
        meeting_ids.add(int(match.group(1)))

    for meeting in all_meetings:
        if meeting.filename and meeting.filename.lower() in notes.lower():
            meeting_ids.add(meeting.id)

    return list(meeting_ids)


class GraphService:
    """Orchestrates meeting graph data assembly and link management."""

    def __init__(self, db: Session) -> None:
        self.repository = GraphRepository(db)

    def get_graph_data(self) -> dict:
        """
        Build graph data with meetings, people, folders, tags, and relationships.

        Returns a dict with keys: nodes, edges, stats.
        """
        meetings = self.repository.get_completed_meetings_with_speakers()

        nodes: list[dict] = []
        edges: list[dict] = []

        people: dict[str, str] = {}
        folders: dict[str, str] = {}
        tags: dict[str, str] = {}
        node_id_counter = 1

        for meeting in meetings:
            meeting_node_id = f"meeting-{meeting.id}"
            nodes.append(
                {
                    "id": meeting_node_id,
                    "label": meeting.filename or f"Meeting {meeting.id}",
                    "type": "meeting",
                    "data": {
                        "id": meeting.id,
                        "filename": meeting.filename,
                        "created_at": meeting.created_at.isoformat() if meeting.created_at else None,
                        "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
                        "status": meeting.status,
                        "tags": meeting.tags,
                        "folder": meeting.folder,
                    },
                }
            )

            # Speakers → person nodes
            for speaker in meeting.speakers:
                if speaker.name:
                    if speaker.name not in people:
                        person_node_id = f"person-{node_id_counter}"
                        node_id_counter += 1
                        people[speaker.name] = person_node_id
                        nodes.append(
                            {
                                "id": person_node_id,
                                "label": speaker.name,
                                "type": "person",
                                "data": {"name": speaker.name},
                            }
                        )
                    edges.append({"source": meeting_node_id, "target": people[speaker.name], "type": "has_participant"})

            # Folder node
            if meeting.folder:
                if meeting.folder not in folders:
                    folder_node_id = f"folder-{node_id_counter}"
                    node_id_counter += 1
                    folders[meeting.folder] = folder_node_id
                    nodes.append(
                        {
                            "id": folder_node_id,
                            "label": meeting.folder,
                            "type": "folder",
                            "data": {"name": meeting.folder},
                        }
                    )
                edges.append({"source": meeting_node_id, "target": folders[meeting.folder], "type": "in_folder"})

            # Tag nodes
            if meeting.tags:
                for tag in [t.strip() for t in meeting.tags.split(",") if t.strip()]:
                    if tag not in tags:
                        tag_node_id = f"tag-{node_id_counter}"
                        node_id_counter += 1
                        tags[tag] = tag_node_id
                        nodes.append({"id": tag_node_id, "label": tag, "type": "tag", "data": {"name": tag}})
                    edges.append({"source": meeting_node_id, "target": tags[tag], "type": "has_tag"})

            # Notes-based meeting references
            if meeting.notes:
                for linked_id in extract_meeting_ids_from_notes(meeting.notes, meetings):
                    if linked_id != meeting.id:
                        target_node_id = f"meeting-{linked_id}"
                        if any(n["id"] == target_node_id for n in nodes):
                            edges.append({"source": meeting_node_id, "target": target_node_id, "type": "references"})

        # Stored meeting links
        node_ids = {n["id"] for n in nodes}
        for link in self.repository.get_all_meeting_links():
            source_node_id = f"meeting-{link.source_meeting_id}"
            target_node_id = f"meeting-{link.target_meeting_id}"
            if source_node_id in node_ids and target_node_id in node_ids:
                already_exists = any(
                    e["source"] == source_node_id and e["target"] == target_node_id and e["type"] == "references"
                    for e in edges
                )
                if not already_exists:
                    edges.append({"source": source_node_id, "target": target_node_id, "type": "references"})

        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "meetings": sum(1 for n in nodes if n["type"] == "meeting"),
                "people": len(people),
                "folders": len(folders),
                "tags": len(tags),
                "relationships": len(edges),
            },
        }

    def create_meeting_link(self, source_id: int, target_id: int) -> dict:
        """Create a link between two meetings. Raises ValueError if a meeting is not found."""
        source = self.repository.get_meeting_by_id(source_id)
        if not source:
            raise ValueError(f"Source meeting {source_id} not found")

        target = self.repository.get_meeting_by_id(target_id)
        if not target:
            raise ValueError(f"Target meeting {target_id} not found")

        existing = self.repository.get_link(source_id, target_id)
        if existing:
            return {"message": "Link already exists", "link_id": existing.id}

        link = self.repository.create_link(source_id, target_id)
        return {
            "message": "Meeting link created successfully",
            "link_id": link.id,
            "source_meeting_id": source_id,
            "target_meeting_id": target_id,
        }

    def delete_meeting_link(self, source_id: int, target_id: int) -> dict:
        """Delete a link between two meetings. Raises ValueError if not found."""
        link = self.repository.get_link(source_id, target_id)
        if not link:
            raise ValueError(f"Meeting link between {source_id} and {target_id} not found")

        self.repository.delete_link(link)
        return {"message": "Meeting link deleted successfully"}
