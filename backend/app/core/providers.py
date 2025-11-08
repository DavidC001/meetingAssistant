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
    timeout: int = 300

class LLMProvider(ABC):
    """Abstract base class for LLM providers"""
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> Union[str, Dict[str, Any]]:
        """Generate a chat completion response
        
        Returns:
            If tools are not used: str (the response text)
            If tools are used: Dict with 'tool_calls' key containing list of tool calls
        """
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
    """OpenAI-compatible provider implementation (supports OpenAI, Gemini, Anthropic, etc.)"""
    
    def __init__(self, config: LLMConfig):
        super().__init__(config)
        if openai is None:
            raise RuntimeError("OpenAI package not installed. Please run 'pip install openai'.")
        
        api_key = self.get_api_key()
        if not api_key:
            env_hint = f" from environment variable '{self.config.api_key_env}'" if self.config.api_key_env else ""
            provider_name = self.config.provider.title() if self.config.provider else "API"
            raise RuntimeError(
                f"{provider_name} API key not provided{env_hint}. Please configure the API key in Settings > Model Configuration."
            )
        
        # Initialize clients
        # Only pass base_url if it's explicitly set (not None)
        client_kwargs = {"api_key": api_key}
        if config.base_url:
            client_kwargs["base_url"] = config.base_url
        
        self.client = openai.OpenAI(**client_kwargs)
        self.async_client = AsyncOpenAI(**client_kwargs)
    
    def _get_token_param(self) -> Dict[str, int]:
        """
        Get the appropriate token limit parameter based on the model.
        Older models (gpt-3.5-turbo, gpt-4) use max_tokens.
        All newer models (gpt-4o, gpt-4-turbo, gpt-5, etc.) use max_completion_tokens.
        Defaults to max_completion_tokens for unknown/future models.
        """
        model = self.config.model.lower()
        
        # Only these specific older models use max_tokens
        # All other models (including future models) use max_completion_tokens
        old_models_exact = ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-32k']
        
        # Check if it's exactly an old model (but not a variant like gpt-4o or gpt-4-turbo)
        if model in old_models_exact or (model.startswith('gpt-3.5') or 
                                         (model.startswith('gpt-4') and 
                                          'gpt-4o' not in model and 
                                          'gpt-4-turbo' not in model)):
            return {"max_tokens": self.config.max_tokens}
        
        # Default to max_completion_tokens for all newer and future models
        return {"max_completion_tokens": self.config.max_tokens}
    
    @retry_api_call(max_retries=3, delay=5.0)
    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> Union[str, Dict[str, Any]]:
        """Generate a chat completion response
        
        Args:
            messages: Conversation messages
            system_prompt: Optional system prompt
            tools: Optional list of tool definitions
            
        Returns:
            If no tool calls: str (the response text)
            If tool calls: Dict with 'tool_calls' and optional 'message' keys
        """
        try:
            # Prepare messages
            formatted_messages = []
            if system_prompt:
                formatted_messages.append({"role": "system", "content": system_prompt})
            formatted_messages.extend(messages)
            
            # Get the appropriate token parameter for this model
            token_param = self._get_token_param()
            
            # Build request parameters
            request_params = {
                "model": self.config.model,
                "messages": formatted_messages,
                **token_param,
                "timeout": self.config.timeout
            }
            
            # Add tools if provided
            if tools:
                request_params["tools"] = tools
                request_params["tool_choice"] = "auto"
            
            response = await self.async_client.chat.completions.create(**request_params)
            
            message = response.choices[0].message
            
            # Check if the model wants to call tools
            if message.tool_calls:
                tool_calls = []
                for tool_call in message.tool_calls:
                    tool_calls.append({
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments
                        }
                    })
                return {
                    "tool_calls": tool_calls,
                    "message": message.content if message.content else ""
                }
            
            # No tool calls, return text response
            return message.content.strip() if message.content else ""
            
        except Exception as e:
            self.logger.error(f"OpenAI chat completion failed: {e}")
            raise
    
    @retry_api_call(max_retries=3, delay=5.0)
    async def analyze_transcript(self, transcript: str, system_prompt: str) -> Dict[str, Any]:
        """Analyze a transcript and return structured JSON data"""
        try:
            # Get the appropriate token parameter for this model
            token_param = self._get_token_param()
            
            response = await self.async_client.chat.completions.create(
                model=self.config.model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": transcript}
                ],
                **token_param,
                timeout=self.config.timeout
            )
            
            # Validate response structure
            if not response or not response.choices:
                self.logger.error(f"Invalid response structure from OpenAI: {response}")
                raise ValueError("OpenAI returned invalid response structure (no choices)")
            
            if not response.choices[0].message:
                self.logger.error(f"Invalid response structure from OpenAI: no message in choice")
                raise ValueError("OpenAI returned invalid response structure (no message)")
            
            # Check finish reason
            finish_reason = response.choices[0].finish_reason
            if finish_reason == 'length':
                usage = response.usage
                self.logger.error(
                    f"OpenAI response truncated due to token limit. "
                    f"Used {usage.completion_tokens} completion tokens (max_tokens={self.config.max_tokens}). "
                    f"Total: {usage.total_tokens} tokens. "
                    f"Consider increasing max_tokens or reducing transcript length."
                )
                raise ValueError(
                    f"Response truncated: hit max_tokens limit ({self.config.max_tokens}). "
                    f"Increase max_tokens in model configuration or use a model with larger context."
                )
            
            # Get the response content
            content = response.choices[0].message.content
            
            # Log response details for debugging
            self.logger.info(f"OpenAI response received. Content length: {len(content) if content else 0}, finish_reason: {finish_reason}")
            
            # Check if content is None or empty
            if not content:
                self.logger.error(f"OpenAI returned empty content. Full response: {response}")
                raise ValueError("OpenAI returned an empty response")
            
            # Strip whitespace
            content = content.strip()
            
            # Check if stripped content is empty
            if not content:
                self.logger.error("OpenAI returned only whitespace")
                raise ValueError("OpenAI returned only whitespace")
            
            # Log the content we're about to parse
            self.logger.debug(f"Attempting to parse JSON content: {content[:200]}...")
            
            # Parse JSON
            try:
                return json.loads(content)
            except json.JSONDecodeError as je:
                self.logger.error(f"Failed to parse JSON. Content: {content[:500]}")
                raise ValueError(f"Invalid JSON response from OpenAI: {je}")
            
        except openai.APIConnectionError as e:
            self.logger.error(f"OpenAI connection error: {e}")
            raise ConnectionError(f"Failed to connect to OpenAI API. Please check your network connection and API configuration.")
        except openai.APITimeoutError as e:
            self.logger.error(f"OpenAI timeout error: {e}")
            raise TimeoutError(f"Request to OpenAI API timed out. Please try again.")
        except openai.RateLimitError as e:
            self.logger.error(f"OpenAI rate limit error: {e}")
            raise ValueError(f"OpenAI API rate limit exceeded. Please try again later.")
        except openai.AuthenticationError as e:
            self.logger.error(f"OpenAI authentication error: {e}")
            raise ValueError(f"OpenAI API authentication failed. Please check your API key.")
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
    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        system_prompt: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None
    ) -> Union[str, Dict[str, Any]]:
        """Generate a chat completion response
        
        Note: Tool support requires Ollama 0.3.0+ with compatible models (e.g., llama3.1, mistral)
        """
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
                }
            }
            
            # Add tools if provided (Ollama 0.3.0+ supports OpenAI-compatible tool format)
            if tools:
                self.logger.info(f"Adding {len(tools)} tools to Ollama request")
                payload["tools"] = tools
            
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
            message = result.get("message", {})
            
            # Check if the model wants to call tools (Ollama uses same format as OpenAI)
            if message.get("tool_calls"):
                tool_calls = []
                for tool_call in message["tool_calls"]:
                    # Ollama returns tool calls in OpenAI-compatible format
                    tool_calls.append({
                        "id": tool_call.get("id", f"call_{len(tool_calls)}"),
                        "type": "function",
                        "function": {
                            "name": tool_call["function"]["name"],
                            "arguments": json.dumps(tool_call["function"]["arguments"]) if isinstance(tool_call["function"]["arguments"], dict) else tool_call["function"]["arguments"]
                        }
                    })
                return {
                    "tool_calls": tool_calls,
                    "message": message.get("content", "")
                }
            
            # No tool calls, return text response
            return message.get("content", "")
            
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
                    "num_ctx": self.config.max_tokens
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
        """Factory method to create a provider instance"""
        providers = {
            "openai": OpenAIProvider,
            "ollama": OllamaProvider,
            # Map other providers to OpenAI (most support OpenAI-compatible APIs)
            "anthropic": OpenAIProvider,
            "gemini": OpenAIProvider,
            "cohere": OpenAIProvider,
            "grok": OpenAIProvider,
            "groq": OpenAIProvider,
            "huggingface": OpenAIProvider,
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
        max_tokens=model_config.max_tokens
    )
