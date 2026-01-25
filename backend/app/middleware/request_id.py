"""Request ID middleware for distributed tracing."""

import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from contextvars import ContextVar

# Context variable to store request ID throughout the request lifecycle
request_id_contextvar: ContextVar[str] = ContextVar("request_id", default=None)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds a unique request ID to each request.
    
    The request ID can be:
    - Provided by the client via X-Request-ID header (for distributed tracing)
    - Generated automatically if not provided
    
    The request ID is:
    - Added to the response headers as X-Request-ID
    - Stored in context variable for access in logs
    - Available throughout the request lifecycle
    """
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Check if client provided a request ID
        request_id = request.headers.get("X-Request-ID")
        
        # Generate one if not provided
        if not request_id:
            request_id = str(uuid.uuid4())
        
        # Store in context variable
        request_id_contextvar.set(request_id)
        
        # Add to request state for easy access
        request.state.request_id = request_id
        
        # Process request
        response = await call_next(request)
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response


def get_request_id() -> str:
    """Get the current request ID from context."""
    return request_id_contextvar.get()
