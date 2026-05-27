# Contributing

## Adding a new feature module

### 1. Create the module structure

```
backend/app/modules/new_feature/
├── __init__.py      # Re-export: from .service import NewFeatureService
├── models.py        # SQLAlchemy ORM models (use mixins from app.core.base.mixins)
├── schemas.py       # Pydantic request/response schemas
├── repository.py    # Database access extending BaseRepository
├── service.py       # Business logic
└── router.py        # FastAPI endpoints (thin — delegate to service)
```

### 2. Register in the app

In `backend/app/main.py`:
```python
from .modules.new_feature import router as new_feature_router
app.include_router(new_feature_router.router, prefix="/api/v1")
```

In `backend/app/models.py` (for Alembic auto-detection):
```python
from .modules.new_feature.models import NewModel
```

### 3. Run a migration

```bash
cd backend
alembic revision --autogenerate -m "add new_feature"
alembic upgrade head
```

### 4. Add frontend

```
frontend/src/components/features/new-feature/
├── index.js          # Re-exports
├── containers/
│   └── NewFeatureContainer.js
├── presentation/
│   └── NewFeature.js
└── hooks/
    └── useNewFeature.js
```

Add a service wrapper in `frontend/src/services/newFeatureService.js`.

## Code conventions

### Backend (Python)

- **Formatting**: ruff (see `.pre-commit-config.yaml`)
- **Type hints**: use `| None` (Python 3.10+), not `Optional[X]`
- **Imports**:
  - Intra-module: relative (`from . import models`)
  - Cross-module same parent: relative (`from ..chat import schemas`)
  - Cross-module elsewhere: absolute (`from app.modules.settings.service import SettingsService`)
- **Docstrings**: Google-style for public methods
- **Services**: take `db: Session` in `__init__`, create repositories there
- **Routers**: one line per endpoint (`return _service(db).do_thing(...)`)
- **Lazy imports**: ok for circular dep avoidance, add a comment explaining why

### Frontend (JavaScript/React)

- **Formatting**: Prettier + ESLint (see `.pre-commit-config.yaml`)
- **Presentational components**: pure functions, no hooks, no API calls
- **Containers**: manage state, call hooks/services, pass props down
- **Hooks**: prefixed with `use`, return `{ data, loading, error, refresh }`
- **Services**: all API calls in `src/services/`, never call axios directly in components
- **File naming**: PascalCase for components, camelCase for everything else

## Testing

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm test

# Pre-commit (runs on every commit)
pre-commit run --all-files
```

### Test patterns

- **Repositories**: mock the DB session, test query construction
- **Services**: mock repositories, test business logic
- **Routers**: use FastAPI TestClient, mock the service layer
- **Frontend components**: render with mock props, assert output
- **Frontend hooks**: `renderHook` with mocked services

## Pre-commit hooks

The project uses pre-commit to enforce quality before every commit:

```bash
pip install pre-commit
pre-commit install
```

Hooks include:
- **ruff** (Python linting + formatting)
- **eslint** (JavaScript linting)
- **prettier** (JS/CSS formatting)
- **trailing-whitespace**, **end-of-file-fixer**, **check-yaml**, **check-json**

## When service files get too large

If a service file exceeds ~800 lines, split it using the sub-service pattern:

```
modules/meetings/service.py          # Thin facade (~200 lines)
modules/meetings/services/
├── chat_service.py                  # Chat-specific logic
├── export_service.py                # Export-specific logic
└── attachment_service.py            # Attachment-specific logic
```

The main `service.py` keeps all original method signatures — it just delegates
to sub-services via lazy properties. Callers don't change at all.
