"""
Ollama router for managing Ollama Docker containers.

This module handles Ollama container lifecycle management including
starting, stopping, and status checking.
"""

import subprocess
import requests
import shutil
import os
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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


def get_docker_command() -> Optional[str]:
    """Find the docker executable in the system PATH."""
    # Check if we're running inside a Docker container with socket access
    if os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv'):
        # Check if Docker socket is mounted
        if os.path.exists('/var/run/docker.sock'):
            # We're inside a container WITH Docker socket access
            docker_path = shutil.which("docker")
            if docker_path:
                return docker_path
            # Docker CLI might not be installed in the container
            return None
        else:
            # We're inside a container WITHOUT Docker socket access
            return None
    
    # Running on host system - try to find docker in PATH
    docker_path = shutil.which("docker")
    if docker_path:
        return docker_path
    
    # Try common Windows paths (use os.path.exists for explicit paths)
    common_paths = [
        r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
        r"C:\Program Files\Docker\Docker\resources\docker.exe",
        r"C:\ProgramData\DockerDesktop\version-bin\docker.exe",
    ]
    
    for path in common_paths:
        if os.path.exists(path):
            return path
    
    return None


def check_ollama_container() -> str:
    """Check if Ollama container is running."""
    try:
        docker_cmd = get_docker_command()
        if not docker_cmd:
            return "error"
        
        # Use exact name match with ^ollama$ to avoid matching containers with "ollama" in the name
        result = subprocess.run(
            [docker_cmd, "ps", "--filter", "name=^ollama$", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0 and result.stdout.strip() == "ollama":
            # Container is running, check if the service is actually responding
            # Use host.docker.internal when in container, localhost when on host
            ollama_host = "host.docker.internal" if os.path.exists('/.dockerenv') else "localhost"
            try:
                response = requests.get(f"http://{ollama_host}:11434/api/tags", timeout=2)
                if response.status_code == 200:
                    return "running"
            except requests.exceptions.RequestException:
                pass
            return "starting"
        
        # Check if container exists but is stopped
        result = subprocess.run(
            [docker_cmd, "ps", "-a", "--filter", "name=^ollama$", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0 and result.stdout.strip() == "ollama":
            return "stopped"
        
        return "not_installed"
    except Exception as e:
        print(f"Error checking Ollama status: {e}")
        return "error"


@router.get("/status", response_model=OllamaStatus)
async def get_ollama_status():
    """Get the current status of the Ollama container."""
    status = check_ollama_container()
    
    messages = {
        "running": "Ollama container is running and healthy",
        "starting": "Ollama container is starting up",
        "stopped": "Ollama container is stopped",
        "not_installed": "Ollama container is not installed",
        "error": "Error checking Ollama status"
    }
    
    return OllamaStatus(
        status=status,
        message=messages.get(status, "Unknown status")
    )


@router.post("/start")
async def start_ollama(config: OllamaConfig):
    """Start the Ollama Docker container."""
    try:
        docker_cmd = get_docker_command()
        if not docker_cmd:
            # Check if we're in a container
            if os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv'):
                if not os.path.exists('/var/run/docker.sock'):
                    raise HTTPException(
                        status_code=500,
                        detail="Docker socket not mounted. To enable Ollama management, the Docker socket must be mounted in docker-compose.yml."
                    )
                else:
                    raise HTTPException(
                        status_code=500,
                        detail="Docker CLI not available in container. Please rebuild the backend container with Docker CLI installed."
                    )
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Docker command not found. Please ensure Docker is installed and in your PATH."
                )
        
        # First, check if a container named "ollama" exists (running or stopped)
        check_result = subprocess.run(
            [docker_cmd, "ps", "-a", "--filter", "name=^ollama$", "--format", "{{.Names}}\t{{.State}}"],
            capture_output=True,
            text=True,
            check=False
        )
        
        if check_result.returncode == 0 and check_result.stdout.strip():
            # Container exists - check its state
            lines = check_result.stdout.strip().split('\n')
            for line in lines:
                if '\t' in line:
                    name, state = line.split('\t', 1)
                    if name == "ollama":
                        if state == "running":
                            return {"message": "Ollama container is already running", "status": "running"}
                        elif state == "exited" or state == "created":
                            # Start existing stopped container
                            result = subprocess.run(
                                [docker_cmd, "start", "ollama"],
                                capture_output=True,
                                text=True,
                                check=False
                            )
                            
                            if result.returncode == 0:
                                return {"message": "Ollama container started successfully", "status": "starting"}
                            else:
                                raise HTTPException(
                                    status_code=500,
                                    detail=f"Failed to start existing Ollama container: {result.stderr}"
                                )
        
        # Create and start new container
        docker_command = [
            docker_cmd, "run", "-d",
            "--name", "ollama",
            "-p", f"{config.port}:11434",
            "--restart", "unless-stopped"
        ]
        
        # Add GPU support if available
        try:
            gpu_check = subprocess.run(
                [docker_cmd, "run", "--rm", "--gpus", "all", "nvidia/cuda:11.0-base", "nvidia-smi"],
                capture_output=True,
                timeout=5,
                check=False
            )
            if gpu_check.returncode == 0:
                docker_command.extend(["--gpus", "all"])
        except Exception:
            pass  # GPU not available, continue without it
        
        docker_command.append("ollama/ollama")
        
        result = subprocess.run(
            docker_command,
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0:
            # Wait a moment for container to start
            import time
            time.sleep(2)
            
            # Pull the specified model
            try:
                subprocess.run(
                    [docker_cmd, "exec", "ollama", "ollama", "pull", config.model],
                    capture_output=True,
                    check=False
                )
            except Exception as e:
                print(f"Warning: Could not pull model {config.model}: {e}")
            
            return {
                "message": f"Ollama container started successfully with model {config.model}",
                "status": "starting"
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to start Ollama container: {result.stderr}"
            )
    
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="Timeout while starting Ollama container"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error starting Ollama container: {str(e)}"
        )


@router.post("/stop")
async def stop_ollama():
    """Stop the Ollama Docker container."""
    try:
        docker_cmd = get_docker_command()
        if not docker_cmd:
            # Check if we're in a container
            if os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv'):
                if not os.path.exists('/var/run/docker.sock'):
                    raise HTTPException(
                        status_code=500,
                        detail="Docker socket not mounted. To enable Ollama management, the Docker socket must be mounted in docker-compose.yml."
                    )
                else:
                    raise HTTPException(
                        status_code=500,
                        detail="Docker CLI not available in container. Please rebuild the backend container with Docker CLI installed."
                    )
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Docker command not found. Please ensure Docker is installed and in your PATH."
                )
        
        current_status = check_ollama_container()
        
        if current_status in ["stopped", "not_installed"]:
            return {"message": "Ollama container is not running", "status": "stopped"}
        
        result = subprocess.run(
            [docker_cmd, "stop", "ollama"],
            capture_output=True,
            text=True,
            check=False,
            timeout=30
        )
        
        if result.returncode == 0:
            return {"message": "Ollama container stopped successfully", "status": "stopped"}
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to stop Ollama container: {result.stderr}"
            )
    
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500,
            detail="Timeout while stopping Ollama container"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error stopping Ollama container: {str(e)}"
        )


@router.delete("/remove")
async def remove_ollama():
    """Remove the Ollama Docker container."""
    try:
        docker_cmd = get_docker_command()
        if not docker_cmd:
            # Check if we're in a container
            if os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv'):
                if not os.path.exists('/var/run/docker.sock'):
                    raise HTTPException(
                        status_code=500,
                        detail="Docker socket not mounted. To enable Ollama management, the Docker socket must be mounted in docker-compose.yml."
                    )
                else:
                    raise HTTPException(
                        status_code=500,
                        detail="Docker CLI not available in container. Please rebuild the backend container with Docker CLI installed."
                    )
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Docker command not found. Please ensure Docker is installed and in your PATH."
                )
        
        # Stop the container first
        subprocess.run(
            [docker_cmd, "stop", "ollama"],
            capture_output=True,
            check=False,
            timeout=30
        )
        
        # Remove the container
        result = subprocess.run(
            [docker_cmd, "rm", "ollama"],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0:
            return {"message": "Ollama container removed successfully"}
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to remove Ollama container: {result.stderr}"
            )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error removing Ollama container: {str(e)}"
        )
