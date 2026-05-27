"""
Chat service for meeting-specific chat operations.

Extracted from MeetingService to keep the service layer focused on
meeting lifecycle rather than chat interactions.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ...core.llm import chat as llm_chat
from ...core.storage import rag
from ..chat import schemas as chat_schemas
from ..chat.repository import ChatMessageRepository
from ..settings.service import SettingsService


class MeetingChatService:
    """Handles chat operations scoped to a specific meeting."""

    def __init__(self, db: Session):
        self.db = db

    async def chat_with_meeting(
        self,
        meeting_id: int,
        request: "chat_schemas.ChatRequest",
        transcription_text: str | None = None,
        model_configuration_id: int | None = None,
    ) -> "chat_schemas.ChatResponse":
        """Generate a RAG-based chat response for a meeting transcript."""
        if not transcription_text:
            raise HTTPException(
                status_code=404, detail="Transcription not available for this meeting"
            )

        chat_msg_repo = ChatMessageRepository(self.db)
        chat_msg_repo.create_message(meeting_id, "user", request.query)
        chat_history = request.chat_history or []

        settings_svc = SettingsService(self.db)
        model_config = None
        if model_configuration_id:
            model_config = settings_svc.get_model_configuration(model_configuration_id)
        if not model_config:
            model_config = settings_svc.get_default_model_configuration()

        llm_config = None
        if model_config:
            llm_config = llm_chat.model_config_to_llm_config(model_config, use_analysis=False)

        enable_tools = getattr(request, "enable_tools", True)
        response_text, sources, follow_ups = await rag.generate_rag_response(
            self.db,
            query=request.query,
            meeting_id=meeting_id,
            chat_history=chat_history,
            top_k=request.top_k or 5,
            llm_config=llm_config,
            use_full_transcript=request.use_full_transcript or False,
            full_transcript=transcription_text if request.use_full_transcript else None,
            enable_tools=enable_tools,
            allow_iterative_research=True,
        )

        chat_msg_repo.create_message(meeting_id, "assistant", response_text)
        return chat_schemas.ChatResponse(
            response=response_text, sources=sources, follow_up_suggestions=follow_ups
        )

    def get_chat_history(
        self, meeting_id: int, skip: int = 0, limit: int = 100
    ) -> "chat_schemas.ChatHistoryResponse":
        """Retrieve chat history for a meeting."""
        messages = ChatMessageRepository(self.db).get_by_meeting(
            meeting_id, skip=skip, limit=limit
        )
        return chat_schemas.ChatHistoryResponse(history=messages)

    def clear_chat_history(self, meeting_id: int) -> dict:
        """Delete all chat messages for a meeting."""
        ChatMessageRepository(self.db).delete_by_meeting(meeting_id)
        return {"message": "Chat history cleared successfully"}
