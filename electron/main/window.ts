import { BrowserWindow, screen, nativeTheme, BrowserWindowConstructorOptions } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import log from 'electron-log';
import { isDevelopment } from './utils/env';

const __dirname = path.dirname(__filename);

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

interface WindowConfig {
  id: string;
  title: string;
  minWidth?: number;
  minHeight?: number;
  defaultWidth: number;
  defaultHeight: number;
  resizable?: boolean;
  center?: boolean;
  parent?: BrowserWindow;
}

export class WindowManager {
  private windows: Map<string, BrowserWindow>;
  private store: Store;
  private readonly MIN_WIDTH = 1024;
  private readonly MIN_HEIGHT = 768;

  constructor() {
    this.windows = new Map();
    this.store = new Store({ name: 'window-state' });
  }

  async createMainWindow(): Promise<BrowserWindow> {
    const config: WindowConfig = {
      id: 'main',
      title: 'Scanalyzer',
      minWidth: this.MIN_WIDTH,
      minHeight: this.MIN_HEIGHT,
      defaultWidth: 1280,
      defaultHeight: 800,
      resizable: true,
      center: true
    };

    return this.createWindow(config);
  }

  async createWindow(config: WindowConfig): Promise<BrowserWindow> {
    // Get saved window state
    const savedState = this.getSavedWindowState(config.id);
    
    // Validate window position
    const windowState = this.validateWindowState({
      ...savedState,
      width: savedState?.width || config.defaultWidth,
      height: savedState?.height || config.defaultHeight
    });

    // Platform-specific options
    const platformOptions = this.getPlatformOptions();

    // Create window options
    const windowOptions: BrowserWindowConstructorOptions = {
      title: config.title,
      width: windowState.width,
      height: windowState.height,
      x: windowState.x,
      y: windowState.y,
      minWidth: config.minWidth || this.MIN_WIDTH,
      minHeight: config.minHeight || this.MIN_HEIGHT,
      resizable: config.resizable !== false,
      center: windowState.x === undefined && windowState.y === undefined && config.center,
      show: false, // Don't show until ready
      frame: process.platform !== 'win32', // Custom frame on Windows
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 16 } : undefined,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'dist', 'electron', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
      ...platformOptions
    };

    // Add parent if specified
    if (config.parent) {
      windowOptions.parent = config.parent;
      windowOptions.modal = true;
    }

    // Create window
    const window = new BrowserWindow(windowOptions);

    // Store window reference
    this.windows.set(config.id, window);

    // Setup window event handlers
    this.setupWindowEventHandlers(window, config.id);

    // Load content
    if (isDevelopment()) {
      // Load from Vite dev server
      await window.loadURL('http://localhost:5173');
      
      // Open DevTools in development
      window.webContents.openDevTools();
    } else {
      // Load from built files
      const indexPath = path.join(__dirname, '..', '..', 'dist', 'index.html');
      await window.loadFile(indexPath);
    }

    // Restore window state
    if (savedState?.isMaximized) {
      window.maximize();
    }
    if (savedState?.isFullScreen) {
      window.setFullScreen(true);
    }

    // Show window when ready
    window.once('ready-to-show', () => {
      window.show();
      
      // Focus window
      if (config.id === 'main') {
        window.focus();
      }
    });

    // Set Content Security Policy
    window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'", // Required for some UI libraries
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self' http://localhost:* ws://localhost:*", // For dev server and backend
            "media-src 'self'",
            "object-src 'none'",
            "frame-src 'none'",
            "worker-src 'self'",
            "form-action 'self'",
            "base-uri 'self'",
            "manifest-src 'self'"
          ].join('; ')
        }
      });
    });

    log.info(`Window created: ${config.id}`);
    return window;
  }

  private setupWindowEventHandlers(window: BrowserWindow, id: string): void {
    // Track window state changes
    let windowState: WindowState | null = null;

    const updateWindowState = () => {
      if (window.isDestroyed()) return;

      const bounds = window.getBounds();
      windowState = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: window.isMaximized(),
        isFullScreen: window.isFullScreen()
      };
    };

    // Update state on resize and move
    window.on('resize', updateWindowState);
    window.on('move', updateWindowState);
    window.on('maximize', updateWindowState);
    window.on('unmaximize', updateWindowState);
    window.on('enter-full-screen', updateWindowState);
    window.on('leave-full-screen', updateWindowState);

    // Save state before close
    window.on('close', () => {
      if (windowState) {
        this.saveWindowState(id, windowState);
      }
    });

    // Remove from map when closed
    window.on('closed', () => {
      this.windows.delete(id);
      log.info(`Window closed: ${id}`);
    });

    // Handle maximize state changes
    window.on('maximize', () => {
      window.webContents.send('window:maximize-change', true);
    });

    window.on('unmaximize', () => {
      window.webContents.send('window:maximize-change', false);
    });

    // Handle fullscreen state changes
    window.on('enter-full-screen', () => {
      window.webContents.send('window:fullscreen-change', true);
    });

    window.on('leave-full-screen', () => {
      window.webContents.send('window:fullscreen-change', false);
    });

    // Prevent navigation away from app
    window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('file://') && !url.startsWith('http://localhost')) {
        event.preventDefault();
        log.warn(`Navigation blocked: ${url}`);
      }
    });
  }

  private validateWindowState(state: WindowState): WindowState {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();

    // Default to primary display center
    let validState: WindowState = {
      width: Math.max(state.width, this.MIN_WIDTH),
      height: Math.max(state.height, this.MIN_HEIGHT)
    };

    // Check if saved position is still valid
    if (state.x !== undefined && state.y !== undefined) {
      const displayAtPoint = screen.getDisplayNearestPoint({ x: state.x, y: state.y });
      
      // Ensure window is visible on screen
      if (displayAtPoint) {
        const workArea = displayAtPoint.workArea;
        
        // Adjust position if necessary
        validState.x = Math.max(workArea.x, Math.min(state.x, workArea.x + workArea.width - validState.width));
        validState.y = Math.max(workArea.y, Math.min(state.y, workArea.y + workArea.height - validState.height));
      }
    }

    validState.isMaximized = state.isMaximized;
    validState.isFullScreen = state.isFullScreen;

    return validState;
  }

  private getPlatformOptions(): Partial<BrowserWindowConstructorOptions> {
    const options: Partial<BrowserWindowConstructorOptions> = {};

    if (process.platform === 'darwin') {
      // macOS specific
      options.vibrancy = 'sidebar';
      options.visualEffectState = 'active';
    } else if (process.platform === 'win32') {
      // Windows specific
      options.transparent = false;
      options.hasShadow = true;
    }

    return options;
  }

  private getSavedWindowState(id: string): WindowState | null {
    try {
      return this.store.get(`window-state-${id}`) as WindowState | null;
    } catch (error) {
      log.error(`Failed to get saved window state for ${id}:`, error);
      return null;
    }
  }

  private saveWindowState(id: string, state: WindowState): void {
    try {
      this.store.set(`window-state-${id}`, state);
    } catch (error) {
      log.error(`Failed to save window state for ${id}:`, error);
    }
  }

  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  getMainWindow(): BrowserWindow | undefined {
    return this.windows.get('main');
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }

  closeWindow(id: string): void {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  closeAllWindows(): void {
    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
  }

  saveAllWindowStates(): void {
    for (const [id, window] of this.windows.entries()) {
      if (!window.isDestroyed()) {
        const bounds = window.getBounds();
        const state: WindowState = {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: window.isMaximized(),
          isFullScreen: window.isFullScreen()
        };
        this.saveWindowState(id, state);
      }
    }
  }
}