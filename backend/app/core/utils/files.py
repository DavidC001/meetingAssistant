"""
File operation utility functions.

Provides common file operations for the application.
"""

import hashlib
import mimetypes
import shutil
from pathlib import Path

# Supported file formats
AUDIO_FORMATS = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".wma"]
VIDEO_FORMATS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv"]
DOCUMENT_FORMATS = [".pdf", ".doc", ".docx", ".txt", ".md"]
SUPPORTED_MEDIA_FORMATS = AUDIO_FORMATS + VIDEO_FORMATS


def ensure_dir(path: str | Path) -> Path:
    """
    Ensure directory exists, create if it doesn't.

    Args:
        path: Directory path

    Returns:
        Path object
    """
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_file_size(path: str | Path) -> int:
    """
    Get file size in bytes.

    Args:
        path: File path

    Returns:
        File size in bytes

    Raises:
        FileNotFoundError: If file doesn't exist
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    return path.stat().st_size


def get_file_size_mb(path: str | Path) -> float:
    """
    Get file size in megabytes.

    Args:
        path: File path

    Returns:
        File size in MB (rounded to 2 decimal places)
    """
    size_bytes = get_file_size(path)
    return round(size_bytes / (1024 * 1024), 2)


def calculate_file_hash(path: str | Path, algorithm: str = "sha256") -> str:
    """
    Calculate file hash.

    Args:
        path: File path
        algorithm: Hash algorithm (default: sha256)

    Returns:
        Hexadecimal hash string

    Raises:
        FileNotFoundError: If file doesn't exist
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    hash_func = hashlib.new(algorithm)

    with open(path, "rb") as f:
        while chunk := f.read(8192):
            hash_func.update(chunk)

    return hash_func.hexdigest()


def get_file_extension(path: str | Path, lowercase: bool = True) -> str:
    """
    Get file extension.

    Args:
        path: File path
        lowercase: Convert to lowercase (default: True)

    Returns:
        File extension including the dot (e.g., '.mp3')
    """
    ext = Path(path).suffix
    return ext.lower() if lowercase else ext


def is_audio_file(path: str | Path) -> bool:
    """
    Check if file is an audio file.

    Args:
        path: File path

    Returns:
        True if audio file
    """
    return get_file_extension(path) in AUDIO_FORMATS


def is_video_file(path: str | Path) -> bool:
    """
    Check if file is a video file.

    Args:
        path: File path

    Returns:
        True if video file
    """
    return get_file_extension(path) in VIDEO_FORMATS


def is_supported_media_file(path: str | Path) -> bool:
    """
    Check if file is a supported media file.

    Args:
        path: File path

    Returns:
        True if supported media file
    """
    return get_file_extension(path) in SUPPORTED_MEDIA_FORMATS


def get_mime_type(path: str | Path) -> str | None:
    """
    Get MIME type of a file.

    Args:
        path: File path

    Returns:
        MIME type string or None if unknown
    """
    mime_type, _ = mimetypes.guess_type(str(path))
    return mime_type


def list_files(directory: str | Path, pattern: str = "*", recursive: bool = False) -> list[Path]:
    """
    List files in a directory.

    Args:
        directory: Directory path
        pattern: Glob pattern (default: *)
        recursive: Search recursively (default: False)

    Returns:
        List of file paths
    """
    path = Path(directory)

    if recursive:
        return list(path.rglob(pattern))
    else:
        return list(path.glob(pattern))


def copy_file(src: str | Path, dst: str | Path, overwrite: bool = False) -> Path:
    """
    Copy a file.

    Args:
        src: Source file path
        dst: Destination file path
        overwrite: Overwrite if destination exists (default: False)

    Returns:
        Destination path

    Raises:
        FileNotFoundError: If source doesn't exist
        FileExistsError: If destination exists and overwrite=False
    """
    src = Path(src)
    dst = Path(dst)

    if not src.exists():
        raise FileNotFoundError(f"Source file not found: {src}")

    if dst.exists() and not overwrite:
        raise FileExistsError(f"Destination already exists: {dst}")

    # Ensure destination directory exists
    dst.parent.mkdir(parents=True, exist_ok=True)

    shutil.copy2(src, dst)
    return dst


def move_file(src: str | Path, dst: str | Path, overwrite: bool = False) -> Path:
    """
    Move a file.

    Args:
        src: Source file path
        dst: Destination file path
        overwrite: Overwrite if destination exists (default: False)

    Returns:
        Destination path

    Raises:
        FileNotFoundError: If source doesn't exist
        FileExistsError: If destination exists and overwrite=False
    """
    src = Path(src)
    dst = Path(dst)

    if not src.exists():
        raise FileNotFoundError(f"Source file not found: {src}")

    if dst.exists() and not overwrite:
        raise FileExistsError(f"Destination already exists: {dst}")

    # Ensure destination directory exists
    dst.parent.mkdir(parents=True, exist_ok=True)

    shutil.move(str(src), str(dst))
    return dst


def delete_file(path: str | Path, missing_ok: bool = True) -> bool:
    """
    Delete a file.

    Args:
        path: File path
        missing_ok: Don't raise error if file doesn't exist (default: True)

    Returns:
        True if file was deleted, False if it didn't exist

    Raises:
        FileNotFoundError: If file doesn't exist and missing_ok=False
    """
    path = Path(path)

    if not path.exists():
        if missing_ok:
            return False
        raise FileNotFoundError(f"File not found: {path}")

    path.unlink()
    return True


def clean_directory(directory: str | Path, pattern: str = "*", recursive: bool = False) -> int:
    """
    Delete all files matching pattern in a directory.

    Args:
        directory: Directory path
        pattern: Glob pattern (default: *)
        recursive: Search recursively (default: False)

    Returns:
        Number of files deleted
    """
    files = list_files(directory, pattern, recursive)
    count = 0

    for file in files:
        if file.is_file():
            file.unlink()
            count += 1

    return count


def get_unique_filename(directory: str | Path, basename: str, extension: str) -> Path:
    """
    Get a unique filename by appending a number if necessary.

    Args:
        directory: Directory path
        basename: Base filename without extension
        extension: File extension including dot

    Returns:
        Unique file path

    Example:
        >>> get_unique_filename("/tmp", "file", ".txt")
        Path('/tmp/file.txt')  # or file_1.txt if file.txt exists
    """
    directory = Path(directory)
    filename = directory / f"{basename}{extension}"

    if not filename.exists():
        return filename

    counter = 1
    while True:
        filename = directory / f"{basename}_{counter}{extension}"
        if not filename.exists():
            return filename
        counter += 1
