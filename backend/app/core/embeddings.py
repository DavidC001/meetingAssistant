"""Embedding utilities for retrieval-augmented generation."""

from __future__ import annotations

import logging
import os
from typing import List, Optional

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency
    OpenAI = None  # type: ignore

from .config import config

logger = logging.getLogger(__name__)

_client: Optional[OpenAI] = None


def _get_client() -> Optional[OpenAI]:
    """Create (or reuse) the OpenAI embeddings client if credentials exist."""

    global _client

    if _client is not None:
        return _client

    if OpenAI is None:
        logger.warning("OpenAI package not installed; embeddings are unavailable.")
        return None

    api_key = config.get_api_key("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OpenAI API key is not configured; embeddings are unavailable.")
        return None

    client_kwargs = {"api_key": api_key}
    base_url = os.getenv("OPENAI_BASE_URL")
    if base_url:
        client_kwargs["base_url"] = base_url

    try:
        _client = OpenAI(**client_kwargs)
    except Exception as exc:  # pragma: no cover - network initialisation
        logger.error("Failed to create OpenAI client for embeddings: %s", exc)
        return None

    return _client


def generate_embedding(text: str, model: Optional[str] = None) -> Optional[List[float]]:
    """Return the embedding vector for the supplied text, if possible."""

    text = (text or "").strip()
    if not text:
        return None

    client = _get_client()
    if client is None:
        return None

    embedding_model = model or getattr(
        config.model,
        "default_embedding_model",
        os.getenv("DEFAULT_EMBEDDING_MODEL", "text-embedding-3-small"),
    )

    try:
        response = client.embeddings.create(model=embedding_model, input=text.replace("\n", " "))
    except Exception as exc:  # pragma: no cover - network errors
        logger.error("Embedding generation failed: %s", exc, exc_info=True)
        return None

    if not response.data:
        logger.warning("Embedding response returned no data for input text of length %d", len(text))
        return None

    return list(response.data[0].embedding)
