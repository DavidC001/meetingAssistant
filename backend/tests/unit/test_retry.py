"""Tests for the retry decorators, covering both sync and async targets."""

import pytest

from app.core.base.retry import retry


def test_sync_retries_until_success():
    attempts = []

    @retry(max_retries=3, delay=0)
    def flaky():
        attempts.append(1)
        if len(attempts) < 3:
            raise ConnectionError("boom")
        return "ok"

    assert flaky() == "ok"
    assert len(attempts) == 3


def test_sync_raises_after_exhausting_retries():
    attempts = []

    @retry(max_retries=2, delay=0)
    def always_fails():
        attempts.append(1)
        raise ConnectionError("boom")

    with pytest.raises(ConnectionError):
        always_fails()
    assert len(attempts) == 2


@pytest.mark.asyncio
async def test_async_retries_until_success():
    """A sync wrapper would return an un-awaited coroutine and never retry at all."""
    attempts = []

    @retry(max_retries=3, delay=0)
    async def flaky():
        attempts.append(1)
        if len(attempts) < 3:
            raise ConnectionError("boom")
        return "ok"

    assert await flaky() == "ok"
    assert len(attempts) == 3


@pytest.mark.asyncio
async def test_async_raises_after_exhausting_retries():
    attempts = []

    @retry(max_retries=2, delay=0)
    async def always_fails():
        attempts.append(1)
        raise ConnectionError("boom")

    with pytest.raises(ConnectionError):
        await always_fails()
    assert len(attempts) == 2


@pytest.mark.asyncio
async def test_async_does_not_retry_unlisted_exception():
    attempts = []

    @retry(max_retries=3, delay=0, exceptions=(ConnectionError,))
    async def wrong_error():
        attempts.append(1)
        raise ValueError("not retryable")

    with pytest.raises(ValueError):
        await wrong_error()
    assert len(attempts) == 1
