from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserMappingBase(BaseModel):
    name: str
    email: str

class UserMappingCreate(UserMappingBase):
    pass

class UserMappingUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None

class UserMapping(UserMappingBase):
    id: int
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
