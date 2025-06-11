"""Parser for Prowler v3.x JSON format."""

import json
import logging
from datetime import datetime
from typing import AsyncIterator, Optional, Dict, Any, List
import ijson

from app.parsers.base import AbstractParser, ParserMetadata, ParserCapabilities
from app.parsers.registry import register_parser
from app.models.finding import Finding, SeverityLevel
from app.core.exceptions import ParseError

logger = logging.getLogger(__name__)


@register_parser
class ProwlerV3Parser(AbstractParser):
    """Parser for Prowler v3.x JSON reports."""
    
    def get_metadata(self) -> ParserMetadata:
        """Return parser metadata."""
        return ParserMetadata(
            tool_name="prowler",
            supported_versions=["3.0", "3.1", "3.2", "3.3"],
            file_extensions=[".json"],
            capabilities=[
                ParserCapabilities.BATCH,
                ParserCapabilities.STREAMING,
                ParserCapabilities.VALIDATION,
                ParserCapabilities.METADATA
            ],
            description="Prowler v3.x JSON format parser with compliance mapping support"
        )
    
    async def can_parse(self, file_preview: bytes, filename: str) -> float:
        """Determine confidence that this parser can handle the file."""
        confidence = 0.0
        
        # Check filename
        if "prowler" in filename.lower():
            confidence += 0.3
        if filename.endswith(".json"):
            confidence += 0.2
            
        # Check content for Prowler v3 indicators
        try:
            preview_str = file_preview.decode('utf-8', errors='ignore')
            if '"prowler_version"' in preview_str:
                confidence += 0.3
                # Check for v3 specific version
                if any(v in preview_str for v in ['"3.0', '"3.1', '"3.2', '"3.3']):
                    confidence += 0.2
            if '"findings"' in preview_str:
                confidence += 0.1
            if any(field in preview_str for field in ['"severity"', '"check_id"', '"compliance"']):
                confidence += 0.1
        except Exception:
            pass
            
        return min(confidence, 1.0)
    
    async def parse_stream(
        self,
        file_stream: AsyncIterator[bytes],
        progress_callback: Optional[callable] = None
    ) -> AsyncIterator[Finding]:
        """Parse Prowler v3 JSON report from stream."""
        buffer = b""
        findings_count = 0
        batch = []
        batch_size = 1000
        
        try:
            # Accumulate full content for ijson parsing
            async for chunk in file_stream:
                buffer += chunk
                
            # Parse using ijson for memory efficiency
            parser = ijson.parse(buffer)
            
            current_finding = {}
            in_findings_array = False
            in_finding_object = False
            in_compliance = False
            current_compliance_framework = None
            
            for prefix, event, value in parser:
                # Track location in JSON structure
                if prefix == "findings" and event == "start_array":
                    in_findings_array = True
                elif prefix == "findings" and event == "end_array":
                    in_findings_array = False
                    
                # Handle individual findings
                if in_findings_array:
                    if prefix == "findings.item" and event == "start_map":
                        in_finding_object = True
                        current_finding = {}
                    elif prefix == "findings.item" and event == "end_map":
                        in_finding_object = False
                        
                        # Process completed finding
                        finding = await self._process_finding(current_finding)
                        if finding:
                            batch.append(finding)
                            findings_count += 1
                            
                            # Yield batch if full
                            if len(batch) >= batch_size:
                                for f in batch:
                                    yield f
                                batch = []
                                
                                # Report progress
                                if progress_callback:
                                    await progress_callback(findings_count)
                    
                    # Collect finding fields
                    elif in_finding_object and event not in ("start_map", "end_map", "start_array", "end_array"):
                        field_name = prefix.split(".")[-1]
                        
                        # Handle compliance mapping specially
                        if field_name == "compliance" and event == "start_map":
                            in_compliance = True
                            current_finding["compliance"] = {}
                        elif in_compliance:
                            if event == "end_map" and prefix.endswith(".compliance"):
                                in_compliance = False
                                current_compliance_framework = None
                            elif event == "start_array":
                                current_compliance_framework = prefix.split(".")[-1]
                                current_finding["compliance"][current_compliance_framework] = []
                            elif event == "string" and current_compliance_framework:
                                current_finding["compliance"][current_compliance_framework].append(value)
                        else:
                            current_finding[field_name] = value
                            
            # Yield remaining findings
            for finding in batch:
                yield finding
                
            # Final progress update
            if progress_callback and findings_count > 0:
                await progress_callback(findings_count)
                
        except Exception as e:
            logger.error(f"Error parsing Prowler v3 report: {str(e)}")
            # If we have partial results, yield them
            for finding in batch:
                yield finding
            raise ParseError(f"Failed to parse Prowler v3 report: {str(e)}")
    
    async def _process_finding(self, finding_data: Dict[str, Any]) -> Optional[Finding]:
        """Process a single Prowler v3 finding."""
        try:
            # Skip passed checks
            if finding_data.get("status") == "PASS":
                return None
                
            # Map severity
            severity_map = {
                "critical": SeverityLevel.CRITICAL,
                "high": SeverityLevel.HIGH,
                "medium": SeverityLevel.MEDIUM,
                "low": SeverityLevel.LOW,
                "informational": SeverityLevel.LOW
            }
            
            severity_str = finding_data.get("severity", "medium").lower()
            severity = severity_map.get(severity_str, SeverityLevel.MEDIUM)
            
            # Build tool metadata
            tool_metadata = {
                "check_id": finding_data.get("check_id"),
                "service_name": finding_data.get("service_name"),
                "resource_id": finding_data.get("resource_id"),
                "resource_type": finding_data.get("resource_type"),
                "region": finding_data.get("region", "global"),
                "provider": finding_data.get("provider", "aws"),
                "status": finding_data.get("status"),
                "risk": finding_data.get("risk"),
                "remediation": finding_data.get("remediation"),
                "compliance": finding_data.get("compliance", {}),
                "resource_details": finding_data.get("resource_details", {})
            }
            
            # Clean up None values
            tool_metadata = {k: v for k, v in tool_metadata.items() if v is not None}
            
            # Store original data in tool_metadata
            tool_metadata["original_data"] = finding_data
            
            # Create finding
            finding = Finding(
                title=finding_data.get("check_title", finding_data.get("check_id", "Unknown Check")),
                description=finding_data.get("description", ""),
                severity=severity,
                tool_source="prowler",
                tool_metadata=tool_metadata,
                category="compliance"
            )
            
            # Set resource identifier
            if tool_metadata.get("resource_id"):
                finding.resource_name = tool_metadata["resource_id"]
            
            # Set resource type
            if tool_metadata.get("resource_type"):
                finding.resource_type = tool_metadata["resource_type"]
                
            return finding
            
        except Exception as e:
            logger.warning(f"Failed to process Prowler finding: {str(e)}")
            # Return None to skip this finding
            return None
    
    def get_batch_size(self) -> int:
        """Return recommended batch size for processing."""
        return 1000