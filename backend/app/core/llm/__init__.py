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
from .providers import (
    LLMConfig,
    LLMProvider,
    OpenAIProvider,
    OllamaProvider,
    ProviderFactory,
)

# Chat functionality
from .chat import (
    chat_with_meeting,
    model_config_to_llm_config,
    get_default_chat_config,
)

# Analysis functionality
from .analysis import (
    analyse_meeting,
    analyze_transcript_with_provider,
    AnalysisResult,
    AnalysisPrompts,
    AnalysisConfigFactory,
    TranscriptAnalyzer,
)

# Tool use
from .tools import (
    tool_registry,
    ToolRegistry,
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
