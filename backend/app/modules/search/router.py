"""Router for global search API."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...database import get_db
from . import schemas
from .service import SearchService

router = APIRouter(
    prefix="/search",
    tags=["search"],
)


def _service(db: Session) -> SearchService:
    return SearchService(db)


@router.post("/", response_model=schemas.SearchResponse)
def search(search_query: schemas.SearchQuery, db: Session = Depends(get_db)):
    """Perform a global search across all meetings."""
    return _service(db).unified_search(search_query)


@router.get("/quick")
def quick_search(q: str = Query(..., min_length=1), limit: int = Query(10, le=50), db: Session = Depends(get_db)):
    """Quick search for autocomplete/suggestions."""
    return _service(db).quick_search(q, limit)
