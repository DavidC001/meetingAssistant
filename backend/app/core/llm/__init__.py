"""
LLM (Large Language Model) integration module.

This subpackage contains all LLM-related functionality:
- Provider abstraction (OpenAI, Ollama, etc.)
- Chat functionality
- Meeting analysis
- Tool use/function calling

Re-exports from existing modules for a cleaner API:
    from app.core.llm import ProviderFactory, LLMConfig
    from app.core.llm import chat_with_meeting
    from app.core.llm import analyze_transcript
"""

# Provider abstraction layer
# Analysis functionality
from .analysis import (
    AnalysisConfigFactory,
    AnalysisPrompts,
    AnalysisResult,
    TranscriptAnalyzer,
    analyse_meeting,
    analyze_transcript_with_provider,
)

# Chat functionality
from .chat import (
    chat_with_meeting,
    get_default_chat_config,
    model_config_to_llm_config,
)
from .providers import (
    LLMConfig,
    LLMProvider,
    OllamaProvider,
    OpenAIProvider,
    ProviderFactory,
)

# Tool use
from .tools import (
    ToolRegistry,
    tool_registry,
)

__all__ = [
    # Providers
    "LLMConfig",
    "LLMProvider",
    "OpenAIProvider",
    "OllamaProvider",
    "ProviderFactory",
    # Chat
    "chat_with_meeting",
    "model_config_to_llm_config",
    "get_default_chat_config",
    # Analysis
    "analyse_meeting",
    "analyze_transcript_with_provider",
    "AnalysisResult",
    "AnalysisPrompts",
    "AnalysisConfigFactory",
    "TranscriptAnalyzer",
    # Tools
    "tool_registry",
    "ToolRegistry",
]
