import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './common/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Log to error reporting service if available
    if (window.electronAPI?.app) {
      window.electronAPI.app.logError?.({
        error: error.toString(),
        errorInfo: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background-primary p-4">
          <div className="w-full max-w-md">
            <div className="rounded-lg border border-border-primary bg-surface-primary p-6 shadow-lg">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-semantic-error bg-opacity-10">
                  <AlertTriangle className="h-6 w-6 text-semantic-error" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-text-primary">
                    Something went wrong
                  </h1>
                  <p className="text-sm text-text-secondary">
                    An unexpected error occurred
                  </p>
                </div>
              </div>

              {this.state.error && (
                <div className="mb-6 rounded-md bg-surface-secondary p-4">
                  <p className="mb-2 text-sm font-medium text-text-primary">
                    Error Details:
                  </p>
                  <p className="font-mono text-xs text-text-secondary">
                    {this.state.error.toString()}
                  </p>
                  
                  {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-text-tertiary hover:text-text-secondary">
                        Component Stack
                      </summary>
                      <pre className="mt-2 overflow-auto text-xs text-text-tertiary">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={this.handleReset}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Try Again
                </Button>
                <Button
                  variant="secondary"
                  onClick={this.handleReload}
                >
                  Reload App
                </Button>
                <Button
                  variant="ghost"
                  onClick={this.handleGoHome}
                  leftIcon={<Home className="h-4 w-4" />}
                >
                  Home
                </Button>
              </div>
            </div>

            <p className="mt-4 text-center text-sm text-text-tertiary">
              If this problem persists, please contact support
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);
    
    // Log to error reporting service
    if (window.electronAPI?.app) {
      window.electronAPI.app.logError?.({
        error: error.toString(),
        errorInfo: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Re-throw to be caught by ErrorBoundary
    throw error;
  };
}