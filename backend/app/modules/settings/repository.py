"""Repository layer for settings database operations."""
from datetime import datetime

from sqlalchemy.orm import Session

from . import models, schemas
from .models_drive import GoogleDriveCredentials, GoogleDriveProcessedFile, GoogleDriveSyncConfig


class SettingsRepository:
    """Repository for all settings-related database operations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # API Keys
    # ------------------------------------------------------------------

    def get_api_keys(self) -> list[models.APIKey]:
        return self.db.query(models.APIKey).filter(models.APIKey.is_active == True).all()

    def get_api_key_by_id(self, key_id: int) -> models.APIKey | None:
        return self.db.query(models.APIKey).filter(models.APIKey.id == key_id).first()

    def get_api_key_by_name(self, name: str) -> models.APIKey | None:
        return self.db.query(models.APIKey).filter(models.APIKey.name == name).first()

    def get_api_keys_by_provider(self, provider: str) -> list[models.APIKey]:
        return (
            self.db.query(models.APIKey)
            .filter(models.APIKey.provider == provider, models.APIKey.is_active == True)
            .all()
        )

    def create_api_key(self, api_key: schemas.APIKeyCreate) -> models.APIKey:
        api_key_data = api_key.dict(exclude={"key_value"})
        db_api_key = models.APIKey(**api_key_data)
        self.db.add(db_api_key)
        self.db.commit()
        self.db.refresh(db_api_key)
        return db_api_key

    def update_api_key(self, key_id: int, api_key_update: schemas.APIKeyUpdate) -> models.APIKey | None:
        db_api_key = self.get_api_key_by_id(key_id)
        if not db_api_key:
            return None
        update_data = api_key_update.dict(exclude_unset=True, exclude={"key_value"})
        for field, value in update_data.items():
            setattr(db_api_key, field, value)
        self.db.commit()
        self.db.refresh(db_api_key)
        return db_api_key

    def deactivate_api_key(self, key_id: int) -> models.APIKey | None:
        db_api_key = self.get_api_key_by_id(key_id)
        if not db_api_key:
            return None
        db_api_key.is_active = False
        self.db.commit()
        return db_api_key

    # ------------------------------------------------------------------
    # Model Configurations
    # ------------------------------------------------------------------

    def get_model_configurations(self) -> list[models.ModelConfiguration]:
        return self.db.query(models.ModelConfiguration).all()

    def get_model_configuration_by_id(self, config_id: int) -> models.ModelConfiguration | None:
        return self.db.query(models.ModelConfiguration).filter(models.ModelConfiguration.id == config_id).first()

    def get_model_configuration_by_name(self, name: str) -> models.ModelConfiguration | None:
        return self.db.query(models.ModelConfiguration).filter(models.ModelConfiguration.name == name).first()

    def get_default_model_configuration(self) -> models.ModelConfiguration | None:
        return self.db.query(models.ModelConfiguration).filter(models.ModelConfiguration.is_default == True).first()

    def create_model_configuration(self, config: schemas.ModelConfigurationCreate) -> models.ModelConfiguration:
        config_dict = config.dict()
        if config_dict.get("chat_api_key_id") and config_dict["chat_api_key_id"] < 0:
            config_dict["chat_api_key_id"] = None
        if config_dict.get("analysis_api_key_id") and config_dict["analysis_api_key_id"] < 0:
            config_dict["analysis_api_key_id"] = None

        db_config = models.ModelConfiguration(**config_dict)

        if config.is_default or not self.get_model_configurations():
            self.db.query(models.ModelConfiguration).update({models.ModelConfiguration.is_default: False})
            db_config.is_default = True

        self.db.add(db_config)
        self.db.commit()
        self.db.refresh(db_config)
        return db_config

    def update_model_configuration(
        self, config_id: int, config_update: schemas.ModelConfigurationUpdate
    ) -> models.ModelConfiguration | None:
        db_config = self.get_model_configuration_by_id(config_id)
        if not db_config:
            return None

        update_data = config_update.dict(exclude_unset=True)
        if "chat_api_key_id" in update_data and update_data["chat_api_key_id"] and update_data["chat_api_key_id"] < 0:
            update_data["chat_api_key_id"] = None
        if (
            "analysis_api_key_id" in update_data
            and update_data["analysis_api_key_id"]
            and update_data["analysis_api_key_id"] < 0
        ):
            update_data["analysis_api_key_id"] = None

        for field, value in update_data.items():
            setattr(db_config, field, value)

        if config_update.is_default:
            self.db.query(models.ModelConfiguration).update({models.ModelConfiguration.is_default: False})
            db_config.is_default = True

        self.db.commit()
        self.db.refresh(db_config)
        return db_config

    def delete_model_configuration(self, config_id: int) -> models.ModelConfiguration | None:
        db_config = self.get_model_configuration_by_id(config_id)
        if db_config:
            self.db.delete(db_config)
            self.db.commit()
        return db_config

    def set_default_model_configuration(self, config_id: int) -> models.ModelConfiguration | None:
        self.db.query(models.ModelConfiguration).update({models.ModelConfiguration.is_default: False})
        db_config = self.get_model_configuration_by_id(config_id)
        if db_config:
            db_config.is_default = True
            self.db.commit()
            self.db.refresh(db_config)
        return db_config

    # ------------------------------------------------------------------
    # Embedding Configurations
    # ------------------------------------------------------------------

    def list_embedding_configurations(self) -> list[models.EmbeddingConfiguration]:
        return (
            self.db.query(models.EmbeddingConfiguration).order_by(models.EmbeddingConfiguration.created_at.desc()).all()
        )

    def get_embedding_configuration(self, config_id: int) -> models.EmbeddingConfiguration | None:
        return (
            self.db.query(models.EmbeddingConfiguration).filter(models.EmbeddingConfiguration.id == config_id).first()
        )

    def get_active_embedding_configuration(self) -> models.EmbeddingConfiguration | None:
        return (
            self.db.query(models.EmbeddingConfiguration)
            .filter(models.EmbeddingConfiguration.is_active == True)
            .order_by(models.EmbeddingConfiguration.updated_at.desc())
            .first()
        )

    def create_embedding_configuration(
        self, config: schemas.EmbeddingConfigurationCreate
    ) -> models.EmbeddingConfiguration:
        if config.is_active:
            self.db.query(models.EmbeddingConfiguration).update({models.EmbeddingConfiguration.is_active: False})
        db_config = models.EmbeddingConfiguration(**config.dict())
        self.db.add(db_config)
        self.db.commit()
        self.db.refresh(db_config)
        return db_config

    def update_embedding_configuration(
        self, config_id: int, config_update: schemas.EmbeddingConfigurationUpdate
    ) -> models.EmbeddingConfiguration | None:
        db_config = self.get_embedding_configuration(config_id)
        if not db_config:
            return None
        update_data = config_update.dict(exclude_unset=True)
        if update_data.get("is_active"):
            self.db.query(models.EmbeddingConfiguration).update({models.EmbeddingConfiguration.is_active: False})
        for field, value in update_data.items():
            setattr(db_config, field, value)
        self.db.commit()
        self.db.refresh(db_config)
        return db_config

    def delete_embedding_configuration(self, config_id: int) -> models.EmbeddingConfiguration | None:
        db_config = self.get_embedding_configuration(config_id)
        if not db_config:
            return None
        self.db.delete(db_config)
        self.db.commit()
        return db_config

    # ------------------------------------------------------------------
    # Worker Configuration
    # ------------------------------------------------------------------

    def get_worker_configuration(self) -> models.WorkerConfiguration:
        config = (
            self.db.query(models.WorkerConfiguration).order_by(models.WorkerConfiguration.created_at.desc()).first()
        )
        if config:
            return config
        config = models.WorkerConfiguration(max_workers=1)
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config

    def set_worker_configuration(self, max_workers: int) -> models.WorkerConfiguration:
        config = self.get_worker_configuration()
        config.max_workers = max_workers
        self.db.commit()
        self.db.refresh(config)
        return config


class GoogleDriveRepository:
    """Repository for Google Drive credentials, sync config, and processed files."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Credentials
    # ------------------------------------------------------------------

    def get_credentials(self, user_id: str = "default") -> GoogleDriveCredentials | None:
        """Retrieve Google Drive credentials for a user."""
        return self.db.query(GoogleDriveCredentials).filter(GoogleDriveCredentials.user_id == user_id).first()

    def save_credentials(self, credentials_json: str, user_id: str = "default") -> GoogleDriveCredentials:
        """Save or update Google Drive credentials for a user."""
        existing = self.get_credentials(user_id)
        if existing:
            existing.credentials_json = credentials_json
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(existing)
            return existing
        credentials = GoogleDriveCredentials(user_id=user_id, credentials_json=credentials_json)
        self.db.add(credentials)
        self.db.commit()
        self.db.refresh(credentials)
        return credentials

    def delete_credentials(self, user_id: str = "default") -> bool:
        """Delete Google Drive credentials for a user."""
        existing = self.get_credentials(user_id)
        if existing:
            self.db.delete(existing)
            self.db.commit()
            return True
        return False

    # ------------------------------------------------------------------
    # Sync Configuration
    # ------------------------------------------------------------------

    def get_sync_config(self, user_id: str = "default") -> GoogleDriveSyncConfig | None:
        """Retrieve Google Drive sync configuration for a user."""
        return self.db.query(GoogleDriveSyncConfig).filter(GoogleDriveSyncConfig.user_id == user_id).first()

    def save_sync_config(
        self,
        sync_folder_id: str | None = None,
        processed_folder_id: str | None = None,
        enabled: bool = False,
        auto_process: bool = True,
        sync_mode: str = "manual",
        sync_time: str = "04:00",
        user_id: str = "default",
    ) -> GoogleDriveSyncConfig:
        """Save or update Google Drive sync configuration."""
        existing = self.get_sync_config(user_id)
        if existing:
            if sync_folder_id is not None:
                existing.sync_folder_id = sync_folder_id
            if processed_folder_id is not None:
                existing.processed_folder_id = processed_folder_id
            existing.enabled = enabled
            existing.auto_process = auto_process
            existing.sync_mode = sync_mode
            existing.sync_time = sync_time
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(existing)
            return existing
        config = GoogleDriveSyncConfig(
            user_id=user_id,
            sync_folder_id=sync_folder_id,
            processed_folder_id=processed_folder_id,
            enabled=enabled,
            auto_process=auto_process,
            sync_mode=sync_mode,
            sync_time=sync_time,
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config

    def update_sync_last_run(self, user_id: str = "default") -> None:
        """Update the last sync timestamp."""
        config = self.get_sync_config(user_id)
        if config:
            config.last_sync_at = datetime.utcnow()
            self.db.commit()

    # ------------------------------------------------------------------
    # Processed Files
    # ------------------------------------------------------------------

    def is_file_processed(self, drive_file_id: str) -> bool:
        """Check if a file has already been processed."""
        return (
            self.db.query(GoogleDriveProcessedFile)
            .filter(GoogleDriveProcessedFile.drive_file_id == drive_file_id)
            .first()
            is not None
        )

    def mark_file_as_processed(
        self,
        drive_file_id: str,
        drive_file_name: str,
        meeting_id: int | None = None,
        moved_to_processed: bool = False,
    ) -> GoogleDriveProcessedFile:
        """Mark a file as processed."""
        processed_file = GoogleDriveProcessedFile(
            drive_file_id=drive_file_id,
            drive_file_name=drive_file_name,
            meeting_id=meeting_id,
            moved_to_processed=moved_to_processed,
        )
        self.db.add(processed_file)
        self.db.commit()
        self.db.refresh(processed_file)
        return processed_file

    def update_processed_file_meeting(self, drive_file_id: str, meeting_id: int) -> GoogleDriveProcessedFile | None:
        """Update the meeting ID for a processed file."""
        processed_file = (
            self.db.query(GoogleDriveProcessedFile)
            .filter(GoogleDriveProcessedFile.drive_file_id == drive_file_id)
            .first()
        )
        if processed_file:
            processed_file.meeting_id = meeting_id
            self.db.commit()
            self.db.refresh(processed_file)
            return processed_file
        return None

    def mark_file_moved_to_processed(self, drive_file_id: str) -> GoogleDriveProcessedFile | None:
        """Mark that a file has been moved to the processed folder."""
        processed_file = (
            self.db.query(GoogleDriveProcessedFile)
            .filter(GoogleDriveProcessedFile.drive_file_id == drive_file_id)
            .first()
        )
        if processed_file:
            processed_file.moved_to_processed = True
            self.db.commit()
            self.db.refresh(processed_file)
            return processed_file
        return None

    def get_processed_files(self, limit: int = 100) -> list[GoogleDriveProcessedFile]:
        """Get a list of processed files ordered by most recent."""
        return (
            self.db.query(GoogleDriveProcessedFile)
            .order_by(GoogleDriveProcessedFile.processed_at.desc())
            .limit(limit)
            .all()
        )
