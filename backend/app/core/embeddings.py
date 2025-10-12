"""Embedding provider abstractions and helpers for the RAG pipeline."""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

import requests
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from .config import config

LOGGER = logging.getLogger(__name__)

HF_MODEL_INFO_URL = "https://huggingface.co/api/models/{model_id}"

try:  # Optional dependency
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover - handled gracefully at runtime
    SentenceTransformer = None

try:  # Optional dependency
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


@dataclass
class EmbeddingConfig:
    """Runtime configuration used to instantiate embedding providers."""

    provider: str
    model_name: str
    dimension: int
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers."""

    def __init__(self, runtime_config: EmbeddingConfig):
        self.runtime_config = runtime_config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")

    @property
    def dimension(self) -> int:
        return self.runtime_config.dimension

    @abstractmethod
    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        """Embed a sequence of texts."""

    def embed_query(self, text: str) -> List[float]:
        """Embed a single query string."""
        vectors = self.embed_documents([text])
        return vectors[0] if vectors else []


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """Embedding provider that proxies to OpenAI's embedding API."""

    def __init__(self, runtime_config: EmbeddingConfig):
        if OpenAI is None:
            raise RuntimeError(
                "openai package is not installed. Please install it to use OpenAI embeddings."
            )
        if not runtime_config.api_key:
            raise RuntimeError("OpenAI API key is required for the OpenAI embedding provider.")
        super().__init__(runtime_config)
        client_kwargs: Dict[str, Any] = {"api_key": runtime_config.api_key}
        if runtime_config.base_url:
            client_kwargs["base_url"] = runtime_config.base_url
        self._client = OpenAI(**client_kwargs)

    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        cleaned_texts = [text if text.strip() else " " for text in texts]
        response = self._client.embeddings.create(
            model=self.runtime_config.model_name,
            input=list(cleaned_texts),
        )
        return [record.embedding for record in response.data]


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Embedding provider that calls a local Ollama instance."""

    def __init__(self, runtime_config: EmbeddingConfig):
        if not runtime_config.base_url:
            raise RuntimeError("Ollama provider requires a base URL (e.g., http://ollama:11434)")
        super().__init__(runtime_config)
        self._endpoint = runtime_config.base_url.rstrip("/") + "/api/embed"

    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        payload = {
            "model": self.runtime_config.model_name,
            "input": list(texts),
        }
        response = requests.post(self._endpoint, json=payload, timeout=120)
        response.raise_for_status()
        data = response.json()
        if "embeddings" in data:
            return data["embeddings"]
        if "embedding" in data:
            # Some versions of Ollama return a single embedding
            return [data["embedding"]]
        raise RuntimeError(f"Unexpected Ollama embedding response format: {data}")


class SentenceTransformerEmbeddingProvider(EmbeddingProvider):
    """Local embedding provider backed by sentence-transformers."""

    _cache: Dict[str, SentenceTransformer] = {}

    def __init__(self, runtime_config: EmbeddingConfig):
        if SentenceTransformer is None:
            raise RuntimeError(
                "sentence-transformers package is not installed. Please install it to use local embeddings."
            )
        super().__init__(runtime_config)
        model_name = runtime_config.model_name
        cache_key = f"{model_name}_{runtime_config.api_key[:8] if runtime_config.api_key else 'no_token'}"
        if cache_key not in self._cache:
            model_kwargs = runtime_config.settings or {}
            # Add HuggingFace token if available (needed for gated models)
            if runtime_config.api_key:
                model_kwargs['token'] = runtime_config.api_key
            try:
                self.logger.info(f"Loading sentence-transformer model: {model_name}")
                self._cache[cache_key] = SentenceTransformer(model_name, **model_kwargs)
                self.logger.info(f"Successfully loaded model: {model_name}")
            except Exception as e:
                self.logger.error(f"Failed to load model {model_name}: {e}")
                error_msg = str(e)
                
                # Provide helpful error messages based on the error type
                if "does not recognize this architecture" in error_msg:
                    raise RuntimeError(
                        f"Model architecture not supported: {model_name}. "
                        f"This model requires a newer version of the transformers library. "
                        f"Error: {error_msg}. "
                        f"Try using a different model like 'sentence-transformers/all-MiniLM-L6-v2' "
                        f"or 'sentence-transformers/all-mpnet-base-v2' instead."
                    )
                elif "gated" in error_msg.lower() or "authentication" in error_msg.lower():
                    raise RuntimeError(
                        f"Failed to load model {model_name}. "
                        f"This appears to be a gated model. "
                        f"Ensure HUGGINGFACE_TOKEN is set in your environment and you have access to this model. "
                        f"Error: {error_msg}"
                    )
                else:
                    raise RuntimeError(
                        f"Failed to load model {model_name}. "
                        f"Error: {error_msg}. "
                        f"If this is a gated model, ensure HUGGINGFACE_TOKEN is set in your environment."
                    )
        self._model = self._cache[cache_key]

    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        # The encode method already batches internally; we still wrap for logging
        embeddings = self._model.encode(
            list(texts),
            show_progress_bar=False,
            normalize_embeddings=False,
        )
        return [list(map(float, vector)) for vector in embeddings]


class EmbeddingProviderFactory:
    """Factory responsible for instantiating embedding providers."""

    _registry: Dict[str, type[EmbeddingProvider]] = {
        "openai": OpenAIEmbeddingProvider,
        "ollama": OllamaEmbeddingProvider,
        "sentence-transformers": SentenceTransformerEmbeddingProvider,
        "local": SentenceTransformerEmbeddingProvider,
    }

    @classmethod
    def create(cls, runtime_config: EmbeddingConfig) -> EmbeddingProvider:
        provider_key = runtime_config.provider.lower()
        if provider_key not in cls._registry:
            raise ValueError(f"Unsupported embedding provider: {runtime_config.provider}")
        provider_cls = cls._registry[provider_key]
        return provider_cls(runtime_config)


DEFAULT_LOCAL_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def _check_huggingface_model(model_name: str) -> Tuple[bool, str, Optional[int]]:
    """Check whether a Hugging Face model repository exists and get its dimension.
    
    Returns:
        Tuple of (valid, message, dimension)
    """

    if not model_name or not model_name.strip():
        return False, "A model name is required.", None

    url = HF_MODEL_INFO_URL.format(model_id=model_name)
    
    # Try to get HuggingFace token for authentication
    headers = {}
    hf_token = config.api.huggingface_token
    if hf_token:
        headers["Authorization"] = f"Bearer {hf_token}"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
    except requests.RequestException as exc:  # pragma: no cover - network failure
        LOGGER.warning("Failed to reach Hugging Face for model %s: %s", model_name, exc)
        return False, "Could not verify the model on Hugging Face. Please try again.", None

    if response.status_code == 404:
        return False, "Model not found on Hugging Face. Check the repository name.", None
    
    if response.status_code == 401 or response.status_code == 403:
        if not hf_token:
            return False, "This model requires authentication. Please provide a HuggingFace token in the HUGGINGFACE_TOKEN environment variable.", None
        else:
            return False, "Access denied. Your HuggingFace token may not have access to this model, or the token is invalid.", None
    
    if response.status_code != 200:
        LOGGER.warning(
            "Unexpected response when checking Hugging Face model %s: %s %s",
            model_name,
            response.status_code,
            response.text,
        )
        return (
            False,
            "Unable to confirm the model on Hugging Face due to an unexpected response.",
            None,
        )
    
    # Model found, try to extract dimension from config
    dimension = None
    try:
        model_info = response.json()
        # Try to get dimension from config
        if "config" in model_info:
            config_data = model_info["config"]
            # Common keys for embedding dimension in different model architectures
            dimension_keys = [
                "hidden_size",
                "d_model", 
                "embedding_size",
                "n_embd",
                "dim",
                "embedding_dim"
            ]
            for key in dimension_keys:
                if key in config_data:
                    dimension = int(config_data[key])
                    LOGGER.info(f"Found dimension {dimension} for model {model_name} via key '{key}'")
                    break
        
        # If dimension still not found, try to load the actual config file
        if dimension is None:
            config_url = f"https://huggingface.co/{model_name}/resolve/main/config.json"
            config_headers = {}
            if hf_token:
                config_headers["Authorization"] = f"Bearer {hf_token}"
            try:
                config_response = requests.get(config_url, headers=config_headers, timeout=10)
                if config_response.status_code == 200:
                    config_json = config_response.json()
                    for key in dimension_keys:
                        if key in config_json:
                            dimension = int(config_json[key])
                            LOGGER.info(f"Found dimension {dimension} for model {model_name} via config.json key '{key}'")
                            break
            except Exception as e:
                LOGGER.debug(f"Could not fetch config.json for {model_name}: {e}")
        
        message = f"Model found on Hugging Face{f' (dimension: {dimension})' if dimension else ''}."
        return True, message, dimension
        
    except Exception as e:
        LOGGER.warning(f"Error extracting dimension for {model_name}: {e}")
        return True, "Model found on Hugging Face.", None


def validate_embedding_model(provider: str, model_name: str) -> Tuple[bool, str, Optional[int]]:
    """Validate that a requested embedding model is available for the provider.
    
    Returns:
        Tuple of (valid, message, dimension) where dimension is only available for sentence-transformers
    """

    provider_key = (provider or "").lower()
    if provider_key in {"sentence-transformers", "local"}:
        return _check_huggingface_model(model_name)

    # For OpenAI and Ollama we rely on runtime errors if the model is unavailable.
    return True, "", None


def _resolve_runtime_config(db: Session, db_config: models.EmbeddingConfiguration) -> EmbeddingConfig:
    """Convert a database configuration into a runtime configuration."""

    provider = db_config.provider.lower()
    api_key: Optional[str] = None
    if db_config.api_key_id:
        api_key_record = crud.get_api_key(db, db_config.api_key_id)
        if api_key_record:
            api_key = config.get_api_key(api_key_record.environment_variable)
    if not api_key and provider == "openai":
        api_key = config.get_api_key("OPENAI_API_KEY")
    # For sentence-transformers, use HuggingFace token if available (needed for gated models)
    if not api_key and provider in {"sentence-transformers", "local"}:
        api_key = config.api.huggingface_token

    base_url = db_config.base_url
    if not base_url and provider == "ollama":
        base_url = config.model.ollama_base_url

    settings = db_config.settings or {}

    return EmbeddingConfig(
        provider=db_config.provider,
        model_name=db_config.model_name,
        dimension=db_config.dimension,
        api_key=api_key,
        base_url=base_url,
        settings=settings,
    )


def ensure_active_embedding_configuration(db: Session) -> models.EmbeddingConfiguration:
    """Fetch the active embedding configuration, creating a default if necessary."""

    config_record = crud.get_active_embedding_configuration(db)
    if config_record:
        return config_record

    if SentenceTransformer is None:
        raise RuntimeError(
            "No embedding configuration found and sentence-transformers is not installed. "
            "Install sentence-transformers or create a configuration manually."
        )

    LOGGER.info("Creating default local embedding configuration using %s", DEFAULT_LOCAL_MODEL)
    
    # Get HuggingFace token if available
    hf_token = config.api.huggingface_token
    model_kwargs = {}
    if hf_token:
        model_kwargs['token'] = hf_token
        
    try:
        model = SentenceTransformer(DEFAULT_LOCAL_MODEL, **model_kwargs)
        dimension = int(model.get_sentence_embedding_dimension())
    except Exception as e:
        LOGGER.error(f"Failed to load default model {DEFAULT_LOCAL_MODEL}: {e}")
        raise RuntimeError(
            f"Failed to initialize default embedding model. "
            f"Error: {str(e)}. "
            "Please create an embedding configuration manually in the settings."
        )
    
    create_schema = schemas.EmbeddingConfigurationCreate(
        provider="sentence-transformers",
        model_name=DEFAULT_LOCAL_MODEL,
        dimension=dimension,
        settings={"device": "cpu"},
        is_active=True,
    )
    return crud.create_embedding_configuration(db, create_schema)


def get_embedding_provider(db: Session) -> Tuple[EmbeddingProvider, models.EmbeddingConfiguration]:
    """Return an embedding provider bound to the active configuration."""

    db_config = ensure_active_embedding_configuration(db)
    runtime_config = _resolve_runtime_config(db, db_config)
    provider = EmbeddingProviderFactory.create(runtime_config)
    return provider, db_config


def batched_embeddings(
    provider: EmbeddingProvider,
    texts: Sequence[str],
    *,
    batch_size: int = 32,
    sleep: float = 0.0,
) -> List[List[float]]:
    """Generate embeddings in batches to avoid hitting rate limits."""

    batches: List[List[float]] = []
    for index in range(0, len(texts), batch_size):
        chunk = texts[index : index + batch_size]
        if not chunk:
            continue
        embeddings = provider.embed_documents(chunk)
        batches.extend(embeddings)
        if sleep:
            time.sleep(sleep)
    return batches

