import { renderHook, act } from '@testing-library/react';
import { useFindingsStore } from '@/stores/findingsStore';
import { Finding } from '@/types/finding';

function generateMockFindings(count: number): Finding[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `finding-${i}`,
    title: `Finding ${i}: ${['SQL Injection', 'XSS', 'RCE', 'LFI'][i % 4]}`,
    description: `Description for finding ${i}`,
    severity: ['low', 'medium', 'high', 'critical'][i % 4] as Finding['severity'],
    confidence: ['low', 'medium', 'high'][i % 3] as Finding['confidence'],
    tool: ['nmap', 'nessus', 'burp', 'zap'][i % 4],
    location: `https://example.com/path/${i}`,
    cvss_score: (i % 10) + Math.random(),
    references: [`https://cve.mitre.org/CVE-2021-${40000 + i}`],
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    report_id: `report-${Math.floor(i / 100)}`
  }));
}

describe('Findings Store', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useFindingsStore.getState();
    store.reset();
  });

  it('should handle complex filtering', () => {
    const { result } = renderHook(() => useFindingsStore());
    
    // Add test data
    act(() => {
      result.current.setFindings(generateMockFindings(1000));
    });
    
    // Apply multiple filters
    act(() => {
      result.current.setFilters({
        severity: ['high', 'critical'],
        dateRange: { 
          start: new Date(Date.now() - 7 * 86400000).toISOString(), 
          end: new Date().toISOString() 
        },
        tools: ['nmap', 'nessus'],
        search: 'SQL injection'
      });
    });
    
    const filtered = result.current.getFilteredFindings();
    
    // Verify filter results
    expect(filtered.length).toBeLessThan(100);
    expect(filtered.every(f => 
      ['high', 'critical'].includes(f.severity) &&
      ['nmap', 'nessus'].includes(f.tool) &&
      f.title.toLowerCase().includes('sql injection')
    )).toBe(true);
    
    // Verify date range filter
    const oneWeekAgo = Date.now() - 7 * 86400000;
    expect(filtered.every(f => 
      new Date(f.created_at).getTime() >= oneWeekAgo
    )).toBe(true);
  });

  it('should handle sorting', () => {
    const { result } = renderHook(() => useFindingsStore());
    
    const findings = generateMockFindings(100);
    act(() => {
      result.current.setFindings(findings);
    });
    
    // Sort by severity (descending)
    act(() => {
      result.current.setSorting({
        column: 'severity',
        direction: 'desc'
      });
    });
    
    const sorted = result.current.getSortedFindings();
    
    // Verify sort order: critical > high > medium > low
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    let lastIndex = 0;
    
    sorted.forEach(finding => {
      const currentIndex = severityOrder.indexOf(finding.severity);
      expect(currentIndex).toBeGreaterThanOrEqual(lastIndex);
      if (currentIndex > lastIndex) lastIndex = currentIndex;
    });
    
    // Sort by CVSS score (ascending)
    act(() => {
      result.current.setSorting({
        column: 'cvss_score',
        direction: 'asc'
      });
    });
    
    const cvsSorted = result.current.getSortedFindings();
    for (let i = 1; i < cvsSorted.length; i++) {
      if (cvsSorted[i].cvss_score && cvsSorted[i-1].cvss_score) {
        expect(cvsSorted[i].cvss_score).toBeGreaterThanOrEqual(cvsSorted[i-1].cvss_score!);
      }
    }
  });

  it('should handle selection state', () => {
    const { result } = renderHook(() => useFindingsStore());
    
    const findings = generateMockFindings(10);
    act(() => {
      result.current.setFindings(findings);
    });
    
    // Select individual findings
    act(() => {
      result.current.toggleSelection('finding-0');
      result.current.toggleSelection('finding-2');
      result.current.toggleSelection('finding-5');
    });
    
    expect(result.current.selectedIds).toEqual(['finding-0', 'finding-2', 'finding-5']);
    
    // Toggle off
    act(() => {
      result.current.toggleSelection('finding-2');
    });
    
    expect(result.current.selectedIds).toEqual(['finding-0', 'finding-5']);
    
    // Select all
    act(() => {
      result.current.selectAll();
    });
    
    expect(result.current.selectedIds).toHaveLength(10);
    
    // Clear selection
    act(() => {
      result.current.clearSelection();
    });
    
    expect(result.current.selectedIds).toHaveLength(0);
  });

  it('should calculate statistics correctly', () => {
    const { result } = renderHook(() => useFindingsStore());
    
    const findings = generateMockFindings(1000);
    act(() => {
      result.current.setFindings(findings);
    });
    
    const stats = result.current.getStatistics();
    
    // Verify total count
    expect(stats.total).toBe(1000);
    
    // Verify severity distribution
    expect(stats.bySeverity.critical).toBe(250);
    expect(stats.bySeverity.high).toBe(250);
    expect(stats.bySeverity.medium).toBe(250);
    expect(stats.bySeverity.low).toBe(250);
    
    // Verify tool distribution
    expect(stats.byTool.nmap).toBe(250);
    expect(stats.byTool.nessus).toBe(250);
    expect(stats.byTool.burp).toBe(250);
    expect(stats.byTool.zap).toBe(250);
    
    // Verify average CVSS score
    const avgCvss = findings
      .filter(f => f.cvss_score)
      .reduce((sum, f) => sum + f.cvss_score!, 0) / 
      findings.filter(f => f.cvss_score).length;
    
    expect(stats.averageCvss).toBeCloseTo(avgCvss, 1);
  });

  it('should handle pagination', () => {
    const { result } = renderHook(() => useFindingsStore());
    
    const findings = generateMockFindings(100);
    act(() => {
      result.current.setFindings(findings);
      result.current.setPagination({ page: 1, pageSize: 20 });
    });
    
    const paginated = result.current.getPaginatedFindings();
    
    expect(paginated.items).toHaveLength(20);
    expect(paginated.total).toBe(100);
    expect(paginated.pages).toBe(5);
    expect(paginated.items[0].id).toBe('finding-0');
    expect(paginated.items[19].id).toBe('finding-19');
    
    // Go to page 3
    act(() => {
      result.current.setPagination({ page: 3, pageSize: 20 });
    });
    
    const page3 = result.current.getPaginatedFindings();
    expect(page3.items[0].id).toBe('finding-40');
    expect(page3.items[19].id).toBe('finding-59');
  });

  it('should handle bulk operations', () => {
    const { result } = renderHook(() => useFindingsStore());
    
    const findings = generateMockFindings(100);
    act(() => {
      result.current.setFindings(findings);
    });
    
    // Bulk update status
    const idsToUpdate = ['finding-10', 'finding-20', 'finding-30'];
    act(() => {
      result.current.bulkUpdateStatus(idsToUpdate, 'resolved');
    });
    
    const updated = result.current.findings.filter(f => idsToUpdate.includes(f.id));
    expect(updated.every(f => f.status === 'resolved')).toBe(true);
    
    // Bulk delete
    act(() => {
      result.current.bulkDelete(idsToUpdate);
    });
    
    expect(result.current.findings).toHaveLength(97);
    expect(result.current.findings.find(f => f.id === 'finding-10')).toBeUndefined();
  });

  it('should persist filters in session storage', () => {
    const { result } = renderHook(() => useFindingsStore());
    
    const filters = {
      severity: ['high', 'critical'],
      tools: ['burp'],
      search: 'XSS'
    };
    
    act(() => {
      result.current.setFilters(filters);
    });
    
    // Simulate page reload
    const savedFilters = JSON.parse(
      sessionStorage.getItem('findings-filters') || '{}'
    );
    
    expect(savedFilters).toEqual(filters);
    
    // New store instance should load saved filters
    const { result: newResult } = renderHook(() => useFindingsStore());
    expect(newResult.current.filters).toEqual(filters);
  });

  it('should handle real-time updates', () => {
    const { result } = renderHook(() => useFindingsStore());
    
    const findings = generateMockFindings(50);
    act(() => {
      result.current.setFindings(findings);
    });
    
    // Simulate WebSocket update
    const newFinding: Finding = {
      id: 'finding-new',
      title: 'New Critical Finding',
      description: 'Just discovered',
      severity: 'critical',
      confidence: 'high',
      tool: 'realtime-scanner',
      location: 'https://example.com/new',
      created_at: new Date().toISOString(),
      report_id: 'report-1'
    };
    
    act(() => {
      result.current.addFinding(newFinding);
    });
    
    expect(result.current.findings).toHaveLength(51);
    expect(result.current.findings[0]).toEqual(newFinding); // Should be at top
    
    // Update existing finding
    act(() => {
      result.current.updateFinding('finding-10', {
        severity: 'critical',
        status: 'verified'
      });
    });
    
    const updatedFinding = result.current.findings.find(f => f.id === 'finding-10');
    expect(updatedFinding?.severity).toBe('critical');
    expect(updatedFinding?.status).toBe('verified');
  });
});