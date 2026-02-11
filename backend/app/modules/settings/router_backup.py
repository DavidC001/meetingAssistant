"""
Backup and restore endpoints for data export/import.

This module provides functionality to export all application data
and import it into another instance.
"""

import io
import json
import logging
import os
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from ...core.config import get_upload_config
from ...database import get_db
from ...models import (
    ActionItem,
    GlobalChatSession,
    GoogleDriveProcessedFile,
    GoogleDriveSyncConfig,
    Meeting,
    MeetingLink,
    Speaker,
    UserMapping,
)
from ..diary.models import DiaryEntry
from ..projects.models import (
    Project,
    ProjectChatMessage,
    ProjectChatSession,
    ProjectMeeting,
    ProjectMember,
    ProjectMilestone,
    ProjectNote,
    ProjectNoteAttachment,
)

router = APIRouter(prefix="/backup", tags=["backup"])
logger = logging.getLogger(__name__)


def serialize_model(obj: Any) -> dict[str, Any]:
    """Convert SQLAlchemy model to dictionary."""
    if obj is None:
        return None

    result = {}
    for column in inspect(obj).mapper.column_attrs:
        value = getattr(obj, column.key)
        if isinstance(value, datetime):
            result[column.key] = value.isoformat()
        elif value is None:
            result[column.key] = None
        elif isinstance(value, str | int | float | bool):
            result[column.key] = value
        elif isinstance(value, bytes):
            # Skip binary data
            result[column.key] = None
        elif isinstance(value, dict | list):
            # Preserve dict and list types (JSON columns)
            result[column.key] = value
        else:
            # Try to convert to string for other types
            try:
                result[column.key] = str(value)
            except:
                result[column.key] = None
    return result


@router.get("/export")
async def export_data(include_audio: bool = False, db: Session = Depends(get_db)):
    """
    Export all application data as JSON.

    Returns a JSON file containing:
    - All meetings with transcripts, summaries, speakers
    - Action items
    - User mappings
    - Settings and configurations
    - Meeting relationships
    """
    try:
        # Export meetings
        meetings = db.query(Meeting).all()
        meetings_data = []
        for meeting in meetings:
            meeting_dict = serialize_model(meeting)

            # Include transcription
            from ...models import Transcription

            transcription = db.query(Transcription).filter(Transcription.meeting_id == meeting.id).first()
            if transcription:
                meeting_dict["transcription"] = serialize_model(transcription)
            else:
                meeting_dict["transcription"] = None

            # Include speakers
            speakers = db.query(Speaker).filter(Speaker.meeting_id == meeting.id).all()
            meeting_dict["speakers"] = [serialize_model(s) for s in speakers]

            # Include action items (through transcription relationship)
            if transcription:
                action_items = db.query(ActionItem).filter(ActionItem.transcription_id == transcription.id).all()
                meeting_dict["action_items"] = [serialize_model(a) for a in action_items]
            else:
                meeting_dict["action_items"] = []

            meetings_data.append(meeting_dict)

        # Export user mappings
        user_mappings = db.query(UserMapping).all()
        user_mappings_data = [serialize_model(um) for um in user_mappings]

        # Export meeting links (relationships)
        links = db.query(MeetingLink).all()
        links_data = [serialize_model(link) for link in links]

        # Export Drive sync config (without credentials)
        drive_config = db.query(GoogleDriveSyncConfig).first()
        drive_config_data = serialize_model(drive_config) if drive_config else None

        # Export processed files tracking
        processed_files = db.query(GoogleDriveProcessedFile).all()
        processed_files_data = [serialize_model(pf) for pf in processed_files]

        # Export global chat sessions (metadata only, no conversation history)
        chat_sessions = db.query(GlobalChatSession).all()
        chat_sessions_data = [serialize_model(cs) for cs in chat_sessions]

        # Export settings - API Keys (without sensitive data)
        from ...models import APIKey, EmbeddingConfiguration, ModelConfiguration, WorkerConfiguration

        api_keys = db.query(APIKey).all()
        api_keys_data = [serialize_model(ak) for ak in api_keys]

        # Export model configurations
        model_configs = db.query(ModelConfiguration).all()
        model_configs_data = [serialize_model(mc) for mc in model_configs]

        # Export embedding configurations
        embedding_configs = db.query(EmbeddingConfiguration).all()
        embedding_configs_data = [serialize_model(ec) for ec in embedding_configs]

        # Export worker configuration
        worker_config = db.query(WorkerConfiguration).first()
        worker_config_data = serialize_model(worker_config) if worker_config else None

        # Export diary entries
        diary_entries = db.query(DiaryEntry).all()
        diary_entries_data = [serialize_model(de) for de in diary_entries]

        # Export projects data
        projects = db.query(Project).all()
        projects_data = [serialize_model(project) for project in projects]

        project_meetings = db.query(ProjectMeeting).all()
        project_meetings_data = [serialize_model(meeting) for meeting in project_meetings]

        project_milestones = db.query(ProjectMilestone).all()
        project_milestones_data = [serialize_model(milestone) for milestone in project_milestones]

        project_members = db.query(ProjectMember).all()
        project_members_data = [serialize_model(member) for member in project_members]

        project_chat_sessions = db.query(ProjectChatSession).all()
        project_chat_sessions_data = [serialize_model(session) for session in project_chat_sessions]

        project_chat_messages = db.query(ProjectChatMessage).all()
        project_chat_messages_data = [serialize_model(message) for message in project_chat_messages]

        project_notes = db.query(ProjectNote).all()
        project_notes_data = [serialize_model(note) for note in project_notes]

        project_note_attachments = db.query(ProjectNoteAttachment).all()
        project_note_attachments_data = [serialize_model(attachment) for attachment in project_note_attachments]

        # Export standalone action items (those not attached to any meeting/transcription)
        standalone_action_items = db.query(ActionItem).filter(ActionItem.transcription_id.is_(None)).all()
        standalone_action_items_data = [serialize_model(ai) for ai in standalone_action_items]

        # Compile export data
        export_data = {
            "export_metadata": {
                "version": "1.1",
                "exported_at": datetime.utcnow().isoformat(),
                "counts": {
                    "meetings": len(meetings_data),
                    "user_mappings": len(user_mappings_data),
                    "links": len(links_data),
                    "processed_files": len(processed_files_data),
                    "chat_sessions": len(chat_sessions_data),
                    "api_keys": len(api_keys_data),
                    "model_configs": len(model_configs_data),
                    "embedding_configs": len(embedding_configs_data),
                    "diary_entries": len(diary_entries_data),
                    "standalone_action_items": len(standalone_action_items_data),
                    "projects": len(projects_data),
                    "project_meetings": len(project_meetings_data),
                    "project_milestones": len(project_milestones_data),
                    "project_members": len(project_members_data),
                    "project_chat_sessions": len(project_chat_sessions_data),
                    "project_chat_messages": len(project_chat_messages_data),
                    "project_notes": len(project_notes_data),
                    "project_note_attachments": len(project_note_attachments_data),
                },
            },
            "meetings": meetings_data,
            "user_mappings": user_mappings_data,
            "meeting_links": links_data,
            "drive_sync_config": drive_config_data,
            "drive_processed_files": processed_files_data,
            "global_chat_sessions": chat_sessions_data,
            "api_keys": api_keys_data,
            "model_configurations": model_configs_data,
            "embedding_configurations": embedding_configs_data,
            "worker_configuration": worker_config_data,
            "diary_entries": diary_entries_data,
            "standalone_action_items": standalone_action_items_data,
            "projects": projects_data,
            "project_meetings": project_meetings_data,
            "project_milestones": project_milestones_data,
            "project_members": project_members_data,
            "project_chat_sessions": project_chat_sessions_data,
            "project_chat_messages": project_chat_messages_data,
            "project_notes": project_notes_data,
            "project_note_attachments": project_note_attachments_data,
        }

        # Create JSON file
        json_str = json.dumps(export_data, indent=2, ensure_ascii=False)
        json_bytes = json_str.encode("utf-8")

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        if include_audio:
            upload_config = get_upload_config()
            upload_dir = Path(upload_config.upload_dir).resolve()

            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
                # Store JSON inside the archive
                zip_file.writestr(f"meeting_assistant_backup_{timestamp}.json", json_bytes)

                # Collect audio file paths from meetings and project note attachments
                audio_paths: set[str] = set()
                for meeting in meetings_data:
                    for path_key in ["filepath", "audio_filepath"]:
                        path_value = meeting.get(path_key)
                        if not path_value:
                            continue
                        audio_paths.add(path_value)

                for attachment in project_note_attachments_data:
                    path_value = attachment.get("filepath")
                    if path_value:
                        audio_paths.add(path_value)

                for rel_path in sorted(audio_paths):
                    normalized = rel_path.lstrip("/\\")
                    source_path = Path(rel_path) if os.path.isabs(rel_path) else upload_dir / normalized

                    if source_path.exists() and source_path.is_file():
                        archive_name = str(Path("uploads") / normalized).replace("\\", "/")
                        zip_file.write(source_path, archive_name)

            zip_bytes = zip_buffer.getvalue()
            filename = f"meeting_assistant_backup_{timestamp}.zip"
            return StreamingResponse(
                io.BytesIO(zip_bytes),
                media_type="application/zip",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Content-Length": str(len(zip_bytes)),
                },
            )

        # Return as downloadable JSON file
        filename = f"meeting_assistant_backup_{timestamp}.json"

        return StreamingResponse(
            io.BytesIO(json_bytes),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}", "Content-Length": str(len(json_bytes))},
        )

    except Exception as e:
        logger.error(f"Export error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/import")
async def import_data(file: UploadFile = File(...), merge_mode: bool = False, db: Session = Depends(get_db)):
    """
    Import data from a backup JSON file.

    Args:
        file: JSON backup file
        merge_mode: If True, merge with existing data. If False, skip duplicates.

    Returns:
        Import statistics and any errors encountered
    """
    try:
        # Read and parse JSON (supports ZIP archives with audio files)
        content = await file.read()
        data = None

        if zipfile.is_zipfile(io.BytesIO(content)):
            upload_config = get_upload_config()
            upload_dir = Path(upload_config.upload_dir).resolve()

            with zipfile.ZipFile(io.BytesIO(content)) as zip_file:
                json_name = next(
                    (name for name in zip_file.namelist() if name.endswith(".json")),
                    None,
                )
                if not json_name:
                    raise HTTPException(status_code=400, detail="Backup archive missing JSON file")

                data = json.loads(zip_file.read(json_name))

                for member in zip_file.infolist():
                    if member.is_dir():
                        continue
                    if not member.filename.startswith("uploads/"):
                        continue

                    relative_path = Path(member.filename).relative_to("uploads")
                    target_path = (upload_dir / relative_path).resolve()
                    if not str(target_path).startswith(str(upload_dir)):
                        continue

                    target_path.parent.mkdir(parents=True, exist_ok=True)
                    with zip_file.open(member, "r") as source, open(target_path, "wb") as dest:
                        dest.write(source.read())
        else:
            data = json.loads(content)

        stats = {
            "meetings_imported": 0,
            "meetings_skipped": 0,
            "user_mappings_imported": 0,
            "links_imported": 0,
            "processed_files_imported": 0,
            "chat_sessions_imported": 0,
            "api_keys_imported": 0,
            "model_configs_imported": 0,
            "embedding_configs_imported": 0,
            "worker_config_imported": 0,
            "diary_entries_imported": 0,
            "projects_imported": 0,
            "project_meetings_imported": 0,
            "project_milestones_imported": 0,
            "project_members_imported": 0,
            "project_chat_sessions_imported": 0,
            "project_chat_messages_imported": 0,
            "project_notes_imported": 0,
            "project_note_attachments_imported": 0,
            "errors": [],
        }

        # Validate export version
        if data.get("export_metadata", {}).get("version") not in {"1.0", "1.1"}:
            raise HTTPException(status_code=400, detail="Unsupported backup version")

        # Import API keys first (they may be referenced by model/embedding configs)
        from ...models import APIKey, EmbeddingConfiguration, ModelConfiguration, WorkerConfiguration

        api_key_id_map = {}  # old_id -> new_id

        for ak_data in data.get("api_keys", []):
            try:
                # Convert datetime fields
                for field in ["created_at", "updated_at"]:
                    if field in ak_data and ak_data[field]:
                        try:
                            ak_data[field] = datetime.fromisoformat(ak_data[field])
                        except:
                            ak_data[field] = None

                old_id = ak_data.get("id")

                # Check if already exists by name
                existing = db.query(APIKey).filter(APIKey.name == ak_data.get("name")).first()

                if existing:
                    api_key_id_map[old_id] = existing.id
                else:
                    ak_dict = {k: v for k, v in ak_data.items() if k != "id"}
                    api_key = APIKey(**ak_dict)
                    db.add(api_key)
                    db.flush()
                    api_key_id_map[old_id] = api_key.id
                    stats["api_keys_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"API Key '{ak_data.get('name')}': {str(e)}")

        db.commit()

        # Import model configurations
        model_config_id_map = {}  # old_id -> new_id

        for mc_data in data.get("model_configurations", []):
            try:
                # Convert datetime fields
                for field in ["created_at", "updated_at"]:
                    if field in mc_data and mc_data[field]:
                        try:
                            mc_data[field] = datetime.fromisoformat(mc_data[field])
                        except:
                            mc_data[field] = None

                old_id = mc_data.get("id")

                # Map foreign keys
                if "chat_api_key_id" in mc_data and mc_data["chat_api_key_id"]:
                    mc_data["chat_api_key_id"] = api_key_id_map.get(mc_data["chat_api_key_id"])
                if "analysis_api_key_id" in mc_data and mc_data["analysis_api_key_id"]:
                    mc_data["analysis_api_key_id"] = api_key_id_map.get(mc_data["analysis_api_key_id"])

                # Check if already exists by name
                existing = db.query(ModelConfiguration).filter(ModelConfiguration.name == mc_data.get("name")).first()

                if existing and not merge_mode:
                    model_config_id_map[old_id] = existing.id
                else:
                    mc_dict = {k: v for k, v in mc_data.items() if k != "id"}
                    model_config = ModelConfiguration(**mc_dict)
                    db.add(model_config)
                    db.flush()
                    model_config_id_map[old_id] = model_config.id
                    stats["model_configs_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"Model Config '{mc_data.get('name')}': {str(e)}")

        db.commit()

        # Import embedding configurations
        embedding_config_id_map = {}  # old_id -> new_id

        for ec_data in data.get("embedding_configurations", []):
            try:
                # Convert datetime fields
                for field in ["created_at", "updated_at"]:
                    if field in ec_data and ec_data[field]:
                        try:
                            ec_data[field] = datetime.fromisoformat(ec_data[field])
                        except:
                            ec_data[field] = None

                # Parse JSON string fields back to dict if needed
                if "settings" in ec_data and isinstance(ec_data["settings"], str):
                    try:
                        ec_data["settings"] = json.loads(ec_data["settings"])
                    except:
                        ec_data["settings"] = None

                old_id = ec_data.get("id")

                # Map foreign key
                if "api_key_id" in ec_data and ec_data["api_key_id"]:
                    ec_data["api_key_id"] = api_key_id_map.get(ec_data["api_key_id"])

                # Check if already exists by provider+model_name
                existing = (
                    db.query(EmbeddingConfiguration)
                    .filter(
                        EmbeddingConfiguration.provider == ec_data.get("provider"),
                        EmbeddingConfiguration.model_name == ec_data.get("model_name"),
                    )
                    .first()
                )

                if existing and not merge_mode:
                    embedding_config_id_map[old_id] = existing.id
                else:
                    ec_dict = {k: v for k, v in ec_data.items() if k != "id"}
                    embedding_config = EmbeddingConfiguration(**ec_dict)
                    db.add(embedding_config)
                    db.flush()
                    embedding_config_id_map[old_id] = embedding_config.id
                    stats["embedding_configs_imported"] += 1
            except Exception as e:
                stats["errors"].append(
                    f"Embedding Config '{ec_data.get('provider')}/{ec_data.get('model_name')}': {str(e)}"
                )

        db.commit()

        # Import worker configuration
        worker_data = data.get("worker_configuration")
        if worker_data:
            try:
                # Convert datetime fields
                for field in ["created_at", "updated_at"]:
                    if field in worker_data and worker_data[field]:
                        try:
                            worker_data[field] = datetime.fromisoformat(worker_data[field])
                        except:
                            worker_data[field] = None

                # Check if worker config exists
                existing = db.query(WorkerConfiguration).first()

                if existing:
                    # Update existing
                    for key, value in worker_data.items():
                        if key != "id" and hasattr(existing, key):
                            setattr(existing, key, value)
                    stats["worker_config_imported"] += 1
                else:
                    # Create new
                    wc_dict = {k: v for k, v in worker_data.items() if k != "id"}
                    worker_config = WorkerConfiguration(**wc_dict)
                    db.add(worker_config)
                    stats["worker_config_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"Worker Config: {str(e)}")

        db.commit()

        # Import user mappings (they may be referenced by other data)
        user_mapping_id_map = {}
        for um_data in data.get("user_mappings", []):
            try:
                # Convert datetime fields
                for field in ["created_at", "updated_at"]:
                    if field in um_data and um_data[field]:
                        try:
                            um_data[field] = datetime.fromisoformat(um_data[field])
                        except:
                            um_data[field] = None

                # Check if already exists by name
                existing = db.query(UserMapping).filter(UserMapping.name == um_data.get("name")).first()

                old_id = um_data.get("id")

                if existing:
                    user_mapping_id_map[old_id] = existing.id
                else:
                    user_mapping = UserMapping(**{k: v for k, v in um_data.items() if k != "id"})
                    db.add(user_mapping)
                    db.flush()
                    user_mapping_id_map[old_id] = user_mapping.id
                    stats["user_mappings_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"User mapping '{um_data.get('name')}': {str(e)}")

        db.commit()

        # Import projects
        project_id_map = {}
        for project_data in data.get("projects", []):
            try:
                for field in [
                    "start_date",
                    "target_end_date",
                    "actual_end_date",
                    "created_at",
                    "updated_at",
                ]:
                    if field in project_data and project_data[field]:
                        try:
                            project_data[field] = datetime.fromisoformat(project_data[field])
                        except:
                            project_data[field] = None

                if "settings" in project_data and isinstance(project_data["settings"], str):
                    try:
                        project_data["settings"] = json.loads(project_data["settings"])
                    except:
                        project_data["settings"] = {}

                old_id = project_data.get("id")

                existing = db.query(Project).filter(Project.name == project_data.get("name")).first()

                if existing and not merge_mode:
                    project_id_map[old_id] = existing.id
                else:
                    project_dict = {k: v for k, v in project_data.items() if k != "id"}
                    project = Project(**project_dict)
                    db.add(project)
                    db.flush()
                    project_id_map[old_id] = project.id
                    stats["projects_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"Project '{project_data.get('name')}': {str(e)}")

        db.commit()

        # Import project meetings
        for meeting_data in data.get("project_meetings", []):
            try:
                if "created_at" in meeting_data and meeting_data["created_at"]:
                    try:
                        meeting_data["created_at"] = datetime.fromisoformat(meeting_data["created_at"])
                    except:
                        meeting_data["created_at"] = None

                old_project_id = meeting_data.get("project_id")
                project_id = project_id_map.get(old_project_id)
                if not project_id:
                    continue

                existing = (
                    db.query(ProjectMeeting)
                    .filter(
                        ProjectMeeting.project_id == project_id,
                        ProjectMeeting.meeting_id == meeting_data.get("meeting_id"),
                    )
                    .first()
                )

                if existing and not merge_mode:
                    continue

                meeting_dict = {k: v for k, v in meeting_data.items() if k != "id"}
                meeting_dict["project_id"] = project_id
                meeting = ProjectMeeting(**meeting_dict)
                db.add(meeting)
                stats["project_meetings_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"Project meeting '{meeting_data.get('meeting_id')}': {str(e)}")

        db.commit()

        # Import project milestones
        for milestone_data in data.get("project_milestones", []):
            try:
                for field in ["due_date", "completed_at", "created_at", "updated_at"]:
                    if field in milestone_data and milestone_data[field]:
                        try:
                            milestone_data[field] = datetime.fromisoformat(milestone_data[field])
                        except:
                            milestone_data[field] = None

                old_project_id = milestone_data.get("project_id")
                project_id = project_id_map.get(old_project_id)
                if not project_id:
                    continue

                existing = (
                    db.query(ProjectMilestone)
                    .filter(
                        ProjectMilestone.project_id == project_id,
                        ProjectMilestone.name == milestone_data.get("name"),
                    )
                    .first()
                )

                if existing and not merge_mode:
                    continue

                milestone_dict = {k: v for k, v in milestone_data.items() if k != "id"}
                milestone_dict["project_id"] = project_id
                milestone = ProjectMilestone(**milestone_dict)
                db.add(milestone)
                stats["project_milestones_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"Project milestone '{milestone_data.get('name')}': {str(e)}")

        db.commit()

        # Import project members
        for member_data in data.get("project_members", []):
            try:
                if "added_at" in member_data and member_data["added_at"]:
                    try:
                        member_data["added_at"] = datetime.fromisoformat(member_data["added_at"])
                    except:
                        member_data["added_at"] = None

                old_project_id = member_data.get("project_id")
                project_id = project_id_map.get(old_project_id)
                if not project_id:
                    continue

                if member_data.get("user_mapping_id"):
                    member_data["user_mapping_id"] = user_mapping_id_map.get(member_data["user_mapping_id"])

                existing = (
                    db.query(ProjectMember)
                    .filter(
                        ProjectMember.project_id == project_id,
                        ProjectMember.name == member_data.get("name"),
                    )
                    .first()
                )

                if existing and not merge_mode:
                    continue

                member_dict = {k: v for k, v in member_data.items() if k != "id"}
                member_dict["project_id"] = project_id
                member = ProjectMember(**member_dict)
                db.add(member)
                stats["project_members_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"Project member '{member_data.get('name')}': {str(e)}")

        db.commit()

        # Import project chat sessions
        project_chat_session_id_map = {}
        for session_data in data.get("project_chat_sessions", []):
            try:
                for field in ["created_at", "updated_at"]:
                    if field in session_data and session_data[field]:
                        try:
                            session_data[field] = datetime.fromisoformat(session_data[field])
                        except:
                            session_data[field] = None

                old_project_id = session_data.get("project_id")
                project_id = project_id_map.get(old_project_id)
                if not project_id:
                    continue

                existing = (
                    db.query(ProjectChatSession)
                    .filter(
                        ProjectChatSession.project_id == project_id,
                        ProjectChatSession.title == session_data.get("title"),
                        ProjectChatSession.created_at == session_data.get("created_at"),
                    )
                    .first()
                )

                old_id = session_data.get("id")

                if existing and not merge_mode:
                    project_chat_session_id_map[old_id] = existing.id
                else:
                    session_dict = {k: v for k, v in session_data.items() if k != "id"}
                    session_dict["project_id"] = project_id
                    session = ProjectChatSession(**session_dict)
                    db.add(session)
                    db.flush()
                    project_chat_session_id_map[old_id] = session.id
                    stats["project_chat_sessions_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"Project chat session '{session_data.get('title')}': {str(e)}")

        db.commit()

        # Import project chat messages
        for message_data in data.get("project_chat_messages", []):
            try:
                if "created_at" in message_data and message_data["created_at"]:
                    try:
                        message_data["created_at"] = datetime.fromisoformat(message_data["created_at"])
                    except:
                        message_data["created_at"] = None

                old_session_id = message_data.get("session_id")
                session_id = project_chat_session_id_map.get(old_session_id)
                if not session_id:
                    continue

                message_dict = {k: v for k, v in message_data.items() if k != "id"}
                message_dict["session_id"] = session_id
                message = ProjectChatMessage(**message_dict)
                db.add(message)
                stats["project_chat_messages_imported"] += 1
            except Exception as e:
                stats["errors"].append("Project chat message: " + str(e))

        db.commit()

        # Import project notes
        project_note_id_map = {}
        for note_data in data.get("project_notes", []):
            try:
                for field in ["created_at", "updated_at"]:
                    if field in note_data and note_data[field]:
                        try:
                            note_data[field] = datetime.fromisoformat(note_data[field])
                        except:
                            note_data[field] = None

                old_project_id = note_data.get("project_id")
                project_id = project_id_map.get(old_project_id)
                if not project_id:
                    continue

                existing = (
                    db.query(ProjectNote)
                    .filter(
                        ProjectNote.project_id == project_id,
                        ProjectNote.title == note_data.get("title"),
                        ProjectNote.created_at == note_data.get("created_at"),
                    )
                    .first()
                )

                old_id = note_data.get("id")

                if existing and not merge_mode:
                    project_note_id_map[old_id] = existing.id
                else:
                    note_dict = {k: v for k, v in note_data.items() if k != "id"}
                    note_dict["project_id"] = project_id
                    note = ProjectNote(**note_dict)
                    db.add(note)
                    db.flush()
                    project_note_id_map[old_id] = note.id
                    stats["project_notes_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"Project note '{note_data.get('title')}': {str(e)}")

        db.commit()

        # Import project note attachments
        for attachment_data in data.get("project_note_attachments", []):
            try:
                if "uploaded_at" in attachment_data and attachment_data["uploaded_at"]:
                    try:
                        attachment_data["uploaded_at"] = datetime.fromisoformat(attachment_data["uploaded_at"])
                    except:
                        attachment_data["uploaded_at"] = None

                old_project_id = attachment_data.get("project_id")
                project_id = project_id_map.get(old_project_id)
                if not project_id:
                    continue

                old_note_id = attachment_data.get("note_id")
                note_id = project_note_id_map.get(old_note_id)
                if not note_id:
                    continue

                existing = (
                    db.query(ProjectNoteAttachment)
                    .filter(
                        ProjectNoteAttachment.project_id == project_id,
                        ProjectNoteAttachment.note_id == note_id,
                        ProjectNoteAttachment.filename == attachment_data.get("filename"),
                    )
                    .first()
                )

                if existing and not merge_mode:
                    continue

                attachment_dict = {k: v for k, v in attachment_data.items() if k != "id"}
                attachment_dict["project_id"] = project_id
                attachment_dict["note_id"] = note_id
                attachment = ProjectNoteAttachment(**attachment_dict)
                db.add(attachment)
                stats["project_note_attachments_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"Project note attachment '{attachment_data.get('filename')}': {str(e)}")

        db.commit()

        # Import meetings
        meeting_id_map = {}  # old_id -> new_id mapping for relationships

        for meeting_data in data.get("meetings", []):
            try:
                old_id = meeting_data["id"]

                # Check if meeting already exists (by filename or date+title)
                existing = None
                if "filename" in meeting_data:
                    existing = db.query(Meeting).filter(Meeting.filename == meeting_data["filename"]).first()

                if existing and not merge_mode:
                    stats["meetings_skipped"] += 1
                    meeting_id_map[old_id] = existing.id
                    continue

                # Extract nested data
                transcription_data = meeting_data.pop("transcription", None)
                speakers_data = meeting_data.pop("speakers", [])
                action_items_data = meeting_data.pop("action_items", [])

                # Convert datetime strings back to datetime objects
                for field in [
                    "meeting_date",
                    "upload_date",
                    "created_at",
                    "processing_start_time",
                    "stage_start_time",
                    "embeddings_updated_at",
                ]:
                    if field in meeting_data and meeting_data[field]:
                        try:
                            meeting_data[field] = datetime.fromisoformat(meeting_data[field])
                        except:
                            meeting_data[field] = None

                # Handle foreign key references - map to new IDs or set to NULL
                if "model_configuration_id" in meeting_data and meeting_data["model_configuration_id"]:
                    # Try to map to imported config first
                    old_config_id = meeting_data["model_configuration_id"]
                    new_config_id = model_config_id_map.get(old_config_id)
                    if new_config_id:
                        meeting_data["model_configuration_id"] = new_config_id
                    else:
                        # Check if it exists in database
                        model_exists = (
                            db.query(ModelConfiguration)
                            .filter(ModelConfiguration.id == meeting_data["model_configuration_id"])
                            .first()
                        )
                        if not model_exists:
                            meeting_data["model_configuration_id"] = None

                if "embedding_config_id" in meeting_data and meeting_data["embedding_config_id"]:
                    # Try to map to imported config first
                    old_embed_id = meeting_data["embedding_config_id"]
                    new_embed_id = embedding_config_id_map.get(old_embed_id)
                    if new_embed_id:
                        meeting_data["embedding_config_id"] = new_embed_id
                    else:
                        # Check if it exists in database
                        embed_exists = (
                            db.query(EmbeddingConfiguration)
                            .filter(EmbeddingConfiguration.id == meeting_data["embedding_config_id"])
                            .first()
                        )
                        if not embed_exists:
                            meeting_data["embedding_config_id"] = None

                # Create meeting (without old ID)
                meeting_dict = {k: v for k, v in meeting_data.items() if k not in ["id", "transcription"]}
                meeting = Meeting(**meeting_dict)
                db.add(meeting)
                db.flush()  # Get new ID

                meeting_id_map[old_id] = meeting.id

                # Import transcription
                from ...models import Transcription

                transcription = None
                if transcription_data:
                    trans_dict = {k: v for k, v in transcription_data.items() if k not in ["id", "meeting_id"]}
                    transcription = Transcription(meeting_id=meeting.id, **trans_dict)
                    db.add(transcription)
                    db.flush()

                # Import speakers
                for speaker_data in speakers_data:
                    speaker_dict = {k: v for k, v in speaker_data.items() if k not in ["id", "meeting_id"]}
                    speaker = Speaker(meeting_id=meeting.id, **speaker_dict)
                    db.add(speaker)

                # Import action items (link to transcription, not meeting)
                # First, get or create transcription for this meeting
                from ...models import Transcription

                if not transcription:
                    transcription = db.query(Transcription).filter(Transcription.meeting_id == meeting.id).first()

                if not transcription and action_items_data:
                    # Create a basic transcription record if needed
                    transcription = Transcription(meeting_id=meeting.id, summary="", full_text="")
                    db.add(transcription)
                    db.flush()

                if transcription:
                    for ai_data in action_items_data:
                        # Convert datetime fields
                        for field in ["due_date", "last_synced_at"]:
                            if field in ai_data and ai_data[field]:
                                try:
                                    ai_data[field] = datetime.fromisoformat(ai_data[field])
                                except:
                                    ai_data[field] = None

                        ai_dict = {
                            k: v for k, v in ai_data.items() if k not in ["id", "meeting_id", "transcription_id"]
                        }
                        action_item = ActionItem(transcription_id=transcription.id, **ai_dict)
                        db.add(action_item)

                stats["meetings_imported"] += 1

            except Exception as e:
                stats["errors"].append(f"Meeting '{meeting_data.get('title')}': {str(e)}")

        db.commit()

        # Import meeting links (after all meetings are imported)
        for link_data in data.get("meeting_links", []):
            try:
                # Convert datetime if present
                if "created_at" in link_data and link_data["created_at"]:
                    try:
                        link_data["created_at"] = datetime.fromisoformat(link_data["created_at"])
                    except:
                        link_data["created_at"] = None

                old_source_id = link_data.get("source_meeting_id")
                old_target_id = link_data.get("target_meeting_id")

                # Map old IDs to new IDs
                new_source_id = meeting_id_map.get(old_source_id) if old_source_id else None
                new_target_id = meeting_id_map.get(old_target_id) if old_target_id else None

                if new_source_id and new_target_id:
                    # Check if link already exists
                    existing_link = (
                        db.query(MeetingLink)
                        .filter(
                            MeetingLink.source_meeting_id == new_source_id,
                            MeetingLink.target_meeting_id == new_target_id,
                        )
                        .first()
                    )

                    if not existing_link:
                        # MeetingLink only has source and target IDs, no other fields
                        link = MeetingLink(source_meeting_id=new_source_id, target_meeting_id=new_target_id)
                        db.add(link)
                        stats["links_imported"] += 1

            except Exception as e:
                stats["errors"].append(f"Link {old_source_id}->{old_target_id}: {str(e)}")

        db.commit()

        # Import Drive processed files
        for pf_data in data.get("drive_processed_files", []):
            try:
                # Convert datetime
                if "processed_at" in pf_data and pf_data["processed_at"]:
                    try:
                        pf_data["processed_at"] = datetime.fromisoformat(pf_data["processed_at"])
                    except:
                        pf_data["processed_at"] = None

                # Map old meeting_id to new one
                if "meeting_id" in pf_data and pf_data["meeting_id"]:
                    old_meeting_id = pf_data["meeting_id"]
                    pf_data["meeting_id"] = meeting_id_map.get(old_meeting_id)

                # Check if already exists
                existing_pf = (
                    db.query(GoogleDriveProcessedFile)
                    .filter(GoogleDriveProcessedFile.drive_file_id == pf_data.get("drive_file_id"))
                    .first()
                )

                if not existing_pf:
                    # Align field names with model: drive_file_id, drive_file_name
                    pf_dict = {k: v for k, v in pf_data.items() if k != "id"}
                    processed_file = GoogleDriveProcessedFile(**pf_dict)
                    db.add(processed_file)
                    stats["processed_files_imported"] += 1

            except Exception as e:
                stats["errors"].append(f"Processed file '{pf_data.get('drive_file_name')}': {str(e)}")

        db.commit()

        # Import global chat sessions (metadata only)
        for cs_data in data.get("global_chat_sessions", []):
            try:
                # Convert datetime
                for field in ["created_at", "updated_at"]:
                    if field in cs_data and cs_data[field]:
                        cs_data[field] = datetime.fromisoformat(cs_data[field])

                # Check if already exists
                # Use title + created_at as a simple uniqueness heuristic
                existing_cs = None
                if cs_data.get("title"):
                    existing_cs = (
                        db.query(GlobalChatSession).filter(GlobalChatSession.title == cs_data.get("title")).first()
                    )

                if not existing_cs:
                    # Align to model fields: title, tags, filter_folder, filter_tags, created_at, updated_at
                    cs_dict = {
                        k: v
                        for k, v in cs_data.items()
                        if k in ["title", "tags", "filter_folder", "filter_tags", "created_at", "updated_at"]
                    }
                    chat_session = GlobalChatSession(**cs_dict)
                    db.add(chat_session)
                    stats["chat_sessions_imported"] += 1

            except Exception as e:
                stats["errors"].append(f"Chat session '{cs_data.get('title')}': {str(e)}")

        db.commit()

        # Import diary entries
        for de_data in data.get("diary_entries", []):
            try:
                # Convert datetime fields
                for field in ["created_at", "updated_at", "date"]:
                    if field in de_data and de_data[field]:
                        try:
                            if field == "date":
                                # date field is date type, not datetime
                                de_data[field] = datetime.fromisoformat(de_data[field]).date()
                            else:
                                de_data[field] = datetime.fromisoformat(de_data[field])
                        except:
                            de_data[field] = None

                # Check if already exists by date
                existing_de = db.query(DiaryEntry).filter(DiaryEntry.date == de_data.get("date")).first()

                if not existing_de:
                    # Create new diary entry
                    de_dict = {k: v for k, v in de_data.items() if k != "id"}
                    diary_entry = DiaryEntry(**de_dict)
                    db.add(diary_entry)
                    stats["diary_entries_imported"] += 1
                elif merge_mode:
                    # Update existing entry if merge mode
                    for key, value in de_data.items():
                        if key not in ["id", "date", "created_at"]:
                            setattr(existing_de, key, value)
                    stats["diary_entries_imported"] += 1

            except Exception as e:
                stats["errors"].append(f"Diary entry '{de_data.get('date')}': {str(e)}")

        # Import standalone action items (those not attached to meetings)
        for ai_data in data.get("standalone_action_items", []):
            try:
                # Convert datetime fields
                for field in ["due_date", "last_synced_at"]:
                    if field in ai_data and ai_data[field]:
                        try:
                            ai_data[field] = datetime.fromisoformat(ai_data[field])
                        except:
                            ai_data[field] = None

                # Remove id and transcription_id (should be None anyway)
                ai_dict = {k: v for k, v in ai_data.items() if k not in ["id", "transcription_id"]}
                action_item = ActionItem(**ai_dict)
                db.add(action_item)
                stats["standalone_action_items_imported"] = stats.get("standalone_action_items_imported", 0) + 1
            except Exception as e:
                stats["errors"].append(f"Standalone action item '{ai_data.get('task')}': {str(e)}")

        db.commit()

        return {"success": True, "message": "Import completed", "statistics": stats}

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
