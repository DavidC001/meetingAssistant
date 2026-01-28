from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from . import models, schemas


def get_user_mappings(db: Session, skip: int = 0, limit: int = 100):
    """Get all user mappings"""
    return db.query(models.UserMapping).filter(models.UserMapping.is_active == True).offset(skip).limit(limit).all()


def get_user_mapping_by_id(db: Session, mapping_id: int):
    """Get a user mapping by ID"""
    return db.query(models.UserMapping).filter(models.UserMapping.id == mapping_id).first()


def get_user_mapping_by_name(db: Session, name: str):
    """Get a user mapping by name (case-insensitive)"""
    return (
        db.query(models.UserMapping)
        .filter(models.UserMapping.name.ilike(name), models.UserMapping.is_active == True)
        .first()
    )


def get_user_mapping_by_email(db: Session, email: str):
    """Get a user mapping by email (case-insensitive)"""
    return (
        db.query(models.UserMapping)
        .filter(models.UserMapping.email.ilike(email), models.UserMapping.is_active == True)
        .first()
    )


def get_email_for_name(db: Session, name: str) -> str:
    """Get email for a given name, or return the name if no mapping exists"""
    if not name:
        return name
    mapping = get_user_mapping_by_name(db, name)
    return mapping.email if mapping else name


def create_user_mapping(db: Session, user_mapping: schemas.UserMappingCreate):
    """Create a new user mapping"""
    # Check if mapping already exists
    existing = (
        db.query(models.UserMapping)
        .filter(models.UserMapping.name.ilike(user_mapping.name), models.UserMapping.is_active == True)
        .first()
    )

    if existing:
        # Update existing mapping
        existing.email = user_mapping.email
        existing.updated_at = func.now()
        db.commit()
        db.refresh(existing)
        return existing

    db_mapping = models.UserMapping(name=user_mapping.name, email=user_mapping.email, is_active=True)
    db.add(db_mapping)
    db.commit()
    db.refresh(db_mapping)
    return db_mapping


def update_user_mapping(db: Session, mapping_id: int, user_mapping: schemas.UserMappingUpdate):
    """Update a user mapping"""
    db_mapping = get_user_mapping_by_id(db, mapping_id)
    if db_mapping:
        if user_mapping.name is not None:
            db_mapping.name = user_mapping.name
        if user_mapping.email is not None:
            db_mapping.email = user_mapping.email
        if user_mapping.is_active is not None:
            db_mapping.is_active = user_mapping.is_active

        db_mapping.updated_at = func.now()
        db.commit()
        db.refresh(db_mapping)
    return db_mapping


def delete_user_mapping(db: Session, mapping_id: int):
    """Delete (deactivate) a user mapping"""
    db_mapping = get_user_mapping_by_id(db, mapping_id)
    if db_mapping:
        db_mapping.is_active = False
        db.commit()
        return True
    return False
