import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

// Providers
import { ThemeProvider } from './components/common/theme';
import { ErrorBoundary } from './components/ErrorBoundary';

// Layout
import { AppShell } from './components/layout';

// Page components (to be created)
import { DashboardPage } from './pages/Dashboard';
import { ReportsPage } from './pages/Reports';
import { FindingsPage } from './pages/Findings';
import { UploadPage } from './pages/Upload';
import { HistoryPage } from './pages/History';
import { SettingsPage } from './pages/Settings';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultColorScheme="system">
          <BrowserRouter>
            <AppShell>
              <Routes>
                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                {/* Main routes */}
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/reports/:id" element={<ReportsPage />} />
                <Route path="/findings" element={<FindingsPage />} />
                <Route path="/findings/:id" element={<FindingsPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                
                {/* 404 fallback */}
                <Route
                  path="*"
                  element={
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <h1 className="text-2xl font-semibold text-text-primary">
                          404 - Page Not Found
                        </h1>
                        <p className="mt-2 text-text-secondary">
                          The page you're looking for doesn't exist.
                        </p>
                      </div>
                    </div>
                  }
                />
              </Routes>
            </AppShell>
          </BrowserRouter>

          {/* Global toast notifications */}
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--color-surface-primary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: '8px',
                fontSize: '14px',
              },
              success: {
                iconTheme: {
                  primary: 'var(--color-semantic-success)',
                  secondary: 'var(--color-surface-primary)',
                },
              },
              error: {
                iconTheme: {
                  primary: 'var(--color-semantic-error)',
                  secondary: 'var(--color-surface-primary)',
                },
              },
            }}
          />

          {/* React Query Devtools - only in development */}
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} position="bottom-left" />
          )}
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}