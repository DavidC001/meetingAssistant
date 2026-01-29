# Meeting Assistant 🎯

> AI-powered meeting transcription and analysis platform with speaker diarization, intelligent summarization, RAG-based chat, daily work logging, and comprehensive export capabilities.

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![React](https://img.shields.io/badge/react-18.2+-blue.svg)](https://reactjs.org)
[![FastAPI](https://img.shields.io/badge/fastapi-0.109+-green.svg)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/docker-compose-blue.svg)](https://www.docker.com/)

**Meeting Assistant** is a comprehensive tool designed to streamline your meeting workflow. From recording and transcribing to analyzing and summarizing, it acts as your intelligent partner in managing professional interactions. Now featuring a Daily Work Diary to keep track of your tasks and productivity.

## ✨ Features

### 🎙️ Audio & Video Processing
- **Multi-format Support**: Process WAV, MP3, MP4, MKV, M4A, FLAC, AVI, and MOV files.
- **Advanced Diarization**: Automatic speaker identification using `pyannote.audio` for clear "who said what" attribution.
- **Large File Support**: Robust handling of files up to 3GB (configurable).
- **GPU & CPU Modes**: Optimized for CUDA-enabled GPUs with automatic CPU fallback.
- **Batch Processing**: Upload and process multiple recordings simultaneously.

### 🧠 AI-Powered Analysis
- **High-Fidelity Transcription**: Powered by Faster Whisper for state-of-the-art accuracy.
- **Smart Summaries**: AI-generated executive summaries, key takeaways, and bullet points.
- **Topic Extraction**: Automatic detection of main topics and keywords.
- **Action Items**: Intelligent extraction of tasks, owners, and deadlines.
- **Decision Tracking**: Logs key decisions made during meetings.

### 📔 Daily Work Diary
- **Work Logging**: Track your daily activities, thoughts, and progress.
- **Task Integration**: Automatically link meeting action items to your daily diary.
- **Statistics**: Visualize your productivity with daily stats.
- **Reminders**: Never miss a follow-up or a pending task.

### 💬 Deep Chat & Search
- **RAG Architecture**: Retrieval-Augmented Generation for accurate answers from your meeting data.
- **Global Search**: Semantic search across all your meetings and transcripts.
- **Meeting Chat**: Interactive Q&A focused on specific meetings.
- **Citations**: AI responses include direct references to source transcripts.

### 📊 Integrations & Export
- **Google Calendar**: Sync meetings and action items.
- **Google Drive**: Auto-sync recordings from your Drive.
- **Export Formats**: Download as JSON, TXT, DOCX, PDF, or SRT.
- **Visualization**: Interactive graph view of meeting connections.

## 🏗️ Architecture

The system is built on a modern microservices architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  Dashboard │ Meetings │ Diary │ Global Chat │ Calendar │ Graph  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      Modules                            │    │
│  │  Meetings │ Diary │ Chat │ Calendar │ Settings │ Graph  │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Core Services                        │    │
│  │  Processing │ LLM │ Vector Store │ Storage │ Tasks      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  PostgreSQL │ │    Redis    │ │   Celery    │ │   Ollama    │
│  + pgvector │ │   (Cache)   │ │  (Workers)  │ │ (Optional)  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

## 🚀 Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- NVIDIA GPU with drivers (optional, for acceleration)
- OpenAI API Key (or local Ollama setup)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/meetingAssistant.git
   cd meetingAssistant
   ```

2. **Environment Setup**
   Copy the example environment file and configure your keys.
   ```bash
   cd backend
   cp example.env .env
   # Edit .env with your settings (OPENAI_API_KEY, etc.)
   cd ..
   ```

3. **Run with Docker**

   For **CPU** (default):
   ```bash
   docker compose up --build -d
   ```

   For **GPU** support:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build -d
   ```

4. **Access the Application**
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)
   - **API Documentation**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

## 📁 Project Structure

- `backend/app/modules/`: Feature-specific logic (Meetings, Diary, Chat, etc.)
- `backend/app/core/`: Core services (LLM, Processing pipeline)
- `frontend/src/components/`: React UI components
- `frontend/src/services/`: API client services

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
