# API Overview

Base URL: `http://localhost:8000/api/v1`

## Endpoints

### Meetings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/meetings/` | List meetings (paginated) |
| `GET` | `/meetings/{id}` | Get meeting details |
| `POST` | `/meetings/upload` | Upload audio/video for processing |
| `POST` | `/meetings/batch-upload` | Upload multiple files |
| `PUT` | `/meetings/{id}` | Update meeting metadata |
| `DELETE` | `/meetings/{id}` | Delete meeting |
| `POST` | `/meetings/{id}/restart` | Restart processing |
| `POST` | `/meetings/{id}/retry-analysis` | Retry failed analysis |
| `GET` | `/meetings/{id}/export` | Export to JSON/TXT/DOCX/PDF |
| `POST` | `/meetings/{id}/chat` | Chat with meeting transcript |
| `GET` | `/meetings/{id}/chat/history` | Get chat history |
| `DELETE` | `/meetings/{id}/chat/history` | Clear chat history |

### Action Items

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/meetings/action-items/` | List all action items |
| `POST` | `/meetings/action-items/` | Create manual action item |
| `PUT` | `/meetings/action-items/{id}` | Update action item |
| `DELETE` | `/meetings/action-items/{id}` | Delete action item |

### Speakers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/meetings/{id}/speakers` | List meeting speakers |
| `POST` | `/meetings/{id}/speakers` | Add speaker |
| `PUT` | `/meetings/speakers/{id}` | Rename speaker |
| `DELETE` | `/meetings/speakers/{id}` | Remove speaker |

### Attachments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/meetings/{id}/attachments` | List attachments |
| `POST` | `/meetings/{id}/attachments` | Upload attachment |
| `GET` | `/meetings/attachments/{id}` | Get attachment metadata |
| `GET` | `/meetings/attachments/{id}/file` | Download attachment |
| `PUT` | `/meetings/attachments/{id}` | Update description |
| `DELETE` | `/meetings/attachments/{id}` | Delete attachment |

### Audio

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/meetings/{id}/audio` | Stream audio file |
| `POST` | `/meetings/{id}/audio/generate` | Generate audio from source |
| `POST` | `/meetings/audio/regenerate-all` | Batch regenerate audio |

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/` | List projects |
| `POST` | `/projects/` | Create project |
| `GET` | `/projects/{id}` | Get project details |
| `PUT` | `/projects/{id}` | Update project |
| `DELETE` | `/projects/{id}` | Delete project |
| `GET` | `/projects/{id}/meetings` | List project meetings |
| `POST` | `/projects/{id}/meetings` | Link meeting to project |
| `DELETE` | `/projects/{id}/meetings/{mid}` | Unlink meeting |
| `GET` | `/projects/{id}/action-items` | List project action items |
| `POST` | `/projects/{id}/action-items` | Create action item |
| `GET` | `/projects/{id}/analytics` | Project analytics |
| `GET` | `/projects/{id}/gantt` | Gantt chart data |
| `POST` | `/projects/{id}/chat` | Chat with project |

### Chat (Global)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat/` | Send global chat message |
| `GET` | `/chat/sessions` | List chat sessions |
| `POST` | `/chat/sessions` | Create session |
| `DELETE` | `/chat/sessions/{id}` | Delete session |

### Search

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/search/` | Semantic search across meetings |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings/app-settings` | App configuration |
| `GET` | `/settings/model-configurations` | List LLM model configs |
| `POST` | `/settings/model-configurations` | Create model config |
| `PUT` | `/settings/model-configurations/{id}` | Update model config |
| `DELETE` | `/settings/model-configurations/{id}` | Delete model config |
| `GET` | `/settings/api-keys` | List API keys |
| `POST` | `/settings/api-keys` | Add API key |
| `DELETE` | `/settings/api-keys/{id}` | Delete API key |

### Diary

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/diary/entries` | List diary entries |
| `POST` | `/api/v1/diary/entries` | Create entry |
| `PUT` | `/api/v1/diary/entries/{id}` | Update entry |
| `DELETE` | `/api/v1/diary/entries/{id}` | Delete entry |

### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Basic health check |
| `GET` | `/health/detailed` | DB + Redis + Celery health |
| `GET` | `/api/docs` | Swagger UI |
| `GET` | `/api/redoc` | ReDoc |

## Response format

All endpoints return JSON. Errors follow:

```json
{
  "error": {
    "code": "NotFoundError",
    "message": "Meeting not found",
    "details": {},
    "request_id": "abc123"
  }
}
```

## Pagination

List endpoints accept `?skip=0&limit=100` query parameters.
