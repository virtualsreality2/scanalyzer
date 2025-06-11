import React, { useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '../Button';

export interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedFileTypes?: string[];
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  multiple?: boolean;
  disabled?: boolean;
  isDragging?: boolean;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  className?: string;
  children?: React.ReactNode;
}

export function FileDropZone({
  onFilesSelected,
  acceptedFileTypes = [],
  maxFiles = 10,
  maxFileSize,
  multiple = true,
  disabled = false,
  isDragging = false,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  className,
  children,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
      // Reset input to allow selecting the same file again
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (onDrop) {
      onDrop(e);
    } else {
      e.preventDefault();
      e.stopPropagation();
      
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    }
  };

  const accept = acceptedFileTypes.length > 0 ? acceptedFileTypes.join(',') : undefined;

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) {
      return `${Math.round(bytes / (1024 * 1024))}MB`;
    }
    if (bytes >= 1024) {
      return `${Math.round(bytes / 1024)}KB`;
    }
    return `${bytes}B`;
  };

  // Format accepted types for display
  const formatAcceptedTypes = () => {
    if (acceptedFileTypes.length === 0) return 'All file types';
    
    const extensions = acceptedFileTypes
      .filter(type => type.startsWith('.'))
      .map(ext => ext.toUpperCase());
    
    const mimeTypes = acceptedFileTypes
      .filter(type => !type.startsWith('.'))
      .map(type => {
        if (type === 'image/*') return 'Images';
        if (type === 'video/*') return 'Videos';
        if (type === 'audio/*') return 'Audio';
        if (type === 'application/pdf') return 'PDF';
        if (type === 'application/json') return 'JSON';
        if (type === 'text/csv') return 'CSV';
        return type;
      });
    
    return [...extensions, ...mimeTypes].join(', ');
  };

  return (
    <div
      className={clsx(
        'relative rounded-lg border-2 border-dashed transition-all',
        isDragging
          ? 'border-interactive-primary bg-interactive-primary bg-opacity-5'
          : 'border-border-secondary hover:border-border-tertiary',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer',
        className
      )}
      onClick={handleClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver || ((e) => e.preventDefault())}
      onDrop={handleDrop}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label="File drop zone"
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="sr-only"
        aria-label="File input"
      />

      {children || (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div
            className={clsx(
              'mb-4 rounded-full p-3 transition-colors',
              isDragging
                ? 'bg-interactive-primary text-white'
                : 'bg-surface-secondary text-text-secondary'
            )}
          >
            <Upload className="h-8 w-8" />
          </div>

          <p className="text-lg font-medium text-text-primary">
            {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
          </p>

          <p className="mt-2 text-sm text-text-secondary">
            {formatAcceptedTypes()}
            {maxFileSize && ` • Max ${formatFileSize(maxFileSize)}`}
            {maxFiles > 1 && ` • Max ${maxFiles} files`}
          </p>

          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            disabled={disabled}
          >
            Select Files
          </Button>
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function FileDropZoneCompact({
  onFilesSelected,
  acceptedFileTypes = [],
  multiple = true,
  disabled = false,
  className,
}: Pick<FileDropZoneProps, 'onFilesSelected' | 'acceptedFileTypes' | 'multiple' | 'disabled' | 'className'>) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
      e.target.value = '';
    }
  };

  const accept = acceptedFileTypes.length > 0 ? acceptedFileTypes.join(',') : undefined;

  return (
    <Button
      variant="secondary"
      leftIcon={<FileText className="h-4 w-4" />}
      onClick={handleClick}
      disabled={disabled}
      className={className}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="sr-only"
      />
      Choose Files
    </Button>
  );
}