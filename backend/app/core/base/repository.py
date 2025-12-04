"""
Repository pattern implementation for database operations.

Provides a base class with common CRUD operations that can be inherited
by specific model repositories.

Usage:
    from app.core.base import BaseRepository
    
    class MeetingRepository(BaseRepository[Meeting, MeetingCreate, MeetingUpdate]):
        pass
    
    # In endpoint:
    repo = MeetingRepository(Meeting, db)
    meetings = repo.get_all(skip=0, limit=10)
"""

from typing import TypeVar, Generic, Type, Optional, List, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, asc
from fastapi import HTTPException, status

from .exceptions import NotFoundError

# Type variables for generic repository
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


def get_or_404(
    db: Session,
    model: Type[ModelType],
    id: Any,
    error_message: Optional[str] = None
) -> ModelType:
    """
    Get a record by ID or raise 404.
    
    Args:
        db: Database session
        model: SQLAlchemy model class
        id: Primary key value
        error_message: Custom error message
    
    Returns:
        The found record
    
    Raises:
        HTTPException: 404 if record not found
    """
    obj = db.query(model).filter(model.id == id).first()
    if obj is None:
        detail = error_message or f"{model.__name__} with id {id} not found"
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return obj


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base repository with common CRUD operations.
    
    Provides:
    - get: Get by ID
    - get_or_raise: Get by ID or raise exception
    - get_all: Get with pagination and filtering
    - create: Create new record
    - update: Update existing record
    - delete: Delete record
    - exists: Check if record exists
    - count: Count records
    
    Attributes:
        model: The SQLAlchemy model class
        db: The database session
    """
    
    def __init__(self, model: Type[ModelType], db: Session):
        """
        Initialize repository.
        
        Args:
            model: SQLAlchemy model class
            db: Database session
        """
        self.model = model
        self.db = db
    
    def get(self, id: Any) -> Optional[ModelType]:
        """
        Get a record by ID.
        
        Args:
            id: Primary key value
        
        Returns:
            The record or None if not found
        """
        return self.db.query(self.model).filter(self.model.id == id).first()
    
    def get_or_raise(self, id: Any, error_class: Type[NotFoundError] = NotFoundError) -> ModelType:
        """
        Get a record by ID or raise an exception.
        
        Args:
            id: Primary key value
            error_class: Exception class to raise (default: NotFoundError)
        
        Returns:
            The record
        
        Raises:
            NotFoundError: If record not found
        """
        obj = self.get(id)
        if obj is None:
            raise error_class(self.model.__name__, id)
        return obj
    
    def get_multi(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = False,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[ModelType]:
        """
        Get multiple records with pagination and optional filtering.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Column name to order by
            order_desc: Whether to order descending
            filters: Dictionary of column_name: value pairs for filtering
        
        Returns:
            List of records
        """
        query = self.db.query(self.model)
        
        # Apply filters
        if filters:
            for column, value in filters.items():
                if hasattr(self.model, column) and value is not None:
                    query = query.filter(getattr(self.model, column) == value)
        
        # Apply ordering
        if order_by and hasattr(self.model, order_by):
            column = getattr(self.model, order_by)
            query = query.order_by(desc(column) if order_desc else asc(column))
        
        return query.offset(skip).limit(limit).all()
    
    def get_all(
        self,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """
        Get all records with pagination.
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records to return
        
        Returns:
            List of records
        """
        return self.get_multi(skip=skip, limit=limit)
    
    def create(self, *, obj_in: CreateSchemaType) -> ModelType:
        """
        Create a new record.
        
        Args:
            obj_in: Pydantic schema with creation data
        
        Returns:
            The created record
        """
        # Convert Pydantic model to dict if necessary
        if hasattr(obj_in, "model_dump"):
            obj_data = obj_in.model_dump(exclude_unset=True)
        elif hasattr(obj_in, "dict"):
            obj_data = obj_in.dict(exclude_unset=True)
        else:
            obj_data = dict(obj_in)
        
        db_obj = self.model(**obj_data)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
    
    def update(
        self,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType
    ) -> ModelType:
        """
        Update an existing record.
        
        Args:
            db_obj: The existing database object
            obj_in: Pydantic schema with update data
        
        Returns:
            The updated record
        """
        # Convert Pydantic model to dict if necessary
        if hasattr(obj_in, "model_dump"):
            update_data = obj_in.model_dump(exclude_unset=True)
        elif hasattr(obj_in, "dict"):
            update_data = obj_in.dict(exclude_unset=True)
        else:
            update_data = dict(obj_in)
        
        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj
    
    def delete(self, *, id: Any) -> Optional[ModelType]:
        """
        Delete a record by ID.
        
        Args:
            id: Primary key value
        
        Returns:
            The deleted record or None if not found
        """
        obj = self.get(id)
        if obj:
            self.db.delete(obj)
            self.db.commit()
        return obj
    
    def exists(self, id: Any) -> bool:
        """
        Check if a record exists.
        
        Args:
            id: Primary key value
        
        Returns:
            True if record exists, False otherwise
        """
        return self.db.query(
            self.db.query(self.model).filter(self.model.id == id).exists()
        ).scalar()
    
    def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count records with optional filtering.
        
        Args:
            filters: Dictionary of column_name: value pairs for filtering
        
        Returns:
            Number of matching records
        """
        query = self.db.query(self.model)
        
        if filters:
            for column, value in filters.items():
                if hasattr(self.model, column) and value is not None:
                    query = query.filter(getattr(self.model, column) == value)
        
        return query.count()
    
    def search(
        self,
        *,
        search_term: str,
        search_columns: List[str],
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """
        Search records by term across multiple columns.
        
        Args:
            search_term: Term to search for
            search_columns: List of column names to search in
            skip: Number of records to skip
            limit: Maximum number of records to return
        
        Returns:
            List of matching records
        """
        query = self.db.query(self.model)
        
        # Build OR conditions for search
        conditions = []
        for column_name in search_columns:
            if hasattr(self.model, column_name):
                column = getattr(self.model, column_name)
                conditions.append(column.ilike(f"%{search_term}%"))
        
        if conditions:
            query = query.filter(or_(*conditions))
        
        return query.offset(skip).limit(limit).all()
