from fastapi import APIRouter, HTTPException
from typing import Dict
import os
from pathlib import Path
import re

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)

# Path to the .env file
ENV_FILE_PATH = Path(__file__).parent.parent.parent / ".env"

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
