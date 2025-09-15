import os
import json
import logging
from typing import Dict, Any, Optional

from .retry import retry_api_call
from .providers import ProviderFactory, LLMConfig

# Setup logging
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a senior executive assistant. Given a verbatim, speaker-labelled transcript of a meeting, "
    "respond in valid JSON with keys: summary (a list of 3-5 bullet points as strings), "
    "decisions (a list of key decisions as strings), and action_items (a list of objects, "
    "each with 'task', 'owner', and 'due_date' keys). "
    "Return ONLY the JSON object, with no additional text or explanations."
)

def get_default_analysis_config() -> LLMConfig:
    """Get default analysis configuration from environment or fallback"""
    # Try to determine the best available provider
    if os.getenv("OPENAI_API_KEY"):
        return LLMConfig(
            provider="openai",
            model=os.getenv("ANALYSIS_MODEL", "gpt-4o-mini"),
            api_key_env="OPENAI_API_KEY",
            max_tokens=4000,
            temperature=0.1
        )
    else:
        # Fallback to Ollama
        return LLMConfig(
            provider="ollama",
            model=os.getenv("ANALYSIS_MODEL", "llama3"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            max_tokens=4000,
            temperature=0.1
        )

@retry_api_call(max_retries=3, delay=5.0)
async def analyze_transcript_with_provider(transcript: str, config: LLMConfig) -> Dict[str, Any]:
    """Analyze transcript using the specified provider configuration"""
    try:
        provider = ProviderFactory.create_provider(config)
        result = await provider.analyze_transcript(transcript, SYSTEM_PROMPT)
        logger.info(f"Analysis completed using {config.provider} provider")
        return result
    except Exception as e:
        logger.error(f"Analysis failed with {config.provider}: {e}")
        raise

def analyse_meeting(
    transcript: str,
    config: Optional[LLMConfig] = None,
    progress_callback: Optional[object] = None
) -> Dict[str, Any]:
    """
    Analyzes a meeting transcript using the specified or default LLM configuration.
    Includes automatic fallback and comprehensive error handling.
    
    Args:
        transcript: The meeting transcript to analyze
        config: LLM configuration (if None, uses default)
        progress_callback: Optional progress callback
    """
    import asyncio
    
    logger.info("Analyzing transcript...")
    
    if progress_callback:
        progress_callback(10, "Preparing transcript for analysis...")

    # Use provided config or get default
    if config is None:
        config = get_default_analysis_config()
    
    logger.info(f"Using {config.provider} provider for analysis")

    try:
        if progress_callback:
            progress_callback(30, f"Sending transcript to {config.provider}...")
        
        # Run the async analysis in a sync context
        result = asyncio.run(analyze_transcript_with_provider(transcript, config))
        
        if progress_callback:
            progress_callback(100, "Analysis completed successfully")
        
        return result
        
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        
        if progress_callback:
            progress_callback(100, "Analysis failed - using fallback")
        
        # Return a basic fallback structure
        return {
            "summary": ["Meeting analysis failed due to technical issues."],
            "decisions": [],
            "action_items": [],
            "error": f"Analysis failed: {str(e)}"
        }

# Legacy function for backward compatibility
def analyse_meeting_legacy(
    transcript: str,
    backend: str = "auto",
    openai_model: str = "gpt-4o-mini",
    ollama_model: str = "llama3",
    ollama_url: str = "http://localhost:11434",
    progress_callback: Optional[object] = None
) -> Dict[str, Any]:
    """Legacy wrapper for analyse_meeting with old parameter format"""
    
    # Convert legacy parameters to new LLMConfig format
    if backend == "openai":
        config = LLMConfig(
            provider="openai",
            model=openai_model,
            api_key_env="OPENAI_API_KEY"
        )
    elif backend == "ollama":
        config = LLMConfig(
            provider="ollama",
            model=ollama_model,
            base_url=ollama_url
        )
    else:  # auto mode
        config = None  # Will use default detection
    
    return analyse_meeting(transcript, config, progress_callback)
