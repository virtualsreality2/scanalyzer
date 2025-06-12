/**
 * API Service - Axios client with interceptors, retry logic, and type safety
 * Handles request/response transformation, error handling, and offline queue
 */
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Custom error class
export class ApiError extends Error {
  public code: string;
  public status?: number;
  public details?: any;
  public userMessage: string;

  constructor(message: string, code: string, status?: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.userMessage = this.getUserFriendlyMessage(code, message);
  }

  private getUserFriendlyMessage(code: string, defaultMessage: string): string {
    const messages: Record<string, string> = {
      'NETWORK_ERROR': 'Unable to connect to the server. Please check your internet connection.',
      'TIMEOUT': 'The request took too long. Please try again.',
      'INVALID_FILE_FORMAT': 'Invalid file format. Accepted formats: JSON, XML, PDF, DOCX, CSV, XLSX',
      'FILE_TOO_LARGE': 'File is too large. Maximum size is 100MB.',
      'UNAUTHORIZED': 'You need to log in to perform this action.',
      'FORBIDDEN': 'You don\'t have permission to perform this action.',
      'NOT_FOUND': 'The requested resource was not found.',
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'SERVER_ERROR': 'Something went wrong on our end. Please try again later.',
      'QUOTA_EXCEEDED': 'You have exceeded your quota. Please upgrade your plan.',
      'RATE_LIMITED': 'Too many requests. Please slow down.'
    };

    return messages[code] || defaultMessage;
  }
}

// Request queue for offline support
interface QueuedRequest {
  id: string;
  config: AxiosRequestConfig;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  private queue: Map<string, QueuedRequest> = new Map();
  private processing = false;

  add(config: AxiosRequestConfig): string {
    const id = uuidv4();
    this.queue.set(id, {
      id,
      config,
      timestamp: Date.now(),
      retries: 0
    });
    return id;
  }

  remove(id: string): void {
    this.queue.delete(id);
  }

  async process(apiClient: AxiosInstance): Promise<void> {
    if (this.processing || this.queue.size === 0) return;
    
    this.processing = true;
    
    for (const [id, request] of this.queue) {
      try {
        await apiClient.request(request.config);
        this.queue.delete(id);
      } catch (error) {
        request.retries++;
        if (request.retries >= 3) {
          this.queue.delete(id);
        }
      }
    }
    
    this.processing = false;
  }

  get size(): number {
    return this.queue.size;
  }
}

// Create axios instance with custom configuration
class ApiClient {
  private instance: AxiosInstance;
  public offlineQueue: OfflineQueue;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.offlineQueue = new OfflineQueue();
    
    // Create axios instance
    this.instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
    this.setupOnlineListener();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Add request ID
        config.headers['X-Request-ID'] = uuidv4();
        
        // Add timestamp
        config.headers['X-Request-Timestamp'] = Date.now().toString();
        
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response) => {
        // Log response time
        const requestTime = response.config.headers['X-Request-Timestamp'];
        if (requestTime) {
          const duration = Date.now() - parseInt(requestTime as string);
          console.debug(`API call to ${response.config.url} took ${duration}ms`);
        }
        
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        // Handle network errors
        if (!error.response) {
          if (!this.isOnline) {
            // Queue request for later
            if (originalRequest && originalRequest.method !== 'get') {
              this.offlineQueue.add(originalRequest);
            }
            throw new ApiError(
              'No internet connection',
              'NETWORK_ERROR'
            );
          }
          
          throw new ApiError(
            'Network error occurred',
            'NETWORK_ERROR'
          );
        }

        // Handle timeout
        if (error.code === 'ECONNABORTED') {
          throw new ApiError(
            'Request timeout',
            'TIMEOUT'
          );
        }

        // Handle 401 - Unauthorized
        if (error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          // Try to refresh token
          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await this.instance.post('/auth/refresh', {
                refresh_token: refreshToken
              });
              
              const { access_token } = response.data;
              localStorage.setItem('auth_token', access_token);
              
              // Retry original request
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return this.instance(originalRequest);
            }
          } catch (refreshError) {
            // Redirect to login
            window.location.href = '/login';
          }
        }

        // Handle other errors
        const status = error.response.status;
        const data = error.response.data as any;
        
        let code = 'SERVER_ERROR';
        if (status === 400) code = 'VALIDATION_ERROR';
        else if (status === 403) code = 'FORBIDDEN';
        else if (status === 404) code = 'NOT_FOUND';
        else if (status === 429) code = 'RATE_LIMITED';
        else if (status >= 500) code = 'SERVER_ERROR';
        
        throw new ApiError(
          data?.message || error.message,
          data?.error || code,
          status,
          data?.detail
        );
      }
    );

    // Add retry interceptor
    this.instance.interceptors.response.use(
      undefined,
      async (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig & { 
          retry?: { retries: number; delay?: number };
          _retryCount?: number;
        };
        
        if (!config || !config.retry) {
          return Promise.reject(error);
        }

        config._retryCount = config._retryCount || 0;
        
        if (config._retryCount >= config.retry.retries) {
          return Promise.reject(error);
        }

        config._retryCount++;
        
        const delay = config.retry.delay || 1000;
        await new Promise(resolve => setTimeout(resolve, delay * config._retryCount));
        
        return this.instance(config);
      }
    );
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      // Process queued requests
      this.offlineQueue.process(this.instance);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Public methods matching axios interface
  async get<T = any>(url: string, config?: AxiosRequestConfig) {
    return this.instance.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.post<T>(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.put<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.instance.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete<T>(url, config);
  }

  // Utility methods
  setAuthToken(token: string): void {
    localStorage.setItem('auth_token', token);
    this.instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    localStorage.removeItem('auth_token');
    delete this.instance.defaults.headers.common['Authorization'];
  }

  setBaseURL(url: string): void {
    this.instance.defaults.baseURL = url;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Type-safe API endpoints
export const api = {
  // Reports
  reports: {
    list: (params?: { page?: number; limit?: number }) => 
      apiClient.get('/reports', { params }),
    
    get: (id: string) => 
      apiClient.get(`/reports/${id}`),
    
    upload: (file: FormData, config?: AxiosRequestConfig) =>
      apiClient.post('/reports/upload', file, config),
    
    delete: (id: string) =>
      apiClient.delete(`/reports/${id}`),
    
    reprocess: (id: string) =>
      apiClient.post(`/reports/${id}/reprocess`)
  },
  
  // Findings
  findings: {
    list: (reportId: string, params?: any) =>
      apiClient.get(`/reports/${reportId}/findings`, { params }),
    
    export: (format: string, findingIds: string[]) =>
      apiClient.post('/findings/export', { format, finding_ids: findingIds }),
    
    bulkUpdate: (updates: any[]) =>
      apiClient.patch('/findings/bulk', { updates })
  },
  
  // Health
  health: {
    check: () => apiClient.get('/health'),
    backend: () => apiClient.get('/health/backend')
  }
};