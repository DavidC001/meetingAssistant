"""
File validation and management utilities for the meetings module.

Extracted from service.py to keep the service layer focused on business logic.
"""

import shutil
from pathlib import Path

from fastapi import HTTPException, UploadFile

from ...core.config import config


class FileValidator:
    """Validates uploaded meeting files (size + extension)."""

    @staticmethod
    def validate_file_size(file: UploadFile) -> int:
        """Validate file size and return size in bytes."""
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)

        if file_size > config.upload.max_file_size_bytes:
            raise HTTPException(
                status_code=413,
                detail=(
                    f"File size ({file_size / (1024*1024):.1f}MB) exceeds "
                    f"maximum allowed size ({config.upload.max_file_size_mb}MB)"
                ),
            )
        return file_size

    @staticmethod
    def validate_file_extension(filename: str) -> None:
        """Validate file extension against allowed list."""
        file_ext = Path(filename).suffix.lower()
        if file_ext not in config.upload.allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"File extension '{file_ext}' not allowed. "
                    f"Allowed extensions: {', '.join(config.upload.allowed_extensions)}"
                ),
            )


class FileManager:
    """Saves uploaded files with unique naming."""

    @staticmethod
    def save_uploaded_file(file: UploadFile) -> str:
        """Save uploaded file to disk, return file path."""
        file_path = Path(config.upload.upload_dir) / file.filename

        counter = 1
        original_path = file_path
        while file_path.exists():
            stem = original_path.stem
            suffix = original_path.suffix
            file_path = original_path.parent / f"{stem}_{counter}{suffix}"
            counter += 1

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return str(file_path)
