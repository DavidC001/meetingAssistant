import os
import json
import requests
import logging
from typing import Dict, Any

# Optional import for OpenAI
try:
    import openai
except ImportError:
    openai = None

# Setup logging
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a senior executive assistant. Given a verbatim, speaker-labelled transcript of a meeting, "
    "respond in valid JSON with keys: summary (a list of 3-5 bullet points as strings), "
    "decisions (a list of key decisions as strings), and action_items (a list of objects, "
    "each with 'task', 'owner', and 'due_date' keys). "
    "Return ONLY the JSON object, with no additional text or explanations."
)

def _call_openai(transcript: str, model: str) -> Dict[str, Any]:
    """Calls the OpenAI API for analysis."""
    if openai is None:
        raise RuntimeError("OpenAI package not installed. Please run 'pip install openai'.")
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY environment variable not set.")

    logger.info(f"Sending transcript to OpenAI model: {model}")
    resp = openai.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript},
        ],
    )
    return json.loads(resp.choices[0].message.content)

def _call_ollama(transcript: str, model: str, url: str) -> Dict[str, Any]:
    """Calls a local Ollama instance for analysis."""
    logger.info(f"Sending transcript to Ollama model: {model} at {url}")

    # Check if Ollama is running
    try:
        requests.get(f"{url}/api/tags", timeout=5).raise_for_status()
    except requests.exceptions.RequestException as e:
        logger.error(f"Ollama is not accessible at {url}: {e}")
        raise RuntimeError(f"Ollama is not running or accessible at {url}.")

    # Make the chat request
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript},
        ],
        "format": "json",
        "stream": False,
    }

    try:
        r = requests.post(f"{url}/api/chat", json=payload, timeout=300)
        r.raise_for_status()
        content = r.json().get("message", {}).get("content", "{}")
        return json.loads(content)
    except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
        logger.error(f"Ollama request failed: {e}")
        raise RuntimeError(f"Failed to get a valid JSON response from Ollama: {e}")

def analyse_meeting(
    transcript: str,
    backend: str = "auto",
    openai_model: str = "gpt-4o-mini",
    ollama_model: str = "llama3",
    ollama_url: str = "http://localhost:11434"
) -> Dict[str, Any]:
    """
    Analyzes a meeting transcript using the specified LLM backend.
    """
    logger.info(f"Analyzing transcript using backend: {backend}")

    # Auto mode logic
    if backend == "auto":
        if os.getenv("OPENAI_API_KEY") and openai:
            logger.info("Auto-selecting OpenAI backend.")
            return _call_openai(transcript, openai_model)
        else:
            logger.info("Auto-selecting Ollama backend.")
            return _call_ollama(transcript, ollama_model, ollama_url)

    # Explicit backend selection
    if backend == "openai":
        return _call_openai(transcript, openai_model)
    if backend == "ollama":
        return _call_ollama(transcript, ollama_model, ollama_url)

    raise ValueError(f"Invalid LLM backend specified: {backend}")
