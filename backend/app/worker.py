from celery import Celery
import logging

from .core.config import config

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Download NLTK data at startup
try:
    import nltk
    nltk.download('punkt_tab', quiet=True)
    nltk.download('stopwords', quiet=True)
    logger.info("NLTK data downloaded successfully")
except Exception as e:
    logger.warning(f"Could not download NLTK data: {e}")

# Try to import torch and check for GPU availability
try:
    import torch
    gpu_available = torch.cuda.is_available()
    logger.info(f"CUDA available: {gpu_available}")
    if gpu_available:
        logger.info(f"CUDA device count: {torch.cuda.device_count()}")
        logger.info(f"Current CUDA device: {torch.cuda.current_device()}")
        logger.info(f"CUDA device name: {torch.cuda.get_device_name()}")
    else:
        logger.warning("CUDA not available, using CPU")
except ImportError:
    logger.warning("PyTorch not available")
    torch = None
    gpu_available = False
except Exception as e:
    logger.warning(f"Error checking GPU availability: {e}")
    torch = None
    gpu_available = False

# It's good practice to have a default for local development
# The values from docker-compose.yml will be used when running in Docker
celery_broker_url = config.celery.broker_url
celery_result_backend = config.celery.result_backend

# Initialize Celery
celery_app = Celery(
    "tasks",
    broker=celery_broker_url,
    backend=celery_result_backend,
    include=["app.tasks"]  # Point to the module where tasks are defined
)

# Enhanced Celery configuration
celery_app.conf.update(
    task_track_started=True,
    broker_connection_retry_on_startup=True,
    worker_prefetch_multiplier=1,  # Process one task at a time for GPU workloads
    task_acks_late=True,  # Acknowledge tasks only after completion
    worker_disable_rate_limits=True,
    task_reject_on_worker_lost=True,
    task_time_limit=3600,  # 1 hour timeout for large files
    task_soft_time_limit=3300,  # 55 minute soft timeout
    worker_max_memory_per_child=4000000,  # 4GB memory limit per worker
    # Force spawn method for CUDA compatibility
    worker_pool='solo',  # Use solo pool which avoids multiprocessing issues with CUDA
)

# Worker shutdown signal handler to properly cleanup GPU resources
@celery_app.task(bind=True)
def cleanup_gpu_resources(self):
    """Cleanup GPU resources when worker shuts down"""
    try:
        if torch and torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("GPU cache cleared")
    except Exception as e:
        logger.error(f"Error cleaning up GPU resources: {e}")

# Worker signal handlers (simplified)
def on_worker_init(**kwargs):
    """Worker startup callback"""
    logger.info("Worker started - CUDA initialization will happen as needed")

def on_worker_shutdown(**kwargs):
    """Worker shutdown callback"""
    logger.info("Worker shutdown")
    try:
        if torch and hasattr(torch, 'cuda') and torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Connect the signals using the new Celery 5.x syntax
try:
    from celery.signals import worker_ready, worker_shutdown
    worker_ready.connect(on_worker_init)
    worker_shutdown.connect(on_worker_shutdown)
except ImportError:
    logger.warning("Could not import Celery signals")
except Exception as e:
    logger.error(f"Error connecting signals: {e}")
