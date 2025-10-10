import os
import subprocess
import sys
import json
from pathlib import Path
from datetime import datetime
from ..schemas import MeetingMetadata  # Assuming you'll adapt the dataclass to a Pydantic model

# Supported file formats
AUDIO_FORMATS = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma']
VIDEO_FORMATS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv']
SUPPORTED_FORMATS = AUDIO_FORMATS + VIDEO_FORMATS

def _assert_file(p: str | Path) -> Path:
    path = Path(p)
    if not path.exists():
        raise FileNotFoundError(path)
    return path.resolve()

def _run_ffmpeg(cmd: list[str]):
    try:
        result = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return result
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg executable not found on PATH. Please ensure FFmpeg is installed in the Docker container.") from exc
    except subprocess.CalledProcessError as exc:
        error_msg = exc.stderr.decode() if exc.stderr else "Unknown FFmpeg error"
        # Log the full command for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"FFmpeg command failed: {' '.join(cmd)}")
        logger.error(f"Exit code: {exc.returncode}")
        logger.error(f"Error output: {error_msg}")
        
        # Provide specific error messages for common issues
        if exc.returncode == 254:
            if "No such file or directory" in error_msg:
                raise RuntimeError(f"Input file not found: {cmd[cmd.index('-i') + 1] if '-i' in cmd else 'unknown'}. Check if file exists and is accessible in the container.") from exc
            else:
                raise RuntimeError(f"FFmpeg processing failed with exit code 254. This usually indicates an input/output error or missing file. Error: {error_msg}") from exc
        elif "Permission denied" in error_msg:
            raise RuntimeError(f"Permission denied accessing file. Check file permissions. Error: {error_msg}") from exc
        else:
            raise RuntimeError(f"FFmpeg failed with exit code {exc.returncode}: {error_msg}") from exc

def is_supported_format(file_path: str | Path) -> bool:
    """Check if file format is supported."""
    file_ext = Path(file_path).suffix.lower()
    return file_ext in SUPPORTED_FORMATS

def is_video_format(file_path: str | Path) -> bool:
    """Check if file is a video format."""
    file_ext = Path(file_path).suffix.lower()
    return file_ext in VIDEO_FORMATS

def convert_to_audio(input_path: str | Path, output_path: str | Path) -> Path:
    """Convert video or audio file to WAV format using ffmpeg."""
    input_path = Path(input_path)
    output_path = Path(output_path)

    # Validate that input file exists
    if not input_path.exists():
        raise FileNotFoundError(f"Input file does not exist: {input_path}")
    
    # Create output directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Log the conversion for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Converting {input_path} to {output_path}")

    # Use ffmpeg to convert to WAV at 16kHz, mono
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-ac", "1", "-ar", "16000", "-loglevel", "error", str(output_path),
    ]
    _run_ffmpeg(cmd)

    return output_path

def convert_to_mp3(input_path: str | Path, output_path: str | Path) -> Path:
    """
    Convert audio/video file to MP3 format for efficient storage and streaming.
    Extracts only audio from video files and converts to MP3 at 128kbps.
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    # Validate that input file exists
    if not input_path.exists():
        raise FileNotFoundError(f"Input file does not exist: {input_path}")
    
    # Create output directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Log the conversion for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Converting {input_path} to MP3 at {output_path}")

    # Use ffmpeg to convert to MP3 at 128kbps (good quality, efficient size)
    # -vn ensures no video is included (audio only)
    # -b:a 128k sets audio bitrate to 128kbps
    cmd = [
        "ffmpeg", "-y", "-i", str(input_path),
        "-vn",  # No video
        "-codec:a", "libmp3lame",  # MP3 codec
        "-b:a", "128k",  # Audio bitrate
        "-loglevel", "error",
        str(output_path),
    ]
    _run_ffmpeg(cmd)

    logger.info(f"Successfully converted to MP3: {output_path}")
    return output_path

def get_file_metadata(file_path: str | Path) -> MeetingMetadata:
    """Extract metadata from the file."""
    path = _assert_file(file_path)
    stat = path.stat()

    file_type = "video" if is_video_format(path) else "audio"

    metadata = {
        "file_path": str(path),
        "file_size": stat.st_size,
        "created_time": stat.st_ctime,
        "modified_time": stat.st_mtime,
        "file_type": file_type,
        "meeting_date": datetime.fromtimestamp(stat.st_ctime)
    }

    try:
        cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(path)]
        result = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        ffprobe_data = json.loads(result.stdout)

        if "format" in ffprobe_data:
            format_info = ffprobe_data["format"]
            if "tags" in format_info:
                metadata["tags"] = format_info["tags"]
            if "duration" in format_info:
                metadata["duration"] = float(format_info["duration"])
    except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError):
        pass

    return MeetingMetadata(**metadata)
