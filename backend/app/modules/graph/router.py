"""
Graph API endpoints for visualizing meeting relationships.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...database import get_db
from .service import GraphService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/data")
def get_graph_data(db: Session = Depends(get_db)):
    """
    Get graph data with meetings, people (speakers), folders, tags, and their relationships.

    Returns:
    - nodes: List of nodes (meetings, people, folders, tags)
    - edges: List of edges (relationships between nodes)
    """
    try:
        service = GraphService(db)
        return service.get_graph_data()
    except Exception as e:
        logger.error(f"Error generating graph data: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error generating graph data: {str(e)}")


@router.post("/meetings/{meeting_id}/links/{target_meeting_id}")
def create_meeting_link(meeting_id: int, target_meeting_id: int, db: Session = Depends(get_db)):
    """Manually create a link between two meetings."""
    try:
        service = GraphService(db)
        return service.create_meeting_link(meeting_id, target_meeting_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating meeting link: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating meeting link: {str(e)}")


@router.delete("/meetings/{meeting_id}/links/{target_meeting_id}")
def delete_meeting_link(meeting_id: int, target_meeting_id: int, db: Session = Depends(get_db)):
    """Delete a link between two meetings."""
    try:
        service = GraphService(db)
        return service.delete_meeting_link(meeting_id, target_meeting_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting meeting link: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error deleting meeting link: {str(e)}")
