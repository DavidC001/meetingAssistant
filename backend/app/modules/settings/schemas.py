from datetime import datetime

from pydantic import BaseModel


class APIKeyBase(BaseModel):
    name: str
    provider: str
    environment_variable: str
    description: str | None = None
    is_active: bool = True


class APIKeyCreate(APIKeyBase):
    key_value: str | None = None


class APIKeyUpdate(BaseModel):
    name: str | None = None
    provider: str | None = None
    environment_variable: str | None = None
    description: str | None = None
    is_active: bool | None = None
    key_value: str | None = None


class APIKey(APIKeyBase):
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
    masked_value: str | None = None
    is_environment_key: bool = False

    class Config:
        from_attributes = True


class ModelConfigurationBase(BaseModel):
    name: str
    whisper_model: str = "base"
    whisper_provider: str = "faster-whisper"
    chat_provider: str = "openai"
    chat_model: str = "gpt-4o-mini"
    chat_base_url: str | None = None
    chat_api_key_id: int | None = None
    analysis_provider: str = "openai"
    analysis_model: str = "gpt-4o-mini"
    analysis_base_url: str | None = None
    analysis_api_key_id: int | None = None
    max_tokens: int = 4000
    max_reasoning_depth: int = 3
    is_default: bool = False


class ModelConfigurationCreate(ModelConfigurationBase):
    pass


class ModelConfigurationUpdate(BaseModel):
    name: str | None = None
    whisper_model: str | None = None
    whisper_provider: str | None = None
    chat_provider: str | None = None
    chat_model: str | None = None
    chat_base_url: str | None = None
    chat_api_key_id: int | None = None
    analysis_provider: str | None = None
    analysis_model: str | None = None
    analysis_base_url: str | None = None
    analysis_api_key_id: int | None = None
    max_tokens: int | None = None
    max_reasoning_depth: int | None = None
    is_default: bool | None = None


class ModelConfiguration(ModelConfigurationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    chat_api_key: APIKey | None = None
    analysis_api_key: APIKey | None = None

    class Config:
        from_attributes = True


class EmbeddingConfigurationBase(BaseModel):
    provider: str
    model_name: str
    dimension: int
    base_url: str | None = None
    api_key_id: int | None = None
    settings: dict | None = None
    is_active: bool = True


class EmbeddingConfigurationCreate(EmbeddingConfigurationBase):
    pass


class EmbeddingConfigurationUpdate(BaseModel):
    provider: str | None = None
    model_name: str | None = None
    dimension: int | None = None
    base_url: str | None = None
    api_key_id: int | None = None
    settings: dict | None = None
    is_active: bool | None = None


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
