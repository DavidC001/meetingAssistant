# Meeting Assistant Frontend

React-based frontend for the Meeting Assistant platform, providing a modern UI for meeting management, chat, and visualization.

## Overview

The frontend is built with:
- **React 18** - UI framework
- **Material-UI (MUI)** - Component library
- **React Router** - Navigation
- **Axios** - HTTP client

## Project Structure

```
frontend/
├── public/
│   ├── index.html             # HTML template
│   └── oauth-callback.html    # Google OAuth callback
├── src/
│   ├── components/            # React components
│   │   ├── common/           # Reusable components
│   │   ├── MeetingsDashboard.js    # Main dashboard
│   │   ├── MeetingsBrowser.js      # Folder browser
│   │   ├── MeetingDetails.js       # Meeting view
│   │   ├── MeetingCard.js          # Meeting card
│   │   ├── MeetingsGraph.js        # Graph visualization
│   │   ├── GlobalChat.js           # Cross-meeting chat
│   │   ├── Chat.js                 # Meeting chat
│   │   ├── Calendar.js             # Action items calendar
│   │   ├── ScheduledMeetings.js    # Scheduled meetings
│   │   ├── UploadForm.js           # File upload
│   │   ├── Settings.js             # Configuration
│   │   ├── OllamaManager.js        # Ollama container
│   │   ├── ModelConfigurations.js  # LLM settings
│   │   ├── APIKeyManagement.js     # API keys
│   │   └── UserMappingsDialog.js   # User mappings
│   ├── services/              # API client services
│   │   ├── apiClient.js       # Base API client
│   │   ├── meetingService.js  # Meetings API
│   │   ├── chatService.js     # Chat API
│   │   ├── settingsService.js # Settings API
│   │   └── ...
│   ├── hooks/                 # Custom React hooks
│   │   └── index.js
│   ├── utils/                 # Utility functions
│   │   └── index.js
│   ├── constants/             # Application constants
│   │   └── index.js
│   ├── api.js                 # Legacy API client
│   ├── App.js                 # Root component
│   ├── App.css                # App styles
│   ├── index.js               # Entry point
│   └── index.css              # Global styles
├── Dockerfile                 # Production image
├── nginx.conf                 # Nginx configuration
└── package.json               # Dependencies
```

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Access at http://localhost:3000
```

### Production Build

```bash
# Create production build
npm run build

# Serve with nginx or static server
npx serve -s build
```

### Docker

```bash
# Build image
docker build -t meeting-assistant-frontend .

# Run container
docker run -p 3000:80 meeting-assistant-frontend
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_VERSION=1.0.0
```

### API Configuration

The API base URL is configured in `src/api.js`:

```javascript
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
```

## Components

### Main Views

| Component | Route | Description |
|-----------|-------|-------------|
| `MeetingsDashboard` | `/` | Dashboard with upload and recent meetings |
| `MeetingsBrowser` | `/meetings/browse` | Folder-based meeting browser |
| `MeetingDetails` | `/meetings/:id` | Full meeting view with chat |
| `GlobalChat` | `/global-chat` | Cross-meeting RAG chat |
| `ScheduledMeetings` | `/scheduled-meetings` | Scheduled meetings list |
| `MeetingsGraph` | `/graph` | Relationship visualization |
| `Calendar` | `/calendar` | Action items calendar |
| `Settings` | `/settings` | Configuration and API keys |

### Feature Components

| Component | Description |
|-----------|-------------|
| `UploadForm` | File upload with drag-drop, batch support |
| `Chat` | Meeting-specific chat interface |
| `GlobalChat` | Cross-meeting search with sessions |
| `MeetingsGraph` | D3-based graph visualization |
| `OllamaManager` | Docker container management |
| `ModelConfigurations` | LLM model settings |
| `UserMappingsDialog` | Speaker name mappings |

## Services

API client services in `src/services/`:

| Service | Purpose |
|---------|---------|
| `apiClient` | Base Axios configuration |
| `meetingService` | Meeting CRUD operations |
| `chatService` | Chat and global chat |
| `settingsService` | Configuration management |
| `actionItemService` | Action item operations |
| `attachmentService` | File attachments |
| `speakerService` | Speaker management |

## Styling

- **Material-UI Theme**: Configured in `App.js`
- **Component CSS**: Colocated `.css` files
- **Global Styles**: `index.css`

### Theme Customization

```javascript
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#f50057' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 8 },
});
```

## Features

### File Upload
- Drag and drop support
- Batch upload with individual settings
- Progress tracking
- File size validation

### Meeting Chat
- Real-time responses
- Tool calling integration
- Chat history preservation
- Markdown rendering

### Global Chat
- Session-based conversations
- Folder and tag filtering
- Source attribution
- Iterative research support

### Graph Visualization
- Interactive node exploration
- Meeting relationships
- Speaker connections
- Tag and folder clusters

### Calendar Integration
- Action items display
- Due date management
- Status updates
- Google Calendar sync

## Development

### Available Scripts

```bash
npm start      # Start dev server
npm build      # Production build
npm test       # Run tests
npm eject      # Eject from CRA
```

### Code Style

- ESLint configuration
- Prettier formatting
- React best practices

### Adding Components

1. Create component file in `src/components/`
2. Add styles in colocated `.css` file
3. Export from component
4. Add route in `App.js` if needed

## Production Deployment

### Nginx Configuration

The `nginx.conf` is configured for:
- SPA routing (fallback to index.html)
- API proxy to backend
- Static file caching
- Gzip compression

### Docker Build

Multi-stage build:
1. Build React app
2. Copy to nginx image
3. Configure nginx

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| API connection failed | Check `REACT_APP_API_BASE_URL` |
| CORS errors | Verify backend CORS settings |
| Build failures | Clear node_modules, reinstall |
| Blank page | Check browser console for errors |

### Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Dependencies

Key dependencies:
- `react` / `react-dom` - UI framework
- `@mui/material` - Component library
- `react-router-dom` - Routing
- `axios` - HTTP client
- `d3` - Graph visualization
- `marked` - Markdown rendering
