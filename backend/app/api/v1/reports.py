"""
Reports API endpoints.
Handles upload, processing, and management of security reports.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_reports():
    """List all reports."""
    return {"reports": [], "total": 0}

@router.post("/upload")
async def upload_report():
    """Upload a new report for processing."""
    return {"message": "Report upload endpoint"}