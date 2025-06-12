"""
Performance benchmarks for parsers
"""
import pytest
import time
import psutil
import os
from pathlib import Path
from app.parsers.bandit.bandit_parser import BanditParser
from app.parsers.checkov.checkov_parser import CheckovParser
import json
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed


class TestParserPerformance:
    """Test parser performance with large files"""
    
    @pytest.fixture
    def large_bandit_report(self, tmp_path):
        """Generate large Bandit report (100MB)"""
        report_path = tmp_path / "large_bandit.json"
        
        # Generate report with 50k findings
        report_data = {
            "results": [
                {
                    "code": f"import pickle\npickle.loads(data_{i})",
                    "col_offset": 0,
                    "confidence": ["HIGH", "MEDIUM", "LOW"][i % 3],
                    "filename": f"file_{i % 1000}.py",
                    "issue_confidence": ["HIGH", "MEDIUM", "LOW"][i % 3],
                    "issue_severity": ["HIGH", "MEDIUM", "LOW"][i % 3],
                    "issue_text": f"Security issue {i}: " + "A" * 1000,  # Long description
                    "line_number": i % 1000,
                    "line_range": [i % 1000, (i % 1000) + 5],
                    "more_info": f"https://bandit.readthedocs.io/en/latest/issue_{i}",
                    "severity": ["HIGH", "MEDIUM", "LOW"][i % 3],
                    "test_id": f"B{i % 999:03d}",
                    "test_name": f"security_test_{i}"
                }
                for i in range(50000)
            ],
            "metrics": {
                "_totals": {
                    "CONFIDENCE.HIGH": 16667,
                    "CONFIDENCE.LOW": 16667,
                    "CONFIDENCE.MEDIUM": 16666,
                    "SEVERITY.HIGH": 16667,
                    "SEVERITY.LOW": 16667,
                    "SEVERITY.MEDIUM": 16666
                }
            }
        }
        
        with open(report_path, 'w') as f:
            json.dump(report_data, f)
        
        return report_path
    
    @pytest.mark.benchmark(group="parser")
    def test_large_file_parsing(self, benchmark, large_bandit_report):
        """Benchmark parsing of large report files"""
        parser = BanditParser()
        
        def parse_large_file():
            return parser.parse(large_bandit_report)
        
        # Run benchmark
        result = benchmark(parse_large_file)
        
        # Verify results
        assert len(result) == 50000
        
        # Performance assertions
        stats = benchmark.stats
        assert stats['mean'] < 10.0, "Parsing should complete in < 10 seconds"
        assert stats['stddev'] < 2.0, "Performance should be consistent"
    
    def test_memory_usage(self, large_bandit_report):
        """Profile memory usage during parsing"""
        parser = BanditParser()
        
        # Get initial memory
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Parse file
        findings = parser.parse(large_bandit_report)
        
        # Get peak memory
        peak_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = peak_memory - initial_memory
        
        # Memory assertions
        assert memory_increase < 500, f"Memory increase {memory_increase}MB exceeds 500MB limit"
        
        # Check for memory leaks by parsing multiple times
        for _ in range(3):
            findings = parser.parse(large_bandit_report)
            
        final_memory = process.memory_info().rss / 1024 / 1024
        leak_check = final_memory - peak_memory
        
        assert leak_check < 50, f"Potential memory leak: {leak_check}MB increase after multiple parses"
    
    def test_concurrent_parsing(self, tmp_path):
        """Test multiple simultaneous parse operations"""
        # Create different report types
        reports = []
        
        # Bandit reports
        for i in range(5):
            report_path = tmp_path / f"bandit_{i}.json"
            data = {
                "results": [
                    {
                        "code": f"code_{j}",
                        "confidence": "HIGH",
                        "filename": f"file_{j}.py",
                        "issue_text": f"Issue {j}",
                        "line_number": j,
                        "severity": "HIGH",
                        "test_id": f"B{j:03d}",
                        "test_name": f"test_{j}"
                    }
                    for j in range(1000)
                ]
            }
            with open(report_path, 'w') as f:
                json.dump(data, f)
            reports.append(("bandit", report_path))
        
        # Checkov reports
        for i in range(5):
            report_path = tmp_path / f"checkov_{i}.json"
            data = {
                "check_type": "terraform",
                "results": {
                    "failed_checks": [
                        {
                            "check_id": f"CKV_AWS_{j}",
                            "check_name": f"Check {j}",
                            "file_path": f"/file_{j}.tf",
                            "resource": f"resource_{j}",
                            "check_result": {"result": "FAILED"}
                        }
                        for j in range(1000)
                    ]
                }
            }
            with open(report_path, 'w') as f:
                json.dump(data, f)
            reports.append(("checkov", report_path))
        
        # Parse concurrently
        start_time = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            
            for parser_type, report_path in reports:
                if parser_type == "bandit":
                    parser = BanditParser()
                else:
                    parser = CheckovParser()
                
                future = executor.submit(parser.parse, report_path)
                futures.append(future)
            
            # Collect results
            for future in as_completed(futures):
                try:
                    findings = future.result(timeout=30)
                    results.append(len(findings))
                except Exception as e:
                    pytest.fail(f"Concurrent parsing failed: {e}")
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Performance assertions
        assert len(results) == 10, "All parsers should complete"
        assert all(r == 1000 for r in results), "All parsers should find 1000 findings"
        assert total_time < 5.0, f"Concurrent parsing took {total_time}s, should be < 5s"
    
    @pytest.mark.benchmark(group="parser-streaming")
    def test_streaming_parse_performance(self, benchmark, tmp_path):
        """Test streaming parser performance for very large files"""
        # Create a 500MB JSON file
        huge_report = tmp_path / "huge_report.json"
        
        with open(huge_report, 'w') as f:
            f.write('{"results": [')
            
            for i in range(100000):
                finding = {
                    "code": f"x = {i}" + "A" * 100,
                    "confidence": "HIGH",
                    "filename": f"file_{i}.py",
                    "issue_text": "B" * 2000,
                    "line_number": i,
                    "severity": "HIGH",
                    "test_id": f"B{i % 999:03d}",
                    "test_name": f"test_{i}"
                }
                
                if i > 0:
                    f.write(',')
                json.dump(finding, f)
            
            f.write(']}')
        
        # Test streaming parse
        parser = BanditParser()
        
        def stream_parse():
            # Simulate streaming by reading in chunks
            findings = []
            chunk_size = 1024 * 1024  # 1MB chunks
            
            with open(huge_report, 'r') as f:
                # This is simplified - real streaming would parse incrementally
                content = f.read()
                data = json.loads(content)
                findings = parser._parse_json(data)
            
            return findings
        
        result = benchmark(stream_parse)
        
        # Should handle large files efficiently
        stats = benchmark.stats
        assert stats['mean'] < 20.0, "Streaming parse should complete in < 20 seconds"