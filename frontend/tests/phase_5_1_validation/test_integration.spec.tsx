/**
 * Phase 5.1 Validation Tests - Frontend-Backend Integration
 * Tests WebSocket communication, error handling, and API integration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WS from 'vitest-websocket-mock';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';

// Import services
import { WebSocketService } from '@/services/websocket';
import { EnhancedApiClient } from '@/services/api-enhanced';
import { GlobalErrorBoundary } from '@/utils/errorBoundary';
import { SyncManager, UploadWebSocketBridge } from '@/services/sync-manager';

// Mock stores
vi.mock('@/stores/appStore', () => ({
  useAppStore: {
    getState: () => ({
      addNotification: vi.fn(),
      setLoading: vi.fn()
    }),
    setState: vi.fn()
  }
}));

// Mock Electron IPC
const mockIPC = {
  errorReporting: {
    logError: vi.fn(),
    logWarning: vi.fn(),
    sendCrashReport: vi.fn()
  }
};
(global as any).window = { ...window, ...mockIPC };

// Custom WebSocket mock
class WS {
  static mocks: Map<string, WS> = new Map();
  
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  private messages: any[] = [];
  private connected = false;
  
  constructor(url: string) {
    this.url = url;
    WS.mocks.set(url, this);
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.connected = true;
      this.onopen?.(new Event('open'));
    }, 10);
  }
  
  send(data: string | ArrayBuffer): void {
    this.messages.push(data);
  }
  
  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    this.connected = false;
    this.onclose?.(new CloseEvent('close', { code, reason }));
    WS.mocks.delete(this.url);
  }
  
  mockReceive(data: any): void {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.onmessage?.(new MessageEvent('message', { data: message }));
  }
  
  static clean(): void {
    WS.mocks.clear();
  }
}

(global as any).WebSocket = WS;

describe('WebSocket Service', () => {
  let wsService: WebSocketService;
  let mockWS: WS;
  
  beforeEach(() => {
    WS.clean();
    wsService = new WebSocketService({
      url: 'ws://localhost:8000/ws/test-client',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000
    });
  });
  
  afterEach(() => {
    wsService.disconnect();
    WS.clean();
  });
  
  describe('Connection Management', () => {
    it('should establish connection with handshake', async () => {
      const onConnect = vi.fn();
      wsService.on('connected', onConnect);
      
      await wsService.connect();
      mockWS = WS.mocks.get('ws://localhost:8000/ws/test-client')!;
      
      // Send handshake
      mockWS.mockReceive({
        type: 'connection.established',
        data: { sessionId: 'test-session' }
      });
      
      await waitFor(() => {
        expect(onConnect).toHaveBeenCalled();
        expect(wsService.isConnected).toBe(true);
      });
    });
    
    it('should handle exponential backoff on reconnection', async () => {
      vi.spyOn(wsService, 'scheduleReconnect');
      
      await wsService.connect();
      mockWS = WS.mocks.get('ws://localhost:8000/ws/test-client')!;
      
      // Simulate disconnect
      mockWS.close(1006);
      
      await waitFor(() => {
        expect(wsService.scheduleReconnect).toHaveBeenCalled();
        expect(wsService.reconnectInterval).toBe(100);
      });
    });
    
    it('should queue messages when disconnected', async () => {
      // Don't connect yet
      wsService.send({ type: 'test.message', data: { id: 1 } });
      wsService.send({ type: 'test.message', data: { id: 2 } });
      
      expect(wsService.messageQueueLength).toBe(2);
      
      // Now connect
      await wsService.connect();
      mockWS = WS.mocks.get('ws://localhost:8000/ws/test-client')!;
      
      // Should flush queue
      await waitFor(() => {
        expect(mockWS['messages']).toHaveLength(2);
      });
    });
    
    it('should maintain heartbeat', async () => {
      vi.useFakeTimers();
      
      await wsService.connect();
      mockWS = WS.mocks.get('ws://localhost:8000/ws/test-client')!;
      
      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(1000);
      
      await waitFor(() => {
        const sentMessages = mockWS['messages'];
        const pingMessage = sentMessages.find(msg => {
          const parsed = JSON.parse(msg);
          return parsed.type === 'ping';
        });
        expect(pingMessage).toBeDefined();
      });
      
      vi.useRealTimers();
    });
  });
  
  describe('Event Handling', () => {
    it('should handle typed events', async () => {
      const handlers = {
        onProgress: vi.fn(),
        onFindingCreated: vi.fn(),
        onNotification: vi.fn()
      };
      
      wsService.on('report.progress', handlers.onProgress);
      wsService.on('finding.created', handlers.onFindingCreated);
      wsService.on('system.notification', handlers.onNotification);
      
      await wsService.connect();
      mockWS = WS.mocks.get('ws://localhost:8000/ws/test-client')!;
      
      // Send different event types
      mockWS.mockReceive({
        type: 'report.progress',
        data: { reportId: '123', progress: 50, stage: 'parsing' }
      });
      
      mockWS.mockReceive({
        type: 'finding.created',
        data: { id: 'finding-1', title: 'New Finding', severity: 'high' }
      });
      
      mockWS.mockReceive({
        type: 'system.notification',
        data: { level: 'info', message: 'Processing complete' }
      });
      
      await waitFor(() => {
        expect(handlers.onProgress).toHaveBeenCalledWith({
          reportId: '123',
          progress: 50,
          stage: 'parsing'
        });
        expect(handlers.onFindingCreated).toHaveBeenCalledWith({
          id: 'finding-1',
          title: 'New Finding',
          severity: 'high'
        });
        expect(handlers.onNotification).toHaveBeenCalledWith({
          level: 'info',
          message: 'Processing complete'
        });
      });
    });
    
    it('should support request/response pattern', async () => {
      await wsService.connect();
      mockWS = WS.mocks.get('ws://localhost:8000/ws/test-client')!;
      
      // Send request with correlation ID
      const responsePromise = wsService.request({
        type: 'report.details',
        data: { reportId: '123' }
      });
      
      // Get the sent message
      await waitFor(() => {
        expect(mockWS['messages']).toHaveLength(1);
      });
      
      const sentMessage = JSON.parse(mockWS['messages'][0]);
      
      // Server responds with correlation ID
      mockWS.mockReceive({
        type: 'response',
        correlationId: sentMessage.correlationId,
        data: { report: { id: '123', name: 'Test Report' } }
      });
      
      const result = await responsePromise;
      expect(result).toEqual({
        report: { id: '123', name: 'Test Report' }
      });
    });
  });
  
  describe('Error Handling', () => {
    it('should handle malformed messages', async () => {
      const onError = vi.fn();
      wsService.on('error', onError);
      
      await wsService.connect();
      mockWS = WS.mocks.get('ws://localhost:8000/ws/test-client')!;
      
      // Send invalid JSON
      mockWS.onmessage?.(new MessageEvent('message', { data: 'invalid-json{' }));
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'parse_error'
          })
        );
      });
    });
    
    it('should handle rate limiting', async () => {
      await wsService.connect();
      mockWS = WS.mocks.get('ws://localhost:8000/ws/test-client')!;
      
      mockWS.mockReceive({
        type: 'error',
        error: 'rate_limit_exceeded',
        details: { retryAfter: 60 }
      });
      
      expect(wsService.rateLimited).toBe(true);
      
      // Should not send while rate limited
      wsService.send({ type: 'test' });
      expect(mockWS['messages']).toHaveLength(0);
    });
  });
});

describe('API Client Integration', () => {
  const server = setupServer(
    rest.get('/api/reports/:id', (req, res, ctx) => {
      return res(ctx.json({
        id: req.params.id,
        name: 'Test Report'
      }));
    }),
    rest.post('/api/reports/upload', (req, res, ctx) => {
      return res(
        ctx.delay(100),
        ctx.json({ id: 'new-report' })
      );
    })
  );
  
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  
  it('should fall back to WebSocket on API failure', async () => {
    server.use(
      rest.get('/api/reports/:id', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );
    
    const wsService = new WebSocketService({
      url: 'ws://localhost:8000/ws/client'
    });
    
    await wsService.connect();
    
    const apiClient = new EnhancedApiClient({
      baseURL: 'http://localhost:8000',
      wsService,
      wsFailover: true
    });
    
    // Mock WebSocket response
    wsService.on('api.request', async (data) => {
      // Simulate response
      setTimeout(() => {
        const mockWS = WS.mocks.get('ws://localhost:8000/ws/client')!;
        mockWS.mockReceive({
          type: 'response',
          correlationId: data.correlationId,
          data: { id: '123', name: 'WebSocket Report' }
        });
      }, 10);
    });
    
    const result = await apiClient.get('/reports/123', { wsFailover: true });
    expect(result).toEqual({ id: '123', name: 'WebSocket Report' });
  });
  
  it('should handle offline queue', async () => {
    const apiClient = new EnhancedApiClient({
      baseURL: 'http://localhost:8000',
      enableOfflineQueue: true
    });
    
    // Simulate offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });
    
    server.use(
      rest.post('/api/reports', (req, res) => 
        res.networkError('Failed to connect')
      )
    );
    
    // This should queue the request
    const request = apiClient.post('/reports', {
      name: 'Offline Report'
    });
    
    expect(apiClient.getStats().offlineQueueSize).toBeGreaterThan(0);
    
    // Come back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    // Trigger online event
    window.dispatchEvent(new Event('online'));
    
    // Wait for queue processing
    await waitFor(() => {
      expect(apiClient.getStats().offlineQueueSize).toBe(0);
    });
  });
  
  it('should deduplicate requests', async () => {
    let callCount = 0;
    server.use(
      rest.get('/api/reports', (req, res, ctx) => {
        callCount++;
        return res(ctx.json({ reports: [] }));
      })
    );
    
    const apiClient = new EnhancedApiClient({
      baseURL: 'http://localhost:8000',
      deduplication: true
    });
    
    // Make same request multiple times
    const promises = [
      apiClient.get('/reports'),
      apiClient.get('/reports'),
      apiClient.get('/reports')
    ];
    
    await Promise.all(promises);
    
    // Should only make one actual request
    expect(callCount).toBe(1);
  });
});

describe('Error Boundary', () => {
  it('should catch and report React errors', () => {
    const ThrowError = () => {
      throw new Error('Test React Error');
    };
    
    const onError = vi.fn();
    
    render(
      <GlobalErrorBoundary onError={onError}>
        <ThrowError />
      </GlobalErrorBoundary>
    );
    
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Test React Error'
      }),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
    
    // Should report to IPC
    expect(mockIPC.errorReporting.logError).toHaveBeenCalled();
  });
  
  it('should provide recovery options', async () => {
    const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) throw new Error('Recoverable Error');
      return <div>Recovered!</div>;
    };
    
    const { rerender } = render(
      <GlobalErrorBoundary>
        <ThrowError shouldThrow={true} />
      </GlobalErrorBoundary>
    );
    
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    
    // Click retry
    const retryButton = screen.getByText(/Try Again/i);
    
    rerender(
      <GlobalErrorBoundary>
        <ThrowError shouldThrow={false} />
      </GlobalErrorBoundary>
    );
    
    await userEvent.click(retryButton);
    
    await waitFor(() => {
      expect(screen.getByText('Recovered!')).toBeInTheDocument();
    });
  });
  
  it('should classify error types', () => {
    const NetworkError = () => {
      const error = new Error('Network request failed');
      (error as any).code = 'NETWORK_ERROR';
      throw error;
    };
    
    render(
      <GlobalErrorBoundary>
        <NetworkError />
      </GlobalErrorBoundary>
    );
    
    expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
    expect(screen.getByText(/Check your connection/i)).toBeInTheDocument();
  });
});

describe('Real-time Synchronization', () => {
  it('should sync state changes', async () => {
    const wsService = new WebSocketService({
      url: 'ws://localhost:8000/ws/client'
    });
    
    await wsService.connect();
    
    const syncManager = new SyncManager(wsService);
    
    // Queue an operation
    syncManager.queueOperation({
      type: 'update',
      path: '/findings/0',
      data: { title: 'Updated Finding' }
    });
    
    // Should send sync operation
    const mockWS = WS.mocks.get('ws://localhost:8000/ws/client')!;
    
    await waitFor(() => {
      const sentMessages = mockWS['messages'];
      expect(sentMessages).toHaveLength(1);
      
      const message = JSON.parse(sentMessages[0]);
      expect(message.type).toBe('sync.operation');
      expect(message.data.type).toBe('update');
    });
  });
  
  it('should handle file upload progress over WebSocket', async () => {
    const wsService = new WebSocketService({
      url: 'ws://localhost:8000/ws/client'
    });
    
    await wsService.connect();
    
    const onProgress = vi.fn();
    const uploadBridge = new UploadWebSocketBridge({
      wsService,
      onProgress
    });
    
    const file = new File(['test content'], 'test.json', { type: 'application/json' });
    
    // Start upload
    const uploadPromise = uploadBridge.upload(file);
    
    const mockWS = WS.mocks.get('ws://localhost:8000/ws/client')!;
    
    // Simulate progress updates
    for (let i = 0; i <= 100; i += 25) {
      mockWS.mockReceive({
        type: 'upload.progress',
        data: { fileId: file.name, progress: i }
      });
    }
    
    // Complete upload
    mockWS.mockReceive({
      type: 'upload.complete',
      data: { fileId: file.name, result: 'success' }
    });
    
    await uploadPromise;
    
    expect(onProgress).toHaveBeenCalledWith(0);
    expect(onProgress).toHaveBeenCalledWith(25);
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(75);
    expect(onProgress).toHaveBeenCalledWith(100);
  });
});

describe('Performance', () => {
  it('should handle high message throughput', async () => {
    const wsService = new WebSocketService({
      url: 'ws://localhost:8000/ws/client'
    });
    
    await wsService.connect();
    
    const received: any[] = [];
    wsService.on('test.message', (data) => received.push(data));
    
    const mockWS = WS.mocks.get('ws://localhost:8000/ws/client')!;
    const startTime = performance.now();
    
    // Send 1000 messages
    for (let i = 0; i < 1000; i++) {
      mockWS.mockReceive({
        type: 'test.message',
        data: { index: i }
      });
    }
    
    await waitFor(() => {
      expect(received).toHaveLength(1000);
    });
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should process in under 1 second
  });
  
  it('should efficiently queue messages', () => {
    const wsService = new WebSocketService({
      url: 'ws://localhost:8000/ws/client',
      messageQueueSize: 10000
    });
    
    const startTime = performance.now();
    
    // Queue many messages while disconnected
    for (let i = 0; i < 10000; i++) {
      wsService.send({ type: 'test', data: { i } });
    }
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(100); // Should queue quickly
    expect(wsService.messageQueueLength).toBe(10000);
  });
});