"""
Main FastAPI application for the Meeting Assistant.

This module sets up the FastAPI application with proper configuration,
database initialization, and route registration.
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import meetings, settings, admin, ollama
from .startup import startup_recovery
from .core.config import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create all tables in the database
Base.metadata.create_all(bind=engine)

# Create FastAPI application with configuration
app = FastAPI(
    title=config.title,
    description=config.description,
    version=config.version,
    debug=config.debug
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set maximum request size for large file uploads
app.max_request_size = config.upload.max_file_size_bytes

# Register routers
app.include_router(meetings.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(ollama.router, prefix="/api/v1")

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
    """Root endpoint with API information."""
    return {
        "message": f"Welcome to the {config.title}",
        "version": config.version,
        "features": [
            "Audio/Video transcription",
            "Speaker diarization", 
            "AI-powered meeting analysis",
            "Export to multiple formats (JSON, TXT, DOCX, PDF)",
            "Calendar generation for action items",
            "Advanced caching system",
            "GPU acceleration support"
        ],
        "upload_limits": {
            "max_file_size_mb": config.upload.max_file_size_mb,
            "allowed_extensions": list(config.upload.allowed_extensions)
        }
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": config.version,
        "timestamp": "2024-01-01T00:00:00Z"  # You might want to use actual timestamp
    }
