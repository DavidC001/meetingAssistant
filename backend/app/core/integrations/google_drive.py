"""
Google Drive integration for automatic file synchronization.

This module provides functionality to authenticate with Google Drive,
monitor a folder for new files, download them, and move them to a processed folder.
"""

import io
import json
import os
from datetime import datetime
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
from sqlalchemy.orm import Session

from ... import crud


class GoogleDriveService:
    """Service for managing Google Drive integration."""

    # OAuth 2.0 scopes for Google Drive (includes Calendar for unified auth)
    SCOPES = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
    ]

    # OAuth2 configuration (these should be set via environment variables)
    CLIENT_CONFIG = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/oauth-callback.html")],
        }
    }

    def __init__(self, db: Session, user_id: str = "default"):
        """Initialize the Google Drive service."""
        self.db = db
        self.user_id = user_id
        self.credentials = None
        self.service = None
        self._load_credentials()

    def _load_credentials(self):
        """Load credentials from database."""
        db_creds = crud.get_google_drive_credentials(self.db, self.user_id)
        if db_creds:
            try:
                creds_dict = json.loads(db_creds.credentials_json)
                self.credentials = Credentials.from_authorized_user_info(creds_dict, self.SCOPES)

                # Refresh token if expired
                if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                    try:
                        self.credentials.refresh(Request())
                        self._save_credentials()
                    except Exception as e:
                        # Clear invalid credentials to prevent repeated errors
                        error_str = str(e)
                        if "invalid_grant" in error_str or "Token has been expired or revoked" in error_str:
                            # Silently clear invalid credentials - user needs to re-authenticate
                            crud.delete_google_drive_credentials(self.db, self.user_id)
                        self.credentials = None
                        return

                if self.credentials and self.credentials.valid:
                    self.service = build("drive", "v3", credentials=self.credentials)
            except Exception:
                # Invalid credentials format, ignore
                self.credentials = None

    def _save_credentials(self):
        """Save credentials to database."""
        if self.credentials:
            creds_dict = {
                "token": self.credentials.token,
                "refresh_token": self.credentials.refresh_token,
                "token_uri": self.credentials.token_uri,
                "client_id": self.credentials.client_id,
                "client_secret": self.credentials.client_secret,
                "scopes": self.credentials.scopes,
            }
            crud.save_google_drive_credentials(self.db, credentials_json=json.dumps(creds_dict), user_id=self.user_id)

    def get_authorization_url(self) -> str:
        """Get the OAuth2 authorization URL."""
        if not self.CLIENT_CONFIG["web"]["client_id"] or not self.CLIENT_CONFIG["web"]["client_secret"]:
            raise ValueError(
                "Google Drive credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
            )

        flow = Flow.from_client_config(
            self.CLIENT_CONFIG, scopes=self.SCOPES, redirect_uri=self.CLIENT_CONFIG["web"]["redirect_uris"][0]
        )

        auth_url, _ = flow.authorization_url(
            access_type="offline", include_granted_scopes="false", prompt="consent", login_hint=None
        )

        return auth_url

    def handle_oauth_callback(self, authorization_response: str | None = None, code: str | None = None) -> bool:
        """
        Handle the OAuth2 callback and save credentials.

        Args:
            authorization_response: The full callback URL with authorization code

        Returns:
            True if authentication was successful
        """
        if not self.CLIENT_CONFIG["web"]["client_id"] or not self.CLIENT_CONFIG["web"]["client_secret"]:
            raise ValueError("Google Drive credentials not configured")

        flow = Flow.from_client_config(
            self.CLIENT_CONFIG, scopes=self.SCOPES, redirect_uri=self.CLIENT_CONFIG["web"]["redirect_uris"][0]
        )

        try:
            # Prefer using the authorization code directly to avoid state persistence requirements
            if code:
                flow.fetch_token(code=code)
            elif authorization_response:
                flow.fetch_token(authorization_response=authorization_response)
            else:
                raise ValueError("Missing authorization code")
            self.credentials = flow.credentials
            self._save_credentials()
            self.service = build("drive", "v3", credentials=self.credentials)
            return True
        except Exception as e:
            print(f"Error during OAuth callback: {e}")
            return False

    def is_authenticated(self) -> bool:
        """Check if the service is authenticated."""
        return self.credentials is not None and self.credentials.valid

    def disconnect(self):
        """Disconnect and remove stored credentials."""
        crud.delete_google_drive_credentials(self.db, self.user_id)
        self.credentials = None
        self.service = None

    def list_files_in_folder(self, folder_id: str, page_size: int = 100) -> list[dict[str, Any]]:
        """
        List all files in a specific Google Drive folder.

        Args:
            folder_id: The ID of the folder to list files from
            page_size: Number of files to retrieve per page

        Returns:
            List of file metadata dictionaries
        """
        if not self.is_authenticated():
            raise ValueError("Not authenticated with Google Drive")

        try:
            results = (
                self.service.files()
                .list(
                    q=f"'{folder_id}' in parents and trashed=false",
                    pageSize=page_size,
                    fields="files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)",
                    orderBy="createdTime desc",
                )
                .execute()
            )

            return results.get("files", [])
        except HttpError as e:
            print(f"Error listing files: {e}")
            raise

    def download_file(self, file_id: str, destination_path: str) -> tuple[str, datetime]:
        """
        Download a file from Google Drive.

        Args:
            file_id: The ID of the file to download
            destination_path: Local path where the file should be saved

        Returns:
            Tuple of (file_path, upload_date)
        """
        if not self.is_authenticated():
            raise ValueError("Not authenticated with Google Drive")

        try:
            # Get file metadata first
            file_metadata = self.service.files().get(fileId=file_id, fields="name, createdTime").execute()

            # Download file content
            request = self.service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)

            done = False
            while not done:
                status, done = downloader.next_chunk()
                if status:
                    print(f"Download progress: {int(status.progress() * 100)}%")

            # Save to destination
            with open(destination_path, "wb") as f:
                f.write(fh.getvalue())

            # Parse the upload date
            upload_date = datetime.fromisoformat(file_metadata["createdTime"].replace("Z", "+00:00"))

            return destination_path, upload_date

        except HttpError as e:
            print(f"Error downloading file: {e}")
            raise

    def move_file(self, file_id: str, source_folder_id: str, destination_folder_id: str) -> bool:
        """
        Move a file from one folder to another in Google Drive.

        Args:
            file_id: The ID of the file to move
            source_folder_id: The ID of the source folder
            destination_folder_id: The ID of the destination folder

        Returns:
            True if successful
        """
        if not self.is_authenticated():
            raise ValueError("Not authenticated with Google Drive")

        try:
            # Remove file from source folder and add to destination folder
            self.service.files().update(
                fileId=file_id, addParents=destination_folder_id, removeParents=source_folder_id, fields="id, parents"
            ).execute()

            return True
        except HttpError as e:
            print(f"Error moving file: {e}")
            raise

    def get_folder_id_by_name(self, folder_name: str, parent_folder_id: str | None = None) -> str | None:
        """
        Find a folder by name and optionally parent folder.

        Args:
            folder_name: Name of the folder to find
            parent_folder_id: Optional parent folder ID to search within

        Returns:
            Folder ID if found, None otherwise
        """
        if not self.is_authenticated():
            raise ValueError("Not authenticated with Google Drive")

        try:
            query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
            if parent_folder_id:
                query += f" and '{parent_folder_id}' in parents"

            results = self.service.files().list(q=query, spaces="drive", fields="files(id, name)", pageSize=1).execute()

            files = results.get("files", [])
            if files:
                return files[0]["id"]
            return None
        except HttpError as e:
            print(f"Error finding folder: {e}")
            return None

    def create_folder(self, folder_name: str, parent_folder_id: str | None = None) -> str:
        """
        Create a new folder in Google Drive.

        Args:
            folder_name: Name of the folder to create
            parent_folder_id: Optional parent folder ID

        Returns:
            ID of the created folder
        """
        if not self.is_authenticated():
            raise ValueError("Not authenticated with Google Drive")

        try:
            file_metadata = {"name": folder_name, "mimeType": "application/vnd.google-apps.folder"}

            if parent_folder_id:
                file_metadata["parents"] = [parent_folder_id]

            folder = self.service.files().create(body=file_metadata, fields="id").execute()

            return folder.get("id")
        except HttpError as e:
            print(f"Error creating folder: {e}")
            raise

    def ensure_processed_folder(self, source_folder_id: str) -> str:
        """
        Ensure a 'processed' folder exists in the source folder.

        Args:
            source_folder_id: The ID of the source folder

        Returns:
            ID of the processed folder
        """
        processed_folder_id = self.get_folder_id_by_name("processed", source_folder_id)

        if not processed_folder_id:
            processed_folder_id = self.create_folder("processed", source_folder_id)

        return processed_folder_id
