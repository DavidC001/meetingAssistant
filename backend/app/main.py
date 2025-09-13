from fastapi import FastAPI
from .database import engine, Base
from .routers import meetings, settings, admin
from .startup import startup_recovery
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create all tables in the database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Meeting Assistant API",
    description="Enhanced API for transcribing and analyzing meetings with export capabilities.",
    version="1.0.0",
)

# Increase the maximum file size for uploads (3GB)
app.max_request_size = 3 * 1024 * 1024 * 1024  # 3GB

app.include_router(meetings.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    """Run startup recovery procedures"""
    logger.info("Starting Enhanced Meeting Assistant API...")
    try:
        startup_recovery()
    except Exception as e:
        logger.error(f"Error during startup recovery: {e}", exc_info=True)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to the Enhanced Meeting Assistant API",
        "version": "1.0.0",
        "features": [
            "Audio/Video transcription",
            "Speaker diarization", 
            "AI-powered meeting analysis",
            "Export to multiple formats (JSON, TXT, DOCX, PDF)",
            "Calendar generation for action items",
            "Advanced caching system",
            "GPU acceleration support"
        ]
    }
