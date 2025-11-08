"""RAG orchestration utilities for both meeting and global chat."""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from .. import models
from . import chat
from .embeddings import get_embedding_provider
from .vector_store import DEFAULT_VECTOR_STORE, RetrievedChunk

LOGGER = logging.getLogger(__name__)


def _format_context(chunks: Sequence[RetrievedChunk]) -> str:
    parts: List[str] = []
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


def _chunk_to_source(chunk: RetrievedChunk) -> Dict:
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


async def generate_rag_response(
    db: Session,
    *,
    query: str,
    meeting_id: Optional[int] = None,
    meeting_ids: Optional[List[int]] = None,
    chat_history: Optional[List[Dict[str, str]]] = None,
    top_k: int = 5,
    llm_config=None,
    use_full_transcript: bool = False,
    full_transcript: Optional[str] = None,
    enable_tools: bool = True,
) -> Tuple[str, List[Dict]]:
    """Generate a response using retrieval-augmented generation.
    
    Args:
        db: Database session
        query: User's question
        meeting_id: Optional meeting ID to filter results (single meeting)
        meeting_ids: Optional list of meeting IDs to filter results (global chat)
        chat_history: Previous chat messages
        top_k: Number of chunks to retrieve (for RAG mode)
        llm_config: LLM configuration
        use_full_transcript: If True, use full transcript instead of RAG
        full_transcript: The full transcript text (required when use_full_transcript=True)
        enable_tools: Whether to enable tool calling capabilities
    
    Returns:
        Tuple of (response_text, sources)
    """

    if llm_config is None:
        llm_config = chat.get_default_chat_config()

    provider_instance = chat.ProviderFactory.create_provider(llm_config)

    # If full transcript mode is enabled, bypass RAG and use the full transcript
    if use_full_transcript and full_transcript:
        LOGGER.info("Using full transcript mode (bypassing RAG)")
        
        # Use chat_with_meeting which has tool support
        response_text = await chat.chat_with_meeting(
            query=query,
            transcript=full_transcript,
            chat_history=chat_history or [],
            config=llm_config,
            db=db,
            meeting_id=meeting_id,
            enable_tools=enable_tools
        )
        # Return empty sources list when using full transcript
        return response_text, []

    # Standard RAG mode
    try:
        provider, _ = get_embedding_provider(db)
    except Exception as e:
        LOGGER.error(f"Failed to get embedding provider: {e}", exc_info=True)
        return f"Error: Could not initialize embedding provider. {str(e)}", []
    
    try:
        query_embedding = provider.embed_query(query)
    except Exception as e:
        LOGGER.error(f"Failed to generate query embedding: {e}", exc_info=True)
        return f"Error: Could not generate embeddings for your query. {str(e)}", []
        
    if not query_embedding:
        return "I'm sorry, I could not generate embeddings for that query.", []

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
    
    response_text = await chat.chat_with_meeting(
        query=query,
        transcript=transcript_context,
        chat_history=chat_history or [],
        config=llm_config,
        db=db,
        meeting_id=meeting_id,
        enable_tools=enable_tools
    )
    
    sources = [_chunk_to_source(chunk) for chunk in retrieved]
    return response_text, sources


def retrieve_relevant_chunks(
    db: Session,
    *,
    query: str,
    meeting_id: Optional[int] = None,
    meeting_ids: Optional[List[int]] = None,
    top_k: int = 5,
) -> List[RetrievedChunk]:
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

