; NSIS installer customizations for Scanalyzer

; Custom install options
!macro customInstall
  ; Create protocol handler registry entries
  WriteRegStr HKCR "scanalyzer" "" "URL:Scanalyzer Protocol"
  WriteRegStr HKCR "scanalyzer" "URL Protocol" ""
  WriteRegStr HKCR "scanalyzer\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR "scanalyzer\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  
  ; Register file associations
  ; JSON files
  WriteRegStr HKCR ".json" "" "Scanalyzer.JSONReport"
  WriteRegStr HKCR "Scanalyzer.JSONReport" "" "JSON Security Report"
  WriteRegStr HKCR "Scanalyzer.JSONReport\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR "Scanalyzer.JSONReport\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  
  ; XML files
  WriteRegStr HKCR ".xml" "" "Scanalyzer.XMLReport"
  WriteRegStr HKCR "Scanalyzer.XMLReport" "" "XML Security Report"
  WriteRegStr HKCR "Scanalyzer.XMLReport\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR "Scanalyzer.XMLReport\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  
  ; Nessus files
  WriteRegStr HKCR ".nessus" "" "Scanalyzer.NessusReport"
  WriteRegStr HKCR "Scanalyzer.NessusReport" "" "Nessus Security Report"
  WriteRegStr HKCR "Scanalyzer.NessusReport\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR "Scanalyzer.NessusReport\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  
  ; Add to PATH (optional)
  ; ${EnvVarUpdate} $0 "PATH" "A" "HKLM" "$INSTDIR"
  
  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\Scanalyzer"
  CreateShortcut "$SMPROGRAMS\Scanalyzer\Scanalyzer.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  CreateShortcut "$SMPROGRAMS\Scanalyzer\Uninstall Scanalyzer.lnk" "$INSTDIR\Uninstall ${APP_EXECUTABLE_FILENAME}"
!macroend

; Custom uninstall options
!macro customUninstall
  ; Remove protocol handler
  DeleteRegKey HKCR "scanalyzer"
  
  ; Remove file associations
  DeleteRegKey HKCR "Scanalyzer.JSONReport"
  DeleteRegKey HKCR "Scanalyzer.XMLReport"
  DeleteRegKey HKCR "Scanalyzer.NessusReport"
  
  ; Remove Start Menu shortcuts
  RMDir /r "$SMPROGRAMS\Scanalyzer"
  
  ; Clean up app data (optional - ask user)
  MessageBox MB_YESNO "Remove application data and settings?" IDNO skip_appdata
    RMDir /r "$APPDATA\Scanalyzer"
  skip_appdata:
!macroend

; Custom header text
!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Scanalyzer Setup"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of Scanalyzer.$\r$\n$\r$\nScanalyzer is an intelligent security report analysis tool for your desktop.$\r$\n$\r$\nClick Next to continue."
!macroend

; License page
!macro customLicense
  !define MUI_LICENSEPAGE_TEXT_TOP "Please review the license agreement before installing Scanalyzer."
  !define MUI_LICENSEPAGE_TEXT_BOTTOM "If you accept the terms of the agreement, click I Agree to continue. You must accept the agreement to install Scanalyzer."
!macroend