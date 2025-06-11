"""
System API endpoints.
System information, statistics, and maintenance operations.
"""

from fastapi import APIRouter
from ...core.config import settings

router = APIRouter()

@router.get("/info")
async def system_info():
    """Get system information."""
    return {
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "storage_paths": settings.get_storage_info(),
    }

@router.get("/stats")
async def system_stats():
    """Get system statistics."""
    return {
        "reports_count": 0,
        "findings_count": 0,
        "storage_used_mb": 0,
    }