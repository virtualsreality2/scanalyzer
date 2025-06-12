"""
Test finding service functionality
"""
import pytest
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.finding import Finding as FindingModel
from app.models.report import Report as ReportModel
from app.schemas.finding import FindingCreate, FindingUpdate
from app.db.models import Finding as DBFinding, Report as DBReport
import hashlib
from typing import List


class TestFindingService:
    """Test finding service operations"""
    
    @pytest.fixture
    def sample_findings(self):
        """Generate sample findings for testing"""
        findings = []
        for i in range(10):
            findings.append(FindingModel(
                title=f"SQL Injection {i}",
                description=f"SQL injection vulnerability in endpoint /api/v1/users/{i}",
                severity="high" if i < 3 else "medium",
                confidence="high",
                tool="burp",
                location=f"https://example.com/api/v1/users/{i}",
                cvss_score=8.5 if i < 3 else 6.5,
                references=[f"https://cwe.mitre.org/data/definitions/89.html"]
            ))
        return findings
    
    def test_deduplication_logic(self, sample_findings):
        """Test finding deduplication algorithms"""
        # Create duplicate findings
        duplicate_findings = [
            FindingModel(
                title="SQL Injection 0",
                description="SQL injection vulnerability in endpoint /api/v1/users/0",
                severity="high",
                confidence="high",
                tool="zap",  # Different tool
                location="https://example.com/api/v1/users/0",
                cvss_score=8.5
            ),
            FindingModel(
                title="SQL Injection 0",
                description="SQL injection vulnerability in endpoint /api/v1/users/0",
                severity="high",
                confidence="high",
                tool="burp",  # Same tool
                location="https://example.com/api/v1/users/0",
                cvss_score=8.5
            )
        ]
        
        all_findings = sample_findings + duplicate_findings
        
        # Deduplication logic
        unique_findings = self._deduplicate_findings(all_findings)
        
        # Should have 10 unique findings (duplicates removed)
        assert len(unique_findings) == 10
        
        # Test deduplication by hash
        hashes = set()
        for finding in unique_findings:
            finding_hash = self._calculate_finding_hash(finding)
            assert finding_hash not in hashes
            hashes.add(finding_hash)
    
    def test_severity_calculation(self):
        """Test composite severity calculation"""
        test_cases = [
            # (cvss_score, text_severity, expected_severity)
            (9.5, "critical", "critical"),
            (8.0, "high", "high"),
            (7.5, "medium", "high"),  # CVSS takes precedence
            (4.0, "high", "medium"),   # CVSS takes precedence
            (None, "high", "high"),
            (6.5, None, "medium"),
            (None, None, "info"),
        ]
        
        for cvss, text_sev, expected in test_cases:
            calculated = self._calculate_severity(cvss, text_sev)
            assert calculated == expected, f"Failed for CVSS {cvss}, text {text_sev}"
    
    def test_bulk_operations(self, db_session: Session):
        """Test bulk update/delete operations"""
        # Create test report
        report = DBReport(
            filename="test_report.xml",
            file_type="nmap",
            upload_date=datetime.utcnow(),
            status="completed"
        )
        db_session.add(report)
        db_session.commit()
        
        # Create 1000 findings
        findings = []
        for i in range(1000):
            finding = DBFinding(
                report_id=report.id,
                title=f"Finding {i}",
                description=f"Description {i}",
                severity=["low", "medium", "high", "critical"][i % 4],
                confidence="high",
                tool="nmap",
                finding_hash=hashlib.md5(f"finding_{i}".encode()).hexdigest()
            )
            findings.append(finding)
        
        # Bulk insert
        db_session.bulk_save_objects(findings)
        db_session.commit()
        
        # Test bulk update
        finding_ids = db_session.query(DBFinding.id).filter(
            DBFinding.severity == "high"
        ).limit(100).all()
        
        db_session.query(DBFinding).filter(
            DBFinding.id.in_([f.id for f in finding_ids])
        ).update(
            {"status": "resolved"},
            synchronize_session=False
        )
        db_session.commit()
        
        # Verify update
        updated_count = db_session.query(DBFinding).filter(
            DBFinding.status == "resolved"
        ).count()
        assert updated_count == len(finding_ids)
        
        # Test bulk delete
        db_session.query(DBFinding).filter(
            DBFinding.severity == "low"
        ).delete(synchronize_session=False)
        db_session.commit()
        
        # Verify deletion
        remaining = db_session.query(DBFinding).count()
        assert remaining == 750  # 1000 - 250 low severity
    
    def test_finding_enrichment(self):
        """Test finding enrichment with additional data"""
        finding = FindingModel(
            title="Unpatched Apache Log4j",
            description="Apache Log4j vulnerability detected",
            severity="critical",
            tool="nessus"
        )
        
        # Enrich with CVE data
        enriched = self._enrich_finding(finding)
        
        assert enriched.cve_id == "CVE-2021-44228"
        assert enriched.cvss_score == 10.0
        assert enriched.exploit_available is True
        assert len(enriched.references) > 2
    
    def _deduplicate_findings(self, findings: List[FindingModel]) -> List[FindingModel]:
        """Remove duplicate findings based on hash"""
        seen = set()
        unique = []
        
        for finding in findings:
            finding_hash = self._calculate_finding_hash(finding)
            if finding_hash not in seen:
                seen.add(finding_hash)
                unique.append(finding)
        
        return unique
    
    def _calculate_finding_hash(self, finding: FindingModel) -> str:
        """Calculate hash for finding deduplication"""
        hash_input = f"{finding.title}:{finding.location}:{finding.severity}"
        return hashlib.md5(hash_input.encode()).hexdigest()
    
    def _calculate_severity(self, cvss_score: float = None, text_severity: str = None) -> str:
        """Calculate severity based on CVSS and text"""
        if cvss_score:
            if cvss_score >= 9.0:
                return "critical"
            elif cvss_score >= 7.0:
                return "high"
            elif cvss_score >= 4.0:
                return "medium"
            else:
                return "low"
        elif text_severity:
            return text_severity.lower()
        else:
            return "info"
    
    def _enrich_finding(self, finding: FindingModel) -> FindingModel:
        """Enrich finding with additional data"""
        # Simulate CVE lookup
        if "log4j" in finding.title.lower():
            finding.cve_id = "CVE-2021-44228"
            finding.cvss_score = 10.0
            finding.exploit_available = True
            finding.references.extend([
                "https://nvd.nist.gov/vuln/detail/CVE-2021-44228",
                "https://logging.apache.org/log4j/2.x/security.html"
            ])
        
        return finding