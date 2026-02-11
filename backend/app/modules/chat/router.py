"""Global chat router providing cross-meeting RAG capabilities."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ... import models
from ...core.llm import chat as llm_chat
from ...core.llm.providers import ProviderFactory
from ...core.storage import rag
from ...database import get_db
from ...dependencies import get_global_chat_service
from ..meetings import crud as meetings_crud
from ..settings import crud as settings_crud
from . import schemas
from .service import GlobalChatService

router = APIRouter(
    prefix="/global-chat",
    tags=["global-chat"],
)


async def _generate_chat_title(db: Session, message: str) -> str:
    title_fallback = (message or "").strip()
    if not title_fallback:
        return "New chat"
    if len(title_fallback) > 60:
        title_fallback = f"{title_fallback[:57]}..."

    try:
        model_config = settings_crud.get_default_model_configuration(db)
        llm_config = None
        if model_config:
            llm_config = llm_chat.model_config_to_llm_config(model_config, use_analysis=False)
        if llm_config is None:
            llm_config = llm_chat.get_default_chat_config()

        provider = ProviderFactory.create_provider(llm_config)
        system_prompt = (
            "Create a short, descriptive chat title (3-6 words). " "Return only the title, no quotes or punctuation."
        )
        response = await provider.chat_completion(
            messages=[{"role": "user", "content": message}],
            system_prompt=system_prompt,
        )
        if isinstance(response, dict):
            response = response.get("message", "")
        title = (response or "").strip().strip('"').strip("'")
        if not title:
            return title_fallback
        if len(title) > 60:
            return f"{title[:57]}..."
        return title
    except Exception:
        return title_fallback


@router.post("/sessions", response_model=schemas.GlobalChatSession)
def create_session(
    payload: schemas.GlobalChatSessionCreate, service: GlobalChatService = Depends(get_global_chat_service)
):
    """
    Create a new global chat session.

    Global chat sessions enable semantic search and Q&A across multiple meetings
    using RAG (Retrieval-Augmented Generation). Filter meetings by folder or tags
    to scope the knowledge base.

    **Parameters:**
    - **title**: Descriptive name for the chat session
    - **tags**: Optional list of tags for organizing sessions
    - **filter_folder**: Optional folder filter to scope search to specific meetings
    - **filter_tags**: Optional tag filter to scope search to specific meetings

    **Returns:**
    New chat session object with unique session_id

    **Example:**
    ```json
    {
        "title": "Q1 2024 Planning Discussions",
        "filter_folder": "planning",
        "filter_tags": ["2024", "q1"]
    }
    ```
    """
    return service.create_session(
        title=payload.title, tags=payload.tags, filter_folder=payload.filter_folder, filter_tags=payload.filter_tags
    )


@router.get("/sessions", response_model=list[schemas.GlobalChatSession])
def list_sessions(skip: int = 0, limit: int = 100, service: GlobalChatService = Depends(get_global_chat_service)):
    """
    List all global chat sessions with pagination.

    Returns sessions ordered by last update (most recent first). Each session
    includes metadata about its scope (filtered folders/tags) and last activity.

    **Parameters:**
    - **skip**: Number of sessions to skip for pagination (default: 0)
    - **limit**: Maximum number of sessions to return (max: 1000, default: 100)

    **Returns:**
    List of chat session objects without message history (use GET /sessions/{id}
    to retrieve messages)

    **Example:**
    ```
    GET /api/v1/global-chat/sessions?skip=0&limit=20
    ```
    """
    return service.list_sessions(skip=skip, limit=limit)


@router.get("/sessions/{session_id}", response_model=schemas.GlobalChatSessionDetail)
def get_session(
    session_id: int, skip: int = 0, limit: int = 100, service: GlobalChatService = Depends(get_global_chat_service)
):
    """
    Get a global chat session with its messages.

    Args:
        session_id: ID of the session
        skip: Number of messages to skip (default: 0)
        limit: Maximum number of messages to return (default: 100)
    """
    session = service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = service.get_messages(session_id, skip=skip, limit=limit)
    return schemas.GlobalChatSessionDetail(session=session, messages=messages)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, service: GlobalChatService = Depends(get_global_chat_service)):
    deleted = service.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deleted", "session_id": session_id}


@router.put("/sessions/{session_id}", response_model=schemas.GlobalChatSession)
def update_session(
    session_id: int,
    payload: schemas.GlobalChatSessionUpdate,
    service: GlobalChatService = Depends(get_global_chat_service),
):
    session = service.update_session(
        session_id=session_id,
        title=payload.title,
        tags=payload.tags,
        filter_folder=payload.filter_folder,
        filter_tags=payload.filter_tags,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/filters/folders")
def get_available_folders(db: Session = Depends(get_db)):
    """Get list of unique folders from completed meetings"""
    from sqlalchemy import distinct

    folders = (
        db.query(distinct(models.Meeting.folder))
        .filter(models.Meeting.folder.isnot(None))
        .filter(models.Meeting.folder != "")
        .filter(models.Meeting.status == models.MeetingStatus.COMPLETED.value)
        .all()
    )
    return [f[0] for f in folders if f[0]]


@router.get("/filters/tags")
def get_available_filter_tags(db: Session = Depends(get_db)):
    """Get list of unique tags from completed meetings for filtering"""
    meetings_with_tags = (
        db.query(models.Meeting.tags)
        .filter(models.Meeting.tags.isnot(None))
        .filter(models.Meeting.tags != "")
        .filter(models.Meeting.status == models.MeetingStatus.COMPLETED.value)
        .all()
    )

    # Parse comma-separated tags and collect unique ones
    tags_set = set()
    for (tags_str,) in meetings_with_tags:
        if tags_str:
            for tag in tags_str.split(","):
                tag = tag.strip()
                if tag:
                    tags_set.add(tag)

    return sorted(tags_set)


@router.post("/sessions/{session_id}/messages", response_model=schemas.GlobalChatMessage)
async def send_message(
    session_id: int,
    payload: schemas.GlobalChatMessageCreate,
    db: Session = Depends(get_db),
    service: GlobalChatService = Depends(get_global_chat_service),
):
    session = service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.title in (None, "", "New chat") and service.get_message_count(session_id) == 0:
        title_candidate = await _generate_chat_title(db, payload.message)
        service.update_session(
            session_id=session_id,
            title=title_candidate,
            tags=session.tags,
            filter_folder=session.filter_folder,
            filter_tags=session.filter_tags,
        )

    history = payload.chat_history
    if history is None:
        existing_messages = service.get_messages(session_id)
        history = [{"role": message.role, "content": message.content} for message in existing_messages[-6:]]

    # Store the user message immediately for persistence
    service.add_message(session_id, role="user", content=payload.message)

    # Get model configuration from database (same as meeting chat)
    from ...core.llm import chat

    model_config = settings_crud.get_default_model_configuration(db)

    llm_config = None
    if model_config:
        llm_config = chat.model_config_to_llm_config(model_config, use_analysis=False)

    # Apply filters if present in the session
    meeting_ids = None
    if session.filter_folder or session.filter_tags:
        meeting_ids = meetings_crud.get_meeting_ids_by_filters(
            db, folder=session.filter_folder, tags=session.filter_tags
        )
        # If filters are applied but no meetings match, inform the user
        if not meeting_ids:
            assistant_message = service.add_message(
                session_id=session_id,
                role="assistant",
                content="No meetings match the current filters. Please adjust your filters or clear them to search all meetings.",
                sources=[],
            )
            return assistant_message

    response_text, sources, follow_ups = await rag.generate_rag_response(
        db,
        query=payload.message,
        meeting_ids=meeting_ids,
        chat_history=history,
        top_k=payload.top_k or 5,
        llm_config=llm_config,
    )

    assistant_message = service.add_message(
        session_id=session_id,
        role="assistant",
        content=response_text,
        sources=sources,
    )
    # Attach follow-up suggestions to the response (not persisted)
    response_data = schemas.GlobalChatMessage.model_validate(assistant_message)
    response_data.follow_up_suggestions = follow_ups or []
    return response_data
