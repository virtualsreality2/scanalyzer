"""
API v1 router aggregation.
Combines all API endpoints into a single router.
"""

from fastapi import APIRouter

from .health import router as health_router
from .reports import router as reports_router
from .findings import router as findings_router
from .parsers import router as parsers_router
from .system import router as system_router


api_router = APIRouter()

# Include all routers
api_router.include_router(health_router, tags=["Health"])
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
api_router.include_router(findings_router, prefix="/findings", tags=["Findings"])
api_router.include_router(parsers_router, prefix="/parsers", tags=["Parsers"])
api_router.include_router(system_router, prefix="/system", tags=["System"])


__all__ = ["api_router"]