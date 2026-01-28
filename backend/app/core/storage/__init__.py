"""
Storage and retrieval module.

This subpackage contains all data storage and retrieval functionality:
- Vector store for embeddings
- Embedding generation
- RAG (Retrieval Augmented Generation)

Re-exports from existing modules for a cleaner API:
    from app.core.storage import VectorStore, PgVectorStore
    from app.core.storage import EmbeddingProvider, get_embedding_provider
    from app.core.storage import generate_rag_response
"""

# Vector store
# Embeddings
from .embeddings import (
    EmbeddingConfig,
    EmbeddingProvider,
    EmbeddingProviderFactory,
    OllamaEmbeddingProvider,
    OpenAIEmbeddingProvider,
    SentenceTransformerEmbeddingProvider,
    batched_embeddings,
    get_embedding_provider,
    validate_embedding_model,
)

# RAG (Retrieval Augmented Generation)
from .rag import (
    generate_rag_response,
    retrieve_relevant_chunks,
)
from .vector_store import (
    PgVectorStore,
    RetrievedChunk,
    VectorStore,
)

__all__ = [
    # Vector store
    "VectorStore",
    "PgVectorStore",
    "RetrievedChunk",
    # Embeddings
    "EmbeddingConfig",
    "EmbeddingProvider",
    "EmbeddingProviderFactory",
    "OpenAIEmbeddingProvider",
    "OllamaEmbeddingProvider",
    "SentenceTransformerEmbeddingProvider",
    "validate_embedding_model",
    "get_embedding_provider",
    "batched_embeddings",
    # RAG
    "generate_rag_response",
    "retrieve_relevant_chunks",
]
