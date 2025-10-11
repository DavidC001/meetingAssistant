from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Any, Dict, List
import os
from pathlib import Path
import re

from ..database import get_db
from .. import crud, schemas
from ..core.embeddings import validate_embedding_model
from ..models import ModelConfiguration
from ..tasks import compute_embeddings_for_meeting, recompute_all_embeddings

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)

# Path to the .env file
ENV_FILE_PATH = Path(__file__).parent.parent.parent / ".env"

def mask_api_key(key_value: str) -> str:
    """Mask an API key to show only first 3 and last 4 characters"""
    if not key_value or len(key_value) < 8:
        return "****"
    return f"{key_value[:3]}{'*' * (len(key_value) - 7)}{key_value[-4:]}"

def read_env_file() -> Dict[str, str]:
    """Read environment variables from .env file"""
    env_vars = {}
    
    if not ENV_FILE_PATH.exists():
        return env_vars
    
    try:
        with open(ENV_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
            
        for line in content.splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key.strip()] = value.strip()
                
    except Exception as e:
        print(f"Error reading .env file: {e}")
        
    return env_vars

def write_env_file(env_vars: Dict[str, str]) -> bool:
    """Write environment variables to .env file"""
    try:
        # Read current content to preserve comments and structure
        current_content = ""
        if ENV_FILE_PATH.exists():
            with open(ENV_FILE_PATH, 'r', encoding='utf-8') as f:
                current_content = f.read()
        
        # Update or add the new values
        lines = current_content.splitlines() if current_content else []
        updated_lines = []
        updated_keys = set()
        
        for line in lines:
            line_stripped = line.strip()
            if line_stripped and not line_stripped.startswith('#') and '=' in line_stripped:
                key = line_stripped.split('=', 1)[0].strip()
                if key in env_vars:
                    # Update existing key
                    updated_lines.append(f"{key}={env_vars[key]}")
                    updated_keys.add(key)
                else:
                    # Keep existing key as is
                    updated_lines.append(line)
            else:
                # Keep comments and empty lines
                updated_lines.append(line)
        
        # Add new keys that weren't in the file
        for key, value in env_vars.items():
            if key not in updated_keys:
                updated_lines.append(f"{key}={value}")
        
        # Write back to file
        with open(ENV_FILE_PATH, 'w', encoding='utf-8') as f:
            f.write('\n'.join(updated_lines))
            
        # Also update current process environment variables
        for key, value in env_vars.items():
            os.environ[key] = value
            
        return True
        
    except Exception as e:
        print(f"Error writing .env file: {e}")
        return False

@router.get("/app-settings")
def get_app_settings():
    """
    Get application settings like max file size.
    """
    env_vars = read_env_file()
    
    # Default values
    default_max_file_size = 3000  # 3GB in MB
    
    max_file_size = int(env_vars.get("MAX_FILE_SIZE_MB", default_max_file_size))
    
    return {
        "maxFileSize": max_file_size,
        "defaultMaxFileSize": default_max_file_size
    }

@router.post("/app-settings")
def update_app_settings(settings: Dict[str, int]):
    """
    Update application settings.
    """
    env_updates = {}
    updated_settings = []
    
    if "maxFileSize" in settings:
        max_file_size = settings["maxFileSize"]
        # Validate range (100MB to 5GB)
        if max_file_size < 100 or max_file_size > 5000:
            raise HTTPException(status_code=400, detail="Max file size must be between 100MB and 5000MB")
        
        env_updates["MAX_FILE_SIZE_MB"] = str(max_file_size)
        updated_settings.append("max file size")
    
    if not env_updates:
        raise HTTPException(status_code=400, detail="No valid settings provided")
    
    success = write_env_file(env_updates)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save settings to .env file")
    
    return {
        "message": f"Successfully updated: {', '.join(updated_settings)}",
        "updated": updated_settings,
        "saved_to_env": True
    }

@router.get("/api-tokens")
def get_api_tokens_status():
    """
    Get the status of API tokens (whether they are configured or not).
    Does not return the actual token values for security.
    """
    # Read from .env file first, then fall back to environment variables
    env_vars = read_env_file()
    
    huggingface_configured = bool(
        env_vars.get("HUGGINGFACE_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
    )
    openai_configured = bool(
        env_vars.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    )
    
    return {
        "huggingface_configured": huggingface_configured,
        "openai_configured": openai_configured,
        "env_file_exists": ENV_FILE_PATH.exists()
    }

@router.post("/api-tokens")
def update_api_tokens(tokens: Dict[str, str]):
    """
    Update API tokens. This writes to the .env file for persistence.
    """
    updated = []
    env_updates = {}
    
    if "huggingface_token" in tokens and tokens["huggingface_token"].strip():
        env_updates["HUGGINGFACE_TOKEN"] = tokens["huggingface_token"].strip()
        updated.append("Hugging Face")
    
    if "openai_api_key" in tokens and tokens["openai_api_key"].strip():
        env_updates["OPENAI_API_KEY"] = tokens["openai_api_key"].strip()
        updated.append("OpenAI")
    
    if not env_updates:
        raise HTTPException(status_code=400, detail="No valid tokens provided")
    
    success = write_env_file(env_updates)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save tokens to .env file")
    
    return {
        "message": f"Successfully updated and saved tokens for: {', '.join(updated)}",
        "updated": updated,
        "saved_to_env": True
    }

@router.delete("/api-tokens")
def clear_api_tokens():
    """
    Clear API tokens from .env file and environment variables.
    """
    cleared = []
    env_updates = {}
    
    # Read current env file to see what tokens exist
    current_env = read_env_file()
    
    if current_env.get("HUGGINGFACE_TOKEN"):
        env_updates["HUGGINGFACE_TOKEN"] = ""
        cleared.append("Hugging Face")
        os.environ.pop("HUGGINGFACE_TOKEN", None)
    
    if current_env.get("OPENAI_API_KEY"):
        env_updates["OPENAI_API_KEY"] = ""
        cleared.append("OpenAI")
        os.environ.pop("OPENAI_API_KEY", None)
    
    if env_updates:
        success = write_env_file(env_updates)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to clear tokens from .env file")
    
    return {
        "message": f"Successfully cleared tokens for: {', '.join(cleared)}" if cleared else "No tokens were configured",
        "cleared": cleared,
        "updated_env_file": bool(env_updates)
    }

# Model Configuration Endpoints
@router.get("/model-configurations", response_model=List[schemas.ModelConfiguration])
def get_model_configurations(db: Session = Depends(get_db)):
    """Get all model configurations"""
    return crud.get_model_configurations(db)

@router.get("/model-configurations/{config_id}", response_model=schemas.ModelConfiguration)
def get_model_configuration(config_id: int, db: Session = Depends(get_db)):
    """Get a specific model configuration"""
    config = crud.get_model_configuration(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model configuration not found")
    return config

@router.post("/model-configurations", response_model=schemas.ModelConfiguration)
def create_model_configuration(
    config: schemas.ModelConfigurationCreate,
    db: Session = Depends(get_db)
):
    """Create a new model configuration"""
    # Check if name already exists
    existing = crud.get_model_configuration_by_name(db, config.name)
    if existing:
        raise HTTPException(status_code=400, detail="Configuration name already exists")
    
    return crud.create_model_configuration(db, config)

@router.put("/model-configurations/{config_id}", response_model=schemas.ModelConfiguration)
def update_model_configuration(
    config_id: int,
    config_update: schemas.ModelConfigurationUpdate,
    db: Session = Depends(get_db)
):
    """Update a model configuration"""
    config = crud.get_model_configuration(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model configuration not found")
    
    return crud.update_model_configuration(db, config_id, config_update)

@router.delete("/model-configurations/{config_id}")
def delete_model_configuration(config_id: int, db: Session = Depends(get_db)):
    """Delete a model configuration"""
    config = crud.get_model_configuration(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model configuration not found")
    
    if config.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default configuration")
    
    crud.delete_model_configuration(db, config_id)
    return {"message": "Model configuration deleted successfully"}

@router.post("/model-configurations/{config_id}/set-default")
def set_default_model_configuration(config_id: int, db: Session = Depends(get_db)):
    """Set a model configuration as default"""
    config = crud.get_model_configuration(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Model configuration not found")
    
    crud.set_default_model_configuration(db, config_id)
    return {"message": "Default model configuration updated successfully"}

@router.get("/model-providers")
def get_available_providers():
    """Get list of available model providers and their capabilities"""
    return {
        "whisper_providers": [
            {"id": "faster-whisper", "name": "Faster Whisper", "description": "Local fast Whisper implementation"},
        ],
        "llm_providers": [
            {"id": "openai", "name": "OpenAI", "description": "OpenAI GPT models", "requires_api_key": True},
            {"id": "anthropic", "name": "Anthropic", "description": "Anthropic Claude models", "requires_api_key": True},
            {"id": "cohere", "name": "Cohere", "description": "Cohere language models", "requires_api_key": True},
            {"id": "gemini", "name": "Google Gemini", "description": "Google Gemini models", "requires_api_key": True},
            {"id": "grok", "name": "Grok (xAI)", "description": "xAI Grok models", "requires_api_key": True},
            {"id": "groq", "name": "Groq", "description": "Groq language models", "requires_api_key": True},
            {"id": "ollama", "name": "Ollama", "description": "Local Ollama instance", "requires_api_key": False},
            {"id": "other", "name": "Other/Custom", "description": "Custom API endpoint", "requires_api_key": True}
        ],
        "whisper_models": ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
        "openai_models": [],
        "anthropic_models": [],
        "cohere_models": [],
        "gemini_models": [],
        "grok_models": [],
        "groq_models": [],
        "ollama_models": [],
        "other_models": []
    }

# API Key Management Endpoints
@router.get("/api-keys", response_model=List[schemas.APIKey])
def get_api_keys(db: Session = Depends(get_db)):
    """Get all active API keys (both from database and environment variables) with masked values"""
    # Get database-stored API keys
    db_api_keys = crud.get_api_keys(db)
    
    # Convert database keys to response format with masked values
    result_keys = []
    for key in db_api_keys:
        env_value = ""
        env_vars = read_env_file()
        if key.environment_variable in env_vars:
            env_value = env_vars[key.environment_variable]
        
        result_keys.append(schemas.APIKey(
            id=key.id,
            name=key.name,
            provider=key.provider,
            environment_variable=key.environment_variable,
            description=key.description,
            is_active=key.is_active,
            created_at=key.created_at,
            updated_at=key.updated_at,
            masked_value=mask_api_key(env_value),
            is_environment_key=False
        ))
    
    # Get environment-based API keys not in database
    env_vars = read_env_file()
    env_key_patterns = {
        'OPENAI_API_KEY': {'provider': 'openai', 'name': 'OpenAI (Environment)'},
        'HUGGINGFACE_TOKEN': {'provider': 'huggingface', 'name': 'Hugging Face (Environment)'},
        'ANTHROPIC_API_KEY': {'provider': 'anthropic', 'name': 'Anthropic (Environment)'},
        'COHERE_API_KEY': {'provider': 'cohere', 'name': 'Cohere (Environment)'},
        'GEMINI_API_KEY': {'provider': 'gemini', 'name': 'Google Gemini (Environment)'},
        'GROK_API_KEY': {'provider': 'grok', 'name': 'Grok (Environment)'},
        'GROQ_API_KEY': {'provider': 'groq', 'name': 'Groq (Environment)'},
    }
    
    # Check environment variables and create virtual API key entries
    env_key_counter = -1000  # Start with a clearly negative number
    for env_var, config in env_key_patterns.items():
        if env_var in env_vars and env_vars[env_var]:
            # Check if this environment variable is already referenced by a database entry
            existing_db_key = next((key for key in db_api_keys if key.environment_variable == env_var), None)
            
            if not existing_db_key:
                # Create a virtual API key entry for environment-based keys
                result_keys.append(schemas.APIKey(
                    id=env_key_counter,  # Use clearly negative ID to indicate it's environment-based
                    name=config['name'],
                    provider=config['provider'],
                    environment_variable=env_var,
                    description=f"API key loaded from environment variable {env_var}",
                    is_active=True,
                    created_at=None,
                    updated_at=None,
                    masked_value=mask_api_key(env_vars[env_var]),
                    is_environment_key=True
                ))
                env_key_counter -= 1
    
    return result_keys

@router.post("/api-keys", response_model=schemas.APIKey)
def create_api_key(api_key: schemas.APIKeyCreate, db: Session = Depends(get_db)):
    """Create a new API key configuration"""
    # Check if name already exists
    existing = crud.get_api_key_by_name(db, api_key.name)
    if existing:
        raise HTTPException(status_code=400, detail="API key with this name already exists")
    
    created_key = crud.create_api_key(db, api_key)
    env_vars = read_env_file()
    env_value = env_vars.get(created_key.environment_variable, "")
    
    return schemas.APIKey(
        id=created_key.id,
        name=created_key.name,
        provider=created_key.provider,
        environment_variable=created_key.environment_variable,
        description=created_key.description,
        is_active=created_key.is_active,
        created_at=created_key.created_at,
        updated_at=created_key.updated_at,
        masked_value=mask_api_key(env_value),
        is_environment_key=False
    )

@router.get("/api-keys/{key_id}", response_model=schemas.APIKey)
def get_api_key(key_id: int, db: Session = Depends(get_db)):
    """Get a specific API key by ID with masked value"""
    api_key = crud.get_api_key(db, key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    env_vars = read_env_file()
    env_value = env_vars.get(api_key.environment_variable, "")
    
    return schemas.APIKey(
        id=api_key.id,
        name=api_key.name,
        provider=api_key.provider,
        environment_variable=api_key.environment_variable,
        description=api_key.description,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        updated_at=api_key.updated_at,
        masked_value=mask_api_key(env_value),
        is_environment_key=False
    )

@router.put("/api-keys/{key_id}", response_model=schemas.APIKey)
def update_api_key(key_id: int, api_key_update: schemas.APIKeyUpdate, db: Session = Depends(get_db)):
    """Update an API key configuration"""
    # Prevent editing of environment-based keys (they have negative IDs)
    if key_id < 0:
        raise HTTPException(
            status_code=400, 
            detail="Cannot edit environment-based API keys. These are loaded from environment variables."
        )
        
    api_key = crud.update_api_key(db, key_id, api_key_update)
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    env_vars = read_env_file()
    env_value = env_vars.get(api_key.environment_variable, "")
    
    return schemas.APIKey(
        id=api_key.id,
        name=api_key.name,
        provider=api_key.provider,
        environment_variable=api_key.environment_variable,
        description=api_key.description,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        updated_at=api_key.updated_at,
        masked_value=mask_api_key(env_value),
        is_environment_key=False
    )

@router.delete("/api-keys/{key_id}")
def delete_api_key(key_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) an API key"""
    # Prevent deletion of environment-based keys (they have negative IDs)
    if key_id < 0:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete environment-based API keys. These are loaded from environment variables."
        )
        
    api_key = crud.delete_api_key(db, key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deactivated successfully"}

@router.get("/api-keys/provider/{provider}", response_model=List[schemas.APIKey])
def get_api_keys_by_provider(provider: str, db: Session = Depends(get_db)):
    """Get all active API keys for a specific provider with masked values"""
    db_keys = crud.get_api_keys_by_provider(db, provider)
    env_vars = read_env_file()
    
    # Convert to response format with masked values
    result_keys = []
    for key in db_keys:
        env_value = ""
        if key.environment_variable in env_vars:
            env_value = env_vars[key.environment_variable]
        
        result_keys.append(schemas.APIKey(
            id=key.id,
            name=key.name,
            provider=key.provider,
            environment_variable=key.environment_variable,
            description=key.description,
            is_active=key.is_active,
            created_at=key.created_at,
            updated_at=key.updated_at,
            masked_value=mask_api_key(env_value),
            is_environment_key=False
        ))
    
    return result_keys


@router.get("/embedding-config")
def get_embedding_configuration_settings(db: Session = Depends(get_db)):
    """Return all embedding configurations with the active configuration highlighted."""
    configs = crud.list_embedding_configurations(db)
    active = crud.get_active_embedding_configuration(db)
    return {
        "configurations": [schemas.EmbeddingConfiguration.from_orm(cfg) for cfg in configs],
        "activeConfigurationId": active.id if active else None,
    }


@router.post("/embedding-config", response_model=schemas.EmbeddingConfiguration)
def create_embedding_configuration(config: schemas.EmbeddingConfigurationCreate, db: Session = Depends(get_db)):
    valid, message = validate_embedding_model(config.provider, config.model_name)
    if not valid:
        raise HTTPException(status_code=400, detail=message or "Invalid embedding model")
    return crud.create_embedding_configuration(db, config)


@router.put("/embedding-config/{config_id}", response_model=schemas.EmbeddingConfiguration)
def update_embedding_configuration(config_id: int, payload: schemas.EmbeddingConfigurationUpdate, db: Session = Depends(get_db)):
    existing = crud.get_embedding_configuration(db, config_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Embedding configuration not found")

    provider = payload.provider or existing.provider
    model_name = payload.model_name or existing.model_name
    valid, message = validate_embedding_model(provider, model_name)
    if not valid:
        raise HTTPException(status_code=400, detail=message or "Invalid embedding model")

    config = crud.update_embedding_configuration(db, config_id, payload)
    if not config:
        raise HTTPException(status_code=404, detail="Embedding configuration not found")
    return config


@router.post("/embedding-config/{config_id}/activate")
def activate_embedding_configuration(config_id: int, db: Session = Depends(get_db)):
    config = crud.update_embedding_configuration(db, config_id, schemas.EmbeddingConfigurationUpdate(is_active=True))
    if not config:
        raise HTTPException(status_code=404, detail="Embedding configuration not found")
    return schemas.EmbeddingConfiguration.from_orm(config)


@router.delete("/embedding-config/{config_id}")
def delete_embedding_configuration(config_id: int, db: Session = Depends(get_db)):
    config = crud.delete_embedding_configuration(db, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Embedding configuration not found")
    return {"status": "deleted", "config_id": config_id}


@router.get("/embedding-config/validate-model")
def validate_embedding_model_endpoint(
    provider: str = Query(..., description="Embedding provider identifier"),
    model_name: str = Query(..., description="Model name or repository to validate"),
):
    valid, message = validate_embedding_model(provider, model_name)
    return {"valid": valid, "message": message}


@router.post("/embedding-config/recompute")
def trigger_recompute_embeddings():
    task = recompute_all_embeddings.delay()
    return {"status": "queued", "task_id": task.id}


@router.post("/embedding-config/{meeting_id}/recompute")
def trigger_recompute_for_meeting(meeting_id: int):
    task = compute_embeddings_for_meeting.delay(meeting_id)
    return {"status": "queued", "meeting_id": meeting_id, "task_id": task.id}


@router.get("/worker-scaling", response_model=schemas.WorkerConfiguration)
def get_worker_scaling(db: Session = Depends(get_db)):
    return crud.get_worker_configuration(db)


@router.put("/worker-scaling", response_model=schemas.WorkerConfiguration)
def update_worker_scaling(payload: schemas.WorkerConfigurationUpdate, db: Session = Depends(get_db)):
    if payload.max_workers < 1 or payload.max_workers > 10:
        raise HTTPException(status_code=400, detail="Worker count must be between 1 and 10")
    return crud.set_worker_configuration(db, payload.max_workers)
