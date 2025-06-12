/**
 * useFileUpload - Advanced file upload hook with drag and drop
 * Handles upload progress, queuing, error recovery, and type validation
 */
import { useCallback, useState, useRef } from 'react';
import { useDropzone, FileRejection, DropzoneOptions } from 'react-dropzone';
import { useReportsStore } from '@/stores/reportsStore';
import { useAppStore } from '@/stores/appStore';
import { apiClient } from '@/services/api';
import axios, { CancelTokenSource } from 'axios';

interface UploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (response: any) => void;
  onError?: (error: Error) => void;
  maxRetries?: number;
  chunkSize?: number;
}

interface FileUploadState {
  isUploading: boolean;
  uploadProgress: Record<string, number>;
  errors: Array<{ file: string; error: string }>;
  successfulUploads: string[];
}

const DEFAULT_ACCEPTED_TYPES = {
  'application/json': ['.json'],
  'text/xml': ['.xml'],
  'application/xml': ['.xml'],
  'text/csv': ['.csv'],
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
};

export function useFileUpload(dropzoneOptions?: Partial<DropzoneOptions>) {
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    uploadProgress: {},
    errors: [],
    successfulUploads: []
  });

  const cancelTokensRef = useRef<Map<string, CancelTokenSource>>(new Map());
  const { addToUploadQueue, updateUploadProgress, updateUploadStatus } = useReportsStore();
  const { addNotification, preferences } = useAppStore();

  // Upload single file with retry logic
  const uploadFile = async (
    file: File,
    options: UploadOptions = {},
    retryCount = 0
  ): Promise<void> => {
    const {
      onProgress,
      onSuccess,
      onError,
      maxRetries = 3,
      chunkSize = 5 * 1024 * 1024 // 5MB chunks
    } = options;

    const uploadId = `upload-${Date.now()}-${file.name}`;
    const cancelTokenSource = axios.CancelToken.source();
    cancelTokensRef.current.set(uploadId, cancelTokenSource);

    try {
      // Add to upload queue
      addToUploadQueue({
        id: uploadId,
        file,
        progress: 0,
        status: 'uploading'
      });

      // Update state
      setState(prev => ({
        ...prev,
        uploadProgress: { ...prev.uploadProgress, [file.name]: 0 }
      }));

      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);
      formData.append('size', file.size.toString());

      // Upload with progress tracking
      const response = await apiClient.post('/reports/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;

          setState(prev => ({
            ...prev,
            uploadProgress: { ...prev.uploadProgress, [file.name]: progress }
          }));

          updateUploadProgress(uploadId, progress);
          onProgress?.(progress);
        },
        cancelToken: cancelTokenSource.token
      });

      // Update upload status
      updateUploadStatus(uploadId, 'completed');
      
      setState(prev => ({
        ...prev,
        successfulUploads: [...prev.successfulUploads, file.name],
        uploadProgress: { ...prev.uploadProgress, [file.name]: 100 }
      }));

      addNotification({
        type: 'success',
        message: `Successfully uploaded ${file.name}`,
        duration: 3000
      });

      onSuccess?.(response.data);

      // Add report optimistically
      if (response.data.id) {
        useReportsStore.getState().addReportOptimistically({
          id: response.data.id,
          filename: file.name,
          status: 'processing',
          uploadedAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      // Handle cancellation
      if (axios.isCancel(error)) {
        updateUploadStatus(uploadId, 'failed', 'Upload cancelled');
        return;
      }

      // Retry logic
      if (retryCount < maxRetries && error.response?.status >= 500) {
        console.log(`Retrying upload for ${file.name} (attempt ${retryCount + 1})`);
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return uploadFile(file, options, retryCount + 1);
      }

      // Final failure
      const errorMessage = error.response?.data?.message || error.message || 'Upload failed';
      
      setState(prev => ({
        ...prev,
        errors: [...prev.errors, { file: file.name, error: errorMessage }]
      }));

      updateUploadStatus(uploadId, 'failed', errorMessage);

      addNotification({
        type: 'error',
        message: `Failed to upload ${file.name}: ${errorMessage}`,
        duration: 5000
      });

      onError?.(error);
    } finally {
      cancelTokensRef.current.delete(uploadId);
    }
  };

  // Upload multiple files with concurrency control
  const uploadFiles = useCallback(async (
    files: File[],
    options: UploadOptions = {}
  ) => {
    const maxConcurrent = preferences.maxConcurrentUploads || 3;
    
    setState(prev => ({ ...prev, isUploading: true, errors: [], successfulUploads: [] }));

    // Process files in batches
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const batch = files.slice(i, i + maxConcurrent);
      await Promise.allSettled(
        batch.map(file => uploadFile(file, options))
      );
    }

    setState(prev => ({ ...prev, isUploading: false }));
  }, [preferences.maxConcurrentUploads]);

  // Cancel upload
  const cancelUpload = useCallback((filename: string) => {
    const cancelToken = Array.from(cancelTokensRef.current.entries())
      .find(([key]) => key.includes(filename))?.[1];
    
    if (cancelToken) {
      cancelToken.cancel('Upload cancelled by user');
    }
  }, []);

  // Clear errors
  const clearErrors = useCallback(() => {
    setState(prev => ({ ...prev, errors: [] }));
  }, []);

  // Dropzone configuration
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
    acceptedFiles,
    rejectedFiles,
    open
  } = useDropzone({
    accept: DEFAULT_ACCEPTED_TYPES,
    multiple: true,
    noClick: false,
    noKeyboard: false,
    ...dropzoneOptions,
    onDrop: useCallback(async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles.map(rejection => ({
          file: rejection.file.name,
          error: rejection.errors.map(e => e.message).join(', ')
        }));
        
        setState(prev => ({ ...prev, errors }));
        
        rejectedFiles.forEach(rejection => {
          addNotification({
            type: 'error',
            message: `${rejection.file.name}: ${rejection.errors[0].message}`,
            duration: 5000
          });
        });
      }

      // Upload accepted files
      if (acceptedFiles.length > 0) {
        if (preferences.autoUpload) {
          await uploadFiles(acceptedFiles);
        } else {
          // Just add to queue without uploading
          acceptedFiles.forEach((file, index) => {
            addToUploadQueue({
              id: `pending-${Date.now()}-${index}`,
              file,
              progress: 0,
              status: 'pending'
            });
          });
        }
      }

      // Call original onDrop if provided
      dropzoneOptions?.onDrop?.(acceptedFiles, rejectedFiles, event);
    }, [uploadFiles, addNotification, preferences.autoUpload, addToUploadQueue, dropzoneOptions])
  });

  // Reset state
  const reset = useCallback(() => {
    setState({
      isUploading: false,
      uploadProgress: {},
      errors: [],
      successfulUploads: []
    });
  }, []);

  return {
    // Dropzone props
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
    acceptedFiles,
    rejectedFiles,
    open,
    
    // Upload state
    isUploading: state.isUploading,
    uploadProgress: state.uploadProgress,
    errors: state.errors,
    uploadedFiles: state.successfulUploads,
    
    // Actions
    uploadFiles,
    cancelUpload,
    clearErrors,
    reset,
    
    // For testing
    onDrop: (files: File[]) => uploadFiles(files)
  };
}