"""
Ollama router for managing Ollama Docker containers.

This module handles Ollama container lifecycle management including
starting, stopping, and status checking.
"""

import subprocess

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .service import OllamaService

router = APIRouter(
    prefix="/ollama",
    tags=["ollama"],
)


class OllamaConfig(BaseModel):
    """Configuration for Ollama container."""

    model: str = "llama3.2"
    port: int = 11434


class OllamaStatus(BaseModel):
    """Status response for Ollama."""

    status: str
    message: str = ""


_STATUS_MESSAGES = {
    "running": "Ollama container is running and healthy",
    "starting": "Ollama container is starting up",
    "stopped": "Ollama container is stopped",
    "not_installed": "Ollama container is not installed",
    "error": "Error checking Ollama status",
}


@router.get("/status", response_model=OllamaStatus)
async def get_ollama_status():
    """Get the current status of the Ollama container."""
    service = OllamaService()
    status = service.get_status()
    return OllamaStatus(status=status, message=_STATUS_MESSAGES.get(status, "Unknown status"))


@router.post("/start")
async def start_ollama(config: OllamaConfig):
    """Start the Ollama Docker container."""
    try:
        service = OllamaService()
        return service.start(model=config.model, port=config.port)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Timeout while starting Ollama container")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error starting Ollama container: {str(e)}")


@router.post("/stop")
async def stop_ollama():
    """Stop the Ollama Docker container."""
    try:
        service = OllamaService()
        return service.stop()
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Timeout while stopping Ollama container")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error stopping Ollama container: {str(e)}")


@router.delete("/remove")
async def remove_ollama():
    """Remove the Ollama Docker container."""
    try:
        service = OllamaService()
        return service.remove()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing Ollama container: {str(e)}")
