# Code Signing Certificates Guide

## Overview

This document outlines the certificate requirements and setup process for code signing Scanalyzer releases on Windows and macOS.

## Table of Contents

- [Windows Code Signing](#windows-code-signing)
- [macOS Code Signing](#macos-code-signing)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)
- [Certificate Renewal](#certificate-renewal)

## Windows Code Signing

### Requirements

1. **Code Signing Certificate** (one of the following):
   - **EV Code Signing Certificate** (recommended for immediate SmartScreen reputation)
   - **Standard Code Signing Certificate** (builds reputation over time)
   
2. **Certificate Requirements**:
   - Purchase from authorized CA (DigiCert, Sectigo, GlobalSign, Comodo)
   - Must support SHA-256 signing
   - Valid for at least 1 year
   - Includes timestamp server access

### Setup Process

#### 1. Export Certificate

```powershell
# Export from Windows Certificate Store
certutil -exportPFX -p "your-password" My <certificate-thumbprint> certificate.pfx

# Or use Certificate Manager GUI
certmgr.msc
# Right-click certificate → All Tasks → Export
```

#### 2. Convert to Base64 (for GitHub Secrets)

```bash
# On Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Out-File certificate.b64

# On macOS/Linux
base64 -i certificate.pfx -o certificate.b64
```

#### 3. Add to GitHub Secrets

Go to Settings → Secrets and variables → Actions:

- `WINDOWS_CERTIFICATE`: Base64 encoded PFX file content
- `WINDOWS_CERTIFICATE_PASSWORD`: PFX password
- `WINDOWS_CERTIFICATE_SUBJECT`: Certificate subject name (e.g., "Your Company Name")
- `WINDOWS_CERTIFICATE_SHA1`: Certificate SHA1 thumbprint

#### 4. Local Development Setup

```powershell
# Set environment variables
$env:WINDOWS_CERTIFICATE_FILE = "path\to\certificate.pfx"
$env:WINDOWS_CERTIFICATE_PASSWORD = "your-password"
$env:WINDOWS_CERTIFICATE_SUBJECT = "Your Company Name"
$env:WINDOWS_CERTIFICATE_SHA1 = "certificate-thumbprint"
```

### Verification

```powershell
# Verify signed executable
signtool verify /pa /v "path\to\Scanalyzer.exe"
```

## macOS Code Signing

### Requirements

1. **Apple Developer Account** ($99/year)
2. **Required Certificates**:
   - **Developer ID Application Certificate** (for app signing)
   - **Developer ID Installer Certificate** (optional, for PKG installers)
3. **Apple ID with app-specific password** (for notarization)

### Setup Process

#### 1. Create Certificates

1. Log in to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to Certificates, Identifiers & Profiles
3. Create new certificate → Developer ID Application
4. Follow the Certificate Signing Request process
5. Download and install certificate

#### 2. Export Certificates

```bash
# List certificates
security find-identity -p codesigning -v

# Export to P12 file
security export -k ~/Library/Keychains/login.keychain-db \
  -t identities \
  -f pkcs12 \
  -P "your-password" \
  -o certificate.p12
```

#### 3. Convert to Base64

```bash
base64 -i certificate.p12 -o certificate.b64
```

#### 4. Add to GitHub Secrets

- `MACOS_CERTIFICATE`: Base64 encoded P12 file content
- `MACOS_CERTIFICATE_PWD`: P12 password
- `APPLE_ID`: Your Apple ID email
- `APPLE_ID_PASSWORD`: App-specific password (not your regular password!)
- `APPLE_TEAM_ID`: Team ID from developer account
- `APPLE_DEVELOPER_IDENTITY`: Certificate common name

#### 5. Create App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in and go to Security
3. Under App-Specific Passwords, click Generate Password
4. Name it "Scanalyzer Notarization"
5. Save the generated password securely

#### 6. Local Development Setup

```bash
# Export environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
export APPLE_DEVELOPER_IDENTITY="Developer ID Application: Your Name (TEAMID)"
```

### Verification

```bash
# Verify code signature
codesign -vvv --deep --strict /Applications/Scanalyzer.app

# Verify notarization
spctl -a -vvv -t install /Applications/Scanalyzer.app
```

## Security Best Practices

### Certificate Storage

1. **Never commit certificates or passwords to version control**
2. Use encrypted password managers for credentials
3. Store certificates in secure locations with restricted access
4. Use different certificates for development and production

### Access Control

1. Limit access to certificates to authorized personnel only
2. Use GitHub Environment secrets for production certificates
3. Enable audit logging for certificate usage
4. Rotate passwords regularly

### CI/CD Security

1. Use GitHub Secrets for all sensitive data
2. Enable branch protection rules
3. Require reviews for workflow changes
4. Use environment-specific secrets

## Troubleshooting

### Windows Issues

#### "Certificate not found"
- Verify thumbprint is correct
- Check certificate is in correct store (Current User vs Local Machine)
- Ensure certificate hasn't expired

#### "Timestamp server timeout"
```powershell
# Try alternative timestamp servers
$env:TIMESTAMP_SERVER = "http://timestamp.sectigo.com"
# or
$env:TIMESTAMP_SERVER = "http://timestamp.digicert.com"
```

#### "Access denied during signing"
- Run build process as administrator
- Check certificate permissions
- Disable antivirus temporarily

### macOS Issues

#### "Certificate not trusted"
- Ensure certificate is from Apple Developer Program
- Check certificate hasn't been revoked
- Verify intermediate certificates are installed

#### "Notarization failed"
- Check entitlements are correct
- Verify hardened runtime is enabled
- Ensure all libraries are signed
- Check for missing Info.plist keys

#### "Keychain access denied"
```bash
# Unlock keychain before signing
security unlock-keychain -p "keychain-password" ~/Library/Keychains/login.keychain-db

# Allow codesign access
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "keychain-password" ~/Library/Keychains/login.keychain-db
```

## Certificate Renewal

### Timeline

- **90 days before expiration**: Order new certificate
- **60 days before expiration**: Test new certificate
- **30 days before expiration**: Update CI/CD secrets
- **14 days before expiration**: Switch to new certificate
- **7 days after switching**: Remove old certificate

### Renewal Process

1. **Order New Certificate**
   - Use same provider if possible
   - Ensure same or higher validation level
   - Verify compatibility with existing setup

2. **Test Locally**
   ```bash
   # Test signing with new certificate
   npm run dist -- --publish never
   ```

3. **Update CI/CD**
   - Create new secrets with `_NEW` suffix
   - Test with a pre-release build
   - Switch secret names when verified
   - Remove old secrets

4. **Update Documentation**
   - Record new certificate details
   - Update expiration tracking
   - Notify team of change

### Certificate Inventory

Keep track of all certificates:

| Certificate | Provider | Type | Expires | Thumbprint | Notes |
|------------|----------|------|---------|------------|-------|
| Windows Code Signing | DigiCert | EV | 2025-12-31 | ABC123... | Production |
| Apple Developer ID | Apple | Developer ID | 2025-06-30 | DEF456... | Production |

## Emergency Procedures

### Certificate Compromise

1. **Immediate Actions**:
   - Revoke compromised certificate
   - Remove from all systems
   - Update all secrets
   - Notify users if necessary

2. **Recovery**:
   - Generate new certificate
   - Re-sign recent releases
   - Update auto-updater
   - Monitor for misuse

### Lost Certificate

1. **Windows**: Re-export from Certificate Store or contact CA
2. **macOS**: Re-download from Apple Developer Portal
3. **Both**: If completely lost, request new certificate

## Additional Resources

- [Windows Authenticode Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/authenticode)
- [Apple Code Signing Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Electron Code Signing](https://www.electron.build/code-signing)
- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

Last updated: December 2024