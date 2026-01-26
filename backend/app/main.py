"""
Main FastAPI application for the Meeting Assistant.

This module sets up the FastAPI application with proper configuration,
database initialization, and route registration.
"""

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .database import engine, Base
from .middleware import RequestIDMiddleware, LoggingMiddleware
from .modules.meetings import router as meetings_router
from .modules.settings import router as settings_router
from .modules.settings import router_drive as google_drive_router
from .modules.settings import router_backup as backup_router
from .modules.admin import router as admin_router
from .modules.ollama import router as ollama_router
from .modules.calendar import router as calendar_router
from .modules.chat import router as chat_router
from .modules.graph import router as graph_router
from .modules.users import router as users_router
from .modules.templates import router as templates_router
from .modules.search import router as search_router
from .startup import startup_recovery
from .core.config import config
from .core.base.exceptions import MeetingAssistantError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure pgvector extension is available before creating tables
try:
    with engine.connect() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        connection.commit()
except Exception as exc:  # pragma: no cover - best effort for non-Postgres setups
    logger.warning("Could not ensure pgvector extension: %s", exc)

# Create all tables in the database (for new installations)
Base.metadata.create_all(bind=engine)

# Run database migrations (for existing installations)
try:
    with engine.connect() as connection:
        # Make transcription_id nullable in action_items table if needed
        connection.execute(text("""
            DO $$
            BEGIN
                -- Check if the column exists and is NOT NULL
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'action_items'
                    AND column_name = 'transcription_id'
                    AND is_nullable = 'NO'
                ) THEN
                    -- Alter the column to be nullable
                    ALTER TABLE action_items ALTER COLUMN transcription_id DROP NOT NULL;
                    RAISE NOTICE 'Made transcription_id nullable in action_items table';
                END IF;
            END $$;
        """))
        connection.commit()
        logger.info("Database migrations completed successfully")
except Exception as exc:
    logger.error("Error running database migrations: %s", exc)
    # Don't fail startup if migration fails - might already be applied
    pass

# Create FastAPI application with comprehensive configuration
app = FastAPI(
    title=config.title,
    description=config.description,
    version=config.version,
    debug=config.debug,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    openapi_tags=[
        {
            "name": "meetings",
            "description": "Operations for managing meetings, including upload, transcription, analysis, and export"
        },
        {
            "name": "chat",
            "description": "AI-powered chat interface for querying meeting content and global knowledge base"
        },
        {
            "name": "settings",
            "description": "Configuration management for API keys, model settings, and embeddings"
        },
        {
            "name": "calendar",
            "description": "Google Calendar integration for scheduled meetings and action item sync"
        },
        {
            "name": "templates",
            "description": "Meeting templates for standardized processing and analysis"
        },
        {
            "name": "search",
            "description": "Semantic and keyword search across all meetings and transcripts"
        },
        {
            "name": "users",
            "description": "User mapping for email addresses and task assignment"
        },
        {
            "name": "admin",
            "description": "Administrative operations including worker management and system cleanup"
        },
        {
            "name": "ollama",
            "description": "Local LLM management via Ollama integration"
        },
        {
            "name": "graph",
            "description": "Meeting relationship visualization and network analysis"
        },
        {
            "name": "backup",
            "description": "Data backup and restore operations"
        },
        {
            "name": "drive",
            "description": "Google Drive integration for file synchronization"
        }
    ],
    contact={
        "name": "Meeting Assistant Support",
        "url": "https://github.com/yourusername/meetingAssistant"
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    }
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add Request ID middleware for distributed tracing
app.add_middleware(RequestIDMiddleware)

# Add Logging middleware for structured request/response logging
app.add_middleware(LoggingMiddleware, excluded_paths={"/health", "/api/v1/health"})


# Global exception handler for better error responses
from .middleware.request_id import get_request_id

@app.exception_handler(MeetingAssistantError)
async def meeting_assistant_exception_handler(request: Request, exc: MeetingAssistantError):
    """
    Handle custom application exceptions with proper error formatting.
    
    Includes request ID for error tracing and detailed error information
    when debug mode is enabled.
    """
    request_id = get_request_id()
    logger.error(
        f"Application error: {exc.message}",
        extra={
            "request_id": request_id,
            "error_type": exc.__class__.__name__,
            "http_status": exc.http_status,
        },
        exc_info=exc.original_error
    )
    
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "error": {
                "code": exc.__class__.__name__,
                "message": exc.message,
                "details": exc.details,
                "request_id": request_id
            }
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle unexpected exceptions with proper logging and error formatting.
    
    In production mode, hides internal error details for security.
    In debug mode, exposes full error information for troubleshooting.
    """
    request_id = get_request_id()
    logger.error(
        f"Unexpected error: {str(exc)}",
        extra={
            "request_id": request_id,
            "error_type": type(exc).__name__,
            "path": request.url.path,
        },
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "InternalServerError",
                "message": "An unexpected error occurred. Please try again later.",
                "details": {"error": str(exc), "type": type(exc).__name__} if config.debug else {},
                "request_id": request_id
            }
        }
    )


# Set maximum request size for large file uploads
app.max_request_size = config.upload.max_file_size_bytes

# Register routers
app.include_router(meetings_router.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")
app.include_router(google_drive_router.router, prefix="/api/v1")
app.include_router(backup_router.router, prefix="/api/v1")
app.include_router(admin_router.router, prefix="/api/v1")
app.include_router(ollama_router.router, prefix="/api/v1")
app.include_router(calendar_router.router, prefix="/api/v1")
app.include_router(chat_router.router, prefix="/api/v1")
app.include_router(graph_router.router, prefix="/api/v1")
app.include_router(users_router.router, prefix="/api/v1")
app.include_router(templates_router.router, prefix="/api/v1")
app.include_router(search_router.router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    """Run startup recovery procedures."""
    logger.info(f"Starting {config.title} v{config.version}...")
    try:
        startup_recovery()
        logger.info("Startup recovery completed successfully")
    except Exception as e:
        logger.error(f"Error during startup recovery: {e}", exc_info=True)


@app.get("/")
def read_root():
    """
    Root endpoint with API information.
    
    Returns general information about the API including version, features,
    and upload limits.
    
    Returns:
        dict: API information including:
            - message: Welcome message
            - version: Current API version
            - features: List of supported features
            - upload_limits: File upload constraints
            - docs: Links to API documentation
    """
    return {
        "message": f"Welcome to the {config.title}",
        "version": config.version,
        "features": [
            "Audio/Video transcription with Whisper",
            "Speaker diarization with Pyannote", 
            "AI-powered meeting analysis",
            "Export to multiple formats (JSON, TXT, DOCX, PDF, SRT)",
            "Calendar generation for action items",
            "Advanced caching and retry system",
            "GPU acceleration support",
            "Vector-based semantic search",
            "Multi-LLM support (OpenAI, Ollama, Azure)"
        ],
        "upload_limits": {
            "max_file_size_mb": config.upload.max_file_size_mb,
            "allowed_extensions": list(config.upload.allowed_extensions)
        },
        "docs": {
            "swagger": "/api/docs",
            "redoc": "/api/redoc",
            "openapi_spec": "/api/openapi.json"
        }
    }


@app.get("/health")
def health_check():
    """
    Health check endpoint.
    
    Provides basic health status for load balancers and monitoring systems.
    
    Returns:
        dict: Health status with:
            - status: Always "healthy" if endpoint responds
            - version: Current API version
            - timestamp: Current UTC timestamp in ISO format
    """
    from datetime import datetime, timezone
    
    return {
        "status": "healthy",
        "version": config.version,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/health/detailed")
def detailed_health_check():
    """
    Detailed health check endpoint.
    
    Comprehensive system health check including database connectivity,
    Celery worker status, and Redis availability.
    
    Returns:
        dict: Detailed health status with:
            - status: Overall system health ("healthy", "degraded", or "unhealthy")
            - version: Current API version
            - timestamp: Current UTC timestamp
            - components: Health status of individual system components
                - database: PostgreSQL connection status
                - workers: Celery worker availability and queue status
                - cache: Redis connection status
    """
    from datetime import datetime, timezone
    from .worker import celery_app
    from .database import SessionLocal
    
    health_status = {
        "status": "healthy",
        "version": config.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {}
    }
    
    # Check database
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        health_status["components"]["database"] = {
            "status": "healthy",
            "type": "postgresql"
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Check Celery workers
    try:
        inspect = celery_app.control.inspect(timeout=2.0)
        
        # Get active workers
        active = inspect.active()
        stats = inspect.stats()
        
        if active is None or stats is None:
            health_status["status"] = "degraded"
            health_status["components"]["celery"] = {
                "status": "unhealthy",
                "message": "No workers responding",
                "workers": []
            }
        else:
            worker_count = len(stats.keys())
            active_tasks = sum(len(tasks) for tasks in active.values()) if active else 0
            
            health_status["components"]["celery"] = {
                "status": "healthy",
                "workers": worker_count,
                "active_tasks": active_tasks,
                "worker_details": [
                    {
                        "name": name,
                        "active_tasks": len(active.get(name, [])),
                        "pool": info.get("pool", {}).get("implementation") if isinstance(info.get("pool"), dict) else "unknown"
                    }
                    for name, info in stats.items()
                ]
            }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["components"]["celery"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Check Redis (via Celery connection)
    try:
        celery_app.backend.client.ping()
        health_status["components"]["redis"] = {
            "status": "healthy",
            "type": "redis"
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["components"]["redis"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    return health_status
