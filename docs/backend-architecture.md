# Backend Architecture

## Pattern: Router → Service → Repository → Model

Every module follows a four-layer pattern:

```
modules/meetings/
  models.py       # SQLAlchemy ORM models
  schemas.py      # Pydantic request/response schemas
  repository.py   # Database access layer (extends BaseRepository)
  service.py      # Business logic (delegates to sub-services for large domains)
  router.py       # FastAPI endpoints (thin HTTP layer)
  services/       # Sub-services extracted from large service files
    chat_service.py
    export_service.py
    ...
```

### Layer responsibilities

| Layer      | Responsibility                                    | No HTTP? | No DB? |
|-----------|---------------------------------------------------|----------|--------|
| Router     | Parse request, call service, return response       | No       | Yes    |
| Service    | Business logic, validation, cross-cutting          | Yes      | Yes    |
| Repository | Raw DB queries, extends `BaseRepository[Model, Create, Update]` | Yes | No |
| Model      | SQLAlchemy table definition (use mixins)           | Yes      | No     |

### Router rules

1. **Routers are thin.** One line per endpoint: parse params, call service, return.
   ```python
   @router.get("/")
   def list_meetings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
       return _service(db).list_meetings(skip=skip, limit=limit)
   ```

2. All modules use `_service(db)` helper:
   ```python
   def _service(db: Session) -> MeetingService:
       return MeetingService(db)
   ```

### Service rules

1. **Services take `db: Session` in `__init__`** and create repositories there:
   ```python
   class MeetingService:
       def __init__(self, db: Session):
           self.db = db
           self.repo = MeetingRepository(db)
   ```

2. **Giant services are split** into sub-services under `services/`. The main
   `service.py` stays as a thin facade delegating to sub-services. All callers
   import from `service.py` — internals are transparent.

3. **Lazy imports for circular deps** are expected and documented:
   ```python
   # Inside method — lazy import to avoid circular dependency:
   #   service -> tasks -> processing -> llm -> service
   from ...tasks import process_meeting_task
   ```

### Repository rules

1. All repositories extend `BaseRepository[ModelType, CreateSchema, UpdateSchema]`
   from `app.core.base.repository`.

2. Add domain-specific methods to the repository, not the service.

3. Use `get_or_404()` for HTTP-facing lookups, `get_or_raise()` with custom
   exceptions otherwise.

### Model rules

1. Use mixins from `app.core.base.mixins`:
   - `TimestampMixin` — adds `created_at` / `updated_at`
   - `SoftDeleteMixin` — adds `deleted_at` / `is_deleted`
   - `StatusMixin` — adds `status` / `status_changed_at`
   - `MetadataMixin` — adds JSONB `metadata_json`

2. Models go in `modules/<name>/models.py`. Top-level `app/models.py` is a
   re-export convenience for Alembic and cross-module imports.

### Adding a new module

```
# 1. Create module directory
modules/new_feature/
  __init__.py     # Re-exports: from .service import NewFeatureService
  models.py       # SQLAlchemy models
  schemas.py      # Pydantic schemas
  repository.py   # Database layer
  service.py      # Business logic
  router.py       # FastAPI routes

# 2. Register in app/main.py
from .modules.new_feature import router as new_feature_router
app.include_router(new_feature_router.router, prefix="/api/v1")

# 3. Add to app/models.py re-exports
from .modules.new_feature.models import NewModel

# 4. Run Alembic migration
alembic revision --autogenerate -m "add new_feature"
```

### Import conventions

- **Intra-module**: use relative imports (`from . import models`)
- **Cross-module in same parent**: use relative (`from ..chat import schemas`)
- **Cross-module from elsewhere**: use absolute (`from app.modules.settings.service import SettingsService`)
- **Core utilities**: always absolute (`from app.core.base import BaseRepository`)
