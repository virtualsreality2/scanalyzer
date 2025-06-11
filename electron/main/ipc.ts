import { ipcMain, dialog, app, shell } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import log from 'electron-log';
import { WindowManager } from './window';
import { BackendManager } from './backend';
import { validatePath, sanitizePath } from './utils/security';
import Store from 'electron-store';

const store = new Store({ name: 'app-storage' });

export function setupIpcHandlers(windowManager: WindowManager, backendManager: BackendManager): void {
  // Window controls
  ipcMain.handle('window:minimize', async (event) => {
    const window = windowManager.getMainWindow();
    if (window && !window.isDestroyed()) {
      window.minimize();
    }
  });

  ipcMain.handle('window:toggleMaximize', async (event) => {
    const window = windowManager.getMainWindow();
    if (window && !window.isDestroyed()) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.handle('window:close', async (event) => {
    const window = windowManager.getMainWindow();
    if (window && !window.isDestroyed()) {
      window.close();
    }
  });

  ipcMain.handle('window:isMaximized', async (event) => {
    const window = windowManager.getMainWindow();
    return window && !window.isDestroyed() ? window.isMaximized() : false;
  });

  ipcMain.handle('window:isFullscreen', async (event) => {
    const window = windowManager.getMainWindow();
    return window && !window.isDestroyed() ? window.isFullScreen() : false;
  });

  // Platform detection
  ipcMain.handle('platform:get', async () => {
    switch (process.platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      default:
        return 'linux';
    }
  });

  // File operations
  ipcMain.handle('file:open', async (event, options?: Electron.OpenDialogOptions) => {
    const window = windowManager.getMainWindow();
    if (!window || window.isDestroyed()) {
      throw new Error('No active window');
    }

    const defaultOptions: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [
        { name: 'Security Reports', extensions: ['json', 'xml', 'csv', 'pdf', 'docx', 'xlsx'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'Word Documents', extensions: ['docx'] },
        { name: 'Excel Files', extensions: ['xlsx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };

    const result = await dialog.showOpenDialog(window, { ...defaultOptions, ...options });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('file:save', async (event, options?: Electron.SaveDialogOptions) => {
    const window = windowManager.getMainWindow();
    if (!window || window.isDestroyed()) {
      throw new Error('No active window');
    }

    const defaultOptions: Electron.SaveDialogOptions = {
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };

    const result = await dialog.showSaveDialog(window, { ...defaultOptions, ...options });
    
    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  ipcMain.handle('file:read', async (event, filePath: string) => {
    try {
      // Validate and sanitize path
      const safePath = sanitizePath(filePath);
      if (!validatePath(safePath)) {
        throw new Error('Invalid path: Access denied');
      }

      const content = await fs.readFile(safePath, 'utf-8');
      
      // Try to parse as JSON
      try {
        return JSON.parse(content);
      } catch {
        // Return as string if not JSON
        return content;
      }
    } catch (error) {
      log.error('File read error:', error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  });

  ipcMain.handle('file:write', async (event, filePath: string, data: string) => {
    try {
      // Validate and sanitize path
      const safePath = sanitizePath(filePath);
      if (!validatePath(safePath)) {
        throw new Error('Invalid path: Access denied');
      }

      // Ensure directory exists
      const dir = path.dirname(safePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(safePath, data, 'utf-8');
      
      return true;
    } catch (error) {
      log.error('File write error:', error);
      throw new Error(`Failed to write file: ${error.message}`);
    }
  });

  // Backend process control
  ipcMain.handle('backend:start', async () => {
    try {
      await backendManager.start();
      return { success: true };
    } catch (error) {
      log.error('Failed to start backend:', error);
      throw error;
    }
  });

  ipcMain.handle('backend:stop', async () => {
    try {
      await backendManager.stop();
      return { success: true };
    } catch (error) {
      log.error('Failed to stop backend:', error);
      throw error;
    }
  });

  ipcMain.handle('backend:restart', async () => {
    try {
      await backendManager.restart();
      return { success: true };
    } catch (error) {
      log.error('Failed to restart backend:', error);
      throw error;
    }
  });

  ipcMain.handle('backend:status', async () => {
    return backendManager.getStatus();
  });

  // App info and updates
  ipcMain.handle('app:version', async () => {
    return app.getVersion();
  });

  ipcMain.handle('app:check-updates', async () => {
    // Handled by auto-updater in main process
    return { checking: true };
  });

  ipcMain.handle('app:install-update', async () => {
    // Quit and install update
    setImmediate(() => {
      app.quit();
    });
    return { installing: true };
  });

  ipcMain.handle('app:log-error', async (event, error: { error: string; errorInfo?: string; timestamp: string }) => {
    log.error('Renderer error:', error);
    return { logged: true };
  });

  // Storage operations
  ipcMain.handle('storage:get', async (event, key: string) => {
    try {
      return store.get(key);
    } catch (error) {
      log.error('Storage get error:', error);
      return null;
    }
  });

  ipcMain.handle('storage:set', async (event, key: string, value: any) => {
    try {
      store.set(key, value);
      return true;
    } catch (error) {
      log.error('Storage set error:', error);
      return false;
    }
  });

  ipcMain.handle('storage:delete', async (event, key: string) => {
    try {
      store.delete(key);
      return true;
    } catch (error) {
      log.error('Storage delete error:', error);
      return false;
    }
  });

  ipcMain.handle('storage:clear', async () => {
    try {
      store.clear();
      return true;
    } catch (error) {
      log.error('Storage clear error:', error);
      return false;
    }
  });

  // Test/debug handlers (development only)
  if (process.env.NODE_ENV === 'development' || process.env.SPECTRON === 'true') {
    // Shutdown handler for tests
    ipcMain.handle('test:shutdown', async () => {
      app.quit();
    });

    // Deep link data for tests
    ipcMain.handle('test:get-deep-link-data', async () => {
      return global.lastDeepLinkData || null;
    });

    // Crash reporter status
    ipcMain.handle('test:is-crash-reporter-enabled', async () => {
      return process.type === 'browser' && require('electron').crashReporter.getParameters() !== null;
    });

    // Display info
    ipcMain.handle('test:get-displays', async () => {
      return require('electron').screen.getAllDisplays();
    });

    // DevTools toggle
    ipcMain.handle('test:toggle-dev-tools', async () => {
      const window = windowManager.getMainWindow();
      if (window && !window.isDestroyed()) {
        window.webContents.toggleDevTools();
      }
    });

    // Backend status for tests
    ipcMain.handle('test:get-backend-status', async () => {
      return backendManager.getStatus();
    });

    // Simulate backend crash
    ipcMain.handle('test:crash-backend', async () => {
      await backendManager.simulateCrash();
    });

    // Health check
    ipcMain.handle('test:check-backend-health', async () => {
      return backendManager.checkHealth();
    });

    // Menu info
    ipcMain.handle('test:get-application-menu', async () => {
      const Menu = require('electron').Menu;
      const menu = Menu.getApplicationMenu();
      return menu ? menu.items.map(item => ({ label: item.label, submenu: item.submenu?.items })) : null;
    });

    // Platform features
    ipcMain.handle('test:has-native-traffic-lights', async () => {
      return process.platform === 'darwin';
    });

    ipcMain.handle('test:get-vibrancy-effect', async () => {
      const window = windowManager.getMainWindow();
      return window && !window.isDestroyed() ? window.getVibrancy() : null;
    });

    ipcMain.handle('test:has-custom-frame', async () => {
      const window = windowManager.getMainWindow();
      return window && !window.isDestroyed() ? !window.frame : false;
    });
  }

  // Permission request handler
  const mainWindow = windowManager.getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      // Deny all permission requests by default
      const deniedPermissions = [
        'media',
        'camera',
        'microphone',
        'geolocation',
        'notifications',
        'midiSysex',
        'pointerLock',
        'fullscreen',
        'openExternal'
      ];

      if (deniedPermissions.includes(permission)) {
        callback(false);
      } else {
        // Log unexpected permission requests
        log.warn(`Unexpected permission request: ${permission}`);
        callback(false);
      }
    });
  }

  log.info('IPC handlers initialized');
}