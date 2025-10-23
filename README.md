# Meeting Assistant 🎯

> AI-powered meeting transcription and analysis platform with speaker diarization, intelligent summarization, and export capabilities.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/DavidC001/meetingAssistant)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/react-18.2+-blue.svg)](https://reactjs.org)

## ✨ Features

### 🎙️ Audio Processing
- **Multi-format Support**: WAV, MP3, MP4, MKV, M4A, FLAC, AVI, MOV
- **Speaker Diarization**: Automatic speaker identification and separation
- **Large File Handling**: Support for files up to 3GB
- **GPU Acceleration**: CUDA support for faster processing
- **Batch Upload**: Upload multiple files with individual date selection

### 🧠 AI-Powered Analysis
- **Automatic Transcription**: High-accuracy speech-to-text using Whisper
- **Intelligent Summarization**: AI-generated meeting summaries
- **Action Item Extraction**: Automatic identification of tasks and owners
- **Decision Tracking**: Key decisions and outcomes detection
- **LLM Tool Use**: AI assistant can perform actions like creating tasks, updating meetings, and searching content 🆕

### 📊 Export & Integration
- **Multiple Formats**: JSON, TXT, DOCX, PDF exports
- **Calendar Integration**: Generate ICS files for action items
- **Real-time Chat**: Interactive Q&A with meeting content
- **Advanced Search**: Full-text search across all meetings

### 🛠️ Technical Features
- **Modular Architecture**: Clean, maintainable codebase
- **Async Processing**: Background task handling with Celery
- **Smart Caching**: Optimized performance with intelligent caching
- **Error Recovery**: Robust error handling and automatic retries
- **Real-time Updates**: Live progress tracking and status updates

## 🏗️ Architecture

### Backend (FastAPI)
```
backend/
├── app/
│   ├── core/           # Core business logic
│   │   ├── config.py   # Centralized configuration
│   │   ├── analysis.py # AI analysis pipeline
│   │   ├── pipeline.py # Processing orchestration
│   │   └── exceptions.py # Custom exceptions
│   ├── routers/        # API endpoints
│   ├── models.py       # Database models
│   └── main.py         # Application entry point
├── requirements.txt    # Production dependencies
```

### Frontend (React)
```
frontend/
├── src/
│   ├── components/     # React components
│   │   ├── common/     # Reusable UI components
│   │   └── meetings/   # Meeting-specific components
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Utility functions
│   ├── constants/      # Application constants
│   └── api.js          # API client
└── package.json        # Dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Redis (for task queue)
- PostgreSQL (recommended) or SQLite
- Docker (optional)

### Using Docker (Recommended)
```bash
# Clone the repository
git clone https://github.com/DavidC001/meetingAssistant.git
cd meetingAssistant

# Start with Docker Compose
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
```

### Manual Installation

#### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp example.env .env
# Edit .env with your configuration

# Start the services
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
celery -A app.worker worker --loglevel=info
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

#### Backend (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost/meetingassistant

# Redis
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# AI Providers
OPENAI_API_KEY=your-openai-api-key
OLLAMA_BASE_URL=http://localhost:11434

# File Upload
MAX_FILE_SIZE_MB=3000
UPLOAD_DIR=uploads

# Models
DEFAULT_WHISPER_MODEL=base
DEFAULT_CHAT_MODEL=gpt-4o-mini
DEFAULT_ANALYSIS_MODEL=gpt-4o-mini
```

#### Frontend
```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_VERSION=1.0.0
```


## 📖 API Documentation

### Key Endpoints

#### Meetings
- `POST /api/v1/meetings/upload` - Upload meeting file
- `GET /api/v1/meetings/` - List all meetings
- `GET /api/v1/meetings/{id}` - Get meeting details
- `PUT /api/v1/meetings/{id}` - Update meeting
- `DELETE /api/v1/meetings/{id}` - Delete meeting
- `POST /api/v1/meetings/{id}/restart-processing` - Restart processing

#### Chat
- `POST /api/v1/meetings/{id}/chat` - Send chat message
- `GET /api/v1/meetings/{id}/chat/history` - Get chat history

#### Export
- `GET /api/v1/meetings/{id}/export/{format}` - Export meeting data

### API Documentation
Visit `http://localhost:8000/docs` for interactive API documentation (Swagger UI).

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
- Backend: Follow PEP 8, use Black for formatting
- Frontend: Follow Airbnb React style guide, use ESLint
- Documentation: Clear docstrings and comments
- Tests: Comprehensive test coverage

## 📋 Roadmap

### Version 1.1
- [ ] Multi-language support
- [ ] Advanced speaker recognition
- [ ] Meeting scheduling integration
- [ ] Mobile app support

### Version 1.2
- [ ] Real-time transcription
- [ ] Advanced analytics dashboard
- [ ] Custom AI model training
- [ ] Enterprise authentication

## 🐛 Troubleshooting

### Common Issues

#### Backend Issues
- **Database connection errors**: Check DATABASE_URL and database server
- **Celery worker not starting**: Verify Redis connection
- **GPU not detected**: Ensure CUDA drivers are installed

#### Frontend Issues
- **API connection failed**: Check REACT_APP_API_BASE_URL
- **Build failures**: Clear node_modules and reinstall
- **Upload timeouts**: Check file size limits

### Getting Help
- Check existing [GitHub Issues](https://github.com/DavidC001/meetingAssistant/issues)
- Create a new issue with detailed information
- Join our community discussions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) for speech recognition
- [pyannote.audio](https://github.com/pyannote/pyannote-audio) for speaker diarization
- [FastAPI](https://fastapi.tiangolo.com/) for the web framework
- [React](https://reactjs.org/) for the frontend framework
- [Material-UI](https://mui.com/) for UI components

---

<div align="center">
  <strong>Built with ❤️ for better meetings</strong>
</div>