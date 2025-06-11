import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Activity, Database, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import styles from './StatusBar.module.css';

export interface StatusBarProps {
  className?: string;
}

interface BackendStatus {
  connected: boolean;
  latency?: number;
  version?: string;
}

export function StatusBar({ className }: StatusBarProps) {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
    connected: false,
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Check backend status
    const checkBackendStatus = async () => {
      try {
        const start = Date.now();
        const response = await fetch('http://localhost:8000/api/v1/health', {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });
        
        if (response.ok) {
          const data = await response.json();
          setBackendStatus({
            connected: true,
            latency: Date.now() - start,
            version: data.version,
          });
        } else {
          setBackendStatus({ connected: false });
        }
      } catch (error) {
        setBackendStatus({ connected: false });
      }
    };

    // Check immediately and then every 10 seconds
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={clsx(styles.statusBar, className)}>
      <div className={styles.statusSection}>
        {/* Backend Connection Status */}
        <div
          className={clsx(
            styles.statusItem,
            backendStatus.connected ? styles.connected : styles.disconnected
          )}
          title={
            backendStatus.connected
              ? `Backend connected (${backendStatus.latency}ms latency)`
              : 'Backend disconnected'
          }
        >
          {backendStatus.connected ? (
            <>
              <Wifi className="w-3 h-3" />
              <span>Backend Connected</span>
              {backendStatus.latency && (
                <span className={styles.latency}>{backendStatus.latency}ms</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              <span>Backend Disconnected</span>
            </>
          )}
        </div>

        {/* Database Status */}
        <div className={styles.statusItem} title="Database status">
          <Database className="w-3 h-3" />
          <span>SQLite</span>
        </div>

        {/* Activity Indicator */}
        <div className={styles.statusItem}>
          <Activity className="w-3 h-3" />
          <span>Ready</span>
        </div>
      </div>

      <div className={styles.statusSection}>
        {/* Version */}
        {backendStatus.version && (
          <div className={styles.statusItem}>
            <span className={styles.version}>v{backendStatus.version}</span>
          </div>
        )}

        {/* Current Time */}
        <div className={styles.statusItem}>
          <span className={styles.time}>
            {currentTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}