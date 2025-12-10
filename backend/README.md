# Meeting Assistant Backend

FastAPI-based backend for the Meeting Assistant platform, providing audio/video processing, AI analysis, and meeting management capabilities.

## Overview

The backend is built with:
- **FastAPI** - Modern async web framework
- **SQLAlchemy** - ORM with PostgreSQL + pgvector
- **Celery** - Distributed task queue for processing
- **Redis** - Message broker and caching

## Project Structure

```
backend/
├── app/
│   ├── core/                    # Core business logic
│   │   ├── base/               # Shared utilities
│   │   │   ├── cache.py        # Caching decorators
│   │   │   ├── retry.py        # Retry logic
│   │   │   ├── utils.py        # Common utilities
│   │   │   └── validation.py   # Input validation
│   │   ├── integrations/       # External integrations
│   │   │   ├── calendar.py     # ICS generation
│   │   │   ├── export.py       # Export formats
│   │   │   └── google_calendar.py
│   │   ├── llm/                # LLM functionality
│   │   │   ├── analysis.py     # Transcript analysis
│   │   │   ├── chat.py         # Chat handling
│   │   │   ├── providers.py    # LLM providers
│   │   │   └── tools.py        # Tool calling
│   │   ├── processing/         # Audio/video processing
│   │   │   ├── diarization.py  # Speaker separation
│   │   │   ├── transcription.py # Speech-to-text
│   │   │   ├── pipeline.py     # Processing orchestration
│   │   │   └── checkpoint.py   # Resume support
│   │   └── storage/            # Data storage
│   │       ├── embeddings.py   # Embedding providers
│   │       ├── vector_store.py # Vector search
│   │       └── rag.py          # RAG orchestration
│   ├── modules/                # Feature modules
│   │   ├── meetings/           # Meeting CRUD
│   │   ├── chat/              # Global chat
│   │   ├── calendar/          # Action items
│   │   ├── settings/          # Configuration
│   │   ├── users/             # User mappings
│   │   ├── graph/             # Visualization
│   │   ├── ollama/            # Container management
│   │   └── admin/             # Admin functions
│   ├── scripts/               # Utility scripts
│   ├── database.py            # Database connection
│   ├── models.py              # SQLAlchemy models
│   ├── schemas.py             # Pydantic schemas
│   ├── crud.py                # Database operations
│   ├── tasks.py               # Celery tasks
│   ├── worker.py              # Celery app
│   ├── startup.py             # Startup recovery
│   └── main.py                # FastAPI app
├── Dockerfile                 # GPU-enabled image
├── Dockerfile.cpu             # CPU-only image
├── requirements.txt           # Python dependencies
├── example.env                # Environment template
└── init-db.sql               # Database initialization
```

## Quick Start

### Development Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp example.env .env
# Edit .env with your settings

# Start PostgreSQL and Redis (or use Docker)
# ...

# Run database migrations (tables created automatically)
# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start Celery worker (in another terminal)
celery -A app.worker.celery_app worker --loglevel=info --pool=solo
```

### Docker Setup

```bash
# Build image
docker build -t meeting-assistant-backend .

# Or use docker-compose from project root
cd ..
docker-compose up -d
```

## Configuration

### Environment Variables

Create a `.env` file from `example.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/meetingassistant

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# AI Providers
OPENAI_API_KEY=sk-...
HUGGINGFACE_TOKEN=hf_...
OLLAMA_BASE_URL=http://localhost:11434

# Processing
MAX_FILE_SIZE_MB=3000
DEFAULT_WHISPER_MODEL=base
PREFERRED_PROVIDER=openai

# Optional
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DEBUG=false
```

## API Endpoints

### Main Routers

| Prefix | Module | Description |
|--------|--------|-------------|
| `/api/v1/meetings` | meetings | Meeting CRUD, upload, chat |
| `/api/v1/global-chat` | chat | Cross-meeting RAG chat |
| `/api/v1/calendar` | calendar | Action items management |
| `/api/v1/scheduled-meetings` | calendar | Scheduled meetings |
| `/api/v1/settings` | settings | Configuration management |
| `/api/v1/graph` | graph | Visualization data |
| `/api/v1/ollama` | ollama | Container management |
| `/api/v1/user-mappings` | users | Name-to-email mappings |
| `/api/v1/admin` | admin | Admin operations |

### Documentation

Interactive API documentation available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Processing Pipeline

The meeting processing pipeline handles:

1. **File Upload** → Validates and stores audio/video file
2. **Conversion** → Converts to WAV for processing, MP3 for playback
3. **Diarization** → Identifies speakers using pyannote.audio
4. **Transcription** → Speech-to-text using Faster Whisper
5. **Analysis** → AI summarization, action items, decisions
6. **Embedding** → Vector embeddings for RAG search

Features:
- **Checkpointing**: Can resume from any stage after interruption
- **Progress Tracking**: Real-time progress updates
- **GPU Acceleration**: CUDA support with CPU fallback
- **Caching**: Avoids reprocessing unchanged files

## LLM Providers

Supported providers in `app/core/llm/providers.py`:

| Provider | Configuration | Features |
|----------|--------------|----------|
| OpenAI | API key | Full tool calling |
| Ollama | Base URL | Local inference, tool calling |
| OpenAI-compatible | Base URL + API key | Gemini, Anthropic, etc. |

## Tool Calling

The chat system supports AI-driven actions via `app/core/llm/tools.py`:

- `create_action_item` - Create tasks with owner, due date
- `update_action_item` - Modify existing items
- `list_action_items` - Query action items
- `add_note_to_meeting` - Append notes
- `update_meeting_details` - Change metadata
- `search_meeting_content` - Find content in transcript
- `iterative_research` - Multi-step investigation

## Testing

```bash
# Run test file
python test_tool_use.py
```

## Scripts

Utility scripts in `app/scripts/`:

- `migrate_transcript_format.py` - Format migration
- `demo_transcript_format.py` - Format comparison demo

See `app/scripts/README.md` for details.

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| CUDA not available | Check NVIDIA drivers, set FORCE_CPU=true |
| Diarization fails | Verify HuggingFace token and model access |
| Database connection | Check DATABASE_URL and PostgreSQL status |
| Worker not processing | Verify Redis connection, check Celery logs |

### Logs

- API logs: stdout (Docker) or console
- Worker logs: Celery output
- Processing logs: Stored in meeting processing_logs field

## Dependencies

Key dependencies:
- `fastapi` - Web framework
- `sqlalchemy` - ORM
- `celery[redis]` - Task queue
- `faster-whisper` - Transcription
- `pyannote.audio` - Diarization
- `openai` - LLM API
- `python-docx` / `reportlab` - Export formats
- `google-api-python-client` - Calendar integration
