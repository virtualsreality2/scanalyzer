"""
Finding schemas for request/response validation.
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, ConfigDict

from ..models.finding import SeverityLevel
from .common import PaginatedResponse


class FindingBase(BaseModel):
    """Base finding schema."""
    severity: SeverityLevel
    title: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1)
    resource_type: Optional[str] = Field(None, max_length=100)
    resource_name: Optional[str] = Field(None, max_length=255)
    file_path: Optional[str] = Field(None, max_length=500)
    line_number: Optional[int] = Field(None, ge=0)
    tool_source: str = Field(..., min_length=1, max_length=100)
    tool_finding_id: Optional[str] = Field(None, max_length=100)
    tool_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    remediation: Optional[str] = None
    references: Optional[List[str]] = Field(default_factory=list)
    category: Optional[str] = Field(None, max_length=100)
    tags: Optional[List[str]] = Field(default_factory=list)
    
    @field_validator("references")
    @classmethod
    def validate_references(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate that references are valid URLs."""
        if not v:
            return v
        
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE
        )
        
        validated = []
        for ref in v:
            if url_pattern.match(ref):
                validated.append(ref)
            else:
                # Allow non-URL references but prefix them
                if not ref.startswith("REF:"):
                    ref = f"REF: {ref}"
                validated.append(ref)
        
        return validated
    
    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate and normalize tags."""
        if not v:
            return v
        
        # Normalize tags: lowercase, no spaces
        normalized = []
        for tag in v:
            normalized_tag = tag.lower().strip().replace(" ", "-")
            if normalized_tag and len(normalized_tag) <= 50:
                normalized.append(normalized_tag)
        
        return list(set(normalized))  # Remove duplicates


class FindingCreate(FindingBase):
    """Schema for creating a new finding."""
    report_id: int = Field(..., gt=0)


class FindingUpdate(BaseModel):
    """Schema for updating a finding."""
    severity: Optional[SeverityLevel] = None
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, min_length=1)
    remediation: Optional[str] = None
    is_false_positive: Optional[bool] = None
    is_suppressed: Optional[bool] = None
    tags: Optional[List[str]] = None
    
    model_config = ConfigDict(from_attributes=True)


class FindingInDB(FindingBase):
    """Schema for finding in database."""
    id: int
    report_id: int
    is_false_positive: bool
    is_suppressed: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class FindingResponse(FindingInDB):
    """Schema for finding response."""
    pass


class FindingListParams(BaseModel):
    """Parameters for listing findings."""
    page: int = Field(1, ge=1)
    size: int = Field(50, ge=1, le=1000)
    report_id: Optional[int] = Field(None, gt=0)
    severity: Optional[SeverityLevel] = None
    tool_source: Optional[str] = None
    category: Optional[str] = None
    resource_type: Optional[str] = None
    is_false_positive: Optional[bool] = None
    is_suppressed: Optional[bool] = None
    search: Optional[str] = Field(None, max_length=200)
    sort_by: str = Field("created_at", pattern="^(created_at|severity|title)$")
    sort_order: str = Field("desc", pattern="^(asc|desc)$")


class PaginatedFindingsResponse(PaginatedResponse[FindingResponse]):
    """Paginated response for findings."""
    pass


class FindingStatistics(BaseModel):
    """Statistics for findings."""
    total_findings: int
    findings_by_severity: Dict[str, int]
    findings_by_tool: Dict[str, int]
    findings_by_category: Dict[str, int]
    false_positive_count: int
    suppressed_count: int
    top_resources: List[Dict[str, Any]]
    
    model_config = ConfigDict(from_attributes=True)


class BulkFindingCreate(BaseModel):
    """Schema for bulk creating findings."""
    report_id: int = Field(..., gt=0)
    findings: List[FindingBase] = Field(..., min_length=1, max_length=100000)
    
    @field_validator("findings")
    @classmethod
    def validate_findings_count(cls, v: List[FindingBase]) -> List[FindingBase]:
        """Validate the number of findings."""
        if len(v) > 100000:
            raise ValueError("Cannot create more than 100,000 findings at once")
        return v


class BulkFindingResponse(BaseModel):
    """Response for bulk finding creation."""
    created: int
    failed: int
    errors: Optional[List[Dict[str, Any]]] = None


# Import regex at the top of the file
import re