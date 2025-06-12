# Troubleshooting Common Issues

This guide helps you resolve the most common issues encountered when using Scanalyzer. If your issue isn't covered here, please check our [Community Forum](https://forum.scanalyzer.app) or contact [support](mailto:support@scanalyzer.app).

## Installation Issues

### Windows: "Windows protected your PC" Warning

**Problem:** Windows Defender SmartScreen blocks the installer.

**Solution:**
1. Click "More info" on the warning dialog
2. Click "Run anyway"
3. This is normal for new applications that haven't built reputation yet

**Alternative:** If your organization blocks unsigned apps:
1. Right-click the installer
2. Select Properties
3. Check "Unblock" at the bottom
4. Click Apply, then OK

### macOS: "Scanalyzer can't be opened because Apple cannot check it for malicious software"

**Problem:** macOS Gatekeeper blocks the application.

**Solution:**
1. Open System Preferences
2. Go to Security & Privacy > General
3. Click "Open Anyway" next to the Scanalyzer message
4. Enter your password when prompted

**Alternative:** Using Terminal:
```bash
sudo xattr -r -d com.apple.quarantine /Applications/Scanalyzer.app
```

### Linux: "Permission denied" when running AppImage

**Problem:** AppImage lacks execute permission.

**Solution:**
```bash
chmod +x Scanalyzer-*.AppImage
./Scanalyzer-*.AppImage
```

**If AppImages don't work on your system:**
```bash
# Install FUSE if missing
sudo apt install libfuse2  # Ubuntu/Debian
sudo dnf install fuse      # Fedora
```

## Startup Issues

### Application Won't Start

**Common causes and solutions:**

1. **Corrupted installation**
   - Reinstall Scanalyzer
   - On Windows: Use "Programs and Features" to uninstall first
   - On macOS: Delete app from Applications, empty trash, reinstall

2. **Missing dependencies**
   - Windows: Install [Visual C++ Redistributables](https://support.microsoft.com/en-us/help/2977003/)
   - Linux: Install required libraries:
     ```bash
     sudo apt install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6
     ```

3. **Port conflicts**
   - Scanalyzer's backend uses port 8000
   - Check if another application is using this port:
     ```bash
     # Windows
     netstat -ano | findstr :8000
     
     # macOS/Linux  
     lsof -i :8000
     ```
   - Change port in Settings > Advanced > Backend Port

### "Backend Connection Failed" Error

**Problem:** Frontend can't connect to the backend service.

**Solutions:**

1. **Check backend status**
   - Look at the status bar (bottom of window)
   - Should show "Backend: Connected"
   - If disconnected, try restarting the app

2. **Firewall blocking connection**
   - Add Scanalyzer to firewall exceptions
   - Windows: Check Windows Defender Firewall
   - macOS: Check System Preferences > Security & Privacy > Firewall

3. **Antivirus interference**
   - Temporarily disable antivirus
   - If this fixes it, add Scanalyzer to exclusions
   - Common culprits: Kaspersky, Norton, McAfee

4. **Reset backend**
   - Settings > Advanced > Reset Backend
   - This restarts the Python backend service

## Upload Issues

### "Failed to Parse Report" Error

**Problem:** Scanalyzer can't parse the uploaded file.

**Common causes:**

1. **Incorrect file format**
   - Ensure file matches expected format for the tool
   - Bandit: JSON or CSV format
   - Prowler: JSON or HTML format
   - Checkov: JSON format

2. **Corrupted or incomplete file**
   - Verify file opens correctly in a text editor
   - Check file size (shouldn't be 0 bytes)
   - Ensure scan completed successfully

3. **Wrong tool selected**
   - Auto-detection might fail for ambiguous formats
   - Manually select the correct tool before upload

4. **Unsupported tool version**
   - Check [Supported Tools](../integrations/supported-tools.md) for version compatibility
   - Update your scanning tool to a supported version

### Large Files Upload Slowly or Fail

**Problem:** Files over 50MB upload slowly or timeout.

**Solutions:**

1. **Increase timeout settings**
   - Settings > Advanced > Upload Timeout
   - Increase to 300 seconds for large files

2. **Split large reports**
   - Some tools support splitting output
   - Process in smaller batches

3. **Check disk space**
   - Ensure adequate free space (3x file size recommended)
   - Default storage location:
     - Windows: `%APPDATA%\Scanalyzer\data`
     - macOS: `~/Library/Application Support/Scanalyzer/data`
     - Linux: `~/.config/scanalyzer/data`

## Performance Issues

### Application Running Slowly

**Common causes and solutions:**

1. **Too many findings loaded**
   - Use pagination (Settings > Display > Items per page)
   - Reduce from default 100 to 50 or 25
   - Enable virtualization for large datasets

2. **Insufficient memory**
   - Check system memory usage
   - Close unnecessary applications
   - Minimum 8GB RAM recommended

3. **Database optimization needed**
   - Settings > Maintenance > Optimize Database
   - Run monthly for best performance
   - Backs up data before optimization

4. **Disable animations**
   - Settings > Appearance > Disable animations
   - Improves performance on older systems

### Search/Filter Lag

**Problem:** Searching or filtering is slow with many findings.

**Solutions:**

1. **Use indexed fields**
   - Severity, Tool, Category are indexed
   - These filter fastest

2. **Avoid complex regex**
   - Simple text searches are faster
   - Use field-specific searches when possible

3. **Clear old data**
   - Archive or delete old reports
   - Settings > Data Management > Archive Old Reports

## Display Issues

### Text or UI Elements Cut Off

**Common causes:**

1. **Display scaling issues**
   - Windows: Right-click desktop > Display settings > Scale
   - Set to 100% or 125% for best results
   - Restart Scanalyzer after changing

2. **Resolution too low**
   - Minimum 1920x1080 recommended
   - Use responsive mode on smaller screens

3. **Font size settings**
   - Settings > Appearance > Font Size
   - Reduce if UI elements overlap

### Dark Mode Issues

**Problem:** Some elements not displaying correctly in dark mode.

**Solutions:**

1. **Force theme refresh**
   - Toggle theme twice (light → dark → light → dark)
   - Restarts theme engine

2. **Clear theme cache**
   - Settings > Advanced > Clear Cache
   - Select "Theme Cache" only
   - Restart application

## Data Issues

### Missing Findings After Import

**Problem:** Report shows successful import but findings are missing.

**Possible causes:**

1. **Filters active**
   - Click "Clear All Filters"
   - Check status bar for active filter count

2. **Wrong date range**
   - Check date filter includes today
   - Remove date filters temporarily

3. **Deduplication**
   - Settings > Import > Deduplication
   - May be removing perceived duplicates
   - Try disabling temporarily

### Duplicate Findings

**Problem:** Same findings appear multiple times.

**Solutions:**

1. **Enable deduplication**
   - Settings > Import > Enable Deduplication
   - Configure matching criteria

2. **Check for multiple imports**
   - Reports view shows all imports
   - Delete duplicate reports

3. **Different tools, same finding**
   - This is normal - different tools may find same issue
   - Use grouping to consolidate view

## Export Issues

### PDF Export Fails

**Common issues:**

1. **Special characters in findings**
   - Some Unicode characters may cause issues
   - Try CSV export as alternative

2. **Too many findings**
   - PDF limited to 1000 findings
   - Filter to reduce count
   - Use CSV for complete export

3. **Memory issues**
   - Large exports need significant memory
   - Close other applications
   - Try exporting in batches

### Excel File Won't Open

**Problem:** Exported XLSX file shows as corrupted.

**Solutions:**

1. **Use CSV format instead**
   - More compatible across versions
   - Can open in Excel

2. **Check Excel version**
   - Older Excel versions may have issues
   - Try opening in Google Sheets first

## Update Issues

### Auto-Update Fails

**Common problems:**

1. **No write permissions**
   - Windows: Run as Administrator
   - macOS/Linux: Check app permissions

2. **Proxy/firewall blocking**
   - Configure proxy in Settings > Network
   - Add update server to firewall whitelist

3. **Corrupted update**
   - Settings > Advanced > Clear Update Cache
   - Manually download from website

## Crash Recovery

### Application Crashes Unexpectedly

**Immediate steps:**

1. **Check for crash reports**
   - Windows: `%APPDATA%\Scanalyzer\logs\crash`
   - macOS: `~/Library/Logs/Scanalyzer`
   - Linux: `~/.config/scanalyzer/logs`

2. **Safe mode start**
   - Hold Shift while starting Scanalyzer
   - Disables extensions and custom settings

3. **Reset settings**
   - Delete settings file (backup first):
     - Windows: `%APPDATA%\Scanalyzer\settings.json`
     - macOS: `~/Library/Application Support/Scanalyzer/settings.json`
     - Linux: `~/.config/scanalyzer/settings.json`

### Data Recovery

**If data appears lost:**

1. **Check backups**
   - Settings > Backup > Restore
   - Automatic backups kept for 30 days

2. **Database repair**
   - Settings > Maintenance > Repair Database
   - Run integrity check first

3. **Manual recovery**
   - Contact support with logs
   - We can often recover from database files

## Getting Additional Help

### Diagnostic Information

When contacting support, include:

1. **System information**
   - Help > About > Copy System Info
   - Includes version, OS, hardware

2. **Log files**
   - Help > Show Logs
   - Last 7 days usually sufficient

3. **Steps to reproduce**
   - What were you doing when issue occurred?
   - Can you reproduce consistently?

### Support Channels

1. **Self-Service**
   - [Documentation](https://docs.scanalyzer.app)
   - [Community Forum](https://forum.scanalyzer.app)
   - [Video Tutorials](https://youtube.com/scanalyzer)

2. **Direct Support**
   - Email: support@scanalyzer.app
   - Response time: 24-48 hours
   - Priority support available

3. **Bug Reports**
   - [GitHub Issues](https://github.com/scanalyzer/scanalyzer/issues)
   - Include diagnostic information
   - Check existing issues first

---

Remember to keep Scanalyzer updated for the best experience and latest fixes. Enable auto-updates in Settings > Updates.