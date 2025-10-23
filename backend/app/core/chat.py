import logging
import json
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from .providers import ProviderFactory, LLMConfig
from .config import config
from .tools import tool_registry

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
        max_tokens=model_config.max_tokens
    )

def get_default_chat_config() -> LLMConfig:
    """Build a default chat configuration based on application settings."""

    model_settings = config.model
    default_kwargs = {
        "max_tokens": model_settings.default_max_tokens,
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
    config: Optional[LLMConfig] = None,
    db: Optional[Session] = None,
    meeting_id: Optional[int] = None,
    enable_tools: bool = True,
    max_tool_iterations: int = 5
) -> str:
    """
    Generates a response to a query using the meeting transcript and chat history.
    Supports tool calling for enhanced capabilities like creating action items.
    
    Args:
        query: User's question
        transcript: Meeting transcript text
        chat_history: Previous chat messages
        config: LLM configuration (if None, uses default)
        db: Database session for tool operations (required if enable_tools=True)
        meeting_id: Meeting ID for tool operations (required if enable_tools=True)
        enable_tools: Whether to enable tool calling
        max_tool_iterations: Maximum number of tool call iterations to prevent infinite loops
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
            "Be concise but thorough in your responses.\n\n"
        )
        
        if enable_tools and db and meeting_id:
            system_prompt += (
                "You have access to tools that allow you to perform actions like:\n"
                "- Creating and updating action items\n"
                "- Adding notes to meetings\n"
                "- Searching meeting content\n"
                "- Updating meeting details\n"
                "Use these tools when appropriate to help the user manage their meetings effectively."
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
        
        # Get tool definitions if tools are enabled
        tools = None
        if enable_tools and db and meeting_id and config.provider == "openai":
            tools = tool_registry.get_tool_definitions()
        
        # Tool calling loop
        iteration = 0
        tool_results = []
        
        while iteration < max_tool_iterations:
            iteration += 1
            
            # Get response from provider
            response = await provider.chat_completion(messages, system_prompt, tools=tools)
            
            # Check if response contains tool calls
            if isinstance(response, dict) and "tool_calls" in response:
                # Process tool calls
                tool_calls = response["tool_calls"]
                logger.info(f"Processing {len(tool_calls)} tool call(s)")
                
                # Add assistant message with tool calls to conversation
                messages.append({
                    "role": "assistant",
                    "content": response.get("message", ""),
                    "tool_calls": tool_calls
                })
                
                # Execute each tool call
                for tool_call in tool_calls:
                    function_name = tool_call["function"]["name"]
                    function_args = json.loads(tool_call["function"]["arguments"])
                    
                    logger.info(f"Executing tool: {function_name} with args: {function_args}")
                    
                    # Execute the tool
                    tool_context = {
                        "db": db,
                        "meeting_id": meeting_id
                    }
                    
                    result = await tool_registry.execute_tool(
                        function_name,
                        function_args,
                        tool_context
                    )
                    
                    tool_results.append({
                        "tool": function_name,
                        "result": result
                    })
                    
                    # Add tool result to messages
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "name": function_name,
                        "content": json.dumps(result)
                    })
                
                # Continue loop to get final response after tool execution
                continue
            
            # No more tool calls, return the response
            if isinstance(response, str):
                # Add tool results context if any tools were used
                if tool_results:
                    logger.info(f"Chat completed with {len(tool_results)} tool execution(s)")
                else:
                    logger.info(f"Chat response generated using {config.provider} provider")
                return response
            else:
                logger.warning(f"Unexpected response format: {type(response)}")
                return "Error: Unexpected response format from AI"
        
        # Max iterations reached
        logger.warning(f"Max tool iterations ({max_tool_iterations}) reached")
        return "I've completed the requested actions. Is there anything else you'd like me to help with?"

    except Exception as e:
        logger.error(f"Chat completion failed: {e}", exc_info=True)
        return f"Error: Could not get a response from the AI. {str(e)}"
