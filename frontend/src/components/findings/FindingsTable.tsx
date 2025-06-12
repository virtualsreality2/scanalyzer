import React, { useState, useCallback, useMemo } from 'react';
import { VirtualList } from '../ui/VirtualList';
import { Card } from '../ui/Card';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface Finding {
  id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  tool: string;
  category?: string;
  created_at: string;
  status?: string;
  remediation?: string;
  code_snippet?: string;
}

interface FindingsTableProps {
  findings: Finding[];
  height?: number;
  onSelectionChange?: (selectedIds: string[]) => void;
  onRowClick?: (finding: Finding) => void;
  className?: string;
}

export function FindingsTable({
  findings,
  height = 600,
  onSelectionChange,
  onRowClick,
  className
}: FindingsTableProps) {
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);

  const severityColors = {
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-red-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200',
    low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200',
    info: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200'
  };

  const toggleExpanded = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelection = useCallback((id: string, index: number, isShift: boolean) => {
    setSelectedFindings(prev => {
      const next = new Set(prev);
      
      if (isShift && lastSelectedIndex !== -1) {
        // Range selection
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        for (let i = start; i <= end; i++) {
          next.add(findings[i].id);
        }
      } else {
        // Single selection
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      
      onSelectionChange?.(Array.from(next));
      return next;
    });
    
    if (!isShift) {
      setLastSelectedIndex(index);
    }
  }, [findings, lastSelectedIndex, onSelectionChange]);

  const toggleAll = useCallback(() => {
    if (selectedFindings.size === findings.length) {
      setSelectedFindings(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = findings.map(f => f.id);
      setSelectedFindings(new Set(allIds));
      onSelectionChange?.(allIds);
    }
  }, [findings, selectedFindings.size, onSelectionChange]);

  const renderFinding = useCallback((finding: Finding, index: number) => {
    const isSelected = selectedFindings.has(finding.id);
    const isExpanded = expandedRows.has(finding.id);

    return (
      <div
        className={clsx(
          'border-b border-gray-200 dark:border-gray-700',
          isSelected && 'bg-blue-50 dark:bg-blue-900/20'
        )}
      >
        <div
          className={clsx(
            'flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800',
            'cursor-pointer transition-colors'
          )}
          onClick={() => onRowClick?.(finding)}
        >
          {/* Expand button */}
          <button
            onClick={(e) => toggleExpanded(finding.id, e)}
            className="mr-3 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => toggleSelection(finding.id, index, e.shiftKey)}
            onClick={(e) => e.stopPropagation()}
            className="mr-3"
          />

          {/* Severity badge */}
          <span className={clsx(
            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-3',
            severityColors[finding.severity]
          )}>
            <AlertCircle size={12} className="mr-1" />
            {finding.severity}
          </span>

          {/* Title and details */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{finding.title}</p>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span>{finding.tool}</span>
              {finding.category && <span>{finding.category}</span>}
              <span>{new Date(finding.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Status */}
          {finding.status === 'resolved' && (
            <CheckCircle className="text-green-600 ml-2" size={20} />
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-16 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            {finding.description && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Description:</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {finding.description}
                </p>
              </div>
            )}
            
            {finding.code_snippet && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Code:</h4>
                <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                  <code>{finding.code_snippet}</code>
                </pre>
              </div>
            )}
            
            {finding.remediation && (
              <div>
                <h4 className="text-sm font-medium mb-2">Remediation:</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {finding.remediation}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [selectedFindings, expandedRows, toggleExpanded, toggleSelection, onRowClick, severityColors]);

  return (
    <Card className={className}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selectedFindings.size === findings.length && findings.length > 0}
            indeterminate={selectedFindings.size > 0 && selectedFindings.size < findings.length}
            onChange={toggleAll}
            aria-label="Select all findings"
          />
          <span className="text-sm font-medium">
            {selectedFindings.size > 0 
              ? `${selectedFindings.size} selected`
              : `${findings.length} findings`}
          </span>
        </div>
      </div>

      {/* Virtual list */}
      <VirtualList
        items={findings}
        height={height - 60} // Subtract header height
        estimatedItemHeight={60}
        renderItem={renderFinding}
        overscan={5}
        emptyState={
          <div className="text-center py-8 text-gray-500">
            No findings to display
          </div>
        }
      />
    </Card>
  );
}