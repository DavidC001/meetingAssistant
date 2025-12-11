"""Router for global search API."""
import time
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from . import schemas
from ..meetings import models as meeting_models
from ...database import get_db

router = APIRouter(
    prefix="/search",
    tags=["search"],
)


def highlight_text(text: str, query: str, context_chars: int = 100) -> str:
    """Extract a snippet with the query highlighted."""
    if not text or not query:
        return text[:200] if text else ""
    
    # Find the first occurrence of the query (case insensitive)
    text_lower = text.lower()
    query_lower = query.lower()
    
    # Try to find the query
    pos = text_lower.find(query_lower)
    if pos == -1:
        # Try word-by-word matching
        words = query_lower.split()
        for word in words:
            pos = text_lower.find(word)
            if pos != -1:
                break
    
    if pos == -1:
        # No match found, return beginning of text
        return text[:200] + "..." if len(text) > 200 else text
    
    # Calculate snippet bounds
    start = max(0, pos - context_chars)
    end = min(len(text), pos + len(query) + context_chars)
    
    # Adjust to word boundaries
    if start > 0:
        space_pos = text.find(' ', start)
        if space_pos != -1 and space_pos < pos:
            start = space_pos + 1
    
    if end < len(text):
        space_pos = text.rfind(' ', pos, end)
        if space_pos != -1:
            end = space_pos
    
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    
    return snippet


def calculate_score(text: str, query: str) -> float:
    """Calculate a simple relevance score."""
    if not text or not query:
        return 0.0
    
    text_lower = text.lower()
    query_lower = query.lower()
    
    # Exact match gets highest score
    if query_lower in text_lower:
        return 1.0
    
    # Word match scoring
    words = query_lower.split()
    matched_words = sum(1 for word in words if word in text_lower)
    
    return matched_words / len(words) if words else 0.0


@router.post("/", response_model=schemas.SearchResponse)
def search(
    search_query: schemas.SearchQuery,
    db: Session = Depends(get_db)
):
    """Perform a global search across all meetings."""
    start_time = time.time()
    
    query = search_query.query.strip()
    if not query:
        return schemas.SearchResponse(results=[], total=0, query=query, search_time_ms=0)
    
    results = []
    search_pattern = f"%{query}%"
    
    # Build base meeting query with filters
    base_query = db.query(meeting_models.Meeting).filter(
        meeting_models.Meeting.status == "completed"
    )
    
    # Apply folder filter
    if search_query.folder:
        base_query = base_query.filter(meeting_models.Meeting.folder == search_query.folder)
    
    # Apply date filters
    if search_query.date_from:
        base_query = base_query.filter(meeting_models.Meeting.meeting_date >= search_query.date_from)
    if search_query.date_to:
        base_query = base_query.filter(meeting_models.Meeting.meeting_date <= search_query.date_to)
    
    meetings = base_query.all()
    meeting_ids = [m.id for m in meetings]
    meeting_map = {m.id: m for m in meetings}
    
    # Filter by tags if specified
    if search_query.tags:
        filtered_ids = []
        for m in meetings:
            if m.tags:
                meeting_tags = [t.strip().lower() for t in m.tags.split(',')]
                if any(t.lower() in meeting_tags for t in search_query.tags):
                    filtered_ids.append(m.id)
        meeting_ids = filtered_ids
    
    if not meeting_ids:
        return schemas.SearchResponse(
            results=[], 
            total=0, 
            query=query, 
            search_time_ms=(time.time() - start_time) * 1000
        )
    
    # Search in transcripts
    if "transcripts" in search_query.search_in:
        transcripts = db.query(meeting_models.Transcription).filter(
            meeting_models.Transcription.meeting_id.in_(meeting_ids),
            meeting_models.Transcription.full_text.ilike(search_pattern)
        ).all()
        
        for t in transcripts:
            meeting = meeting_map.get(t.meeting_id)
            if meeting:
                score = calculate_score(t.full_text, query)
                results.append(schemas.SearchResultItem(
                    id=t.id,
                    meeting_id=t.meeting_id,
                    meeting_title=meeting.filename,
                    meeting_date=meeting.meeting_date,
                    content_type="transcript",
                    snippet=highlight_text(t.full_text, query),
                    score=score,
                    folder=meeting.folder,
                    tags=meeting.tags.split(',') if meeting.tags else []
                ))
    
    # Search in summaries
    if "summaries" in search_query.search_in:
        summaries = db.query(meeting_models.Transcription).filter(
            meeting_models.Transcription.meeting_id.in_(meeting_ids),
            meeting_models.Transcription.summary.ilike(search_pattern)
        ).all()
        
        for t in summaries:
            meeting = meeting_map.get(t.meeting_id)
            if meeting:
                score = calculate_score(t.summary, query)
                results.append(schemas.SearchResultItem(
                    id=t.id,
                    meeting_id=t.meeting_id,
                    meeting_title=meeting.filename,
                    meeting_date=meeting.meeting_date,
                    content_type="summary",
                    snippet=highlight_text(t.summary, query),
                    score=score,
                    folder=meeting.folder,
                    tags=meeting.tags.split(',') if meeting.tags else []
                ))
    
    # Search in action items
    if "action_items" in search_query.search_in:
        # Get transcription IDs for the meetings
        trans_query = db.query(meeting_models.Transcription.id, meeting_models.Transcription.meeting_id).filter(
            meeting_models.Transcription.meeting_id.in_(meeting_ids)
        ).all()
        trans_map = {t.id: t.meeting_id for t in trans_query}
        trans_ids = list(trans_map.keys())
        
        if trans_ids:
            action_items = db.query(meeting_models.ActionItem).filter(
                meeting_models.ActionItem.transcription_id.in_(trans_ids),
                or_(
                    meeting_models.ActionItem.task.ilike(search_pattern),
                    meeting_models.ActionItem.owner.ilike(search_pattern),
                    meeting_models.ActionItem.notes.ilike(search_pattern)
                )
            ).all()
            
            for ai in action_items:
                meeting_id = trans_map.get(ai.transcription_id)
                meeting = meeting_map.get(meeting_id)
                if meeting:
                    content = f"{ai.task} - {ai.owner or 'Unassigned'}"
                    if ai.notes:
                        content += f" - {ai.notes}"
                    score = calculate_score(content, query)
                    results.append(schemas.SearchResultItem(
                        id=ai.id,
                        meeting_id=meeting_id,
                        meeting_title=meeting.filename,
                        meeting_date=meeting.meeting_date,
                        content_type="action_item",
                        snippet=content[:200],
                        score=score,
                        folder=meeting.folder,
                        tags=meeting.tags.split(',') if meeting.tags else []
                    ))
    
    # Search in notes
    if "notes" in search_query.search_in:
        notes_results = db.query(meeting_models.Meeting).filter(
            meeting_models.Meeting.id.in_(meeting_ids),
            meeting_models.Meeting.notes.ilike(search_pattern)
        ).all()
        
        for m in notes_results:
            score = calculate_score(m.notes, query)
            results.append(schemas.SearchResultItem(
                id=m.id,
                meeting_id=m.id,
                meeting_title=m.filename,
                meeting_date=m.meeting_date,
                content_type="note",
                snippet=highlight_text(m.notes, query),
                score=score,
                folder=m.folder,
                tags=m.tags.split(',') if m.tags else []
            ))
    
    # Search in meeting titles
    title_matches = db.query(meeting_models.Meeting).filter(
        meeting_models.Meeting.id.in_(meeting_ids),
        meeting_models.Meeting.filename.ilike(search_pattern)
    ).all()
    
    for m in title_matches:
        score = calculate_score(m.filename, query) + 0.5  # Boost title matches
        results.append(schemas.SearchResultItem(
            id=m.id,
            meeting_id=m.id,
            meeting_title=m.filename,
            meeting_date=m.meeting_date,
            content_type="title",
            snippet=m.filename,
            score=min(score, 1.0),
            folder=m.folder,
            tags=m.tags.split(',') if m.tags else []
        ))
    
    # Sort by score and deduplicate by meeting_id + content_type
    seen = set()
    unique_results = []
    for r in sorted(results, key=lambda x: x.score, reverse=True):
        key = (r.meeting_id, r.content_type)
        if key not in seen:
            seen.add(key)
            unique_results.append(r)
    
    # Limit results
    limited_results = unique_results[:search_query.limit]
    
    search_time = (time.time() - start_time) * 1000
    
    return schemas.SearchResponse(
        results=limited_results,
        total=len(unique_results),
        query=query,
        search_time_ms=round(search_time, 2)
    )


@router.get("/quick")
def quick_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db)
):
    """Quick search for autocomplete/suggestions."""
    search_pattern = f"%{q}%"
    
    # Search meeting titles
    meetings = db.query(meeting_models.Meeting).filter(
        meeting_models.Meeting.status == "completed",
        meeting_models.Meeting.filename.ilike(search_pattern)
    ).limit(limit).all()
    
    results = [
        {
            "id": m.id,
            "title": m.filename,
            "type": "meeting",
            "folder": m.folder,
            "date": m.meeting_date.isoformat() if m.meeting_date else None
        }
        for m in meetings
    ]
    
    # Search action items
    if len(results) < limit:
        remaining = limit - len(results)
        action_items = db.query(meeting_models.ActionItem).filter(
            meeting_models.ActionItem.task.ilike(search_pattern)
        ).limit(remaining).all()
        
        for ai in action_items:
            trans = db.query(meeting_models.Transcription).filter(
                meeting_models.Transcription.id == ai.transcription_id
            ).first()
            if trans:
                meeting = db.query(meeting_models.Meeting).filter(
                    meeting_models.Meeting.id == trans.meeting_id
                ).first()
                if meeting:
                    results.append({
                        "id": ai.id,
                        "title": ai.task[:50],
                        "type": "action_item",
                        "meeting_id": meeting.id,
                        "meeting_title": meeting.filename
                    })
    
    return {"results": results, "query": q}
