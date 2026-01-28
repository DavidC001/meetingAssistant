"""
Integration tests for Chat API endpoints.
"""

import pytest
from fastapi import status


@pytest.mark.integration
@pytest.mark.api
class TestChatAPI:
    """Integration tests for chat endpoints."""

    def test_get_chat_history_empty(self, client, sample_meeting):
        """Test getting chat history when no messages exist."""
        response = client.get(f"/api/v1/meetings/{sample_meeting.id}/chat")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_post_chat_message(self, client, sample_meeting, mock_openai):
        """Test posting a chat message."""
        message_data = {"message": "What was discussed in this meeting?"}

        response = client.post(f"/api/v1/meetings/{sample_meeting.id}/chat", json=message_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "content" in data
        assert "role" in data
        assert data["role"] == "assistant"

    def test_clear_chat_history(self, client, sample_meeting, db):
        """Test clearing chat history."""
        # First, add some messages
        from app.modules.chat.service import ChatService

        service = ChatService(db)
        service.create_message(sample_meeting.id, "user", "Test message 1")
        service.create_message(sample_meeting.id, "assistant", "Test response 1")

        # Clear the history
        response = client.delete(f"/api/v1/meetings/{sample_meeting.id}/chat")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data

        # Verify history is cleared
        get_response = client.get(f"/api/v1/meetings/{sample_meeting.id}/chat")
        assert get_response.status_code == status.HTTP_200_OK
        assert len(get_response.json()) == 0


@pytest.mark.integration
@pytest.mark.api
class TestGlobalChatAPI:
    """Integration tests for global chat endpoints."""

    def test_create_global_chat_session(self, client):
        """Test creating a new global chat session."""
        session_data = {"title": "Test Session", "tags": "test,demo"}

        response = client.post("/api/v1/global-chat/sessions", json=session_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["title"] == "Test Session"
        assert data["tags"] == "test,demo"
        assert "id" in data

    def test_list_global_chat_sessions_empty(self, client):
        """Test listing sessions when none exist."""
        response = client.get("/api/v1/global-chat/sessions")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_list_global_chat_sessions_with_data(self, client, db):
        """Test listing sessions with data."""
        # Create a session first
        from app.modules.chat.service import GlobalChatService

        service = GlobalChatService(db)
        session = service.create_session(title="Test Session")

        response = client.get("/api/v1/global-chat/sessions")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == session.id
        assert data[0]["title"] == "Test Session"

    def test_get_global_chat_session(self, client, db):
        """Test getting a specific session."""
        # Create a session
        from app.modules.chat.service import GlobalChatService

        service = GlobalChatService(db)
        session = service.create_session(title="Test Session")
        service.add_message(session.id, "user", "Test message")

        response = client.get(f"/api/v1/global-chat/sessions/{session.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["session"]["id"] == session.id
        assert "messages" in data
        assert len(data["messages"]) == 1

    def test_update_global_chat_session(self, client, db):
        """Test updating a session."""
        # Create a session
        from app.modules.chat.service import GlobalChatService

        service = GlobalChatService(db)
        session = service.create_session(title="Original Title")

        update_data = {"title": "Updated Title", "tags": "updated"}

        response = client.put(f"/api/v1/global-chat/sessions/{session.id}", json=update_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["tags"] == "updated"

    def test_delete_global_chat_session(self, client, db):
        """Test deleting a session."""
        # Create a session
        from app.modules.chat.service import GlobalChatService

        service = GlobalChatService(db)
        session = service.create_session(title="To Delete")

        response = client.delete(f"/api/v1/global-chat/sessions/{session.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "deleted"

        # Verify it's deleted
        get_response = client.get(f"/api/v1/global-chat/sessions/{session.id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_send_global_chat_message(self, client, db, sample_meeting, mock_openai, mock_embeddings):
        """Test sending a message in a global chat session."""
        # Create a session
        from app.modules.chat.service import GlobalChatService

        service = GlobalChatService(db)
        session = service.create_session(title="Test Session")

        message_data = {"message": "What meetings have been scheduled?", "top_k": 5}

        response = client.post(f"/api/v1/global-chat/sessions/{session.id}/messages", json=message_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "content" in data
        assert "role" in data
        assert data["role"] == "assistant"

    def test_get_available_folders(self, client, sample_meeting):
        """Test getting available folders for filtering."""
        response = client.get("/api/v1/global-chat/filters/folders")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    def test_get_available_tags(self, client, sample_meeting):
        """Test getting available tags for filtering."""
        response = client.get("/api/v1/global-chat/filters/tags")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
