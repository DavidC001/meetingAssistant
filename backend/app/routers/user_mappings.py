"""Router for managing user name-to-email mappings."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/user-mappings",
    tags=["user-mappings"]
)


@router.get("/", response_model=List[schemas.UserMapping])
def list_user_mappings(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db)
):
    """List all user mappings."""
    query = db.query(models.UserMapping)
    
    if is_active is not None:
        query = query.filter(models.UserMapping.is_active == is_active)
    
    mappings = query.offset(skip).limit(limit).all()
    return mappings


@router.get("/by-name/{name}", response_model=schemas.UserMapping)
def get_user_mapping_by_name(
    name: str,
    db: Session = Depends(get_db)
):
    """Get a user mapping by name."""
    mapping = crud.get_user_mapping_by_name(db, name)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mapping


@router.get("/by-email/{email}", response_model=schemas.UserMapping)
def get_user_mapping_by_email(
    email: str,
    db: Session = Depends(get_db)
):
    """Get a user mapping by email."""
    mapping = crud.get_user_mapping_by_email(db, email)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mapping


@router.get("/suggest")
def suggest_user_mappings(db: Session = Depends(get_db)):
    """Suggest user mappings based on unique owner names in action items that aren't already mapped."""
    # Get all unique owner names from action items
    owners = db.query(models.ActionItem.owner).distinct().filter(
        models.ActionItem.owner.isnot(None)
    ).all()
    
    # Flatten the list
    owner_names = [owner[0] for owner in owners]
    
    # Filter out names that already have mappings
    unmapped = []
    for name in owner_names:
        existing = crud.get_user_mapping_by_name(db, name)
        if not existing:
            unmapped.append(name)
    
    return {
        "unmapped_names": unmapped,
        "total": len(unmapped)
    }


@router.post("/", response_model=schemas.UserMapping)
def create_user_mapping(
    mapping: schemas.UserMappingCreate,
    db: Session = Depends(get_db)
):
    """Create a new user mapping."""
    # Check if mapping already exists
    existing = crud.get_user_mapping_by_name(db, mapping.name)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Mapping for name '{mapping.name}' already exists"
        )
    
    return crud.create_user_mapping(db, mapping)


@router.put("/{mapping_id}", response_model=schemas.UserMapping)
def update_user_mapping(
    mapping_id: int,
    mapping_update: schemas.UserMappingUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing user mapping."""
    mapping = db.query(models.UserMapping).filter(
        models.UserMapping.id == mapping_id
    ).first()
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    updated = crud.update_user_mapping(db, mapping_id, mapping_update)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update mapping")
    
    return updated


@router.delete("/{mapping_id}")
def delete_user_mapping(
    mapping_id: int,
    db: Session = Depends(get_db)
):
    """Delete a user mapping."""
    mapping = db.query(models.UserMapping).filter(
        models.UserMapping.id == mapping_id
    ).first()
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    success = crud.delete_user_mapping(db, mapping_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete mapping")
    
    return {"message": "Mapping deleted successfully"}
