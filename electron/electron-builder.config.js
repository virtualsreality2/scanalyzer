/**
 * Electron Builder Configuration
 * Handles packaging for Windows and macOS with code signing
 */
const { notarize } = require('@electron/notarize');
const path = require('path');

const config = {
  appId: 'com.scanalyzer.app',
  productName: 'Scanalyzer',
  copyright: 'Copyright © 2024 ${author}',
  
  directories: {
    output: 'dist',
    buildResources: 'resources'
  },
  
  files: [
    'dist/**/*',
    'node_modules/**/*',
    '!node_modules/**/test/**',
    '!**/*.map',
    '!**/*.md'
  ],
  
  fileAssociations: [
    {
      ext: 'json',
      name: 'JSON Report',
      description: 'Security scan report in JSON format',
      icon: 'resources/icons/json-file.ico',
      role: 'Editor'
    },
    {
      ext: 'xml',
      name: 'XML Report',
      description: 'Security scan report in XML format',
      icon: 'resources/icons/xml-file.ico',
      role: 'Editor'
    },
    {
      ext: 'pdf',
      name: 'PDF Report',
      description: 'Security scan report in PDF format',
      icon: 'resources/icons/pdf-file.ico',
      role: 'Viewer'
    },
    {
      ext: 'nessus',
      name: 'Nessus Report',
      description: 'Nessus vulnerability scan report',
      icon: 'resources/icons/nessus-file.ico',
      role: 'Editor'
    },
    {
      ext: 'csv',
      name: 'CSV Report',
      description: 'Security findings in CSV format',
      icon: 'resources/icons/csv-file.ico',
      role: 'Editor'
    }
  ],
  
  protocols: [
    {
      name: 'Scanalyzer Protocol',
      schemes: ['scanalyzer']
    }
  ],
  
  // macOS specific configuration
  mac: {
    category: 'public.app-category.developer-tools',
    icon: 'resources/icons/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    darkModeSupport: true,
    
    entitlements: 'resources/entitlements/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements/entitlements.mac.inherit.plist',
    
    extendInfo: {
      NSCameraUsageDescription: 'This app does not use the camera.',
      NSMicrophoneUsageDescription: 'This app does not use the microphone.',
      NSAppleEventsUsageDescription: 'This app needs to send Apple events to other applications.',
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: ['scanalyzer'],
          CFBundleURLName: 'Scanalyzer Protocol'
        }
      ]
    },
    
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ]
  },
  
  dmg: {
    sign: false, // DMG signing handled separately
    background: 'resources/backgrounds/dmg-background.tiff',
    backgroundColor: '#2B2E3B',
    window: {
      width: 600,
      height: 400
    },
    contents: [
      {
        x: 130,
        y: 220,
        type: 'file'
      },
      {
        x: 470,
        y: 220,
        type: 'link',
        path: '/Applications'
      }
    ],
    artifactName: '${productName}-${version}-${os}-${arch}.${ext}'
  },
  
  // Windows specific configuration
  win: {
    icon: 'resources/icons/icon.ico',
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      },
      {
        target: 'zip',
        arch: ['x64']
      }
    ],
    
    certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
    certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
    certificateSubjectName: process.env.WINDOWS_CERTIFICATE_SUBJECT,
    certificateSha1: process.env.WINDOWS_CERTIFICATE_SHA1,
    
    signingHashAlgorithms: ['sha256'],
    rfc3161TimeStampServer: 'http://timestamp.digicert.com',
    
    publisherName: 'Scanalyzer Team',
    verifyUpdateCodeSignature: true
  },
  
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    
    installerIcon: 'resources/icons/installer.ico',
    uninstallerIcon: 'resources/icons/uninstaller.ico',
    installerHeaderIcon: 'resources/icons/header.ico',
    
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    
    include: 'resources/installer/installer.nsh',
    
    license: '../LICENSE',
    
    deleteAppDataOnUninstall: false,
    
    displayLanguageSelector: true,
    menuCategory: 'Security Tools',
    
    artifactName: '${productName}-Setup-${version}-${arch}.${ext}'
  },
  
  // Linux configuration
  linux: {
    icon: 'resources/icons',
    category: 'Development',
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'deb',
        arch: ['x64']
      },
      {
        target: 'rpm',
        arch: ['x64']
      }
    ]
  },
  
  // Auto-updater configuration
  publish: [
    {
      provider: 'github',
      owner: process.env.GITHUB_OWNER || 'scanalyzer',
      repo: process.env.GITHUB_REPO || 'scanalyzer',
      releaseType: 'release',
      publishAutoUpdate: true
    },
    {
      provider: 'generic',
      url: process.env.UPDATE_SERVER_URL || 'https://updates.scanalyzer.com',
      channel: process.env.UPDATE_CHANNEL || 'latest'
    }
  ],
  
  // Build hooks
  afterSign: async (context) => {
    if (process.platform !== 'darwin') return;
    
    const { appOutDir } = context;
    const appName = context.packager.appInfo.productFilename;
    
    if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD) {
      console.warn('⚠️  Skipping notarization: Apple credentials not found');
      return;
    }
    
    console.log('🍎 Starting notarization process...');
    
    try {
      await notarize({
        tool: 'notarytool',
        appBundleId: config.appId,
        appPath: path.join(appOutDir, `${appName}.app`),
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID
      });
      
      console.log('✅ Notarization completed successfully');
    } catch (error) {
      console.error('❌ Notarization failed:', error);
      throw error;
    }
  }
};

// Platform-specific overrides
if (process.platform === 'darwin') {
  config.mac.identity = process.env.APPLE_DEVELOPER_IDENTITY;
}

module.exports = config;