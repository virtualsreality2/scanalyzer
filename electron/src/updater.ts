/**
 * Auto-updater module for Scanalyzer
 * Handles application updates with differential downloads and rollback capability
 */
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { EventEmitter } from 'events';
import log from 'electron-log';
import path from 'path';
import fs from 'fs-extra';

interface UpdateConfig {
  allowPrerelease: boolean;
  allowDowngrade: boolean;
  channel: string;
  serverUrl?: string;
}

interface UpdateStatus {
  updateAvailable: boolean;
  downloadProgress: number;
  currentVersion: string;
  channel: string;
  lastCheck?: Date;
  error?: string;
}

export class ApplicationUpdater extends EventEmitter {
  private config: UpdateConfig;
  private mainWindow: BrowserWindow | null = null;
  private updateAvailable = false;
  private downloadProgress = 0;
  private backupPath: string;
  private lastCheck?: Date;
  private updateInfo?: UpdateInfo;
  
  constructor(config: Partial<UpdateConfig> = {}) {
    super();
    
    this.config = {
      allowPrerelease: false,
      allowDowngrade: false,
      channel: 'latest',
      ...config
    };
    
    this.backupPath = path.join(app.getPath('userData'), 'update-backup');
    this.setupUpdater();
    this.setupIpcHandlers();
  }
  
  private setupUpdater(): void {
    // Configure auto-updater
    autoUpdater.logger = log;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = this.config.allowPrerelease;
    autoUpdater.allowDowngrade = this.config.allowDowngrade;
    autoUpdater.channel = this.config.channel;
    
    // Set feed URL if provided
    if (this.config.serverUrl) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: this.config.serverUrl,
        channel: this.config.channel
      });
    }
    
    // Event handlers
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
      this.lastCheck = new Date();
      this.sendToWindow('update-checking');
    });
    
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info('Update available:', info.version);
      this.updateAvailable = true;
      this.updateInfo = info;
      this.sendToWindow('update-available', info);
      this.emit('update-available', info);
      
      // Show notification
      this.showUpdateNotification(info);
    });
    
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      log.info('No updates available');
      this.sendToWindow('update-not-available', info);
    });
    
    autoUpdater.on('error', (error: Error) => {
      log.error('Update error:', error);
      this.sendToWindow('update-error', error.message);
      this.emit('update-error', error);
    });
    
    autoUpdater.on('download-progress', (progressObj) => {
      this.downloadProgress = progressObj.percent;
      this.sendToWindow('update-download-progress', progressObj);
      this.emit('download-progress', progressObj);
      
      // Update progress in taskbar (Windows/macOS)
      if (this.mainWindow) {
        this.mainWindow.setProgressBar(progressObj.percent / 100);
      }
    });
    
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      log.info('Update downloaded:', info.version);
      this.sendToWindow('update-downloaded', info);
      this.emit('update-downloaded', info);
      
      // Clear progress bar
      if (this.mainWindow) {
        this.mainWindow.setProgressBar(-1);
      }
      
      // Create backup before installing
      this.createBackup().catch(err => {
        log.error('Failed to create backup:', err);
      });
      
      // Show install notification
      this.showInstallNotification(info);
    });
  }
  
  private setupIpcHandlers(): void {
    ipcMain.handle('updater:check', async () => {
      return this.checkForUpdates();
    });
    
    ipcMain.handle('updater:download', async () => {
      return this.downloadUpdate();
    });
    
    ipcMain.handle('updater:install', async () => {
      return this.installUpdate();
    });
    
    ipcMain.handle('updater:get-status', async (): Promise<UpdateStatus> => {
      return {
        updateAvailable: this.updateAvailable,
        downloadProgress: this.downloadProgress,
        currentVersion: app.getVersion(),
        channel: this.config.channel,
        lastCheck: this.lastCheck
      };
    });
    
    ipcMain.handle('updater:set-channel', async (_, channel: string) => {
      this.config.channel = channel;
      autoUpdater.channel = channel;
      return this.checkForUpdates();
    });
    
    ipcMain.handle('updater:get-release-notes', async () => {
      return this.updateInfo?.releaseNotes || '';
    });
    
    ipcMain.handle('updater:open-release-notes', async () => {
      if (this.updateInfo?.releaseNotes) {
        const releaseUrl = `https://github.com/${process.env.GITHUB_OWNER || 'scanalyzer'}/${process.env.GITHUB_REPO || 'scanalyzer'}/releases/tag/v${this.updateInfo.version}`;
        shell.openExternal(releaseUrl);
      }
    });
  }
  
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }
  
  private sendToWindow(channel: string, data?: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(`updater:${channel}`, data);
    }
  }
  
  public async checkForUpdates(): Promise<boolean> {
    try {
      const result = await autoUpdater.checkForUpdates();
      return result !== null;
    } catch (error) {
      log.error('Failed to check for updates:', error);
      return false;
    }
  }
  
  public async checkForUpdatesInBackground(): Promise<void> {
    // Check for updates silently
    try {
      await autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      log.error('Background update check failed:', error);
    }
  }
  
  public async downloadUpdate(): Promise<void> {
    if (!this.updateAvailable) {
      throw new Error('No update available to download');
    }
    
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Failed to download update:', error);
      throw error;
    }
  }
  
  public async installUpdate(): Promise<void> {
    const dialogResult = await dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'Install Update',
      message: `Install Scanalyzer ${this.updateInfo?.version}?`,
      detail: 'The application will restart to apply the update. Your work will be saved automatically.',
      buttons: ['Install Now', 'Install on Quit', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });
    
    if (dialogResult.response === 0) {
      // Install now
      await this.saveApplicationState();
      
      setImmediate(() => {
        app.removeAllListeners('window-all-closed');
        if (this.mainWindow) {
          this.mainWindow.close();
        }
        autoUpdater.quitAndInstall(false, true);
      });
    } else if (dialogResult.response === 1) {
      // Install on quit
      autoUpdater.autoInstallOnAppQuit = true;
      this.sendToWindow('update-scheduled');
    }
  }
  
  private async showUpdateNotification(info: UpdateInfo): Promise<void> {
    if (!this.mainWindow) return;
    
    const notification = {
      title: 'Update Available',
      body: `Scanalyzer ${info.version} is available. Current version: ${app.getVersion()}`,
      actions: [
        { type: 'button', text: 'Download' },
        { type: 'button', text: 'Later' }
      ]
    };
    
    // Send notification to renderer
    this.sendToWindow('show-notification', notification);
  }
  
  private async showInstallNotification(info: UpdateInfo): Promise<void> {
    if (!this.mainWindow) return;
    
    const notification = {
      title: 'Update Ready',
      body: `Scanalyzer ${info.version} has been downloaded and is ready to install.`,
      actions: [
        { type: 'button', text: 'Install Now' },
        { type: 'button', text: 'Install Later' }
      ]
    };
    
    // Send notification to renderer
    this.sendToWindow('show-notification', notification);
  }
  
  private async createBackup(): Promise<void> {
    try {
      // Create backup of current installation
      const appPath = app.getAppPath();
      const backupDir = path.join(this.backupPath, app.getVersion());
      
      await fs.ensureDir(backupDir);
      
      // Backup critical files only
      const filesToBackup = [
        'package.json',
        'resources/app.asar',
        'resources/app.asar.unpacked'
      ];
      
      for (const file of filesToBackup) {
        const sourcePath = path.join(appPath, '..', file);
        const destPath = path.join(backupDir, file);
        
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath, { overwrite: true });
        }
      }
      
      // Keep only last 3 backups
      await this.cleanOldBackups();
      
      log.info('Backup created at:', backupDir);
    } catch (error) {
      log.error('Failed to create backup:', error);
    }
  }
  
  private async cleanOldBackups(): Promise<void> {
    try {
      const backups = await fs.readdir(this.backupPath);
      const sortedBackups = backups.sort().reverse();
      
      // Keep only the 3 most recent backups
      for (let i = 3; i < sortedBackups.length; i++) {
        const backupToRemove = path.join(this.backupPath, sortedBackups[i]);
        await fs.remove(backupToRemove);
        log.info('Removed old backup:', sortedBackups[i]);
      }
    } catch (error) {
      log.error('Failed to clean old backups:', error);
    }
  }
  
  public async rollbackUpdate(): Promise<void> {
    try {
      const backups = await fs.readdir(this.backupPath);
      if (backups.length === 0) {
        throw new Error('No backup available for rollback');
      }
      
      // Get the most recent backup
      const latestBackup = backups.sort().reverse()[0];
      const backupDir = path.join(this.backupPath, latestBackup);
      
      const dialogResult = await dialog.showMessageBox(this.mainWindow!, {
        type: 'warning',
        title: 'Rollback Update',
        message: `Rollback to version ${latestBackup}?`,
        detail: 'This will restore the previous version of the application.',
        buttons: ['Rollback', 'Cancel'],
        defaultId: 1,
        cancelId: 1
      });
      
      if (dialogResult.response === 0) {
        // Perform rollback
        const appPath = app.getAppPath();
        await fs.copy(backupDir, path.join(appPath, '..'), { overwrite: true });
        
        log.info('Update rolled back to version:', latestBackup);
        
        // Restart application
        app.relaunch();
        app.exit(0);
      }
    } catch (error) {
      log.error('Failed to rollback update:', error);
      throw error;
    }
  }
  
  private async saveApplicationState(): Promise<void> {
    try {
      // Save current state to restore after update
      const state = {
        version: app.getVersion(),
        timestamp: new Date().toISOString(),
        windows: BrowserWindow.getAllWindows().map(win => ({
          bounds: win.getBounds(),
          isMaximized: win.isMaximized(),
          isMinimized: win.isMinimized(),
          isFullScreen: win.isFullScreen()
        }))
      };
      
      const statePath = path.join(app.getPath('userData'), 'update-state.json');
      await fs.writeJson(statePath, state);
      
      log.info('Application state saved');
    } catch (error) {
      log.error('Failed to save application state:', error);
    }
  }
  
  public async restoreApplicationState(): Promise<void> {
    try {
      const statePath = path.join(app.getPath('userData'), 'update-state.json');
      if (await fs.pathExists(statePath)) {
        const state = await fs.readJson(statePath);
        
        // Restore window positions and states
        if (state.windows && state.windows.length > 0 && this.mainWindow) {
          const mainWindowState = state.windows[0];
          
          if (mainWindowState.isFullScreen) {
            this.mainWindow.setFullScreen(true);
          } else if (mainWindowState.isMaximized) {
            this.mainWindow.maximize();
          } else {
            this.mainWindow.setBounds(mainWindowState.bounds);
          }
          
          if (mainWindowState.isMinimized) {
            this.mainWindow.minimize();
          }
        }
        
        await fs.remove(statePath);
        log.info('Application state restored');
      }
    } catch (error) {
      log.error('Failed to restore application state:', error);
    }
  }
  
  /**
   * Initialize periodic update checks
   */
  public startPeriodicChecks(intervalHours: number = 4): void {
    // Initial check after 30 seconds
    setTimeout(() => {
      this.checkForUpdatesInBackground();
    }, 30000);
    
    // Periodic checks
    setInterval(() => {
      this.checkForUpdatesInBackground();
    }, intervalHours * 60 * 60 * 1000);
  }
}

// Create singleton instance
let updaterInstance: ApplicationUpdater | null = null;

export function getUpdater(config?: Partial<UpdateConfig>): ApplicationUpdater {
  if (!updaterInstance) {
    updaterInstance = new ApplicationUpdater(config);
  }
  return updaterInstance;
}

// Update UI Component
export function createUpdateUI(window: BrowserWindow): void {
  // Inject update UI styles and component
  window.webContents.on('did-finish-load', () => {
    window.webContents.executeJavaScript(`
      // Create update notification container
      if (!document.getElementById('update-notification')) {
        const updateContainer = document.createElement('div');
        updateContainer.id = 'update-notification';
        updateContainer.style.cssText = \`
          position: fixed;
          top: 20px;
          right: 20px;
          background: #2196F3;
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: none;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: slideIn 0.3s ease-out;
          max-width: 400px;
        \`;
        
        updateContainer.innerHTML = \`
          <div id="update-content">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="flex: 1;">
                <div id="update-title" style="font-weight: 600; margin-bottom: 4px;">Update Available</div>
                <div id="update-message" style="font-size: 14px; opacity: 0.9;">A new version is ready to install</div>
              </div>
              <button id="update-action-btn" style="
                background: white;
                color: #2196F3;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
              " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Download</button>
              <button id="update-dismiss-btn" style="
                background: transparent;
                color: white;
                border: 1px solid rgba(255,255,255,0.5);
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
              " onmouseover="this.style.borderColor='white'" onmouseout="this.style.borderColor='rgba(255,255,255,0.5)'">Later</button>
            </div>
            <div id="update-progress" style="
              display: none;
              margin-top: 12px;
              background: rgba(255,255,255,0.2);
              border-radius: 4px;
              height: 4px;
              overflow: hidden;
            ">
              <div id="update-progress-bar" style="
                background: white;
                height: 100%;
                width: 0%;
                transition: width 0.3s;
              "></div>
            </div>
            <div id="update-details" style="
              display: none;
              margin-top: 12px;
              font-size: 13px;
              opacity: 0.9;
            ">
              <div id="update-size"></div>
              <div id="update-speed"></div>
            </div>
          </div>
        \`;
        
        document.body.appendChild(updateContainer);
        
        // Add animation keyframes
        const style = document.createElement('style');
        style.textContent = \`
          @keyframes slideIn {
            from {
              transform: translateX(420px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.8; }
            100% { opacity: 1; }
          }
        \`;
        document.head.appendChild(style);
        
        // Handle update events
        window.electron.ipcRenderer.on('updater:update-available', (event, info) => {
          document.getElementById('update-notification').style.display = 'block';
          document.getElementById('update-message').textContent = \`Version \${info.version} is available\`;
        });
        
        window.electron.ipcRenderer.on('updater:update-download-progress', (event, progress) => {
          document.getElementById('update-progress').style.display = 'block';
          document.getElementById('update-details').style.display = 'block';
          document.getElementById('update-progress-bar').style.width = progress.percent + '%';
          document.getElementById('update-action-btn').textContent = Math.round(progress.percent) + '%';
          document.getElementById('update-action-btn').disabled = true;
          
          // Show download details
          const bytesPerSecond = progress.bytesPerSecond || 0;
          const speed = (bytesPerSecond / 1024 / 1024).toFixed(1);
          document.getElementById('update-speed').textContent = \`Download speed: \${speed} MB/s\`;
          
          const transferred = ((progress.transferred || 0) / 1024 / 1024).toFixed(1);
          const total = ((progress.total || 0) / 1024 / 1024).toFixed(1);
          document.getElementById('update-size').textContent = \`Downloaded: \${transferred} / \${total} MB\`;
        });
        
        window.electron.ipcRenderer.on('updater:update-downloaded', () => {
          document.getElementById('update-title').textContent = 'Update Ready';
          document.getElementById('update-message').textContent = 'Click to restart and install';
          document.getElementById('update-action-btn').textContent = 'Restart Now';
          document.getElementById('update-action-btn').disabled = false;
          document.getElementById('update-progress').style.display = 'none';
          document.getElementById('update-details').style.display = 'none';
          
          // Add pulse animation
          document.getElementById('update-notification').style.animation = 'pulse 2s infinite';
        });
        
        // Button handlers
        document.getElementById('update-action-btn').onclick = async () => {
          const btn = document.getElementById('update-action-btn');
          if (btn.textContent === 'Download') {
            await window.electron.ipcRenderer.invoke('updater:download');
          } else if (btn.textContent === 'Restart Now') {
            await window.electron.ipcRenderer.invoke('updater:install');
          }
        };
        
        document.getElementById('update-dismiss-btn').onclick = () => {
          document.getElementById('update-notification').style.display = 'none';
        };
      }
    `);
  });
}