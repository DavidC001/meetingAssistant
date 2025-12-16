"""
Backup and restore endpoints for data export/import.

This module provides functionality to export all application data
and import it into another instance.
"""

import json
import io
import logging
from datetime import datetime
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import inspect

from ...database import get_db
from ...models import (
    Meeting, Speaker, ActionItem, Attachment,
    UserMapping, GoogleDriveSyncConfig, GoogleDriveProcessedFile,
    GlobalChatSession, MeetingLink
)
from ... import crud

router = APIRouter(prefix="/backup", tags=["backup"])
logger = logging.getLogger(__name__)


def serialize_model(obj: Any) -> Dict[str, Any]:
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
        elif isinstance(value, (str, int, float, bool)):
            result[column.key] = value
        elif isinstance(value, bytes):
            # Skip binary data
            result[column.key] = None
        else:
            # Try to convert to string for other types
            try:
                result[column.key] = str(value)
            except:
                result[column.key] = None
    return result


@router.get("/export")
async def export_data(db: Session = Depends(get_db)):
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
                meeting_dict['transcription'] = serialize_model(transcription)
            else:
                meeting_dict['transcription'] = None
            
            # Include speakers
            speakers = db.query(Speaker).filter(Speaker.meeting_id == meeting.id).all()
            meeting_dict['speakers'] = [serialize_model(s) for s in speakers]
            
            # Include action items (through transcription relationship)
            if transcription:
                action_items = db.query(ActionItem).filter(ActionItem.transcription_id == transcription.id).all()
                meeting_dict['action_items'] = [serialize_model(a) for a in action_items]
            else:
                meeting_dict['action_items'] = []
            
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
        
        # Compile export data
        export_data = {
            "export_metadata": {
                "version": "1.0",
                "exported_at": datetime.utcnow().isoformat(),
                "counts": {
                    "meetings": len(meetings_data),
                    "user_mappings": len(user_mappings_data),
                    "links": len(links_data),
                    "processed_files": len(processed_files_data),
                    "chat_sessions": len(chat_sessions_data)
                }
            },
            "meetings": meetings_data,
            "user_mappings": user_mappings_data,
            "meeting_links": links_data,
            "drive_sync_config": drive_config_data,
            "drive_processed_files": processed_files_data,
            "global_chat_sessions": chat_sessions_data
        }
        
        # Create JSON file
        json_str = json.dumps(export_data, indent=2, ensure_ascii=False)
        json_bytes = json_str.encode('utf-8')
        
        # Return as downloadable file
        filename = f"meeting_assistant_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        
        return StreamingResponse(
            io.BytesIO(json_bytes),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(json_bytes))
            }
        )
        
    except Exception as e:
        logger.error(f"Export error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    merge_mode: bool = False,
    db: Session = Depends(get_db)
):
    """
    Import data from a backup JSON file.
    
    Args:
        file: JSON backup file
        merge_mode: If True, merge with existing data. If False, skip duplicates.
    
    Returns:
        Import statistics and any errors encountered
    """
    try:
        # Read and parse JSON
        content = await file.read()
        data = json.loads(content)
        
        stats = {
            "meetings_imported": 0,
            "meetings_skipped": 0,
            "user_mappings_imported": 0,
            "links_imported": 0,
            "processed_files_imported": 0,
            "chat_sessions_imported": 0,
            "errors": []
        }
        
        # Validate export version
        if data.get("export_metadata", {}).get("version") != "1.0":
            raise HTTPException(status_code=400, detail="Unsupported backup version")
        
        # Import user mappings first (they may be referenced by other data)
        for um_data in data.get("user_mappings", []):
            try:
                # Check if already exists by name
                existing = db.query(UserMapping).filter(
                    UserMapping.name == um_data.get("name")
                ).first()
                
                if not existing:
                    user_mapping = UserMapping(**{k: v for k, v in um_data.items() if k != 'id'})
                    db.add(user_mapping)
                    stats["user_mappings_imported"] += 1
            except Exception as e:
                stats["errors"].append(f"User mapping '{um_data.get('name')}': {str(e)}")
        
        db.commit()
        
        # Import meetings
        meeting_id_map = {}  # old_id -> new_id mapping for relationships
        
        for meeting_data in data.get("meetings", []):
            try:
                old_id = meeting_data["id"]
                
                # Check if meeting already exists (by filename or date+title)
                existing = None
                if "filename" in meeting_data:
                    existing = db.query(Meeting).filter(
                        Meeting.filename == meeting_data["filename"]
                    ).first()
                
                if existing and not merge_mode:
                    stats["meetings_skipped"] += 1
                    meeting_id_map[old_id] = existing.id
                    continue
                
                # Extract nested data
                transcription_data = meeting_data.pop("transcription", None)
                speakers_data = meeting_data.pop("speakers", [])
                action_items_data = meeting_data.pop("action_items", [])
                
                # Convert datetime strings back to datetime objects
                for field in ['meeting_date', 'upload_date', 'created_at', 'processing_start_time', 'stage_start_time', 'embeddings_updated_at']:
                    if field in meeting_data and meeting_data[field]:
                        try:
                            meeting_data[field] = datetime.fromisoformat(meeting_data[field])
                        except:
                            meeting_data[field] = None
                
                # Handle foreign key references - set to NULL if referenced records don't exist
                from ...models import ModelConfiguration, EmbeddingConfiguration
                if 'model_configuration_id' in meeting_data and meeting_data['model_configuration_id']:
                    model_exists = db.query(ModelConfiguration).filter(
                        ModelConfiguration.id == meeting_data['model_configuration_id']
                    ).first()
                    if not model_exists:
                        meeting_data['model_configuration_id'] = None
                
                if 'embedding_config_id' in meeting_data and meeting_data['embedding_config_id']:
                    embed_exists = db.query(EmbeddingConfiguration).filter(
                        EmbeddingConfiguration.id == meeting_data['embedding_config_id']
                    ).first()
                    if not embed_exists:
                        meeting_data['embedding_config_id'] = None
                
                # Create meeting (without old ID)
                meeting_dict = {k: v for k, v in meeting_data.items() if k not in ['id', 'transcription']}
                meeting = Meeting(**meeting_dict)
                db.add(meeting)
                db.flush()  # Get new ID
                
                meeting_id_map[old_id] = meeting.id
                
                # Import transcription
                from ...models import Transcription
                transcription = None
                if transcription_data:
                    trans_dict = {k: v for k, v in transcription_data.items() if k not in ['id', 'meeting_id']}
                    transcription = Transcription(meeting_id=meeting.id, **trans_dict)
                    db.add(transcription)
                    db.flush()
                
                # Import speakers
                for speaker_data in speakers_data:
                    speaker_dict = {k: v for k, v in speaker_data.items() if k not in ['id', 'meeting_id']}
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
                        for field in ['due_date', 'last_synced_at']:
                            if field in ai_data and ai_data[field]:
                                try:
                                    ai_data[field] = datetime.fromisoformat(ai_data[field])
                                except:
                                    ai_data[field] = None
                        
                        ai_dict = {k: v for k, v in ai_data.items() if k not in ['id', 'meeting_id', 'transcription_id']}
                        action_item = ActionItem(transcription_id=transcription.id, **ai_dict)
                        db.add(action_item)
                
                stats["meetings_imported"] += 1
                
            except Exception as e:
                stats["errors"].append(f"Meeting '{meeting_data.get('title')}': {str(e)}")
        
        db.commit()
        
        # Import meeting links (after all meetings are imported)
        for link_data in data.get("meeting_links", []):
            try:
                old_source_id = link_data.get("source_meeting_id")
                old_target_id = link_data.get("target_meeting_id")
                
                # Map old IDs to new IDs
                new_source_id = meeting_id_map.get(old_source_id) if old_source_id else None
                new_target_id = meeting_id_map.get(old_target_id) if old_target_id else None
                
                if new_source_id and new_target_id:
                    # Check if link already exists
                    existing_link = db.query(MeetingLink).filter(
                        MeetingLink.source_meeting_id == new_source_id,
                        MeetingLink.target_meeting_id == new_target_id
                    ).first()
                    
                    if not existing_link:
                        # MeetingLink only has source and target IDs, no other fields
                        link = MeetingLink(
                            source_meeting_id=new_source_id,
                            target_meeting_id=new_target_id
                        )
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
                    pf_data["processed_at"] = datetime.fromisoformat(pf_data["processed_at"])
                
                # Map old meeting_id to new one
                if "meeting_id" in pf_data and pf_data["meeting_id"]:
                    old_meeting_id = pf_data["meeting_id"]
                    pf_data["meeting_id"] = meeting_id_map.get(old_meeting_id)
                
                # Check if already exists
                existing_pf = db.query(GoogleDriveProcessedFile).filter(
                    GoogleDriveProcessedFile.drive_file_id == pf_data.get("drive_file_id")
                ).first()
                
                if not existing_pf:
                    # Align field names with model: drive_file_id, drive_file_name
                    pf_dict = {k: v for k, v in pf_data.items() if k != 'id'}
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
                for field in ['created_at', 'updated_at']:
                    if field in cs_data and cs_data[field]:
                        cs_data[field] = datetime.fromisoformat(cs_data[field])
                
                # Check if already exists
                existing_cs = db.query(GlobalChatSession).filter(
                    GlobalChatSession.session_id == cs_data["session_id"]
                ).first()
                
                if not existing_cs:
                    cs_dict = {k: v for k, v in cs_data.items() if k != 'id'}
                    chat_session = GlobalChatSession(**cs_dict)
                    db.add(chat_session)
                    stats["chat_sessions_imported"] += 1
                    
            except Exception as e:
                stats["errors"].append(f"Chat session '{cs_data.get('session_id')}': {str(e)}")
        
        db.commit()
        
        return {
            "success": True,
            "message": "Import completed",
            "statistics": stats
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
