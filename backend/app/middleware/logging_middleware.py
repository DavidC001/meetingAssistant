"""Logging middleware for request/response logging with structured data."""

import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from .request_id import get_request_id

logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs all HTTP requests and responses with structured data.
    
    Logs include:
    - Request ID for correlation
    - Method, path, query parameters
    - Response status code
    - Request duration
    - Client IP address
    - User agent
    """
    
    def __init__(self, app, excluded_paths: set = None):
        super().__init__(app)
        # Paths to exclude from logging (e.g., health checks)
        self.excluded_paths = excluded_paths or {"/health", "/api/v1/health"}
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip logging for excluded paths
        if request.url.path in self.excluded_paths:
            return await call_next(request)
        
        # Record start time
        start_time = time.time()
        
        # Get request details
        request_id = get_request_id()
        method = request.method
        path = request.url.path
        query_params = dict(request.query_params)
        client_host = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        # Log request
        logger.info(
            "HTTP request started",
            extra={
                "request_id": request_id,
                "method": method,
                "path": path,
                "query_params": query_params,
                "client_ip": client_host,
                "user_agent": user_agent,
            }
        )
        
        # Process request
        try:
            response = await call_next(request)
        except Exception as exc:
            # Log exception with request context
            duration = time.time() - start_time
            logger.error(
                f"HTTP request failed: {exc}",
                extra={
                    "request_id": request_id,
                    "method": method,
                    "path": path,
                    "duration_ms": round(duration * 1000, 2),
                    "error": str(exc),
                    "error_type": type(exc).__name__,
                },
                exc_info=True
            )
            raise
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log response
        log_level = logging.INFO
        if response.status_code >= 500:
            log_level = logging.ERROR
        elif response.status_code >= 400:
            log_level = logging.WARNING
        
        logger.log(
            log_level,
            f"HTTP request completed: {response.status_code}",
            extra={
                "request_id": request_id,
                "method": method,
                "path": path,
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
            }
        )
        
        # Add duration header for debugging
        response.headers["X-Process-Time"] = f"{duration:.4f}"
        
        return response
