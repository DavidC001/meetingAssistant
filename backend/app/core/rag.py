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
    chat_history: Optional[List[Dict[str, str]]] = None,
    top_k: int = 5,
    llm_config=None,
    use_full_transcript: bool = False,
    full_transcript: Optional[str] = None,
) -> Tuple[str, List[Dict]]:
    """Generate a response using retrieval-augmented generation.
    
    Args:
        db: Database session
        query: User's question
        meeting_id: Optional meeting ID to filter results
        chat_history: Previous chat messages
        top_k: Number of chunks to retrieve (for RAG mode)
        llm_config: LLM configuration
        use_full_transcript: If True, use full transcript instead of RAG
        full_transcript: The full transcript text (required when use_full_transcript=True)
    
    Returns:
        Tuple of (response_text, sources)
    """

    if llm_config is None:
        llm_config = chat.get_default_chat_config()

    provider_instance = chat.ProviderFactory.create_provider(llm_config)

    # If full transcript mode is enabled, bypass RAG and use the full transcript
    if use_full_transcript and full_transcript:
        LOGGER.info("Using full transcript mode (bypassing RAG)")
        
        system_prompt = (
            "You are an AI meeting assistant that answers questions using the full meeting transcript. "
            "Use the complete transcript provided to answer questions accurately and helpfully. "
            "If a question cannot be answered from the transcript, say so clearly. "
            "Be concise but thorough in your responses."
        )
        
        history = chat_history[-6:] if chat_history else []
        messages = [
            {"role": message.get("role", "user"), "content": message.get("content", "")}
            for message in history
        ]
        
        user_message = (
            "Here is the complete meeting transcript:\n\n"
            f"{full_transcript}\n\n"
            f"User question: {query}\n"
            "Please answer based on the full transcript provided."
        )
        messages.append({"role": "user", "content": user_message})
        
        response_text = await provider_instance.chat_completion(messages, system_prompt)
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
        top_k=top_k,
    )

    context_text = _format_context(retrieved) if retrieved else ""

    system_prompt = (
        "You are an AI meeting assistant that answers questions using provided meeting context. "
        "Use only the supplied context snippets. If the context does not contain the answer, "
        "respond that the information is not available. Cite the sources you used in natural language."
    )

    history = chat_history[-6:] if chat_history else []
    messages = [
        {"role": message.get("role", "user"), "content": message.get("content", "")}
        for message in history
    ]
    if context_text:
        user_message = (
            "Here is relevant meeting context:\n\n"
            f"{context_text}\n\n"
            f"User question: {query}\n"
            "Provide a concise answer and mention which meeting segments were used."
        )
    else:
        user_message = (
            "No relevant meeting context was retrieved. "
            f"Answer the question if you can using prior responses, otherwise explain the limitation.\n\n{query}"
        )
    messages.append({"role": "user", "content": user_message})

    response_text = await provider_instance.chat_completion(messages, system_prompt)
    sources = [_chunk_to_source(chunk) for chunk in retrieved]
    return response_text, sources


def retrieve_relevant_chunks(
    db: Session,
    *,
    query: str,
    meeting_id: Optional[int] = None,
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
            top_k=top_k,
        )
    except Exception as e:
        LOGGER.error(f"Failed to retrieve relevant chunks: {e}", exc_info=True)
        return []

