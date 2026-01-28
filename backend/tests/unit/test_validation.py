"""
Unit tests for the environment validation module.
"""

import pytest

from app.core.validation import ConfigValidationError, EnvironmentValidator, validate_environment


class TestEnvironmentValidator:
    """Test suite for EnvironmentValidator class."""

    def test_validate_required_success(self, monkeypatch):
        """Test validation of required variable that is set."""
        monkeypatch.setenv("TEST_VAR", "test_value")
        validator = EnvironmentValidator()

        result = validator.validate_required("TEST_VAR", "Test variable")

        assert result == "test_value"
        assert len(validator.errors) == 0

    def test_validate_required_missing(self, monkeypatch):
        """Test validation of required variable that is missing."""
        monkeypatch.delenv("TEST_VAR", raising=False)
        validator = EnvironmentValidator()

        result = validator.validate_required("TEST_VAR", "Test variable")

        assert result is None
        assert len(validator.errors) == 1
        assert "TEST_VAR is required" in validator.errors[0]

    def test_validate_optional_with_value(self, monkeypatch):
        """Test validation of optional variable that is set."""
        monkeypatch.setenv("TEST_VAR", "custom_value")
        validator = EnvironmentValidator()

        result = validator.validate_optional("TEST_VAR", "default_value", "Test variable")

        assert result == "custom_value"
        assert len(validator.warnings) == 0

    def test_validate_optional_with_default(self, monkeypatch):
        """Test validation of optional variable that uses default."""
        monkeypatch.delenv("TEST_VAR", raising=False)
        validator = EnvironmentValidator()

        result = validator.validate_optional("TEST_VAR", "default_value", "Test variable")

        assert result == "default_value"

    def test_validate_boolean_true_variations(self, monkeypatch):
        """Test validation of boolean variables with true values."""
        validator = EnvironmentValidator()

        for value in ["true", "TRUE", "1", "yes", "YES"]:
            monkeypatch.setenv("TEST_VAR", value)
            result = validator.validate_boolean("TEST_VAR")
            assert result is True, f"Failed for value: {value}"

    def test_validate_boolean_false_variations(self, monkeypatch):
        """Test validation of boolean variables with false values."""
        validator = EnvironmentValidator()

        for value in ["false", "FALSE", "0", "no", "NO"]:
            monkeypatch.setenv("TEST_VAR", value)
            result = validator.validate_boolean("TEST_VAR")
            assert result is False, f"Failed for value: {value}"

    def test_validate_boolean_invalid(self, monkeypatch):
        """Test validation of boolean variable with invalid value."""
        monkeypatch.setenv("TEST_VAR", "invalid")
        validator = EnvironmentValidator()

        result = validator.validate_boolean("TEST_VAR", "false")

        assert result is False
        assert len(validator.warnings) == 1
        assert "invalid boolean value" in validator.warnings[0].lower()

    def test_validate_integer_valid(self, monkeypatch):
        """Test validation of integer variable with valid value."""
        monkeypatch.setenv("TEST_VAR", "42")
        validator = EnvironmentValidator()

        result = validator.validate_integer("TEST_VAR", 10)

        assert result == 42
        assert len(validator.warnings) == 0

    def test_validate_integer_with_min_max(self, monkeypatch):
        """Test validation of integer variable with bounds."""
        validator = EnvironmentValidator()

        # Test below minimum
        monkeypatch.setenv("TEST_VAR", "5")
        result = validator.validate_integer("TEST_VAR", 10, min_value=10, max_value=100)
        assert result == 10
        assert any("below minimum" in w for w in validator.warnings)

        # Test above maximum
        validator.warnings = []
        monkeypatch.setenv("TEST_VAR", "200")
        result = validator.validate_integer("TEST_VAR", 10, min_value=10, max_value=100)
        assert result == 100
        assert any("exceeds maximum" in w for w in validator.warnings)

    def test_validate_integer_invalid(self, monkeypatch):
        """Test validation of integer variable with non-integer value."""
        monkeypatch.setenv("TEST_VAR", "not_a_number")
        validator = EnvironmentValidator()

        result = validator.validate_integer("TEST_VAR", 10)

        assert result == 10
        assert len(validator.warnings) == 1
        assert "invalid integer value" in validator.warnings[0].lower()

    def test_validate_url_valid(self, monkeypatch):
        """Test validation of URL variable with valid URLs."""
        validator = EnvironmentValidator()

        valid_urls = [
            "http://example.com",
            "https://example.com",
            "postgresql://localhost:5432/db",
            "redis://localhost:6379",
        ]

        for url in valid_urls:
            monkeypatch.setenv("TEST_VAR", url)
            result = validator.validate_url("TEST_VAR")
            assert result == url, f"Failed for URL: {url}"

    def test_validate_url_invalid(self, monkeypatch):
        """Test validation of URL variable with invalid URL."""
        monkeypatch.setenv("TEST_VAR", "not-a-valid-url")
        validator = EnvironmentValidator()

        result = validator.validate_url("TEST_VAR")

        assert result == "not-a-valid-url"
        assert len(validator.warnings) == 1
        assert "doesn't look like a valid URL" in validator.warnings[0]

    def test_validate_provider_choice_valid(self, monkeypatch):
        """Test validation of provider choice with valid value."""
        monkeypatch.setenv("TEST_VAR", "openai")
        validator = EnvironmentValidator()

        result = validator.validate_provider_choice("TEST_VAR", ["openai", "ollama"], "openai")

        assert result == "openai"
        assert len(validator.warnings) == 0

    def test_validate_provider_choice_invalid(self, monkeypatch):
        """Test validation of provider choice with invalid value."""
        monkeypatch.setenv("TEST_VAR", "invalid")
        validator = EnvironmentValidator()

        result = validator.validate_provider_choice("TEST_VAR", ["openai", "ollama"], "openai")

        assert result == "openai"
        assert len(validator.warnings) == 1
        assert "not in allowed choices" in validator.warnings[0]

    def test_check_conditional_requirement_met(self, monkeypatch):
        """Test conditional requirement when condition is met and required var is set."""
        monkeypatch.setenv("CONDITION_VAR", "true")
        monkeypatch.setenv("REQUIRED_VAR", "value")
        validator = EnvironmentValidator()

        validator.check_conditional_requirement("CONDITION_VAR", "true", "REQUIRED_VAR", "Test requirement")

        assert len(validator.errors) == 0

    def test_check_conditional_requirement_not_met(self, monkeypatch):
        """Test conditional requirement when condition is met but required var is missing."""
        monkeypatch.setenv("CONDITION_VAR", "true")
        monkeypatch.delenv("REQUIRED_VAR", raising=False)
        validator = EnvironmentValidator()

        validator.check_conditional_requirement("CONDITION_VAR", "true", "REQUIRED_VAR", "Test requirement")

        assert len(validator.errors) == 1
        assert "REQUIRED_VAR is required" in validator.errors[0]


class TestValidateEnvironmentFunction:
    """Test suite for validate_environment function."""

    def test_validate_environment_success(self, monkeypatch):
        """Test successful environment validation."""
        # Set all required environment variables
        monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost/db")
        monkeypatch.setenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
        monkeypatch.setenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
        monkeypatch.setenv("HUGGINGFACE_TOKEN", "test_token")
        monkeypatch.setenv("OPENAI_API_KEY", "test_key")
        monkeypatch.setenv("PREFERRED_PROVIDER", "openai")

        # Should not raise
        result = validate_environment()

        assert isinstance(result, dict)
        assert "DATABASE_URL" in result
        assert "HUGGINGFACE_TOKEN" in result

    def test_validate_environment_missing_required(self, monkeypatch):
        """Test environment validation with missing required variables."""
        # Clear all environment variables
        for key in ["DATABASE_URL", "CELERY_BROKER_URL", "HUGGINGFACE_TOKEN"]:
            monkeypatch.delenv(key, raising=False)

        # Should raise ConfigValidationError
        with pytest.raises(ConfigValidationError) as exc_info:
            validate_environment()

        error_message = str(exc_info.value)
        assert "Configuration validation failed" in error_message

    def test_validate_environment_ollama_provider(self, monkeypatch):
        """Test environment validation with Ollama provider."""
        monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost/db")
        monkeypatch.setenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
        monkeypatch.setenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
        monkeypatch.setenv("HUGGINGFACE_TOKEN", "test_token")
        monkeypatch.setenv("PREFERRED_PROVIDER", "ollama")
        monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434")
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)

        # Should not raise (OpenAI key not required for Ollama)
        result = validate_environment()

        assert result["PREFERRED_PROVIDER"] == "ollama"
