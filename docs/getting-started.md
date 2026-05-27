# Getting Started

## Prerequisites

- Docker and Docker Compose
- Python 3.11+ (for local dev)
- Node.js 18+ (for frontend dev)
- PostgreSQL with pgvector extension

## Quick start (Docker)

```bash
# CPU-only setup
cp backend/example.env backend/.env
# Edit .env with your API keys and settings
docker-compose up -d

# GPU setup (NVIDIA)
cp backend/example.env backend/.env
docker-compose -f docker-compose.gpu.yml up -d
```

The app will be available at `http://localhost:3000` (frontend) with the API at `http://localhost:8000`.

## Manual setup (development)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp example.env .env
# Edit .env with your settings

# Run database migrations
alembic upgrade head

# Start the API
uvicorn app.main:app --reload --port 8000

# Start Celery worker (separate terminal)
celery -A app.worker worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm start
```

## Environment variables

Key variables in `backend/.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `CELERY_BROKER_URL` | Redis URL for Celery |
| `OPENAI_API_KEY` | OpenAI API key for LLM features |
| `MSGRAPH_TENANT_ID` | Microsoft Graph (Teams integration) |
| `MSGRAPH_CLIENT_ID` | Microsoft Graph app ID |
| `MSGRAPH_CLIENT_SECRET` | Microsoft Graph app secret |
| `GOOGLE_CLIENT_ID` | Google OAuth (Calendar/Drive) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |

See `backend/example.env` for all available options.

## First run

1. Upload an audio/video file through the web UI
2. The file is processed: transcription → diarization → LLM analysis
3. Results appear: transcript, summary, action items, speakers
4. Use the chat feature to ask questions about the meeting content

## Verification

```bash
# Health check
curl http://localhost:8000/health

# API docs
open http://localhost:8000/api/docs

# List meetings
curl http://localhost:8000/api/v1/meetings/
```
