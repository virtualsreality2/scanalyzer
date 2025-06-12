import React, { useState, useMemo, useCallback } from 'react';
import { DataTable, Column } from '../ui/DataTable';
import { Card } from '../ui/Card';
import { Search, Download, Trash2, Eye, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useDebounce } from '../../hooks/useDebounce';

interface Report {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  findings_count: number;
  file_size?: number;
  tool?: string;
}

interface BulkAction {
  label: string;
  action: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger';
}

interface ReportListProps {
  reports: Report[];
  onOpen?: (report: Report) => void;
  onSearch?: (query: string) => void;
  onBulkAction?: (action: string, selectedIds: string[]) => void;
  bulkActions?: BulkAction[];
  className?: string;
}

export function ReportList({
  reports,
  onOpen,
  onSearch,
  onBulkAction,
  bulkActions = [
    { label: 'Delete', action: 'delete', icon: <Trash2 size={16} />, variant: 'danger' },
    { label: 'Download', action: 'download', icon: <Download size={16} /> }
  ],
  className
}: ReportListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const debouncedSearch = useDebounce(searchQuery, 300);

  React.useEffect(() => {
    onSearch?.(debouncedSearch);
  }, [debouncedSearch, onSearch]);

  const filteredReports = useMemo(() => {
    let filtered = reports;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(report =>
        report.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(report => report.status === statusFilter);
    }

    return filtered;
  }, [reports, searchQuery, statusFilter]);

  const columns: Column<Report>[] = [
    {
      key: 'filename',
      header: 'Filename',
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{value}</span>
          {row.tool && (
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {row.tool}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value) => {
        const statusColors = {
          completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          failed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
        };
        
        return (
          <span className={clsx(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
            statusColors[value as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
          )}>
            {value}
          </span>
        );
      }
    },
    {
      key: 'findings_count',
      header: 'Findings',
      sortable: true,
      render: (value) => (
        <span className={clsx(
          'font-medium',
          value > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'
        )}>
          {value} findings
        </span>
      )
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (value) => format(new Date(value), 'MMM dd, yyyy HH:mm')
    },
    {
      key: 'actions',
      header: '',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(row);
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="View details"
          >
            <Eye size={16} />
          </button>
        </div>
      )
    }
  ];

  const handleBulkAction = (action: string) => {
    if (selectedReports.length > 0) {
      onBulkAction?.(action, selectedReports);
      setSelectedReports([]);
    }
  };

  return (
    <div className={className}>
      <Card>
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center justify-between gap-4">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={clsx(
                    'w-full pl-10 pr-4 py-2 rounded-lg',
                    'border border-gray-300 dark:border-gray-600',
                    'bg-white dark:bg-gray-800',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500'
                  )}
                />
              </div>
            </div>

            {/* Filter button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                'px-4 py-2 rounded-lg flex items-center gap-2',
                'border border-gray-300 dark:border-gray-600',
                'hover:bg-gray-50 dark:hover:bg-gray-800',
                showFilters && 'bg-gray-50 dark:bg-gray-800'
              )}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={clsx(
                  'px-3 py-1 rounded-lg text-sm',
                  'border border-gray-300 dark:border-gray-600',
                  'bg-white dark:bg-gray-800'
                )}
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          )}

          {/* Bulk actions */}
          {selectedReports.length > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-sm font-medium">
                {selectedReports.length} selected
              </span>
              <div className="flex items-center gap-2">
                {bulkActions.map((action) => (
                  <button
                    key={action.action}
                    onClick={() => handleBulkAction(action.action)}
                    className={clsx(
                      'px-3 py-1 rounded text-sm font-medium flex items-center gap-2',
                      action.variant === 'danger'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    )}
                  >
                    {action.icon}
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={filteredReports}
          keyField="id"
          selectable
          stickyHeader
          onSelectionChange={setSelectedReports}
          onRowDoubleClick={onOpen}
          className="max-h-[600px]"
        />
      </Card>
    </div>
  );
}