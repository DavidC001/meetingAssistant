import json
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from ..config import config
from .providers import LLMConfig, ProviderFactory
from .tools import tool_registry

logger = logging.getLogger(__name__)

# Separator used to delimit follow-up suggestions in the LLM output
_FOLLOW_UP_SEPARATOR = "|||FOLLOW_UPS|||"


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

    # Get API key from the associated API key configuration or environment
    api_key = None
    api_key_env = None

    if api_key_id:
        # Load the API key configuration from the relationship
        if use_analysis and model_config.analysis_api_key:
            api_key_config = model_config.analysis_api_key
        elif not use_analysis and model_config.chat_api_key:
            api_key_config = model_config.chat_api_key
        else:
            api_key_config = None

        if api_key_config:
            # Get the environment variable name and load the key from environment
            api_key_env = api_key_config.environment_variable
            api_key = config.get_api_key(api_key_env)

    # Fallback to hardcoded OpenAI key if provider is openai and no key found
    if not api_key and provider == "openai":
        api_key = config.get_api_key("OPENAI_API_KEY")

    return LLMConfig(
        provider=provider,
        model=model,
        base_url=base_url,
        api_key=api_key,
        api_key_env=api_key_env,
        max_tokens=model_config.max_tokens,
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
    chat_history: list[dict[str, str]],
    config: LLMConfig | None = None,
    db: Session | None = None,
    meeting_id: int | None = None,
    meeting_ids: list[int] | None = None,
    project_id: int | None = None,
    enable_tools: bool = True,
    max_tool_iterations: int = 15,
    system_prompt_override: str | None = None,
    return_tool_results: bool = False,
    allow_iterative_research: bool = False,
    generate_follow_ups: bool = True,
) -> str | tuple[str, list[dict]] | tuple[str, list[dict], list[str]]:
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
        generate_follow_ups: Whether to generate follow-up suggestions
    """
    try:
        # Use provided config or get default
        if config is None:
            config = get_default_chat_config()

        # Create provider instance
        provider = ProviderFactory.create_provider(config)

        today_str = datetime.now().strftime("%A, %B %d, %Y")

        # Prepare system prompt
        if system_prompt_override and system_prompt_override.strip():
            system_prompt = system_prompt_override.strip()
            if not system_prompt.endswith("\n"):
                system_prompt += "\n"
            system_prompt += f"\nToday's date: {today_str}\n"
        else:
            # Build a rich, context-aware system prompt
            if meeting_id:
                system_prompt = (
                    "You are an AI assistant that helps users understand, analyze, and take action on meeting transcripts. "
                    "You are currently looking at a specific meeting.\n\n"
                    "Guidelines:\n"
                    "- Answer questions accurately using the provided transcript.\n"
                    "- If a question cannot be answered from the transcript, say so clearly.\n"
                    "- Be concise but thorough. Use markdown formatting (bold, lists, headers) for readability.\n"
                    "- When quoting the transcript, use blockquotes.\n"
                    "- When the user asks to create an action item, extract the task, owner, and due date from context if not explicitly provided.\n"
                    "- If a request is ambiguous (e.g. multiple possible owners, unclear scope), ask a clarifying question BEFORE taking action.\n"
                    "\nIMPORTANT — use the right tool for structured data:\n"
                    "- For **action items/tasks**: ALWAYS use list_action_items. Do NOT read or infer action items from transcript text.\n"
                    "- For **deadlines/due dates**: ALWAYS use get_upcoming_deadlines. Do NOT guess deadlines from transcript mentions.\n"
                    "- For **meeting summary**: ALWAYS use get_meeting_summary. Do NOT try to summarize by reading transcript chunks.\n"
                    "- For **speakers/participants**: ALWAYS use get_meeting_speakers. Transcript shows SPEAKER_00/SPEAKER_01 labels — the tool shows real names.\n"
                    "- For **finding meetings by person name**: ALWAYS use list_meetings. Do NOT search transcripts for speaker names.\n"
                    "\nTool chaining patterns — follow these step-by-step examples:\n"
                    "• User asks for a summary or what was discussed → call get_meeting_summary\n"
                    "• User asks who spoke or attended → call get_meeting_speakers\n"
                    "• User asks about deadlines or what is due → call get_upcoming_deadlines(days_ahead=14, include_overdue=true)\n"
                    "• User asks to list tasks or action items → call list_action_items (pass status_filter='pending' or 'completed' if the user specifies)\n"
                    "• User asks about decisions from recent meetings → Step 1: call list_meetings(limit=3) to get recent meetings, Step 2: call get_meeting_summary(meeting_id=<id>) for each returned meeting, Step 3: compile the key decisions\n"
                    "• User asks to find meetings with a person → call list_meetings(search='<person name>')\n"
                    "\nYou can call multiple tools in sequence within one turn. If you need a meeting_id you don't have, call list_meetings first to look it up. NEVER guess IDs.\n"
                    f"\nToday's date: {today_str}\n\n"
                )
            elif project_id:
                system_prompt = (
                    "You are an AI assistant helping manage a project. "
                    "You have access to all meetings, notes, and documents in this project.\n\n"
                    "Guidelines:\n"
                    "- Answer questions using the project context (meetings, notes, action items, milestones).\n"
                    "- You can create action items, notes, and milestones when asked.\n"
                    "- Use markdown formatting for readability.\n"
                    "- If a request is ambiguous (e.g. which meeting to target, unclear action item details), ask a clarifying question BEFORE acting.\n"
                    "- When creating items, confirm what you created with details (ID, task, owner, due date).\n"
                    "\nIMPORTANT — use the right tool for structured data:\n"
                    "- For **action items/tasks**: ALWAYS use list_action_items. Do NOT read or infer from transcript text.\n"
                    "- For **deadlines/due dates**: ALWAYS use get_upcoming_deadlines. Do NOT infer from transcript snippets.\n"
                    "- For **milestones/deliverables**: ALWAYS use list_milestones. Do NOT guess from notes or transcript.\n"
                    "- For **meeting summary**: Use get_meeting_summary with meeting_id (find meeting_id with list_meetings first).\n"
                    "- For **speakers/participants**: Use get_meeting_speakers with meeting_id. Transcript shows SPEAKER_00 labels — the tool shows real names.\n"
                    "- For **finding meetings by person name**: ALWAYS use list_meetings — do NOT search transcripts for speaker names.\n"
                    "- For **project meetings**: Use list_meetings (project_id is auto-scoped).\n"
                    "\nTool chaining patterns — follow these step-by-step examples:\n"
                    "• User asks about decisions from recent meetings → Step 1: call list_meetings(limit=3), Step 2: call get_meeting_summary(meeting_id=<id>) for each, Step 3: compile the key decisions\n"
                    "• User asks who was in the last meeting → Step 1: call list_meetings(limit=1), Step 2: call get_meeting_speakers(meeting_id=<id>)\n"
                    "• User asks to summarize the last meeting → Step 1: call list_meetings(limit=1), Step 2: call get_meeting_summary(meeting_id=<id>)\n"
                    "• User asks about milestones or deliverables → call list_milestones\n"
                    "• User asks about deadlines or what is due → call get_upcoming_deadlines(days_ahead=14, include_overdue=true)\n"
                    "• User asks to list tasks or action items → call list_action_items (pass status_filter if user specifies pending/completed)\n"
                    "• User asks to find meetings with a person → call list_meetings(search='<person name>')\n"
                    "\nYou can call multiple tools in sequence within one turn. If you need a meeting_id, call list_meetings first to look it up. NEVER guess IDs.\n"
                    f"\nToday's date: {today_str}\n\n"
                )
            else:
                system_prompt = (
                    "You are an AI assistant with access to all meetings across the system. "
                    "You can search meeting content, manage action items, organize meetings, and help with project management.\n\n"
                    "Guidelines:\n"
                    "- Use the provided meeting context and your tools to answer questions.\n"
                    "- You can search across all meetings, create/update action items, add notes, manage projects.\n"
                    "- Use markdown formatting for readability.\n"
                    "- If a request is ambiguous (e.g. which meeting to modify, multiple matching results), ask the user to clarify BEFORE taking action.\n"
                    "- When operating on a specific meeting, tell the user which meeting you chose and why.\n"
                    "\nIMPORTANT — use the right tool for structured data:\n"
                    "- For **action items/tasks**: ALWAYS use list_action_items. Do NOT read or infer from transcript text.\n"
                    "- For **deadlines/due dates**: ALWAYS use get_upcoming_deadlines. Do NOT infer from transcript snippets.\n"
                    "- For **meeting summary**: Use get_meeting_summary with meeting_id (find meeting_id with list_meetings first).\n"
                    "- For **speakers/participants**: Use get_meeting_speakers with meeting_id. Transcript shows SPEAKER_00 labels — the tool shows real names.\n"
                    "- For **finding meetings by person name**: ALWAYS use list_meetings — do NOT search transcripts for speaker names.\n"
                    "- For **project info**: First resolve the project with list_projects, then scope with project_id.\n"
                    "- For **milestones**: Use list_milestones with project_id (find project_id with list_projects first).\n"
                    "- For the **last/most recent meeting** for a project: first list_projects → get project_id, then list_meetings with project_id, pick the latest by date.\n"
                    "\nTool chaining patterns — follow these step-by-step examples:\n"
                    "• User asks about deadlines or what is due → call get_upcoming_deadlines(days_ahead=14, include_overdue=true)\n"
                    "• User asks to list tasks or action items → call list_action_items\n"
                    "• User asks about decisions from recent meetings → Step 1: call list_meetings(limit=3), Step 2: call get_meeting_summary(meeting_id=<id>) for each, Step 3: compile the decisions\n"
                    "• User asks about milestones for a project → Step 1: call list_projects() to find the project_id, Step 2: call list_milestones(project_id=<id>)\n"
                    "• User asks who spoke in the last meeting of a project → Step 1: call list_projects(), Step 2: call list_meetings(project_id=<id>, limit=1), Step 3: call get_meeting_speakers(meeting_id=<id>)\n"
                    "• User asks to summarize a meeting by name → Step 1: call list_meetings(search='<name>'), Step 2: call get_meeting_summary(meeting_id=<id>)\n"
                    "• User asks about a specific project's meetings → Step 1: call list_projects(), Step 2: call list_meetings(project_id=<id>)\n"
                    "\nCRITICAL: You can call multiple tools in sequence within one turn. If you need an ID (meeting_id, project_id), look it up with the appropriate list tool first. NEVER guess IDs.\n"
                    f"\nToday's date: {today_str}\n\n"
                )

        if enable_tools and db:
            tool_list = _build_tool_description(meeting_id, project_id)
            system_prompt += (
                "You have access to the following tools:\n"
                f"{tool_list}\n"
                "Use tools when the user asks you to perform actions or when you need more information. "
                "If the user asks something you can answer from context alone, do NOT use tools unnecessarily.\n"
            )

        # Follow-up instruction
        if generate_follow_ups:
            system_prompt += (
                f"\nAt the very end of your response, after your main answer, add a line that starts exactly with '{_FOLLOW_UP_SEPARATOR}' "
                "followed by 2-3 short follow-up questions the user might want to ask next, separated by '|'. "
                "These should be contextual and helpful. Example:\n"
                f"{_FOLLOW_UP_SEPARATOR}What were the next steps discussed?|Who owns the highest-priority items?|Can you create action items from this?\n"
                "If there are no meaningful follow-ups, omit this line entirely.\n"
            )

        # Prepare context message with transcript
        context_message = f"Meeting Transcript:\n\n{transcript}\n\nUser Question: {query}"

        # Prepare messages for the provider
        messages = []

        # Add recent chat history (last 5 messages to avoid context overflow)
        for msg in chat_history[-5:]:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

        # Add current query with context
        messages.append({"role": "user", "content": context_message})

        # Get tool definitions if tools are enabled
        # Note: Some tools (like iterative_research) work without a meeting_id
        # Tool calling is supported by OpenAI and Ollama (0.3.0+ with compatible models)
        tools = None
        if enable_tools and db:
            tools = tool_registry.get_tool_definitions()
            if meeting_id is None:
                allowed_tool_names = {
                    "search_content",
                    "create_action_item",
                    "update_action_item",
                    "list_action_items",
                    "delete_action_item",
                    "add_note_to_meeting",
                    "update_meeting_details",
                    "list_projects",
                    "list_project_notes",
                    "create_project_note",
                    "create_project_milestone",
                    "list_meetings",
                    "get_meeting_details",
                    "get_upcoming_deadlines",
                    "get_meeting_summary",
                    "get_meeting_speakers",
                    "list_milestones",
                }
                tools = [tool for tool in tools if tool.get("function", {}).get("name") in allowed_tool_names]
            if config.provider not in ["openai", "ollama"]:
                logger.warning(
                    f"Tool calling requested with provider '{config.provider}' - compatibility not guaranteed"
                )

        # Tool calling loop
        iteration = 0
        tool_results = []
        executed_tool_signatures: dict[str, dict] = {}

        while iteration < max_tool_iterations:
            iteration += 1

            # Get response from provider
            response = await provider.chat_completion(messages, system_prompt, tools=tools)

            # Check if response contains tool calls
            if isinstance(response, dict) and "tool_calls" in response:
                # Process tool calls
                tool_calls = response["tool_calls"]
                logger.info(f"Processing {len(tool_calls)} tool call(s) (iteration {iteration})")

                # Add assistant message with tool calls to conversation
                messages.append({"role": "assistant", "content": response.get("message", ""), "tool_calls": tool_calls})

                all_repeats = True

                # Execute each tool call
                for tool_call in tool_calls:
                    function_name = tool_call["function"]["name"]
                    function_args = json.loads(tool_call["function"]["arguments"])

                    signature = f"{function_name}:{json.dumps(function_args, sort_keys=True)}"
                    if signature in executed_tool_signatures:
                        cached_result = executed_tool_signatures[signature]
                        tool_results.append({"tool": function_name, "result": cached_result})
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tool_call["id"],
                                "name": function_name,
                                "content": json.dumps(cached_result),
                            }
                        )
                        continue

                    all_repeats = False

                    logger.info(f"Executing tool: {function_name} with args: {function_args}")

                    # Execute the tool
                    tool_context = {
                        "db": db,
                        "meeting_id": meeting_id,
                        "meeting_ids": meeting_ids,
                        "project_id": project_id,
                        "user_query": query,
                        "llm_config": config,
                    }

                    result = await tool_registry.execute_tool(function_name, function_args, tool_context)

                    tool_results.append({"tool": function_name, "result": result})
                    executed_tool_signatures[signature] = result

                    # Add tool result to messages
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "name": function_name,
                            "content": json.dumps(result),
                        }
                    )

                # If every tool call in this iteration was a cached repeat,
                # the model is stuck in a loop. Break out and synthesize.
                if all_repeats:
                    logger.info("All tool calls were repeats — breaking out to synthesize final answer")
                    break

                # Continue loop to get next response after tool execution
                continue

            # No tool calls — this is the final text response
            response_text = ""
            if isinstance(response, str):
                response_text = response
            elif isinstance(response, dict):
                response_text = response.get("message", "") or response.get("content", "")

            if response_text.strip():
                if tool_results:
                    logger.info(f"Chat completed with {len(tool_results)} tool execution(s)")
                else:
                    logger.info(f"Chat response generated using {config.provider} provider")

                response_text, follow_ups = _parse_follow_ups(response_text)
                if return_tool_results:
                    return response_text, tool_results, follow_ups
                return response_text

            # Empty response — fall through to the synthesis below
            logger.warning(f"Empty response at iteration {iteration}, will synthesize")
            break

        # If we reach here, either max iterations or a break occurred.
        # Make one final call WITHOUT tools so the model synthesizes an answer
        # from all the tool results already in the conversation.
        logger.info(f"Generating final synthesis (after {iteration} iteration(s), {len(tool_results)} tool result(s))")
        try:
            final_response = await provider.chat_completion(messages, system_prompt, tools=None)

            final_text = ""
            if isinstance(final_response, str):
                final_text = final_response
            elif isinstance(final_response, dict):
                final_text = final_response.get("message", "") or final_response.get("content", "")

            if final_text.strip():
                response_text, follow_ups = _parse_follow_ups(final_text)
                if return_tool_results:
                    return response_text, tool_results, follow_ups
                return response_text
        except Exception:
            logger.warning("Final synthesis call failed", exc_info=True)

        # Absolute last resort — should rarely happen
        logger.error("All attempts to generate a response failed, returning fallback")
        final_message = "I was unable to compile a response from the tool results. Please try rephrasing your question or asking about fewer meetings at once."
        if return_tool_results:
            return final_message, tool_results, []
        return final_message

    except Exception as e:
        logger.error(f"Chat completion failed: {e}", exc_info=True)
        if return_tool_results:
            return f"Error: Could not get a response from the AI. {str(e)}", tool_results, []
        return f"Error: Could not get a response from the AI. {str(e)}"


def _build_tool_description(meeting_id: int | None, project_id: int | None) -> str:
    """Build a human-readable tool list for the system prompt."""
    lines = []
    if meeting_id:
        lines.append("- **create_action_item**: Create a task/action item for this meeting")
        lines.append("- **update_action_item**: Modify an existing action item (status, owner, due date, priority)")
        lines.append(
            "- **list_action_items**: List action items (optionally filter by status). ALWAYS prefer this over reading transcript text."
        )
        lines.append("- **delete_action_item**: Delete an action item by ID")
        lines.append("- **add_note_to_meeting**: Add or append notes to the meeting record")
        lines.append("- **update_meeting_details**: Change meeting name, date, folder, or tags")
        lines.append("- **search_content**: Search within this meeting's transcript")
        lines.append(
            "- **get_meeting_summary**: Get the AI-generated summary for this meeting. ALWAYS use this instead of trying to summarize from transcript chunks."
        )
        lines.append(
            "- **get_meeting_speakers**: List all meeting participants with real names. ALWAYS use this instead of reading SPEAKER_XX labels from transcript."
        )
        lines.append(
            "- **list_meetings**: Search and list meetings by name, folder, or speaker (PREFERRED for finding meetings by person name)"
        )
        lines.append("- **get_meeting_details**: Get full details about any meeting")
        lines.append("- **get_upcoming_deadlines**: Show upcoming action item deadlines")
    elif project_id:
        lines.append("- **create_action_item**: Create a task for this project or a specific meeting")
        lines.append("- **update_action_item**: Modify an existing action item")
        lines.append(
            "- **list_action_items**: List action items for this project. ALWAYS prefer this over reading transcript text."
        )
        lines.append("- **delete_action_item**: Delete an action item by ID")
        lines.append(
            "- **search_content**: Search across all project meetings (note: speaker names may be anonymized in transcripts)"
        )
        lines.append("- **create_project_note**: Create a note in this project")
        lines.append("- **create_project_milestone**: Create a project milestone")
        lines.append("- **list_milestones**: List all milestones for this project with status and due dates")
        lines.append("- **list_project_notes**: List notes in this project")
        lines.append("- **add_note_to_meeting**: Add notes to a specific meeting")
        lines.append("- **update_meeting_details**: Change meeting details")
        lines.append(
            "- **list_meetings**: Search and list meetings by name, folder, or speaker (PREFERRED for finding meetings by person name)"
        )
        lines.append("- **get_meeting_details**: Get full details about a meeting")
        lines.append("- **get_meeting_summary**: Get the AI-generated summary for a meeting (requires meeting_id)")
        lines.append("- **get_meeting_speakers**: List participants of a meeting (requires meeting_id)")
        lines.append("- **get_upcoming_deadlines**: Show upcoming deadlines")
    else:
        lines.append(
            "- **search_content**: Search across all meeting transcripts (note: speaker names may be anonymized in transcripts)"
        )
        lines.append("- **create_action_item**: Create a task in any meeting or project")
        lines.append("- **update_action_item**: Modify an existing action item")
        lines.append("- **list_action_items**: List action items. ALWAYS prefer this over reading transcript text.")
        lines.append("- **delete_action_item**: Delete an action item by ID")
        lines.append("- **add_note_to_meeting**: Add notes to a meeting")
        lines.append("- **update_meeting_details**: Change meeting details")
        lines.append("- **list_projects**: List all projects (use to resolve project names to IDs)")
        lines.append("- **list_project_notes**: List notes for a project")
        lines.append("- **create_project_note**: Create a project note")
        lines.append("- **create_project_milestone**: Create a project milestone")
        lines.append("- **list_milestones**: List milestones for a project (requires project_id)")
        lines.append(
            "- **list_meetings**: Search and list meetings by name, folder, or speaker (PREFERRED for finding meetings by person name)"
        )
        lines.append("- **get_meeting_details**: Get full details about any meeting")
        lines.append("- **get_meeting_summary**: Get the AI-generated summary for a meeting (requires meeting_id)")
        lines.append("- **get_meeting_speakers**: List participants of a meeting (requires meeting_id)")
        lines.append("- **get_upcoming_deadlines**: Show upcoming action item deadlines")
    return "\n".join(lines)


def _parse_follow_ups(response: str) -> tuple[str, list[str]]:
    """Parse follow-up suggestions from the LLM response.

    Returns (clean_response, follow_up_list).
    """
    if _FOLLOW_UP_SEPARATOR in response:
        parts = response.split(_FOLLOW_UP_SEPARATOR, 1)
        clean_response = parts[0].rstrip()
        raw_follow_ups = parts[1].strip()
        follow_ups = [q.strip() for q in raw_follow_ups.split("|") if q.strip()]
        # Limit to 4 suggestions and clean up any markdown
        follow_ups = follow_ups[:4]
        return clean_response, follow_ups
    return response, []
