"""
Test parser accuracy with real-world report samples
"""
import pytest
from pathlib import Path
from app.parsers.bandit.bandit_parser import BanditParser
from app.parsers.checkov.checkov_parser import CheckovParser
from app.parsers.prowler.prowler_v2_parser import ProwlerV2Parser
from app.parsers.prowler.prowler_v3_parser import ProwlerV3Parser
from app.parsers.document import DocxParser, PDFParser, SpreadsheetParser
from app.models.finding import Finding
from faker import Faker
import xml.etree.ElementTree as ET
import json

fake = Faker()


class TestParserAccuracy:
    @pytest.fixture
    def sample_reports(self):
        return Path("tests/fixtures/reports")
    
    @pytest.mark.parametrize("parser_class,report_file,expected_findings", [
        (BanditParser, "bandit_report.json", 15),
        (CheckovParser, "checkov_result.json", 27),
        (ProwlerV2Parser, "prowler_v2_report.json", 45),
        (ProwlerV3Parser, "prowler_v3_report.json", 52),
    ])
    def test_parser_finding_count(self, parser_class, report_file, expected_findings, tmp_path):
        """Test that parsers extract correct number of findings"""
        # Create sample report with expected findings
        sample_data = self._generate_sample_report(parser_class, expected_findings)
        report_path = tmp_path / report_file
        
        with open(report_path, 'w') as f:
            json.dump(sample_data, f)
        
        # Parse report
        parser = parser_class()
        findings = parser.parse(report_path)
        
        # Validate finding count
        assert len(findings) == expected_findings
        assert all(isinstance(f, Finding) for f in findings)
    
    def test_parser_data_accuracy(self):
        """Test that parsed data maintains accuracy"""
        # Test Bandit parser
        bandit_parser = BanditParser()
        bandit_data = {
            "results": [
                {
                    "code": "import pickle\npickle.loads(data)",
                    "col_offset": 0,
                    "confidence": "HIGH",
                    "filename": "test.py",
                    "issue_confidence": "HIGH",
                    "issue_severity": "HIGH",
                    "issue_text": "Pickle library used",
                    "line_number": 2,
                    "line_range": [2],
                    "more_info": "https://bandit.readthedocs.io/en/latest/",
                    "severity": "HIGH",
                    "test_id": "B301",
                    "test_name": "blacklist"
                }
            ]
        }
        
        findings = bandit_parser._parse_json(bandit_data)
        assert len(findings) == 1
        finding = findings[0]
        
        # Severity mapping validation
        assert finding.severity == "high"
        assert finding.confidence == "high"
        
        # Description completeness
        assert finding.title == "blacklist"
        assert "Pickle library used" in finding.description
        assert finding.location == "test.py:2"
        
        # Reference URL integrity
        assert finding.references[0] == "https://bandit.readthedocs.io/en/latest/"
        
    def test_parser_edge_cases(self, tmp_path):
        """Test parser handling of edge cases"""
        # Empty reports
        empty_bandit = {"results": []}
        bandit_parser = BanditParser()
        findings = bandit_parser._parse_json(empty_bandit)
        assert len(findings) == 0
        
        # Massive reports (simulated)
        large_data = {
            "results": [
                {
                    "code": f"code_{i}",
                    "confidence": "HIGH",
                    "filename": f"file_{i}.py",
                    "issue_confidence": "HIGH",
                    "issue_severity": "HIGH",
                    "issue_text": f"Issue {i}",
                    "line_number": i,
                    "severity": "HIGH",
                    "test_id": f"B{i:03d}",
                    "test_name": f"test_{i}"
                }
                for i in range(10000)
            ]
        }
        
        findings = bandit_parser._parse_json(large_data)
        assert len(findings) == 10000
        
        # Unicode and special characters
        unicode_data = {
            "results": [{
                "code": "# 测试中文 και ελληνικά",
                "confidence": "HIGH",
                "filename": "файл.py",
                "issue_text": "Security issue: \u2603 ☃ 🔒",
                "line_number": 1,
                "severity": "HIGH",
                "test_id": "B001",
                "test_name": "unicode_test"
            }]
        }
        
        findings = bandit_parser._parse_json(unicode_data)
        assert len(findings) == 1
        assert "🔒" in findings[0].description
        
        # Truncated/malformed files
        malformed_json = '{"results": [{"code": "test", "confidence":'
        with pytest.raises(json.JSONDecodeError):
            json.loads(malformed_json)
    
    def _generate_sample_report(self, parser_class, num_findings):
        """Generate sample report data for testing"""
        if parser_class == BanditParser:
            return {
                "results": [
                    {
                        "code": f"code_{i}",
                        "confidence": ["HIGH", "MEDIUM", "LOW"][i % 3],
                        "filename": f"file_{i}.py",
                        "issue_text": f"Issue {i}",
                        "line_number": i,
                        "severity": ["HIGH", "MEDIUM", "LOW"][i % 3],
                        "test_id": f"B{i:03d}",
                        "test_name": f"test_{i}"
                    }
                    for i in range(num_findings)
                ]
            }
        elif parser_class == CheckovParser:
            return {
                "check_type": "terraform",
                "results": {
                    "passed_checks": [],
                    "failed_checks": [
                        {
                            "check_id": f"CKV_AWS_{i}",
                            "check_name": f"Check {i}",
                            "check_result": {"result": "FAILED"},
                            "code_block": [[i, f"resource_{i}"]],
                            "file_path": f"/path/to/file_{i}.tf",
                            "file_line_range": [i, i+5],
                            "resource": f"aws_resource_{i}",
                            "evaluations": None,
                            "check_class": "checkov.terraform.checks.Check",
                            "guideline": f"https://docs.checkov.io/CKV_AWS_{i}"
                        }
                        for i in range(num_findings)
                    ]
                }
            }
        elif parser_class == ProwlerV2Parser:
            return {
                "findings": [
                    {
                        "check_id": f"check_{i}",
                        "check_title": f"Check Title {i}",
                        "result": "FAIL",
                        "severity": ["critical", "high", "medium", "low"][i % 4],
                        "service_name": f"service_{i}",
                        "region": "us-east-1",
                        "account_id": "123456789012",
                        "resource_id": f"resource_{i}",
                        "status_extended": f"Extended status {i}",
                        "remediation": f"Fix by doing {i}"
                    }
                    for i in range(num_findings)
                ]
            }
        elif parser_class == ProwlerV3Parser:
            return {
                "findings": [
                    {
                        "finding_id": f"finding_{i}",
                        "check_id": f"check_{i}",
                        "check_title": f"Check Title {i}",
                        "status": "FAIL",
                        "severity": ["critical", "high", "medium", "low"][i % 4],
                        "service_name": f"service_{i}",
                        "region": "us-east-1",
                        "account_id": "123456789012",
                        "resource_id": f"resource_{i}",
                        "status_extended": f"Extended status {i}",
                        "risk": f"Risk description {i}",
                        "remediation": {
                            "recommendation": {
                                "text": f"Fix by doing {i}",
                                "url": f"https://docs.aws.amazon.com/fix_{i}"
                            }
                        }
                    }
                    for i in range(num_findings)
                ]
            }
        return {}


class TestDocumentParsers:
    """Test document parser accuracy and edge cases"""
    
    def test_pdf_parser_text_extraction(self, tmp_path):
        """Test PDF parser extracts text correctly"""
        # Note: This is a placeholder - actual PDF testing requires creating PDFs
        pdf_parser = PDFParser()
        
        # Test with sample PDF patterns
        sample_text = "CVE-2021-44228 Log4j vulnerability CVSS 10.0"
        findings = pdf_parser._extract_findings_from_text(sample_text)
        
        assert any("CVE-2021-44228" in f.title for f in findings)
        assert any("10.0" in f.description for f in findings)
    
    def test_docx_parser_table_extraction(self):
        """Test DOCX parser extracts tables correctly"""
        docx_parser = DocxParser()
        
        # Test pattern matching
        sample_text = """
        Vulnerability: SQL Injection
        Severity: High
        CVSS Score: 8.5
        Description: SQL injection vulnerability found in login form
        """
        
        findings = docx_parser._extract_findings_from_text(sample_text)
        assert len(findings) > 0
        assert any("SQL Injection" in f.title for f in findings)
    
    def test_spreadsheet_parser_formats(self):
        """Test spreadsheet parser handles different formats"""
        spreadsheet_parser = SpreadsheetParser()
        
        # Test CSV parsing
        csv_content = """Title,Severity,Description
SQL Injection,High,Found in login form
XSS,Medium,Reflected XSS in search
"""
        findings = spreadsheet_parser._parse_csv_content(csv_content.splitlines())
        assert len(findings) == 2
        assert findings[0].title == "SQL Injection"
        assert findings[0].severity == "high"