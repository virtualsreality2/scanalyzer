import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import { ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  resizable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  selectable?: boolean;
  stickyHeader?: boolean;
  onSort?: (sort: { column: string; direction: 'asc' | 'desc' }) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onContextMenu?: (params: { row: T; event: React.MouseEvent }) => void;
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T, index: number) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id' as keyof T,
  selectable = false,
  stickyHeader = true,
  onSort,
  onSelectionChange,
  onContextMenu,
  onRowClick,
  onRowDoubleClick,
  className
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const resizingColumn = useRef<string | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  const handleSort = (column: string) => {
    if (!onSort) return;
    
    const newDirection = 
      sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    
    setSortColumn(column);
    setSortDirection(newDirection);
    onSort({ column, direction: newDirection });
  };

  const toggleRowSelection = (id: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRows(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = data.map(row => String(row[keyField]));
      setSelectedRows(new Set(allIds));
      onSelectionChange?.(allIds);
    }
  };

  const handleKeyboardNavigation = (e: KeyboardEvent<HTMLTableElement>) => {
    const rows = tableRef.current?.querySelectorAll('tbody tr');
    if (!rows) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedRowIndex(prev => Math.min(prev + 1, rows.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedRowIndex(prev => Math.max(prev - 1, 0));
        break;
      case ' ':
        e.preventDefault();
        if (selectable && focusedRowIndex >= 0) {
          const row = data[focusedRowIndex];
          toggleRowSelection(String(row[keyField]));
        }
        break;
      case 'Enter':
        if (focusedRowIndex >= 0) {
          const row = data[focusedRowIndex];
          onRowClick?.(row, focusedRowIndex);
        }
        break;
    }
  };

  useEffect(() => {
    if (focusedRowIndex >= 0) {
      const rows = tableRef.current?.querySelectorAll('tbody tr');
      rows?.[focusedRowIndex]?.focus();
    }
  }, [focusedRowIndex]);

  const startResize = (column: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingColumn.current = column;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[column] || 150;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingColumn.current) return;
      
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(50, resizeStartWidth.current + diff);
      
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn.current!]: newWidth
      }));
    };

    const handleMouseUp = () => {
      resizingColumn.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className={clsx('overflow-auto relative', className)}>
      <table
        ref={tableRef}
        className="w-full border-collapse"
        onKeyDown={handleKeyboardNavigation}
      >
        <thead className={clsx(
          stickyHeader && 'sticky top-0 z-10 bg-gray-50 dark:bg-gray-900',
          'shadow-sm'
        )}>
          <tr>
            {selectable && (
              <th className="w-12 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows.size === data.length && data.length > 0}
                  indeterminate={selectedRows.size > 0 && selectedRows.size < data.length}
                  onChange={toggleAllSelection}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 relative"
                style={{ width: columnWidths[column.key] || column.width }}
              >
                <div className="flex items-center justify-between">
                  <button
                    className={clsx(
                      'flex items-center gap-1',
                      column.sortable && 'hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer'
                    )}
                    onClick={() => column.sortable && handleSort(column.key)}
                    disabled={!column.sortable}
                  >
                    {column.header}
                    {column.sortable && sortColumn === column.key && (
                      sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                    )}
                  </button>
                  {column.resizable && (
                    <div
                      className="absolute right-0 top-0 h-full w-4 cursor-col-resize flex items-center justify-center"
                      onMouseDown={(e) => startResize(column.key, e)}
                    >
                      <GripVertical size={12} className="text-gray-400" />
                    </div>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={String(row[keyField])}
              className={clsx(
                'border-b border-gray-200 dark:border-gray-700',
                'hover:bg-gray-50 dark:hover:bg-gray-800',
                selectedRows.has(String(row[keyField])) && 'bg-blue-50 dark:bg-blue-900/20',
                'focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-800'
              )}
              onClick={() => onRowClick?.(row, index)}
              onDoubleClick={() => onRowDoubleClick?.(row, index)}
              onContextMenu={(e) => onContextMenu?.({ row, event: e })}
              tabIndex={0}
              onFocus={() => setFocusedRowIndex(index)}
            >
              {selectable && (
                <td className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(String(row[keyField]))}
                    onChange={() => toggleRowSelection(String(row[keyField]))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
              )}
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 text-sm">
                  {column.render
                    ? column.render(row[column.key], row, index)
                    : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}