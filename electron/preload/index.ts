import { contextBridge, ipcRenderer } from 'electron';

// Window control APIs
const windowAPI = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
  
  // Event listeners
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: any, isMaximized: boolean) => callback(isMaximized);
    ipcRenderer.on('window:maximize-change', listener);
    return () => ipcRenderer.removeListener('window:maximize-change', listener);
  },
  
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    const listener = (_event: any, isFullscreen: boolean) => callback(isFullscreen);
    ipcRenderer.on('window:fullscreen-change', listener);
    return () => ipcRenderer.removeListener('window:fullscreen-change', listener);
  },
  
  removeMaximizeListener: (callback: Function) => {
    ipcRenderer.removeAllListeners('window:maximize-change');
  },
  
  removeFullscreenListener: (callback: Function) => {
    ipcRenderer.removeAllListeners('window:fullscreen-change');
  },
};

// Platform detection API
const platformAPI = {
  get: (): Promise<'windows' | 'macos' | 'linux'> => ipcRenderer.invoke('platform:get'),
  isWindows: () => process.platform === 'win32',
  isMacOS: () => process.platform === 'darwin',
  isLinux: () => process.platform === 'linux',
};

// File system APIs for reports
const fileAPI = {
  openFile: (options?: Electron.OpenDialogOptions) => 
    ipcRenderer.invoke('file:open', options),
  
  saveFile: (options?: Electron.SaveDialogOptions) => 
    ipcRenderer.invoke('file:save', options),
  
  readFile: (filePath: string) => 
    ipcRenderer.invoke('file:read', filePath),
  
  writeFile: (filePath: string, data: string) => 
    ipcRenderer.invoke('file:write', filePath, data),
};

// Backend process control
const backendAPI = {
  start: () => ipcRenderer.invoke('backend:start'),
  stop: () => ipcRenderer.invoke('backend:stop'),
  restart: () => ipcRenderer.invoke('backend:restart'),
  getStatus: () => ipcRenderer.invoke('backend:status'),
  
  onStatusChange: (callback: (status: string) => void) => {
    const listener = (_event: any, status: string) => callback(status);
    ipcRenderer.on('backend:status-change', listener);
    return () => ipcRenderer.removeListener('backend:status-change', listener);
  },
};

// App info and updates
const appAPI = {
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  logError: (error: { error: string; errorInfo?: string; timestamp: string }) => 
    ipcRenderer.invoke('app:log-error', error),
  
  onUpdateAvailable: (callback: (info: any) => void) => {
    const listener = (_event: any, info: any) => callback(info);
    ipcRenderer.on('app:update-available', listener);
    return () => ipcRenderer.removeListener('app:update-available', listener);
  },
  
  onUpdateProgress: (callback: (progress: any) => void) => {
    const listener = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('app:update-progress', listener);
    return () => ipcRenderer.removeListener('app:update-progress', listener);
  },
};

// Storage and settings
const storageAPI = {
  get: (key: string) => ipcRenderer.invoke('storage:get', key),
  set: (key: string, value: any) => ipcRenderer.invoke('storage:set', key, value),
  delete: (key: string) => ipcRenderer.invoke('storage:delete', key),
  clear: () => ipcRenderer.invoke('storage:clear'),
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  window: windowAPI,
  platform: platformAPI,
  file: fileAPI,
  backend: backendAPI,
  app: appAPI,
  storage: storageAPI,
});

// Type definitions for TypeScript
export interface ElectronAPI {
  window: typeof windowAPI;
  platform: typeof platformAPI;
  file: typeof fileAPI;
  backend: typeof backendAPI;
  app: typeof appAPI;
  storage: typeof storageAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}