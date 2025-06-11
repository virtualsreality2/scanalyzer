import React from 'react';
import clsx from 'clsx';

export interface UploadProgressProps {
  progress: number; // 0-100
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'error';
  className?: string;
  label?: string;
}

export function UploadProgress({
  progress,
  showPercentage = true,
  size = 'md',
  color = 'primary',
  className,
  label,
}: UploadProgressProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorClasses = {
    primary: 'bg-interactive-primary',
    success: 'bg-semantic-success',
    warning: 'bg-semantic-warning',
    error: 'bg-semantic-error',
  };

  return (
    <div className={clsx('w-full', className)}>
      {(label || showPercentage) && (
        <div className="mb-1 flex items-center justify-between text-sm">
          {label && <span className="text-text-secondary">{label}</span>}
          {showPercentage && (
            <span className="text-text-primary font-medium">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      
      <div
        className={clsx(
          'w-full overflow-hidden rounded-full bg-surface-tertiary',
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Upload progress'}
      >
        <div
          className={clsx(
            'h-full transition-all duration-300 ease-out',
            colorClasses[color]
          )}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

// Circular progress variant
export function CircularProgress({
  progress,
  size = 48,
  strokeWidth = 4,
  showPercentage = true,
  color = 'primary',
  className,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'error';
  className?: string;
}) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedProgress / 100) * circumference;

  const colorClasses = {
    primary: 'text-interactive-primary',
    success: 'text-semantic-success',
    warning: 'text-semantic-warning',
    error: 'text-semantic-error',
  };

  return (
    <div className={clsx('relative inline-flex', className)}>
      <svg
        width={size}
        height={size}
        className="-rotate-90 transform"
        aria-hidden="true"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-surface-tertiary"
        />
        
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={clsx('transition-all duration-300 ease-out', colorClasses[color])}
        />
      </svg>
      
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-medium text-text-primary">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
    </div>
  );
}

// Multi-file overall progress
export function OverallProgress({
  current,
  total,
  label = 'Overall Progress',
  className,
}: {
  current: number;
  total: number;
  label?: string;
  className?: string;
}) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={clsx('w-full', className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <span className="text-sm text-text-secondary">
          {current} of {total} files
        </span>
      </div>
      
      <UploadProgress
        progress={progress}
        showPercentage={false}
        size="md"
        color={progress === 100 ? 'success' : 'primary'}
      />
    </div>
  );
}