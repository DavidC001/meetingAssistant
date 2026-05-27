"""
Export service for meetings — generates downloadable files (JSON, TXT, DOCX, PDF).

Extracted from MeetingService to isolate format-specific logic.
"""

import os
import shutil
import tempfile
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...core.integrations.export import (
    export_to_docx,
    export_to_json,
    export_to_pdf,
    export_to_txt,
)
from . import models as meeting_models


class ExportService:
    """Generates export files from meeting transcriptions."""

    def __init__(self, db: Session):
        self.db = db

    def export_meeting(
        self,
        meeting: meeting_models.Meeting,
        format: str,
    ) -> FileResponse:
        """Export a meeting's transcription to the requested format."""
        allowed_formats = ["json", "txt", "docx", "pdf"]
        fmt = format.lower()
        if fmt not in allowed_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid format. Allowed formats: {', '.join(allowed_formats)}",
            )

        if not meeting.transcription:
            raise HTTPException(
                status_code=404,
                detail="Meeting transcription not available. Processing may still be in progress.",
            )

        data: dict = {
            "filename": meeting.filename,
            "created_at": meeting.created_at,
            "status": meeting.status,
            "summary": meeting.transcription.summary or "No summary available",
            "transcript": meeting.transcription.full_text or "No transcript available",
            "notes": meeting.notes or "",
            "action_items": [],
        }

        if meeting.transcription.action_items:
            for item in meeting.transcription.action_items:
                data["action_items"].append(
                    {
                        "task": item.task,
                        "owner": item.owner or "Unassigned",
                        "due_date": item.due_date or "No due date",
                        "status": item.status or "pending",
                        "priority": item.priority or "medium",
                        "notes": item.notes or "",
                    }
                )

        if meeting.speakers:
            data["speakers"] = [
                {"name": s.name, "label": s.label or ""} for s in meeting.speakers
            ]
        if meeting.tags:
            data["tags"] = meeting.tags
        if meeting.folder:
            data["folder"] = meeting.folder
        if meeting.model_configuration:
            data["model_info"] = {
                "name": meeting.model_configuration.name,
                "transcription_language": meeting.transcription_language,
                "number_of_speakers": meeting.number_of_speakers,
            }

        temp_dir = tempfile.mkdtemp()
        base_name = Path(meeting.filename.replace(" ", "_")).stem

        try:
            export_path = self._render_export(fmt, data, temp_dir, base_name)

            if not export_path or not os.path.exists(export_path):
                raise HTTPException(status_code=500, detail="Failed to generate export file")

            media_types = {
                "json": "application/json",
                "txt": "text/plain",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "pdf": "application/pdf",
            }

            return FileResponse(
                path=str(export_path),
                media_type=media_types[fmt],
                filename=f"{base_name}.{fmt}",
                background=None,
            )
        except HTTPException:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise
        except Exception as e:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail=f"Error generating export: {str(e)}")

    @staticmethod
    def _render_export(fmt: str, data: dict, temp_dir: str, base_name: str) -> str | None:
        """Dispatch to the appropriate exporter function."""
        if fmt == "json":
            return export_to_json(data, os.path.join(temp_dir, f"{base_name}.json"))
        if fmt == "txt":
            return export_to_txt(data, os.path.join(temp_dir, f"{base_name}.txt"))
        if fmt == "docx":
            path = export_to_docx(data, os.path.join(temp_dir, f"{base_name}.docx"))
            if path is None:
                raise HTTPException(status_code=500, detail="DOCX export not available.")
            return path
        if fmt == "pdf":
            path = export_to_pdf(data, os.path.join(temp_dir, f"{base_name}.pdf"))
            if path is None:
                raise HTTPException(status_code=500, detail="PDF export not available.")
            return path
        return None
