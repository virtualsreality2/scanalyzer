"""
Base classes and interfaces for the parser plugin system.

Provides the abstract parser interface that all parsers must implement,
along with metadata classes for parser capabilities and requirements.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import AsyncIterator, List, Optional, Dict, Any, Callable
from datetime import datetime

from app.models.finding import Finding, SeverityLevel


class ParserCapabilities(Enum):
    """Capabilities that a parser may support."""
    STREAMING = auto()      # Can process files in chunks
    BATCH = auto()         # Can process multiple findings at once
    INCREMENTAL = auto()   # Can resume from partial parse
    VALIDATION = auto()    # Can validate report format
    METADATA = auto()      # Extracts rich metadata
    FILTERING = auto()     # Supports pre-filtering findings


@dataclass
class ParserMetadata:
    """
    Metadata about a parser's capabilities and requirements.
    
    This information is used by the registry and factory to select
    appropriate parsers for incoming files.
    """
    tool_name: str
    supported_versions: List[str]
    file_extensions: List[str]
    capabilities: List[ParserCapabilities] = field(default_factory=list)
    max_file_size: Optional[int] = None  # Max size in bytes, None = unlimited
    description: Optional[str] = None
    author: Optional[str] = None
    confidence_threshold: float = 0.7  # Min confidence to use this parser
    
    def supports_streaming(self) -> bool:
        """Check if parser supports streaming."""
        return ParserCapabilities.STREAMING in self.capabilities
    
    def supports_batch(self) -> bool:
        """Check if parser supports batch processing."""
        return ParserCapabilities.BATCH in self.capabilities
    
    def supports_version(self, version: str) -> bool:
        """Check if parser supports a specific tool version."""
        if not self.supported_versions:
            return True  # No version restrictions
        return version in self.supported_versions
    
    def supports_extension(self, extension: str) -> bool:
        """Check if parser supports a file extension."""
        if not extension.startswith('.'):
            extension = f'.{extension}'
        return extension.lower() in [ext.lower() for ext in self.file_extensions]


@dataclass
class ParseProgress:
    """Progress information for long-running parse operations."""
    bytes_processed: int = 0
    total_bytes: Optional[int] = None
    findings_count: int = 0
    current_section: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    
    @property
    def percentage(self) -> Optional[float]:
        """Calculate completion percentage if total is known."""
        if self.total_bytes and self.total_bytes > 0:
            return min(100.0, (self.bytes_processed / self.total_bytes) * 100)
        return None


class AbstractParser(ABC):
    """
    Abstract base class for all parser implementations.
    
    Parsers must implement this interface to be compatible with
    the plugin system. The system will automatically discover
    and register parsers that inherit from this class.
    """
    
    @abstractmethod
    async def can_parse(self, file_preview: bytes, filename: str) -> float:
        """
        Determine if this parser can handle the given file.
        
        Args:
            file_preview: First 1MB of file content for analysis
            filename: Original filename for extension hints
            
        Returns:
            Confidence score between 0.0 and 1.0
            - 0.0 = Cannot parse this file
            - 1.0 = Definitely can parse this file
            - 0.5-0.9 = Various levels of confidence
        """
        pass
    
    @abstractmethod
    async def parse_stream(
        self,
        file_stream: AsyncIterator[bytes],
        progress_callback: Optional[Callable[[ParseProgress], None]] = None
    ) -> AsyncIterator[Finding]:
        """
        Parse a file stream and yield findings.
        
        This method should process the file in chunks to avoid
        loading large files into memory. It should yield findings
        as they are discovered rather than collecting them all.
        
        Args:
            file_stream: Async iterator yielding file chunks
            progress_callback: Optional callback for progress updates
            
        Yields:
            Finding objects as they are parsed
            
        Raises:
            ParseError: If the file format is invalid
            MemoryError: If memory limits are exceeded
        """
        pass
    
    @abstractmethod
    def get_metadata(self) -> ParserMetadata:
        """
        Get metadata about this parser's capabilities.
        
        Returns:
            ParserMetadata object describing the parser
        """
        pass
    
    async def validate_format(self, file_preview: bytes) -> List[str]:
        """
        Validate file format and return any warnings.
        
        This is optional but recommended for better error messages.
        
        Args:
            file_preview: First 1MB of file content
            
        Returns:
            List of validation warnings (empty = valid)
        """
        return []
    
    async def extract_metadata(self, file_preview: bytes) -> Dict[str, Any]:
        """
        Extract metadata from the file without full parsing.
        
        This is optional but useful for quick file analysis.
        
        Args:
            file_preview: First 1MB of file content
            
        Returns:
            Dictionary of metadata (tool version, scan date, etc.)
        """
        return {}
    
    def get_memory_limit(self) -> int:
        """
        Get maximum memory this parser should use.
        
        Returns:
            Memory limit in bytes (default: 10MB)
        """
        return 10 * 1024 * 1024  # 10MB default
    
    async def parse_with_recovery(
        self,
        file_stream: AsyncIterator[bytes],
        progress_callback: Optional[Callable[[ParseProgress], None]] = None
    ) -> AsyncIterator[Finding]:
        """
        Parse with automatic error recovery.
        
        This wraps parse_stream to handle errors gracefully and
        return partial results when possible.
        
        Args:
            file_stream: Async iterator yielding file chunks
            progress_callback: Optional callback for progress updates
            
        Yields:
            Finding objects (may be incomplete on error)
        """
        try:
            async for finding in self.parse_stream(file_stream, progress_callback):
                yield finding
        except Exception as e:
            # Log error but don't re-raise to allow partial results
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Parser error (partial results returned): {e}")


class ParseError(Exception):
    """Base exception for parser errors."""
    pass


class FormatError(ParseError):
    """Raised when file format is invalid or unsupported."""
    pass


class VersionError(ParseError):
    """Raised when tool version is not supported."""
    pass