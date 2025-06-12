import React, { useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useReportsStore } from '../../stores/reportsStore';
import { useFindingsStore } from '../../stores/findingsStore';
import { useBackendConnection } from '../../hooks/useBackendConnection';
import { SummaryCard } from './SummaryCard';
import { SeverityDistribution } from './SeverityDistribution';
import { TrendChart } from './TrendChart';
import { RecentReports } from './RecentReports';
import { clsx } from 'clsx';

interface DashboardViewProps {
  onGlobalSearch?: () => void;
  onQuickUpload?: () => void;
  className?: string;
}

export function DashboardView({ onGlobalSearch, onQuickUpload, className }: DashboardViewProps) {
  const { setLoading } = useAppStore();
  const { reports, fetchReports } = useReportsStore();
  const { findings, fetchFindings } = useFindingsStore();
  
  const { connected, subscribe } = useBackendConnection(
    process.env.VITE_WEBSOCKET_URL || 'ws://localhost:8000/ws'
  );

  useEffect(() => {
    // Initial data fetch
    const loadDashboard = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchReports({ page: 1, pageSize: 10 }),
          fetchFindings({ page: 1, pageSize: 100 })
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [fetchReports, fetchFindings, setLoading]);

  useEffect(() => {
    // Subscribe to real-time updates
    if (!connected) return;

    const unsubReports = subscribe('report.created', () => {
      fetchReports({ page: 1, pageSize: 10 });
    });

    const unsubFindings = subscribe('findings.updated', () => {
      fetchFindings({ page: 1, pageSize: 100 });
    });

    return () => {
      unsubReports();
      unsubFindings();
    };
  }, [connected, subscribe, fetchReports, fetchFindings]);

  useEffect(() => {
    // Global keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onGlobalSearch?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
        e.preventDefault();
        onQuickUpload?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onGlobalSearch, onQuickUpload]);

  // Calculate metrics
  const totalFindings = findings.length;
  const criticalFindings = findings.filter(f => f.severity === 'critical').length;
  const highFindings = findings.filter(f => f.severity === 'high').length;
  const mediumFindings = findings.filter(f => f.severity === 'medium').length;
  const lowFindings = findings.filter(f => f.severity === 'low').length;

  const severityData = [
    { severity: 'critical', count: criticalFindings, percentage: (criticalFindings / totalFindings) * 100 || 0 },
    { severity: 'high', count: highFindings, percentage: (highFindings / totalFindings) * 100 || 0 },
    { severity: 'medium', count: mediumFindings, percentage: (mediumFindings / totalFindings) * 100 || 0 },
    { severity: 'low', count: lowFindings, percentage: (lowFindings / totalFindings) * 100 || 0 }
  ];

  const isLoading = useAppStore.getState().loading;

  if (isLoading) {
    return (
      <div className={clsx('p-6', className)}>
        <div role="status" aria-live="polite" aria-label="Loading dashboard data">
          <span className="sr-only">Loading dashboard data</span>
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('p-6 space-y-6', className)}>
      {/* Summary Cards */}
      <section aria-label="Summary">
        <h2 className="text-2xl font-semibold mb-4">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Findings"
            value={totalFindings}
            trend={{ direction: 'up', percentage: 12 }}
          />
          <SummaryCard
            title="Critical Findings"
            value={criticalFindings}
            trend={{ direction: criticalFindings > 0 ? 'up' : 'neutral', percentage: 0 }}
            onDrillDown={() => {/* Navigate to critical findings */}}
          />
          <SummaryCard
            title="Reports Processed"
            value={reports.length}
            trend={{ direction: 'up', percentage: 8 }}
          />
          <SummaryCard
            title="Active Scans"
            value={0}
            trend={{ direction: 'neutral', percentage: 0 }}
          />
        </div>
      </section>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-label="Severity Distribution">
          <h3 className="text-xl font-semibold mb-4">Severity Distribution</h3>
          <SeverityDistribution
            data={severityData}
            onFilter={(severity) => {/* Filter findings by severity */}}
          />
        </section>

        <section aria-label="Findings Trend">
          <h3 className="text-xl font-semibold mb-4">Findings Trend</h3>
          <TrendChart />
        </section>
      </div>

      {/* Recent Reports */}
      <section aria-label="Recent Reports">
        <h3 className="text-xl font-semibold mb-4">Recent Reports</h3>
        <RecentReports reports={reports.slice(0, 5)} />
      </section>
    </div>
  );
}