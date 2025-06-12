/**
 * App Store - Global application state management
 * Handles loading states, errors, notifications, preferences, and theme
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  timestamp: number;
}

export interface Preferences {
  autoUpload?: boolean;
  defaultView?: 'grid' | 'list';
  showSidebar?: boolean;
  confirmBeforeDelete?: boolean;
  maxConcurrentUploads?: number;
  autoExpandFindings?: boolean;
  exportFormat?: 'csv' | 'json' | 'pdf';
}

interface AppState {
  // Application state
  loading: boolean;
  error: string | null;
  notifications: Notification[];
  
  // Backend connection
  backendConnected: boolean;
  backendVersion: string | null;
  
  // User preferences
  preferences: Preferences;
  theme: 'light' | 'dark' | 'system';
  
  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  setBackendConnected: (connected: boolean) => void;
  setBackendVersion: (version: string | null) => void;
  
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  setPreferences: (preferences: Preferences) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Utility
  reset: () => void;
}

const DEFAULT_PREFERENCES: Preferences = {
  autoUpload: false,
  defaultView: 'list',
  showSidebar: true,
  confirmBeforeDelete: true,
  maxConcurrentUploads: 3,
  autoExpandFindings: false,
  exportFormat: 'csv'
};

export const useAppStore = create<AppState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      loading: false,
      error: null,
      notifications: [],
      backendConnected: false,
      backendVersion: null,
      preferences: DEFAULT_PREFERENCES,
      theme: 'system',

      // Actions
      setLoading: (loading) => set((state) => {
        state.loading = loading;
      }),

      setError: (error) => set((state) => {
        state.error = error;
        
        // Auto-add error notification
        if (error) {
          const notification: Notification = {
            id: `error-${Date.now()}`,
            type: 'error',
            message: error,
            timestamp: Date.now()
          };
          state.notifications.push(notification);
        }
      }),

      addNotification: (notification) => set((state) => {
        const newNotification: Notification = {
          ...notification,
          id: `notification-${Date.now()}-${Math.random()}`,
          timestamp: Date.now()
        };
        
        state.notifications.push(newNotification);
        
        // Auto-remove after duration
        if (notification.duration) {
          setTimeout(() => {
            get().removeNotification(newNotification.id);
          }, notification.duration);
        }
      }),

      removeNotification: (id) => set((state) => {
        const index = state.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
          state.notifications.splice(index, 1);
        }
      }),

      clearNotifications: () => set((state) => {
        state.notifications = [];
      }),

      setBackendConnected: (connected) => set((state) => {
        state.backendConnected = connected;
        
        // Add notification on connection change
        if (connected) {
          get().addNotification({
            type: 'success',
            message: 'Connected to backend',
            duration: 3000
          });
        } else {
          get().addNotification({
            type: 'warning',
            message: 'Disconnected from backend',
            duration: 5000
          });
        }
      }),

      setBackendVersion: (version) => set((state) => {
        state.backendVersion = version;
      }),

      setPreference: (key, value) => set((state) => {
        state.preferences[key] = value;
      }),

      setPreferences: (preferences) => set((state) => {
        state.preferences = { ...state.preferences, ...preferences };
      }),

      setTheme: (theme) => set((state) => {
        state.theme = theme;
        
        // Apply theme to document
        if (typeof window !== 'undefined') {
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');
          
          if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
              ? 'dark' 
              : 'light';
            root.classList.add(systemTheme);
          } else {
            root.classList.add(theme);
          }
        }
      }),

      reset: () => set((state) => {
        state.loading = false;
        state.error = null;
        state.notifications = [];
        state.backendConnected = false;
        state.backendVersion = null;
        state.preferences = DEFAULT_PREFERENCES;
        state.theme = 'system';
      })
    })),
    {
      name: 'scanalyzer-app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
        theme: state.theme
      })
    }
  )
);

// Selectors
export const selectIsLoading = (state: AppState) => state.loading;
export const selectError = (state: AppState) => state.error;
export const selectNotifications = (state: AppState) => state.notifications;
export const selectBackendStatus = (state: AppState) => ({
  connected: state.backendConnected,
  version: state.backendVersion
});
export const selectPreferences = (state: AppState) => state.preferences;
export const selectTheme = (state: AppState) => state.theme;