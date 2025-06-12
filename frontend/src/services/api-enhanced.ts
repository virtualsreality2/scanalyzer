/**
 * Enhanced API Service - Axios client with WebSocket fallback and offline support
 * Handles request/response transformation, error handling, and resilience patterns
 */
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketService } from './websocket';
import { useAppStore } from '../stores/appStore';

// Configuration
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  wsService?: WebSocketService;
  enableOfflineQueue?: boolean;
  deduplication?: boolean;
  wsFailover?: boolean;
}

// Queue interfaces
interface QueuedRequest {
  id: string;
  config: AxiosRequestConfig;
  timestamp: number;
  retries: number;
}

// Circuit breaker states
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

// Circuit breaker for failing endpoints
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: CircuitState = CircuitState.CLOSED;
  
  constructor(
    private threshold = 5,
    private timeout = 60000, // 1 minute
    private halfOpenRequests = 3
  ) {}

  canRequest(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailTime > this.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenRequests = 3;
      } else {
        return false;
      }
    }
    
    if (this.state === CircuitState.HALF_OPEN) {
      return this.halfOpenRequests > 0;
    }
    
    return false;
  }

  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenRequests--;
      if (this.halfOpenRequests === 0) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
      }
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// Enhanced offline queue with IndexedDB persistence
class PersistentOfflineQueue {
  private memoryQueue: Map<string, QueuedRequest> = new Map();
  private dbName = 'scanalyzer-offline-queue';
  private storeName = 'requests';
  private db: IDBDatabase | null = null;
  private processing = false;

  async init(): Promise<void> {
    if (!('indexedDB' in window)) return;

    const request = indexedDB.open(this.dbName, 1);
    
    request.onerror = () => {
      console.error('Failed to open IndexedDB');
    };

    request.onsuccess = () => {
      this.db = request.result;
      this.loadFromDB();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(this.storeName)) {
        db.createObjectStore(this.storeName, { keyPath: 'id' });
      }
    };
  }

  private async loadFromDB(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const requests = request.result as QueuedRequest[];
      requests.forEach(req => {
        this.memoryQueue.set(req.id, req);
      });
    };
  }

  async add(config: AxiosRequestConfig): Promise<string> {
    const id = uuidv4();
    const request: QueuedRequest = {
      id,
      config,
      timestamp: Date.now(),
      retries: 0
    };

    this.memoryQueue.set(id, request);

    // Persist to IndexedDB
    if (this.db) {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.add(request);
    }

    return id;
  }

  async remove(id: string): Promise<void> {
    this.memoryQueue.delete(id);

    if (this.db) {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      store.delete(id);
    }
  }

  async process(apiClient: AxiosInstance): Promise<void> {
    if (this.processing || this.memoryQueue.size === 0) return;
    
    this.processing = true;
    const processed: string[] = [];
    
    for (const [id, request] of this.memoryQueue) {
      try {
        await apiClient.request(request.config);
        processed.push(id);
      } catch (error) {
        request.retries++;
        if (request.retries >= 3) {
          processed.push(id);
        }
      }
    }

    // Remove processed requests
    for (const id of processed) {
      await this.remove(id);
    }
    
    this.processing = false;
  }

  get size(): number {
    return this.memoryQueue.size;
  }
}

// Request deduplication
class RequestDeduplicator {
  private pending: Map<string, Promise<any>> = new Map();

  getKey(config: AxiosRequestConfig): string {
    return `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
  }

  async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing;
    }

    const promise = requestFn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }
}

// Enhanced API Client
export class EnhancedApiClient {
  private instance: AxiosInstance;
  private wsService?: WebSocketService;
  private offlineQueue: PersistentOfflineQueue;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private deduplicator: RequestDeduplicator;
  private config: ApiClientConfig;
  private isOnline: boolean = navigator.onLine;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.offlineQueue = new PersistentOfflineQueue();
    this.deduplicator = new RequestDeduplicator();
    this.wsService = config.wsService;

    // Initialize offline queue
    this.offlineQueue.init();

    // Create axios instance
    this.instance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
    this.setupNetworkListeners();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Add auth token
        const token = localStorage.getItem('auth_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID
        if (!config.headers['X-Request-ID']) {
          config.headers['X-Request-ID'] = uuidv4();
        }

        // Add idempotency key for mutations
        if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
          if (!config.headers['X-Idempotency-Key']) {
            config.headers['X-Idempotency-Key'] = uuidv4();
          }
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor with retry logic
    this.instance.interceptors.response.use(
      (response) => {
        // Record success for circuit breaker
        const endpoint = this.getEndpointKey(response.config);
        this.getCircuitBreaker(endpoint).recordSuccess();

        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig & { _retry?: number };
        const endpoint = this.getEndpointKey(config);
        const circuitBreaker = this.getCircuitBreaker(endpoint);

        // Check circuit breaker
        if (!circuitBreaker.canRequest()) {
          return Promise.reject(new Error(`Circuit breaker open for ${endpoint}`));
        }

        // Record failure
        circuitBreaker.recordFailure();

        // Handle network errors
        if (!error.response && error.code === 'ECONNABORTED') {
          // Timeout - try WebSocket fallback if enabled
          if (this.config.wsFailover && this.wsService?.isConnected) {
            return this.fallbackToWebSocket(config);
          }
        }

        // Retry logic
        config._retry = config._retry || 0;
        const shouldRetry = 
          config._retry < 3 && 
          (!error.response || error.response.status >= 500);

        if (shouldRetry) {
          config._retry++;
          
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, config._retry), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return this.instance.request(config);
        }

        // Queue for offline retry if network error
        if (!navigator.onLine && this.config.enableOfflineQueue) {
          const id = await this.offlineQueue.add(config);
          useAppStore.getState().addNotification({
            id,
            type: 'info',
            title: 'Request Queued',
            message: 'Request will be sent when connection is restored'
          });
        }

        return Promise.reject(error);
      }
    );
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
      useAppStore.getState().addNotification({
        id: 'network-online',
        type: 'success',
        title: 'Connection Restored',
        message: 'You are back online'
      });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      useAppStore.getState().addNotification({
        id: 'network-offline',
        type: 'warning',
        title: 'Connection Lost',
        message: 'You are working offline'
      });
    });
  }

  private getEndpointKey(config: AxiosRequestConfig): string {
    const url = new URL(config.url || '', config.baseURL || '');
    return `${config.method}:${url.pathname}`;
  }

  private getCircuitBreaker(endpoint: string): CircuitBreaker {
    if (!this.circuitBreakers.has(endpoint)) {
      this.circuitBreakers.set(endpoint, new CircuitBreaker());
    }
    return this.circuitBreakers.get(endpoint)!;
  }

  private async fallbackToWebSocket(config: AxiosRequestConfig): Promise<any> {
    if (!this.wsService) {
      throw new Error('WebSocket service not available');
    }

    const response = await this.wsService.request({
      type: 'api.request',
      data: {
        method: config.method,
        path: config.url,
        params: config.params,
        data: config.data
      }
    });

    return { data: response, status: 200, config };
  }

  async processOfflineQueue(): Promise<void> {
    if (!this.isOnline) return;
    await this.offlineQueue.process(this.instance);
  }

  // HTTP methods with deduplication
  async get<T = any>(url: string, config?: AxiosRequestConfig & { wsFailover?: boolean }): Promise<T> {
    if (this.config.deduplication) {
      const key = this.deduplicator.getKey({ ...config, method: 'get', url });
      return this.deduplicator.deduplicate(key, () => 
        this.instance.get<T>(url, config).then(res => res.data)
      );
    }
    
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  // Batch request support
  async batch(requests: Array<{ method: string; url: string; data?: any }>): Promise<any[]> {
    const promises = requests.map(req => {
      switch (req.method.toLowerCase()) {
        case 'get':
          return this.get(req.url);
        case 'post':
          return this.post(req.url, req.data);
        case 'put':
          return this.put(req.url, req.data);
        case 'patch':
          return this.patch(req.url, req.data);
        case 'delete':
          return this.delete(req.url);
        default:
          throw new Error(`Unsupported method: ${req.method}`);
      }
    });

    return Promise.all(promises);
  }

  // Upload with progress
  async upload(
    url: string,
    file: File,
    onProgress?: (progress: number) => void,
    config?: AxiosRequestConfig
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    return this.instance.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        const progress = progressEvent.total
          ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
          : 0;
        onProgress?.(progress);
      }
    });
  }

  // Get circuit breaker states
  getCircuitBreakerStates(): Record<string, string> {
    const states: Record<string, string> = {};
    this.circuitBreakers.forEach((breaker, endpoint) => {
      states[endpoint] = breaker.getState();
    });
    return states;
  }

  // Get API client stats
  getStats() {
    return {
      offlineQueueSize: this.offlineQueue.size,
      circuitBreakers: this.getCircuitBreakerStates(),
      isOnline: this.isOnline
    };
  }
}

// Create singleton instance
let apiClientInstance: EnhancedApiClient | null = null;

export function getApiClient(config?: ApiClientConfig): EnhancedApiClient {
  if (!apiClientInstance && config) {
    apiClientInstance = new EnhancedApiClient(config);
  }
  if (!apiClientInstance) {
    throw new Error('API client not initialized. Provide config on first call.');
  }
  return apiClientInstance;
}

export default EnhancedApiClient;