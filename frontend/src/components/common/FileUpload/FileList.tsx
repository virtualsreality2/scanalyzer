import React from 'react';
import { X, AlertCircle, CheckCircle, RefreshCw, FileText, Image, FileCode, FileArchive } from 'lucide-react';
import { Button } from '../Button';
import { UploadProgress } from './UploadProgress';
import type { FileUploadItem } from './useFileUpload';
import clsx from 'clsx';

export interface FileListProps {
  files: FileUploadItem[];
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  showProgress?: boolean;
  className?: string;
}

export function FileList({
  files,
  onRemove,
  onRetry,
  onCancel,
  showProgress = true,
  className,
}: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  const getFileIcon = (file: File) => {
    const type = file.type;
    
    if (type.startsWith('image/')) return <Image className="h-5 w-5" />;
    if (type === 'application/pdf') return <FileText className="h-5 w-5" />;
    if (type === 'application/json' || type.startsWith('text/')) return <FileCode className="h-5 w-5" />;
    if (type.includes('zip') || type.includes('tar') || type.includes('rar')) return <FileArchive className="h-5 w-5" />;
    
    return <FileText className="h-5 w-5" />;
  };

  const getStatusIcon = (status: FileUploadItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-semantic-success" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-semantic-error" />;
      case 'uploading':
        return <div className="h-5 w-5 animate-spin rounded-full border-2 border-interactive-primary border-t-transparent" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${bytes} B`;
  };

  return (
    <div className={clsx('space-y-2', className)}>
      {files.map((fileItem) => (
        <div
          key={fileItem.id}
          className={clsx(
            'flex items-center gap-3 rounded-lg border p-3 transition-colors',
            fileItem.status === 'error'
              ? 'border-semantic-error bg-semantic-error bg-opacity-5'
              : 'border-border-primary bg-surface-primary hover:bg-surface-secondary'
          )}
        >
          {/* File Icon */}
          <div className="flex-shrink-0 text-text-secondary">
            {getFileIcon(fileItem.file)}
          </div>

          {/* File Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-text-primary">
                {fileItem.file.name}
              </p>
              <span className="flex-shrink-0 text-xs text-text-tertiary">
                {formatFileSize(fileItem.file.size)}
              </span>
            </div>

            {/* Error Message */}
            {fileItem.error && (
              <p className="mt-1 text-xs text-semantic-error">{fileItem.error}</p>
            )}

            {/* Progress Bar */}
            {showProgress && fileItem.status === 'uploading' && (
              <UploadProgress
                progress={fileItem.progress}
                className="mt-2"
                size="sm"
              />
            )}

            {/* Success Message */}
            {fileItem.status === 'completed' && fileItem.uploadedAt && (
              <p className="mt-1 text-xs text-text-secondary">
                Uploaded {new Date(fileItem.uploadedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Status Icon */}
          <div className="flex-shrink-0">
            {getStatusIcon(fileItem.status)}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {fileItem.status === 'error' && onRetry && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRetry(fileItem.id)}
                aria-label="Retry upload"
                className="h-8 w-8"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}

            {fileItem.status === 'uploading' && onCancel && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCancel(fileItem.id)}
                aria-label="Cancel upload"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {fileItem.status !== 'uploading' && onRemove && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(fileItem.id)}
                aria-label="Remove file"
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Summary component for showing upload stats
export function FileListSummary({
  files,
  className,
}: {
  files: FileUploadItem[];
  className?: string;
}) {
  const completed = files.filter(f => f.status === 'completed').length;
  const failed = files.filter(f => f.status === 'error').length;
  const uploading = files.filter(f => f.status === 'uploading').length;
  const pending = files.filter(f => f.status === 'pending').length;

  if (files.length === 0) return null;

  return (
    <div className={clsx('flex items-center gap-4 text-sm', className)}>
      <span className="text-text-secondary">
        Total: <span className="font-medium text-text-primary">{files.length}</span>
      </span>
      
      {completed > 0 && (
        <span className="text-semantic-success">
          Completed: <span className="font-medium">{completed}</span>
        </span>
      )}
      
      {uploading > 0 && (
        <span className="text-interactive-primary">
          Uploading: <span className="font-medium">{uploading}</span>
        </span>
      )}
      
      {pending > 0 && (
        <span className="text-text-tertiary">
          Pending: <span className="font-medium">{pending}</span>
        </span>
      )}
      
      {failed > 0 && (
        <span className="text-semantic-error">
          Failed: <span className="font-medium">{failed}</span>
        </span>
      )}
    </div>
  );
}