from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ChatMessage(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    history: list[ChatMessage]


class ChatRequest(BaseModel):
    query: str
    chat_history: list[dict] | None = None
    top_k: int | None = 5
    use_full_transcript: bool | None = False
    enable_tools: bool | None = True


class ChatResponse(BaseModel):
    response: str
    sources: list[dict[str, Any]] = []


class GlobalChatSession(BaseModel):
    id: int
    title: str
    tags: str | None = None
    created_at: datetime
    updated_at: datetime
    filter_folder: str | None = None
    filter_tags: str | None = None

    class Config:
        from_attributes = True


class GlobalChatMessage(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    sources: list[dict[str, Any]] | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class GlobalChatSessionCreate(BaseModel):
    title: str | None = None
    tags: str | None = None
    filter_folder: str | None = None
    filter_tags: str | None = None


class GlobalChatSessionUpdate(BaseModel):
    title: str | None = None
    tags: str | None = None
    filter_folder: str | None = None
    filter_tags: str | None = None


class GlobalChatMessageCreate(BaseModel):
    message: str
    chat_history: list[dict[str, Any]] | None = None
    top_k: int | None = 5


class GlobalChatSessionDetail(BaseModel):
    session: GlobalChatSession
    messages: list[GlobalChatMessage]
