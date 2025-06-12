import { app, BrowserWindow, shell, protocol, crashReporter } from 'electron';
import log from 'electron-log';
import * as path from 'path';
import { WindowManager } from './window';
import { setupIpcHandlers } from './ipc';
import { createApplicationMenu } from './menu';
import { BackendManager } from './backend';
import { isDevelopment, isProduction } from './utils/env';
import { getUpdater, createUpdateUI } from '../src/updater';

// Get directory path
const __dirname = path.dirname(__filename);

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = isDevelopment() ? 'debug' : 'error';

// Initialize crash reporter
if (isProduction()) {
  crashReporter.start({
    productName: 'Scanalyzer',
    companyName: 'Scanalyzer',
    submitURL: 'https://crash.scanalyzer.app/submit',
    uploadToServer: true
  });
}

// Managers
let windowManager: WindowManager;
let backendManager: BackendManager;

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Security: Validate navigation requests
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Only allow navigation to app URLs
    if (parsedUrl.origin !== 'file://' && !parsedUrl.origin.startsWith('http://localhost')) {
      event.preventDefault();
      log.warn(`Blocked navigation to: ${navigationUrl}`);
    }
  });
});

// Single instance enforcement
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus existing window when second instance is attempted
    if (windowManager) {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
    
    // Handle deep link on second instance
    const url = commandLine.find(arg => arg.startsWith('scanalyzer://'));
    if (url) {
      handleDeepLink(url);
    }
  });
}

// Deep linking setup
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('scanalyzer', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('scanalyzer');
}

// Handle deep links
function handleDeepLink(url: string) {
  log.info(`Handling deep link: ${url}`);
  
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    
    if (pathParts.length >= 2) {
      const [action, target, ...params] = pathParts;
      
      // Send to renderer
      const mainWindow = windowManager?.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('deep-link', {
          protocol: parsedUrl.protocol,
          action,
          target,
          params,
          query: parsedUrl.searchParams.toString()
        });
      }
    }
  } catch (error) {
    log.error('Failed to parse deep link:', error);
  }
}

// App event handlers
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.whenReady().then(async () => {
  // Set app user model ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.scanalyzer.app');
  }
  
  // Initialize managers
  windowManager = new WindowManager();
  backendManager = new BackendManager();
  
  // Create application menu
  createApplicationMenu();
  
  // Setup IPC handlers
  setupIpcHandlers(windowManager, backendManager);
  
  // Start backend process
  try {
    await backendManager.start();
  } catch (error) {
    log.error('Failed to start backend:', error);
  }
  
  // Create main window
  const mainWindow = await windowManager.createMainWindow();
  
  // Setup auto-updater
  if (isProduction()) {
    const updater = getUpdater({
      allowPrerelease: false,
      allowDowngrade: false,
      channel: 'latest'
    });
    
    updater.setMainWindow(mainWindow);
    createUpdateUI(mainWindow);
    updater.startPeriodicChecks(4); // Check every 4 hours
    
    // Check for updates after 30 seconds
    setTimeout(() => {
      updater.checkForUpdatesInBackground();
    }, 30000);
  }
});

// Handle app activation (macOS)
app.on('activate', async () => {
  if (windowManager && windowManager.getAllWindows().length === 0) {
    await windowManager.createMainWindow();
  }
});

// Handle window all closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle before quit
app.on('before-quit', async (event) => {
  log.info('Application shutting down...');
  
  // Prevent default quit
  event.preventDefault();
  
  try {
    // Stop backend process
    if (backendManager) {
      await backendManager.stop();
    }
    
    // Save window states
    if (windowManager) {
      windowManager.saveAllWindowStates();
    }
    
    // Now quit
    app.exit(0);
  } catch (error) {
    log.error('Error during shutdown:', error);
    app.exit(1);
  }
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDevelopment()) {
    // Ignore certificate errors in development
    event.preventDefault();
    callback(true);
  } else {
    // Use default behavior in production
    callback(false);
  }
});

// Auto-updater events
autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  const mainWindow = windowManager?.getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:update-available', info);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
  const mainWindow = windowManager?.getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:update-downloaded', info);
  }
});

autoUpdater.on('download-progress', (progress) => {
  const mainWindow = windowManager?.getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:update-progress', progress);
  }
});

autoUpdater.on('error', (error) => {
  log.error('Auto-updater error:', error);
});

// Export for testing
export { windowManager, backendManager };