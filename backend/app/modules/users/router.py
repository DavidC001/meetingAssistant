"""Router for managing user name-to-email mappings."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...database import get_db
from . import schemas
from .service import UserMappingService

router = APIRouter(prefix="/user-mappings", tags=["user-mappings"])


def _service(db: Session) -> UserMappingService:
    return UserMappingService(db)


@router.get("/", response_model=list[schemas.UserMapping])
def list_user_mappings(
    skip: int = 0,
    limit: int = 100,
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
):
    """List all user mappings."""
    return _service(db).list_all(skip=skip, limit=limit, is_active=is_active)


@router.get("/by-name/{name}", response_model=schemas.UserMapping)
def get_user_mapping_by_name(name: str, db: Session = Depends(get_db)):
    """Get a user mapping by name."""
    mapping = _service(db).get_mapping_by_name(name)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mapping


@router.get("/by-email/{email}", response_model=schemas.UserMapping)
def get_user_mapping_by_email(email: str, db: Session = Depends(get_db)):
    """Get a user mapping by email."""
    mapping = _service(db).get_mapping_by_email(email)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return mapping


@router.get("/suggest")
def suggest_user_mappings(db: Session = Depends(get_db)):
    """Suggest user mappings based on unique owner names in action items that aren't already mapped."""
    unmapped = _service(db).get_unmapped_action_owners()
    return {"unmapped_names": unmapped, "total": len(unmapped)}


@router.post("/", response_model=schemas.UserMapping)
def create_user_mapping(mapping: schemas.UserMappingCreate, db: Session = Depends(get_db)):
    """Create a new user mapping."""
    existing = _service(db).get_mapping_by_name(mapping.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"Mapping for name '{mapping.name}' already exists")
    return _service(db).create_mapping(mapping)


@router.put("/{mapping_id}", response_model=schemas.UserMapping)
def update_user_mapping(mapping_id: int, mapping_update: schemas.UserMappingUpdate, db: Session = Depends(get_db)):
    """Update an existing user mapping."""
    svc = _service(db)
    mapping = svc.get_mapping_by_id(mapping_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    updated = svc.update_mapping(mapping_id, mapping_update)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update mapping")
    return updated


@router.delete("/{mapping_id}")
def delete_user_mapping(mapping_id: int, db: Session = Depends(get_db)):
    """Delete a user mapping."""
    svc = _service(db)
    mapping = svc.get_mapping_by_id(mapping_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    success = svc.delete_mapping(mapping_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete mapping")
    return {"message": "Mapping deleted successfully"}
