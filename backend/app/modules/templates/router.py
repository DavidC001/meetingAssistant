"""Router for meeting templates API."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from . import crud, schemas
from ...database import get_db

router = APIRouter(
    prefix="/templates",
    tags=["templates"],
)


@router.get("/", response_model=List[schemas.MeetingTemplate])
def get_templates(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """Get all meeting templates."""
    return crud.get_templates(db, skip=skip, limit=limit, active_only=active_only)


@router.get("/types")
def get_template_types():
    """Get available template types."""
    return [
        {"value": "standup", "label": "Daily Standup", "icon": "🌅"},
        {"value": "retrospective", "label": "Retrospective", "icon": "🔄"},
        {"value": "1on1", "label": "1:1 Meeting", "icon": "👥"},
        {"value": "brainstorm", "label": "Brainstorming", "icon": "💡"},
        {"value": "planning", "label": "Planning", "icon": "📅"},
        {"value": "review", "label": "Review", "icon": "📊"},
        {"value": "custom", "label": "Custom", "icon": "📋"},
    ]


@router.get("/{template_id}", response_model=schemas.MeetingTemplate)
def get_template(template_id: int, db: Session = Depends(get_db)):
    """Get a specific template by ID."""
    template = crud.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/", response_model=schemas.MeetingTemplate)
def create_template(template: schemas.MeetingTemplateCreate, db: Session = Depends(get_db)):
    """Create a new meeting template."""
    existing = crud.get_template_by_name(db, template.name)
    if existing:
        raise HTTPException(status_code=400, detail="Template with this name already exists")
    return crud.create_template(db, template)


@router.put("/{template_id}", response_model=schemas.MeetingTemplate)
def update_template(template_id: int, template: schemas.MeetingTemplateUpdate, db: Session = Depends(get_db)):
    """Update an existing template."""
    updated = crud.update_template(db, template_id, template)
    if not updated:
        raise HTTPException(status_code=404, detail="Template not found")
    return updated


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    """Delete a template."""
    success = crud.delete_template(db, template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}


@router.post("/{template_id}/use")
def use_template(template_id: int, db: Session = Depends(get_db)):
    """Mark a template as used (increment usage count)."""
    template = crud.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    crud.increment_usage(db, template_id)
    return {"message": "Template usage recorded"}


@router.post("/initialize-defaults")
def initialize_defaults(db: Session = Depends(get_db)):
    """Initialize default templates."""
    crud.initialize_default_templates(db)
    return {"message": "Default templates initialized"}
