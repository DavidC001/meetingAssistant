"""Schemas for global search."""
from datetime import datetime

from pydantic import BaseModel


class SearchQuery(BaseModel):
    query: str
    search_in: list[str] | None = ["transcripts", "summaries", "action_items", "notes"]
    folder: str | None = None
    tags: list[str] | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    limit: int | None = 20


class SearchResultItem(BaseModel):
    id: int
    meeting_id: int
    meeting_title: str
    meeting_date: datetime | None = None
    content_type: str  # transcript, summary, action_item, note
    snippet: str
    highlight: str | None = None
    score: float
    folder: str | None = None
    tags: list[str] | None = None


class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    total: int
    query: str
    search_time_ms: float
