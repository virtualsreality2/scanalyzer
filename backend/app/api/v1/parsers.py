"""
Parsers API endpoints.
Information about available parsers and their capabilities.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_parsers():
    """List all available parsers."""
    return {
        "parsers": [
            {"name": "prowler", "enabled": True, "versions": ["v2", "v3"]},
            {"name": "checkov", "enabled": True},
            {"name": "bandit", "enabled": True},
        ]
    }

@router.get("/{parser_name}")
async def get_parser_info(parser_name: str):
    """Get information about a specific parser."""
    return {"name": parser_name, "enabled": True}