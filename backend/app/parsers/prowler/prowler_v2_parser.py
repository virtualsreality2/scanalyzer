"""Parser for Prowler v2.x legacy format."""

import json
import csv
import io
import logging
from datetime import datetime
from typing import AsyncIterator, Optional, Dict, Any, List

from app.parsers.base import AbstractParser, ParserMetadata, ParserCapabilities
from app.parsers.registry import register_parser
from app.models.finding import Finding, SeverityLevel
from app.core.exceptions import ParseError

logger = logging.getLogger(__name__)


@register_parser
class ProwlerV2Parser(AbstractParser):
    """Parser for Prowler v2.x JSON and CSV reports."""
    
    def get_metadata(self) -> ParserMetadata:
        """Return parser metadata."""
        return ParserMetadata(
            tool_name="prowler",
            supported_versions=["2.0", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9"],
            file_extensions=[".json", ".csv"],
            capabilities=[
                ParserCapabilities.BATCH,
                ParserCapabilities.STREAMING,
                ParserCapabilities.VALIDATION,
                ParserCapabilities.METADATA
            ],
            description="Prowler v2.x legacy format parser (JSON and CSV)"
        )
    
    async def can_parse(self, file_preview: bytes, filename: str) -> float:
        """Determine confidence that this parser can handle the file."""
        confidence = 0.0
        
        # Check filename
        if "prowler" in filename.lower():
            confidence += 0.3
            
        # Check for JSON format
        if filename.endswith(".json"):
            confidence += 0.1
            try:
                preview_str = file_preview.decode('utf-8', errors='ignore')
                if '"prowler_version"' in preview_str and '"2.' in preview_str:
                    confidence += 0.4
                # V2 specific fields
                if any(field in preview_str for field in ['"level"', '"scored"', '"result_extended"']):
                    confidence += 0.2
            except Exception:
                pass
                
        # Check for CSV format
        elif filename.endswith(".csv"):
            confidence += 0.1
            try:
                preview_str = file_preview.decode('utf-8', errors='ignore')
                # Check for Prowler CSV headers
                if all(header in preview_str for header in ["CHECK_ID", "LEVEL", "SERVICE"]):
                    confidence += 0.5
            except Exception:
                pass
                
        return min(confidence, 1.0)
    
    async def parse_stream(
        self,
        file_stream: AsyncIterator[bytes],
        progress_callback: Optional[callable] = None
    ) -> AsyncIterator[Finding]:
        """Parse Prowler v2 report from stream."""
        buffer = b""
        
        # Accumulate content
        async for chunk in file_stream:
            buffer += chunk
            
        # Determine format
        try:
            content_str = buffer.decode('utf-8')
            
            # Try JSON first
            if content_str.strip().startswith('{'):
                async for finding in self._parse_json(content_str, progress_callback):
                    yield finding
            else:
                # Assume CSV
                async for finding in self._parse_csv(content_str, progress_callback):
                    yield finding
                    
        except Exception as e:
            logger.error(f"Error parsing Prowler v2 report: {str(e)}")
            raise ParseError(f"Failed to parse Prowler v2 report: {str(e)}")
    
    async def _parse_json(self, content: str, progress_callback: Optional[callable]) -> AsyncIterator[Finding]:
        """Parse Prowler v2 JSON format."""
        try:
            data = json.loads(content)
            findings = data.get("findings", [])
            
            for idx, finding_data in enumerate(findings):
                # Skip passed checks
                if finding_data.get("status") == "PASS":
                    continue
                    
                finding = await self._process_v2_finding(finding_data)
                if finding:
                    yield finding
                    
                # Progress callback every 100 findings
                if progress_callback and (idx + 1) % 100 == 0:
                    await progress_callback(idx + 1)
                    
            # Final progress
            if progress_callback and findings:
                await progress_callback(len(findings))
                
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in Prowler v2 report: {str(e)}")
            raise ParseError("Invalid JSON format")
    
    async def _parse_csv(self, content: str, progress_callback: Optional[callable]) -> AsyncIterator[Finding]:
        """Parse Prowler v2 CSV format."""
        csv_file = io.StringIO(content)
        reader = csv.DictReader(csv_file)
        
        findings_count = 0
        for row in reader:
            # Skip passed checks
            if row.get("STATUS") == "PASS":
                continue
                
            finding = await self._process_v2_csv_row(row)
            if finding:
                yield finding
                findings_count += 1
                
                # Progress callback every 100 findings
                if progress_callback and findings_count % 100 == 0:
                    await progress_callback(findings_count)
        
        # Final progress
        if progress_callback and findings_count > 0:
            await progress_callback(findings_count)
    
    async def _process_v2_finding(self, finding_data: Dict[str, Any]) -> Optional[Finding]:
        """Process a Prowler v2 JSON finding."""
        try:
            # Map v2 severity levels to v3
            severity_map = {
                "Critical": SeverityLevel.CRITICAL,
                "High": SeverityLevel.HIGH,
                "Medium": SeverityLevel.MEDIUM,
                "Low": SeverityLevel.LOW,
                "Informational": SeverityLevel.LOW,
                "Info": SeverityLevel.LOW
            }
            
            severity_str = finding_data.get("level", "Medium")
            severity = severity_map.get(severity_str, SeverityLevel.MEDIUM)
            
            # Build tool metadata with v2 fields
            tool_metadata = {
                "check_id": finding_data.get("check_id"),
                "service": finding_data.get("service"),
                "region": finding_data.get("region", "global"),
                "account": finding_data.get("account_id"),
                "scored": finding_data.get("scored", True),
                "status": finding_data.get("status"),
                "result_extended": finding_data.get("result_extended"),
                "v2_format": True
            }
            
            # Clean up None values
            tool_metadata = {k: v for k, v in tool_metadata.items() if v is not None}
            
            # Create finding
            finding = Finding(
                title=finding_data.get("check_title", finding_data.get("check_id", "Unknown Check")),
                description=finding_data.get("result_extended", ""),
                severity=severity,
                tool_source="prowler",
                tool_metadata=tool_metadata,
                category="compliance"
            )
            
            # Set location
            if tool_metadata.get("region"):
                finding.location = tool_metadata["region"]
                
            return finding
            
        except Exception as e:
            logger.warning(f"Failed to process Prowler v2 finding: {str(e)}")
            return None
    
    async def _process_v2_csv_row(self, row: Dict[str, str]) -> Optional[Finding]:
        """Process a Prowler v2 CSV row."""
        try:
            # Map CSV column names
            severity_map = {
                "Critical": SeverityLevel.CRITICAL,
                "High": SeverityLevel.HIGH,
                "Medium": SeverityLevel.MEDIUM,
                "Low": SeverityLevel.LOW,
                "Informational": SeverityLevel.LOW,
                "Info": SeverityLevel.LOW
            }
            
            severity_str = row.get("LEVEL", "Medium")
            severity = severity_map.get(severity_str, SeverityLevel.MEDIUM)
            
            # Build tool metadata from CSV columns
            tool_metadata = {
                "check_id": row.get("CHECK_ID"),
                "service": row.get("SERVICE"),
                "region": row.get("REGION", "global"),
                "account": row.get("ACCOUNT_ID"),
                "status": row.get("STATUS"),
                "result_extended": row.get("RESULT_EXTENDED"),
                "v2_format": True,
                "csv_format": True
            }
            
            # Clean up empty strings
            tool_metadata = {k: v for k, v in tool_metadata.items() if v}
            
            # Create finding
            finding = Finding(
                title=row.get("CHECK_TITLE", row.get("CHECK_ID", "Unknown Check")),
                description=row.get("RESULT_EXTENDED", ""),
                severity=severity,
                tool_source="prowler",
                tool_metadata=tool_metadata,
                category="compliance"
            )
            
            # Set location
            if tool_metadata.get("region"):
                finding.location = tool_metadata["region"]
                
            return finding
            
        except Exception as e:
            logger.warning(f"Failed to process Prowler v2 CSV row: {str(e)}")
            return None