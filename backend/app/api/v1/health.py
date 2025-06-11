"""
Health check endpoints for monitoring application status.
"""

import time
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.base import get_session, check_database_health
from ...core.config import settings
from ...core.logging import get_logger


router = APIRouter()
logger = get_logger(__name__)


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_session)) -> Dict[str, Any]:
    """
    Readiness probe to check if the application is ready to serve requests.
    Checks database connectivity and other critical services.
    """
    try:
        # Check database
        await db.execute("SELECT 1")
        db_ready = True
    except Exception as e:
        logger.error("Database readiness check failed", error=str(e))
        db_ready = False
    
    is_ready = db_ready
    
    return {
        "ready": is_ready,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {
            "database": db_ready,
        }
    }


@router.get("/health/live")
async def liveness_check() -> Dict[str, Any]:
    """
    Liveness probe to check if the application is running.
    Simple check that doesn't depend on external services.
    """
    return {
        "alive": True,
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/health/startup")
async def startup_check() -> Dict[str, Any]:
    """
    Startup probe to check if the application has started successfully.
    Used by orchestrators to know when the app is ready for traffic.
    """
    import psutil
    process = psutil.Process()
    
    return {
        "started": True,
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": time.time() - process.create_time(),
        "memory_mb": process.memory_info().rss / 1024 / 1024,
    }