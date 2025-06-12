# Getting Started with Scanalyzer

Welcome to Scanalyzer! This guide will walk you through installing and setting up Scanalyzer on your system, uploading your first security report, and understanding the basics of the application.

## System Requirements

Before installing Scanalyzer, ensure your system meets these requirements:

### Minimum Requirements
- **Operating System**: Windows 10, macOS 10.15, or Ubuntu 20.04
- **Processor**: 4-core CPU
- **Memory**: 8 GB RAM
- **Storage**: 2 GB available space
- **Display**: 1920x1080 resolution

### Recommended Requirements
- **Operating System**: Latest Windows 11, macOS, or Ubuntu
- **Processor**: 8-core CPU or better
- **Memory**: 16 GB RAM or more
- **Storage**: SSD with 10 GB available space
- **Display**: 2560x1440 resolution or higher

## Download and Installation

### Windows Installation

1. **Download the Installer**
   - Visit [Scanalyzer Downloads](https://github.com/scanalyzer/scanalyzer/releases)
   - Download `Scanalyzer-Setup-1.0.0.exe`

2. **Run the Installer**
   - Double-click the downloaded file
   - If Windows Defender SmartScreen appears, click "More info" then "Run anyway"
   - Follow the installation wizard:
     - Choose installation directory (default: `C:\Program Files\Scanalyzer`)
     - Select whether to create desktop and start menu shortcuts
     - Click "Install"

3. **First Launch**
   - Launch Scanalyzer from the desktop shortcut or Start menu
   - Windows Firewall may ask for permission - click "Allow access"

### macOS Installation

1. **Download the DMG**
   - Visit [Scanalyzer Downloads](https://github.com/scanalyzer/scanalyzer/releases)
   - Download `Scanalyzer-1.0.0-universal.dmg`

2. **Install the Application**
   - Open the downloaded DMG file
   - Drag Scanalyzer.app to your Applications folder
   - Eject the DMG

3. **First Launch**
   - Open Scanalyzer from Applications
   - macOS may show a security warning:
     - Go to System Preferences > Security & Privacy
     - Click "Open Anyway" next to the Scanalyzer message
   - Grant necessary permissions when prompted

### Linux Installation

#### AppImage (Recommended)
1. **Download AppImage**
   - Visit [Scanalyzer Downloads](https://github.com/scanalyzer/scanalyzer/releases)
   - Download `Scanalyzer-1.0.0.AppImage`

2. **Make Executable**
   ```bash
   chmod +x Scanalyzer-1.0.0.AppImage
   ```

3. **Run**
   ```bash
   ./Scanalyzer-1.0.0.AppImage
   ```

#### Debian/Ubuntu (.deb)
1. **Download and Install**
   ```bash
   wget https://github.com/scanalyzer/scanalyzer/releases/download/v1.0.0/scanalyzer_1.0.0_amd64.deb
   sudo dpkg -i scanalyzer_1.0.0_amd64.deb
   sudo apt-get install -f  # Install dependencies if needed
   ```

2. **Launch**
   ```bash
   scanalyzer
   ```

## First Launch Walkthrough

When you first open Scanalyzer, you'll see the Welcome screen:

![Welcome Screen](../images/screenshots/welcome-screen.png)

### Initial Setup

1. **Theme Selection**
   - Choose between Light and Dark themes
   - You can change this later in Settings

2. **Data Directory**
   - Scanalyzer stores reports locally
   - Default location:
     - Windows: `%APPDATA%\Scanalyzer\data`
     - macOS: `~/Library/Application Support/Scanalyzer/data`
     - Linux: `~/.config/scanalyzer/data`
   - Click "Change" to select a different location

3. **Auto-Update Preferences**
   - Enable automatic updates (recommended)
   - Choose update channel: Stable or Beta

4. **Complete Setup**
   - Click "Get Started" to enter the main application

### Main Interface Overview

![Main Dashboard](../images/screenshots/dashboard-overview.png)

The main interface consists of:

1. **Sidebar Navigation**
   - Dashboard - Overview of your security findings
   - Upload - Import new security reports
   - Findings - Detailed view of all findings
   - Reports - Manage imported reports
   - History - Track changes over time
   - Settings - Configure application preferences

2. **Main Content Area**
   - Displays content based on selected navigation item
   - Responsive design adapts to window size

3. **Status Bar**
   - Shows backend connection status
   - Displays current activity
   - Quick access to theme toggle

## Uploading Your First Report

Let's import your first security report:

1. **Navigate to Upload**
   - Click "Upload" in the sidebar
   - Or press `Ctrl+U` (Windows/Linux) or `Cmd+U` (macOS)

2. **Select Files**
   
   ![Upload Interface](../images/screenshots/upload-interface.png)
   
   You can add files in three ways:
   - **Drag and Drop**: Drag files directly onto the drop zone
   - **Click to Browse**: Click the upload area to open file browser
   - **Paste**: Use `Ctrl+V` to paste files from clipboard

3. **Supported File Types**
   - **Security Tools**: 
     - Bandit (.json, .xml)
     - Checkov (.json)
     - Prowler v2/v3 (.json, .html)
     - Nessus (.nessus)
   - **Documents**:
     - PDF security reports
     - Word documents (.docx)
     - Excel spreadsheets (.xlsx, .csv)

4. **Upload Process**
   - Selected files appear in the file list
   - Click "Upload" to start processing
   - Progress bars show upload status
   - Processing happens automatically after upload

5. **View Results**
   - Once processed, click "View Findings" 
   - Or navigate to the Dashboard to see summary

### Example: Uploading a Bandit Report

1. Run Bandit on your Python project:
   ```bash
   bandit -r your_project/ -f json -o bandit_report.json
   ```

2. In Scanalyzer:
   - Click "Upload" in sidebar
   - Drag `bandit_report.json` to the upload area
   - Click "Upload" button
   - Wait for processing to complete

3. View findings:
   - Navigate to "Findings" to see all issues
   - Use filters to focus on high-severity items
   - Click any finding for detailed information

## Basic Navigation and Features

### Dashboard
The dashboard provides an at-a-glance view of your security posture:

- **Summary Cards**: Total findings, critical issues, recent uploads
- **Severity Distribution**: Pie chart of finding severities
- **Trend Chart**: Historical view of findings over time
- **Recent Reports**: Quick access to latest uploads

### Findings View
Comprehensive table of all security findings:

- **Search**: Full-text search across all findings
- **Filters**: Filter by severity, tool, category, date range
- **Sort**: Click column headers to sort
- **Details**: Click any row for full finding details

### Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|--------------|-------|
| Upload Report | `Ctrl+U` | `Cmd+U` |
| Search | `Ctrl+F` | `Cmd+F` |
| Export | `Ctrl+E` | `Cmd+E` |
| Settings | `Ctrl+,` | `Cmd+,` |
| Toggle Theme | `Ctrl+Shift+T` | `Cmd+Shift+T` |

## Next Steps

Now that you have Scanalyzer installed and have uploaded your first report:

1. **Explore the Dashboard**
   - Understand your security metrics
   - Identify trends and patterns

2. **Master Filtering**
   - Learn to use [Advanced Filters](../features/filtering.md)
   - Create saved filter sets

3. **Set Up Automation**
   - Configure [Automated Imports](../advanced/automation.md)
   - Schedule regular report processing

4. **Export and Share**
   - Generate [Custom Reports](../features/exporting-data.md)
   - Share findings with your team

## Getting Help

If you encounter any issues:

- Check the [Troubleshooting Guide](../troubleshooting/common-issues.md)
- Visit our [Community Forum](https://forum.scanalyzer.app)
- Report bugs on [GitHub Issues](https://github.com/scanalyzer/scanalyzer/issues)
- Contact [support@scanalyzer.app](mailto:support@scanalyzer.app) for priority support

---

Congratulations! You're now ready to start analyzing your security findings with Scanalyzer. Continue to the [Feature Documentation](../features/dashboard.md) to learn about all the powerful features available.