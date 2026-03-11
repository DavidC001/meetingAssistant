"""
Unit tests for the Search service and helper functions.
"""

import pytest

from app.modules.search.service import calculate_score, highlight_text


@pytest.mark.unit
class TestHighlightText:
    """Tests for highlight_text helper function."""

    def test_highlight_text_with_match(self):
        text = "This is a meeting about quarterly reports and budgets."
        result = highlight_text(text, "quarterly")
        assert "quarterly" in result.lower()

    def test_highlight_text_no_match(self):
        text = "Short text"
        result = highlight_text(text, "nonexistent")
        assert result == "Short text"

    def test_highlight_text_empty_text(self):
        result = highlight_text("", "query")
        assert result == ""

    def test_highlight_text_empty_query(self):
        text = "Some text content"
        result = highlight_text(text, "")
        assert result == text

    def test_highlight_text_none_text(self):
        result = highlight_text(None, "query")
        assert result == ""

    def test_highlight_text_long_text_truncation(self):
        text = "A" * 500
        result = highlight_text(text, "nonexistent")
        assert len(result) <= 210  # 200 + "..."

    def test_highlight_text_word_match_fallback(self):
        text = "The meeting discussed project deadlines and team allocation."
        result = highlight_text(text, "project deadlines")
        assert len(result) > 0

    def test_highlight_text_context_chars(self):
        text = "A" * 50 + "KEYWORD" + "B" * 50
        result = highlight_text(text, "KEYWORD", context_chars=20)
        assert "KEYWORD" in result


@pytest.mark.unit
class TestCalculateScore:
    """Tests for calculate_score helper function."""

    def test_exact_match_returns_1(self):
        assert calculate_score("find this query here", "this query") == 1.0

    def test_partial_word_match(self):
        score = calculate_score("project deadline review", "project review")
        assert 0.0 < score <= 1.0

    def test_no_match_returns_0(self):
        assert calculate_score("hello world", "xyz") == 0.0

    def test_empty_text(self):
        assert calculate_score("", "query") == 0.0

    def test_empty_query(self):
        assert calculate_score("some text", "") == 0.0

    def test_none_text(self):
        assert calculate_score(None, "query") == 0.0

    def test_case_insensitive(self):
        assert calculate_score("Project Review", "project review") == 1.0

    def test_all_words_match(self):
        score = calculate_score("alpha beta gamma", "alpha beta gamma")
        assert score == 1.0

    def test_some_words_match(self):
        score = calculate_score("alpha beta gamma", "alpha delta gamma")
        assert 0.5 < score < 1.0
