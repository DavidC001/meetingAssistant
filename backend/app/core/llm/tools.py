"""
Tool definitions and handlers for LLM chat capabilities.
Provides functions that the LLM can call to interact with the meeting assistant system.
"""

import logging
from collections.abc import Callable
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ...modules.meetings import crud, schemas

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Registry for available tools that the LLM can use"""

    def __init__(self):
        self._tools: dict[str, dict[str, Any]] = {}
        self._handlers: dict[str, Callable] = {}
        self._register_default_tools()

    def register_tool(self, name: str, definition: dict[str, Any], handler: Callable):
        """Register a new tool with its definition and handler"""
        self._tools[name] = definition
        self._handlers[name] = handler
        logger.debug(f"Registered tool: {name}")

    def get_tool_definitions(self) -> list[dict[str, Any]]:
        """Get all tool definitions in OpenAI function calling format"""
        return list(self._tools.values())

    async def execute_tool(self, name: str, arguments: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool by name with given arguments"""
        if name not in self._handlers:
            return {"error": f"Tool {name} not found"}

        try:
            handler = self._handlers[name]
            result = await handler(arguments, context)
            return {"success": True, "result": result}
        except Exception as e:
            logger.error(f"Error executing tool {name}: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    def _register_default_tools(self):
        """Register all default tools"""

        # Tool: Create Action Item
        self.register_tool(
            name="create_action_item",
            definition={
                "type": "function",
                "function": {
                    "name": "create_action_item",
                    "description": "Create a new action item for the current meeting. Use this when the user asks to create a task, todo, or action item.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "task": {"type": "string", "description": "The task description or action to be taken"},
                            "owner": {
                                "type": "string",
                                "description": "The person responsible for this action item (optional)",
                            },
                            "due_date": {"type": "string", "description": "Due date in YYYY-MM-DD format (optional)"},
                            "priority": {
                                "type": "string",
                                "enum": ["low", "medium", "high", "critical"],
                                "description": "Priority level of the action item (optional)",
                            },
                            "notes": {
                                "type": "string",
                                "description": "Additional notes or context for the action item (optional)",
                            },
                        },
                        "required": ["task"],
                    },
                },
            },
            handler=self._handle_create_action_item,
        )

        # Tool: Update Action Item
        self.register_tool(
            name="update_action_item",
            definition={
                "type": "function",
                "function": {
                    "name": "update_action_item",
                    "description": "Update an existing action item. Use this when the user wants to modify, update, or change an action item's details.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "item_id": {"type": "integer", "description": "The ID of the action item to update"},
                            "task": {"type": "string", "description": "Updated task description (optional)"},
                            "owner": {"type": "string", "description": "Updated owner name (optional)"},
                            "due_date": {
                                "type": "string",
                                "description": "Updated due date in YYYY-MM-DD format (optional)",
                            },
                            "status": {
                                "type": "string",
                                "enum": ["pending", "in_progress", "completed", "cancelled"],
                                "description": "Updated status (optional)",
                            },
                            "priority": {
                                "type": "string",
                                "enum": ["low", "medium", "high", "critical"],
                                "description": "Updated priority (optional)",
                            },
                            "notes": {"type": "string", "description": "Updated notes (optional)"},
                        },
                        "required": ["item_id"],
                    },
                },
            },
            handler=self._handle_update_action_item,
        )

        # Tool: List Action Items
        self.register_tool(
            name="list_action_items",
            definition={
                "type": "function",
                "function": {
                    "name": "list_action_items",
                    "description": "List all action items for the current meeting. Use this when the user asks to see, show, or list action items or tasks.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "status_filter": {
                                "type": "string",
                                "enum": ["all", "pending", "in_progress", "completed", "cancelled"],
                                "description": "Filter action items by status (optional, defaults to 'all')",
                            }
                        },
                    },
                },
            },
            handler=self._handle_list_action_items,
        )

        # Tool: Add Note to Meeting
        self.register_tool(
            name="add_note_to_meeting",
            definition={
                "type": "function",
                "function": {
                    "name": "add_note_to_meeting",
                    "description": "Add or append notes to the current meeting. Use this when the user wants to add notes, comments, or additional information to the meeting record.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "note_content": {"type": "string", "description": "The note content to add to the meeting"},
                            "append": {
                                "type": "boolean",
                                "description": "If true, append to existing notes; if false, replace existing notes (optional, defaults to true)",
                            },
                        },
                        "required": ["note_content"],
                    },
                },
            },
            handler=self._handle_add_note_to_meeting,
        )

        # Tool: Update Meeting Details
        self.register_tool(
            name="update_meeting_details",
            definition={
                "type": "function",
                "function": {
                    "name": "update_meeting_details",
                    "description": "Update meeting metadata such as date, topic, or folder. Use this when the user wants to change meeting details or organize meetings.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "meeting_date": {
                                "type": "string",
                                "description": "Meeting date in ISO format (YYYY-MM-DDTHH:MM:SS) (optional)",
                            },
                            "filename": {"type": "string", "description": "Updated meeting name or title (optional)"},
                            "tags": {
                                "type": "string",
                                "description": "Comma-separated tags for organizing the meeting (optional)",
                            },
                            "folder": {
                                "type": "string",
                                "description": "Folder or category for organizing the meeting (optional)",
                            },
                        },
                    },
                },
            },
            handler=self._handle_update_meeting_details,
        )

        # Tool: Search Meeting Content
        self.register_tool(
            name="search_meeting_content",
            definition={
                "type": "function",
                "function": {
                    "name": "search_meeting_content",
                    "description": "Search for specific content, topics, or keywords within the meeting transcript. Use this when the user asks to find, search, or locate specific information in the meeting.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "search_query": {
                                "type": "string",
                                "description": "The search query or keywords to find in the meeting transcript",
                            },
                            "max_results": {
                                "type": "integer",
                                "description": "Maximum number of results to return (optional, defaults to 5)",
                            },
                        },
                        "required": ["search_query"],
                    },
                },
            },
            handler=self._handle_search_meeting_content,
        )

        # Tool: Get Meeting Summary
        self.register_tool(
            name="get_meeting_summary",
            definition={
                "type": "function",
                "function": {
                    "name": "get_meeting_summary",
                    "description": "Get the AI-generated summary of the meeting. Use this when the user asks for a summary, overview, or recap of the meeting.",
                    "parameters": {"type": "object", "properties": {}},
                },
            },
            handler=self._handle_get_meeting_summary,
        )

        # Tool: Get Meeting Speakers
        self.register_tool(
            name="get_meeting_speakers",
            definition={
                "type": "function",
                "function": {
                    "name": "get_meeting_speakers",
                    "description": "Get the list of speakers who participated in the meeting. Use this when the user asks about participants, attendees, or speakers.",
                    "parameters": {"type": "object", "properties": {}},
                },
            },
            handler=self._handle_get_meeting_speakers,
        )

        # Tool: Iterative Research
        self.register_tool(
            name="iterative_research",
            definition={
                "type": "function",
                "function": {
                    "name": "iterative_research",
                    "description": "Perform deep research on a complex question by iteratively generating follow-up questions and retrieving sources until reaching a satisfactory answer. Use this when the user asks for in-depth analysis, comprehensive research, or when a question requires multiple steps to answer thoroughly.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "question": {
                                "type": "string",
                                "description": "The research question to investigate deeply",
                            },
                            "max_depth": {
                                "type": "integer",
                                "description": "Maximum number of research steps to perform (1-10, defaults to 3)",
                                "minimum": 1,
                                "maximum": 10,
                            },
                        },
                        "required": ["question"],
                    },
                },
            },
            handler=self._handle_iterative_research,
        )

    # Tool Handlers

    async def _handle_create_action_item(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for creating action items"""
        db: Session = context["db"]
        meeting_id: int = context["meeting_id"]

        # Get the transcription ID
        meeting = crud.get_meeting(db, meeting_id)
        if not meeting or not meeting.transcription:
            return "Error: Meeting or transcription not found"

        # Create action item
        action_item_data = schemas.ActionItemCreate(
            task=args["task"],
            owner=args.get("owner"),
            due_date=args.get("due_date"),
            priority=args.get("priority"),
            notes=args.get("notes"),
        )

        action_item = crud.create_action_item(
            db, transcription_id=meeting.transcription.id, action_item=action_item_data, is_manual=True
        )

        return f"Action item created successfully with ID {action_item.id}: '{action_item.task}'"

    async def _handle_update_action_item(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for updating action items"""
        db: Session = context["db"]
        item_id: int = args["item_id"]

        # Build update data
        update_data = schemas.ActionItemUpdate(
            task=args.get("task"),
            owner=args.get("owner"),
            due_date=args.get("due_date"),
            status=args.get("status"),
            priority=args.get("priority"),
            notes=args.get("notes"),
        )

        updated_item = crud.update_action_item(db, item_id, update_data)
        if not updated_item:
            return f"Error: Action item with ID {item_id} not found"

        return f"Action item {item_id} updated successfully: '{updated_item.task}'"

    async def _handle_list_action_items(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for listing action items"""
        db: Session = context["db"]
        meeting_id: int = context["meeting_id"]

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting or not meeting.transcription:
            return "No action items found - meeting or transcription not available"

        action_items = meeting.transcription.action_items
        status_filter = args.get("status_filter", "all")

        if status_filter != "all":
            action_items = [item for item in action_items if item.status == status_filter]

        if not action_items:
            return f"No action items found with status: {status_filter}"

        result = f"Found {len(action_items)} action item(s):\n\n"
        for item in action_items:
            result += f"- ID: {item.id}\n"
            result += f"  Task: {item.task}\n"
            result += f"  Status: {item.status}\n"
            if item.owner:
                result += f"  Owner: {item.owner}\n"
            if item.due_date:
                result += f"  Due: {item.due_date}\n"
            if item.priority:
                result += f"  Priority: {item.priority}\n"
            result += "\n"

        return result

    async def _handle_add_note_to_meeting(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for adding notes to meeting"""
        db: Session = context["db"]
        meeting_id: int = context["meeting_id"]

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            return "Error: Meeting not found"

        note_content = args["note_content"]
        append = args.get("append", True)

        if append and meeting.notes:
            # Append to existing notes with timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            meeting.notes = f"{meeting.notes}\n\n[{timestamp}] {note_content}"
        else:
            meeting.notes = note_content

        db.commit()

        # Trigger embedding computation for the updated notes
        try:
            from ..tasks import compute_embeddings_for_meeting

            compute_embeddings_for_meeting.delay(meeting_id)
        except Exception as e:
            logger.warning(f"Could not trigger embedding computation: {e}")

        action = "appended to" if append else "updated for"
        return f"Note {action} the meeting successfully"

    async def _handle_update_meeting_details(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for updating meeting details"""
        db: Session = context["db"]
        meeting_id: int = context["meeting_id"]

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            return "Error: Meeting not found"

        updated_fields = []

        if "meeting_date" in args:
            try:
                meeting.meeting_date = datetime.fromisoformat(args["meeting_date"])
                updated_fields.append("date")
            except ValueError:
                return "Error: Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"

        if "filename" in args:
            meeting.filename = args["filename"]
            updated_fields.append("name")

        if "tags" in args:
            meeting.tags = args["tags"]
            updated_fields.append("tags")

        if "folder" in args:
            meeting.folder = args["folder"]
            updated_fields.append("folder")

        if not updated_fields:
            return "No fields were updated"

        db.commit()

        return f"Meeting details updated successfully: {', '.join(updated_fields)}"

    async def _handle_search_meeting_content(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for searching meeting content"""
        db: Session = context["db"]
        meeting_id: int = context["meeting_id"]

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting or not meeting.transcription:
            return "Error: Meeting transcript not available"

        search_query = args["search_query"].lower()
        max_results = args.get("max_results", 5)
        transcript = meeting.transcription.full_text

        # Simple search: find sentences containing the query
        sentences = transcript.split(". ")
        matches = []

        for sentence in sentences:
            if search_query in sentence.lower():
                matches.append(sentence.strip())
                if len(matches) >= max_results:
                    break

        if not matches:
            return f"No matches found for '{search_query}' in the meeting transcript"

        result = f"Found {len(matches)} match(es) for '{search_query}':\n\n"
        for i, match in enumerate(matches, 1):
            result += f"{i}. ...{match}...\n\n"

        return result

    async def _handle_get_meeting_summary(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for getting meeting summary"""
        db: Session = context["db"]
        meeting_id: int = context["meeting_id"]

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting or not meeting.transcription:
            return "Error: Meeting summary not available"

        summary = meeting.transcription.summary
        if not summary:
            return "No summary available for this meeting"

        return f"Meeting Summary:\n\n{summary}"

    async def _handle_get_meeting_speakers(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for getting meeting speakers"""
        db: Session = context["db"]
        meeting_id: int = context["meeting_id"]

        meeting = crud.get_meeting(db, meeting_id)
        if not meeting:
            return "Error: Meeting not found"

        speakers = meeting.speakers
        if not speakers:
            return "No speaker information available for this meeting"

        result = f"Meeting Participants ({len(speakers)} speaker(s)):\n\n"
        for speaker in speakers:
            result += f"- {speaker.name}"
            if speaker.label:
                result += f" ({speaker.label})"
            result += "\n"

        return result

    async def _handle_iterative_research(self, args: dict[str, Any], context: dict[str, Any]) -> str:
        """Handler for iterative research with multi-step reasoning.

        This tool performs deep research by:
        1. Taking an initial question
        2. Retrieving relevant sources
        3. Analyzing results and generating follow-up questions
        4. Repeating the process until reaching a satisfactory answer or depth limit

        Returns a structured response showing the reasoning chain.
        """
        from ..storage import rag

        db: Session = context["db"]
        meeting_id: int | None = context.get("meeting_id")
        llm_config = context.get("llm_config")

        initial_question = args["question"]
        max_depth = args.get("max_depth", 3)

        # Validate max_depth
        if max_depth < 1:
            max_depth = 1
        elif max_depth > 10:
            max_depth = 10  # Safety limit

        reasoning_chain = []
        current_question = initial_question

        logger.info(f"Starting iterative research with max_depth={max_depth}")

        for step in range(max_depth):
            logger.info(f"Iterative research step {step + 1}/{max_depth}: {current_question}")

            # Retrieve relevant sources for current question
            try:
                chunks = rag.retrieve_relevant_chunks(db, query=current_question, meeting_id=meeting_id, top_k=5)

                sources_text = rag._format_context(chunks)
                source_summaries = [
                    {
                        "meeting_id": chunk.chunk.meeting_id,
                        "content_type": chunk.chunk.content_type,
                        "snippet": chunk.chunk.content[:150] + "..."
                        if len(chunk.chunk.content) > 150
                        else chunk.chunk.content,
                        "similarity": chunk.similarity,
                    }
                    for chunk in chunks[:3]  # Include top 3 sources
                ]

            except Exception as e:
                logger.error(f"Error retrieving sources in iterative research: {e}", exc_info=True)
                sources_text = "Error retrieving sources"
                source_summaries = []

            # Analyze the sources and determine if we need to go deeper
            analysis_prompt = f"""Based on the following sources, analyze the answer to this question: "{current_question}"

Sources:
{sources_text}

Provide:
1. A concise answer based on the sources (2-3 sentences)
2. Your confidence in the answer (low/medium/high)
3. If confidence is not high AND we haven't reached the depth limit, suggest ONE specific follow-up question that would help get a better answer. If confidence is high or we're at the limit, say "COMPLETE".

Format your response as:
ANSWER: [your answer]
CONFIDENCE: [low/medium/high]
FOLLOW_UP: [next question or "COMPLETE"]"""

            try:
                # Use the chat provider to analyze
                from . import chat

                if not llm_config:
                    llm_config = chat.get_default_chat_config()

                provider = chat.ProviderFactory.create_provider(llm_config)
                analysis_response = await provider.chat_completion(
                    messages=[{"role": "user", "content": analysis_prompt}],
                    system_prompt="You are a research assistant analyzing information to answer questions. Be concise and specific.",
                )

                # Parse the response
                answer_line = ""
                confidence_line = ""
                follow_up_line = ""

                for line in analysis_response.split("\n"):
                    if line.startswith("ANSWER:"):
                        answer_line = line.replace("ANSWER:", "").strip()
                    elif line.startswith("CONFIDENCE:"):
                        confidence_line = line.replace("CONFIDENCE:", "").strip()
                    elif line.startswith("FOLLOW_UP:"):
                        follow_up_line = line.replace("FOLLOW_UP:", "").strip()

                step_info = {
                    "step": step + 1,
                    "question": current_question,
                    "answer": answer_line or "Unable to determine answer",
                    "confidence": confidence_line or "unknown",
                    "sources": source_summaries,
                    "follow_up": follow_up_line or "COMPLETE",
                }

                reasoning_chain.append(step_info)

                # Check if we should continue
                if follow_up_line.upper() == "COMPLETE" or not follow_up_line or step == max_depth - 1:
                    logger.info(f"Iterative research complete at step {step + 1}")
                    break

                # Use the follow-up question for next iteration
                current_question = follow_up_line

            except Exception as e:
                logger.error(f"Error in iterative research analysis: {e}", exc_info=True)
                reasoning_chain.append(
                    {
                        "step": step + 1,
                        "question": current_question,
                        "answer": f"Error during analysis: {str(e)}",
                        "confidence": "low",
                        "sources": source_summaries,
                        "follow_up": "COMPLETE",
                    }
                )
                break

        # Format the final response
        result = "🔍 **Iterative Research Results**\n\n"
        result += f"**Initial Question:** {initial_question}\n"
        result += f"**Research Depth:** {len(reasoning_chain)} step(s)\n\n"

        for step_info in reasoning_chain:
            result += f"### Step {step_info['step']}: {step_info['question']}\n\n"
            result += f"**Answer:** {step_info['answer']}\n\n"
            result += f"**Confidence:** {step_info['confidence']}\n\n"

            if step_info["sources"]:
                result += f"**Sources:** {len(step_info['sources'])} relevant chunks found\n\n"

            if step_info["follow_up"] and step_info["follow_up"].upper() != "COMPLETE":
                result += f"**Follow-up:** {step_info['follow_up']}\n\n"

            result += "---\n\n"

        # Add final conclusion
        final_answer = reasoning_chain[-1]["answer"] if reasoning_chain else "No conclusion reached"
        result += f"### Final Conclusion\n\n{final_answer}\n"

        return result


# Global tool registry instance
tool_registry = ToolRegistry()
