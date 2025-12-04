from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class APIKeyBase(BaseModel):
    name: str
    provider: str
    environment_variable: str
    description: Optional[str] = None
    is_active: bool = True

class APIKeyCreate(APIKeyBase):
    key_value: Optional[str] = None

class APIKeyUpdate(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    environment_variable: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    key_value: Optional[str] = None

class APIKey(APIKeyBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    masked_value: Optional[str] = None
    is_environment_key: bool = False

    class Config:
        from_attributes = True

class ModelConfigurationBase(BaseModel):
    name: str
    whisper_model: str = "base"
    whisper_provider: str = "faster-whisper"
    chat_provider: str = "openai"
    chat_model: str = "gpt-4o-mini"
    chat_base_url: Optional[str] = None
    chat_api_key_id: Optional[int] = None
    analysis_provider: str = "openai"
    analysis_model: str = "gpt-4o-mini"
    analysis_base_url: Optional[str] = None
    analysis_api_key_id: Optional[int] = None
    max_tokens: int = 4000
    max_reasoning_depth: int = 3
    is_default: bool = False

class ModelConfigurationCreate(ModelConfigurationBase):
    pass

class ModelConfigurationUpdate(BaseModel):
    name: Optional[str] = None
    whisper_model: Optional[str] = None
    whisper_provider: Optional[str] = None
    chat_provider: Optional[str] = None
    chat_model: Optional[str] = None
    chat_base_url: Optional[str] = None
    chat_api_key_id: Optional[int] = None
    analysis_provider: Optional[str] = None
    analysis_model: Optional[str] = None
    analysis_base_url: Optional[str] = None
    analysis_api_key_id: Optional[int] = None
    max_tokens: Optional[int] = None
    max_reasoning_depth: Optional[int] = None
    is_default: Optional[bool] = None

class ModelConfiguration(ModelConfigurationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    chat_api_key: Optional[APIKey] = None
    analysis_api_key: Optional[APIKey] = None

    class Config:
        from_attributes = True

class EmbeddingConfigurationBase(BaseModel):
    provider: str
    model_name: str
    dimension: int
    base_url: Optional[str] = None
    api_key_id: Optional[int] = None
    settings: Optional[dict] = None
    is_active: bool = True

class EmbeddingConfigurationCreate(EmbeddingConfigurationBase):
    pass

class EmbeddingConfigurationUpdate(BaseModel):
    provider: Optional[str] = None
    model_name: Optional[str] = None
    dimension: Optional[int] = None
    base_url: Optional[str] = None
    api_key_id: Optional[int] = None
    settings: Optional[dict] = None
    is_active: Optional[bool] = None

class EmbeddingConfiguration(EmbeddingConfigurationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkerConfiguration(BaseModel):
    id: int
    max_workers: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WorkerConfigurationUpdate(BaseModel):
    max_workers: int
