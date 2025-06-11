"""Parser for Bandit Python security scanner."""

import json
import re
import logging
from datetime import datetime
from typing import AsyncIterator, Optional, Dict, Any, List

from app.parsers.base import AbstractParser, ParserMetadata, ParserCapabilities
from app.parsers.registry import register_parser
from app.models.finding import Finding, SeverityLevel
from app.core.exceptions import ParseError

logger = logging.getLogger(__name__)


@register_parser
class BanditParser(AbstractParser):
    """Parser for Bandit security scanning reports."""
    
    # Patterns for sanitizing sensitive data
    SENSITIVE_PATTERNS = [
        # Passwords
        (r'(password|passwd|pwd)\s*=\s*["\']([^"\']+)["\']', r'\1 = "[REDACTED]"'),
        (r'(password|passwd|pwd)\s*:\s*["\']([^"\']+)["\']', r'\1: "[REDACTED]"'),
        # API Keys
        (r'(api_key|apikey|api_secret)\s*=\s*["\']([^"\']+)["\']', r'\1 = "[REDACTED]"'),
        (r'(sk-[a-zA-Z0-9]{48})', r'[REDACTED_API_KEY]'),
        # AWS Keys
        (r'(AKIA[0-9A-Z]{16})', r'[REDACTED_AWS_KEY]'),
        (r'(aws_secret_access_key|aws_access_key_id)\s*=\s*["\']([^"\']+)["\']', r'\1 = "[REDACTED]"'),
        # Generic secrets
        (r'(secret|token)\s*=\s*["\']([^"\']{8,})["\']', r'\1 = "[REDACTED]"'),
        # SSH keys
        (r'-----BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----', 
         r'[REDACTED_PRIVATE_KEY]'),
    ]
    
    def get_metadata(self) -> ParserMetadata:
        """Return parser metadata."""
        return ParserMetadata(
            tool_name="bandit",
            supported_versions=["1.0", "1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7"],
            file_extensions=[".json"],
            capabilities=[
                ParserCapabilities.BATCH,
                ParserCapabilities.STREAMING,
                ParserCapabilities.VALIDATION,
                ParserCapabilities.METADATA
            ],
            description="Bandit Python security scanner parser with code sanitization"
        )
    
    async def can_parse(self, file_preview: bytes, filename: str) -> float:
        """Determine confidence that this parser can handle the file."""
        confidence = 0.0
        
        # Check filename
        if "bandit" in filename.lower():
            confidence += 0.4
            
        if filename.endswith(".json"):
            confidence += 0.1
            
        try:
            preview_str = file_preview.decode('utf-8', errors='ignore')
            
            # Check for Bandit specific fields
            if '"generated_at"' in preview_str:
                confidence += 0.2
            if '"metrics"' in preview_str and '"results"' in preview_str:
                confidence += 0.3
            if any(test in preview_str for test in ['"B301"', '"B105"', '"B307"', '"test_id"']):
                confidence += 0.2
            if '"issue_confidence"' in preview_str and '"issue_severity"' in preview_str:
                confidence += 0.2
                
        except Exception:
            pass
            
        return min(confidence, 1.0)
    
    async def parse_stream(
        self,
        file_stream: AsyncIterator[bytes],
        progress_callback: Optional[callable] = None
    ) -> AsyncIterator[Finding]:
        """Parse Bandit report from stream."""
        buffer = b""
        
        # Accumulate content
        async for chunk in file_stream:
            buffer += chunk
            
        try:
            content = buffer.decode('utf-8')
            data = json.loads(content)
            
            # Extract results
            results = data.get("results", [])
            findings_count = 0
            
            for result in results:
                finding = await self._process_result(result)
                if finding:
                    yield finding
                    findings_count += 1
                    
                    # Progress callback
                    if progress_callback and findings_count % 50 == 0:
                        await progress_callback(findings_count)
            
            # Final progress
            if progress_callback and findings_count > 0:
                await progress_callback(findings_count)
                
        except Exception as e:
            logger.error(f"Error parsing Bandit report: {str(e)}")
            raise ParseError(f"Failed to parse Bandit report: {str(e)}")
    
    async def _process_result(self, result: Dict[str, Any]) -> Optional[Finding]:
        """Process a Bandit result."""
        try:
            # Map Bandit severity to standard levels
            severity_map = {
                "HIGH": SeverityLevel.HIGH,
                "MEDIUM": SeverityLevel.MEDIUM,
                "LOW": SeverityLevel.LOW
            }
            
            severity_str = result.get("issue_severity", "MEDIUM").upper()
            severity = severity_map.get(severity_str, SeverityLevel.MEDIUM)
            
            # Sanitize code snippet
            code_snippet = result.get("code", "")
            if code_snippet:
                code_snippet = self._sanitize_code(code_snippet)
            
            # Extract CWE information
            cwe_info = result.get("issue_cwe", {})
            cwe_id = None
            cwe_link = None
            if isinstance(cwe_info, dict):
                cwe_id = cwe_info.get("id")
                cwe_link = cwe_info.get("link")
            
            # Build tool metadata
            tool_metadata = {
                "test_id": result.get("test_id"),
                "test_name": result.get("test_name"),
                "filename": result.get("filename"),
                "line_number": result.get("line_number"),
                "line_range": result.get("line_range"),
                "confidence": result.get("issue_confidence", "MEDIUM"),
                "code_snippet": code_snippet
            }
            
            if cwe_id:
                tool_metadata["cwe_id"] = cwe_id
            if cwe_link:
                tool_metadata["cwe_link"] = cwe_link
                
            # Clean up None values
            tool_metadata = {k: v for k, v in tool_metadata.items() if v is not None}
            
            # Get line number
            line_number = None
            if isinstance(result.get("line_number"), (int, str)):
                try:
                    line_number = int(result["line_number"])
                except (ValueError, TypeError):
                    pass
            
            # Create finding
            finding = Finding(
                title=result.get("test_name", result.get("test_id", "Unknown Test")),
                description=result.get("issue_text", ""),
                severity=severity,
                tool_source="bandit",
                tool_metadata=tool_metadata,
                category="security"
            )
            
            # Set location and line number
            if tool_metadata.get("filename"):
                finding.location = tool_metadata["filename"]
            if line_number:
                finding.line_number = line_number
                
            return finding
            
        except Exception as e:
            logger.warning(f"Failed to process Bandit result: {str(e)}")
            return None
    
    def _sanitize_code(self, code: str) -> str:
        """Sanitize sensitive data in code snippets."""
        sanitized = code
        
        for pattern, replacement in self.SENSITIVE_PATTERNS:
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)
            
        return sanitized
    
    def _sanitize_original_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize sensitive data in original data."""
        # Create a copy to avoid modifying the original
        sanitized = data.copy()
        
        # Sanitize code field
        if "code" in sanitized and isinstance(sanitized["code"], str):
            sanitized["code"] = self._sanitize_code(sanitized["code"])
            
        return sanitized