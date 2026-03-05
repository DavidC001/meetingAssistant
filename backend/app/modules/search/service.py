"""Service layer for global search business logic."""
import time

from sqlalchemy.orm import Session

from .repository import SearchRepository
from .schemas import SearchQuery, SearchResponse, SearchResultItem


def highlight_text(text: str, query: str, context_chars: int = 100) -> str:
    """Extract a snippet with the query highlighted."""
    if not text or not query:
        return text[:200] if text else ""

    text_lower = text.lower()
    query_lower = query.lower()

    pos = text_lower.find(query_lower)
    if pos == -1:
        for word in query_lower.split():
            pos = text_lower.find(word)
            if pos != -1:
                break

    if pos == -1:
        return text[:200] + "..." if len(text) > 200 else text

    start = max(0, pos - context_chars)
    end = min(len(text), pos + len(query) + context_chars)

    if start > 0:
        space_pos = text.find(" ", start)
        if space_pos != -1 and space_pos < pos:
            start = space_pos + 1

    if end < len(text):
        space_pos = text.rfind(" ", pos, end)
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

    if query_lower in text_lower:
        return 1.0

    words = query_lower.split()
    matched_words = sum(1 for word in words if word in text_lower)
    return matched_words / len(words) if words else 0.0


class SearchService:
    """Orchestrates search across meetings, transcripts, action items, and notes."""

    def __init__(self, db: Session) -> None:
        self.repository = SearchRepository(db)

    def unified_search(self, search_query: SearchQuery) -> SearchResponse:
        """Perform a global search across all configured content types."""
        start_time = time.time()

        query = search_query.query.strip()
        if not query:
            return SearchResponse(results=[], total=0, query=query, search_time_ms=0)

        results: list[SearchResultItem] = []
        search_pattern = f"%{query}%"

        # Fetch candidate meetings with filters
        meetings = self.repository.get_completed_meetings(
            folder=search_query.folder,
            date_from=search_query.date_from,
            date_to=search_query.date_to,
        )

        # Apply tag filter
        if search_query.tags:
            meetings = [
                m
                for m in meetings
                if m.tags
                and any(t.lower() in [tag.strip().lower() for tag in m.tags.split(",")] for t in search_query.tags)
            ]

        if not meetings:
            return SearchResponse(
                results=[],
                total=0,
                query=query,
                search_time_ms=round((time.time() - start_time) * 1000, 2),
            )

        meeting_ids = [m.id for m in meetings]
        meeting_map = {m.id: m for m in meetings}

        search_in = search_query.search_in or ["transcripts", "summaries", "action_items", "notes"]

        # --- Transcripts ---
        if "transcripts" in search_in:
            for t in self.repository.search_transcriptions_full_text(meeting_ids, search_pattern):
                meeting = meeting_map.get(t.meeting_id)
                if meeting:
                    results.append(
                        SearchResultItem(
                            id=t.id,
                            meeting_id=t.meeting_id,
                            meeting_title=meeting.filename,
                            meeting_date=meeting.meeting_date,
                            content_type="transcript",
                            snippet=highlight_text(t.full_text, query),
                            score=calculate_score(t.full_text, query),
                            folder=meeting.folder,
                            tags=meeting.tags.split(",") if meeting.tags else [],
                        )
                    )

        # --- Summaries ---
        if "summaries" in search_in:
            for t in self.repository.search_transcriptions_summary(meeting_ids, search_pattern):
                meeting = meeting_map.get(t.meeting_id)
                if meeting:
                    results.append(
                        SearchResultItem(
                            id=t.id,
                            meeting_id=t.meeting_id,
                            meeting_title=meeting.filename,
                            meeting_date=meeting.meeting_date,
                            content_type="summary",
                            snippet=highlight_text(t.summary, query),
                            score=calculate_score(t.summary, query),
                            folder=meeting.folder,
                            tags=meeting.tags.split(",") if meeting.tags else [],
                        )
                    )

        # --- Action items ---
        if "action_items" in search_in:
            trans_pairs = self.repository.get_transcription_ids_for_meetings(meeting_ids)
            trans_map = dict(trans_pairs)
            trans_ids = list(trans_map.keys())

            if trans_ids:
                for ai in self.repository.search_action_items(trans_ids, search_pattern):
                    meeting_id = trans_map.get(ai.transcription_id)
                    meeting = meeting_map.get(meeting_id)
                    if meeting:
                        content = f"{ai.task} - {ai.owner or 'Unassigned'}"
                        if ai.notes:
                            content += f" - {ai.notes}"
                        results.append(
                            SearchResultItem(
                                id=ai.id,
                                meeting_id=meeting_id,
                                meeting_title=meeting.filename,
                                meeting_date=meeting.meeting_date,
                                content_type="action_item",
                                snippet=content[:200],
                                score=calculate_score(content, query),
                                folder=meeting.folder,
                                tags=meeting.tags.split(",") if meeting.tags else [],
                            )
                        )

        # --- Notes ---
        if "notes" in search_in:
            for m in self.repository.search_meetings_by_notes(meeting_ids, search_pattern):
                results.append(
                    SearchResultItem(
                        id=m.id,
                        meeting_id=m.id,
                        meeting_title=m.filename,
                        meeting_date=m.meeting_date,
                        content_type="note",
                        snippet=highlight_text(m.notes, query),
                        score=calculate_score(m.notes, query),
                        folder=m.folder,
                        tags=m.tags.split(",") if m.tags else [],
                    )
                )

        # --- Titles (always searched) ---
        for m in self.repository.search_meetings_by_title(meeting_ids, search_pattern):
            score = min(calculate_score(m.filename, query) + 0.5, 1.0)
            results.append(
                SearchResultItem(
                    id=m.id,
                    meeting_id=m.id,
                    meeting_title=m.filename,
                    meeting_date=m.meeting_date,
                    content_type="title",
                    snippet=m.filename,
                    score=score,
                    folder=m.folder,
                    tags=m.tags.split(",") if m.tags else [],
                )
            )

        # Deduplicate and sort by score
        seen: set[tuple[int, str]] = set()
        unique_results: list[SearchResultItem] = []
        for r in sorted(results, key=lambda x: x.score, reverse=True):
            key = (r.meeting_id, r.content_type)
            if key not in seen:
                seen.add(key)
                unique_results.append(r)

        limited = unique_results[: search_query.limit or 20]
        search_time = round((time.time() - start_time) * 1000, 2)

        return SearchResponse(results=limited, total=len(unique_results), query=query, search_time_ms=search_time)

    def quick_search(self, q: str, limit: int) -> dict:
        """Quick search for autocomplete/suggestions."""
        pattern = f"%{q}%"
        results = []

        # Meeting titles
        meetings = self.repository.search_meeting_titles_quick(pattern, limit)
        for m in meetings:
            results.append(
                {
                    "id": m.id,
                    "title": m.filename,
                    "type": "meeting",
                    "folder": m.folder,
                    "date": m.meeting_date.isoformat() if m.meeting_date else None,
                }
            )

        # Action items (fill remaining slots)
        remaining = limit - len(results)
        if remaining > 0:
            action_items = self.repository.search_action_items_quick(pattern, remaining)
            for ai in action_items:
                trans = self.repository.get_transcription_by_id(ai.transcription_id)
                if trans:
                    meeting = self.repository.get_meetings_by_ids([trans.meeting_id])
                    if meeting:
                        m = meeting[0]
                        results.append(
                            {
                                "id": ai.id,
                                "title": ai.task[:50],
                                "type": "action_item",
                                "meeting_id": m.id,
                                "meeting_title": m.filename,
                            }
                        )

        return {"results": results, "query": q}
