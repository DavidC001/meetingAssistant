"""
Google Calendar integration for syncing action items.

This module provides functionality to authenticate with Google Calendar
and sync action items as calendar events.
"""

import json
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from sqlalchemy.orm import Session
from .. import crud


class GoogleCalendarService:
    """Service for managing Google Calendar integration."""
    
    # OAuth 2.0 scopes for Google Calendar
    SCOPES = ['https://www.googleapis.com/auth/calendar.events']
    
    # OAuth2 configuration (these should be set via environment variables)
    CLIENT_CONFIG = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/calendar/callback")]
        }
    }
    
    def __init__(self, db: Session, user_id: str = "default"):
        """Initialize the Google Calendar service."""
        self.db = db
        self.user_id = user_id
        self.credentials = None
        self.service = None
        self._load_credentials()
    
    def _load_credentials(self):
        """Load credentials from database."""
        db_creds = crud.get_google_calendar_credentials(self.db, self.user_id)
        if db_creds:
            creds_dict = json.loads(db_creds.credentials_json)
            self.credentials = Credentials.from_authorized_user_info(creds_dict, self.SCOPES)
            
            # Refresh token if expired
            if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                try:
                    self.credentials.refresh(Request())
                    self._save_credentials()
                except Exception as e:
                    print(f"Error refreshing credentials: {e}")
                    self.credentials = None
            
            if self.credentials and self.credentials.valid:
                self.service = build('calendar', 'v3', credentials=self.credentials)
    
    def _save_credentials(self):
        """Save credentials to database."""
        if self.credentials:
            creds_dict = {
                'token': self.credentials.token,
                'refresh_token': self.credentials.refresh_token,
                'token_uri': self.credentials.token_uri,
                'client_id': self.credentials.client_id,
                'client_secret': self.credentials.client_secret,
                'scopes': self.credentials.scopes
            }
            crud.save_google_calendar_credentials(
                self.db,
                credentials_json=json.dumps(creds_dict),
                user_id=self.user_id
            )
    
    def get_authorization_url(self) -> str:
        """Get the OAuth2 authorization URL."""
        if not self.CLIENT_CONFIG["web"]["client_id"] or not self.CLIENT_CONFIG["web"]["client_secret"]:
            raise ValueError("Google Calendar credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.")
        
        flow = Flow.from_client_config(
            self.CLIENT_CONFIG,
            scopes=self.SCOPES,
            redirect_uri=self.CLIENT_CONFIG["web"]["redirect_uris"][0]
        )
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        return auth_url
    
    def authorize_with_code(self, code: str) -> bool:
        """Complete OAuth2 authorization with the provided code."""
        try:
            flow = Flow.from_client_config(
                self.CLIENT_CONFIG,
                scopes=self.SCOPES,
                redirect_uri=self.CLIENT_CONFIG["web"]["redirect_uris"][0]
            )
            
            flow.fetch_token(code=code)
            self.credentials = flow.credentials
            self.service = build('calendar', 'v3', credentials=self.credentials)
            
            self._save_credentials()
            return True
        except Exception as e:
            print(f"Error authorizing with code: {e}")
            return False
    
    def is_connected(self) -> bool:
        """Check if the service is connected to Google Calendar."""
        return self.credentials is not None and self.credentials.valid and self.service is not None
    
    def get_user_info(self) -> Optional[Dict[str, Any]]:
        """Get information about the connected Google account."""
        if not self.is_connected():
            return None
        
        try:
            # Get calendar list to extract user email
            calendar_list = self.service.calendarList().list(maxResults=1).execute()
            if calendar_list.get('items'):
                return {
                    'email': calendar_list['items'][0].get('id'),
                    'connected': True
                }
        except HttpError as e:
            print(f"Error getting user info: {e}")
        
        return None
    
    def disconnect(self):
        """Disconnect from Google Calendar."""
        crud.delete_google_calendar_credentials(self.db, self.user_id)
        self.credentials = None
        self.service = None
    
    def create_event_from_action_item(self, action_item, meeting_title: str = None) -> Optional[str]:
        """
        Create a Google Calendar event from an action item.
        
        Args:
            action_item: The action item database object
            meeting_title: Optional meeting title for context
            
        Returns:
            The created event ID or None if failed
        """
        if not self.is_connected():
            raise ValueError("Not connected to Google Calendar")
        
        # Parse due date or use default (1 week from now)
        due_date = None
        if action_item.due_date and action_item.due_date.lower() != "tbd":
            try:
                # Try to parse various date formats
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S"]:
                    try:
                        due_date = datetime.strptime(action_item.due_date, fmt)
                        break
                    except ValueError:
                        continue
            except Exception as e:
                print(f"Error parsing date: {e}")
        
        if not due_date:
            due_date = datetime.now() + timedelta(days=7)
        
        # Set event time (9 AM on due date)
        start_time = due_date.replace(hour=9, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(hours=1)
        
        # Build event description
        description_parts = []
        if meeting_title:
            description_parts.append(f"From meeting: {meeting_title}")
        if action_item.owner:
            description_parts.append(f"Owner: {action_item.owner}")
        if action_item.notes:
            description_parts.append(f"\nNotes:\n{action_item.notes}")
        
        description_parts.append(f"\n\n[Action Item ID: {action_item.id}]")
        
        event = {
            'summary': action_item.task,
            'description': '\n'.join(description_parts),
            'start': {
                'dateTime': start_time.isoformat(),
                'timeZone': 'UTC',
            },
            'end': {
                'dateTime': end_time.isoformat(),
                'timeZone': 'UTC',
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},  # 1 day before
                    {'method': 'popup', 'minutes': 60},       # 1 hour before
                ],
            },
        }
        
        # Add color coding based on priority
        if action_item.priority:
            color_map = {
                'high': '11',  # Red
                'medium': '5',  # Yellow
                'low': '2',    # Green
            }
            event['colorId'] = color_map.get(action_item.priority.lower(), '1')
        
        try:
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event
            ).execute()
            
            return created_event.get('id')
        except HttpError as e:
            print(f"Error creating calendar event: {e}")
            raise
    
    def update_event(self, event_id: str, action_item, meeting_title: str = None) -> bool:
        """Update an existing Google Calendar event."""
        if not self.is_connected():
            raise ValueError("Not connected to Google Calendar")
        
        try:
            # Get existing event
            event = self.service.events().get(
                calendarId='primary',
                eventId=event_id
            ).execute()
            
            # Update fields
            event['summary'] = action_item.task
            
            # Update due date if changed
            if action_item.due_date and action_item.due_date.lower() != "tbd":
                try:
                    due_date = None
                    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d %H:%M:%S"]:
                        try:
                            due_date = datetime.strptime(action_item.due_date, fmt)
                            break
                        except ValueError:
                            continue
                    
                    if due_date:
                        start_time = due_date.replace(hour=9, minute=0, second=0, microsecond=0)
                        end_time = start_time + timedelta(hours=1)
                        event['start'] = {
                            'dateTime': start_time.isoformat(),
                            'timeZone': 'UTC',
                        }
                        event['end'] = {
                            'dateTime': end_time.isoformat(),
                            'timeZone': 'UTC',
                        }
                except Exception as e:
                    print(f"Error updating date: {e}")
            
            # Update description
            description_parts = []
            if meeting_title:
                description_parts.append(f"From meeting: {meeting_title}")
            if action_item.owner:
                description_parts.append(f"Owner: {action_item.owner}")
            if action_item.notes:
                description_parts.append(f"\nNotes:\n{action_item.notes}")
            description_parts.append(f"\n\n[Action Item ID: {action_item.id}]")
            event['description'] = '\n'.join(description_parts)
            
            # Update priority color
            if action_item.priority:
                color_map = {
                    'high': '11',
                    'medium': '5',
                    'low': '2',
                }
                event['colorId'] = color_map.get(action_item.priority.lower(), '1')
            
            self.service.events().update(
                calendarId='primary',
                eventId=event_id,
                body=event
            ).execute()
            
            return True
        except HttpError as e:
            print(f"Error updating calendar event: {e}")
            return False
    
    def delete_event(self, event_id: str) -> bool:
        """Delete a Google Calendar event."""
        if not self.is_connected():
            raise ValueError("Not connected to Google Calendar")
        
        try:
            self.service.events().delete(
                calendarId='primary',
                eventId=event_id
            ).execute()
            return True
        except HttpError as e:
            print(f"Error deleting calendar event: {e}")
            return False
