"""PDF parser for security reports with OCR support."""

import io
import re
import logging
from typing import AsyncIterator, Optional, Dict, Any, List
from pathlib import Path
import tempfile

from app.parsers.base import AbstractParser, ParserMetadata, ParserCapabilities
from app.parsers.registry import register_parser
from app.models.finding import Finding, SeverityLevel
from app.core.exceptions import ParseError
from .patterns import PatternMatcher, SeverityMapper, ConfidenceScorer

logger = logging.getLogger(__name__)

# Import PDF libraries with fallback
try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    logger.warning("pdfplumber not installed - PDF text extraction limited")

try:
    import tabula
    HAS_TABULA = True
except ImportError:
    HAS_TABULA = False
    logger.warning("tabula-py not installed - PDF table extraction disabled")

try:
    import pytesseract
    from PIL import Image
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    logger.warning("pytesseract/PIL not installed - OCR support disabled")


@register_parser
class PDFParser(AbstractParser):
    """Parser for PDF security reports with OCR support."""
    
    def __init__(self):
        self.pattern_matcher = PatternMatcher()
        self.severity_mapper = SeverityMapper()
        self.confidence_scorer = ConfidenceScorer()
    
    @classmethod
    def get_metadata(cls) -> ParserMetadata:
        return ParserMetadata(
            name="PDF Security Report Parser",
            tool="pdf",
            supported_versions=["*"],
            file_extensions=[".pdf"],
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
        """Check if file is a PDF."""
        # Check magic bytes
        if content_preview.startswith(b'%PDF-'):
            return 0.95
        
        # Check file extension
        if file_path.suffix.lower() == '.pdf':
            return 0.8
        
        return 0.0
    
    async def parse_stream(self, file_stream: io.IOBase) -> AsyncIterator[Finding]:
        """Parse PDF security report."""
        if not HAS_PDFPLUMBER:
            raise ParseError("pdfplumber not installed - cannot parse PDF files")
        
        # Read file content
        content = file_stream.read()
        
        # Process with pdfplumber
        findings = []
        extracted_text = ""
        tables_data = []
        
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                # Extract text from all pages
                for page_num, page in enumerate(pdf.pages, 1):
                    logger.debug(f"Processing PDF page {page_num}")
                    
                    # Extract text
                    page_text = page.extract_text()
                    if page_text:
                        extracted_text += f"\n--- Page {page_num} ---\n{page_text}\n"
                    
                    # Extract tables
                    tables = page.extract_tables()
                    for table in tables:
                        if table and len(table) > 1:  # Has header and data
                            tables_data.append({
                                'page': page_num,
                                'data': table
                            })
                
                # If no text extracted, try OCR
                if not extracted_text.strip() and HAS_OCR:
                    logger.info("No text found, attempting OCR...")
                    extracted_text = await self._ocr_pdf(content)
            
            # Extract findings from text
            if extracted_text:
                text_findings = self.pattern_matcher.extract_findings(extracted_text)
                findings.extend(text_findings)
            
            # Extract findings from tables
            if HAS_TABULA and tables_data:
                table_findings = await self._extract_from_tables(tables_data)
                findings.extend(table_findings)
            
            # If still no findings, try alternative table extraction
            if not findings and HAS_TABULA:
                try:
                    # Save to temp file for tabula
                    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                        tmp.write(content)
                        tmp_path = tmp.name
                    
                    # Extract tables with tabula
                    dfs = tabula.read_pdf(tmp_path, pages='all', multiple_tables=True)
                    Path(tmp_path).unlink()  # Clean up
                    
                    for df in dfs:
                        table_findings = await self._extract_from_dataframe(df)
                        findings.extend(table_findings)
                
                except Exception as e:
                    logger.warning(f"Tabula extraction failed: {e}")
            
            # Convert findings to Finding objects
            for finding_data in findings:
                confidence = self.confidence_scorer.calculate_confidence(finding_data)
                
                # Only yield findings above confidence threshold
                if confidence >= 0.5:
                    yield await self._create_finding(finding_data, confidence)
        
        except Exception as e:
            logger.error(f"PDF parsing error: {e}")
            raise ParseError(f"Failed to parse PDF: {str(e)}")
    
    async def _ocr_pdf(self, pdf_content: bytes) -> str:
        """Extract text from PDF using OCR."""
        if not HAS_OCR:
            return ""
        
        extracted_text = ""
        
        try:
            # Convert PDF to images
            import pdf2image
            
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                tmp.write(pdf_content)
                tmp_path = tmp.name
            
            images = pdf2image.convert_from_path(tmp_path)
            Path(tmp_path).unlink()  # Clean up
            
            # OCR each page
            for i, image in enumerate(images, 1):
                logger.debug(f"Running OCR on page {i}")
                text = pytesseract.image_to_string(image)
                if text.strip():
                    extracted_text += f"\n--- Page {i} (OCR) ---\n{text}\n"
            
        except Exception as e:
            logger.error(f"OCR failed: {e}")
        
        return extracted_text
    
    async def _extract_from_tables(self, tables: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract findings from table data."""
        findings = []
        
        for table_info in tables:
            table = table_info['data']
            if not table or len(table) < 2:
                continue
            
            # Assume first row is header
            headers = [str(h).lower().strip() for h in table[0] if h]
            
            # Map headers to finding fields
            field_mapping = self._map_table_headers(headers)
            if not field_mapping:
                continue
            
            # Extract findings from rows
            for row in table[1:]:
                if not any(row):  # Skip empty rows
                    continue
                
                finding = {}
                for i, cell in enumerate(row):
                    if i < len(headers) and headers[i] in field_mapping and cell:
                        field = field_mapping[headers[i]]
                        finding[field] = str(cell).strip()
                
                if finding.get('title') or finding.get('description'):
                    # Map severity
                    if 'severity' in finding:
                        finding['severity'] = self.severity_mapper.map_severity(
                            finding['severity']
                        ).value
                    
                    findings.append(finding)
        
        return findings
    
    async def _extract_from_dataframe(self, df) -> List[Dict[str, Any]]:
        """Extract findings from pandas DataFrame."""
        findings = []
        
        try:
            # Clean column names
            df.columns = [str(col).lower().strip() for col in df.columns]
            
            # Map headers
            field_mapping = self._map_table_headers(df.columns.tolist())
            if not field_mapping:
                return findings
            
            # Extract findings
            for _, row in df.iterrows():
                finding = {}
                for col, field in field_mapping.items():
                    value = row.get(col)
                    if value and str(value).strip() not in ['nan', 'None', '']:
                        finding[field] = str(value).strip()
                
                if finding.get('title') or finding.get('description'):
                    # Map severity
                    if 'severity' in finding:
                        finding['severity'] = self.severity_mapper.map_severity(
                            finding['severity']
                        ).value
                    
                    findings.append(finding)
        
        except Exception as e:
            logger.warning(f"DataFrame extraction error: {e}")
        
        return findings
    
    def _map_table_headers(self, headers: List[str]) -> Dict[str, str]:
        """Map table headers to finding fields."""
        from .patterns import TABLE_HEADER_MAPPINGS
        
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
        description = finding_data.get('description', '')
        if finding_data.get('recommendation'):
            description += f"\n\nRecommendation: {finding_data['recommendation']}"
        
        # Extract resource
        resource = finding_data.get('resource') or finding_data.get('files', [''])[0] if 'files' in finding_data else 'Document'
        
        # Build metadata
        metadata = {
            'confidence': confidence,
            'source': 'pdf_parser',
            'extraction_method': 'pattern_matching'
        }
        
        # Add references if available
        if finding_data.get('references'):
            metadata['references'] = finding_data['references']
        
        # Add vulnerability type if identified
        if finding_data.get('vulnerability_type'):
            metadata['vulnerability_type'] = finding_data['vulnerability_type']
        
        # Add line numbers if available
        if finding_data.get('line_numbers'):
            metadata['line_numbers'] = finding_data['line_numbers']
        
        return Finding(
            title=finding_data.get('title', 'Security Finding'),
            severity=severity,
            description=description,
            resource_name=resource,
            metadata=metadata
        )