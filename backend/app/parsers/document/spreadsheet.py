"""Spreadsheet parser for CSV and XLSX security reports."""

import io
import csv
import logging
from typing import AsyncIterator, Optional, Dict, Any, List
from pathlib import Path

from app.parsers.base import AbstractParser, ParserMetadata, ParserCapabilities
from app.parsers.registry import register_parser
from app.models.finding import Finding, SeverityLevel
from app.core.exceptions import ParseError
from .patterns import PatternMatcher, SeverityMapper, ConfidenceScorer, TABLE_HEADER_MAPPINGS

logger = logging.getLogger(__name__)

# Import spreadsheet libraries with fallback
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False
    logger.warning("pandas not installed - spreadsheet parsing limited")

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False
    logger.warning("openpyxl not installed - XLSX parsing may be limited")


@register_parser
class SpreadsheetParser(AbstractParser):
    """Parser for CSV and XLSX security reports."""
    
    def __init__(self):
        self.pattern_matcher = PatternMatcher()
        self.severity_mapper = SeverityMapper()
        self.confidence_scorer = ConfidenceScorer()
    
    @classmethod
    def get_metadata(cls) -> ParserMetadata:
        return ParserMetadata(
            name="Spreadsheet Security Report Parser",
            tool="spreadsheet",
            supported_versions=["*"],
            file_extensions=[".csv", ".xlsx", ".xls"],
            confidence_threshold=0.7
        )
    
    @classmethod
    def get_capabilities(cls) -> ParserCapabilities:
        return ParserCapabilities(
            streaming=True,
            format_detection=True,
            auto_remediation=False,
            compliance_mapping=False
        )
    
    async def can_parse(self, file_path: Path, content_preview: bytes) -> float:
        """Check if file is a spreadsheet."""
        extension = file_path.suffix.lower()
        
        # Check file extension
        if extension in ['.csv', '.xlsx', '.xls']:
            # CSV files
            if extension == '.csv':
                # Try to detect CSV by checking for common delimiters
                try:
                    text_preview = content_preview[:1000].decode('utf-8', errors='ignore')
                    if any(delimiter in text_preview for delimiter in [',', ';', '\t', '|']):
                        return 0.95
                except:
                    pass
                return 0.8
            
            # Excel files
            elif extension in ['.xlsx', '.xls']:
                # XLSX files start with ZIP magic bytes
                if content_preview.startswith(b'PK\x03\x04'):
                    return 0.9
                # XLS files have specific magic bytes
                elif content_preview.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
                    return 0.9
                return 0.7
        
        return 0.0
    
    async def parse_stream(self, file_stream: io.IOBase) -> AsyncIterator[Finding]:
        """Parse spreadsheet security report."""
        # Determine file type
        file_stream.seek(0)
        first_bytes = file_stream.read(8)
        file_stream.seek(0)
        
        is_excel = first_bytes.startswith(b'PK\x03\x04') or first_bytes.startswith(b'\xd0\xcf\x11\xe0')
        
        findings = []
        
        try:
            if is_excel and HAS_PANDAS:
                # Parse Excel file
                findings = await self._parse_excel(file_stream)
            elif not is_excel:
                # Parse CSV file
                findings = await self._parse_csv(file_stream)
            else:
                raise ParseError("Excel parsing requires pandas library")
            
            # Convert findings to Finding objects
            for finding_data in findings:
                confidence = self.confidence_scorer.calculate_confidence(finding_data)
                
                # Only yield findings above confidence threshold
                if confidence >= 0.5:
                    yield await self._create_finding(finding_data, confidence)
        
        except Exception as e:
            logger.error(f"Spreadsheet parsing error: {e}")
            raise ParseError(f"Failed to parse spreadsheet: {str(e)}")
    
    async def _parse_csv(self, file_stream: io.IOBase) -> List[Dict[str, Any]]:
        """Parse CSV file."""
        findings = []
        
        # Try to detect encoding
        file_stream.seek(0)
        raw_content = file_stream.read()
        file_stream.seek(0)
        
        # Try different encodings
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                text_content = raw_content.decode(encoding)
                break
            except:
                continue
        else:
            text_content = raw_content.decode('utf-8', errors='ignore')
        
        # Detect delimiter
        delimiter = self._detect_delimiter(text_content[:1000])
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(text_content), delimiter=delimiter)
        
        # Get headers and map them
        if reader.fieldnames:
            headers = [h.lower().strip() for h in reader.fieldnames]
            field_mapping = self._map_table_headers(headers)
            
            if field_mapping:
                # Structured extraction
                for row in reader:
                    finding = {}
                    for original_header, field in field_mapping.items():
                        # Find the original case header
                        for key in row:
                            if key.lower().strip() == original_header:
                                value = row[key]
                                if value and value.strip():
                                    finding[field] = value.strip()
                                break
                    
                    if finding.get('title') or finding.get('description'):
                        # Map severity
                        if 'severity' in finding:
                            finding['severity'] = self.severity_mapper.map_severity(
                                finding['severity']
                            ).value
                        
                        findings.append(finding)
            else:
                # Try unstructured extraction
                file_stream.seek(0)
                full_text = text_content
                text_findings = self.pattern_matcher.extract_findings(full_text)
                findings.extend(text_findings)
        
        return findings
    
    async def _parse_excel(self, file_stream: io.IOBase) -> List[Dict[str, Any]]:
        """Parse Excel file using pandas."""
        if not HAS_PANDAS:
            raise ParseError("pandas not installed - cannot parse Excel files")
        
        findings = []
        
        try:
            # Read all sheets
            excel_file = pd.ExcelFile(file_stream, engine='openpyxl' if HAS_OPENPYXL else None)
            
            for sheet_name in excel_file.sheet_names:
                logger.debug(f"Processing sheet: {sheet_name}")
                
                # Read sheet
                df = excel_file.parse(sheet_name)
                
                if df.empty:
                    continue
                
                # Clean column names
                df.columns = [str(col).lower().strip() for col in df.columns]
                
                # Map headers
                field_mapping = self._map_table_headers(df.columns.tolist())
                
                if field_mapping:
                    # Structured extraction
                    for _, row in df.iterrows():
                        finding = {}
                        for col, field in field_mapping.items():
                            value = row.get(col)
                            if pd.notna(value) and str(value).strip():
                                finding[field] = str(value).strip()
                        
                        if finding.get('title') or finding.get('description'):
                            # Map severity
                            if 'severity' in finding:
                                finding['severity'] = self.severity_mapper.map_severity(
                                    finding['severity']
                                ).value
                            
                            # Add sheet context
                            finding['sheet'] = sheet_name
                            
                            findings.append(finding)
                else:
                    # Try to extract from all cell values
                    all_text = ""
                    for _, row in df.iterrows():
                        row_text = ' '.join(str(v) for v in row if pd.notna(v))
                        if row_text.strip():
                            all_text += row_text + "\n"
                    
                    if all_text:
                        text_findings = self.pattern_matcher.extract_findings(all_text)
                        for tf in text_findings:
                            tf['sheet'] = sheet_name
                        findings.extend(text_findings)
        
        except Exception as e:
            logger.error(f"Excel parsing error: {e}")
            # Fall back to basic CSV parsing if possible
            file_stream.seek(0)
            try:
                findings = await self._parse_csv(file_stream)
            except:
                raise ParseError(f"Failed to parse Excel file: {str(e)}")
        
        return findings
    
    def _detect_delimiter(self, sample: str) -> str:
        """Detect CSV delimiter from sample text."""
        delimiters = [',', ';', '\t', '|']
        delimiter_counts = {}
        
        for delimiter in delimiters:
            delimiter_counts[delimiter] = sample.count(delimiter)
        
        # Return delimiter with highest count
        if delimiter_counts:
            return max(delimiter_counts, key=delimiter_counts.get)
        
        return ','  # Default to comma
    
    def _map_table_headers(self, headers: List[str]) -> Dict[str, str]:
        """Map table headers to finding fields."""
        mapping = {}
        
        for field, variations in TABLE_HEADER_MAPPINGS.items():
            for header in headers:
                header_clean = header.lower().strip()
                for variation in variations:
                    if variation in header_clean or header_clean in variation:
                        mapping[header] = field
                        break
                if header in mapping:
                    break
        
        # Ensure we have at least some key fields
        if not any(field in mapping.values() for field in ['title', 'description']):
            return {}
        
        return mapping
    
    async def _create_finding(self, finding_data: Dict[str, Any], confidence: float) -> Finding:
        """Create Finding object from extracted data."""
        # Extract severity
        severity_text = finding_data.get('severity', 'MEDIUM')
        if severity_text in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
            severity = SeverityLevel[severity_text]
        else:
            severity = self.severity_mapper.map_severity(severity_text)
        
        # Build description
        description = finding_data.get('description', '').strip()
        if finding_data.get('recommendation'):
            recommendation = finding_data['recommendation'].strip()
            if recommendation:
                description += f"\n\nRecommendation: {recommendation}"
        
        # Extract resource
        resource = finding_data.get('resource', '')
        if not resource and finding_data.get('sheet'):
            resource = f"Sheet: {finding_data['sheet']}"
        elif not resource:
            resource = 'Spreadsheet'
        
        # Build metadata
        metadata = {
            'confidence': confidence,
            'source': 'spreadsheet_parser',
            'extraction_method': 'structured_extraction'
        }
        
        # Add sheet info if available
        if finding_data.get('sheet'):
            metadata['sheet'] = finding_data['sheet']
        
        # Add references if available
        if finding_data.get('references'):
            metadata['references'] = finding_data['references']
        
        # Add vulnerability type if identified
        if finding_data.get('vulnerability_type'):
            metadata['vulnerability_type'] = finding_data['vulnerability_type']
        
        return Finding(
            title=finding_data.get('title', 'Security Finding'),
            severity=severity,
            description=description,
            resource_name=resource,
            metadata=metadata
        )