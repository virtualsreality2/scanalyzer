import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import App from '@/App';
import { vi } from 'vitest';

// Mock server setup
const server = setupServer(
  rest.post('/api/v1/reports/upload', async (req, res, ctx) => {
    // Simulate processing delay
    await ctx.delay(100);
    
    return res(ctx.json({
      id: 'report-123',
      status: 'processing',
      filename: 'test.xml',
      message: 'Report uploaded successfully'
    }));
  }),
  
  rest.get('/api/v1/reports/:id/status', async (req, res, ctx) => {
    const { id } = req.params;
    
    // Simulate processing states
    const timestamp = Date.now();
    if (timestamp % 3 === 0) {
      return res(ctx.json({
        id,
        status: 'processing',
        progress: 60
      }));
    }
    
    return res(ctx.json({
      id,
      status: 'completed',
      progress: 100,
      findings_count: 42
    }));
  }),
  
  rest.get('/api/v1/findings', async (req, res, ctx) => {
    return res(ctx.json({
      findings: Array.from({ length: 42 }, (_, i) => ({
        id: `finding-${i}`,
        title: `Finding ${i}`,
        severity: ['low', 'medium', 'high', 'critical'][i % 4],
        tool: 'test-scanner',
        created_at: new Date().toISOString()
      })),
      total: 42,
      page: 1,
      pages: 1
    }));
  })
);

// WebSocket mock
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

describe('Upload Flow Integration', () => {
  beforeAll(() => {
    server.listen();
    
    // Mock WebSocket
    global.WebSocket = vi.fn(() => mockWebSocket) as any;
  });
  
  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();
  });
  
  afterAll(() => {
    server.close();
  });

  it('should complete full upload workflow', async () => {
    const user = userEvent.setup();
    
    render(<App />);
    
    // Navigate to upload
    await user.click(screen.getByRole('link', { name: /upload report/i }));
    
    // Wait for upload page
    await waitFor(() => {
      expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
    });
    
    // Create test file
    const file = new File(
      ['<xml><test>Security scan results</test></xml>'], 
      'test-scan.xml',
      { type: 'text/xml' }
    );
    
    // Drag and drop file
    const dropzone = screen.getByTestId('file-dropzone');
    
    fireEvent.dragEnter(dropzone);
    expect(dropzone).toHaveClass('drag-over');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
        types: ['Files']
      }
    });
    
    // File should appear in list
    await waitFor(() => {
      expect(screen.getByText('test-scan.xml')).toBeInTheDocument();
    });
    
    // Upload button should be enabled
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    expect(uploadButton).not.toBeDisabled();
    
    // Click upload
    await user.click(uploadButton);
    
    // Progress should be shown
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
      expect(screen.getByText(/42 findings detected/i)).toBeInTheDocument();
    }, { timeout: 5000 });
    
    // View findings button should appear
    const viewFindingsButton = screen.getByRole('button', { name: /view findings/i });
    await user.click(viewFindingsButton);
    
    // Should navigate to findings page
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /findings/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Finding \d+/)).toHaveLength(42);
    });
  });

  it('should handle multiple file uploads', async () => {
    const user = userEvent.setup();
    
    render(<App />);
    
    await user.click(screen.getByRole('link', { name: /upload report/i }));
    
    // Create multiple files
    const files = [
      new File(['<xml>Report 1</xml>'], 'scan1.xml', { type: 'text/xml' }),
      new File(['{"results": []}'], 'scan2.json', { type: 'application/json' }),
      new File(['Report 3'], 'scan3.csv', { type: 'text/csv' })
    ];
    
    const dropzone = screen.getByTestId('file-dropzone');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files,
        types: ['Files']
      }
    });
    
    // All files should appear
    await waitFor(() => {
      expect(screen.getByText('scan1.xml')).toBeInTheDocument();
      expect(screen.getByText('scan2.json')).toBeInTheDocument();
      expect(screen.getByText('scan3.csv')).toBeInTheDocument();
    });
    
    // File count should be shown
    expect(screen.getByText(/3 files selected/i)).toBeInTheDocument();
    
    // Remove one file
    const removeButton = screen.getAllByRole('button', { name: /remove/i })[1];
    await user.click(removeButton);
    
    await waitFor(() => {
      expect(screen.queryByText('scan2.json')).not.toBeInTheDocument();
      expect(screen.getByText(/2 files selected/i)).toBeInTheDocument();
    });
  });

  it('should validate file types', async () => {
    const user = userEvent.setup();
    
    render(<App />);
    
    await user.click(screen.getByRole('link', { name: /upload report/i }));
    
    // Invalid file type
    const invalidFile = new File(['binary data'], 'image.png', { type: 'image/png' });
    
    const dropzone = screen.getByTestId('file-dropzone');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [invalidFile],
        types: ['Files']
      }
    });
    
    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
      expect(screen.getByText(/png files are not supported/i)).toBeInTheDocument();
    });
    
    // File should not be added to list
    expect(screen.queryByText('image.png')).not.toBeInTheDocument();
  });

  it('should handle upload errors gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock error response
    server.use(
      rest.post('/api/v1/reports/upload', (req, res, ctx) => {
        return res(
          ctx.status(413),
          ctx.json({ error: 'File too large. Maximum size is 100MB.' })
        );
      })
    );
    
    render(<App />);
    
    await user.click(screen.getByRole('link', { name: /upload report/i }));
    
    const file = new File(['Large file content'], 'large-scan.xml', { type: 'text/xml' });
    const dropzone = screen.getByTestId('file-dropzone');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
        types: ['Files']
      }
    });
    
    await user.click(screen.getByRole('button', { name: /upload/i }));
    
    // Error should be displayed
    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    });
    
    // Retry button should appear
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('should show real-time progress updates', async () => {
    const user = userEvent.setup();
    
    render(<App />);
    
    await user.click(screen.getByRole('link', { name: /upload report/i }));
    
    const file = new File(['<xml>Content</xml>'], 'realtime.xml', { type: 'text/xml' });
    const dropzone = screen.getByTestId('file-dropzone');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
        types: ['Files']
      }
    });
    
    await user.click(screen.getByRole('button', { name: /upload/i }));
    
    // Simulate WebSocket progress updates
    const wsListeners = mockWebSocket.addEventListener.mock.calls
      .filter(call => call[0] === 'message');
    
    const messageHandler = wsListeners[0]?.[1];
    
    // Send progress updates
    act(() => {
      messageHandler?.({
        data: JSON.stringify({
          type: 'upload_progress',
          data: { report_id: 'report-123', progress: 25 }
        })
      });
    });
    
    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '25');
    });
    
    // More progress
    act(() => {
      messageHandler?.({
        data: JSON.stringify({
          type: 'upload_progress',
          data: { report_id: 'report-123', progress: 75 }
        })
      });
    });
    
    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });
    
    // Completion
    act(() => {
      messageHandler?.({
        data: JSON.stringify({
          type: 'upload_complete',
          data: { 
            report_id: 'report-123', 
            findings_count: 42,
            status: 'completed' 
          }
        })
      });
    });
    
    await waitFor(() => {
      expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
    });
  });
});