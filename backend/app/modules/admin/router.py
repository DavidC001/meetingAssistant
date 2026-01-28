from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ... import crud
from ...core.base.cache import clear_cache, get_cache_info
from ...core.integrations.calendar import generate_ics_calendar
from ...core.integrations.export import export_meeting_data
from ...core.processing.checkpoint import CheckpointManager
from ...database import get_db

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


@router.get("/cache/info")
def get_cache_status():
    """Get information about the current cache."""
    return get_cache_info()


@router.delete("/cache/clear")
def clear_cache_data():
    """Clear all cached data."""
    deleted_count = clear_cache()
    return {"message": f"Cleared {deleted_count} cached files"}


@router.get("/export/{meeting_id}")
def export_meeting(
    meeting_id: int,
    formats: list[str] = Query(["json"], description="Export formats: json, txt, docx, pdf"),
    db: Session = Depends(get_db),
):
    """Export meeting data in specified formats."""

    # Get meeting and transcription
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if not meeting.transcription:
        raise HTTPException(status_code=400, detail="Meeting has not been processed yet")

    # Prepare export data
    export_data = {
        "meeting_id": meeting.id,
        "filename": meeting.filename,
        "created_at": meeting.created_at,
        "status": meeting.status,
        "transcription_language": meeting.transcription_language,
        "number_of_speakers": meeting.number_of_speakers,
        "transcript": meeting.transcription.full_text,
        "summary": meeting.transcription.summary,
        "action_items": [
            {"task": item.task, "owner": item.owner, "due_date": item.due_date}
            for item in meeting.transcription.action_items
        ],
    }

    # Export files
    base_filename = f"/tmp/meeting_{meeting_id}_export"
    export_results = export_meeting_data(export_data, base_filename, formats)

    return {
        "meeting_id": meeting_id,
        "exported_files": {fmt: str(path) if path else None for fmt, path in export_results.items()},
    }


@router.get("/calendar/{meeting_id}")
def generate_meeting_calendar(meeting_id: int, db: Session = Depends(get_db)):
    """Generate ICS calendar file for meeting action items."""

    # Get meeting and transcription
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if not meeting.transcription:
        raise HTTPException(status_code=400, detail="Meeting has not been processed yet")

    # Prepare action items
    action_items = [
        {"task": item.task, "owner": item.owner, "due_date": item.due_date}
        for item in meeting.transcription.action_items
    ]

    if not action_items:
        raise HTTPException(status_code=400, detail="No action items found in meeting")

    # Generate calendar
    calendar_filename = f"/tmp/meeting_{meeting_id}_calendar.ics"
    calendar_path = generate_ics_calendar(
        action_items,
        meeting_date=meeting.created_at,
        meeting_topic=f"Meeting: {meeting.filename}",
        filename=calendar_filename,
    )

    if not calendar_path:
        raise HTTPException(status_code=500, detail="Failed to generate calendar file")

    return {"meeting_id": meeting_id, "calendar_file": str(calendar_path), "action_items_count": len(action_items)}


@router.get("/system/status")
def get_system_status():
    """Get system status including GPU availability and cache info."""
    import torch

    status = {"gpu_available": torch.cuda.is_available(), "cache_info": get_cache_info()}

    if torch.cuda.is_available():
        status["gpu_info"] = {
            "device_count": torch.cuda.device_count(),
            "current_device": torch.cuda.current_device(),
            "device_name": torch.cuda.get_device_name(),
            "memory_allocated": torch.cuda.memory_allocated(),
            "memory_reserved": torch.cuda.memory_reserved(),
        }

    return status


@router.post("/system/gpu/clear-cache")
def clear_gpu_cache():
    """Clear GPU cache if available."""
    import torch

    if not torch.cuda.is_available():
        raise HTTPException(status_code=400, detail="GPU not available")

    torch.cuda.empty_cache()

    return {
        "message": "GPU cache cleared",
        "memory_allocated": torch.cuda.memory_allocated(),
        "memory_reserved": torch.cuda.memory_reserved(),
    }


@router.get("/checkpoints/{meeting_id}")
def get_meeting_checkpoints(meeting_id: int, db: Session = Depends(get_db)):
    """Get checkpoint information for a specific meeting."""

    # Verify meeting exists
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    checkpoint_manager = CheckpointManager(meeting_id)

    return {
        "meeting_id": meeting_id,
        "completed_stages": checkpoint_manager.get_completed_stages(),
        "metadata": checkpoint_manager.get_metadata(),
        "resume_point": checkpoint_manager.get_resume_point(db),
    }


@router.delete("/checkpoints/{meeting_id}")
def clear_meeting_checkpoints(meeting_id: int, db: Session = Depends(get_db)):
    """Clear all checkpoints for a specific meeting."""

    # Verify meeting exists
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    checkpoint_manager = CheckpointManager(meeting_id)
    success = checkpoint_manager.clear_checkpoints()

    if success:
        return {"message": f"Cleared all checkpoints for meeting {meeting_id}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to clear checkpoints")


@router.get("/checkpoints/{meeting_id}/validate")
def validate_meeting_checkpoints(meeting_id: int, db: Session = Depends(get_db)):
    """Validate all checkpoints for a specific meeting."""

    # Verify meeting exists
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    checkpoint_manager = CheckpointManager(meeting_id)
    completed_stages = checkpoint_manager.get_completed_stages()

    validation_results = {}
    for stage in completed_stages:
        validation_results[stage] = checkpoint_manager.validate_checkpoint(stage)

    return {
        "meeting_id": meeting_id,
        "validation_results": validation_results,
        "all_valid": all(validation_results.values()),
    }
