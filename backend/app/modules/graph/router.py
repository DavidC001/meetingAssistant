"""
Graph API endpoints for visualizing meeting relationships.
"""

import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from ... import models, schemas
from ...database import get_db
import re

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/graph", tags=["graph"])


def extract_meeting_ids_from_notes(notes: str, all_meetings: List[models.Meeting]) -> List[int]:
    """
    Extract meeting IDs from notes by matching patterns like:
    - #meeting-123
    - Meeting #123
    - meeting:123
    - [[Meeting 123]]
    """
    if not notes:
        return []
    
    meeting_ids = set()
    
    # Pattern 1: #meeting-123 or #123
    pattern1 = r'#(?:meeting-)?(\d+)'
    matches = re.finditer(pattern1, notes, re.IGNORECASE)
    for match in matches:
        meeting_ids.add(int(match.group(1)))
    
    # Pattern 2: meeting:123
    pattern2 = r'meeting:\s*(\d+)'
    matches = re.finditer(pattern2, notes, re.IGNORECASE)
    for match in matches:
        meeting_ids.add(int(match.group(1)))
    
    # Pattern 3: [[Meeting 123]]
    pattern3 = r'\[\[(?:meeting\s*)?(\d+)\]\]'
    matches = re.finditer(pattern3, notes, re.IGNORECASE)
    for match in matches:
        meeting_ids.add(int(match.group(1)))
    
    # Pattern 4: Match by filename in notes
    for meeting in all_meetings:
        if meeting.filename and meeting.filename.lower() in notes.lower():
            meeting_ids.add(meeting.id)
    
    return list(meeting_ids)


@router.get("/data")
def get_graph_data(db: Session = Depends(get_db)):
    """
    Get graph data with meetings, people (speakers), folders, tags, and their relationships.
    
    Returns:
    - nodes: List of nodes (meetings, people, folders, tags)
    - edges: List of edges (relationships between nodes)
    """
    try:
        # Fetch all meetings with speakers
        meetings = db.query(models.Meeting).options(
            joinedload(models.Meeting.speakers)
        ).filter(
            models.Meeting.status == models.MeetingStatus.COMPLETED.value
        ).all()
        
        nodes = []
        edges = []
        
        # Track unique people, folders, and tags
        people = {}  # name -> node_id
        folders = {}  # folder_name -> node_id
        tags = {}  # tag_name -> node_id
        
        node_id_counter = 1
        
        # Process each meeting
        for meeting in meetings:
            meeting_node_id = f"meeting-{meeting.id}"
            
            # Add meeting node
            nodes.append({
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
                }
            })
            
            # Process speakers (people)
            for speaker in meeting.speakers:
                if speaker.name:
                    if speaker.name not in people:
                        person_node_id = f"person-{node_id_counter}"
                        node_id_counter += 1
                        people[speaker.name] = person_node_id
                        
                        nodes.append({
                            "id": person_node_id,
                            "label": speaker.name,
                            "type": "person",
                            "data": {"name": speaker.name}
                        })
                    
                    # Add edge from meeting to person
                    edges.append({
                        "source": meeting_node_id,
                        "target": people[speaker.name],
                        "type": "has_participant"
                    })
            
            # Process folder
            if meeting.folder:
                if meeting.folder not in folders:
                    folder_node_id = f"folder-{node_id_counter}"
                    node_id_counter += 1
                    folders[meeting.folder] = folder_node_id
                    
                    nodes.append({
                        "id": folder_node_id,
                        "label": meeting.folder,
                        "type": "folder",
                        "data": {"name": meeting.folder}
                    })
                
                # Add edge from meeting to folder
                edges.append({
                    "source": meeting_node_id,
                    "target": folders[meeting.folder],
                    "type": "in_folder"
                })
            
            # Process tags
            if meeting.tags:
                tag_list = [tag.strip() for tag in meeting.tags.split(',') if tag.strip()]
                for tag in tag_list:
                    if tag not in tags:
                        tag_node_id = f"tag-{node_id_counter}"
                        node_id_counter += 1
                        tags[tag] = tag_node_id
                        
                        nodes.append({
                            "id": tag_node_id,
                            "label": tag,
                            "type": "tag",
                            "data": {"name": tag}
                        })
                    
                    # Add edge from meeting to tag
                    edges.append({
                        "source": meeting_node_id,
                        "target": tags[tag],
                        "type": "has_tag"
                    })
            
            # Process meeting links from notes
            if meeting.notes:
                linked_meeting_ids = extract_meeting_ids_from_notes(meeting.notes, meetings)
                for linked_id in linked_meeting_ids:
                    if linked_id != meeting.id:  # Don't link to self
                        target_node_id = f"meeting-{linked_id}"
                        # Check if target meeting exists
                        if any(node["id"] == target_node_id for node in nodes):
                            edges.append({
                                "source": meeting_node_id,
                                "target": target_node_id,
                                "type": "references"
                            })
        
        # Also get any stored meeting links
        meeting_links = db.query(models.MeetingLink).all()
        for link in meeting_links:
            source_node_id = f"meeting-{link.source_meeting_id}"
            target_node_id = f"meeting-{link.target_meeting_id}"
            
            # Only add if both nodes exist
            if (any(node["id"] == source_node_id for node in nodes) and 
                any(node["id"] == target_node_id for node in nodes)):
                # Check if edge doesn't already exist
                edge_exists = any(
                    edge["source"] == source_node_id and 
                    edge["target"] == target_node_id and
                    edge["type"] == "references"
                    for edge in edges
                )
                if not edge_exists:
                    edges.append({
                        "source": source_node_id,
                        "target": target_node_id,
                        "type": "references"
                    })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "meetings": len([n for n in nodes if n["type"] == "meeting"]),
                "people": len(people),
                "folders": len(folders),
                "tags": len(tags),
                "relationships": len(edges)
            }
        }
    
    except Exception as e:
        logger.error(f"Error generating graph data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating graph data: {str(e)}")


@router.post("/meetings/{meeting_id}/links/{target_meeting_id}")
def create_meeting_link(
    meeting_id: int,
    target_meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Manually create a link between two meetings.
    """
    try:
        # Verify both meetings exist
        source_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if not source_meeting:
            raise HTTPException(status_code=404, detail="Source meeting not found")
        
        target_meeting = db.query(models.Meeting).filter(models.Meeting.id == target_meeting_id).first()
        if not target_meeting:
            raise HTTPException(status_code=404, detail="Target meeting not found")
        
        # Check if link already exists
        existing_link = db.query(models.MeetingLink).filter(
            models.MeetingLink.source_meeting_id == meeting_id,
            models.MeetingLink.target_meeting_id == target_meeting_id
        ).first()
        
        if existing_link:
            return {"message": "Link already exists", "link_id": existing_link.id}
        
        # Create new link
        new_link = models.MeetingLink(
            source_meeting_id=meeting_id,
            target_meeting_id=target_meeting_id
        )
        db.add(new_link)
        db.commit()
        db.refresh(new_link)
        
        return {
            "message": "Meeting link created successfully",
            "link_id": new_link.id,
            "source_meeting_id": meeting_id,
            "target_meeting_id": target_meeting_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating meeting link: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating meeting link: {str(e)}")


@router.delete("/meetings/{meeting_id}/links/{target_meeting_id}")
def delete_meeting_link(
    meeting_id: int,
    target_meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a link between two meetings.
    """
    try:
        link = db.query(models.MeetingLink).filter(
            models.MeetingLink.source_meeting_id == meeting_id,
            models.MeetingLink.target_meeting_id == target_meeting_id
        ).first()
        
        if not link:
            raise HTTPException(status_code=404, detail="Meeting link not found")
        
        db.delete(link)
        db.commit()
        
        return {"message": "Meeting link deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting meeting link: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error deleting meeting link: {str(e)}")
