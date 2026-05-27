"""
Project chat service — manages chat sessions and AI-powered project conversations.

Extracted from ProjectService to keep the main service focused on project lifecycle.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ....core.llm import chat as llm_chat
from ....core.llm.providers import ProviderFactory
from ....core.storage import rag
from ....modules.settings.service import SettingsService
from .. import schemas


class ProjectChatService:
    """Handles project chat sessions and AI-powered conversations."""

    def __init__(self, db: Session, chat_repository, project_repository):
        self.db = db
        self.chat_repository = chat_repository
        self.project_repository = project_repository

    # -- Sessions -------------------------------------------------------- #

    def list_sessions(self, project_id: int) -> list[schemas.ProjectChatSession]:
        sessions = self.chat_repository.list_sessions(project_id)
        result = []
        for session in sessions:
            messages = self.chat_repository.list_messages(session.id)
            result.append(
                schemas.ProjectChatSession(
                    id=session.id,
                    project_id=session.project_id,
                    title=session.title,
                    created_at=session.created_at,
                    updated_at=session.updated_at,
                    message_count=len(messages),
                )
            )
        return result

    def create_session(
        self, project_id: int, session_data: schemas.ProjectChatSessionCreate
    ) -> schemas.ProjectChatSession:
        session = self.chat_repository.create_session(project_id, session_data.title)
        return schemas.ProjectChatSession(
            id=session.id,
            project_id=session.project_id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=0,
        )

    def update_session(
        self, project_id: int, session_id: int, payload: schemas.ProjectChatSessionUpdate
    ) -> schemas.ProjectChatSession:
        session = self.chat_repository.get_session(session_id)
        if not session or session.project_id != project_id:
            raise HTTPException(status_code=404, detail="Chat session not found")
        updated = self.chat_repository.update_session(session, title=payload.title)
        messages = self.chat_repository.list_messages(session.id)
        return schemas.ProjectChatSession(
            id=updated.id,
            project_id=updated.project_id,
            title=updated.title,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
            message_count=len(messages),
        )

    def delete_session(self, project_id: int, session_id: int) -> None:
        session = self.chat_repository.get_session(session_id)
        if not session or session.project_id != project_id:
            raise HTTPException(status_code=404, detail="Chat session not found")
        self.chat_repository.delete_session(session)

    def list_messages(self, project_id: int, session_id: int) -> list[schemas.ProjectChatMessage]:
        session = self.chat_repository.get_session(session_id)
        if not session or session.project_id != project_id:
            raise HTTPException(status_code=404, detail="Chat session not found")
        messages = self.chat_repository.list_messages(session_id)
        return [schemas.ProjectChatMessage.model_validate(m) for m in messages]

    # -- Chat ------------------------------------------------------------ #

    async def chat_with_project(
        self,
        project_id: int,
        request: schemas.ProjectChatRequest,
        meeting_ids: list[int],
    ) -> schemas.ProjectChatResponse:
        """Chat with AI about a project (RAG over all project meetings)."""
        session_id = request.session_id
        if session_id:
            session = self.chat_repository.get_session(session_id)
            if not session or session.project_id != project_id:
                raise HTTPException(status_code=404, detail="Chat session not found")
        else:
            title = (request.message or "New chat").strip()
            if len(title) > 60:
                title = f"{title[:57]}..."
            session = self.chat_repository.create_session(project_id, title=title or "New chat")
            session_id = session.id

        if session.title in (None, "", "New chat"):
            existing_messages = self.chat_repository.list_messages(session_id)
            if not existing_messages:
                title_candidate = await self._generate_chat_title(request.message)
                self.chat_repository.update_session(session, title=title_candidate)

        self.chat_repository.create_message(session_id, role="user", content=request.message)

        history_messages = self.chat_repository.list_messages(session_id)
        chat_history = [
            {"role": m.role, "content": m.content} for m in history_messages[-6:]
        ]

        model_config = SettingsService(self.db).get_default_model_configuration()
        llm_config = None
        if model_config:
            llm_config = llm_chat.model_config_to_llm_config(model_config, use_analysis=False)

        response_text, sources, follow_ups = await rag.generate_project_rag_response(
            self.db,
            query=request.message,
            project_id=project_id,
            meeting_ids=meeting_ids,
            chat_history=chat_history,
            top_k=5,
            llm_config=llm_config,
        )

        self.chat_repository.create_message(
            session_id, role="assistant", content=response_text, sources=sources
        )

        return schemas.ProjectChatResponse(
            session_id=session_id,
            message=response_text,
            sources=sources,
            follow_up_suggestions=follow_ups or [],
        )

    async def _generate_chat_title(self, message: str) -> str:
        """Generate a short, descriptive chat title via LLM."""
        title_fallback = (message or "").strip()
        if not title_fallback:
            return "New chat"
        if len(title_fallback) > 60:
            title_fallback = f"{title_fallback[:57]}..."

        try:
            model_config = SettingsService(self.db).get_default_model_configuration()
            llm_config = None
            if model_config:
                llm_config = llm_chat.model_config_to_llm_config(model_config, use_analysis=False)
            if llm_config is None:
                llm_config = llm_chat.get_default_chat_config()

            provider = ProviderFactory.create_provider(llm_config)
            system_prompt = (
                "Create a short, descriptive chat title (3-6 words). "
                "Return only the title, no quotes or punctuation."
            )
            response = await provider.chat_completion(
                messages=[{"role": "user", "content": message}],
                system_prompt=system_prompt,
            )
            if isinstance(response, dict):
                response = response.get("message", "")
            title = (response or "").strip().strip('"').strip("'")
            if not title:
                return title_fallback
            if len(title) > 60:
                return f"{title[:57]}..."
            return title
        except Exception:
            return title_fallback
