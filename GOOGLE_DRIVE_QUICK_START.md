# Google Drive Sync - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Enable Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Enable "Google Drive API" from the API Library
4. Create OAuth 2.0 credentials (Web application type)
5. Add redirect URI: `http://localhost:3000/settings` (or your domain)

### 2. Configure Environment

Add to your `.env` file:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/settings
GOOGLE_DRIVE_SYNC_ENABLED=true
```

### 3. Start Services

```bash
# Restart to apply new configuration
docker-compose down
docker-compose up -d

# Or for CPU-only:
docker-compose -f docker-compose.yml -f docker-compose.cpu.yml down
docker-compose -f docker-compose.yml -f docker-compose.cpu.yml up -d
```

### 4. Connect in UI

1. Open http://localhost:3000
2. Go to **Settings** → **Google Drive** tab
3. Click **"Connect to Google Drive"**
4. Authorize in popup window
5. Refresh the page after authorization

### 5. Configure Sync Folder

1. In Google Drive, create or open a folder
2. Copy the folder ID from URL: `https://drive.google.com/drive/folders/FOLDER_ID`
3. Paste the ID in **"Sync Folder ID"** field
4. Choose sync mode:
   - **Manual**: Sync only when you click "Trigger Sync Now"
   - **Scheduled**: Sync automatically once per day at a specific time (default: 4 AM)
5. If using scheduled mode, set your preferred time (24-hour format)
6. Check **"Enable automatic synchronization"** (for scheduled mode)
7. Check **"Automatically process downloaded files"**
8. Click **"Save Configuration"**

### 6. Test It!

**For Manual Mode:**
1. Upload a test audio/video file to your Google Drive folder
2. Click **"Trigger Sync Now"**
3. Check **"Recently Processed Files"** section
4. Go to **Meetings** to see the processed meeting with the file's upload date

**For Scheduled Mode:**
1. Upload a test audio/video file to your Google Drive folder
2. Wait until the scheduled time (or trigger manually to test)
3. Check **"Recently Processed Files"** section
4. Go to **Meetings** to see the processed meeting with the file's upload date

## ✅ Done!

Your Meeting Assistant will now:
- **Manual Mode**: Sync only when you click "Trigger Sync Now"
- **Scheduled Mode**: Automatically check the folder once per day at your configured time (e.g., 4 AM)

In both modes, the system will:
- Download new meeting files
- Process them (transcription + analysis)
- Use the file's upload date as the meeting date
- Move processed files to a "processed" subfolder

## 📝 Supported File Types

Audio: `.wav`, `.mp3`, `.m4a`, `.flac`
Video: `.mp4`, `.mkv`, `.avi`, `.mov`

## 🔧 Troubleshooting

**Not syncing?**
- For **Manual Mode**: Click "Trigger Sync Now" button
- For **Scheduled Mode**: 
   - Check Celery Beat is running: `docker-compose logs beat`
   - Verify sync is enabled in Settings
   - Confirm it's the right time (sync runs within 30 minutes of scheduled time)
   - Check if it already synced today
- Verify folder ID is correct

**Authentication failed?**
- Verify OAuth credentials in `.env`
- Check redirect URI matches exactly
- Add yourself as test user in Google Cloud Console

**Files not processing?**
- Check file extensions are supported
- Review Celery worker logs: `docker-compose logs worker`
- Verify "Auto-process" is enabled

## 📚 More Information

See [GOOGLE_DRIVE_SYNC.md](./GOOGLE_DRIVE_SYNC.md) for detailed documentation.
