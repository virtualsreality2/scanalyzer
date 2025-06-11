"""
Findings API endpoints.
Manages security findings extracted from reports.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_findings():
    """List all findings with filtering and pagination."""
    return {"findings": [], "total": 0}

@router.get("/{finding_id}")
async def get_finding(finding_id: str):
    """Get a specific finding by ID."""
    return {"id": finding_id, "message": "Finding details"}