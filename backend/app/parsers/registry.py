"""
Parser registration and discovery system.

Provides automatic registration of parser plugins and manages
parser selection based on file characteristics and requirements.
"""

import asyncio
from typing import List, Tuple, Optional, Type, Dict, Any
from collections import defaultdict
import logging

from app.parsers.base import AbstractParser, ParserMetadata

logger = logging.getLogger(__name__)


class ParserRegistry:
    """
    Central registry for all available parsers.
    
    This class manages parser registration, discovery, and selection.
    It maintains a singleton instance to ensure all parsers are
    registered in one place.
    """
    
    _instance = None
    _parsers: List[AbstractParser] = []
    _tool_index: Dict[str, List[AbstractParser]] = defaultdict(list)
    
    def __new__(cls):
        """Ensure singleton instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._parsers = []
            cls._instance._tool_index = defaultdict(list)
        return cls._instance
    
    def register(self, parser_class: Type[AbstractParser]) -> None:
        """
        Register a parser class.
        
        Args:
            parser_class: Parser class to register
            
        Raises:
            ValueError: If parser is invalid or already registered
        """
        # Validate parser class
        if not issubclass(parser_class, AbstractParser):
            raise ValueError(
                f"{parser_class.__name__} must inherit from AbstractParser"
            )
        
        # Instantiate parser
        try:
            parser = parser_class()
        except Exception as e:
            raise ValueError(
                f"Failed to instantiate {parser_class.__name__}: {e}"
            )
        
        # Get metadata
        metadata = parser.get_metadata()
        
        # Check for duplicates
        for existing in self._parsers:
            existing_meta = existing.get_metadata()
            if (existing_meta.tool_name == metadata.tool_name and
                existing.__class__.__name__ == parser.__class__.__name__):
                raise ValueError(
                    f"Parser for {metadata.tool_name} already registered: "
                    f"{existing.__class__.__name__}"
                )
        
        # Register parser
        self._parsers.append(parser)
        self._tool_index[metadata.tool_name].append(parser)
        
        logger.info(
            f"Registered parser: {parser.__class__.__name__} "
            f"for tool: {metadata.tool_name}"
        )
    
    def unregister(self, parser_class: Type[AbstractParser]) -> None:
        """
        Unregister a parser class.
        
        Args:
            parser_class: Parser class to unregister
        """
        self._parsers = [
            p for p in self._parsers 
            if not isinstance(p, parser_class)
        ]
        
        # Rebuild tool index
        self._tool_index.clear()
        for parser in self._parsers:
            metadata = parser.get_metadata()
            self._tool_index[metadata.tool_name].append(parser)
    
    async def get_compatible_parsers(
        self,
        file_preview: bytes,
        filename: str
    ) -> List[Tuple[AbstractParser, float]]:
        """
        Get all parsers that can handle a file, sorted by confidence.
        
        Args:
            file_preview: First 1MB of file content
            filename: Original filename
            
        Returns:
            List of (parser, confidence) tuples, sorted by confidence
        """
        candidates = []
        
        # Test each parser
        for parser in self._parsers:
            try:
                confidence = await parser.can_parse(file_preview, filename)
                if confidence > 0:
                    candidates.append((parser, confidence))
            except Exception as e:
                logger.warning(
                    f"Parser {parser.__class__.__name__} "
                    f"failed confidence check: {e}"
                )
        
        # Sort by confidence (highest first)
        candidates.sort(key=lambda x: x[1], reverse=True)
        
        return candidates
    
    def get_parser_for_tool(
        self,
        tool_name: str,
        version: Optional[str] = None
    ) -> Optional[AbstractParser]:
        """
        Get a parser for a specific tool and version.
        
        Args:
            tool_name: Name of the security tool
            version: Optional tool version
            
        Returns:
            Parser instance or None if not found
        """
        parsers = self._tool_index.get(tool_name, [])
        
        if not parsers:
            return None
        
        # If no version specified, return first parser
        if not version:
            return parsers[0]
        
        # Find version-compatible parser
        for parser in parsers:
            metadata = parser.get_metadata()
            if metadata.supports_version(version):
                return parser
        
        return None
    
    def list_parsers(self) -> List[ParserMetadata]:
        """
        List all registered parsers.
        
        Returns:
            List of parser metadata objects
        """
        return [parser.get_metadata() for parser in self._parsers]
    
    def get_supported_tools(self) -> List[str]:
        """
        Get list of all supported security tools.
        
        Returns:
            List of tool names
        """
        return list(self._tool_index.keys())
    
    def get_supported_extensions(self) -> List[str]:
        """
        Get all supported file extensions.
        
        Returns:
            List of file extensions
        """
        extensions = set()
        for parser in self._parsers:
            metadata = parser.get_metadata()
            extensions.update(metadata.file_extensions)
        return sorted(list(extensions))


# Global registry instance
_registry = ParserRegistry()


def register_parser(parser_class: Type[AbstractParser]) -> Type[AbstractParser]:
    """
    Decorator to automatically register a parser class.
    
    Usage:
        @register_parser
        class MyParser(AbstractParser):
            ...
    
    Args:
        parser_class: Parser class to register
        
    Returns:
        The parser class (unchanged)
    """
    _registry.register(parser_class)
    return parser_class


def get_registry() -> ParserRegistry:
    """
    Get the global parser registry.
    
    Returns:
        ParserRegistry singleton instance
    """
    return _registry