/**
 * Reports Store - Manage security reports with pagination and upload queue
 * Handles report listing, uploads, processing status, and optimistic updates
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { apiClient } from '@/services/api';

export interface Report {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  tool?: string;
  uploadedAt: string;
  processedAt?: string;
  findingsCount?: number;
  size?: number;
  error?: string;
}

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  reportId?: string;
}

interface ReportsState {
  // Reports data
  reports: Report[];
  currentPage: number;
  totalPages: number;
  totalReports: number;
  pageSize: number;
  
  // Upload queue
  uploadQueue: UploadItem[];
  
  // Loading states
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  
  // Actions
  fetchReports: (page?: number, pageSize?: number) => Promise<void>;
  refreshReports: () => Promise<void>;
  getReport: (id: string) => Promise<Report | null>;
  deleteReport: (id: string) => Promise<void>;
  
  // Upload actions
  addToUploadQueue: (item: UploadItem) => void;
  updateUploadProgress: (id: string, progress: number) => void;
  updateUploadStatus: (id: string, status: UploadItem['status'], error?: string) => void;
  removeFromUploadQueue: (id: string) => void;
  clearCompletedUploads: () => void;
  
  // Optimistic updates
  addReportOptimistically: (report: Report) => void;
  confirmOptimisticUpdate: (tempId: string, actualReport: Report) => void;
  revertOptimisticUpdate: (tempId: string) => void;
  
  // Utility
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  reset: () => void;
}

export const useReportsStore = create<ReportsState>()(
  immer((set, get) => ({
    // Initial state
    reports: [],
    currentPage: 1,
    totalPages: 0,
    totalReports: 0,
    pageSize: 20,
    uploadQueue: [],
    isLoading: false,
    isUploading: false,
    error: null,

    // Actions
    fetchReports: async (page, pageSize) => {
      const currentPageSize = pageSize || get().pageSize;
      const currentPage = page || get().currentPage;
      
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const response = await apiClient.get('/reports', {
          params: {
            page: currentPage,
            limit: currentPageSize
          }
        });

        set((state) => {
          state.reports = response.data.items;
          state.currentPage = response.data.page;
          state.totalPages = response.data.pages;
          state.totalReports = response.data.total;
          state.isLoading = false;
        });
      } catch (error: any) {
        set((state) => {
          state.error = error.message || 'Failed to fetch reports';
          state.isLoading = false;
        });
      }
    },

    refreshReports: async () => {
      const { currentPage, pageSize } = get();
      await get().fetchReports(currentPage, pageSize);
    },

    getReport: async (id) => {
      try {
        const response = await apiClient.get(`/reports/${id}`);
        return response.data;
      } catch (error) {
        console.error('Failed to fetch report:', error);
        return null;
      }
    },

    deleteReport: async (id) => {
      // Optimistically remove from list
      set((state) => {
        const index = state.reports.findIndex(r => r.id === id);
        if (index !== -1) {
          state.reports.splice(index, 1);
          state.totalReports -= 1;
        }
      });

      try {
        await apiClient.delete(`/reports/${id}`);
        
        // Refresh if we're now under the page size
        const { reports, pageSize } = get();
        if (reports.length < pageSize) {
          await get().refreshReports();
        }
      } catch (error: any) {
        // Revert on error
        await get().refreshReports();
        throw error;
      }
    },

    // Upload queue management
    addToUploadQueue: (item) => set((state) => {
      state.uploadQueue.push(item);
      if (!state.isUploading) {
        state.isUploading = true;
      }
    }),

    updateUploadProgress: (id, progress) => set((state) => {
      const item = state.uploadQueue.find(i => i.id === id);
      if (item) {
        item.progress = progress;
        item.status = 'uploading';
      }
    }),

    updateUploadStatus: (id, status, error) => set((state) => {
      const item = state.uploadQueue.find(i => i.id === id);
      if (item) {
        item.status = status;
        if (error) {
          item.error = error;
        }
      }
      
      // Check if all uploads are done
      const hasActiveUploads = state.uploadQueue.some(
        i => i.status === 'pending' || i.status === 'uploading'
      );
      if (!hasActiveUploads) {
        state.isUploading = false;
      }
    }),

    removeFromUploadQueue: (id) => set((state) => {
      const index = state.uploadQueue.findIndex(i => i.id === id);
      if (index !== -1) {
        state.uploadQueue.splice(index, 1);
      }
    }),

    clearCompletedUploads: () => set((state) => {
      state.uploadQueue = state.uploadQueue.filter(
        i => i.status === 'pending' || i.status === 'uploading'
      );
    }),

    // Optimistic updates
    addReportOptimistically: (report) => set((state) => {
      // Add to beginning of list
      state.reports.unshift(report);
      state.totalReports += 1;
      
      // Trim to page size
      if (state.reports.length > state.pageSize) {
        state.reports.pop();
      }
    }),

    confirmOptimisticUpdate: (tempId, actualReport) => set((state) => {
      const index = state.reports.findIndex(r => r.id === tempId);
      if (index !== -1) {
        state.reports[index] = actualReport;
      }
    }),

    revertOptimisticUpdate: (tempId) => set((state) => {
      const index = state.reports.findIndex(r => r.id === tempId);
      if (index !== -1) {
        state.reports.splice(index, 1);
        state.totalReports -= 1;
      }
    }),

    // Utility
    setCurrentPage: (page) => set((state) => {
      state.currentPage = page;
    }),

    setPageSize: (size) => set((state) => {
      state.pageSize = size;
    }),

    reset: () => set((state) => {
      state.reports = [];
      state.currentPage = 1;
      state.totalPages = 0;
      state.totalReports = 0;
      state.uploadQueue = [];
      state.isLoading = false;
      state.isUploading = false;
      state.error = null;
    })
  }))
);

// Selectors
export const selectReports = (state: ReportsState) => state.reports;
export const selectPagination = (state: ReportsState) => ({
  currentPage: state.currentPage,
  totalPages: state.totalPages,
  totalReports: state.totalReports,
  pageSize: state.pageSize
});
export const selectUploadQueue = (state: ReportsState) => state.uploadQueue;
export const selectActiveUploads = (state: ReportsState) => 
  state.uploadQueue.filter(i => i.status === 'uploading');
export const selectIsUploading = (state: ReportsState) => state.isUploading;