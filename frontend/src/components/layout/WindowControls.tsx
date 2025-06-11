import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import clsx from 'clsx';
import styles from './WindowControls.module.css';

export interface WindowControlsProps {
  platform: 'windows' | 'macos' | 'linux';
  className?: string;
}

export function WindowControls({ platform, className }: WindowControlsProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Listen for maximize state changes
    if (window.electronAPI?.window) {
      const handleMaximizeChange = (maximized: boolean) => {
        setIsMaximized(maximized);
      };

      const handleFullscreenChange = (fullscreen: boolean) => {
        setIsFullscreen(fullscreen);
      };

      window.electronAPI.window.onMaximizeChange(handleMaximizeChange);
      window.electronAPI.window.onFullscreenChange?.(handleFullscreenChange);

      // Get initial state
      window.electronAPI.window.isMaximized()
        .then(setIsMaximized)
        .catch((error) => console.error('Failed to get maximized state:', error));
      
      if (window.electronAPI.window.isFullscreen) {
        window.electronAPI.window.isFullscreen()
          .then(setIsFullscreen)
          .catch((error) => console.error('Failed to get fullscreen state:', error));
      }

      return () => {
        // Cleanup listeners
        window.electronAPI.window.removeMaximizeListener?.(handleMaximizeChange);
        window.electronAPI.window.removeFullscreenListener?.(handleFullscreenChange);
      };
    }
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.window.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.window.toggleMaximize();
  };

  const handleClose = () => {
    window.electronAPI?.window.close();
  };

  if (platform === 'macos') {
    return (
      <div className={clsx(styles.controls, styles.macos, className)}>
        <button
          className={clsx(styles.macButton, styles.close)}
          onClick={handleClose}
          aria-label="Close window"
        >
          <span className={styles.macIcon}>×</span>
        </button>
        <button
          className={clsx(styles.macButton, styles.minimize)}
          onClick={handleMinimize}
          aria-label="Minimize window"
        >
          <span className={styles.macIcon}>−</span>
        </button>
        <button
          className={clsx(styles.macButton, styles.maximize)}
          onClick={handleMaximize}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        >
          <span className={styles.macIcon}>+</span>
        </button>
      </div>
    );
  }

  // Windows/Linux controls
  return (
    <div className={clsx(styles.controls, styles.windows, className)}>
      <button
        className={styles.winButton}
        onClick={handleMinimize}
        aria-label="Minimize window"
      >
        <Minus className="w-3 h-3" />
      </button>
      <button
        className={styles.winButton}
        onClick={handleMaximize}
        aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M2 0v2H0v8h8V8h2V0H2zm1 1h6v6H8V2H3V1zm1 2v5h5V3H4z" />
          </svg>
        ) : (
          <Square className="w-3 h-3" />
        )}
      </button>
      <button
        className={clsx(styles.winButton, styles.close)}
        onClick={handleClose}
        aria-label="Close window"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}