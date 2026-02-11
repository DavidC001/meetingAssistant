"""RAG orchestration utilities for both meeting and global chat."""

from __future__ import annotations

import logging
from collections.abc import Sequence

from sqlalchemy.orm import Session

from ..llm import chat
from .embeddings import get_embedding_provider
from .vector_store import DEFAULT_PROJECT_VECTOR_STORE, DEFAULT_VECTOR_STORE, ProjectRetrievedChunk, RetrievedChunk

LOGGER = logging.getLogger(__name__)


def _format_context(chunks: Sequence[RetrievedChunk]) -> str:
    parts: list[str] = []
    for result in chunks:
        chunk = result.chunk
        metadata = chunk.chunk_metadata or {}
        descriptor = metadata.get("source", chunk.content_type)
        header = f"Source: {descriptor} (Meeting {chunk.meeting_id}, Chunk {chunk.chunk_index})"
        if attachment := metadata.get("attachment_name"):
            header += f" | Attachment: {attachment}"
        if timestamp := metadata.get("timestamp"):
            header += f" | Timestamp: {timestamp}"
        snippet = chunk.content.strip().replace("\n", " ")
        parts.append(f"{header}\n{snippet}")
    return "\n\n".join(parts)


def _chunk_to_source(chunk: RetrievedChunk) -> dict:
    metadata = chunk.chunk.chunk_metadata or {}
    meeting = chunk.chunk.meeting
    meeting_name = getattr(meeting, "filename", f"Meeting {chunk.chunk.meeting_id}") if meeting else None
    source = {
        "meeting_id": chunk.chunk.meeting_id,
        "meeting_name": meeting_name,
        "content_type": chunk.chunk.content_type,
        "chunk_index": chunk.chunk.chunk_index,
        "similarity": chunk.similarity,
        "snippet": chunk.chunk.content[:500],
        "metadata": metadata,
    }
    if attachment_id := chunk.chunk.attachment_id:
        source["attachment_id"] = attachment_id
    return source


def _format_project_context(chunks: Sequence[ProjectRetrievedChunk]) -> str:
    parts: list[str] = []
    for result in chunks:
        chunk = result.chunk
        metadata = chunk.chunk_metadata or {}
        note_title = metadata.get("note_title")
        descriptor = metadata.get("source", chunk.content_type)
        header = f"Source: {descriptor} (Project {chunk.project_id}, Chunk {chunk.chunk_index})"
        if note_title:
            header += f" | Note: {note_title}"
        if attachment := metadata.get("attachment_name"):
            header += f" | Attachment: {attachment}"
        snippet = chunk.content.strip().replace("\n", " ")
        parts.append(f"{header}\n{snippet}")
    return "\n\n".join(parts)


def _project_chunk_to_source(chunk: ProjectRetrievedChunk) -> dict:
    metadata = chunk.chunk.chunk_metadata or {}
    source = {
        "project_id": chunk.chunk.project_id,
        "note_id": chunk.chunk.note_id,
        "note_title": metadata.get("note_title"),
        "content_type": chunk.chunk.content_type,
        "chunk_index": chunk.chunk.chunk_index,
        "similarity": chunk.similarity,
        "snippet": chunk.chunk.content[:500],
        "metadata": metadata,
    }
    if attachment_id := chunk.chunk.attachment_id:
        source["attachment_id"] = attachment_id
        if metadata.get("attachment_name"):
            source["attachment_name"] = metadata.get("attachment_name")
    return source


_TOOL_LABELS: dict[str, str] = {
    "search_content": "Content Search",
    "list_action_items": "Action Items",
    "create_action_item": "Action Item Created",
    "update_action_item": "Action Item Updated",
    "delete_action_item": "Action Item Deleted",
    "add_note_to_meeting": "Meeting Note Added",
    "update_meeting_details": "Meeting Updated",
    "list_meetings": "Meeting List",
    "get_meeting_details": "Meeting Details",
    "get_meeting_summary": "Meeting Summary",
    "get_meeting_speakers": "Meeting Speakers",
    "get_upcoming_deadlines": "Upcoming Deadlines",
    "list_projects": "Project List",
    "list_project_notes": "Project Notes",
    "create_project_note": "Project Note Created",
    "create_project_milestone": "Milestone Created",
    "list_milestones": "Milestones",
}


def _tool_results_to_sources(tool_results: list[dict]) -> list[dict]:
    """Convert tool execution results into clean source objects for the frontend."""
    sources = []
    for item in tool_results or []:
        tool_name = item.get("tool", "")
        raw_result = item.get("result")

        # Unwrap the execute_tool envelope: {"success": bool, "result": actual}
        if isinstance(raw_result, dict) and "success" in raw_result:
            success = raw_result.get("success", False)
            result = raw_result.get("result") if success else raw_result.get("error", "Tool execution failed")
        else:
            result = raw_result

        tool_label = _TOOL_LABELS.get(tool_name, tool_name.replace("_", " ").title() if tool_name else "Tool Result")

        # Handle search_content results (dict with matches list)
        if isinstance(result, dict) and isinstance(result.get("matches"), list):
            for match in result.get("matches", []):
                sources.append(
                    {
                        "meeting_id": match.get("meeting_id"),
                        "meeting_name": match.get("meeting_name"),
                        "content_type": "tool_search",
                        "snippet": match.get("snippet", ""),
                        "similarity": None,
                        "metadata": {
                            "tool": tool_name,
                            "tool_label": tool_label,
                            "query": result.get("query"),
                        },
                    }
                )
            continue

        # Format snippet: use the string directly, or extract a message
        if isinstance(result, str):
            snippet = result
        elif isinstance(result, dict):
            snippet = result.get("message") or result.get("error") or str(result)
        else:
            snippet = str(result) if result is not None else ""

        sources.append(
            {
                "content_type": "tool_result",
                "snippet": snippet,
                "similarity": None,
                "metadata": {"tool": tool_name, "tool_label": tool_label},
            }
        )
    return sources


async def generate_rag_response(
    db: Session,
    *,
    query: str,
    meeting_id: int | None = None,
    meeting_ids: list[int] | None = None,
    chat_history: list[dict[str, str]] | None = None,
    top_k: int = 5,
    llm_config=None,
    use_full_transcript: bool = False,
    full_transcript: str | None = None,
    enable_tools: bool = True,
    allow_iterative_research: bool = False,
) -> tuple[str, list[dict], list[str]]:
    """Generate a response using retrieval-augmented generation.

    Returns:
        Tuple of (response_text, sources, follow_up_suggestions)
    """

    if llm_config is None:
        llm_config = chat.get_default_chat_config()

    provider_instance = chat.ProviderFactory.create_provider(llm_config)

    # If full transcript mode is enabled, bypass RAG and use the full transcript
    if use_full_transcript and full_transcript:
        LOGGER.info("Using full transcript mode (bypassing RAG)")

        # Use chat_with_meeting which has tool support
        response_text, tool_results, follow_ups = await chat.chat_with_meeting(
            query=query,
            transcript=full_transcript,
            chat_history=chat_history or [],
            config=llm_config,
            db=db,
            meeting_id=meeting_id,
            meeting_ids=meeting_ids,
            project_id=None,
            enable_tools=enable_tools,
            return_tool_results=True,
            allow_iterative_research=allow_iterative_research,
        )
        # Return tool sources only when using full transcript
        return response_text, _tool_results_to_sources(tool_results), follow_ups

    # Standard RAG mode
    try:
        provider, _ = get_embedding_provider(db)
    except Exception as e:
        LOGGER.error(f"Failed to get embedding provider: {e}", exc_info=True)
        return f"Error: Could not initialize embedding provider. {str(e)}", [], []

    try:
        query_embedding = provider.embed_query(query)
    except Exception as e:
        LOGGER.error(f"Failed to generate query embedding: {e}", exc_info=True)
        return f"Error: Could not generate embeddings for your query. {str(e)}", [], []

    if not query_embedding:
        return "I'm sorry, I could not generate embeddings for that query.", [], []

    retrieved = DEFAULT_VECTOR_STORE.similarity_search(
        db,
        query_embedding,
        meeting_id=meeting_id,
        meeting_ids=meeting_ids,
        top_k=top_k,
    )

    context_text = _format_context(retrieved) if retrieved else ""

    # Use the enhanced chat function with tool support
    if context_text:
        transcript_context = (
            "Here is relevant meeting context:\n\n"
            f"{context_text}\n\n"
            "Use this context to answer the user's question."
        )
    else:
        transcript_context = "No relevant meeting context was retrieved for this query."

    response_text, tool_results, follow_ups = await chat.chat_with_meeting(
        query=query,
        transcript=transcript_context,
        chat_history=chat_history or [],
        config=llm_config,
        db=db,
        meeting_id=meeting_id,
        meeting_ids=meeting_ids,
        project_id=None,
        enable_tools=enable_tools,
        return_tool_results=True,
        allow_iterative_research=allow_iterative_research,
    )

    sources = [_chunk_to_source(chunk) for chunk in retrieved]
    sources.extend(_tool_results_to_sources(tool_results))
    return response_text, sources, follow_ups


def retrieve_relevant_chunks(
    db: Session,
    *,
    query: str,
    meeting_id: int | None = None,
    meeting_ids: list[int] | None = None,
    top_k: int = 5,
) -> list[RetrievedChunk]:
    try:
        provider, _ = get_embedding_provider(db)
        query_embedding = provider.embed_query(query)
        if not query_embedding:
            LOGGER.warning("Empty query embedding returned")
            return []
        return DEFAULT_VECTOR_STORE.similarity_search(
            db,
            query_embedding,
            meeting_id=meeting_id,
            meeting_ids=meeting_ids,
            top_k=top_k,
        )
    except Exception as e:
        LOGGER.error(f"Failed to retrieve relevant chunks: {e}", exc_info=True)
        return []


async def generate_project_rag_response(
    db: Session,
    *,
    query: str,
    project_id: int,
    meeting_ids: list[int] | None = None,
    chat_history: list[dict[str, str]] | None = None,
    top_k: int = 5,
    llm_config=None,
    enable_tools: bool = True,
    system_prompt_override: str | None = None,
) -> tuple[str, list[dict], list[str]]:
    """Generate a response using both meeting and project-note context.

    Returns:
        Tuple of (response_text, sources, follow_up_suggestions)
    """
    if llm_config is None:
        llm_config = chat.get_default_chat_config()

    provider_instance = chat.ProviderFactory.create_provider(llm_config)

    try:
        provider, _ = get_embedding_provider(db)
    except Exception as e:
        LOGGER.error(f"Failed to get embedding provider: {e}", exc_info=True)
        return f"Error: Could not initialize embedding provider. {str(e)}", [], []

    try:
        query_embedding = provider.embed_query(query)
    except Exception as e:
        LOGGER.error(f"Failed to generate query embedding: {e}", exc_info=True)
        return f"Error: Could not generate embeddings for your query. {str(e)}", [], []

    if not query_embedding:
        return "I'm sorry, I could not generate embeddings for that query.", [], []

    meeting_chunks: list[RetrievedChunk] = []
    if meeting_ids:
        meeting_chunks = DEFAULT_VECTOR_STORE.similarity_search(
            db,
            query_embedding,
            meeting_ids=meeting_ids,
            top_k=top_k,
        )

    project_chunks = DEFAULT_PROJECT_VECTOR_STORE.similarity_search(
        db,
        query_embedding,
        project_id=project_id,
        top_k=top_k,
    )

    combined = [*meeting_chunks, *project_chunks]
    combined_sorted = sorted(combined, key=lambda item: item.similarity, reverse=True)[:top_k]

    meeting_context = _format_context([c for c in combined_sorted if isinstance(c, RetrievedChunk)])
    project_context = _format_project_context([c for c in combined_sorted if isinstance(c, ProjectRetrievedChunk)])

    context_blocks = []
    if meeting_context:
        context_blocks.append("Relevant meeting context:\n\n" + meeting_context)
    if project_context:
        context_blocks.append("Relevant project notes/documents:\n\n" + project_context)

    transcript_context = (
        "\n\n".join(context_blocks) if context_blocks else "No relevant context was retrieved for this query."
    )

    response_text, tool_results, follow_ups = await chat.chat_with_meeting(
        query=query,
        transcript=transcript_context,
        chat_history=chat_history or [],
        config=llm_config,
        db=db,
        meeting_id=None,
        meeting_ids=meeting_ids,
        project_id=project_id,
        enable_tools=enable_tools,
        system_prompt_override=system_prompt_override,
        return_tool_results=True,
        allow_iterative_research=False,
    )

    sources: list[dict] = []
    for chunk in combined_sorted:
        if isinstance(chunk, RetrievedChunk):
            sources.append(_chunk_to_source(chunk))
        else:
            sources.append(_project_chunk_to_source(chunk))

    sources.extend(_tool_results_to_sources(tool_results))
    return response_text, sources, follow_ups
