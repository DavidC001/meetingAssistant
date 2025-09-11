from fastapi import FastAPI
from .database import engine, Base
from .routers import meetings, settings

# Create all tables in the database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Meeting Assistant API",
    description="API for transcribing and analyzing meetings.",
    version="0.1.0",
)

# Increase the maximum file size for uploads (5GB)
app.max_request_size = 5 * 1024 * 1024 * 1024  # 5GB

app.include_router(meetings.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Meeting Assistant API"}
