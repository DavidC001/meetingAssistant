# Meeting Assistant - Complete Features Documentation 📚

> Comprehensive documentation of all features, implementations, and technical capabilities of the Meeting Assistant platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Audio & Video Processing](#audio--video-processing)
3. [AI & Machine Learning](#ai--machine-learning)
4. [Chat & RAG System](#chat--rag-system)
5. [Export & Integration](#export--integration)
6. [User Interface](#user-interface)
7. [Architecture & Technical Stack](#architecture--technical-stack)
8. [API Reference](#api-reference)

---

## Overview

Meeting Assistant is a full-stack AI-powered platform for transcribing, analyzing, and managing meeting recordings. It combines state-of-the-art speech recognition with intelligent analysis to extract actionable insights from your meetings.

### Key Capabilities

| Feature Category | Capabilities |
|-----------------|--------------|
| **Processing** | Multi-format audio/video, speaker diarization, GPU acceleration |
| **AI Analysis** | Transcription, summarization, action item extraction, decision tracking |
| **Chat** | Meeting-specific Q&A, global cross-meeting search, RAG with tool calling |
| **Integration** | Google Calendar sync, multiple export formats, ICS generation |
| **Visualization** | Meeting relationship graph, calendar views, knowledge exploration |

---

## Audio & Video Processing

### Supported Formats

The system supports a wide range of audio and video formats:

| Type | Extensions |
|------|------------|
| **Audio** | `.wav`, `.mp3`, `.m4a`, `.flac` |
| **Video** | `.mp4`, `.mkv`, `.avi`, `.mov` |

**Maximum File Size:** Configurable up to 5GB (default: 3GB)

### Processing Pipeline

The processing pipeline is implemented in `backend/app/core/processing/pipeline.py` with the following stages:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   File Upload   │────▶│  Audio Conversion │────▶│   Diarization   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Analysis     │◀────│  Transcription   │◀────│  Speaker Merge  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│   Embedding     │────▶│   Completion     │
│   Generation    │     │                  │
└─────────────────┘     └──────────────────┘
```

#### 1. Audio Conversion
- Converts input files to WAV format for processing
- Creates MP3 copies for browser playback
- Extracts file metadata (duration, codec, etc.)

#### 2. Speaker Diarization
**Implementation:** `backend/app/core/processing/diarization.py`

- Uses **pyannote.audio 3.1** for speaker identification
- Requires HuggingFace authentication token
- Supports configurable number of speakers or automatic detection
- GPU acceleration with CUDA support
- Fallback to single speaker on failure

**Features:**
- Real-time progress tracking
- Results caching for re-processing
- Automatic GPU memory management

#### 3. Transcription
**Implementation:** `backend/app/core/processing/transcription.py`

- Uses **Faster Whisper** for speech-to-text
- Supports multiple model sizes: `tiny`, `base`, `small`, `medium`, `large`, `large-v2`, `large-v3`
- Automatic language detection
- Parallel transcription of segments

**Configuration Options:**
```python
class WhisperConfig:
    model_size: str = "base"  # Whisper model size
    provider: str = "faster-whisper"
    language: str = "en"  # Language hint
```

#### 4. Checkpoint System
**Implementation:** `backend/app/core/processing/checkpoint.py`

- Saves processing state at each stage
- Enables resumption after failures
- Stores intermediate results (diarization, transcription)
- Automatic validation of checkpoint integrity

### GPU Acceleration

The system automatically detects and utilizes NVIDIA GPUs:

- **CUDA Support:** Automatic detection and fallback to CPU
- **Memory Management:** Automatic cache clearing between operations
- **Docker Integration:** GPU passthrough via NVIDIA Container Toolkit

```yaml
# docker-compose.yml GPU configuration
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

---

## AI & Machine Learning

### LLM Provider System

**Implementation:** `backend/app/core/llm/providers.py`

The system supports multiple LLM providers through a unified interface:

| Provider | Models | Features |
|----------|--------|----------|
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4, GPT-3.5-turbo | Full tool calling support |
| **Ollama** | Llama 3, Mistral, custom models | Local inference, tool calling (0.3.0+) |
| **OpenAI-Compatible** | Gemini, Anthropic, etc. | Via base_url configuration |

#### Provider Configuration

```python
@dataclass
class LLMConfig:
    provider: str  # "openai", "ollama"
    model: str
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    max_tokens: int = 4000
    timeout: int = 300
```

### Meeting Analysis

**Implementation:** `backend/app/core/llm/analysis.py`

The analysis module extracts structured information from transcripts:

```python
@dataclass
class AnalysisResult:
    summary: list[str]       # 3-5 bullet points
    decisions: list[str]     # Key decisions made
    action_items: list[Dict[str, str]]  # Tasks with owner, due_date
    success: bool
    error_message: Optional[str]
```

**Analysis Prompt:**
> "You are a senior executive assistant. Given a verbatim, speaker-labelled transcript of a meeting, respond in valid JSON with keys: summary, decisions, and action_items..."

### Text Analysis

**Implementation:** `backend/app/core/processing/text_analysis.py`

Additional NLP capabilities:

- **Keyword Extraction:** TF-IDF based keyword extraction with bigram support
- **Topic Detection:** Heuristic-based topic categorization
- **Speaker Identification:** Pattern matching for speaker names
- **Sentiment Analysis:** Meeting tone evaluation

---

## Chat & RAG System

### Meeting Chat

**Implementation:** `backend/app/core/llm/chat.py`

Interactive Q&A with meeting content:

- Full transcript context for accurate answers
- Chat history preservation (last 5 messages)
- Real-time streaming responses
- Tool calling capabilities

### Global Chat with RAG

**Implementation:** `backend/app/core/storage/rag.py`

Cross-meeting semantic search and chat

**Features:**
- Filter by folder or tags
- Session-based conversation history
- Source attribution for answers
- Full transcript mode or RAG mode

### Embedding System

**Implementation:** `backend/app/core/storage/embeddings.py`

Supported embedding providers:

| Provider | Model | Dimensions |
|----------|-------|------------|
| **OpenAI** | text-embedding-3-small, text-embedding-3-large | 1536/3072 |
| **Sentence Transformers** | all-MiniLM-L6-v2, etc. | Varies |
| **Ollama** | nomic-embed-text, mxbai-embed-large | Varies |

### Tool Calling System

**Implementation:** `backend/app/core/llm/tools.py`

The chat system supports AI-driven tool execution:

#### Available Tools

| Tool | Description |
|------|-------------|
| `create_action_item` | Create new action items with task, owner, due date, priority |
| `update_action_item` | Modify existing action items (status, priority, etc.) |
| `list_action_items` | List all action items with optional status filter |
| `add_note_to_meeting` | Add or append notes to meeting record |
| `update_meeting_details` | Modify meeting metadata (date, tags, folder) |
| `search_meeting_content` | Search within meeting transcript |
| `get_meeting_summary` | Retrieve AI-generated summary |
| `get_meeting_speakers` | List meeting participants |
| `iterative_research` | Deep research with follow-up questions |

#### Iterative Research Tool

Advanced multi-step research capability:

1. **Initial Query:** User asks complex question
2. **Source Retrieval:** Fetch relevant chunks via RAG
3. **Analysis:** LLM analyzes sources, determines confidence
4. **Follow-up:** If confidence low, generates follow-up question
5. **Iteration:** Repeats until high confidence or max depth reached

---

## Export & Integration

### Export Formats

**Implementation:** `backend/app/core/integrations/export.py`

| Format | Features |
|--------|----------|
| **JSON** | Complete structured data, machine-readable |
| **TXT** | Formatted plain text report with sections |
| **DOCX** | Microsoft Word document with styling |
| **PDF** | Printable PDF with professional layout |

#### Export Content Includes:
- Meeting metadata (date, participants, duration)
- Full summary with bullet points
- Complete action items with status
- Key decisions made
- Full transcript with speaker labels
- Keywords and topics

### Calendar Integration

#### ICS Calendar Generation

Generate downloadable ICS files for action items:

```python
generate_ics_calendar(action_items, meeting_title) -> Path
```

#### Google Calendar Sync

**Implementation:** `backend/app/core/integrations/google_calendar.py`

Full OAuth 2.0 integration with Google Calendar:

- **Authentication:** OAuth 2.0 flow with refresh token support
- **Event Creation:** Sync action items as calendar events
- **Bi-directional Sync:** Track sync status per action item
- **Event Updates:** Modify synced events when action items change

**Features:**
- Due date → Event date mapping
- Priority → Event color coding
- Meeting context in event description
- Automatic sync status tracking

### Attachment Processing

**Implementation:** `backend/app/core/processing/document_processor.py`

Process and embed meeting attachments:

| Format | Library |
|--------|---------|
| PDF | pdfplumber, PyPDF2 |
| DOCX | python-docx |
| TXT/MD | Native text reading |

---

## User Interface

### Dashboard

**Component:** `frontend/src/components/MeetingsDashboard.js`

- Upload new meetings (single or batch)
- View processing progress in real-time
- Quick access to recent meetings
- Status overview and statistics

### Meetings Browser

**Component:** `frontend/src/components/MeetingsBrowser.js`

- Folder-based organization
- Tag filtering
- Search functionality
- Bulk operations

### Meeting Details

**Component:** `frontend/src/components/MeetingDetails.js`

- Full transcript with speaker labels and timestamps
- Audio playback synchronized with transcript
- Editable action items
- AI-generated summary and decisions
- Meeting chat interface
- Export options

### Global Chat

**Component:** `frontend/src/components/GlobalChat.js`

- Session management
- Cross-meeting search
- Filter by folder/tags
- Source citations
- Tool calling integration

### Meetings Graph

**Component:** `frontend/src/components/MeetingsGraph.js`

Interactive visualization of meeting relationships:

- **Nodes:** Meetings, speakers, folders, tags
- **Edges:** Relationships (attendance, organization)
- **Interactions:** Click to view details, filter by type

### Calendar View

**Component:** `frontend/src/components/Calendar.js`

- Action items calendar display
- Due date management
- Status updates
- Google Calendar sync controls

### Scheduled Meetings

**Component:** `frontend/src/components/ScheduledMeetings.js`

- Upcoming meeting management
- Schedule planning
- Integration with calendar

### Settings

**Component:** `frontend/src/components/Settings.js`

- API key management (OpenAI, HuggingFace)
- Model configuration (chat, analysis, embeddings)
- Ollama container management
- Application settings (file size limits)
- User mapping configuration

### Ollama Manager

**Component:** `frontend/src/components/OllamaManager.js`

Docker-based Ollama management:

- Start/stop Ollama container
- Download models
- Status monitoring
- Resource management

---

## Architecture & Technical Stack

### Backend

| Component | Technology |
|-----------|------------|
| **Framework** | FastAPI (async Python) |
| **Database** | PostgreSQL with pgvector |
| **Task Queue** | Celery with Redis |
| **ORM** | SQLAlchemy |
| **Validation** | Pydantic |

### Frontend

| Component | Technology |
|-----------|------------|
| **Framework** | React 18 |
| **UI Library** | Material-UI (MUI) |
| **State** | React Hooks |
| **Routing** | React Router |

### AI/ML Stack

| Component | Technology |
|-----------|------------|
| **Speech Recognition** | Faster Whisper |
| **Speaker Diarization** | pyannote.audio 3.1 |
| **LLM** | OpenAI API, Ollama |
| **Embeddings** | OpenAI, Sentence Transformers, Ollama |
| **Vector Store** | pgvector |

### Infrastructure

| Component | Technology |
|-----------|------------|
| **Containerization** | Docker, Docker Compose |
| **GPU Support** | NVIDIA Container Toolkit |
| **Reverse Proxy** | nginx |
| **Caching** | Redis, file-based caching |

### Modular Architecture

```
backend/app/
├── core/                 # Core business logic
│   ├── base/            # Base utilities
│   │   ├── cache.py     # Caching decorators
│   │   ├── retry.py     # Retry logic
│   │   ├── utils.py     # Common utilities
│   │   └── validation.py
│   ├── integrations/    # External integrations
│   │   ├── calendar.py  # ICS generation
│   │   ├── export.py    # Export formats
│   │   └── google_calendar.py
│   ├── llm/             # LLM functionality
│   │   ├── analysis.py  # Transcript analysis
│   │   ├── chat.py      # Chat handling
│   │   ├── providers.py # LLM providers
│   │   └── tools.py     # Tool calling
│   ├── processing/      # Audio/video processing
│   │   ├── diarization.py
│   │   ├── transcription.py
│   │   ├── pipeline.py
│   │   └── checkpoint.py
│   └── storage/         # Data storage
│       ├── embeddings.py
│       ├── vector_store.py
│       └── rag.py
├── modules/             # Feature modules
│   ├── meetings/        # Meeting management
│   ├── chat/           # Global chat
│   ├── calendar/       # Calendar & action items
│   ├── settings/       # Configuration
│   ├── users/          # User mappings
│   ├── graph/          # Visualization
│   ├── ollama/         # Ollama management
│   └── admin/          # Admin functions
└── main.py             # Application entry
```

---

## API Reference

### Meetings API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/meetings/upload` | POST | Upload meeting file |
| `/api/v1/meetings/batch-upload` | POST | Upload multiple files |
| `/api/v1/meetings/` | GET | List all meetings |
| `/api/v1/meetings/{id}` | GET | Get meeting details |
| `/api/v1/meetings/{id}` | PUT | Update meeting |
| `/api/v1/meetings/{id}` | DELETE | Delete meeting |
| `/api/v1/meetings/{id}/chat` | POST | Send chat message |
| `/api/v1/meetings/{id}/export/{format}` | GET | Export meeting |
| `/api/v1/meetings/{id}/restart-processing` | POST | Restart processing |

### Global Chat API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/global-chat/sessions` | POST | Create chat session |
| `/api/v1/global-chat/sessions` | GET | List sessions |
| `/api/v1/global-chat/sessions/{id}` | GET | Get session details |
| `/api/v1/global-chat/sessions/{id}` | DELETE | Delete session |
| `/api/v1/global-chat/chat` | POST | Send message |
| `/api/v1/global-chat/filters/folders` | GET | Get available folders |
| `/api/v1/global-chat/filters/tags` | GET | Get available tags |

### Calendar API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/calendar/action-items` | GET | List all action items |
| `/api/v1/calendar/action-items/{id}` | PUT | Update action item |
| `/api/v1/calendar/google/authorize` | GET | Start Google OAuth |
| `/api/v1/calendar/google/callback` | GET | OAuth callback |
| `/api/v1/calendar/google/sync-all` | POST | Sync all items |

### Settings API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/settings/api-tokens` | GET | Get token status |
| `/api/v1/settings/api-tokens` | POST | Update tokens |
| `/api/v1/settings/model-configurations` | GET | List configs |
| `/api/v1/settings/model-configurations` | POST | Create config |
| `/api/v1/settings/embedding-configuration` | GET | Get embedding config |
| `/api/v1/settings/embedding-configuration` | PUT | Update embedding config |

### Graph API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/graph/data` | GET | Get graph visualization data |

### Ollama API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/ollama/status` | GET | Get Ollama status |
| `/api/v1/ollama/start` | POST | Start container |
| `/api/v1/ollama/stop` | POST | Stop container |
| `/api/v1/ollama/models` | GET | List available models |
| `/api/v1/ollama/pull` | POST | Pull new model |

---

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost/meetingassistant

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# AI Providers
OPENAI_API_KEY=your-openai-api-key
HUGGINGFACE_TOKEN=your-hf-token
OLLAMA_BASE_URL=http://localhost:11434

# File Upload
MAX_FILE_SIZE_MB=3000
UPLOAD_DIR=uploads
ALLOWED_EXTENSIONS=.wav,.mp3,.mp4,.m4a,.flac,.mkv,.avi,.mov

# Models
DEFAULT_WHISPER_MODEL=base
DEFAULT_CHAT_MODEL=gpt-4o-mini
DEFAULT_ANALYSIS_MODEL=gpt-4o-mini
DEFAULT_LOCAL_CHAT_MODEL=llama3
DEFAULT_LOCAL_ANALYSIS_MODEL=llama3
PREFERRED_PROVIDER=openai

# Google Calendar (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/calendar/callback

# Performance
FORCE_CPU=false  # Force CPU processing
DEBUG=false
```

---

## Version History

### v1.0.0 (Current)
- Full audio/video transcription with speaker diarization
- AI-powered meeting analysis (summary, action items, decisions)
- Multi-provider LLM support (OpenAI, Ollama)
- Global chat with RAG capabilities
- Tool calling for AI-driven actions
- Iterative research tool for deep analysis
- Multiple export formats (JSON, TXT, DOCX, PDF)
- Google Calendar integration
- Meeting relationship graph visualization
- Checkpoint system for processing recovery
- GPU acceleration support

---

*Built with ❤️ for better meetings*
