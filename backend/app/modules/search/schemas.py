"""Schemas for global search."""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class SearchQuery(BaseModel):
    query: str
    search_in: Optional[List[str]] = ["transcripts", "summaries", "action_items", "notes"]
    folder: Optional[str] = None
    tags: Optional[List[str]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    limit: Optional[int] = 20


class SearchResultItem(BaseModel):
    id: int
    meeting_id: int
    meeting_title: str
    meeting_date: Optional[datetime] = None
    content_type: str  # transcript, summary, action_item, note
    snippet: str
    highlight: Optional[str] = None
    score: float
    folder: Optional[str] = None
    tags: Optional[List[str]] = None


class SearchResponse(BaseModel):
    results: List[SearchResultItem]
    total: int
    query: str
    search_time_ms: float
