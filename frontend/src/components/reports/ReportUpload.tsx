import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Pause, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  error?: string;
}

interface ReportUploadProps {
  onUpload?: (files: File[]) => void;
  acceptedFormats?: string[];
  maxFileSize?: number;
  uploadProgress?: Record<string, number>;
  className?: string;
}

export function ReportUpload({
  onUpload,
  acceptedFormats = ['.json', '.xml', '.csv', '.pdf'],
  maxFileSize = 100 * 1024 * 1024, // 100MB
  uploadProgress = {},
  className
}: ReportUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Process accepted files
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: `${file.name}-${Date.now()}`,
      file,
      progress: 0,
      status: 'pending' as const
    }));

    setFiles(prev => [...prev, ...newFiles]);
    
    // Handle rejected files
    rejectedFiles.forEach(rejection => {
      const error = rejection.errors[0]?.message || 'Invalid file';
      console.error(`File rejected: ${rejection.file.name} - ${error}`);
    });

    if (acceptedFiles.length > 0) {
      onUpload?.(acceptedFiles);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats.reduce((acc, format) => {
      const mimeTypes = {
        '.json': { 'application/json': ['.json'] },
        '.xml': { 'application/xml': ['.xml'], 'text/xml': ['.xml'] },
        '.csv': { 'text/csv': ['.csv'] },
        '.pdf': { 'application/pdf': ['.pdf'] }
      };
      return { ...acc, ...mimeTypes[format] };
    }, {}),
    maxSize: maxFileSize,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false)
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const togglePause = (id: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id === id) {
        return {
          ...f,
          status: f.status === 'paused' ? 'uploading' : 'paused'
        };
      }
      return f;
    }));
  };

  // Update progress from props
  React.useEffect(() => {
    setFiles(prev => prev.map(f => {
      const progress = uploadProgress[f.id];
      if (progress !== undefined) {
        return {
          ...f,
          progress,
          status: progress === 100 ? 'completed' : 'uploading'
        };
      }
      return f;
    }));
  }, [uploadProgress]);

  const getFileIcon = (filename: string) => {
    return <FileText size={20} />;
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-600" size={16} />;
      case 'error':
        return <AlertCircle className="text-red-600" size={16} />;
      default:
        return null;
    }
  };

  return (
    <div className={className}>
      <Card>
        <div
          {...getRootProps()}
          className={clsx(
            'relative border-2 border-dashed rounded-lg p-8',
            'transition-all duration-200 cursor-pointer',
            'hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
            isDragActive || dragActive ? 
              'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 
              'border-gray-300 dark:border-gray-600',
            'drag-active'
          )}
        >
          <input {...getInputProps()} id="file-upload" aria-label="choose files" />
          
          <AnimatePresence>
            {(isDragActive || dragActive) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-blue-500/10 rounded-lg flex items-center justify-center"
              >
                <p className="text-blue-600 font-medium">Drop files here</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center">
            <Upload className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
              Drop files here or click to upload
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Supported formats: {acceptedFormats.join(', ')}
            </p>
            <p className="text-sm text-gray-500">
              Maximum file size: {(maxFileSize / 1024 / 1024).toFixed(0)}MB
            </p>
          </div>
        </div>
      </Card>

      {files.length > 0 && (
        <Card className="mt-4">
          <h3 className="font-medium mb-4">Upload Queue</h3>
          <div className="space-y-3">
            <AnimatePresence>
              {files.map(file => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      {getFileIcon(file.file.name)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {file.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      {getStatusIcon(file.status)}
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'uploading' || file.status === 'paused' ? (
                        <button
                          onClick={() => togglePause(file.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          {file.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                        </button>
                      ) : null}
                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {(file.status === 'uploading' || file.status === 'paused') && (
                    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                        role="progressbar"
                        aria-valuenow={file.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  )}
                  
                  {file.error && (
                    <p className="text-xs text-red-600 mt-1">{file.error}</p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      )}

      {/* Validation error toast */}
      <div className="sr-only" role="alert" aria-live="polite">
        Invalid file type
      </div>
    </div>
  );
}