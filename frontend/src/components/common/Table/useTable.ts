import { useState, useCallback, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

export interface PaginationConfig {
  pageIndex: number;
  pageSize: number;
  total: number;
}

export interface TableSelection<T> {
  selectedRows: Set<string | number>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
}

export interface UseTableOptions<T> {
  data: T[];
  getRowId: (row: T) => string | number;
  enableSorting?: boolean;
  enableSelection?: boolean;
  enablePagination?: boolean;
  defaultSort?: SortConfig<T>;
  defaultPageSize?: number;
}

export interface UseTableReturn<T> {
  // Data
  processedData: T[];
  
  // Sorting
  sortConfig: SortConfig<T> | null;
  setSortConfig: (config: SortConfig<T> | null) => void;
  toggleSort: (key: keyof T) => void;
  getSortDirection: (key: keyof T) => SortDirection;
  
  // Selection
  selection: TableSelection<T>;
  toggleRow: (rowId: string | number) => void;
  toggleAllRows: () => void;
  clearSelection: () => void;
  isRowSelected: (rowId: string | number) => boolean;
  
  // Pagination
  pagination: PaginationConfig;
  setPageIndex: (index: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  canNextPage: boolean;
  canPreviousPage: boolean;
  pageCount: number;
}

export function useTable<T extends Record<string, any>>({
  data,
  getRowId,
  enableSorting = true,
  enableSelection = true,
  enablePagination = true,
  defaultSort = null,
  defaultPageSize = 10,
}: UseTableOptions<T>): UseTableReturn<T> {
  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(defaultSort);
  
  // Selection state
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  
  // Pagination state
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Sort data
  const sortedData = useMemo(() => {
    if (!enableSorting || !sortConfig || !sortConfig.direction) {
      return [...data];
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (aValue > bValue) {
        comparison = 1;
      } else if (aValue < bValue) {
        comparison = -1;
      }

      return sortConfig.direction === 'desc' ? -comparison : comparison;
    });
  }, [data, sortConfig, enableSorting]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!enablePagination) {
      return sortedData;
    }

    const start = pageIndex * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, pageIndex, pageSize, enablePagination]);

  // Sort handlers
  const toggleSort = useCallback((key: keyof T) => {
    if (!enableSorting) return;

    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }

      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }

      if (current.direction === 'desc') {
        return null;
      }

      return null;
    });
  }, [enableSorting]);

  const getSortDirection = useCallback((key: keyof T): SortDirection => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction;
  }, [sortConfig]);

  // Selection handlers
  const toggleRow = useCallback((rowId: string | number) => {
    if (!enableSelection) return;

    setSelectedRows(current => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, [enableSelection]);

  const toggleAllRows = useCallback(() => {
    if (!enableSelection) return;

    const currentPageRowIds = paginatedData.map(row => getRowId(row));
    const allSelected = currentPageRowIds.every(id => selectedRows.has(id));

    if (allSelected) {
      setSelectedRows(current => {
        const next = new Set(current);
        currentPageRowIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows(current => {
        const next = new Set(current);
        currentPageRowIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [enableSelection, paginatedData, getRowId, selectedRows]);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
  }, []);

  const isRowSelected = useCallback((rowId: string | number) => {
    return selectedRows.has(rowId);
  }, [selectedRows]);

  // Pagination handlers
  const pageCount = Math.ceil(data.length / pageSize);
  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  const nextPage = useCallback(() => {
    if (canNextPage) {
      setPageIndex(current => current + 1);
    }
  }, [canNextPage]);

  const previousPage = useCallback(() => {
    if (canPreviousPage) {
      setPageIndex(current => current - 1);
    }
  }, [canPreviousPage]);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setPageIndex(0); // Reset to first page when changing page size
  }, []);

  // Selection state
  const currentPageRowIds = paginatedData.map(row => getRowId(row));
  const selectedOnPage = currentPageRowIds.filter(id => selectedRows.has(id));
  const isAllSelected = currentPageRowIds.length > 0 && selectedOnPage.length === currentPageRowIds.length;
  const isIndeterminate = selectedOnPage.length > 0 && selectedOnPage.length < currentPageRowIds.length;

  const selection: TableSelection<T> = {
    selectedRows,
    isAllSelected,
    isIndeterminate,
  };

  const pagination: PaginationConfig = {
    pageIndex,
    pageSize,
    total: data.length,
  };

  return {
    processedData: paginatedData,
    
    // Sorting
    sortConfig,
    setSortConfig,
    toggleSort,
    getSortDirection,
    
    // Selection
    selection,
    toggleRow,
    toggleAllRows,
    clearSelection,
    isRowSelected,
    
    // Pagination
    pagination,
    setPageIndex,
    setPageSize: handleSetPageSize,
    nextPage,
    previousPage,
    canNextPage,
    canPreviousPage,
    pageCount,
  };
}