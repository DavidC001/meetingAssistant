from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ...database import Base

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    meeting = relationship("Meeting", back_populates="chat_messages")

    __table_args__ = (
        Index('idx_chat_meeting_created', 'meeting_id', 'created_at'),
    )

class GlobalChatSession(Base):
    __tablename__ = "global_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, default="New chat")
    tags = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)
    
    filter_folder = Column(String, nullable=True)
    filter_tags = Column(String, nullable=True)

    messages = relationship("GlobalChatMessage", back_populates="session", cascade="all, delete-orphan")

class GlobalChatMessage(Base):
    __tablename__ = "global_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("global_chat_sessions.id"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("GlobalChatSession", back_populates="messages")

    __table_args__ = (
        Index('idx_global_chat_session_created', 'session_id', 'created_at'),
    )
