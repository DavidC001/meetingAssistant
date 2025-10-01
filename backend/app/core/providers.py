"""
LLM Provider abstraction layer for supporting multiple AI providers.
Supports OpenAI and Ollama models.
"""

import os
import json
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Union
import requests
from dataclasses import dataclass
from sqlalchemy.orm import Session

from .retry import retry_api_call
from .config import config

# Optional imports
try:
    import openai
    from openai import AsyncOpenAI
except ImportError:
    openai = None
    AsyncOpenAI = None

logger = logging.getLogger(__name__)

@dataclass
class LLMConfig:
    """Configuration for LLM providers"""
    provider: str  # "openai", "ollama"
    model: str
    base_url: Optional[str] = None
    api_key_env: Optional[str] = None  # Legacy: environment variable name
    api_key: Optional[str] = None  # New: actual API key value
    max_tokens: int = 4000
    temperature: float = 0.1
    timeout: int = 300

class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    async def chat_completion(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> str:
        """Generate a chat completion response"""
        pass
    
    @abstractmethod
    async def analyze_transcript(self, transcript: str, system_prompt: str) -> Dict[str, Any]:
        """Analyze a transcript and return structured data"""
        pass
    
    def get_api_key(self) -> Optional[str]:
        """Get API key from direct value or environment variable"""
        # First, try to use the direct API key value (new approach)
        if self.config.api_key:
            return self.config.api_key
        
        # Fall back to environment variable (legacy approach)
        if self.config.api_key_env:
            return os.getenv(self.config.api_key_env)
        
        return None

class OpenAIProvider(LLMProvider):
    """OpenAI provider implementation"""
    
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        if openai is None:
            raise RuntimeError("OpenAI package not installed. Please run 'pip install openai'.")
        
        api_key = self.get_api_key()
        if not api_key:
            env_hint = f" '{self.config.api_key_env}'" if self.config.api_key_env else ""
            raise RuntimeError(
                f"OpenAI API key not provided{env_hint}. Configure it in the application settings."
            )
        
        # Initialize clients
        self.client = openai.OpenAI(
            api_key=api_key,
            base_url=config.base_url
        )
        self.async_client = AsyncOpenAI(
            api_key=api_key,
            base_url=config.base_url
        )
    
    @retry_api_call(max_retries=3, delay=5.0)
    async def chat_completion(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> str:
        """Generate a chat completion response"""
        try:
            # Prepare messages
            formatted_messages = []
            if system_prompt:
                formatted_messages.append({"role": "system", "content": system_prompt})
            formatted_messages.extend(messages)
            
            response = await self.async_client.chat.completions.create(
                model=self.config.model,
                messages=formatted_messages,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                timeout=self.config.timeout
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            self.logger.error(f"OpenAI chat completion failed: {e}")
            raise
    
    @retry_api_call(max_retries=3, delay=5.0)
    async def analyze_transcript(self, transcript: str, system_prompt: str) -> Dict[str, Any]:
        """Analyze a transcript and return structured JSON data"""
        try:
            response = await self.async_client.chat.completions.create(
                model=self.config.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": transcript}
                ],
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                timeout=self.config.timeout
            )
            
            content = response.choices[0].message.content.strip()
            return json.loads(content)
            
        except Exception as e:
            self.logger.error(f"OpenAI transcript analysis failed: {e}")
            raise

class OllamaProvider(LLMProvider):
    """Ollama provider implementation"""
    
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        self.base_url = config.base_url or "http://localhost:11434"
        
        # Test connectivity
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Ollama is not accessible at {self.base_url}: {e}")
    
    @retry_api_call(max_retries=3, delay=5.0)
    async def chat_completion(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None) -> str:
        """Generate a chat completion response"""
        try:
            # Prepare messages for Ollama format
            formatted_messages = []
            if system_prompt:
                formatted_messages.append({"role": "system", "content": system_prompt})
            formatted_messages.extend(messages)
            
            payload = {
                "model": self.config.model,
                "messages": formatted_messages,
                "stream": False,
                "options": {
                    "num_ctx": self.config.max_tokens,
                    "temperature": self.config.temperature
                }
            }
            
            # Use asyncio to run the synchronous request
            def make_request():
                response = requests.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    timeout=self.config.timeout
                )
                response.raise_for_status()
                return response.json()
            
            result = await asyncio.get_event_loop().run_in_executor(None, make_request)
            return result.get("message", {}).get("content", "")
            
        except Exception as e:
            self.logger.error(f"Ollama chat completion failed: {e}")
            raise
    
    @retry_api_call(max_retries=3, delay=5.0)
    async def analyze_transcript(self, transcript: str, system_prompt: str) -> Dict[str, Any]:
        """Analyze a transcript and return structured JSON data"""
        try:
            payload = {
                "model": self.config.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": transcript}
                ],
                "format": "json",
                "stream": False,
                "options": {
                    "num_ctx": self.config.max_tokens,
                    "temperature": self.config.temperature
                }
            }
            
            def make_request():
                response = requests.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                    timeout=self.config.timeout
                )
                response.raise_for_status()
                return response.json()
            
            result = await asyncio.get_event_loop().run_in_executor(None, make_request)
            content = result.get("message", {}).get("content", "{}")
            return json.loads(content)
            
        except Exception as e:
            self.logger.error(f"Ollama transcript analysis failed: {e}")
            raise

class ProviderFactory:
    """Factory for creating LLM providers"""
    
    @staticmethod
    def create_provider(config: LLMConfig) -> LLMProvider:
        """Create a provider instance based on configuration"""
        providers = {
            "openai": OpenAIProvider,
            "ollama": OllamaProvider
        }
        
        provider_class = providers.get(config.provider.lower())
        if not provider_class:
            raise ValueError(f"Unknown provider: {config.provider}")
        
        return provider_class(config)

def create_default_configs() -> Dict[str, LLMConfig]:
    """Create default LLM configurations"""
    model_settings = config.model
    default_kwargs = {
        "max_tokens": model_settings.default_max_tokens,
        "temperature": model_settings.default_temperature,
    }

    openai_api_key = config.get_api_key("OPENAI_API_KEY")

    return {
        "openai": LLMConfig(
            provider="openai",
            model=model_settings.default_chat_model,
            api_key=openai_api_key,
            api_key_env="OPENAI_API_KEY",
            **default_kwargs,
        ),
        "ollama": LLMConfig(
            provider="ollama",
            model=model_settings.local_chat_model,
            base_url=model_settings.ollama_base_url,
            **default_kwargs,
        ),
    }

def model_config_to_llm_config(model_config, purpose: str, db: Session) -> LLMConfig:
    """
    Convert a ModelConfiguration to LLMConfig for a specific purpose.
    purpose: "chat" or "analysis"
    """
    from .. import models  # Import here to avoid circular imports
    
    if purpose == "chat":
        provider = model_config.chat_provider
        model = model_config.chat_model
        base_url = model_config.chat_base_url
        api_key_id = model_config.chat_api_key_id
    elif purpose == "analysis":
        provider = model_config.analysis_provider
        model = model_config.analysis_model
        base_url = model_config.analysis_base_url
        api_key_id = model_config.analysis_api_key_id
    else:
        raise ValueError(f"Invalid purpose: {purpose}. Must be 'chat' or 'analysis'")
    
    # Get the API key if an ID is provided
    api_key = None
    if api_key_id:
        api_key_obj = db.query(models.APIKey).filter(
            models.APIKey.id == api_key_id,
            models.APIKey.is_active == True
        ).first()
        if api_key_obj:
            api_key = config.api.get(api_key_obj.environment_variable)

    if not api_key and provider == "openai":
        api_key = config.get_api_key("OPENAI_API_KEY")
    
    return LLMConfig(
        provider=provider,
        model=model,
        base_url=base_url,
        api_key=api_key,
        max_tokens=model_config.max_tokens,
        temperature=model_config.temperature
    )
