"""
Report schemas for request/response validation.
"""

import re
from typing import Optional, List
from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, Field, field_validator, ConfigDict

from ..models.report import ReportStatus
from .common import PaginatedResponse


class ReportBase(BaseModel):
    """Base report schema."""
    filename: str = Field(..., min_length=1, max_length=255)
    file_path: str = Field(..., min_length=1, max_length=500)
    file_size: int = Field(..., gt=0, le=500_000_000)  # Max 500MB
    file_hash: str = Field(..., min_length=6, max_length=128)  # Support various hash formats
    tool_name: str = Field(..., min_length=1, max_length=100)
    tool_version: Optional[str] = Field(None, max_length=50)
    
    @field_validator("file_path")
    @classmethod
    def validate_file_path(cls, v: str) -> str:
        """Validate file path to prevent directory traversal."""
        # Normalize path
        path = Path(v).resolve()
        path_str = str(path)
        
        # Check for suspicious patterns
        suspicious_patterns = [
            "..",  # Parent directory
            "~",   # Home directory
            "/etc",  # System directories
            "/proc",
            "/sys",
            "\\",  # Windows path separators in Linux
        ]
        
        for pattern in suspicious_patterns:
            if pattern in path_str:
                raise ValueError(f"Invalid file path: contains '{pattern}'")
        
        # Ensure path doesn't start with / (absolute path)
        if path_str.startswith("/") and not path_str.startswith("/uploads/"):
            raise ValueError("File path must be relative or start with /uploads/")
        
        return path_str
    
    @field_validator("tool_name")
    @classmethod
    def validate_tool_name(cls, v: str) -> str:
        """Validate tool name against allowed tools."""
        allowed_tools = [
            "prowler", "checkov", "bandit", "trivy", "grype",
            "semgrep", "gitleaks", "terrascan", "tfsec", "snyk"
        ]
        if v.lower() not in allowed_tools:
            # Allow but log warning for unknown tools
            pass
        return v.lower()


class ReportCreate(ReportBase):
    """Schema for creating a new report."""
    pass


class ReportUpdate(BaseModel):
    """Schema for updating a report."""
    status: Optional[ReportStatus] = None
    processed_at: Optional[datetime] = None
    processing_time: Optional[float] = Field(None, ge=0)
    error_message: Optional[str] = None
    total_findings: Optional[int] = Field(None, ge=0)
    critical_count: Optional[int] = Field(None, ge=0)
    high_count: Optional[int] = Field(None, ge=0)
    medium_count: Optional[int] = Field(None, ge=0)
    low_count: Optional[int] = Field(None, ge=0)
    
    model_config = ConfigDict(from_attributes=True)


class ReportInDB(ReportBase):
    """Schema for report in database."""
    id: int
    status: ReportStatus
    processed_at: Optional[datetime]
    processing_time: Optional[float]
    error_message: Optional[str]
    total_findings: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ReportResponse(ReportInDB):
    """Schema for report response."""
    pass


class ReportSummary(BaseModel):
    """Summary view of a report."""
    id: int
    filename: str
    tool_name: str
    status: ReportStatus
    total_findings: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ReportListParams(BaseModel):
    """Parameters for listing reports."""
    page: int = Field(1, ge=1)
    size: int = Field(50, ge=1, le=100)
    status: Optional[ReportStatus] = None
    tool_name: Optional[str] = None
    sort_by: str = Field("created_at", pattern="^(created_at|updated_at|filename|total_findings)$")
    sort_order: str = Field("desc", pattern="^(asc|desc)$")


class PaginatedReportsResponse(PaginatedResponse[ReportSummary]):
    """Paginated response for reports."""
    pass


class ReportStatistics(BaseModel):
    """Statistics for reports."""
    total_reports: int
    reports_by_status: dict[ReportStatus, int]
    reports_by_tool: dict[str, int]
    total_findings: int
    findings_by_severity: dict[str, int]
    average_findings_per_report: float
    average_processing_time: Optional[float]
    
    model_config = ConfigDict(from_attributes=True)