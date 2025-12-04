from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any

class ChatMessage(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChatHistoryResponse(BaseModel):
    history: List[ChatMessage]

class ChatRequest(BaseModel):
    query: str
    chat_history: Optional[List[dict]] = None
    top_k: Optional[int] = 5
    use_full_transcript: Optional[bool] = False
    enable_tools: Optional[bool] = True

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]] = []

class GlobalChatSession(BaseModel):
    id: int
    title: str
    tags: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    filter_folder: Optional[str] = None
    filter_tags: Optional[str] = None

    class Config:
        from_attributes = True

class GlobalChatMessage(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    sources: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

    class Config:
        from_attributes = True

class GlobalChatSessionCreate(BaseModel):
    title: Optional[str] = None
    tags: Optional[str] = None
    filter_folder: Optional[str] = None
    filter_tags: Optional[str] = None

class GlobalChatSessionUpdate(BaseModel):
    title: Optional[str] = None
    tags: Optional[str] = None
    filter_folder: Optional[str] = None
    filter_tags: Optional[str] = None

class GlobalChatMessageCreate(BaseModel):
    message: str
    chat_history: Optional[List[Dict[str, Any]]] = None
    top_k: Optional[int] = 5

class GlobalChatSessionDetail(BaseModel):
    session: GlobalChatSession
    messages: List[GlobalChatMessage]
