"""Environment configuration validation module.

This module provides utilities to validate environment variables at startup,
ensuring all required configurations are present and valid.
"""

import logging
import os

logger = logging.getLogger(__name__)


class ConfigValidationError(Exception):
    """Raised when configuration validation fails."""

    pass


class EnvironmentValidator:
    """Validates environment configuration at startup."""

    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def validate_required(self, var_name: str, description: str) -> str | None:
        """Validate that a required environment variable is set."""
        value = os.getenv(var_name)
        if not value:
            self.errors.append(f"{var_name} is required: {description}")
            return None
        return value

    def validate_optional(self, var_name: str, default: str, description: str) -> str:
        """Validate an optional environment variable with a default."""
        value = os.getenv(var_name, default)
        if value == default:
            logger.info(f"{var_name} not set, using default: {default}")
        return value

    def validate_boolean(self, var_name: str, default: str = "false") -> bool:
        """Validate a boolean environment variable."""
        value = os.getenv(var_name, default).lower()
        if value not in ("true", "false", "1", "0", "yes", "no"):
            self.warnings.append(f"{var_name} has invalid boolean value '{value}', using default: {default}")
            return default.lower() in ("true", "1", "yes")
        return value in ("true", "1", "yes")

    def validate_integer(
        self, var_name: str, default: int, min_value: int | None = None, max_value: int | None = None
    ) -> int:
        """Validate an integer environment variable with optional bounds."""
        value_str = os.getenv(var_name, str(default))
        try:
            value = int(value_str)
            if min_value is not None and value < min_value:
                self.warnings.append(f"{var_name} value {value} is below minimum {min_value}, using minimum")
                return min_value
            if max_value is not None and value > max_value:
                self.warnings.append(f"{var_name} value {value} exceeds maximum {max_value}, using maximum")
                return max_value
            return value
        except ValueError:
            self.warnings.append(f"{var_name} has invalid integer value '{value_str}', using default: {default}")
            return default

    def validate_url(self, var_name: str, default: str | None = None) -> str | None:
        """Validate a URL environment variable."""
        value = os.getenv(var_name, default)
        if value and not (
            value.startswith("http://")
            or value.startswith("https://")
            or value.startswith("postgresql://")
            or value.startswith("redis://")
        ):
            self.warnings.append(f"{var_name} value '{value}' doesn't look like a valid URL")
        return value

    def validate_provider_choice(self, var_name: str, choices: list[str], default: str) -> str:
        """Validate that a variable is one of the allowed choices."""
        value = os.getenv(var_name, default).lower()
        if value not in choices:
            self.warnings.append(
                f"{var_name} value '{value}' not in allowed choices {choices}, using default: {default}"
            )
            return default
        return value

    def check_conditional_requirement(
        self, condition_var: str, condition_value: str, required_var: str, description: str
    ) -> None:
        """Check if a variable is required based on another variable's value."""
        if os.getenv(condition_var, "").lower() == condition_value.lower():
            if not os.getenv(required_var):
                self.errors.append(f"{required_var} is required when {condition_var}={condition_value}: {description}")

    def validate_all(self) -> tuple[dict[str, str], list[str], list[str]]:
        """Run all validation checks and return results."""
        validated_config = {}

        # Database (required)
        db_url = self.validate_required("DATABASE_URL", "PostgreSQL database connection string")
        if db_url:
            validated_config["DATABASE_URL"] = db_url

        # Celery (required for async processing)
        broker_url = self.validate_required("CELERY_BROKER_URL", "Redis URL for Celery message broker")
        result_backend = self.validate_required("CELERY_RESULT_BACKEND", "Redis URL for Celery result backend")
        if broker_url:
            validated_config["CELERY_BROKER_URL"] = broker_url
        if result_backend:
            validated_config["CELERY_RESULT_BACKEND"] = result_backend

        # Upload configuration
        validated_config["MAX_FILE_SIZE_MB"] = str(
            self.validate_integer("MAX_FILE_SIZE_MB", 3000, min_value=1, max_value=10000)
        )
        validated_config["UPLOAD_DIR"] = self.validate_optional("UPLOAD_DIR", "uploads", "Directory for uploaded files")

        # Model provider configuration
        validated_config["PREFERRED_PROVIDER"] = self.validate_provider_choice(
            "PREFERRED_PROVIDER", ["openai", "ollama"], "openai"
        )

        # Check API keys based on provider
        if validated_config["PREFERRED_PROVIDER"] == "openai":
            openai_key = self.validate_required(
                "OPENAI_API_KEY", "OpenAI API key (required when PREFERRED_PROVIDER=openai)"
            )
            if openai_key:
                validated_config["OPENAI_API_KEY"] = openai_key
        else:
            if not os.getenv("OPENAI_API_KEY"):
                self.warnings.append(
                    "OPENAI_API_KEY not set. You can still use Ollama, but some features may be limited."
                )

        # Ollama configuration (required if using ollama provider)
        ollama_url = self.validate_url("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
        if ollama_url:
            validated_config["OLLAMA_BASE_URL"] = ollama_url

        if validated_config["PREFERRED_PROVIDER"] == "ollama":
            if not ollama_url or ollama_url == "http://host.docker.internal:11434":
                self.warnings.append("Using default Ollama URL. Make sure Ollama is running on your host machine.")

        # Hugging Face token (required for speaker diarization)
        hf_token = self.validate_required(
            "HUGGINGFACE_TOKEN", "Hugging Face token (required for speaker diarization with Pyannote)"
        )
        if hf_token:
            validated_config["HUGGINGFACE_TOKEN"] = hf_token

        # Google Calendar/Drive configuration (optional)
        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

        if google_client_id or google_client_secret:
            if not google_client_id:
                self.errors.append("GOOGLE_CLIENT_SECRET is set but GOOGLE_CLIENT_ID is missing")
            if not google_client_secret:
                self.errors.append("GOOGLE_CLIENT_ID is set but GOOGLE_CLIENT_SECRET is missing")

        # Google Drive specific checks
        drive_enabled = self.validate_boolean("GOOGLE_DRIVE_SYNC_ENABLED", "false")
        if drive_enabled:
            if not google_client_id or not google_client_secret:
                self.errors.append("Google Drive sync is enabled but Google OAuth credentials are not configured")
            if not os.getenv("GOOGLE_DRIVE_SYNC_FOLDER_ID"):
                self.errors.append("GOOGLE_DRIVE_SYNC_FOLDER_ID is required when Google Drive sync is enabled")

        return validated_config, self.errors, self.warnings

    def validate_and_raise(self) -> dict[str, str]:
        """Validate configuration and raise exception if there are errors."""
        validated_config, errors, warnings = self.validate_all()

        # Log warnings
        for warning in warnings:
            logger.warning(f"Configuration warning: {warning}")

        # Raise error if there are any validation errors
        if errors:
            error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
            logger.error(error_msg)
            raise ConfigValidationError(error_msg)

        logger.info("✓ Configuration validation passed")
        return validated_config


def validate_environment() -> dict[str, str]:
    """Convenience function to validate environment configuration."""
    validator = EnvironmentValidator()
    return validator.validate_and_raise()
