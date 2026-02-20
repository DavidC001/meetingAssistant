# Meeting Assistant - AI Coding Instructions

This repository contains a meeting transcription and analysis platform. Follow these guidelines to work effectively in this codebase.

## 🏗 Global Architecture

The system follows a modular monolith architecture with a clear separation between frontend and backend.

- **Frontend**: React 18+ application (in `frontend/`) using Material-UI, `axios`, and functional components.
- **Backend**: FastAPI application (in `backend/`) using modular structure, SQLAlchemy (PostgreSQL + `pgvector`), and Celery (Redis) for async tasks.
- **AI/ML**: Python-based processing pipeline using `faster-whisper` (transcription), `pyannote.audio` (diarization), `sentence-transformers` (embeddings), and LLMs (OpenAI/Ollama).

## 🐍 Backend Guidelines (`backend/`)

### 1. Modular Structure
Organize code by feature domain in `backend/app/modules/`. Each module should be self-contained:
- `router.py`: API endpoints (FastAPI routers).
- `models.py`: SQLAlchemy database models.
- `schemas.py`: Pydantic models for request/response validation.
- `repository.py`: Data access layer (Preferred over `crud.py`).
- `service.py`: Business logic and orchestration.

### 2. Database & Persistence
- **Repository Pattern**: ALWAYS use the repository pattern for database interactions. Extend `BaseRepository` in `repository.py`.
  - *Do:* `meeting_repo.get_by_id(db, id)`
  - *Don't:* `db.query(Meeting).filter(...)` directly in routes.
- **Migrations**: Use Alembic for schema changes. Create revisions for ANY model change.
  - `alembic revision --autogenerate -m "description"`
- **Vector Search**: Uses `pgvector` extension. Ensure vector operations are handled in `repository.py`.

### 3. Asynchronous Tasks
- Use **Celery** for long-running tasks (transcription, summarization).
- Define tasks in `backend/app/tasks.py` or module-specific `tasks.py`.
- Use `backend/app/worker.py` for worker configuration.

### 4. LLM & AI Integration
- logic resides in `backend/app/core/llm/`.
- Use `LLMProvider` abstraction for model interactions (supports OpenAI and Ollama).
- **Configuration**: Managed via `backend/app/core/config.py` and `.env`.

### 5. Testing
- Use `pytest`.
- **Markers**: Use `@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.slow`, `@pytest.mark.llm` to categorize tests.
- **Fixtures**: Defined in `backend/tests/conftest.py`.

## ⚛️ Frontend Guidelines (`frontend/`)

### 1. Component Structure
- Functional components with Hooks.
- Locate components in `frontend/src/components/`.
- Use Material-UI (MUI) for styling and components.
- **Component Decomposition**: Keep components small and focused. Use container + presentational splits and custom hooks for logic.
- Put stress on reusability of components. If a UI block can be reused in multiple places, it should be a separate component that receives data and behavior via props.

### 2. API Interaction
- **Service Layer**: Do NOT make API calls directly in components (except specialized hooks).
- Use `frontend/src/services/` modules (e.g., `meetingService.js`, `chatService.js`) which wrap the base `api` client.
- Base client is configured in `frontend/src/api.js`.

### 3. State Management
- Use React Context for global state (Auth, Theme).
- Use `react-query` or `swr` (if available, check `package.json`) or local state for data fetching.

## 🛠 Developer Workflow

1. **Environment Setup**:
   - `backend/.env` is required (copy `example.env`).
   - Prerequisites: Docker, NVIDIA GPU (optional), OpenAI Key or Ollama.

2. **Run Application**:
   - `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build -d` (for GPU support).

3. **Running Tests**:
   - Backend: `pytest backend/tests` (run from root or backend dir and use conda meetAssistant environment).
   - Frontend: `npm test` inside `frontend/`.
