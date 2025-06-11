import { useState, useCallback } from 'react';

export interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
  url?: string;
  uploadedAt?: Date;
}

export interface UseFileUploadOptions {
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  acceptedFileTypes?: string[];
  autoUpload?: boolean;
  onUpload?: (file: File) => Promise<{ url: string } | void>;
  onError?: (error: Error, file: File) => void;
  onSuccess?: (file: FileUploadItem) => void;
}

export interface UseFileUploadReturn {
  files: FileUploadItem[];
  isDragging: boolean;
  
  // Actions
  addFiles: (newFiles: File[]) => void;
  removeFile: (id: string) => void;
  retryFile: (id: string) => void;
  cancelFile: (id: string) => void;
  clearAll: () => void;
  uploadFile: (id: string) => Promise<void>;
  uploadAll: () => Promise<void>;
  
  // Drag and drop handlers
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  
  // Stats
  totalFiles: number;
  uploadedFiles: number;
  failedFiles: number;
  isUploading: boolean;
  overallProgress: number;
}

export function useFileUpload({
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  acceptedFileTypes = [],
  autoUpload = false,
  onUpload,
  onError,
  onSuccess,
}: UseFileUploadOptions = {}): UseFileUploadReturn {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    if (maxFileSize && file.size > maxFileSize) {
      return `File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`;
    }

    if (acceptedFileTypes.length > 0) {
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      const mimeType = file.type;
      
      const isAccepted = acceptedFileTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type.toLowerCase();
        }
        if (type.endsWith('/*')) {
          return mimeType.startsWith(type.slice(0, -2));
        }
        return mimeType === type;
      });

      if (!isAccepted) {
        return `File type not accepted. Accepted types: ${acceptedFileTypes.join(', ')}`;
      }
    }

    return null;
  }, [maxFileSize, acceptedFileTypes]);

  // Add files
  const addFiles = useCallback((newFiles: File[]) => {
    const currentFileCount = files.filter(f => f.status !== 'cancelled').length;
    const availableSlots = maxFiles - currentFileCount;
    const filesToAdd = newFiles.slice(0, availableSlots);

    const newFileItems: FileUploadItem[] = filesToAdd.map(file => {
      const error = validateFile(file);
      return {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        progress: 0,
        status: error ? 'error' : 'pending',
        error,
      };
    });

    setFiles(prev => [...prev, ...newFileItems]);

    if (autoUpload) {
      newFileItems
        .filter(item => item.status === 'pending')
        .forEach(item => uploadFile(item.id));
    }
  }, [files, maxFiles, validateFile, autoUpload]);

  // Upload file
  const uploadFile = useCallback(async (id: string) => {
    const fileItem = files.find(f => f.id === id);
    if (!fileItem || fileItem.status === 'uploading') return;

    setFiles(prev =>
      prev.map(f =>
        f.id === id ? { ...f, status: 'uploading' as const, progress: 0 } : f
      )
    );

    try {
      if (!onUpload) {
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setFiles(prev =>
            prev.map(f =>
              f.id === id ? { ...f, progress } : f
            )
          );
        }
      } else {
        const result = await onUpload(fileItem.file);
        setFiles(prev =>
          prev.map(f =>
            f.id === id
              ? {
                  ...f,
                  status: 'completed' as const,
                  progress: 100,
                  url: result?.url,
                  uploadedAt: new Date(),
                }
              : f
          )
        );
      }

      const completedFile = files.find(f => f.id === id);
      if (completedFile) {
        onSuccess?.(completedFile);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setFiles(prev =>
        prev.map(f =>
          f.id === id
            ? { ...f, status: 'error' as const, error: errorMessage }
            : f
        )
      );
      onError?.(error instanceof Error ? error : new Error(errorMessage), fileItem.file);
    }
  }, [files, onUpload, onSuccess, onError]);

  // Remove file
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Cancel file upload
  const cancelFile = useCallback((id: string) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === id && f.status === 'uploading'
          ? { ...f, status: 'cancelled' as const }
          : f
      )
    );
  }, []);

  // Retry file upload
  const retryFile = useCallback((id: string) => {
    setFiles(prev =>
      prev.map(f =>
        f.id === id && (f.status === 'error' || f.status === 'cancelled')
          ? { ...f, status: 'pending' as const, error: undefined }
          : f
      )
    );
    uploadFile(id);
  }, [uploadFile]);

  // Clear all files
  const clearAll = useCallback(() => {
    setFiles([]);
  }, []);

  // Upload all pending files
  const uploadAll = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    await Promise.all(pendingFiles.map(f => uploadFile(f.id)));
  }, [files, uploadFile]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCounter = prev - 1;
      if (newCounter === 0) {
        setIsDragging(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }, [addFiles]);

  // Calculate stats
  const totalFiles = files.length;
  const uploadedFiles = files.filter(f => f.status === 'completed').length;
  const failedFiles = files.filter(f => f.status === 'error').length;
  const isUploading = files.some(f => f.status === 'uploading');
  
  const overallProgress = totalFiles === 0
    ? 0
    : files.reduce((acc, f) => acc + f.progress, 0) / totalFiles;

  return {
    files,
    isDragging,
    
    // Actions
    addFiles,
    removeFile,
    retryFile,
    cancelFile,
    clearAll,
    uploadFile,
    uploadAll,
    
    // Drag and drop handlers
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    
    // Stats
    totalFiles,
    uploadedFiles,
    failedFiles,
    isUploading,
    overallProgress,
  };
}