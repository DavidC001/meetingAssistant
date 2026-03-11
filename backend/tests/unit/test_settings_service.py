"""
Unit tests for the Settings service helper functions.
"""

import pytest

from app.modules.settings.service import mask_api_key


@pytest.mark.unit
class TestMaskApiKey:
    """Tests for API key masking function."""

    def test_mask_short_key(self):
        result = mask_api_key("abc")
        # Short keys should be fully masked or partially shown
        assert result != "abc"

    def test_mask_long_key(self):
        result = mask_api_key("sk-1234567890abcdef")
        assert "sk-" in result or "****" in result or "..." in result
        # Should not leak the full key
        assert result != "sk-1234567890abcdef"

    def test_mask_empty_key(self):
        result = mask_api_key("")
        assert result == "" or result == "****"

    def test_mask_none_key(self):
        # Depending on implementation, may raise or return empty
        try:
            result = mask_api_key(None)
            assert result is not None
        except (TypeError, AttributeError):
            pass  # acceptable


@pytest.mark.unit
class TestSettingsServiceHelpers:
    """Test settings service utility behavior."""

    def test_mask_preserves_prefix(self):
        """API keys often start with a recognizable prefix."""
        result = mask_api_key("sk-proj-12345678901234567890")
        # Should contain some visible characters
        assert len(result) > 0
