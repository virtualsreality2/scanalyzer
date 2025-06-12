/**
 * Global Error Boundary - Catches and handles React errors
 * Provides error classification, reporting, and recovery options
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from '../components/ui/Card';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { clsx } from 'clsx';

// Error telemetry interface
export interface ErrorTelemetry {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
  errorBoundary?: string;
  errorBoundaryProps?: Record<string, any>;
  additionalData?: Record<string, any>;
  previousErrors: Array<{ message: string; timestamp: string }>;
  performanceMetrics?: {
    memory?: number;
    cpu?: number;
    loadTime?: number;
  };
}

// Serialized error for IPC
export interface SerializedError {
  message: string;
  stack?: string;
  code?: string;
  type?: string;
  timestamp: string;
}

// Error classification
export type ErrorType = 'network' | 'parsing' | 'runtime' | 'permission' | 'unknown';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorType: ErrorType;
  errorCount: number;
  previousErrors: Array<{ message: string; timestamp: string }>;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableReporting?: boolean;
  showDetails?: boolean;
  name?: string;
}

// Extend window interface for error reporting
declare global {
  interface Window {
    errorReporting?: {
      logError: (error: SerializedError) => void;
      logWarning: (warning: string) => void;
      sendCrashReport: (report: ErrorTelemetry) => Promise<void>;
    };
  }
}

export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private sessionId: string;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: 'unknown',
      errorCount: 0,
      previousErrors: []
    };

    this.sessionId = this.generateSessionId();
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const errorType = this.classifyError(error);
    
    // Update state with error details
    this.setState(prevState => ({
      errorInfo,
      errorType,
      errorCount: prevState.errorCount + 1,
      previousErrors: [
        ...prevState.previousErrors.slice(-4), // Keep last 5 errors
        { message: error.message, timestamp: new Date().toISOString() }
      ]
    }));

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Report error
    if (this.props.enableReporting !== false) {
      this.reportError(error, errorInfo);
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch') || stack.includes('axios')) {
      return 'network';
    }
    if (message.includes('json') || message.includes('parse') || message.includes('syntax')) {
      return 'parsing';
    }
    if (message.includes('permission') || message.includes('denied') || message.includes('unauthorized')) {
      return 'permission';
    }
    if (message.includes('runtime') || stack.includes('typeerror') || stack.includes('referenceerror')) {
      return 'runtime';
    }
    
    return 'unknown';
  }

  private async reportError(error: Error, errorInfo: ErrorInfo): Promise<void> {
    const telemetry: ErrorTelemetry = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId,
      errorBoundary: this.props.name || 'GlobalErrorBoundary',
      previousErrors: this.state.previousErrors,
      performanceMetrics: this.collectPerformanceMetrics()
    };

    // Report via IPC if available
    if (window.errorReporting) {
      const serializedError: SerializedError = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        type: this.state.errorType,
        timestamp: telemetry.timestamp
      };

      window.errorReporting.logError(serializedError);
      
      // Send full crash report for critical errors
      if (this.state.errorCount > 2 || this.state.errorType === 'runtime') {
        try {
          await window.errorReporting.sendCrashReport(telemetry);
        } catch (reportError) {
          console.error('Failed to send crash report:', reportError);
        }
      }
    }

    // Also send to backend if available
    try {
      await this.sendErrorToBackend(telemetry);
    } catch (sendError) {
      console.error('Failed to send error to backend:', sendError);
    }
  }

  private collectPerformanceMetrics(): ErrorTelemetry['performanceMetrics'] {
    const metrics: ErrorTelemetry['performanceMetrics'] = {};

    // Memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.memory = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    }

    // Page load time
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart;
    }

    return metrics;
  }

  private async sendErrorToBackend(telemetry: ErrorTelemetry): Promise<void> {
    // Implementation would send to your error tracking service
    // For now, we'll just log it
    console.log('Error telemetry:', telemetry);
  }

  private handleRetry = (): void => {
    this.retryCount++;
    
    if (this.retryCount <= this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    } else {
      window.errorReporting?.logWarning(
        `Max retry attempts (${this.maxRetries}) reached for error boundary`
      );
    }
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  private handleReportBug = (): void => {
    // Open bug report form or external issue tracker
    window.open('https://github.com/yourusername/scanalyzer/issues/new', '_blank');
  };

  private getErrorMessage(): string {
    const { errorType, error } = this.state;

    switch (errorType) {
      case 'network':
        return 'Network Error: Unable to connect to the server. Please check your internet connection.';
      case 'parsing':
        return 'Data Error: We encountered an issue processing the data. This might be due to corrupted or invalid data.';
      case 'permission':
        return 'Permission Error: You don\'t have permission to perform this action. Please contact your administrator.';
      case 'runtime':
        return 'Application Error: An unexpected error occurred. Our team has been notified.';
      default:
        return error?.message || 'An unexpected error occurred. Please try again.';
    }
  }

  private getRecoveryActions(): Array<{ label: string; icon: ReactNode; action: () => void }> {
    const { errorType } = this.state;
    const actions = [];

    // Always show retry (if under limit)
    if (this.retryCount < this.maxRetries) {
      actions.push({
        label: 'Try Again',
        icon: <RefreshCw size={16} />,
        action: this.handleRetry
      });
    }

    // Show specific actions based on error type
    if (errorType === 'network') {
      actions.push({
        label: 'Reload Page',
        icon: <RefreshCw size={16} />,
        action: this.handleReload
      });
    }

    // Always show home and report options
    actions.push(
      {
        label: 'Go to Home',
        icon: <Home size={16} />,
        action: this.handleGoHome
      },
      {
        label: 'Report Issue',
        icon: <Bug size={16} />,
        action: this.handleReportBug
      }
    );

    return actions;
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, errorInfo, errorType, errorCount } = this.state;
    const showDetails = this.props.showDetails || process.env.NODE_ENV === 'development';

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-2xl w-full">
          <div className="p-8">
            {/* Error Icon and Title */}
            <div className="flex items-center gap-4 mb-6">
              <div className={clsx(
                'p-3 rounded-full',
                errorType === 'network' && 'bg-yellow-100 text-yellow-600',
                errorType === 'permission' && 'bg-red-100 text-red-600',
                errorType === 'runtime' && 'bg-red-100 text-red-600',
                errorType === 'parsing' && 'bg-orange-100 text-orange-600',
                errorType === 'unknown' && 'bg-gray-100 text-gray-600'
              )}>
                <AlertCircle size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Something went wrong
                </h1>
                {errorCount > 1 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This error has occurred {errorCount} times
                  </p>
                )}
              </div>
            </div>

            {/* Error Message */}
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                {this.getErrorMessage()}
              </p>
            </div>

            {/* Recovery Actions */}
            <div className="flex flex-wrap gap-3 mb-6">
              {this.getRecoveryActions().map((action, index) => (
                <button
                  key={index}
                  onClick={action.action}
                  className={clsx(
                    'px-4 py-2 rounded-lg font-medium flex items-center gap-2',
                    'transition-colors duration-200',
                    index === 0
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  )}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>

            {/* Error Details (Development/Debug) */}
            {showDetails && error && (
              <details className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                  Error Details
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Error Type:
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-mono">
                      {errorType}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Message:
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-mono">
                      {error.message}
                    </p>
                  </div>
                  {error.stack && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Stack Trace:
                      </p>
                      <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-x-auto">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo?.componentStack && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Component Stack:
                      </p>
                      <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-x-auto">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </Card>
      </div>
    );
  }
}

// Specialized error boundary for specific components
export class ComponentErrorBoundary extends GlobalErrorBoundary {
  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Simpler UI for component-level errors
    return (
      <Card variant="bordered" className="p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-red-500" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Component Error
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {this.state.error?.message || 'This component encountered an error'}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ComponentErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ComponentErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}