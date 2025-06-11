"""Parser for Checkov JSON and SARIF formats."""

import json
import logging
from datetime import datetime
from typing import AsyncIterator, Optional, Dict, Any, List

from app.parsers.base import AbstractParser, ParserMetadata, ParserCapabilities
from app.parsers.registry import register_parser
from app.models.finding import Finding, SeverityLevel
from app.core.exceptions import ParseError

logger = logging.getLogger(__name__)


@register_parser
class CheckovParser(AbstractParser):
    """Parser for Checkov security scanning reports."""
    
    def get_metadata(self) -> ParserMetadata:
        """Return parser metadata."""
        return ParserMetadata(
            tool_name="checkov",
            supported_versions=["2.0", "2.1", "2.2", "2.3", "2.4", "2.5"],
            file_extensions=[".json", ".sarif"],
            capabilities=[
                ParserCapabilities.BATCH,
                ParserCapabilities.STREAMING,
                ParserCapabilities.VALIDATION,
                ParserCapabilities.METADATA
            ],
            description="Checkov parser for JSON and SARIF formats"
        )
    
    async def can_parse(self, file_preview: bytes, filename: str) -> float:
        """Determine confidence that this parser can handle the file."""
        confidence = 0.0
        
        # Check filename
        if "checkov" in filename.lower():
            confidence += 0.4
            
        # Check for JSON/SARIF format
        if filename.endswith((".json", ".sarif")):
            confidence += 0.2
            
        try:
            preview_str = file_preview.decode('utf-8', errors='ignore')
            
            # Check for Checkov JSON indicators
            if '"check_type"' in preview_str:
                confidence += 0.3
            if '"failed_checks"' in preview_str or '"passed_checks"' in preview_str:
                confidence += 0.2
            if any(check in preview_str for check in ['"CKV_', '"CKV2_', '"BC_']):
                confidence += 0.2
                
            # Check for SARIF format
            if '"$schema"' in preview_str and 'sarif' in preview_str:
                confidence += 0.2
                if '"tool"' in preview_str and '"Checkov"' in preview_str:
                    confidence += 0.2
                    
        except Exception:
            pass
            
        return min(confidence, 1.0)
    
    async def parse_stream(
        self,
        file_stream: AsyncIterator[bytes],
        progress_callback: Optional[callable] = None
    ) -> AsyncIterator[Finding]:
        """Parse Checkov report from stream."""
        buffer = b""
        
        # Accumulate content
        async for chunk in file_stream:
            buffer += chunk
            
        try:
            content = buffer.decode('utf-8')
            data = json.loads(content)
            
            # Detect format
            if "$schema" in data and "sarif" in data.get("$schema", ""):
                # SARIF format
                async for finding in self._parse_sarif(data, progress_callback):
                    yield finding
            else:
                # Standard Checkov JSON format
                async for finding in self._parse_json(data, progress_callback):
                    yield finding
                    
        except Exception as e:
            logger.error(f"Error parsing Checkov report: {str(e)}")
            raise ParseError(f"Failed to parse Checkov report: {str(e)}")
    
    async def _parse_json(self, data: Dict[str, Any], progress_callback: Optional[callable]) -> AsyncIterator[Finding]:
        """Parse standard Checkov JSON format."""
        check_type = data.get("check_type", "unknown")
        results = data.get("results", {})
        
        # Process failed checks
        failed_checks = results.get("failed_checks", [])
        findings_count = 0
        
        for check in failed_checks:
            finding = await self._process_check(check, check_type)
            if finding:
                yield finding
                findings_count += 1
                
                # Progress callback
                if progress_callback and findings_count % 50 == 0:
                    await progress_callback(findings_count)
        
        # Note: We typically don't process passed_checks for findings
        
        # Final progress
        if progress_callback and findings_count > 0:
            await progress_callback(findings_count)
    
    async def _parse_sarif(self, data: Dict[str, Any], progress_callback: Optional[callable]) -> AsyncIterator[Finding]:
        """Parse Checkov SARIF format."""
        runs = data.get("runs", [])
        findings_count = 0
        
        for run in runs:
            results = run.get("results", [])
            
            for result in results:
                finding = await self._process_sarif_result(result)
                if finding:
                    yield finding
                    findings_count += 1
                    
                    # Progress callback
                    if progress_callback and findings_count % 50 == 0:
                        await progress_callback(findings_count)
        
        # Final progress
        if progress_callback and findings_count > 0:
            await progress_callback(findings_count)
    
    async def _process_check(self, check_data: Dict[str, Any], check_type: str) -> Optional[Finding]:
        """Process a Checkov check result."""
        try:
            # Map Checkov severity to standard levels
            severity_map = {
                "CRITICAL": SeverityLevel.CRITICAL,
                "HIGH": SeverityLevel.HIGH,
                "MEDIUM": SeverityLevel.MEDIUM,
                "LOW": SeverityLevel.LOW,
                "INFO": SeverityLevel.LOW
            }
            
            severity_str = check_data.get("severity", "MEDIUM").upper()
            severity = severity_map.get(severity_str, SeverityLevel.MEDIUM)
            
            # Extract code block if present
            code_snippet = None
            code_block = check_data.get("code_block")
            if code_block and isinstance(code_block, list):
                # Format code block
                code_lines = []
                for line_info in code_block:
                    if isinstance(line_info, list) and len(line_info) >= 2:
                        line_num, line_text = line_info[0], line_info[1]
                        code_lines.append(f"{line_num}: {line_text}")
                code_snippet = "\n".join(code_lines)
            
            # Build tool metadata
            tool_metadata = {
                "check_id": check_data.get("check_id"),
                "bc_check_id": check_data.get("bc_check_id"),
                "resource": check_data.get("resource"),
                "file_path": check_data.get("file_path"),
                "file_line_range": check_data.get("file_line_range"),
                "guideline": check_data.get("guideline"),
                "check_type": check_type,
                "resource_type": check_data.get("resource_type", check_type)
            }
            
            if code_snippet:
                tool_metadata["code_snippet"] = code_snippet
                
            # Clean up None values
            tool_metadata = {k: v for k, v in tool_metadata.items() if v is not None}
            
            # Create finding
            finding = Finding(
                title=check_data.get("check_name", check_data.get("check_id", "Unknown Check")),
                description=check_data.get("description", ""),
                severity=severity,
                tool_source="checkov",
                tool_metadata=tool_metadata,
                category="infrastructure"
            )
            
            # Set resource and location
            if tool_metadata.get("resource"):
                finding.resource_id = tool_metadata["resource"]
            if tool_metadata.get("file_path"):
                finding.location = tool_metadata["file_path"]
                if tool_metadata.get("file_line_range"):
                    line_range = tool_metadata["file_line_range"]
                    if isinstance(line_range, list) and len(line_range) >= 1:
                        finding.line_number = line_range[0]
                        
            return finding
            
        except Exception as e:
            logger.warning(f"Failed to process Checkov check: {str(e)}")
            return None
    
    async def _process_sarif_result(self, result: Dict[str, Any]) -> Optional[Finding]:
        """Process a SARIF result."""
        try:
            # Map SARIF levels to severity
            level_map = {
                "error": SeverityLevel.HIGH,
                "warning": SeverityLevel.MEDIUM,
                "note": SeverityLevel.LOW,
                "none": SeverityLevel.LOW
            }
            
            level = result.get("level", "warning")
            severity = level_map.get(level, SeverityLevel.MEDIUM)
            
            # Override with properties severity if available
            properties = result.get("properties", {})
            if "severity" in properties:
                severity_str = properties["severity"].upper()
                severity_override = {
                    "CRITICAL": SeverityLevel.CRITICAL,
                    "HIGH": SeverityLevel.HIGH,
                    "MEDIUM": SeverityLevel.MEDIUM,
                    "LOW": SeverityLevel.LOW,
                    "INFO": SeverityLevel.LOW
                }.get(severity_str)
                if severity_override:
                    severity = severity_override
            
            # Extract location information
            locations = result.get("locations", [])
            file_path = None
            line_number = None
            
            if locations:
                location = locations[0]
                physical_location = location.get("physicalLocation", {})
                artifact_location = physical_location.get("artifactLocation", {})
                file_path = artifact_location.get("uri")
                
                region = physical_location.get("region", {})
                line_number = region.get("startLine")
            
            # Build tool metadata
            tool_metadata = {
                "rule_id": result.get("ruleId"),
                "format": "sarif",
                "resource": properties.get("resource"),
                "file_path": file_path
            }
            
            if line_number:
                tool_metadata["line_number"] = line_number
                
            # Include additional properties
            for key, value in properties.items():
                if key not in ["severity", "resource"]:
                    tool_metadata[key] = value
            
            # Get message text
            message = result.get("message", {})
            description = message.get("text", "")
            
            # Create finding
            finding = Finding(
                title=result.get("ruleId", "Unknown Rule"),
                description=description,
                severity=severity,
                tool_source="checkov",
                tool_metadata=tool_metadata,
                category="infrastructure"
            )
            
            # Set resource and location
            if properties.get("resource"):
                finding.resource_id = properties["resource"]
            if file_path:
                finding.location = file_path
            if line_number:
                finding.line_number = line_number
                
            return finding
            
        except Exception as e:
            logger.warning(f"Failed to process SARIF result: {str(e)}")
            return None