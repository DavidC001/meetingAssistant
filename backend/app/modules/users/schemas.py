from datetime import datetime

from pydantic import BaseModel


class UserMappingBase(BaseModel):
    name: str
    email: str


class UserMappingCreate(UserMappingBase):
    pass


class UserMappingUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    is_active: bool | None = None


class UserMapping(UserMappingBase):
    id: int
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
