import { Menu, MenuItemConstructorOptions, shell, app, BrowserWindow } from 'electron';
import { isDevelopment } from './utils/env';
import log from 'electron-log';

export function createApplicationMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            // Open preferences window
            log.info('Open preferences');
          }
        },
        { type: 'separator' as const },
        { role: 'services' as const, submenu: [] },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ] as MenuItemConstructorOptions[]
    }] : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Report...',
          accelerator: 'CmdOrCtrl+O',
          click: async (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('menu:open-file');
            }
          }
        },
        {
          label: 'Open Recent',
          submenu: [
            { label: 'Clear Recent', enabled: false }
          ]
        },
        { type: 'separator' },
        {
          label: 'Save Report',
          accelerator: 'CmdOrCtrl+S',
          click: async (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('menu:save-file');
            }
          }
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('menu:save-file-as');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as CSV',
              click: async (menuItem, browserWindow) => {
                if (browserWindow) {
                  browserWindow.webContents.send('menu:export', 'csv');
                }
              }
            },
            {
              label: 'Export as PDF',
              click: async (menuItem, browserWindow) => {
                if (browserWindow) {
                  browserWindow.webContents.send('menu:export', 'pdf');
                }
              }
            }
          ]
        },
        { type: 'separator' },
        ...(!isMac ? [
          { type: 'separator' as const },
          { role: 'quit' as const }
        ] : [])
      ] as MenuItemConstructorOptions[]
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' as const },
              { role: 'stopSpeaking' as const }
            ]
          }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ] as MenuItemConstructorOptions[]
    },

    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: async (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('menu:toggle-sidebar');
            }
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ] as MenuItemConstructorOptions[]
    },

    // Tools menu
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Backend Status',
          click: async (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('menu:backend-status');
            }
          }
        },
        {
          label: 'Restart Backend',
          click: async (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('menu:restart-backend');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Clear Cache',
          click: async (menuItem, browserWindow) => {
            if (browserWindow) {
              await browserWindow.webContents.session.clearCache();
              browserWindow.webContents.send('menu:cache-cleared');
            }
          }
        }
      ]
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [])
      ] as MenuItemConstructorOptions[]
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://docs.scanalyzer.app');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/scanalyzer/scanalyzer/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'View Logs',
          click: async () => {
            const logPath = log.transports.file.getFile().path;
            await shell.showItemInFolder(logPath);
          }
        },
        { type: 'separator' },
        ...(!isMac ? [
          {
            label: 'About Scanalyzer',
            click: async (menuItem, browserWindow) => {
              if (browserWindow) {
                browserWindow.webContents.send('menu:about');
              }
            }
          }
        ] : [])
      ] as MenuItemConstructorOptions[]
    }
  ];

  // Add development menu in dev mode
  if (isDevelopment()) {
    template.push({
      label: 'Development',
      submenu: [
        {
          label: 'Open DevTools',
          accelerator: 'F12',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.openDevTools();
            }
          }
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.reload();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Test Notification',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('test:notification');
            }
          }
        },
        {
          label: 'Test Error',
          click: (menuItem, browserWindow) => {
            if (browserWindow) {
              browserWindow.webContents.send('test:error');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Show App Data',
          click: async () => {
            await shell.openPath(app.getPath('userData'));
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

export function createContextMenu(params: Electron.ContextMenuParams): Menu {
  const template: MenuItemConstructorOptions[] = [];

  // Text selection context menu
  if (params.selectionText) {
    template.push(
      { role: 'copy' },
      { type: 'separator' }
    );
  }

  // Editable field context menu
  if (params.isEditable) {
    template.push(
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    );
  }

  // Link context menu
  if (params.linkURL) {
    template.push(
      {
        label: 'Open Link',
        click: () => {
          shell.openExternal(params.linkURL);
        }
      },
      {
        label: 'Copy Link',
        click: () => {
          const { clipboard } = require('electron');
          clipboard.writeText(params.linkURL);
        }
      }
    );
  }

  // Development options
  if (isDevelopment()) {
    if (template.length > 0) {
      template.push({ type: 'separator' });
    }
    template.push(
      {
        label: 'Inspect Element',
        click: (menuItem, browserWindow) => {
          if (browserWindow) {
            browserWindow.webContents.inspectElement(params.x, params.y);
          }
        }
      }
    );
  }

  return Menu.buildFromTemplate(template);
}