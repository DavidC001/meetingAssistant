from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from . import models, schemas

def create_chat_message(db: Session, meeting_id: int, role: str, content: str):
    """Create a new chat message"""
    db_message = models.ChatMessage(
        meeting_id=meeting_id,
        role=role,
        content=content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_chat_history(db: Session, meeting_id: int, skip: int = 0, limit: int = 100):
    """
    Get chat history for a meeting with pagination.
    
    Args:
        db: Database session
        meeting_id: ID of the meeting
        skip: Number of messages to skip (default: 0)
        limit: Maximum number of messages to return (default: 100)
    """
    return db.query(models.ChatMessage).filter(
        models.ChatMessage.meeting_id == meeting_id
    ).order_by(models.ChatMessage.created_at.asc()).offset(skip).limit(limit).all()

def clear_chat_history(db: Session, meeting_id: int):
    """Clear all chat messages for a meeting"""
    db.query(models.ChatMessage).filter(
        models.ChatMessage.meeting_id == meeting_id
    ).delete()
    db.commit()

def list_global_chat_sessions(db: Session, skip: int = 0, limit: int = 100):
    """
    List global chat sessions with pagination.
    
    Args:
        db: Database session
        skip: Number of sessions to skip (default: 0)
        limit: Maximum number of sessions to return (default: 100)
    """
    return db.query(models.GlobalChatSession).order_by(
        models.GlobalChatSession.updated_at.desc()
    ).offset(skip).limit(limit).all()

def create_global_chat_session(db: Session, title: str | None = None, tags: str | None = None, 
                              filter_folder: str | None = None, filter_tags: str | None = None):
    session = models.GlobalChatSession(
        title=title or "New chat", 
        tags=tags,
        filter_folder=filter_folder,
        filter_tags=filter_tags
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def get_global_chat_session(db: Session, session_id: int):
    return db.query(models.GlobalChatSession).filter(models.GlobalChatSession.id == session_id).first()

def delete_global_chat_session(db: Session, session_id: int):
    session = get_global_chat_session(db, session_id)
    if not session:
        return None
    db.delete(session)
    db.commit()
    return session

def update_global_chat_session(db: Session, session_id: int, title: str | None = None, tags: str | None = None,
                              filter_folder: str | None = None, filter_tags: str | None = None):
    session = get_global_chat_session(db, session_id)
    if not session:
        return None
    if title is not None:
        session.title = title
    if tags is not None:
        session.tags = tags
    if filter_folder is not None:
        session.filter_folder = filter_folder
    if filter_tags is not None:
        session.filter_tags = filter_tags
    session.updated_at = func.now()
    db.commit()
    db.refresh(session)
    return session

def add_global_chat_message(db: Session, session_id: int, role: str, content: str, sources: list | None = None):
    message = models.GlobalChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        sources=sources or []
    )
    db.add(message)
    session = get_global_chat_session(db, session_id)
    if session:
        session.updated_at = func.now()
    db.commit()
    db.refresh(message)
    return message

def get_global_chat_messages(db: Session, session_id: int, skip: int = 0, limit: int = 100):
    """
    Get global chat messages for a session with pagination.
    
    Args:
        db: Database session
        session_id: ID of the chat session
        skip: Number of messages to skip (default: 0)
        limit: Maximum number of messages to return (default: 100)
    """
    return (
        db.query(models.GlobalChatMessage)
        .filter(models.GlobalChatMessage.session_id == session_id)
        .order_by(models.GlobalChatMessage.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
