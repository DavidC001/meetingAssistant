# Meeting Assistant 🎯

> AI-powered meeting transcription and analysis platform with speaker diarization, intelligent summarization, RAG-based chat, and comprehensive export capabilities.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/DavidC001/meetingAssistant)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/react-18.2+-blue.svg)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/fastapi-0.100+-green.svg)](https://fastapi.tiangolo.com)

## ✨ Features

### 🎙️ Audio & Video Processing
- **Multi-format Support**: WAV, MP3, MP4, MKV, M4A, FLAC, AVI, MOV
- **Speaker Diarization**: Automatic speaker identification using pyannote.audio 3.1
- **Large File Handling**: Support for files up to 3GB (configurable to 5GB)
- **GPU Acceleration**: CUDA support for faster processing with automatic fallback to CPU
- **Batch Upload**: Upload multiple files with individual date and language settings

### 🧠 AI-Powered Analysis
- **Automatic Transcription**: High-accuracy speech-to-text using Faster Whisper
- **Intelligent Summarization**: AI-generated meeting summaries with key points
- **Action Item Extraction**: Automatic identification of tasks, owners, and due dates
- **Decision Tracking**: Key decisions and outcomes detection
- **Topic Detection**: Automatic meeting topic and keyword extraction

### 💬 Advanced Chat System
- **Meeting Chat**: Interactive Q&A with individual meeting transcripts
- **Global Chat**: Cross-meeting search with RAG (Retrieval-Augmented Generation)
- **Tool Calling**: AI can create action items, update meetings, perform deep research
- **Iterative Research**: Multi-step investigation for complex questions
- **Source Attribution**: Responses include references to source meetings

### 📊 Export & Integration
- **Multiple Formats**: JSON, TXT, DOCX, PDF exports with full formatting
- **Google Calendar**: OAuth integration for syncing action items
- **Google Drive Sync**: Automatic file synchronization from Drive folders
- **ICS Generation**: Downloadable calendar files for action items
- **Meeting Graph**: Visual exploration of meeting relationships

### 🛠️ Technical Features
- **Multi-Provider LLM**: OpenAI, Ollama, and OpenAI-compatible APIs
- **Modular Architecture**: Clean, maintainable, feature-based codebase
- **Async Processing**: Background task handling with Celery
- **Checkpoint System**: Resume processing after interruptions
- **Smart Caching**: Optimized performance with intelligent caching
- **Vector Search**: pgvector-based semantic search

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  Dashboard │ Meetings │ Global Chat │ Calendar │ Graph │ Settings│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Modules                             │   │
│  │  Meetings │ Chat │ Calendar │ Settings │ Graph │ Ollama  │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Core Services                         │   │
│  │  Processing │ LLM │ Storage │ Integrations │ Base        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  PostgreSQL │ │    Redis    │ │   Celery    │ │   Ollama    │
│  + pgvector │ │   (Queue)   │ │  (Worker)   │ │ (Optional)  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

### Backend Structure
```
backend/app/
├── core/                    # Core business logic
│   ├── base/               # Utilities, caching, retry logic
│   ├── integrations/       # Calendar, export, Google Calendar, Google Drive
│   ├── llm/                # LLM providers, chat, tools, analysis
│   ├── processing/         # Transcription, diarization, pipeline
│   └── storage/            # Embeddings, vector store, RAG
├── modules/                 # Feature modules (meetings, chat, etc.)
├── models.py               # Database models
├── schemas.py              # Pydantic schemas
└── main.py                 # Application entry point
```

### Frontend Structure
```
frontend/src/
├── components/             # React components
│   ├── MeetingsDashboard.js    # Main dashboard
│   ├── MeetingDetails.js       # Meeting view
│   ├── GlobalChat.js           # Cross-meeting chat
│   ├── MeetingsGraph.js        # Relationship visualization
│   ├── Calendar.js             # Action items calendar
│   ├── GoogleDriveSync.js      # Drive folder sync
│   └── Settings.js             # Configuration
├── services/               # API client services
├── hooks/                  # Custom React hooks
└── utils/                  # Utility functions
```

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- NVIDIA GPU (optional, for GPU acceleration)
- HuggingFace account (for diarization model access)

### Docker Installation (Recommended)

```bash
# Clone the repository
git clone https://github.com/DavidC001/meetingAssistant.git
cd meetingAssistant

# Copy and configure environment file
cp backend/example.env backend/.env
# Edit backend/.env with your API keys

# Start with GPU support
docker-compose up -d

# OR start without GPU (CPU only)
docker-compose -f docker-compose.cpu.yml up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Required API Keys

1. **HuggingFace Token** (Required for speaker diarization)
   - Sign up at [huggingface.co](https://huggingface.co)
   - Accept pyannote model terms: [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
   - Generate token in Settings → Access Tokens

2. **OpenAI API Key** (Optional - for OpenAI models)
   - Get from [platform.openai.com](https://platform.openai.com)

3. **Ollama** (Optional - for local LLM)
   - Can be managed directly from the Settings page

4. **Google OAuth** (Optional - for Calendar and Drive sync)
   - Create project at [Google Cloud Console](https://console.cloud.google.com)
   - Enable Google Calendar API and Google Drive API
   - Create OAuth 2.0 credentials (Web application)
   - Add `http://localhost:3000/oauth-callback.html` to authorized redirect URIs
   - Copy Client ID and Client Secret to `.env`

### Manual Installation

#### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp example.env .env
# Edit .env with your configuration

# Start Redis (required for task queue)
redis-server

# Start the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start the Celery worker (in another terminal)
celery -A app.worker.celery_app worker --loglevel=info --pool=solo

# Start the Celery beat scheduler (for Google Drive sync)
celery -A app.worker.celery_app beat --loglevel=info
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Access at http://localhost:3000
```

## ⚙️ Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost/meetingassistant

# Redis (Task Queue)
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# AI Providers
OPENAI_API_KEY=your-openai-api-key
HUGGINGFACE_TOKEN=your-huggingface-token

# Ollama (optional, for local models)
OLLAMA_BASE_URL=http://localhost:11434

# File Upload
MAX_FILE_SIZE_MB=3000
UPLOAD_DIR=uploads

# Models
DEFAULT_WHISPER_MODEL=base
DEFAULT_CHAT_MODEL=gpt-4o-mini
DEFAULT_ANALYSIS_MODEL=gpt-4o-mini
PREFERRED_PROVIDER=openai  # or "ollama"

# Google Calendar (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth-callback.html
```

## 📖 API Documentation

Interactive API documentation is available at `http://localhost:8000/docs` (Swagger UI).

### Key Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| **Meetings** | `POST /api/v1/meetings/upload` | Upload meeting file |
| | `GET /api/v1/meetings/` | List all meetings |
| | `GET /api/v1/meetings/{id}` | Get meeting details |
| | `POST /api/v1/meetings/{id}/chat` | Chat with meeting |
| | `GET /api/v1/meetings/{id}/export/{format}` | Export meeting |
| **Global Chat** | `POST /api/v1/global-chat/sessions` | Create chat session |
| | `POST /api/v1/global-chat/chat` | Send message |
| **Calendar** | `GET /api/v1/calendar/action-items` | List action items |
| | `POST /api/v1/calendar/google/sync-all` | Sync to Google Calendar |
| **Google Drive** | `GET /api/v1/settings/google-drive/auth` | Get OAuth URL |
| | `GET /api/v1/settings/google-drive/callback` | OAuth callback |
| | `POST /api/v1/settings/google-drive/sync` | Trigger manual sync |
| **Settings** | `GET /api/v1/settings/model-configurations` | Get model configs |

## 📚 Documentation

For comprehensive documentation, see:

- **[FEATURES.md](FEATURES.md)** - Complete feature documentation with implementation details
- **[API Docs](http://localhost:8000/docs)** - Interactive API reference (when running)

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style
- **Backend**: PEP 8, Black for formatting
- **Frontend**: ESLint with React rules
- **Documentation**: Clear docstrings and comments

## 📋 Roadmap

### Planned Features
- [ ] Multi-language support improvements
- [ ] Real-time transcription (live meetings)
- [ ] Advanced speaker recognition training
- [ ] Mobile application
- [ ] Enterprise authentication (SSO)
- [ ] Custom AI model fine-tuning
- [ ] Analytics dashboard
- [x] Google Drive folder synchronization

## 🐛 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **GPU not detected** | Ensure NVIDIA drivers and nvidia-container-toolkit are installed |
| **Diarization fails** | Check HuggingFace token and model access permissions |
| **Processing stuck** | Check Celery worker logs; processing can resume from checkpoints |
| **API connection failed** | Verify backend is running and CORS settings |
| **Large file upload fails** | Increase `MAX_FILE_SIZE_MB` in .env |
| **Google OAuth fails** | Revoke access at myaccount.google.com/permissions and reconnect |
| **Drive sync not working** | Check folder ID, OAuth permissions, and beat scheduler is running |

### Logs Location
- Backend: Docker logs or stdout
- Worker: Celery worker output
- Frontend: Browser console

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) / [Faster Whisper](https://github.com/guillaumekln/faster-whisper) - Speech recognition
- [pyannote.audio](https://github.com/pyannote/pyannote-audio) - Speaker diarization
- [FastAPI](https://fastapi.tiangolo.com/) - Web framework
- [React](https://reactjs.org/) & [Material-UI](https://mui.com/) - Frontend
- [Celery](https://docs.celeryq.dev/) - Task queue
- [pgvector](https://github.com/pgvector/pgvector) - Vector search

---

<div align="center">
  <strong>Built with ❤️ for better meetings</strong>
  <br><br>
  <a href="https://github.com/DavidC001/meetingAssistant/issues">Report Bug</a>
  ·
  <a href="https://github.com/DavidC001/meetingAssistant/issues">Request Feature</a>
</div>