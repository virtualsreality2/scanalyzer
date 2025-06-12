/**
 * Findings Store - Manage security findings with virtual scrolling support
 * Handles filtering, sorting, selection, and export functionality
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface Finding {
  id: string;
  reportId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  resource?: string;
  tool: string;
  category?: string;
  remediation?: string;
  references?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface FindingFilters {
  severity?: string[];
  tool?: string[];
  category?: string[];
  reportId?: string;
  searchQuery?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ExportQueueItem {
  id: string;
  findingIds: string[];
  format: 'csv' | 'json' | 'pdf' | 'xlsx';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string;
  error?: string;
}

type SortField = 'severity' | 'title' | 'createdAt' | 'tool' | 'category';
type SortOrder = 'asc' | 'desc';

interface FindingsState {
  // Findings data
  findings: Finding[];
  totalFindings: number;
  
  // Filtering and sorting
  filters: FindingFilters;
  sortBy: SortField;
  sortOrder: SortOrder;
  
  // Selection
  selectedIds: Set<string>;
  
  // Export queue
  exportQueue: ExportQueueItem[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setFindings: (findings: Finding[]) => void;
  addFindings: (findings: Finding[]) => void;
  updateFinding: (id: string, updates: Partial<Finding>) => void;
  deleteFinding: (id: string) => void;
  
  // Filter actions
  setFilter: <K extends keyof FindingFilters>(key: K, value: FindingFilters[K]) => void;
  setFilters: (filters: FindingFilters) => void;
  clearFilters: () => void;
  
  // Sort actions
  setSortBy: (field: SortField) => void;
  setSortOrder: (order: SortOrder) => void;
  toggleSortOrder: () => void;
  
  // Selection actions
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  
  // Export actions
  addToExportQueue: (item: ExportQueueItem) => void;
  updateExportProgress: (id: string, progress: number) => void;
  updateExportStatus: (id: string, status: ExportQueueItem['status'], downloadUrl?: string, error?: string) => void;
  removeFromExportQueue: (id: string) => void;
  
  // Computed getters
  getFilteredFindings: () => Finding[];
  getSortedFindings: () => Finding[];
  getSelectedFindings: () => Finding[];
  
  // Utility
  reset: () => void;
}

// Severity order for sorting
const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

export const useFindingsStore = create<FindingsState>()(
  immer((set, get) => ({
    // Initial state
    findings: [],
    totalFindings: 0,
    filters: {},
    sortBy: 'severity',
    sortOrder: 'desc',
    selectedIds: new Set(),
    exportQueue: [],
    isLoading: false,
    error: null,

    // Actions
    setFindings: (findings) => set((state) => {
      state.findings = findings;
      state.totalFindings = findings.length;
    }),

    addFindings: (findings) => set((state) => {
      state.findings.push(...findings);
      state.totalFindings = state.findings.length;
    }),

    updateFinding: (id, updates) => set((state) => {
      const index = state.findings.findIndex(f => f.id === id);
      if (index !== -1) {
        state.findings[index] = { ...state.findings[index], ...updates };
      }
    }),

    deleteFinding: (id) => set((state) => {
      const index = state.findings.findIndex(f => f.id === id);
      if (index !== -1) {
        state.findings.splice(index, 1);
        state.totalFindings = state.findings.length;
        state.selectedIds.delete(id);
      }
    }),

    // Filter actions
    setFilter: (key, value) => set((state) => {
      if (value === undefined || value === null || 
          (Array.isArray(value) && value.length === 0)) {
        delete state.filters[key];
      } else {
        state.filters[key] = value;
      }
    }),

    setFilters: (filters) => set((state) => {
      state.filters = filters;
    }),

    clearFilters: () => set((state) => {
      state.filters = {};
    }),

    // Sort actions
    setSortBy: (field) => set((state) => {
      state.sortBy = field;
    }),

    setSortOrder: (order) => set((state) => {
      state.sortOrder = order;
    }),

    toggleSortOrder: () => set((state) => {
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
    }),

    // Selection actions
    toggleSelection: (id) => set((state) => {
      if (state.selectedIds.has(id)) {
        state.selectedIds.delete(id);
      } else {
        state.selectedIds.add(id);
      }
    }),

    selectAll: (ids) => set((state) => {
      state.selectedIds = new Set(ids);
    }),

    clearSelection: () => set((state) => {
      state.selectedIds.clear();
    }),

    isSelected: (id) => {
      return get().selectedIds.has(id);
    },

    // Export actions
    addToExportQueue: (item) => set((state) => {
      state.exportQueue.push(item);
    }),

    updateExportProgress: (id, progress) => set((state) => {
      const item = state.exportQueue.find(i => i.id === id);
      if (item) {
        item.progress = progress;
        item.status = 'processing';
      }
    }),

    updateExportStatus: (id, status, downloadUrl, error) => set((state) => {
      const item = state.exportQueue.find(i => i.id === id);
      if (item) {
        item.status = status;
        if (downloadUrl) item.downloadUrl = downloadUrl;
        if (error) item.error = error;
      }
    }),

    removeFromExportQueue: (id) => set((state) => {
      const index = state.exportQueue.findIndex(i => i.id === id);
      if (index !== -1) {
        state.exportQueue.splice(index, 1);
      }
    }),

    // Computed getters
    getFilteredFindings: () => {
      const { findings, filters } = get();
      
      return findings.filter(finding => {
        // Severity filter
        if (filters.severity?.length && !filters.severity.includes(finding.severity)) {
          return false;
        }
        
        // Tool filter
        if (filters.tool?.length && !filters.tool.includes(finding.tool)) {
          return false;
        }
        
        // Category filter
        if (filters.category?.length && finding.category && 
            !filters.category.includes(finding.category)) {
          return false;
        }
        
        // Report ID filter
        if (filters.reportId && finding.reportId !== filters.reportId) {
          return false;
        }
        
        // Search query
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          const searchableText = `${finding.title} ${finding.description} ${finding.resource || ''}`.toLowerCase();
          if (!searchableText.includes(query)) {
            return false;
          }
        }
        
        // Date range filter
        if (filters.dateRange) {
          const findingDate = new Date(finding.createdAt);
          if (findingDate < filters.dateRange.start || findingDate > filters.dateRange.end) {
            return false;
          }
        }
        
        return true;
      });
    },

    getSortedFindings: () => {
      const { sortBy, sortOrder } = get();
      const filtered = get().getFilteredFindings();
      
      return [...filtered].sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'severity':
            comparison = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
            break;
          case 'title':
            comparison = a.title.localeCompare(b.title);
            break;
          case 'createdAt':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'tool':
            comparison = a.tool.localeCompare(b.tool);
            break;
          case 'category':
            comparison = (a.category || '').localeCompare(b.category || '');
            break;
        }
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    },

    getSelectedFindings: () => {
      const { findings, selectedIds } = get();
      return findings.filter(f => selectedIds.has(f.id));
    },

    // Utility
    reset: () => set((state) => {
      state.findings = [];
      state.totalFindings = 0;
      state.filters = {};
      state.sortBy = 'severity';
      state.sortOrder = 'desc';
      state.selectedIds.clear();
      state.exportQueue = [];
      state.isLoading = false;
      state.error = null;
    })
  }))
);

// Selectors
export const selectFindings = (state: FindingsState) => state.findings;
export const selectFilters = (state: FindingsState) => state.filters;
export const selectSort = (state: FindingsState) => ({
  sortBy: state.sortBy,
  sortOrder: state.sortOrder
});
export const selectSelectedCount = (state: FindingsState) => state.selectedIds.size;
export const selectExportQueue = (state: FindingsState) => state.exportQueue;