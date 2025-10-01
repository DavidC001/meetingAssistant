"""Meeting transcript analysis module.

This module provides functionality for analyzing meeting transcripts using
various LLM providers (OpenAI, Ollama) with automatic fallback and error handling.
"""

import logging
import asyncio
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass

from .retry import retry_api_call
from .providers import ProviderFactory, LLMConfig
from .config import config

# Setup logging
logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """Structured result from transcript analysis."""
    summary: list[str]
    decisions: list[str]
    action_items: list[Dict[str, str]]
    success: bool = True
    error_message: Optional[str] = None


class AnalysisPrompts:
    """Centralized analysis prompts."""
    
    SYSTEM_PROMPT = (
        "You are a senior executive assistant. Given a verbatim, speaker-labelled transcript of a meeting, "
        "respond in valid JSON with keys: summary (a list of 3-5 bullet points as strings), "
        "decisions (a list of key decisions as strings), and action_items (a list of objects, "
        "each with 'task', 'owner', and 'due_date' keys). "
        "Return ONLY the JSON object, with no additional text or explanations."
    )


class AnalysisConfigFactory:
    """Factory for creating analysis configurations."""
    
    @staticmethod
    def get_default_config() -> LLMConfig:
        """Get default analysis configuration with intelligent provider selection."""
        # Prefer OpenAI if available, fallback to Ollama
        model_settings = config.model
        default_kwargs = {
            "max_tokens": model_settings.default_max_tokens,
            "temperature": model_settings.default_temperature,
        }

        openai_api_key = config.get_api_key("OPENAI_API_KEY")

        if openai_api_key:
            return LLMConfig(
                provider="openai",
                model=model_settings.default_analysis_model,
                api_key=openai_api_key,
                **default_kwargs,
            )

        return LLMConfig(
            provider="ollama",
            model=model_settings.local_analysis_model,
            base_url=model_settings.ollama_base_url,
            **default_kwargs,
        )


@retry_api_call(max_retries=3, delay=5.0)
async def analyze_transcript_with_provider(transcript: str, llm_config: LLMConfig) -> Dict[str, Any]:
    """Analyze transcript using the specified provider configuration."""
    try:
        provider = ProviderFactory.create_provider(llm_config)
        result = await provider.analyze_transcript(transcript, AnalysisPrompts.SYSTEM_PROMPT)
        logger.info(f"Analysis completed using {llm_config.provider} provider")
        return result
    except Exception as e:
        logger.error(f"Analysis failed with {llm_config.provider}: {e}")
        raise


class TranscriptAnalyzer:
    """Main class for analyzing meeting transcripts."""
    
    def __init__(self, llm_config: Optional[LLMConfig] = None):
        """Initialize analyzer with configuration."""
        self.config = llm_config or AnalysisConfigFactory.get_default_config()
    
    async def analyze_async(
        self, 
        transcript: str, 
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> AnalysisResult:
        """Analyze transcript asynchronously."""
        try:
            if progress_callback:
                progress_callback(10, "Preparing transcript for analysis...")
            
            logger.info(f"Using {self.config.provider} provider for analysis")
            
            if progress_callback:
                progress_callback(30, f"Sending transcript to {self.config.provider}...")
            
            result = await analyze_transcript_with_provider(transcript, self.config)
            
            if progress_callback:
                progress_callback(100, "Analysis completed successfully")
            
            return AnalysisResult(
                summary=result.get("summary", []),
                decisions=result.get("decisions", []),
                action_items=result.get("action_items", [])
            )
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            
            if progress_callback:
                progress_callback(100, "Analysis failed - using fallback")
            
            return AnalysisResult(
                summary=["Meeting analysis failed due to technical issues."],
                decisions=[],
                action_items=[],
                success=False,
                error_message=str(e)
            )
    
    def analyze(
        self, 
        transcript: str, 
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> AnalysisResult:
        """Analyze transcript synchronously."""
        return asyncio.run(self.analyze_async(transcript, progress_callback))


def analyse_meeting(
    transcript: str,
    llm_config: Optional[LLMConfig] = None,
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> Dict[str, Any]:
    """
    Analyze a meeting transcript using the specified or default LLM configuration.
    
    This is the main entry point for transcript analysis with backward compatibility.
    
    Args:
        transcript: The meeting transcript to analyze
        llm_config: LLM configuration (if None, uses default)
        progress_callback: Optional progress callback function
        
    Returns:
        Dict containing analysis results (summary, decisions, action_items)
    """
    analyzer = TranscriptAnalyzer(llm_config)
    result = analyzer.analyze(transcript, progress_callback)
    
    # Convert to legacy dict format for backward compatibility
    return {
        "summary": result.summary,
        "decisions": result.decisions,
        "action_items": result.action_items,
        "success": result.success,
        "error": result.error_message
    }


# Legacy function for backward compatibility
def analyse_meeting_legacy(
    transcript: str,
    backend: str = "auto",
    openai_model: str = "gpt-4o-mini",
    ollama_model: str = "llama3",
    ollama_url: str = "http://localhost:11434",
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> Dict[str, Any]:
    """Legacy wrapper for analyse_meeting with old parameter format."""
    
    # Convert legacy parameters to new LLMConfig format
    openai_api_key = config.get_api_key("OPENAI_API_KEY")

    if backend == "openai":
        llm_config = LLMConfig(
            provider="openai",
            model=openai_model,
            api_key=openai_api_key,
            max_tokens=config.model.default_max_tokens,
            temperature=config.model.default_temperature
        )
    elif backend == "ollama":
        llm_config = LLMConfig(
            provider="ollama",
            model=ollama_model,
            base_url=ollama_url or config.model.ollama_base_url,
            max_tokens=config.model.default_max_tokens,
            temperature=config.model.default_temperature
        )
    else:  # auto mode
        llm_config = None  # Will use default detection
    
    return analyse_meeting(transcript, llm_config, progress_callback)
