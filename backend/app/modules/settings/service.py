"""Service layer for settings business logic."""
import os
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from ...core.storage.embeddings import validate_embedding_model
from . import schemas
from .repository import SettingsRepository

ENV_FILE_PATH = Path(__file__).parent.parent.parent.parent / ".env"

# Virtual ID base for environment-only keys
_ENV_KEY_ID_START = -1000

_ENV_KEY_PATTERNS: dict[str, dict[str, str]] = {
    "OPENAI_API_KEY": {"provider": "openai", "name": "OpenAI (Environment)"},
    "HUGGINGFACE_TOKEN": {"provider": "huggingface", "name": "Hugging Face (Environment)"},
    "ANTHROPIC_API_KEY": {"provider": "anthropic", "name": "Anthropic (Environment)"},
    "COHERE_API_KEY": {"provider": "cohere", "name": "Cohere (Environment)"},
    "GEMINI_API_KEY": {"provider": "gemini", "name": "Google Gemini (Environment)"},
    "GROK_API_KEY": {"provider": "grok", "name": "Grok (Environment)"},
    "GROQ_API_KEY": {"provider": "groq", "name": "Groq (Environment)"},
}


# ------------------------------------------------------------------
# .env file helpers (module-level, no DB required)
# ------------------------------------------------------------------


def mask_api_key(key_value: str) -> str:
    """Mask an API key to show only first 3 and last 4 characters."""
    if not key_value or len(key_value) < 8:
        return "****"
    return f"{key_value[:3]}{'*' * (len(key_value) - 7)}{key_value[-4:]}"


def read_env_file() -> dict[str, str]:
    """Read environment variables from the .env file."""
    env_vars: dict[str, str] = {}
    if not ENV_FILE_PATH.exists():
        return env_vars
    try:
        with open(ENV_FILE_PATH, encoding="utf-8") as f:
            content = f.read()
        for line in content.splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip()
    except Exception as e:
        print(f"Error reading .env file: {e}")
    return env_vars


def write_env_file(env_vars: dict[str, str]) -> bool:
    """Write/update environment variables in the .env file."""
    try:
        current_content = ""
        if ENV_FILE_PATH.exists():
            with open(ENV_FILE_PATH, encoding="utf-8") as f:
                current_content = f.read()

        lines = current_content.splitlines() if current_content else []
        updated_lines: list[str] = []
        updated_keys: set[str] = set()

        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                key = stripped.split("=", 1)[0].strip()
                if key in env_vars:
                    updated_lines.append(f"{key}={env_vars[key]}")
                    updated_keys.add(key)
                else:
                    updated_lines.append(line)
            else:
                updated_lines.append(line)

        for key, value in env_vars.items():
            if key not in updated_keys:
                updated_lines.append(f"{key}={value}")

        with open(ENV_FILE_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(updated_lines))

        for key, value in env_vars.items():
            os.environ[key] = value

        return True
    except Exception as e:
        print(f"Error writing .env file: {e}")
        return False


def _build_api_key_response(
    key_id: int,
    name: str,
    provider: str,
    environment_variable: str,
    description: str | None,
    is_active: bool,
    created_at: datetime | None,
    updated_at: datetime | None,
    masked_value: str,
    is_environment_key: bool,
) -> schemas.APIKey:
    return schemas.APIKey(
        id=key_id,
        name=name,
        provider=provider,
        environment_variable=environment_variable,
        description=description,
        is_active=is_active,
        created_at=created_at,
        updated_at=updated_at,
        masked_value=masked_value,
        is_environment_key=is_environment_key,
    )


# ------------------------------------------------------------------
# SettingsService
# ------------------------------------------------------------------


class SettingsService:
    """Orchestrates settings business logic across DB and env file."""

    def __init__(self, db: Session) -> None:
        self.repository = SettingsRepository(db)

    # --- App Settings ---

    def get_app_settings(self) -> dict:
        env_vars = read_env_file()
        default_max = 3000
        max_file_size = int(env_vars.get("MAX_FILE_SIZE_MB", default_max))
        return {"maxFileSize": max_file_size, "defaultMaxFileSize": default_max}

    def update_app_settings(self, settings: dict[str, int]) -> dict:
        env_updates: dict[str, str] = {}
        updated: list[str] = []

        if "maxFileSize" in settings:
            value = settings["maxFileSize"]
            if value < 100 or value > 5000:
                raise ValueError("Max file size must be between 100MB and 5000MB")
            env_updates["MAX_FILE_SIZE_MB"] = str(value)
            updated.append("max file size")

        if not env_updates:
            raise ValueError("No valid settings provided")

        if not write_env_file(env_updates):
            raise RuntimeError("Failed to save settings to .env file")

        return {"message": f"Successfully updated: {', '.join(updated)}", "updated": updated, "saved_to_env": True}

    # --- API Tokens ---

    def get_api_tokens_status(self) -> dict:
        env_vars = read_env_file()
        return {
            "huggingface_configured": bool(env_vars.get("HUGGINGFACE_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")),
            "openai_configured": bool(env_vars.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")),
            "env_file_exists": ENV_FILE_PATH.exists(),
        }

    def update_api_tokens(self, tokens: dict[str, str]) -> dict:
        updates: dict[str, str] = {}
        updated: list[str] = []

        if tokens.get("huggingface_token", "").strip():
            updates["HUGGINGFACE_TOKEN"] = tokens["huggingface_token"].strip()
            updated.append("Hugging Face")
        if tokens.get("openai_api_key", "").strip():
            updates["OPENAI_API_KEY"] = tokens["openai_api_key"].strip()
            updated.append("OpenAI")

        if not updates:
            raise ValueError("No valid tokens provided")
        if not write_env_file(updates):
            raise RuntimeError("Failed to save tokens to .env file")

        return {
            "message": f"Successfully updated and saved tokens for: {', '.join(updated)}",
            "updated": updated,
            "saved_to_env": True,
        }

    def clear_api_tokens(self) -> dict:
        current_env = read_env_file()
        updates: dict[str, str] = {}
        cleared: list[str] = []

        if current_env.get("HUGGINGFACE_TOKEN"):
            updates["HUGGINGFACE_TOKEN"] = ""
            cleared.append("Hugging Face")
            os.environ.pop("HUGGINGFACE_TOKEN", None)
        if current_env.get("OPENAI_API_KEY"):
            updates["OPENAI_API_KEY"] = ""
            cleared.append("OpenAI")
            os.environ.pop("OPENAI_API_KEY", None)

        if updates and not write_env_file(updates):
            raise RuntimeError("Failed to clear tokens from .env file")

        return {
            "message": (
                f"Successfully cleared tokens for: {', '.join(cleared)}" if cleared else "No tokens were configured"
            ),
            "cleared": cleared,
            "updated_env_file": bool(updates),
        }

    # --- API Keys ---

    def get_api_keys(self) -> list[schemas.APIKey]:
        db_keys = self.repository.get_api_keys()
        env_vars = read_env_file()
        result: list[schemas.APIKey] = []

        for key in db_keys:
            env_value = env_vars.get(key.environment_variable, "")
            result.append(
                _build_api_key_response(
                    key.id,
                    key.name,
                    key.provider,
                    key.environment_variable,
                    key.description,
                    key.is_active,
                    key.created_at,
                    key.updated_at,
                    mask_api_key(env_value),
                    False,
                )
            )

        # Append virtual entries for env-only keys
        env_key_counter = _ENV_KEY_ID_START
        for env_var, config in _ENV_KEY_PATTERNS.items():
            if env_vars.get(env_var) and not next((k for k in db_keys if k.environment_variable == env_var), None):
                result.append(
                    _build_api_key_response(
                        env_key_counter,
                        config["name"],
                        config["provider"],
                        env_var,
                        f"API key loaded from environment variable {env_var}",
                        True,
                        None,
                        None,
                        mask_api_key(env_vars[env_var]),
                        True,
                    )
                )
                env_key_counter -= 1

        return result

    def get_api_key(self, key_id: int) -> schemas.APIKey:
        """Raises ValueError if not found."""
        api_key = self.repository.get_api_key_by_id(key_id)
        if not api_key:
            raise ValueError(f"API key {key_id} not found")
        env_value = read_env_file().get(api_key.environment_variable, "")
        return _build_api_key_response(
            api_key.id,
            api_key.name,
            api_key.provider,
            api_key.environment_variable,
            api_key.description,
            api_key.is_active,
            api_key.created_at,
            api_key.updated_at,
            mask_api_key(env_value),
            False,
        )

    def get_api_keys_by_provider(self, provider: str) -> list[schemas.APIKey]:
        db_keys = self.repository.get_api_keys_by_provider(provider)
        env_vars = read_env_file()
        return [
            _build_api_key_response(
                k.id,
                k.name,
                k.provider,
                k.environment_variable,
                k.description,
                k.is_active,
                k.created_at,
                k.updated_at,
                mask_api_key(env_vars.get(k.environment_variable, "")),
                False,
            )
            for k in db_keys
        ]

    def create_api_key(self, api_key: schemas.APIKeyCreate) -> schemas.APIKey:
        existing = self.repository.get_api_key_by_name(api_key.name)
        if existing:
            raise ValueError("API key with this name already exists")

        if api_key.key_value:
            if not write_env_file({api_key.environment_variable: api_key.key_value}):
                raise RuntimeError("Failed to save API key to environment file")

        created = self.repository.create_api_key(api_key)
        env_value = read_env_file().get(created.environment_variable, "")
        return _build_api_key_response(
            created.id,
            created.name,
            created.provider,
            created.environment_variable,
            created.description,
            created.is_active,
            created.created_at,
            created.updated_at,
            mask_api_key(env_value),
            False,
        )

    def update_api_key(self, key_id: int, api_key_update: schemas.APIKeyUpdate) -> schemas.APIKey:
        if key_id < 0:
            raise ValueError("Cannot edit environment-based API keys.")

        current = self.repository.get_api_key_by_id(key_id)
        if not current:
            raise ValueError(f"API key {key_id} not found")

        if api_key_update.key_value:
            env_var = api_key_update.environment_variable or current.environment_variable
            if not write_env_file({env_var: api_key_update.key_value}):
                raise RuntimeError("Failed to update API key in environment file")

        updated = self.repository.update_api_key(key_id, api_key_update)
        if not updated:
            raise ValueError(f"API key {key_id} not found")

        env_value = read_env_file().get(updated.environment_variable, "")
        return _build_api_key_response(
            updated.id,
            updated.name,
            updated.provider,
            updated.environment_variable,
            updated.description,
            updated.is_active,
            updated.created_at,
            updated.updated_at,
            mask_api_key(env_value),
            False,
        )

    def deactivate_api_key(self, key_id: int) -> dict:
        if key_id < 0:
            raise ValueError("Cannot delete environment-based API keys.")
        api_key = self.repository.deactivate_api_key(key_id)
        if not api_key:
            raise ValueError(f"API key {key_id} not found")
        return {"message": "API key deactivated successfully"}

    # --- Model Configurations ---

    def get_default_model_configuration(self):
        """Exposed for cross-module consumption (e.g. projects/service.py)."""
        return self.repository.get_default_model_configuration()

    def get_model_configuration(self, config_id: int):
        return self.repository.get_model_configuration_by_id(config_id)

    def list_model_configurations(self):
        return self.repository.get_model_configurations()

    def create_model_configuration(self, config: schemas.ModelConfigurationCreate):
        existing = self.repository.get_model_configuration_by_name(config.name)
        if existing:
            raise ValueError("Configuration name already exists")
        return self.repository.create_model_configuration(config)

    def update_model_configuration(self, config_id: int, config_update: schemas.ModelConfigurationUpdate):
        config = self.repository.get_model_configuration_by_id(config_id)
        if not config:
            raise ValueError(f"Model configuration {config_id} not found")
        return self.repository.update_model_configuration(config_id, config_update)

    def delete_model_configuration(self, config_id: int) -> dict:
        config = self.repository.get_model_configuration_by_id(config_id)
        if not config:
            raise ValueError(f"Model configuration {config_id} not found")
        if config.is_default:
            raise ValueError("Cannot delete the default configuration")
        self.repository.delete_model_configuration(config_id)
        return {"message": "Model configuration deleted successfully"}

    def set_default_model_configuration(self, config_id: int) -> dict:
        config = self.repository.get_model_configuration_by_id(config_id)
        if not config:
            raise ValueError(f"Model configuration {config_id} not found")
        self.repository.set_default_model_configuration(config_id)
        return {"message": "Default model configuration updated successfully"}

    # --- Embedding Configurations ---

    def get_embedding_settings(self) -> dict:
        configs = self.repository.list_embedding_configurations()
        active = self.repository.get_active_embedding_configuration()
        return {
            "configurations": [schemas.EmbeddingConfiguration.from_orm(c) for c in configs],
            "activeConfigurationId": active.id if active else None,
        }

    def create_embedding_configuration(self, config: schemas.EmbeddingConfigurationCreate):
        valid, message, dimension = validate_embedding_model(config.provider, config.model_name)
        if not valid:
            raise ValueError(message or "Invalid embedding model")
        if dimension is not None and (not getattr(config, "dimension", None)):
            config.dimension = dimension
        return self.repository.create_embedding_configuration(config)

    def update_embedding_configuration(self, config_id: int, payload: schemas.EmbeddingConfigurationUpdate):
        existing = self.repository.get_embedding_configuration(config_id)
        if not existing:
            raise ValueError(f"Embedding configuration {config_id} not found")

        provider = payload.provider or existing.provider
        model_name = payload.model_name or existing.model_name
        valid, message, dimension = validate_embedding_model(provider, model_name)
        if not valid:
            raise ValueError(message or "Invalid embedding model")
        if dimension is not None and not getattr(payload, "dimension", None):
            payload.dimension = dimension

        result = self.repository.update_embedding_configuration(config_id, payload)
        if not result:
            raise ValueError(f"Embedding configuration {config_id} not found")
        return result

    def activate_embedding_configuration(self, config_id: int):
        result = self.repository.update_embedding_configuration(
            config_id, schemas.EmbeddingConfigurationUpdate(is_active=True)
        )
        if not result:
            raise ValueError(f"Embedding configuration {config_id} not found")
        return schemas.EmbeddingConfiguration.from_orm(result)

    def delete_embedding_configuration(self, config_id: int) -> dict:
        config = self.repository.delete_embedding_configuration(config_id)
        if not config:
            raise ValueError(f"Embedding configuration {config_id} not found")
        return {"status": "deleted", "config_id": config_id}

    # --- Worker Configuration ---

    def get_worker_configuration(self):
        return self.repository.get_worker_configuration()

    def update_worker_configuration(self, max_workers: int):
        if max_workers < 1 or max_workers > 10:
            raise ValueError("Worker count must be between 1 and 10")
        return self.repository.set_worker_configuration(max_workers)
