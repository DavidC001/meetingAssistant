from celery import Celery
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# It's good practice to have a default for local development
# The values from docker-compose.yml will be used when running in Docker
celery_broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
celery_result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

# Initialize Celery
celery_app = Celery(
    "tasks",
    broker=celery_broker_url,
    backend=celery_result_backend,
    include=["app.tasks"]  # Point to the module where tasks are defined
)

# Optional Celery configuration
celery_app.conf.update(
    task_track_started=True,
    broker_connection_retry_on_startup=True,
)
