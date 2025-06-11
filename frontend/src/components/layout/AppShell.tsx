import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { WindowControls } from './WindowControls';
import { StatusBar } from './StatusBar';
import clsx from 'clsx';
import styles from './AppShell.module.css';

export interface AppShellProps {
  children?: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [platform, setPlatform] = useState<'windows' | 'macos' | 'linux'>('windows');

  useEffect(() => {
    // Get platform from Electron
    if (window.electronAPI?.platform) {
      window.electronAPI.platform.get()
        .then(setPlatform)
        .catch((error) => {
          console.error('Failed to get platform:', error);
          // Default to windows if platform detection fails
          setPlatform('windows');
        });
    }
  }, []);

  return (
    <div className={clsx(styles.appShell, styles[platform])}>
      {/* Title Bar */}
      <div className={clsx(styles.titleBar, 'drag-region')}>
        <div className={styles.titleBarContent}>
          {platform === 'macos' && (
            <div className={styles.macTrafficLights}>
              <WindowControls platform={platform} />
            </div>
          )}
          
          <div className={styles.appTitle}>
            <img src="/icon.png" alt="Scanalyzer" className={styles.appIcon} />
            <span>Scanalyzer</span>
          </div>

          {platform !== 'macos' && (
            <div className={styles.windowControls}>
              <WindowControls platform={platform} />
            </div>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className={styles.mainLayout}>
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={styles.sidebar}
        />

        {/* Content Area */}
        <main className={styles.content}>
          <div className={styles.contentInner}>
            {children || <Outlet />}
          </div>
        </main>
      </div>

      {/* Status Bar */}
      <StatusBar className={styles.statusBar} />
    </div>
  );
}