"""
Database query optimization tests
"""
import pytest
import time
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.models import Finding, Report
from datetime import datetime, timedelta
import random


class TestDatabasePerformance:
    """Test database query performance"""
    
    @pytest.fixture
    def large_dataset(self, db_session: Session):
        """Create large dataset for testing"""
        # Create 10 reports
        reports = []
        for i in range(10):
            report = Report(
                filename=f"report_{i}.xml",
                file_type=["nmap", "nessus", "burp", "zap"][i % 4],
                upload_date=datetime.utcnow() - timedelta(days=i),
                status="completed",
                total_findings=10000
            )
            reports.append(report)
        
        db_session.bulk_save_objects(reports)
        db_session.commit()
        
        # Get report IDs
        report_ids = db_session.query(Report.id).all()
        
        # Create 100k findings
        findings = []
        severities = ["critical", "high", "medium", "low", "info"]
        tools = ["nmap", "nessus", "burp", "zap", "metasploit"]
        
        for i in range(100000):
            finding = Finding(
                report_id=report_ids[i % 10].id,
                title=f"Finding {i}: {random.choice(['SQL Injection', 'XSS', 'RCE', 'LFI', 'XXE'])}",
                description=f"Description for finding {i}" + "A" * 500,
                severity=severities[i % 5],
                confidence=["high", "medium", "low"][i % 3],
                tool=tools[i % 5],
                location=f"https://example.com/path/{i}",
                cvss_score=round(random.uniform(0.0, 10.0), 1) if i % 2 == 0 else None,
                finding_hash=f"hash_{i}",
                created_at=datetime.utcnow() - timedelta(days=i % 30)
            )
            findings.append(finding)
            
            # Batch insert every 1000 findings
            if i % 1000 == 999:
                db_session.bulk_save_objects(findings)
                findings = []
        
        if findings:
            db_session.bulk_save_objects(findings)
        
        db_session.commit()
        
        return db_session
    
    def test_finding_query_performance(self, large_dataset: Session):
        """Test query performance with large datasets"""
        # Test 1: Simple filter query
        start_time = time.time()
        
        high_severity_findings = large_dataset.query(Finding).filter(
            Finding.severity == "high"
        ).limit(100).all()
        
        query_time = (time.time() - start_time) * 1000  # ms
        assert query_time < 100, f"Simple filter query took {query_time}ms, should be < 100ms"
        assert len(high_severity_findings) == 100
        
        # Test 2: Complex filter query
        start_time = time.time()
        
        complex_findings = large_dataset.query(Finding).filter(
            Finding.severity.in_(["high", "critical"]),
            Finding.created_at >= datetime.utcnow() - timedelta(days=7),
            Finding.tool == "burp",
            Finding.cvss_score >= 7.0
        ).limit(50).all()
        
        query_time = (time.time() - start_time) * 1000
        assert query_time < 100, f"Complex filter query took {query_time}ms, should be < 100ms"
        
        # Test 3: Full-text search
        start_time = time.time()
        
        search_results = large_dataset.query(Finding).filter(
            Finding.title.ilike("%SQL Injection%")
        ).limit(50).all()
        
        query_time = (time.time() - start_time) * 1000
        assert query_time < 200, f"Text search query took {query_time}ms, should be < 200ms"
        
        # Test 4: Aggregation query
        start_time = time.time()
        
        severity_counts = large_dataset.execute(text("""
            SELECT severity, COUNT(*) as count
            FROM findings
            GROUP BY severity
            ORDER BY count DESC
        """)).fetchall()
        
        query_time = (time.time() - start_time) * 1000
        assert query_time < 500, f"Aggregation query took {query_time}ms, should be < 500ms"
        assert len(severity_counts) == 5  # 5 severity levels
    
    def test_index_effectiveness(self, large_dataset: Session):
        """Verify database indexes are used"""
        # Get query execution plan
        explain_result = large_dataset.execute(text("""
            EXPLAIN ANALYZE
            SELECT * FROM findings
            WHERE severity = 'high'
            AND created_at >= :date
            LIMIT 100
        """), {"date": datetime.utcnow() - timedelta(days=7)}).fetchall()
        
        explain_text = str(explain_result)
        
        # Check for index usage (PostgreSQL specific)
        assert "Index Scan" in explain_text or "Bitmap Index Scan" in explain_text, \
            "Query should use indexes"
        assert "Seq Scan" not in explain_text or "rows=100" in explain_text, \
            "Should not use sequential scan for selective queries"
        
        # Test composite index usage
        explain_result = large_dataset.execute(text("""
            EXPLAIN ANALYZE
            SELECT * FROM findings
            WHERE report_id = :report_id
            AND severity = 'critical'
            ORDER BY created_at DESC
            LIMIT 50
        """), {"report_id": 1}).fetchall()
        
        explain_text = str(explain_result)
        assert "Index" in explain_text, "Should use composite index"
    
    def test_pagination_performance(self, large_dataset: Session):
        """Test pagination query performance"""
        page_size = 50
        
        # Test different page numbers
        for page in [1, 10, 100, 1000]:
            offset = (page - 1) * page_size
            
            start_time = time.time()
            
            findings = large_dataset.query(Finding).order_by(
                Finding.created_at.desc()
            ).offset(offset).limit(page_size).all()
            
            query_time = (time.time() - start_time) * 1000
            
            # Pagination should be consistently fast
            assert query_time < 100, \
                f"Pagination query for page {page} took {query_time}ms, should be < 100ms"
            assert len(findings) <= page_size
    
    def test_join_performance(self, large_dataset: Session):
        """Test join query performance"""
        start_time = time.time()
        
        # Join findings with reports
        results = large_dataset.query(
            Finding.id,
            Finding.title,
            Finding.severity,
            Report.filename,
            Report.file_type
        ).join(
            Report, Finding.report_id == Report.id
        ).filter(
            Finding.severity == "critical",
            Report.file_type == "nessus"
        ).limit(100).all()
        
        query_time = (time.time() - start_time) * 1000
        assert query_time < 150, f"Join query took {query_time}ms, should be < 150ms"
        
        # Test with aggregation
        start_time = time.time()
        
        report_stats = large_dataset.execute(text("""
            SELECT 
                r.id,
                r.filename,
                COUNT(f.id) as finding_count,
                AVG(f.cvss_score) as avg_cvss
            FROM reports r
            LEFT JOIN findings f ON r.id = f.report_id
            GROUP BY r.id, r.filename
            ORDER BY finding_count DESC
        """)).fetchall()
        
        query_time = (time.time() - start_time) * 1000
        assert query_time < 1000, f"Aggregation join query took {query_time}ms, should be < 1000ms"
        assert len(report_stats) == 10  # 10 reports
    
    def test_concurrent_query_performance(self, large_dataset: Session):
        """Test performance under concurrent load"""
        import threading
        import queue
        
        query_times = queue.Queue()
        
        def run_query(session: Session, query_id: int):
            start_time = time.time()
            
            # Different query types
            if query_id % 3 == 0:
                # Filter query
                session.query(Finding).filter(
                    Finding.severity == "high"
                ).limit(50).all()
            elif query_id % 3 == 1:
                # Search query
                session.query(Finding).filter(
                    Finding.title.ilike(f"%Finding {query_id}%")
                ).limit(10).all()
            else:
                # Aggregation
                session.execute(text("""
                    SELECT tool, COUNT(*) 
                    FROM findings 
                    WHERE created_at >= :date
                    GROUP BY tool
                """), {"date": datetime.utcnow() - timedelta(days=1)}).fetchall()
            
            query_time = (time.time() - start_time) * 1000
            query_times.put(query_time)
        
        # Run 20 concurrent queries
        threads = []
        for i in range(20):
            thread = threading.Thread(
                target=run_query,
                args=(large_dataset, i)
            )
            threads.append(thread)
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        # Analyze results
        times = []
        while not query_times.empty():
            times.append(query_times.get())
        
        avg_time = sum(times) / len(times)
        max_time = max(times)
        
        assert avg_time < 200, f"Average query time {avg_time}ms should be < 200ms"
        assert max_time < 500, f"Max query time {max_time}ms should be < 500ms"