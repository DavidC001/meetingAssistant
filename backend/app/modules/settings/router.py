"""Settings router â€“ thin HTTP layer using SettingsService."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ...core.storage.embeddings import validate_embedding_model
from ...database import get_db
from ...tasks import compute_embeddings_for_meeting, recompute_all_embeddings
from . import schemas
from .service import SettingsService

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)


def _service(db: Session) -> SettingsService:
    return SettingsService(db)


# ---------------------------------------------------------------------------
# App Settings
# ---------------------------------------------------------------------------


@router.get("/app-settings")
def get_app_settings(db: Session = Depends(get_db)):
    """Get application settings like max file size."""
    return _service(db).get_app_settings()


@router.post("/app-settings")
def update_app_settings(settings: dict[str, int], db: Session = Depends(get_db)):
    """Update application settings."""
    try:
        return _service(db).update_app_settings(settings)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# API Tokens (legacy env-file-based tokens)
# ---------------------------------------------------------------------------


@router.get("/api-tokens")
def get_api_tokens_status(db: Session = Depends(get_db)):
    """Get the status of API tokens (whether they are configured or not)."""
    return _service(db).get_api_tokens_status()


@router.post("/api-tokens")
def update_api_tokens(tokens: dict[str, str], db: Session = Depends(get_db)):
    """Update API tokens. Writes to the .env file for persistence."""
    try:
        return _service(db).update_api_tokens(tokens)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api-tokens")
def clear_api_tokens(db: Session = Depends(get_db)):
    """Clear API tokens from .env file and environment variables."""
    try:
        return _service(db).clear_api_tokens()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Model Configurations
# ---------------------------------------------------------------------------


@router.get("/model-configurations", response_model=list[schemas.ModelConfiguration])
def get_model_configurations(db: Session = Depends(get_db)):
    """Get all model configurations."""
    return _service(db).list_model_configurations()


@router.get("/model-configurations/{config_id}", response_model=schemas.ModelConfiguration)
def get_model_configuration(config_id: int, db: Session = Depends(get_db)):
    """Get a specific model configuration."""
    config = _service(db).get_model_configuration(config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model configuration not found")
    return config


@router.post("/model-configurations", response_model=schemas.ModelConfiguration)
def create_model_configuration(config: schemas.ModelConfigurationCreate, db: Session = Depends(get_db)):
    """Create a new model configuration."""
    try:
        return _service(db).create_model_configuration(config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/model-configurations/{config_id}", response_model=schemas.ModelConfiguration)
def update_model_configuration(
    config_id: int, config_update: schemas.ModelConfigurationUpdate, db: Session = Depends(get_db)
):
    """Update a model configuration."""
    try:
        return _service(db).update_model_configuration(config_id, config_update)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/model-configurations/{config_id}")
def delete_model_configuration(config_id: int, db: Session = Depends(get_db)):
    """Delete a model configuration."""
    try:
        return _service(db).delete_model_configuration(config_id)
    except ValueError as e:
        status = 400 if "default" in str(e) else 404
        raise HTTPException(status_code=status, detail=str(e))


@router.post("/model-configurations/{config_id}/set-default")
def set_default_model_configuration(config_id: int, db: Session = Depends(get_db)):
    """Set a model configuration as default."""
    try:
        return _service(db).set_default_model_configuration(config_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/model-providers")
def get_available_providers():
    """Get list of available model providers and their capabilities."""
    return {
        "whisper_providers": [
            {"id": "faster-whisper", "name": "Faster Whisper", "description": "Local fast Whisper implementation"},
        ],
        "llm_providers": [
            {"id": "openai", "name": "OpenAI", "description": "OpenAI GPT models", "requires_api_key": True},
            {
                "id": "anthropic",
                "name": "Anthropic",
                "description": "Anthropic Claude models",
                "requires_api_key": True,
            },
            {"id": "cohere", "name": "Cohere", "description": "Cohere language models", "requires_api_key": True},
            {"id": "gemini", "name": "Google Gemini", "description": "Google Gemini models", "requires_api_key": True},
            {"id": "grok", "name": "Grok (xAI)", "description": "xAI Grok models", "requires_api_key": True},
            {"id": "groq", "name": "Groq", "description": "Groq language models", "requires_api_key": True},
            {"id": "ollama", "name": "Ollama", "description": "Local Ollama instance", "requires_api_key": False},
            {"id": "other", "name": "Other/Custom", "description": "Custom API endpoint", "requires_api_key": True},
        ],
        "whisper_models": ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
        "openai_models": [],
        "anthropic_models": [],
        "cohere_models": [],
        "gemini_models": [],
        "grok_models": [],
        "groq_models": [],
        "ollama_models": [],
        "other_models": [],
    }


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------


@router.get("/api-keys", response_model=list[schemas.APIKey])
def get_api_keys(db: Session = Depends(get_db)):
    """Get all active API keys (DB + environment variables) with masked values."""
    return _service(db).get_api_keys()


@router.post("/api-keys", response_model=schemas.APIKey)
def create_api_key(api_key: schemas.APIKeyCreate, db: Session = Depends(get_db)):
    """Create a new API key configuration."""
    try:
        return _service(db).create_api_key(api_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api-keys/provider/{provider}", response_model=list[schemas.APIKey])
def get_api_keys_by_provider(provider: str, db: Session = Depends(get_db)):
    """Get all active API keys for a specific provider."""
    return _service(db).get_api_keys_by_provider(provider)


@router.get("/api-keys/{key_id}", response_model=schemas.APIKey)
def get_api_key(key_id: int, db: Session = Depends(get_db)):
    """Get a specific API key by ID with masked value."""
    try:
        return _service(db).get_api_key(key_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/api-keys/{key_id}", response_model=schemas.APIKey)
def update_api_key(key_id: int, api_key_update: schemas.APIKeyUpdate, db: Session = Depends(get_db)):
    """Update an API key configuration."""
    try:
        return _service(db).update_api_key(key_id, api_key_update)
    except ValueError as e:
        status = 400 if "environment-based" in str(e) else 404
        raise HTTPException(status_code=status, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api-keys/{key_id}")
def delete_api_key(key_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) an API key."""
    try:
        return _service(db).deactivate_api_key(key_id)
    except ValueError as e:
        status = 400 if "environment-based" in str(e) else 404
        raise HTTPException(status_code=status, detail=str(e))


# ---------------------------------------------------------------------------
# Embedding Configurations
# ---------------------------------------------------------------------------


@router.get("/embedding-config")
def get_embedding_configuration_settings(db: Session = Depends(get_db)):
    """Return all embedding configurations with the active configuration highlighted."""
    return _service(db).get_embedding_settings()


@router.post("/embedding-config", response_model=schemas.EmbeddingConfiguration)
def create_embedding_configuration(config: schemas.EmbeddingConfigurationCreate, db: Session = Depends(get_db)):
    try:
        return _service(db).create_embedding_configuration(config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/embedding-config/{config_id}", response_model=schemas.EmbeddingConfiguration)
def update_embedding_configuration(
    config_id: int, payload: schemas.EmbeddingConfigurationUpdate, db: Session = Depends(get_db)
):
    try:
        return _service(db).update_embedding_configuration(config_id, payload)
    except ValueError as e:
        status = 400 if "Invalid" in str(e) else 404
        raise HTTPException(status_code=status, detail=str(e))


@router.post("/embedding-config/{config_id}/activate")
def activate_embedding_configuration(config_id: int, db: Session = Depends(get_db)):
    try:
        return _service(db).activate_embedding_configuration(config_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/embedding-config/{config_id}")
def delete_embedding_configuration(config_id: int, db: Session = Depends(get_db)):
    try:
        return _service(db).delete_embedding_configuration(config_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/embedding-config/validate-model")
def validate_embedding_model_endpoint(
    provider: str = Query(..., description="Embedding provider identifier"),
    model_name: str = Query(..., description="Model name or repository to validate"),
):
    valid, message, dimension = validate_embedding_model(provider, model_name)
    response: dict = {"valid": valid, "message": message}
    if dimension is not None:
        response["dimension"] = dimension
    return response


@router.post("/embedding-config/recompute")
def trigger_recompute_embeddings():
    task = recompute_all_embeddings.delay()
    return {"status": "queued", "task_id": task.id}


@router.post("/embedding-config/{meeting_id}/recompute")
def trigger_recompute_for_meeting(meeting_id: int):
    task = compute_embeddings_for_meeting.delay(meeting_id)
    return {"status": "queued", "meeting_id": meeting_id, "task_id": task.id}


# ---------------------------------------------------------------------------
# Worker Scaling
# ---------------------------------------------------------------------------


@router.get("/worker-scaling", response_model=schemas.WorkerConfiguration)
def get_worker_scaling(db: Session = Depends(get_db)):
    return _service(db).get_worker_configuration()


@router.put("/worker-scaling", response_model=schemas.WorkerConfiguration)
def update_worker_scaling(payload: schemas.WorkerConfigurationUpdate, db: Session = Depends(get_db)):
    try:
        return _service(db).update_worker_configuration(payload.max_workers)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
