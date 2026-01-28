from sqlalchemy.orm import Session

from . import models, schemas


def get_api_keys(db: Session):
    return db.query(models.APIKey).filter(models.APIKey.is_active == True).all()


def get_api_key(db: Session, key_id: int):
    return db.query(models.APIKey).filter(models.APIKey.id == key_id).first()


def get_api_key_by_name(db: Session, name: str):
    return db.query(models.APIKey).filter(models.APIKey.name == name).first()


def get_api_keys_by_provider(db: Session, provider: str):
    return db.query(models.APIKey).filter(models.APIKey.provider == provider, models.APIKey.is_active == True).all()


def create_api_key(db: Session, api_key: schemas.APIKeyCreate):
    # Exclude key_value from the database model (it's only used for .env file)
    api_key_data = api_key.dict(exclude={"key_value"})
    db_api_key = models.APIKey(**api_key_data)
    db.add(db_api_key)
    db.commit()
    db.refresh(db_api_key)
    return db_api_key


def update_api_key(db: Session, key_id: int, api_key_update: schemas.APIKeyUpdate):
    db_api_key = get_api_key(db, key_id)
    if not db_api_key:
        return None

    # Exclude key_value from the database model (it's only used for .env file)
    update_data = api_key_update.dict(exclude_unset=True, exclude={"key_value"})
    for field, value in update_data.items():
        setattr(db_api_key, field, value)

    db.commit()
    db.refresh(db_api_key)
    return db_api_key


def delete_api_key(db: Session, key_id: int):
    db_api_key = get_api_key(db, key_id)
    if not db_api_key:
        return None

    # Soft delete by setting is_active to False
    db_api_key.is_active = False
    db.commit()
    return db_api_key


def get_model_configurations(db: Session):
    """Get all model configurations"""
    return db.query(models.ModelConfiguration).all()


def get_model_configuration(db: Session, config_id: int):
    """Get a specific model configuration by ID"""
    return db.query(models.ModelConfiguration).filter(models.ModelConfiguration.id == config_id).first()


def get_model_configuration_by_name(db: Session, name: str):
    """Get a model configuration by name"""
    return db.query(models.ModelConfiguration).filter(models.ModelConfiguration.name == name).first()


def get_default_model_configuration(db: Session):
    """Get the default model configuration"""
    return db.query(models.ModelConfiguration).filter(models.ModelConfiguration.is_default == True).first()


def create_model_configuration(db: Session, config: schemas.ModelConfigurationCreate):
    """Create a new model configuration"""
    config_dict = config.dict()

    # Handle environment-based API keys (negative IDs) by setting them to None
    if config_dict.get("chat_api_key_id") and config_dict["chat_api_key_id"] < 0:
        config_dict["chat_api_key_id"] = None
    if config_dict.get("analysis_api_key_id") and config_dict["analysis_api_key_id"] < 0:
        config_dict["analysis_api_key_id"] = None

    db_config = models.ModelConfiguration(**config_dict)

    # If this is the first configuration or explicitly set as default, make it default
    if config.is_default or not get_model_configurations(db):
        # Unset any existing default
        db.query(models.ModelConfiguration).update({models.ModelConfiguration.is_default: False})
        db_config.is_default = True

    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


def update_model_configuration(db: Session, config_id: int, config_update: schemas.ModelConfigurationUpdate):
    """Update a model configuration"""
    db_config = get_model_configuration(db, config_id)
    if not db_config:
        return None

    update_data = config_update.dict(exclude_unset=True)

    # Handle environment-based API keys (negative IDs) by setting them to None
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

    # Handle default setting
    if config_update.is_default:
        # Unset any existing default
        db.query(models.ModelConfiguration).update({models.ModelConfiguration.is_default: False})
        db_config.is_default = True

    db.commit()
    db.refresh(db_config)
    return db_config


def delete_model_configuration(db: Session, config_id: int):
    """Delete a model configuration"""
    db_config = get_model_configuration(db, config_id)
    if db_config:
        db.delete(db_config)
        db.commit()
    return db_config


def set_default_model_configuration(db: Session, config_id: int):
    """Set a model configuration as default"""
    # Unset any existing default
    db.query(models.ModelConfiguration).update({models.ModelConfiguration.is_default: False})

    # Set the new default
    db_config = get_model_configuration(db, config_id)
    if db_config:
        db_config.is_default = True
        db.commit()
        db.refresh(db_config)

    return db_config


def list_embedding_configurations(db: Session):
    return db.query(models.EmbeddingConfiguration).order_by(models.EmbeddingConfiguration.created_at.desc()).all()


def get_embedding_configuration(db: Session, config_id: int):
    return db.query(models.EmbeddingConfiguration).filter(models.EmbeddingConfiguration.id == config_id).first()


def get_active_embedding_configuration(db: Session):
    return (
        db.query(models.EmbeddingConfiguration)
        .filter(models.EmbeddingConfiguration.is_active == True)
        .order_by(models.EmbeddingConfiguration.updated_at.desc())
        .first()
    )


def create_embedding_configuration(db: Session, config: schemas.EmbeddingConfigurationCreate):
    if config.is_active:
        db.query(models.EmbeddingConfiguration).update({models.EmbeddingConfiguration.is_active: False})
    db_config = models.EmbeddingConfiguration(**config.dict())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


def update_embedding_configuration(db: Session, config_id: int, config_update: schemas.EmbeddingConfigurationUpdate):
    db_config = get_embedding_configuration(db, config_id)
    if not db_config:
        return None
    update_data = config_update.dict(exclude_unset=True)
    if update_data.get("is_active"):
        db.query(models.EmbeddingConfiguration).update({models.EmbeddingConfiguration.is_active: False})
    for field, value in update_data.items():
        setattr(db_config, field, value)
    db.commit()
    db.refresh(db_config)
    return db_config


def delete_embedding_configuration(db: Session, config_id: int):
    db_config = get_embedding_configuration(db, config_id)
    if not db_config:
        return None
    db.delete(db_config)
    db.commit()
    return db_config


def get_worker_configuration(db: Session):
    config = db.query(models.WorkerConfiguration).order_by(models.WorkerConfiguration.created_at.desc()).first()
    if config:
        return config
    config = models.WorkerConfiguration(max_workers=1)
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def set_worker_configuration(db: Session, max_workers: int):
    config = get_worker_configuration(db)
    config.max_workers = max_workers
    db.commit()
    db.refresh(config)
    return config
