# Google Drive Synchronization

This document explains how to set up and use the Google Drive synchronization feature in the Meeting Assistant.

## Overview

The Google Drive synchronization feature allows you to:
- Automatically monitor a Google Drive folder for new meeting files
- Download files automatically
- Process them through the meeting transcription pipeline
- Move processed files to a "processed" folder
- Use the file's upload date as the meeting date

## Prerequisites

1. A Google Cloud Project with the following APIs enabled:
   - Google Drive API
   - Google Calendar API (if using calendar features)

2. OAuth 2.0 credentials configured

## Setup Instructions

### 1. Configure Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. In Google Cloud Console, go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Add authorized redirect URIs:
   - For local development: `http://localhost:3000/settings`
   - For production: `https://yourdomain.com/settings`
5. Save the client ID and client secret

### 3. Configure Environment Variables

Add the following to your `.env` file:

```env
# Google OAuth Credentials (same for both Calendar and Drive)
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/settings

# Google Drive Sync Configuration
GOOGLE_DRIVE_SYNC_ENABLED=false  # Set to true to enable
GOOGLE_DRIVE_SYNC_FOLDER_ID=     # Optional: can be configured via UI
GOOGLE_DRIVE_PROCESSED_FOLDER_ID= # Optional: will be auto-created
GOOGLE_DRIVE_SYNC_INTERVAL_MINUTES=15
GOOGLE_DRIVE_AUTO_PROCESS=true
```

### 4. Restart Services

After updating the environment variables, restart your Docker containers:

```bash
docker-compose down
docker-compose up -d
```

## Using the Google Drive Sync Feature

### 1. Connect to Google Drive

1. Open the Meeting Assistant web interface
2. Go to Settings > Google Drive tab
3. Click "Connect to Google Drive"
4. Complete the OAuth authorization in the popup window
5. After authorization, refresh the Settings page

### 2. Configure Sync Folder

1. In Google Drive, navigate to the folder you want to monitor
2. Copy the folder ID from the URL:
   - URL format: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - The folder ID is the long string after `/folders/`
3. Paste the folder ID into the "Sync Folder ID" field in the Settings
4. (Optional) Provide a "Processed Folder ID" or leave empty to auto-create
5. Set your preferred sync interval (minimum 5 minutes)
6. Enable "Automatically process downloaded files" if desired
7. Enable "Enable automatic synchronization"
8. Click "Save Configuration"

### 3. Trigger Manual Sync

You can manually trigger a sync at any time by clicking the "Trigger Sync Now" button.

### 4. Automatic Sync

Once enabled, the system will:
- Check the configured folder every N minutes (default: 15)
- Download any new files with allowed extensions
- Create meeting records with the file's upload date as the meeting date
- Process files automatically (if enabled)
- Move processed files to the "processed" subfolder in Google Drive

## Supported File Types

The system supports the same file types as manual uploads:
- Audio: `.wav`, `.mp3`, `.m4a`, `.flac`
- Video: `.mp4`, `.mkv`, `.avi`, `.mov`

Files with unsupported extensions will be skipped and marked as processed to avoid repeated attempts.

## Monitoring

### View Sync Status

In the Settings > Google Drive tab, you can see:
- Connection status
- Configuration status
- Last sync timestamp
- Recently processed files

### View Processed Files

The "Recently Processed Files" section shows:
- File name
- Processing timestamp
- Associated meeting ID
- Whether the file was moved to the processed folder

### Check Logs

To view detailed sync logs, check the Celery worker logs:

```bash
docker-compose logs -f worker
```

## Troubleshooting

### Authentication Issues

**Problem**: "Not authenticated with Google Drive"

**Solution**: 
1. Ensure your OAuth credentials are correct in the `.env` file
2. Try disconnecting and reconnecting in the Settings
3. Check that you've added yourself as a test user in Google Cloud Console

### Files Not Being Processed

**Problem**: New files in the folder aren't being processed

**Solution**:
1. Verify that sync is enabled in the configuration
2. Check the sync interval - it may not have run yet
3. Verify the folder ID is correct
4. Check file extensions are supported
5. Review Celery worker logs for errors

### Permission Errors

**Problem**: "Error downloading file" or "Error moving file"

**Solution**:
1. Ensure the service account has proper permissions on the folder
2. Check that the Google Drive API is enabled
3. Verify OAuth scopes include Drive access

### Celery Beat Not Running

**Problem**: Automatic sync not triggering

**Solution**:
Start Celery Beat along with the worker:

```bash
celery -A app.worker.celery_app beat --loglevel=info
```

Or ensure your docker-compose includes both worker and beat services.

## Advanced Configuration

### Change Sync Interval Dynamically

You can change the sync interval through the UI without restarting services. The new interval will be used for subsequent sync operations.

### Disable Auto-Processing

If you want to download files but not automatically process them:
1. Uncheck "Automatically process downloaded files"
2. Save the configuration
3. Files will be downloaded but not queued for processing
4. You can manually upload them later through the UI

### Multiple Folders

Currently, the system supports monitoring one folder at a time. To monitor multiple folders:
1. Configure one primary sync folder
2. Use folder sharing to consolidate files from multiple sources into that folder

## API Endpoints

The Google Drive sync feature exposes the following API endpoints:

- `GET /api/v1/google-drive/status` - Get current sync status
- `GET /api/v1/google-drive/auth` - Get OAuth authorization URL
- `POST /api/v1/google-drive/disconnect` - Disconnect from Google Drive
- `POST /api/v1/google-drive/config` - Update sync configuration
- `POST /api/v1/google-drive/sync` - Manually trigger sync
- `GET /api/v1/google-drive/processed-files` - List processed files

## Security Considerations

1. **OAuth Credentials**: Keep your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` secure
2. **Folder Access**: Only grant access to folders containing meeting files
3. **User Authentication**: The OAuth token is stored encrypted in the database
4. **Token Refresh**: Tokens are automatically refreshed when expired
5. **Disconnect**: You can revoke access at any time through the Settings

## Performance Notes

- The sync task runs in the background and doesn't block other operations
- Large files may take time to download based on network speed
- Processing happens asynchronously after download
- Multiple files are processed sequentially to manage system resources

## Support

For issues or questions about Google Drive synchronization:
1. Check the Celery worker logs
2. Verify your configuration in the Settings
3. Review this documentation
4. Check the Google Cloud Console for API quota limits
