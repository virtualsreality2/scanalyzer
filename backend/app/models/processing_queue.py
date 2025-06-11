"""
Processing queue model for async report processing.
"""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, ForeignKey, Index, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..db.base import Base


class PriorityLevel(int, enum.Enum):
    """Priority levels for processing queue."""
    CRITICAL = 4  # Immediate processing
    HIGH = 3      # Process soon
    MEDIUM = 2    # Normal priority
    LOW = 1       # Process when idle
    
    @classmethod
    def from_file_size(cls, size_bytes: int) -> "PriorityLevel":
        """Determine priority based on file size."""
        if size_bytes < 1_000_000:  # < 1MB
            return cls.HIGH
        elif size_bytes < 10_000_000:  # < 10MB
            return cls.MEDIUM
        elif size_bytes < 100_000_000:  # < 100MB
            return cls.LOW
        else:
            return cls.LOW  # Very large files get lower priority


class QueueStatus(str, enum.Enum):
    """Status of queue items."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class ProcessingQueue(Base):
    """
    Model for managing async processing queue.
    
    Tracks processing attempts, errors, and priorities.
    """
    __tablename__ = "processing_queue"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # Reference to report
    report_id = Column(
        Integer,
        ForeignKey("reports.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One queue entry per report
        index=True
    )
    
    # Queue management
    priority = Column(
        Enum(PriorityLevel),
        nullable=False,
        default=PriorityLevel.MEDIUM,
        index=True
    )
    status = Column(
        Enum(QueueStatus),
        nullable=False,
        default=QueueStatus.PENDING,
        index=True
    )
    
    # Processing tracking
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_error = Column(Text, nullable=True)
    
    # Worker assignment (for distributed processing)
    worker_id = Column(String(100), nullable=True, index=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    lock_timeout = Column(Integer, default=300)  # 5 minutes default
    
    # Processing timestamps
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Queue timestamps
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
    
    # Scheduled processing (optional)
    scheduled_for = Column(
        DateTime(timezone=True),
        nullable=True,
        index=True
    )
    
    # Relationships
    report = relationship("Report", backref="queue_entry")
    
    # Indexes for efficient queue operations
    __table_args__ = (
        Index("ix_queue_priority_status", "priority", "status", "scheduled_for"),
        Index("ix_queue_status_created", "status", "created_at"),
        Index("ix_queue_worker_status", "worker_id", "status"),
        Index("ix_queue_retry_status", "retry_count", "status"),
    )
    
    def __repr__(self) -> str:
        return (f"<ProcessingQueue(id={self.id}, report_id={self.report_id}, "
                f"priority={self.priority}, status={self.status})>")
    
    def can_retry(self) -> bool:
        """Check if the item can be retried."""
        return self.retry_count < self.max_retries
    
    def increment_retry(self) -> None:
        """Increment retry count and update status."""
        self.retry_count += 1
        if self.can_retry():
            self.status = QueueStatus.RETRYING
        else:
            self.status = QueueStatus.FAILED
            self.failed_at = datetime.utcnow()
    
    def lock_for_processing(self, worker_id: str) -> bool:
        """
        Attempt to lock the item for processing by a worker.
        
        Returns True if successfully locked, False if already locked.
        """
        if self.worker_id and self.locked_at:
            # Check if lock has expired
            lock_age = (datetime.utcnow() - self.locked_at).total_seconds()
            if lock_age < self.lock_timeout:
                return False  # Still locked by another worker
        
        # Lock for this worker
        self.worker_id = worker_id
        self.locked_at = datetime.utcnow()
        self.status = QueueStatus.PROCESSING
        self.started_at = datetime.utcnow()
        return True
    
    def unlock(self) -> None:
        """Release the processing lock."""
        self.worker_id = None
        self.locked_at = None