from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ...database import Base


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    provider = Column(String, index=True)
    environment_variable = Column(String)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ModelConfiguration(Base):
    __tablename__ = "model_configurations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    whisper_model = Column(String, default="base")
    whisper_provider = Column(String, default="faster-whisper")

    chat_provider = Column(String, default="openai", index=True)
    chat_model = Column(String, default="gpt-4o-mini")
    chat_base_url = Column(String, nullable=True)
    chat_api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=True, index=True)

    analysis_provider = Column(String, default="openai", index=True)
    analysis_model = Column(String, default="gpt-4o-mini")
    analysis_base_url = Column(String, nullable=True)
    analysis_api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=True, index=True)

    max_tokens = Column(Integer, default=4000)
    max_reasoning_depth = Column(Integer, default=3)

    is_default = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    chat_api_key = relationship("APIKey", foreign_keys=[chat_api_key_id])
    analysis_api_key = relationship("APIKey", foreign_keys=[analysis_api_key_id])

    __table_args__ = (Index("idx_model_config_provider_active", "chat_provider", "is_default"),)


class EmbeddingConfiguration(Base):
    __tablename__ = "embedding_configurations"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String, nullable=False, index=True)
    model_name = Column(String, nullable=False)
    dimension = Column(Integer, nullable=False)
    base_url = Column(String, nullable=True)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=True, index=True)
    settings = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    api_key = relationship("APIKey")
    meetings = relationship("Meeting", back_populates="embedding_config")
    document_chunks = relationship("DocumentChunk", back_populates="embedding_config", cascade="all, delete-orphan")

    __table_args__ = (Index("idx_embedding_provider_active", "provider", "is_active"),)


class WorkerConfiguration(Base):
    __tablename__ = "worker_configuration"

    id = Column(Integer, primary_key=True, index=True)
    max_workers = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
