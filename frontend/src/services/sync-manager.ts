/**
 * Real-time Synchronization Manager
 * Handles state synchronization, conflict resolution, and collaborative features
 */
import { produce } from 'immer';
import { WebSocketService, WebSocketEvent } from './websocket';
import { useAppStore } from '../stores/appStore';
import { useReportsStore } from '../stores/reportsStore';
import { useFindingsStore } from '../stores/findingsStore';

// Sync operation types
export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'patch';
  path: string;
  data?: any;
  timestamp: number;
  clientId: string;
}

// State patch operation
export interface StatePatch {
  path: string;
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy';
  value?: any;
  from?: string;
}

// Conflict resolution strategies
export enum ConflictStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  FIRST_WRITE_WINS = 'first_write_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}

// File upload through WebSocket
export class UploadWebSocketBridge {
  private wsService: WebSocketService;
  private uploads: Map<string, {
    file: File;
    chunks: ArrayBuffer[];
    uploadedChunks: Set<number>;
    totalChunks: number;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = new Map();

  constructor(config: { wsService: WebSocketService; onProgress?: (progress: number) => void }) {
    this.wsService = config.wsService;
    
    // Listen for upload events
    this.wsService.on('upload.progress', (data) => {
      const upload = this.uploads.get(data.fileId);
      if (upload) {
        config.onProgress?.(data.progress);
      }
    });

    this.wsService.on('upload.complete', (data) => {
      const upload = this.uploads.get(data.fileId);
      if (upload) {
        upload.resolve(data);
        this.uploads.delete(data.fileId);
      }
    });

    this.wsService.on('upload.error', (data) => {
      const upload = this.uploads.get(data.fileId);
      if (upload) {
        upload.reject(new Error(data.error));
        this.uploads.delete(data.fileId);
      }
    });
  }

  async connect(): Promise<void> {
    await this.wsService.connect();
  }

  async upload(file: File, chunkSize = 1024 * 1024): Promise<any> {
    const fileId = `${file.name}-${Date.now()}`;
    const chunks = await this.splitFileIntoChunks(file, chunkSize);
    
    return new Promise((resolve, reject) => {
      this.uploads.set(fileId, {
        file,
        chunks,
        uploadedChunks: new Set(),
        totalChunks: chunks.length,
        resolve,
        reject
      });

      // Start upload
      this.wsService.send({
        type: 'upload.start',
        data: {
          fileId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          totalChunks: chunks.length
        }
      });

      // Upload chunks
      this.uploadChunks(fileId);
    });
  }

  private async splitFileIntoChunks(file: File, chunkSize: number): Promise<ArrayBuffer[]> {
    const chunks: ArrayBuffer[] = [];
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const buffer = await chunk.arrayBuffer();
      chunks.push(buffer);
      offset += chunkSize;
    }

    return chunks;
  }

  private async uploadChunks(fileId: string, concurrency = 3): Promise<void> {
    const upload = this.uploads.get(fileId);
    if (!upload) return;

    const uploadChunk = async (index: number) => {
      if (upload.uploadedChunks.has(index)) return;

      const chunk = upload.chunks[index];
      const hash = await this.calculateHash(chunk);

      this.wsService.send({
        type: 'upload.chunk',
        data: {
          fileId,
          chunkIndex: index,
          chunkSize: chunk.byteLength,
          hash
        }
      });

      // Send binary data
      this.wsService.sendBinary(new Uint8Array(chunk));
      upload.uploadedChunks.add(index);
    };

    // Upload chunks with concurrency control
    const promises: Promise<void>[] = [];
    for (let i = 0; i < upload.chunks.length; i++) {
      if (promises.length >= concurrency) {
        await Promise.race(promises);
        promises.splice(promises.findIndex(p => p), 1);
      }
      promises.push(uploadChunk(i));
    }

    await Promise.all(promises);
  }

  private async calculateHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// Sync Manager
export class SyncManager {
  private wsService: WebSocketService;
  private pendingOperations: SyncOperation[] = [];
  private syncInProgress = false;
  private conflictStrategy: ConflictStrategy = ConflictStrategy.LAST_WRITE_WINS;
  private clientId: string;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
    this.clientId = this.generateClientId();
    this.setupEventListeners();
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventListeners(): void {
    // Listen for state patches from server
    this.wsService.on('state.patch', (data) => {
      this.applyStatePatch(data as StatePatch);
    });

    // Listen for sync events
    this.wsService.on('sync.conflict', (data) => {
      this.handleConflict(data);
    });

    // Listen for collaborative events
    this.wsService.on('presence.update', (data) => {
      this.updatePresence(data);
    });
  }

  // Apply state patch using immer
  private applyStatePatch(patch: StatePatch): void {
    const stores = {
      '/app': useAppStore,
      '/reports': useReportsStore,
      '/findings': useFindingsStore
    };

    // Determine which store to update
    const storePrefix = '/' + patch.path.split('/')[1];
    const store = stores[storePrefix as keyof typeof stores];

    if (!store) {
      console.error('Unknown store for path:', patch.path);
      return;
    }

    // Apply patch
    store.setState(
      produce((state: any) => {
        const pathParts = patch.path.split('/').slice(2); // Remove store prefix
        let current = state;

        // Navigate to the target
        for (let i = 0; i < pathParts.length - 1; i++) {
          current = current[pathParts[i]];
        }

        const lastKey = pathParts[pathParts.length - 1];

        switch (patch.op) {
          case 'add':
            if (Array.isArray(current[lastKey])) {
              current[lastKey].push(patch.value);
            } else {
              current[lastKey] = patch.value;
            }
            break;
          case 'remove':
            if (Array.isArray(current[lastKey])) {
              current[lastKey].splice(patch.value, 1);
            } else {
              delete current[lastKey];
            }
            break;
          case 'replace':
            current[lastKey] = patch.value;
            break;
          case 'move':
            // Implementation for move operation
            break;
          case 'copy':
            // Implementation for copy operation
            break;
        }
      })
    );
  }

  // Queue operation for sync
  queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'clientId'>): void {
    const op: SyncOperation = {
      ...operation,
      id: `${this.clientId}-${Date.now()}`,
      timestamp: Date.now(),
      clientId: this.clientId
    };

    this.pendingOperations.push(op);
    this.processQueue();
  }

  // Process sync queue
  private async processQueue(): Promise<void> {
    if (this.syncInProgress || this.pendingOperations.length === 0) return;
    if (!this.wsService.isConnected) return;

    this.syncInProgress = true;

    while (this.pendingOperations.length > 0) {
      const operation = this.pendingOperations.shift()!;
      
      try {
        await this.wsService.request({
          type: 'sync.operation',
          data: operation
        });
      } catch (error) {
        // Re-queue on failure
        this.pendingOperations.unshift(operation);
        break;
      }
    }

    this.syncInProgress = false;
  }

  // Handle sync conflicts
  private handleConflict(conflict: any): void {
    switch (this.conflictStrategy) {
      case ConflictStrategy.LAST_WRITE_WINS:
        // Apply the latest change
        if (conflict.remote.timestamp > conflict.local.timestamp) {
          this.applyStatePatch(conflict.remote);
        }
        break;
      case ConflictStrategy.FIRST_WRITE_WINS:
        // Keep the first change
        if (conflict.local.timestamp < conflict.remote.timestamp) {
          // Do nothing, keep local
        } else {
          this.applyStatePatch(conflict.remote);
        }
        break;
      case ConflictStrategy.MERGE:
        // Attempt to merge changes
        this.mergeConflict(conflict);
        break;
      case ConflictStrategy.MANUAL:
        // Notify user to resolve manually
        useAppStore.getState().addNotification({
          id: `conflict-${conflict.id}`,
          type: 'warning',
          title: 'Sync Conflict',
          message: 'A sync conflict requires manual resolution',
          action: {
            label: 'Resolve',
            onClick: () => this.showConflictResolution(conflict)
          }
        });
        break;
    }
  }

  // Merge conflicting changes
  private mergeConflict(conflict: any): void {
    // Implementation depends on the type of data
    // For now, we'll use a simple merge strategy
    const merged = {
      ...conflict.local.data,
      ...conflict.remote.data,
      _merged: true,
      _mergedAt: Date.now()
    };

    this.applyStatePatch({
      path: conflict.path,
      op: 'replace',
      value: merged
    });
  }

  // Show conflict resolution UI
  private showConflictResolution(conflict: any): void {
    // This would open a modal or panel for manual conflict resolution
    console.log('Show conflict resolution UI for:', conflict);
  }

  // Update presence for collaborative features
  private updatePresence(data: any): void {
    // Update user presence in the UI
    // This could show cursors, selections, or active users
    console.log('Presence update:', data);
  }

  // Get sync state
  getSyncState(): {
    connected: boolean;
    pending: number;
    syncing: boolean;
    strategy: ConflictStrategy;
  } {
    return {
      connected: this.wsService.isConnected,
      pending: this.pendingOperations.length,
      syncing: this.syncInProgress,
      strategy: this.conflictStrategy
    };
  }

  // Set conflict resolution strategy
  setConflictStrategy(strategy: ConflictStrategy): void {
    this.conflictStrategy = strategy;
  }

  // Force sync
  async forceSync(): Promise<void> {
    await this.processQueue();
  }
}

// Create and export singleton instances
let syncManagerInstance: SyncManager | null = null;
let uploadBridgeInstance: UploadWebSocketBridge | null = null;

export function getSyncManager(wsService: WebSocketService): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager(wsService);
  }
  return syncManagerInstance;
}

export function getUploadBridge(wsService: WebSocketService, onProgress?: (progress: number) => void): UploadWebSocketBridge {
  if (!uploadBridgeInstance) {
    uploadBridgeInstance = new UploadWebSocketBridge({ wsService, onProgress });
  }
  return uploadBridgeInstance;
}