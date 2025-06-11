"""
Main FastAPI application for Scanalyzer backend.
Configures middleware, exception handlers, and API routes.
"""

import time
import uuid
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from .core.config import settings
from .core.logging import get_logger, request_id_var, log_memory_usage
from .db.base import init_db, close_db, check_database_health, DatabaseManager
from .api.v1 import api_router
from .core.exceptions import (
    ScanalyzerException,
    ValidationException,
    ResourceNotFoundException,
    ProcessingException,
)


logger = get_logger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to add request ID to all requests for tracing."""
    
    async def dispatch(self, request: Request, call_next):
        # Generate or extract request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Set request ID in context
        token = request_id_var.set(request_id)
        
        # Add request ID to request state
        request.state.request_id = request_id
        
        try:
            # Process request
            start_time = time.time()
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Add headers to response
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(process_time)
            
            # Log request completion
            logger.info(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                process_time=process_time,
            )
            
            return response
            
        except Exception as e:
            # Log error
            logger.error(
                "Request failed",
                method=request.method,
                path=request.url.path,
                error=str(e),
            )
            raise
        finally:
            # Reset context
            request_id_var.reset(token)


class MemoryMonitorMiddleware(BaseHTTPMiddleware):
    """Middleware to monitor memory usage for desktop app."""
    
    async def dispatch(self, request: Request, call_next):
        # Check memory before request
        import psutil
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024  # MB
        
        response = await call_next(request)
        
        # Check memory after request
        memory_after = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = memory_after - memory_before
        
        # Log if significant memory increase
        if memory_increase > 50:  # 50MB threshold
            logger.warning(
                "Significant memory increase during request",
                path=request.url.path,
                memory_increase_mb=memory_increase,
                total_memory_mb=memory_after,
            )
        
        # Add memory info to response headers (development only)
        if settings.is_development:
            response.headers["X-Memory-Usage-MB"] = f"{memory_after:.2f}"
            response.headers["X-Memory-Increase-MB"] = f"{memory_increase:.2f}"
        
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    Handles database initialization and cleanup.
    """
    # Startup
    logger.info("Starting Scanalyzer backend", version=settings.APP_VERSION)
    
    try:
        # Initialize database
        await init_db()
        
        # Run startup tasks
        asyncio.create_task(periodic_cleanup())
        asyncio.create_task(periodic_memory_check())
        
        logger.info("Scanalyzer backend started successfully")
        
    except Exception as e:
        logger.error("Failed to start application", error=str(e))
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Scanalyzer backend")
    
    try:
        # Close database connections
        await close_db()
        
        # Cancel background tasks
        tasks = [t for t in asyncio.all_tasks() if t != asyncio.current_task()]
        for task in tasks:
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*tasks, return_exceptions=True)
        
        logger.info("Scanalyzer backend shutdown complete")
        
    except Exception as e:
        logger.error("Error during shutdown", error=str(e))


# Create FastAPI application
app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.APP_VERSION,
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json" if settings.ENABLE_SWAGGER_UI else None,
    docs_url=f"{settings.API_V1_PREFIX}/docs" if settings.ENABLE_SWAGGER_UI else None,
    redoc_url=f"{settings.API_V1_PREFIX}/redoc" if settings.ENABLE_REDOC else None,
    lifespan=lifespan,
)


# Add middleware
app.add_middleware(RequestIDMiddleware)
app.add_middleware(MemoryMonitorMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

# Gzip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Trusted host middleware (production only)
if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1", "*.scanalyzer.local"]
    )


# Exception handlers
@app.exception_handler(ScanalyzerException)
async def scanalyzer_exception_handler(request: Request, exc: ScanalyzerException):
    """Handle custom Scanalyzer exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.error_code,
            "message": exc.message,
            "details": exc.details,
            "request_id": request.state.request_id,
        },
    )


@app.exception_handler(ValidationException)
async def validation_exception_handler(request: Request, exc: ValidationException):
    """Handle validation exceptions."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "VALIDATION_ERROR",
            "message": str(exc),
            "details": exc.details,
            "request_id": request.state.request_id,
        },
    )


@app.exception_handler(ResourceNotFoundException)
async def not_found_exception_handler(request: Request, exc: ResourceNotFoundException):
    """Handle resource not found exceptions."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "RESOURCE_NOT_FOUND",
            "message": str(exc),
            "resource": exc.resource_type,
            "resource_id": exc.resource_id,
            "request_id": request.state.request_id,
        },
    )


@app.exception_handler(ProcessingException)
async def processing_exception_handler(request: Request, exc: ProcessingException):
    """Handle processing exceptions."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "PROCESSING_ERROR",
            "message": "An error occurred while processing your request",
            "details": str(exc) if settings.is_development else None,
            "request_id": request.state.request_id,
        },
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle FastAPI request validation errors."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Invalid request data",
            "details": exc.errors() if settings.is_development else None,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle Starlette HTTP exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": f"HTTP_{exc.status_code}",
            "message": exc.detail,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions."""
    logger.error(
        "Unhandled exception",
        error=str(exc),
        error_type=type(exc).__name__,
        path=request.url.path,
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred",
            "details": str(exc) if settings.is_development else None,
            "request_id": getattr(request.state, "request_id", None),
        },
    )


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with basic information."""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat(),
    }


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for monitoring.
    Returns detailed health status of all components.
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "components": {},
    }
    
    # Check database health
    db_health = await check_database_health()
    health_status["components"]["database"] = db_health
    
    # Check memory usage
    import psutil
    process = psutil.Process()
    memory_info = process.memory_info()
    memory_percent = process.memory_percent()
    
    health_status["components"]["memory"] = {
        "status": "healthy" if memory_percent < 80 else "warning",
        "usage_mb": memory_info.rss / 1024 / 1024,
        "usage_percent": memory_percent,
        "limit_mb": settings.MEMORY_LIMIT_MB,
    }
    
    # Check disk usage
    disk_usage = psutil.disk_usage(str(settings.STORAGE_DIR))
    health_status["components"]["disk"] = {
        "status": "healthy" if disk_usage.percent < 90 else "warning",
        "usage_percent": disk_usage.percent,
        "free_gb": disk_usage.free / 1024 / 1024 / 1024,
    }
    
    # Overall status
    if any(comp.get("status") == "unhealthy" for comp in health_status["components"].values()):
        health_status["status"] = "unhealthy"
    elif any(comp.get("status") == "warning" for comp in health_status["components"].values()):
        health_status["status"] = "warning"
    
    # Return appropriate status code
    status_code = status.HTTP_200_OK
    if health_status["status"] == "unhealthy":
        status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    
    return JSONResponse(content=health_status, status_code=status_code)


# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# Background tasks
async def periodic_cleanup():
    """Periodic cleanup task for temporary files and old data."""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            
            # Clean temporary files
            deleted_count = settings.cleanup_temp_files()
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} temporary files")
            
            # Optimize database
            await DatabaseManager.optimize_database()
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Error in periodic cleanup", error=str(e))


async def periodic_memory_check():
    """Periodic memory usage check."""
    while True:
        try:
            await asyncio.sleep(settings.MEMORY_CHECK_INTERVAL)
            
            # Check memory usage
            import psutil
            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024
            
            log_memory_usage("application", memory_mb, settings.MEMORY_LIMIT_MB)
            
            # Force garbage collection if memory is high
            if memory_mb > settings.MEMORY_LIMIT_MB * 0.8:
                import gc
                gc.collect()
                logger.info("Forced garbage collection due to high memory usage")
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Error in memory check", error=str(e))


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.is_development,
        log_config=None,  # Use our custom logging
        access_log=False,  # Disable access logs (we handle them)
    )