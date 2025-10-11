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
        metadata = chunk.metadata or {}
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
    metadata = chunk.chunk.metadata or {}
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
) -> Tuple[str, List[Dict]]:
    """Generate a response using retrieval-augmented generation."""

    provider, _ = get_embedding_provider(db)
    query_embedding = provider.embed_query(query)
    if not query_embedding:
        return "I'm sorry, I could not generate embeddings for that query.", []

    retrieved = DEFAULT_VECTOR_STORE.similarity_search(
        db,
        query_embedding,
        meeting_id=meeting_id,
        top_k=top_k,
    )

    context_text = _format_context(retrieved) if retrieved else ""

    if llm_config is None:
        llm_config = chat.get_default_chat_config()

    provider_instance = chat.ProviderFactory.create_provider(llm_config)

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
    provider, _ = get_embedding_provider(db)
    query_embedding = provider.embed_query(query)
    if not query_embedding:
        return []
    return DEFAULT_VECTOR_STORE.similarity_search(
        db,
        query_embedding,
        meeting_id=meeting_id,
        top_k=top_k,
    )

