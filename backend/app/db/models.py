"""
Database models placeholder.
Will contain SQLAlchemy models for reports, findings, etc.
"""

from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.sql import func

from .base import Base


class Report(Base):
    """Report model placeholder."""
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())