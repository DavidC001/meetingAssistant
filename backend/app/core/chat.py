import logging
from typing import List, Dict, Optional
from .providers import ProviderFactory, LLMConfig
from .config import config

logger = logging.getLogger(__name__)


def model_config_to_llm_config(model_config, use_analysis: bool = False) -> LLMConfig:
    """Convert database ModelConfiguration to LLMConfig for LLM operations.
    
    Args:
        model_config: Database ModelConfiguration object
        use_analysis: If True, use analysis settings; if False, use chat settings
    
    Returns:
        LLMConfig object for the specified provider
    """
    if use_analysis:
        provider = model_config.analysis_provider
        model = model_config.analysis_model
        base_url = model_config.analysis_base_url
        api_key_id = model_config.analysis_api_key_id
    else:
        provider = model_config.chat_provider
        model = model_config.chat_model
        base_url = model_config.chat_base_url
        api_key_id = model_config.chat_api_key_id
    
    # Get API key if needed
    api_key = None
    if provider == "openai":
        api_key = config.get_api_key("OPENAI_API_KEY")
    
    return LLMConfig(
        provider=provider,
        model=model,
        base_url=base_url,
        api_key=api_key,
        max_tokens=model_config.max_tokens,
        temperature=model_config.temperature
    )

def get_default_chat_config() -> LLMConfig:
    """Build a default chat configuration based on application settings."""

    model_settings = config.model
    default_kwargs = {
        "max_tokens": model_settings.default_max_tokens,
        "temperature": model_settings.default_temperature,
    }

    preferred_provider = model_settings.preferred_provider.lower()
    openai_api_key = config.get_api_key("OPENAI_API_KEY")

    # Use preferred provider if available, otherwise fallback
    if preferred_provider == "ollama":
        return LLMConfig(
            provider="ollama",
            model=model_settings.local_chat_model,
            base_url=model_settings.ollama_base_url,
            **default_kwargs,
        )
    elif preferred_provider == "openai" and openai_api_key:
        return LLMConfig(
            provider="openai",
            model=model_settings.default_chat_model,
            api_key=openai_api_key,
            **default_kwargs,
        )
    
    # Fallback logic: try openai first if key exists, otherwise ollama
    if openai_api_key:
        return LLMConfig(
            provider="openai",
            model=model_settings.default_chat_model,
            api_key=openai_api_key,
            **default_kwargs,
        )

    return LLMConfig(
        provider="ollama",
        model=model_settings.local_chat_model,
        base_url=model_settings.ollama_base_url,
        **default_kwargs,
    )

async def chat_with_meeting(
    query: str, 
    transcript: str, 
    chat_history: List[Dict[str, str]], 
    config: Optional[LLMConfig] = None
) -> str:
    """
    Generates a response to a query using the meeting transcript and chat history.
    
    Args:
        query: User's question
        transcript: Meeting transcript text
        chat_history: Previous chat messages
        config: LLM configuration (if None, uses default)
    """
    try:
        # Use provided config or get default
        if config is None:
            config = get_default_chat_config()
        
        # Create provider instance
        provider = ProviderFactory.create_provider(config)
        
        # Prepare system prompt
        system_prompt = (
            "You are an AI assistant that helps users understand and analyze meeting transcripts. "
            "Use the provided transcript to answer questions accurately and helpfully. "
            "If a question cannot be answered from the transcript, say so clearly. "
            "Be concise but thorough in your responses."
        )
        
        # Prepare context message with transcript
        context_message = f"Meeting Transcript:\n\n{transcript}\n\nUser Question: {query}"
        
        # Prepare messages for the provider
        messages = []
        
        # Add recent chat history (last 5 messages to avoid context overflow)
        for msg in chat_history[-5:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
        
        # Add current query with context
        messages.append({
            "role": "user",
            "content": context_message
        })
        
        # Get response from provider
        response = await provider.chat_completion(messages, system_prompt)
        
        logger.info(f"Chat response generated using {config.provider} provider")
        return response

    except Exception as e:
        logger.error(f"Chat completion failed: {e}", exc_info=True)
        return f"Error: Could not get a response from the AI. {str(e)}"
