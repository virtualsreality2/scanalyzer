/// <reference types="vite/client" />

interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    isFullscreen?: () => Promise<boolean>;
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
    onFullscreenChange?: (callback: (isFullscreen: boolean) => void) => () => void;
    removeMaximizeListener?: (callback: Function) => void;
    removeFullscreenListener?: (callback: Function) => void;
  };
  platform: {
    get: () => Promise<'windows' | 'macos' | 'linux'>;
    isWindows: () => boolean;
    isMacOS: () => boolean;
    isLinux: () => boolean;
  };
  file: {
    openFile: (options?: any) => Promise<string[] | undefined>;
    saveFile: (options?: any) => Promise<string | undefined>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, data: string) => Promise<void>;
  };
  backend: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    restart: () => Promise<void>;
    getStatus: () => Promise<string>;
    onStatusChange: (callback: (status: string) => void) => () => void;
  };
  app: {
    getVersion: () => Promise<string>;
    checkForUpdates: () => Promise<any>;
    installUpdate: () => Promise<void>;
    onUpdateAvailable: (callback: (info: any) => void) => () => void;
    onUpdateProgress: (callback: (progress: any) => void) => () => void;
    logError?: (error: { error: string; errorInfo?: string; timestamp: string }) => Promise<void>;
  };
  storage: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };
}

interface Window {
  electronAPI: ElectronAPI;
}