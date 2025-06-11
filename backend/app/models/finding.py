"""
Finding model for storing individual security findings from reports.
"""

import enum
from datetime import datetime
from typing import Dict, Any, Optional

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Enum, ForeignKey, Index, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db.base import Base


class SeverityLevel(str, enum.Enum):
    """Severity levels for findings."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    
    @property
    def numeric_value(self) -> int:
        """Return numeric value for sorting."""
        return {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}[self.value]


class Finding(Base):
    """
    Model for individual security findings.
    
    Stores normalized finding data with tool-specific metadata in JSON.
    """
    __tablename__ = "findings"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Foreign key to report
    report_id = Column(
        Integer, 
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Core finding data
    severity = Column(
        Enum(SeverityLevel),
        nullable=False,
        index=True
    )
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    
    # Location information (flexible for different tools)
    resource_type = Column(String(100), nullable=True, index=True)
    resource_name = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)
    line_number = Column(Integer, nullable=True)
    
    # Tool information
    tool_source = Column(String(100), nullable=False, index=True)
    tool_finding_id = Column(String(100), nullable=True)  # Tool's internal ID
    
    # Flexible metadata storage for tool-specific data
    tool_metadata = Column(JSON, nullable=True, default=dict)
    
    # Remediation information
    remediation = Column(Text, nullable=True)
    references = Column(JSON, nullable=True, default=list)  # List of URLs
    
    # Categorization
    category = Column(String(100), nullable=True, index=True)
    tags = Column(JSON, nullable=True, default=list)  # List of tags
    
    # Status tracking
    is_false_positive = Column(Integer, default=0)  # Boolean as integer
    is_suppressed = Column(Integer, default=0)  # Boolean as integer
    
    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )
    
    # Relationships
    report = relationship("Report", back_populates="findings")
    
    # Indexes for performance
    __table_args__ = (
        Index("ix_findings_severity_report", "severity", "report_id"),
        Index("ix_findings_created_at", "created_at"),
        Index("ix_findings_tool_severity", "tool_source", "severity"),
        Index("ix_findings_category_severity", "category", "severity"),
    )
    
    def __repr__(self) -> str:
        return (f"<Finding(id={self.id}, severity={self.severity}, "
                f"title='{self.title[:50]}...')>")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert finding to dictionary representation."""
        return {
            "id": self.id,
            "report_id": self.report_id,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "resource_type": self.resource_type,
            "resource_name": self.resource_name,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "tool_source": self.tool_source,
            "tool_finding_id": self.tool_finding_id,
            "tool_metadata": self.tool_metadata,
            "remediation": self.remediation,
            "references": self.references,
            "category": self.category,
            "tags": self.tags,
            "is_false_positive": bool(self.is_false_positive),
            "is_suppressed": bool(self.is_suppressed),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }