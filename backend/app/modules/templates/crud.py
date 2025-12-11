"""CRUD operations for meeting templates."""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from . import models, schemas


def get_templates(db: Session, skip: int = 0, limit: int = 100, active_only: bool = True) -> List[models.MeetingTemplate]:
    """Get all templates."""
    query = db.query(models.MeetingTemplate)
    if active_only:
        query = query.filter(models.MeetingTemplate.is_active == True)
    return query.order_by(models.MeetingTemplate.is_default.desc(), models.MeetingTemplate.usage_count.desc()).offset(skip).limit(limit).all()


def get_template(db: Session, template_id: int) -> Optional[models.MeetingTemplate]:
    """Get a template by ID."""
    return db.query(models.MeetingTemplate).filter(models.MeetingTemplate.id == template_id).first()


def get_template_by_name(db: Session, name: str) -> Optional[models.MeetingTemplate]:
    """Get a template by name."""
    return db.query(models.MeetingTemplate).filter(models.MeetingTemplate.name == name).first()


def get_templates_by_type(db: Session, template_type: str) -> List[models.MeetingTemplate]:
    """Get templates by type."""
    return db.query(models.MeetingTemplate).filter(
        models.MeetingTemplate.template_type == template_type,
        models.MeetingTemplate.is_active == True
    ).all()


def create_template(db: Session, template: schemas.MeetingTemplateCreate) -> models.MeetingTemplate:
    """Create a new template."""
    db_template = models.MeetingTemplate(
        name=template.name,
        description=template.description,
        template_type=template.template_type,
        default_language=template.default_language,
        default_speakers=template.default_speakers,
        default_folder=template.default_folder,
        default_tags=template.default_tags,
        expected_speakers=template.expected_speakers,
        summary_sections=template.summary_sections,
        action_item_categories=template.action_item_categories,
        custom_summary_prompt=template.custom_summary_prompt,
        custom_action_item_prompt=template.custom_action_item_prompt,
        icon=template.icon,
        color=template.color
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


def update_template(db: Session, template_id: int, template: schemas.MeetingTemplateUpdate) -> Optional[models.MeetingTemplate]:
    """Update an existing template."""
    db_template = get_template(db, template_id)
    if not db_template:
        return None
    
    update_data = template.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_template, field, value)
    
    db.commit()
    db.refresh(db_template)
    return db_template


def delete_template(db: Session, template_id: int) -> bool:
    """Delete a template."""
    db_template = get_template(db, template_id)
    if not db_template:
        return False
    
    # Don't allow deleting default templates, just deactivate them
    if db_template.is_default:
        db_template.is_active = False
        db.commit()
    else:
        db.delete(db_template)
        db.commit()
    return True


def increment_usage(db: Session, template_id: int) -> None:
    """Increment the usage count of a template."""
    db.query(models.MeetingTemplate).filter(
        models.MeetingTemplate.id == template_id
    ).update({models.MeetingTemplate.usage_count: models.MeetingTemplate.usage_count + 1})
    db.commit()


def initialize_default_templates(db: Session) -> None:
    """Initialize default templates if they don't exist."""
    for template_data in schemas.DEFAULT_TEMPLATES:
        existing = get_template_by_name(db, template_data["name"])
        if not existing:
            template = schemas.MeetingTemplateCreate(**template_data)
            db_template = models.MeetingTemplate(
                **template.model_dump(),
                is_default=True
            )
            db.add(db_template)
    db.commit()
