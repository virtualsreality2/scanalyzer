"""
Test data generators for creating realistic test fixtures
"""
from faker import Faker
import xml.etree.ElementTree as ET
import json
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
import csv
import io

fake = Faker()


class ReportGenerator:
    """Generate realistic security scan reports in various formats"""
    
    @staticmethod
    def generate_nmap_report(num_hosts: int = 100, findings_per_host: int = 10) -> str:
        """Generate realistic Nmap XML report"""
        root = ET.Element('nmaprun', {
            'scanner': 'nmap',
            'args': 'nmap -sV -sC -O',
            'start': str(int(datetime.now().timestamp())),
            'version': '7.92'
        })
        
        # Add scan info
        scaninfo = ET.SubElement(root, 'scaninfo', {
            'type': 'syn',
            'protocol': 'tcp',
            'services': '1-65535'
        })
        
        for i in range(num_hosts):
            host = ET.SubElement(root, 'host')
            
            # Status
            status = ET.SubElement(host, 'status', {
                'state': 'up',
                'reason': 'syn-ack'
            })
            
            # Address
            address = ET.SubElement(host, 'address', {
                'addr': fake.ipv4(),
                'addrtype': 'ipv4'
            })
            
            # Hostnames
            hostnames = ET.SubElement(host, 'hostnames')
            hostname = ET.SubElement(hostnames, 'hostname', {
                'name': fake.domain_name(),
                'type': 'user'
            })
            
            # Ports
            ports = ET.SubElement(host, 'ports')
            
            for j in range(random.randint(1, findings_per_host)):
                port = ET.SubElement(ports, 'port', {
                    'protocol': 'tcp',
                    'portid': str(random.choice([21, 22, 80, 443, 3306, 5432, 8080, 8443]))
                })
                
                state = ET.SubElement(port, 'state', {
                    'state': 'open',
                    'reason': 'syn-ack'
                })
                
                service = ET.SubElement(port, 'service', {
                    'name': random.choice(['http', 'ssh', 'ftp', 'mysql', 'postgresql', 'https']),
                    'product': random.choice(['Apache httpd', 'OpenSSH', 'nginx', 'MySQL', 'PostgreSQL']),
                    'version': f"{random.randint(1, 10)}.{random.randint(0, 9)}.{random.randint(0, 20)}"
                })
                
                # Add script results for vulnerabilities
                if random.random() > 0.7:
                    script = ET.SubElement(port, 'script', {
                        'id': random.choice(['ssl-cert', 'http-vuln-cve2017-5638', 'ssl-heartbleed']),
                        'output': 'VULNERABLE: ' + fake.sentence()
                    })
        
        return ET.tostring(root, encoding='unicode', xml_declaration=True)
    
    @staticmethod
    def generate_bandit_report(num_findings: int = 50) -> str:
        """Generate realistic Bandit JSON report"""
        findings = []
        
        for i in range(num_findings):
            severity = random.choice(['LOW', 'MEDIUM', 'HIGH'])
            confidence = random.choice(['LOW', 'MEDIUM', 'HIGH'])
            
            finding = {
                "code": fake.text(max_nb_chars=200),
                "col_offset": random.randint(0, 80),
                "confidence": confidence,
                "filename": f"src/{fake.file_name(extension='py')}",
                "issue_confidence": confidence,
                "issue_severity": severity,
                "issue_text": random.choice([
                    "Use of insecure cipher mode",
                    "Possible SQL injection vulnerability",
                    "Use of hardcoded password",
                    "Insecure use of random generator",
                    "Use of assert detected",
                    "Possible binding to all interfaces"
                ]) + ". " + fake.sentence(),
                "line_number": random.randint(1, 500),
                "line_range": [random.randint(1, 500)],
                "more_info": f"https://bandit.readthedocs.io/en/latest/plugins/b{random.randint(100, 700)}.html",
                "severity": severity,
                "test_id": f"B{random.randint(100, 700)}",
                "test_name": fake.word()
            }
            findings.append(finding)
        
        report = {
            "errors": [],
            "generated_at": datetime.now().isoformat(),
            "metrics": {
                "_totals": {
                    "CONFIDENCE.HIGH": sum(1 for f in findings if f['confidence'] == 'HIGH'),
                    "CONFIDENCE.LOW": sum(1 for f in findings if f['confidence'] == 'LOW'),
                    "CONFIDENCE.MEDIUM": sum(1 for f in findings if f['confidence'] == 'MEDIUM'),
                    "SEVERITY.HIGH": sum(1 for f in findings if f['severity'] == 'HIGH'),
                    "SEVERITY.LOW": sum(1 for f in findings if f['severity'] == 'LOW'),
                    "SEVERITY.MEDIUM": sum(1 for f in findings if f['severity'] == 'MEDIUM'),
                },
                "files": {}
            },
            "results": findings
        }
        
        return json.dumps(report, indent=2)
    
    @staticmethod
    def generate_checkov_report(num_findings: int = 30) -> str:
        """Generate realistic Checkov JSON report"""
        failed_checks = []
        passed_checks = []
        
        for i in range(num_findings):
            check = {
                "check_id": f"CKV_AWS_{random.randint(1, 200)}",
                "check_name": random.choice([
                    "Ensure S3 bucket has encryption enabled",
                    "Ensure RDS instances have encryption enabled",
                    "Ensure IAM policies are attached only to groups",
                    "Ensure Security Groups do not have unrestricted ingress",
                    "Ensure CloudTrail is enabled"
                ]),
                "check_result": {"result": "FAILED" if i < num_findings * 0.7 else "PASSED"},
                "code_block": [[i, f"resource \"aws_{fake.word()}\" \"{fake.word()}\" {{"]],
                "file_path": f"/terraform/{fake.file_name(extension='tf')}",
                "file_line_range": [i, i+10],
                "resource": f"aws_{fake.word()}.{fake.word()}",
                "evaluations": None,
                "check_class": "checkov.terraform.checks.resource.aws.S3Encryption",
                "guideline": f"https://docs.checkov.io/2.0/checkov/CKV_AWS_{random.randint(1, 200)}.html"
            }
            
            if check["check_result"]["result"] == "FAILED":
                failed_checks.append(check)
            else:
                passed_checks.append(check)
        
        report = {
            "check_type": "terraform",
            "results": {
                "passed_checks": passed_checks,
                "failed_checks": failed_checks,
                "skipped_checks": [],
                "parsing_errors": []
            },
            "summary": {
                "passed": len(passed_checks),
                "failed": len(failed_checks),
                "skipped": 0,
                "parsing_errors": 0,
                "checkov_version": "2.1.0"
            }
        }
        
        return json.dumps(report, indent=2)
    
    @staticmethod
    def generate_prowler_v3_report(num_findings: int = 40) -> str:
        """Generate realistic Prowler v3 JSON report"""
        findings = []
        
        for i in range(num_findings):
            status = random.choice(['PASS', 'FAIL', 'INFO'])
            severity = random.choice(['critical', 'high', 'medium', 'low', 'informational'])
            
            finding = {
                "assessment_start_time": (datetime.now() - timedelta(hours=1)).isoformat(),
                "finding_info": {
                    "finding_id": fake.uuid4(),
                    "check_id": f"{random.choice(['iam', 'ec2', 's3', 'rds'])}_{fake.word()}_{fake.word()}",
                    "check_title": fake.sentence(nb_words=6),
                    "check_type": "Security Best Practices",
                    "status": status,
                    "status_extended": fake.sentence() if status == 'FAIL' else "Resource compliant",
                    "service_name": random.choice(['iam', 'ec2', 's3', 'rds', 'lambda']),
                    "risk": fake.paragraph() if status == 'FAIL' else "",
                    "remediation": {
                        "recommendation": {
                            "text": fake.paragraph(),
                            "url": f"https://docs.aws.amazon.com/{fake.word()}/{fake.word()}"
                        }
                    }
                },
                "resources": {
                    "resource_id": f"arn:aws:{random.choice(['s3', 'ec2', 'iam'])}:us-east-1:123456789012:{fake.word()}/{fake.word()}",
                    "resource_arn": f"arn:aws:{random.choice(['s3', 'ec2', 'iam'])}:us-east-1:123456789012:{fake.word()}/{fake.word()}",
                    "resource_details": fake.sentence(),
                    "resource_tags": {
                        "Environment": random.choice(['prod', 'dev', 'staging']),
                        "Owner": fake.name()
                    },
                    "region": random.choice(['us-east-1', 'us-west-2', 'eu-west-1']),
                    "account_id": "123456789012"
                },
                "severity": severity
            }
            findings.append(finding)
        
        report = {
            "findings": findings,
            "metadata": {
                "prowler_version": "3.0.0",
                "timestamp": datetime.now().isoformat()
            }
        }
        
        return json.dumps(report, indent=2)
    
    @staticmethod
    def generate_malformed_reports() -> Dict[str, Any]:
        """Generate malformed reports for error testing"""
        return {
            'truncated_xml': '<nmaprun><host><address addr="192.168.1.1"',
            'invalid_encoding': b'\xff\xfe<xml>test</xml>',
            'huge_file': 'A' * (100 * 1024 * 1024),  # 100MB
            'empty_file': '',
            'binary_file': bytes(random.randint(0, 255) for _ in range(1024)),
            'invalid_json': '{"results": [{"test": "incomplete"',
            'wrong_format': '<html><body>This is not a security report</body></html>',
            'corrupted_data': ''.join(chr(random.randint(0, 127)) for _ in range(1000))
        }
    
    @staticmethod
    def generate_csv_report(num_findings: int = 100) -> str:
        """Generate CSV format report"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['Title', 'Severity', 'Tool', 'Description', 'Location', 'CVSS', 'References'])
        
        # Findings
        for i in range(num_findings):
            writer.writerow([
                f"{random.choice(['SQL Injection', 'XSS', 'CSRF', 'XXE', 'RCE'])} in {fake.word()}",
                random.choice(['Critical', 'High', 'Medium', 'Low']),
                random.choice(['Burp', 'ZAP', 'Nessus', 'Qualys']),
                fake.paragraph(),
                f"https://{fake.domain_name()}/path/{fake.word()}",
                round(random.uniform(0.0, 10.0), 1),
                f"https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-{random.randint(2020, 2024)}-{random.randint(10000, 99999)}"
            ])
        
        return output.getvalue()


class TestDataFactory:
    """Factory for creating test data objects"""
    
    @staticmethod
    def create_finding(**kwargs) -> Dict[str, Any]:
        """Create a finding object with optional overrides"""
        defaults = {
            'id': fake.uuid4(),
            'title': f"{random.choice(['SQL Injection', 'XSS', 'RCE'])} in {fake.word()}",
            'description': fake.paragraph(),
            'severity': random.choice(['critical', 'high', 'medium', 'low']),
            'confidence': random.choice(['high', 'medium', 'low']),
            'tool': random.choice(['nmap', 'nessus', 'burp', 'zap']),
            'location': f"https://{fake.domain_name()}/path/{fake.word()}",
            'cvss_score': round(random.uniform(0.0, 10.0), 1),
            'cve_id': f"CVE-{random.randint(2020, 2024)}-{random.randint(10000, 99999)}",
            'references': [fake.url() for _ in range(random.randint(1, 3))],
            'created_at': fake.date_time_between(start_date='-30d', end_date='now').isoformat(),
            'updated_at': datetime.now().isoformat(),
            'status': random.choice(['open', 'resolved', 'false_positive']),
            'report_id': fake.uuid4()
        }
        defaults.update(kwargs)
        return defaults
    
    @staticmethod
    def create_report(**kwargs) -> Dict[str, Any]:
        """Create a report object with optional overrides"""
        defaults = {
            'id': fake.uuid4(),
            'filename': fake.file_name(extension=random.choice(['xml', 'json', 'csv'])),
            'file_type': random.choice(['nmap', 'nessus', 'burp', 'zap', 'bandit', 'checkov']),
            'upload_date': fake.date_time_between(start_date='-7d', end_date='now').isoformat(),
            'status': random.choice(['pending', 'processing', 'completed', 'failed']),
            'total_findings': random.randint(0, 500),
            'processing_time': round(random.uniform(0.5, 120.0), 2),
            'file_size': random.randint(1000, 10000000),
            'error_message': None if kwargs.get('status') != 'failed' else fake.sentence()
        }
        defaults.update(kwargs)
        return defaults
    
    @staticmethod
    def create_bulk_findings(count: int = 1000) -> List[Dict[str, Any]]:
        """Create multiple findings for bulk testing"""
        report_ids = [fake.uuid4() for _ in range(10)]  # 10 different reports
        
        findings = []
        for i in range(count):
            finding = TestDataFactory.create_finding(
                report_id=random.choice(report_ids),
                # Add some patterns for testing filters
                severity='critical' if i % 10 == 0 else random.choice(['high', 'medium', 'low']),
                tool='nmap' if i % 5 == 0 else random.choice(['nessus', 'burp', 'zap'])
            )
            findings.append(finding)
        
        return findings


# Sample report files generator
def generate_sample_report_files(output_dir: str = "tests/fixtures/reports"):
    """Generate sample report files for testing"""
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate various report types
    generators = [
        ("sample-nmap.xml", ReportGenerator.generate_nmap_report(num_hosts=10)),
        ("sample-bandit.json", ReportGenerator.generate_bandit_report(num_findings=20)),
        ("sample-checkov.json", ReportGenerator.generate_checkov_report(num_findings=15)),
        ("sample-prowler.json", ReportGenerator.generate_prowler_v3_report(num_findings=25)),
        ("sample-findings.csv", ReportGenerator.generate_csv_report(num_findings=50))
    ]
    
    for filename, content in generators:
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Generated: {filepath}")
    
    # Generate test files for concurrent testing
    for i in range(5):
        filepath = os.path.join(output_dir, f"test-report-{i}.xml")
        with open(filepath, 'w') as f:
            f.write(ReportGenerator.generate_nmap_report(num_hosts=5))
        print(f"Generated: {filepath}")


if __name__ == "__main__":
    # Generate sample files when run directly
    generate_sample_report_files()