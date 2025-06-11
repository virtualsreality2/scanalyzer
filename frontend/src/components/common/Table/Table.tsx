import React, { useRef, useEffect, useMemo } from 'react';
import { useVirtual } from '@tanstack/react-virtual';
import clsx from 'clsx';

export interface TableColumn<T> {
  key: string;
  header: string | React.ReactNode;
  accessor?: (row: T) => React.ReactNode;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string | number;
  
  // Virtualization
  enableVirtualization?: boolean;
  rowHeight?: number;
  overscan?: number;
  
  // Selection
  enableSelection?: boolean;
  selectedRows?: Set<string | number>;
  onRowSelect?: (rowId: string | number) => void;
  
  // Sorting
  enableSorting?: boolean;
  sortConfig?: { key: string; direction: 'asc' | 'desc' | null } | null;
  onSort?: (key: string) => void;
  
  // Row actions
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  
  // Styling
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  rowClassName?: string | ((row: T, index: number) => string);
  
  // States
  loading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  getRowId,
  enableVirtualization = true,
  rowHeight = 48,
  overscan = 5,
  enableSelection = false,
  selectedRows = new Set(),
  onRowSelect,
  enableSorting = false,
  sortConfig,
  onSort,
  onRowClick,
  onRowDoubleClick,
  className,
  headerClassName,
  bodyClassName,
  rowClassName,
  loading = false,
  error = null,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<HTMLDivElement>(null);

  // Calculate total width for columns
  const totalWidth = useMemo(() => {
    return columns.reduce((acc, col) => {
      if (typeof col.width === 'number') {
        return acc + col.width;
      }
      return acc;
    }, 0);
  }, [columns]);

  // Virtual row management
  const rowVirtualizer = enableVirtualization
    ? useVirtual({
        size: data.length,
        parentRef,
        estimateSize: () => rowHeight,
        overscan,
      })
    : null;

  const virtualRows = rowVirtualizer?.virtualItems ?? [];
  const totalSize = rowVirtualizer?.totalSize ?? data.length * rowHeight;

  // Handle keyboard navigation
  useEffect(() => {
    if (!enableSelection || !parentRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Select all logic would be implemented in parent component
      }
    };

    const element = parentRef.current;
    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  }, [enableSelection]);

  if (error) {
    return (
      <div className={clsx('flex items-center justify-center p-8 text-semantic-error', className)}>
        <div className="text-center">
          <p className="font-semibold">Error loading data</p>
          <p className="text-sm text-text-tertiary">{error.message}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={clsx('flex items-center justify-center p-8', className)}>
        <div className="text-center">
          <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-solid border-interactive-primary border-r-transparent" />
          <p className="mt-2 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center p-8 text-text-tertiary', className)}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const renderRow = (row: T, index: number, style?: React.CSSProperties) => {
    const rowId = getRowId(row);
    const isSelected = selectedRows.has(rowId);
    const rowClassValue = typeof rowClassName === 'function' ? rowClassName(row, index) : rowClassName;

    return (
      <div
        key={rowId}
        className={clsx(
          'flex items-center border-b border-border-primary transition-colors hover:bg-surface-secondary',
          isSelected && 'bg-interactive-secondary bg-opacity-10',
          onRowClick && 'cursor-pointer',
          rowClassValue
        )}
        style={{
          height: rowHeight,
          ...style,
        }}
        onClick={() => onRowClick?.(row)}
        onDoubleClick={() => onRowDoubleClick?.(row)}
        role="row"
        aria-selected={enableSelection ? isSelected : undefined}
      >
        {enableSelection && (
          <div className="flex h-full w-12 items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onRowSelect?.(rowId)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-border-primary text-interactive-primary focus:ring-2 focus:ring-interactive-primary focus:ring-offset-2"
              aria-label={`Select row ${rowId}`}
            />
          </div>
        )}
        {columns.map((column) => (
          <div
            key={column.key}
            className={clsx(
              'flex items-center px-4',
              column.align === 'center' && 'justify-center',
              column.align === 'right' && 'justify-end',
              column.className
            )}
            style={{
              width: column.width || `${100 / columns.length}%`,
              minWidth: column.width,
            }}
          >
            {column.accessor ? column.accessor(row) : row[column.key]}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={clsx('flex flex-col overflow-hidden rounded-lg border border-border-primary bg-surface-primary', className)}>
      {/* Header */}
      <div className={clsx('flex bg-surface-secondary font-semibold text-text-primary', headerClassName)}>
        {enableSelection && (
          <div className="flex h-12 w-12 items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border-primary text-interactive-primary focus:ring-2 focus:ring-interactive-primary focus:ring-offset-2"
              aria-label="Select all rows"
            />
          </div>
        )}
        {columns.map((column) => (
          <div
            key={column.key}
            className={clsx(
              'flex h-12 items-center px-4',
              column.align === 'center' && 'justify-center',
              column.align === 'right' && 'justify-end',
              enableSorting && column.sortable !== false && 'cursor-pointer select-none hover:bg-surface-tertiary',
              column.headerClassName
            )}
            style={{
              width: column.width || `${100 / columns.length}%`,
              minWidth: column.width,
            }}
            onClick={() => enableSorting && column.sortable !== false && onSort?.(column.key)}
            role={enableSorting && column.sortable !== false ? 'button' : undefined}
            tabIndex={enableSorting && column.sortable !== false ? 0 : undefined}
          >
            <span className="truncate">{column.header}</span>
            {enableSorting && column.sortable !== false && sortConfig?.key === column.key && (
              <span className="ml-1">
                {sortConfig.direction === 'asc' ? '↑' : sortConfig.direction === 'desc' ? '↓' : ''}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        ref={parentRef}
        className={clsx('flex-1 overflow-auto', bodyClassName)}
        role="rowgroup"
      >
        {enableVirtualization ? (
          <div
            style={{
              height: `${totalSize}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = data[virtualRow.index];
              return renderRow(
                row,
                virtualRow.index,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }
              );
            })}
          </div>
        ) : (
          data.map((row, index) => renderRow(row, index))
        )}
      </div>
    </div>
  );
}