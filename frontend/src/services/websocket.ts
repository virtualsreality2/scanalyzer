/**
 * WebSocket Service - Real-time communication with backend
 * Handles connection lifecycle, message queuing, and type-safe events
 */
import ReconnectingWebSocket from 'reconnecting-websocket';
import { v4 as uuidv4 } from 'uuid';

// WebSocket configuration
export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  messageQueueSize?: number;
}

// Event type definitions with discriminated unions
export type WebSocketEvent =
  | { type: 'report.progress'; data: { reportId: string; progress: number; stage: string } }
  | { type: 'finding.created'; data: Finding }
  | { type: 'finding.updated'; data: { id: string; changes: Partial<Finding> } }
  | { type: 'system.notification'; data: { level: 'info' | 'warning' | 'error'; message: string } }
  | { type: 'connection.status'; data: { connected: boolean; latency: number } }
  | { type: 'bulk.progress'; data: { operation: string; current: number; total: number } }
  | { type: 'connection.established'; data: { sessionId: string } }
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; error: string; details?: any }
  | { type: 'response'; correlationId: string; data: any };

// Base message interface
interface WebSocketMessage {
  type: string;
  data?: any;
  correlationId?: string;
  timestamp?: number;
}

// Finding interface
interface Finding {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  tool: string;
  category?: string;
  created_at: string;
}

// Error types
export class WebSocketError extends Error {
  constructor(
    public type: 'connection_failed' | 'parse_error' | 'timeout' | 'rate_limit',
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

// WebSocket service class
export class WebSocketService {
  private ws: ReconnectingWebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<void> | null = null;
  private connectionResolver: (() => void) | null = null;
  
  public isConnected = false;
  public reconnectAttempts = 0;
  public latency = 0;
  public rateLimited = false;
  public metrics = {
    messagesReceived: 0,
    messagesSent: 0,
    bytesReceived: 0,
    bytesSent: 0,
    errors: 0
  };

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval || 1000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      messageQueueSize: config.messageQueueSize || 1000
    };
  }

  // Connect to WebSocket server
  async connect(): Promise<void> {
    if (this.ws && this.isConnected) {
      return Promise.resolve();
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve) => {
      this.connectionResolver = resolve;
    });

    this.ws = new ReconnectingWebSocket(this.config.url, [], {
      WebSocket: WebSocket,
      maxReconnectionDelay: Math.min(this.config.reconnectInterval * Math.pow(2, 10), 30000),
      minReconnectionDelay: this.config.reconnectInterval,
      reconnectionDelayGrowFactor: 2,
      maxRetries: this.config.maxReconnectAttempts,
      debug: false
    });

    this.setupEventHandlers();
    return this.connectionPromise;
  }

  // Setup WebSocket event handlers
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.rateLimited = false;
      
      // Resolve connection promise
      if (this.connectionResolver) {
        this.connectionResolver();
        this.connectionResolver = null;
        this.connectionPromise = null;
      }

      // Start heartbeat
      this.startHeartbeat();

      // Flush message queue
      this.flushMessageQueue();

      // Emit connection event
      this.emit('connected', { timestamp: Date.now() });
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.stopHeartbeat();

      // Emit disconnection event
      this.emit('disconnected', { code: event.code, reason: event.reason });

      // Handle reconnection
      if (event.code !== 1000) { // Not a normal closure
        this.reconnectAttempts++;
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      this.metrics.errors++;
      this.emit('error', new WebSocketError('connection_failed', 'WebSocket connection failed', error));
    };

    this.ws.onmessage = (event) => {
      this.metrics.messagesReceived++;
      this.metrics.bytesReceived += event.data.length;

      try {
        const message = JSON.parse(event.data) as WebSocketEvent;
        this.handleMessage(message);
      } catch (error) {
        this.emit('error', new WebSocketError('parse_error', 'Failed to parse message', error));
      }
    };
  }

  // Handle incoming messages
  private handleMessage(message: WebSocketEvent): void {
    // Handle special message types
    switch (message.type) {
      case 'pong':
        this.handlePong(message);
        return;
      case 'connection.established':
        this.emit('connection.established', message.data);
        return;
      case 'error':
        if (message.error === 'rate_limit_exceeded') {
          this.rateLimited = true;
          setTimeout(() => { this.rateLimited = false; }, 60000);
        }
        this.emit('error', new WebSocketError('rate_limit', message.error, message.details));
        return;
      case 'response':
        this.handleResponse(message);
        return;
    }

    // Emit typed events
    this.emit(message.type, message.data);
  }

  // Handle pong messages for latency calculation
  private handlePong(message: WebSocketEvent): void {
    if (message.type === 'pong' && message.timestamp) {
      this.latency = Date.now() - message.timestamp;
      this.emit('connection.status', { connected: true, latency: this.latency });
    }
  }

  // Handle response messages for request/response pattern
  private handleResponse(message: WebSocketEvent): void {
    if (message.type === 'response' && message.correlationId) {
      const pending = this.pendingRequests.get(message.correlationId);
      if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve(message.data);
        this.pendingRequests.delete(message.correlationId);
      }
    }
  }

  // Start heartbeat mechanism
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, this.config.heartbeatInterval);
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Schedule reconnection with exponential backoff
  scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('error', new WebSocketError(
        'connection_failed',
        `Failed to reconnect after ${this.config.maxReconnectAttempts} attempts`
      ));
      return;
    }

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000
    );

    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  // Send message
  send(message: WebSocketMessage): void {
    if (this.rateLimited) {
      this.emit('error', new WebSocketError('rate_limit', 'Rate limited, please try again later'));
      return;
    }

    // Queue message if not connected
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.queueMessage(message);
      return;
    }

    try {
      const data = JSON.stringify(message);
      this.ws.send(data);
      this.metrics.messagesSent++;
      this.metrics.bytesSent += data.length;
    } catch (error) {
      this.queueMessage(message);
      this.emit('error', new WebSocketError('connection_failed', 'Failed to send message', error));
    }
  }

  // Send binary data
  sendBinary(data: ArrayBuffer | Uint8Array): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketError('connection_failed', 'WebSocket is not connected');
    }

    this.ws.send(data);
    this.metrics.messagesSent++;
    this.metrics.bytesSent += data.byteLength;
  }

  // Request/response pattern with correlation ID
  async request(message: Omit<WebSocketMessage, 'correlationId'>, timeout = 30000): Promise<any> {
    const correlationId = uuidv4();
    const messageWithId = { ...message, correlationId };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new WebSocketError('timeout', `Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(correlationId, { resolve, reject, timeout: timeoutHandle });
      this.send(messageWithId);
    });
  }

  // Queue message for later sending
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.config.messageQueueSize) {
      this.messageQueue.shift(); // Remove oldest message
    }
    this.messageQueue.push(message);
  }

  // Flush message queue
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  // Event emitter methods
  on<T extends WebSocketEvent['type']>(
    event: T,
    handler: (data: Extract<WebSocketEvent, { type: T }>['data']) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  // Emit event
  private emit(event: string, data?: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // Get reconnect interval for current attempt
  get reconnectInterval(): number {
    return Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000
    );
  }

  // Get message queue length
  get messageQueueLength(): number {
    return this.messageQueue.length;
  }

  // Disconnect from WebSocket
  disconnect(): void {
    this.isConnected = false;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    // Clear pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new WebSocketError('connection_failed', 'WebSocket disconnected'));
    });
    this.pendingRequests.clear();

    // Clear message queue
    this.messageQueue = [];

    // Clear listeners
    this.listeners.clear();

    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  // Get connection state
  getState(): {
    connected: boolean;
    reconnectAttempts: number;
    latency: number;
    queueLength: number;
    metrics: typeof this.metrics;
  } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      latency: this.latency,
      queueLength: this.messageQueue.length,
      metrics: { ...this.metrics }
    };
  }
}

// Singleton instance
let instance: WebSocketService | null = null;

// Get or create WebSocket service instance
export function getWebSocketService(config?: WebSocketConfig): WebSocketService {
  if (!instance && config) {
    instance = new WebSocketService(config);
  }
  if (!instance) {
    throw new Error('WebSocket service not initialized. Provide config on first call.');
  }
  return instance;
}

// Export types
export type { WebSocketMessage, Finding };