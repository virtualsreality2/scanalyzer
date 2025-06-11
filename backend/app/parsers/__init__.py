"""
Parser system for Scanalyzer.

This package provides a flexible plugin architecture for parsing
security scan reports from various tools.
"""

from .base import AbstractParser, ParserMetadata, ParserCapabilities
from .registry import ParserRegistry, register_parser
from .factory import ParserFactory

# Import parsers to ensure they are registered
from .prowler import ProwlerV3Parser, ProwlerV2Parser
from .checkov import CheckovParser
from .bandit import BanditParser

__all__ = [
    "AbstractParser",
    "ParserMetadata",
    "ParserCapabilities",
    "ParserRegistry",
    "register_parser",
    "ParserFactory",
    "ProwlerV3Parser",
    "ProwlerV2Parser",
    "CheckovParser",
    "BanditParser"
]