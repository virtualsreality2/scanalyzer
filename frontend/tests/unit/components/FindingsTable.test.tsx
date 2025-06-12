import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsTable } from '@/components/findings/FindingsTable';
import { Finding } from '@/types/finding';
import { vi } from 'vitest';

// Mock data generator
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

describe('FindingsTable Component', () => {
  const mockFindings = generateMockFindings(1000);
  const mockOnSelect = vi.fn();
  const mockOnSort = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle 10k+ rows efficiently', async () => {
    const { container } = render(
      <FindingsTable 
        findings={generateMockFindings(10000)} 
        onSelect={mockOnSelect}
        onSort={mockOnSort}
      />
    );
    
    // Only visible rows should be rendered (virtualization)
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeLessThan(50); // Virtual scrolling window
    
    // Test smooth scrolling
    const scrollContainer = container.querySelector('[data-testid="virtual-scroller"]');
    expect(scrollContainer).toBeInTheDocument();
    
    // Scroll to middle
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 50000 } });
    
    // Wait for new rows to render
    await waitFor(() => {
      const middleRow = screen.getByText(/Finding 500/);
      expect(middleRow).toBeInTheDocument();
    });
    
    // Scroll to bottom
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 200000 } });
    
    await waitFor(() => {
      const bottomRow = screen.getByText(/Finding 999/);
      expect(bottomRow).toBeInTheDocument();
    });
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    
    render(
      <FindingsTable 
        findings={mockFindings.slice(0, 10)} 
        onSelect={mockOnSelect}
        onSort={mockOnSort}
      />
    );
    
    // Focus first row
    const firstRow = screen.getAllByRole('row')[1]; // Skip header
    firstRow.focus();
    expect(document.activeElement).toBe(firstRow);
    
    // Arrow down
    await user.keyboard('{ArrowDown}');
    const secondRow = screen.getAllByRole('row')[2];
    expect(document.activeElement).toBe(secondRow);
    
    // Arrow up
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(firstRow);
    
    // Space to select
    await user.keyboard(' ');
    expect(mockOnSelect).toHaveBeenCalledWith(['finding-0']);
    
    // Shift+Arrow down for range selection
    await user.keyboard('{Shift>}{ArrowDown}{ArrowDown}');
    await user.keyboard(' ');
    expect(mockOnSelect).toHaveBeenCalledWith(['finding-0', 'finding-1', 'finding-2']);
    
    // Ctrl+A to select all
    await user.keyboard('{Control>}a');
    expect(mockOnSelect).toHaveBeenCalledWith(
      mockFindings.slice(0, 10).map(f => f.id)
    );
  });

  it('should handle sorting correctly', async () => {
    const user = userEvent.setup();
    
    render(
      <FindingsTable 
        findings={mockFindings.slice(0, 5)} 
        onSelect={mockOnSelect}
        onSort={mockOnSort}
      />
    );
    
    // Click severity header
    const severityHeader = screen.getByRole('columnheader', { name: /severity/i });
    await user.click(severityHeader);
    
    expect(mockOnSort).toHaveBeenCalledWith({
      column: 'severity',
      direction: 'asc'
    });
    
    // Click again for descending
    await user.click(severityHeader);
    expect(mockOnSort).toHaveBeenCalledWith({
      column: 'severity',
      direction: 'desc'
    });
    
    // Click title header
    const titleHeader = screen.getByRole('columnheader', { name: /title/i });
    await user.click(titleHeader);
    
    expect(mockOnSort).toHaveBeenCalledWith({
      column: 'title',
      direction: 'asc'
    });
  });

  it('should display severity badges correctly', () => {
    render(
      <FindingsTable 
        findings={mockFindings.slice(0, 4)} 
        onSelect={mockOnSelect}
        onSort={mockOnSort}
      />
    );
    
    // Check severity badge colors
    const criticalBadge = screen.getByText('critical');
    expect(criticalBadge).toHaveClass('bg-red-500');
    
    const highBadge = screen.getByText('high');
    expect(highBadge).toHaveClass('bg-orange-500');
    
    const mediumBadge = screen.getByText('medium');
    expect(mediumBadge).toHaveClass('bg-yellow-500');
    
    const lowBadge = screen.getByText('low');
    expect(lowBadge).toHaveClass('bg-blue-500');
  });

  it('should handle bulk selection', async () => {
    const user = userEvent.setup();
    
    render(
      <FindingsTable 
        findings={mockFindings.slice(0, 10)} 
        onSelect={mockOnSelect}
        onSort={mockOnSort}
      />
    );
    
    // Select all checkbox
    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i });
    await user.click(selectAllCheckbox);
    
    expect(mockOnSelect).toHaveBeenCalledWith(
      mockFindings.slice(0, 10).map(f => f.id)
    );
    
    // Individual selection
    const firstRowCheckbox = within(screen.getAllByRole('row')[1])
      .getByRole('checkbox');
    await user.click(firstRowCheckbox);
    
    expect(mockOnSelect).toHaveBeenCalledWith(['finding-0']);
  });

  it('should show tooltips for long content', async () => {
    const user = userEvent.setup();
    
    const longTitleFinding = {
      ...mockFindings[0],
      title: 'This is a very long finding title that should be truncated and show a tooltip when hovered over'
    };
    
    render(
      <FindingsTable 
        findings={[longTitleFinding]} 
        onSelect={mockOnSelect}
        onSort={mockOnSort}
      />
    );
    
    const titleCell = screen.getByText(/This is a very long/);
    expect(titleCell).toHaveClass('truncate');
    
    // Hover to show tooltip
    await user.hover(titleCell);
    
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent(longTitleFinding.title);
    });
  });

  it('should handle empty state', () => {
    render(
      <FindingsTable 
        findings={[]} 
        onSelect={mockOnSelect}
        onSort={mockOnSort}
      />
    );
    
    expect(screen.getByText(/no findings found/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /empty state/i })).toBeInTheDocument();
  });

  it('should support column resizing', async () => {
    const user = userEvent.setup();
    
    const { container } = render(
      <FindingsTable 
        findings={mockFindings.slice(0, 5)} 
        onSelect={mockOnSelect}
        onSort={mockOnSort}
      />
    );
    
    // Find resize handle
    const resizeHandle = container.querySelector('[data-testid="resize-handle-severity"]');
    expect(resizeHandle).toBeInTheDocument();
    
    // Drag to resize
    await user.pointer([
      { keys: '[MouseLeft>]', target: resizeHandle! },
      { coords: { x: 100, y: 0 } },
      { keys: '[/MouseLeft]' }
    ]);
    
    // Check column width changed
    const severityColumn = screen.getByRole('columnheader', { name: /severity/i });
    expect(severityColumn).toHaveStyle({ width: '200px' });
  });

  it('should export selected findings', async () => {
    const user = userEvent.setup();
    const mockExport = vi.fn();
    
    render(
      <FindingsTable 
        findings={mockFindings.slice(0, 5)} 
        onSelect={mockOnSelect}
        onSort={mockOnSort}
        onExport={mockExport}
      />
    );
    
    // Select some findings
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // First finding
    await user.click(checkboxes[2]); // Second finding
    
    // Click export button
    const exportButton = screen.getByRole('button', { name: /export selected/i });
    await user.click(exportButton);
    
    expect(mockExport).toHaveBeenCalledWith(['finding-0', 'finding-1']);
  });
});