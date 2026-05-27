# Meeting Assistant Documentation

## Structure

| Doc | Purpose |
|-----|---------|
| [getting-started.md](getting-started.md) | Prerequisites, env setup, first run |
| [backend-architecture.md](backend-architecture.md) | Router → Service → Repository → Model pattern |
| [frontend-architecture.md](frontend-architecture.md) | Container / Presentation / Hooks pattern |
| [api-overview.md](api-overview.md) | REST API structure and endpoints |
| [contributing.md](contributing.md) | How to add features, conventions, testing |

## Quick links

- **Backend**: FastAPI + SQLAlchemy + Celery + PostgreSQL/pgvector
- **Frontend**: React + Material-UI + axios
- **Processing**: Whisper (transcription) + Pyannote (diarization) + LLM (analysis)
- **Infra**: Docker Compose (CPU or GPU), Redis, Celery workers

## Project layout

```
meetingAssistant/
├── backend/
│   └── app/
│       ├── core/           # Base classes, LLM, processing, storage
│       │   ├── base/       # BaseRepository, mixins, exceptions
│       │   ├── llm/        # Provider abstraction, chat, analysis
│       │   ├── processing/ # Transcription, diarization, pipeline
│       │   └── storage/    # RAG, embeddings, vector store
│       ├── modules/        # Feature modules (each self-contained)
│       │   ├── meetings/   # Upload, transcribe, analyze, export
│       │   ├── projects/   # Project management with meetings
│       │   ├── chat/       # Meeting and global chat
│       │   ├── diary/      # Daily work diary
│       │   ├── settings/   # API keys, model config, backups
│       │   ├── search/     # Semantic search
│       │   ├── calendar/   # Google Calendar sync
│       │   ├── graph/      # Meeting relationship visualization
│       │   ├── users/      # User email mapping
│       │   ├── ollama/     # Local LLM management
│       │   └── admin/      # Diagnostic endpoints
│       ├── middleware/      # Request ID, logging
│       ├── database.py     # DB session and engine
│       ├── main.py         # FastAPI app entry point
│       └── worker.py       # Celery app
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── common/     # Reusable: ErrorBoundary, LoadingState, etc.
│       │   ├── features/   # Feature-specific: meetings, projects, etc.
│       │   │   └── <feature>/
│       │   │       ├── containers/    # Data + state
│       │   │       ├── presentation/  # Pure UI
│       │   │       └── hooks/         # Reusable logic
│       │   └── layout/     # AppHeader, Sidebar, GlobalSearch
│       ├── services/       # API client wrappers
│       ├── hooks/          # Shared hooks
│       ├── utils/          # formatters, dateHelpers, etc.
│       └── contexts/       # ThemeContext
└── docs/                   # This directory
```
