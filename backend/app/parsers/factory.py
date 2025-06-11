"""
Parser factory for intelligent parser selection.

Provides smart parser selection based on file analysis, format detection,
and performance metrics collection.
"""

import json
import asyncio
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from collections import defaultdict
import time
import logging
import xml.etree.ElementTree as ET

from app.parsers.base import AbstractParser, ParseError
from app.parsers.registry import get_registry

logger = logging.getLogger(__name__)


@dataclass
class FormatInfo:
    """Information about detected file format."""
    format_type: str
    confidence: float
    encoding: str = "utf-8"
    metadata: Dict[str, Any] = None
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.warnings is None:
            self.warnings = []


class FormatDetector:
    """
    Detects file formats based on content analysis.
    
    Uses multiple strategies including magic bytes, structure
    analysis, and content patterns.
    """
    
    # Magic bytes for common formats
    MAGIC_BYTES = {
        b'{"': "json",
        b'[\n': "json",
        b'[{': "json",
        b'<?xml': "xml",
        b'<\\?xml': "xml",
        b'<html': "html",
        b'<HTML': "html",
        b'<!DOCTYPE html': "html",
        b'%PDF': "pdf",
        b'PK\x03\x04': "xlsx",  # Also zip, docx
        b'---\n': "yaml",
        b'---\r\n': "yaml",
        b'\xFF\xFE': "unicode_text",  # UTF-16 LE BOM
        b'\xFE\xFF': "unicode_text",  # UTF-16 BE BOM
        b'\xEF\xBB\xBF': "utf8_bom",  # UTF-8 BOM
        b'severity,': "csv",  # Common security CSV header
        b'SEVERITY,': "csv",
        b'"severity",': "csv",
    }
    
    def detect_by_magic(self, content: bytes) -> Optional[str]:
        """
        Detect format by magic bytes.
        
        Args:
            content: File content (at least first few bytes)
            
        Returns:
            Format type or None
        """
        # Check each magic signature
        for magic, format_type in self.MAGIC_BYTES.items():
            if content.startswith(magic):
                return format_type
        
        # Check for CSV without header
        if b',' in content[:1024] and content[:1024].count(b',') > 5:
            # Likely CSV if many commas in first 1KB
            return "csv"
        
        return None
    
    def detect_encoding(self, content: bytes) -> str:
        """
        Detect text encoding.
        
        Args:
            content: File content
            
        Returns:
            Encoding name
        """
        # Check BOMs
        if content.startswith(b'\xEF\xBB\xBF'):
            return "utf-8-sig"
        elif content.startswith(b'\xFF\xFE'):
            return "utf-16-le"
        elif content.startswith(b'\xFE\xFF'):
            return "utf-16-be"
        
        # Try common encodings
        for encoding in ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']:
            try:
                content.decode(encoding)
                return encoding
            except UnicodeDecodeError:
                continue
        
        return "utf-8"  # Default
    
    def analyze_json(self, content: bytes) -> FormatInfo:
        """
        Analyze JSON content.
        
        Args:
            content: File content
            
        Returns:
            FormatInfo with analysis results
        """
        try:
            # Detect encoding
            encoding = self.detect_encoding(content)
            text = content.decode(encoding)
            
            # Parse JSON
            data = json.loads(text)
            
            # Extract metadata
            metadata = {}
            if isinstance(data, dict):
                # Common fields
                for field in ['tool', 'version', 'scan_date', 'scanner']:
                    if field in data:
                        metadata[field] = data[field]
                
                # Count findings
                if 'findings' in data:
                    metadata['finding_count'] = len(data['findings'])
                elif 'vulnerabilities' in data:
                    metadata['finding_count'] = len(data['vulnerabilities'])
                elif 'issues' in data:
                    metadata['finding_count'] = len(data['issues'])
            
            return FormatInfo(
                format_type="json",
                confidence=0.95,
                encoding=encoding,
                metadata=metadata
            )
            
        except json.JSONDecodeError as e:
            return FormatInfo(
                format_type="json",
                confidence=0.3,
                warnings=[f"JSON parse error: {str(e)}"]
            )
        except Exception as e:
            return FormatInfo(
                format_type="unknown",
                confidence=0.0,
                warnings=[f"Analysis error: {str(e)}"]
            )
    
    def analyze_xml(self, content: bytes) -> FormatInfo:
        """
        Analyze XML content.
        
        Args:
            content: File content
            
        Returns:
            FormatInfo with analysis results
        """
        try:
            # Detect encoding
            encoding = self.detect_encoding(content)
            text = content.decode(encoding)
            
            # Parse XML
            root = ET.fromstring(text)
            
            # Extract metadata
            metadata = {
                'root_tag': root.tag,
                'namespaces': dict(root.attrib) if root.attrib else {}
            }
            
            # Try to detect tool
            if 'checkov' in root.tag.lower() or 'checkov' in text[:1000].lower():
                metadata['tool'] = 'checkov'
            elif 'prowler' in root.tag.lower() or 'prowler' in text[:1000].lower():
                metadata['tool'] = 'prowler'
            
            return FormatInfo(
                format_type="xml",
                confidence=0.9,
                encoding=encoding,
                metadata=metadata
            )
            
        except ET.ParseError as e:
            return FormatInfo(
                format_type="xml",
                confidence=0.3,
                warnings=[f"XML parse error: {str(e)}"]
            )
        except Exception as e:
            return FormatInfo(
                format_type="unknown",
                confidence=0.0,
                warnings=[f"Analysis error: {str(e)}"]
            )
    
    async def detect_format(self, content: bytes, filename: str) -> FormatInfo:
        """
        Detect file format using multiple strategies.
        
        Args:
            content: File content (preview)
            filename: Original filename
            
        Returns:
            FormatInfo with detection results
        """
        # First try magic bytes
        format_type = self.detect_by_magic(content)
        
        # Then try specific analyzers
        if format_type == "json":
            return self.analyze_json(content)
        elif format_type == "xml":
            return self.analyze_xml(content)
        elif format_type in ["csv", "pdf", "xlsx"]:
            return FormatInfo(
                format_type=format_type,
                confidence=0.8,
                encoding=self.detect_encoding(content) if format_type == "csv" else "binary"
            )
        
        # Try extension-based detection
        if filename:
            ext = filename.lower().split('.')[-1]
            ext_map = {
                'json': 'json',
                'xml': 'xml',
                'csv': 'csv',
                'pdf': 'pdf',
                'xlsx': 'xlsx',
                'xls': 'xls',
                'yaml': 'yaml',
                'yml': 'yaml'
            }
            
            if ext in ext_map:
                # Verify with content
                if ext == 'json':
                    return self.analyze_json(content)
                elif ext == 'xml':
                    return self.analyze_xml(content)
                else:
                    return FormatInfo(
                        format_type=ext_map[ext],
                        confidence=0.6,  # Lower confidence for extension-only
                        warnings=["Format detected by extension only"]
                    )
        
        # Unknown format
        return FormatInfo(
            format_type="unknown",
            confidence=0.0,
            warnings=["Could not detect file format"]
        )


class ParserFactory:
    """
    Factory for creating and managing parser instances.
    
    Provides intelligent parser selection and performance tracking.
    """
    
    def __init__(self):
        self.registry = get_registry()
        self.detector = FormatDetector()
        self._metrics = defaultdict(lambda: {
            'parse_count': 0,
            'total_time': 0.0,
            'error_count': 0,
            'last_used': None
        })
    
    async def detect_format(self, file_preview: bytes, filename: str) -> FormatInfo:
        """
        Detect file format.
        
        Args:
            file_preview: File content preview
            filename: Original filename
            
        Returns:
            FormatInfo with detection results
        """
        return await self.detector.detect_format(file_preview, filename)
    
    async def get_parser(
        self,
        file_preview: bytes,
        filename: str,
        preferred_tool: Optional[str] = None
    ) -> Optional[AbstractParser]:
        """
        Get the best parser for a file.
        
        Args:
            file_preview: First 1MB of file content
            filename: Original filename
            preferred_tool: Optional preferred tool name
            
        Returns:
            Parser instance or None if no suitable parser
        """
        # If preferred tool specified, try that first
        if preferred_tool:
            parser = self.registry.get_parser_for_tool(preferred_tool)
            if parser:
                confidence = await parser.can_parse(file_preview, filename)
                if confidence >= parser.get_metadata().confidence_threshold:
                    return parser
        
        # Get all compatible parsers
        candidates = await self.registry.get_compatible_parsers(
            file_preview, filename
        )
        
        if not candidates:
            logger.warning(f"No parser found for file: {filename}")
            return None
        
        # Select best parser
        for parser, confidence in candidates:
            metadata = parser.get_metadata()
            if confidence >= metadata.confidence_threshold:
                logger.info(
                    f"Selected parser {parser.__class__.__name__} "
                    f"with confidence {confidence:.2f} for {filename}"
                )
                return parser
        
        # If no parser meets threshold, use best one with warning
        best_parser, best_confidence = candidates[0]
        logger.warning(
            f"Using parser {best_parser.__class__.__name__} "
            f"with low confidence {best_confidence:.2f} for {filename}"
        )
        return best_parser
    
    def track_metrics(self, parser: AbstractParser, elapsed_time: float, 
                     success: bool = True) -> None:
        """
        Track parser performance metrics.
        
        Args:
            parser: Parser instance
            elapsed_time: Time taken to parse
            success: Whether parsing succeeded
        """
        tool_name = parser.get_metadata().tool_name
        metrics = self._metrics[tool_name]
        
        metrics['parse_count'] += 1
        metrics['total_time'] += elapsed_time
        if not success:
            metrics['error_count'] += 1
        metrics['last_used'] = time.time()
        
        # Log if performance is degrading
        avg_time = metrics['total_time'] / metrics['parse_count']
        if avg_time > 10.0:  # More than 10 seconds average
            logger.warning(
                f"Parser {parser.__class__.__name__} averaging "
                f"{avg_time:.1f}s per file"
            )
    
    def get_metrics(self) -> Dict[str, Dict[str, Any]]:
        """
        Get performance metrics for all parsers.
        
        Returns:
            Dictionary of metrics by tool name
        """
        return dict(self._metrics)
    
    async def parse_file(
        self,
        file_path: str,
        progress_callback=None
    ) -> List[Dict[str, Any]]:
        """
        High-level method to parse a file completely.
        
        This is a convenience method that handles the full parsing
        workflow including format detection and error handling.
        
        Args:
            file_path: Path to file to parse
            progress_callback: Optional progress callback
            
        Returns:
            List of finding dictionaries
        """
        import aiofiles
        from pathlib import Path
        
        file_path = Path(file_path)
        
        # Read preview
        async with aiofiles.open(file_path, 'rb') as f:
            preview = await f.read(1024 * 1024)  # 1MB preview
        
        # Get parser
        parser = await self.get_parser(preview, file_path.name)
        if not parser:
            raise ParseError(f"No parser available for {file_path.name}")
        
        # Create file stream
        async def file_stream():
            async with aiofiles.open(file_path, 'rb') as f:
                chunk_size = 1024 * 1024  # 1MB chunks
                while True:
                    chunk = await f.read(chunk_size)
                    if not chunk:
                        break
                    yield chunk
        
        # Parse with metrics
        start_time = time.time()
        findings = []
        
        try:
            async for finding in parser.parse_with_recovery(
                file_stream(), progress_callback
            ):
                findings.append(finding.model_dump())
            
            elapsed = time.time() - start_time
            self.track_metrics(parser, elapsed, success=True)
            
        except Exception as e:
            elapsed = time.time() - start_time
            self.track_metrics(parser, elapsed, success=False)
            raise
        
        return findings