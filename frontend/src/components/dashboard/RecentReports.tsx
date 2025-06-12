import React from 'react';
import { Card } from '../ui/Card';
import { FileText, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';

interface Report {
  id: string;
  filename: string;
  status: string;
  created_at: string;
  findings_count: number;
}

interface RecentReportsProps {
  reports: Report[];
  onReportClick?: (report: Report) => void;
  className?: string;
}

export function RecentReports({ reports, onReportClick, className }: RecentReportsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'processing':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'failed':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  if (reports.length === 0) {
    return (
      <Card className={className}>
        <div className="text-center py-8 text-gray-500">
          No reports available
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="space-y-3">
        {reports.map((report) => (
          <div
            key={report.id}
            className={clsx(
              'flex items-center justify-between p-3 rounded-lg',
              'bg-gray-50 dark:bg-gray-900/50',
              'hover:bg-gray-100 dark:hover:bg-gray-900',
              'cursor-pointer transition-colors'
            )}
            onClick={() => onReportClick?.(report)}
          >
            <div className="flex items-center gap-3">
              <FileText className="text-gray-400" size={20} />
              <div>
                <p className="font-medium text-sm">{report.filename}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12} />
                    {format(new Date(report.created_at), 'MMM dd, HH:mm')}
                  </span>
                  {report.findings_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <AlertCircle size={12} />
                      {report.findings_count} findings
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className={clsx(
              'px-2 py-1 text-xs font-medium rounded-full',
              getStatusColor(report.status)
            )}>
              {report.status}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}