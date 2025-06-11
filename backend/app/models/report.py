"""
Report model for storing uploaded security scan reports.
"""

import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, Float, Text, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db.base import Base


class ReportStatus(str, enum.Enum):
    """Status of report processing."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Report(Base):
    """
    Model for security scan reports.
    
    Stores metadata about uploaded files and their processing status.
    """
    __tablename__ = "reports"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # File metadata
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)  # Size in bytes
    file_hash = Column(String(64), nullable=False, index=True)  # SHA-256 hash
    
    # Tool information
    tool_name = Column(String(100), nullable=False, index=True)
    tool_version = Column(String(50), nullable=True)
    
    # Processing status
    status = Column(
        Enum(ReportStatus), 
        nullable=False, 
        default=ReportStatus.PENDING,
        index=True
    )
    
    # Processing metadata
    processed_at = Column(DateTime(timezone=True), nullable=True)
    processing_time = Column(Float, nullable=True)  # Time in seconds
    error_message = Column(Text, nullable=True)
    
    # Statistics
    total_findings = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    
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
    findings = relationship(
        "Finding", 
        back_populates="report",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )
    
    # Indexes for common queries
    __table_args__ = (
        Index("ix_reports_created_at", "created_at"),
        Index("ix_reports_status_created", "status", "created_at"),
        Index("ix_reports_tool_status", "tool_name", "status"),
    )
    
    def __repr__(self) -> str:
        return f"<Report(id={self.id}, filename='{self.filename}', status={self.status})>"
    
    def update_finding_counts(self, findings: List["Finding"]) -> None:
        """Update finding count statistics based on findings list."""
        self.total_findings = len(findings)
        self.critical_count = sum(1 for f in findings if f.severity.value == "CRITICAL")
        self.high_count = sum(1 for f in findings if f.severity.value == "HIGH")
        self.medium_count = sum(1 for f in findings if f.severity.value == "MEDIUM")
        self.low_count = sum(1 for f in findings if f.severity.value == "LOW")