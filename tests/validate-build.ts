import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

interface BuildValidation {
  platform: string;
  artifacts: string[];
  signatures: boolean;
  fileAssociations: boolean;
  autoUpdater: boolean;
  checksums: Map<string, string>;
  errors: string[];
}

interface ValidationReport {
  timestamp: string;
  validations: BuildValidation[];
  summary: {
    totalArtifacts: number;
    allSigned: boolean;
    platforms: string[];
    errors: string[];
  };
}

async function validateBuilds(): Promise<BuildValidation[]> {
  const results: BuildValidation[] = [];
  const distPath = path.join(__dirname, '../electron/dist');
  
  // Check if dist directory exists
  if (!await fs.pathExists(distPath)) {
    console.error('❌ No build artifacts found. Run build first.');
    return results;
  }
  
  // Check Windows build
  if (process.platform === 'win32' || process.env.CI) {
    console.log('🔍 Validating Windows build...');
    const windowsValidation = await validateWindowsBuild(distPath);
    results.push(windowsValidation);
  }
  
  // Check macOS build
  if (process.platform === 'darwin' || process.env.CI) {
    console.log('🔍 Validating macOS build...');
    const macValidation = await validateMacBuild(distPath);
    results.push(macValidation);
  }
  
  // Check Linux build
  if (process.platform === 'linux' || process.env.CI) {
    console.log('🔍 Validating Linux build...');
    const linuxValidation = await validateLinuxBuild(distPath);
    results.push(linuxValidation);
  }
  
  return results;
}

async function validateWindowsBuild(distPath: string): Promise<BuildValidation> {
  const validation: BuildValidation = {
    platform: 'windows',
    artifacts: [],
    signatures: false,
    fileAssociations: false,
    autoUpdater: false,
    checksums: new Map(),
    errors: []
  };
  
  try {
    // Check for expected artifacts
    const expectedPatterns = [
      /^Scanalyzer-Setup-.*\.exe$/,
      /^Scanalyzer-.*-win\.zip$/,
      /^latest\.yml$/
    ];
    
    const files = await fs.readdir(distPath);
    
    for (const pattern of expectedPatterns) {
      const matches = files.filter(f => pattern.test(f));
      if (matches.length === 0) {
        validation.errors.push(`Missing expected artifact matching ${pattern}`);
      } else {
        validation.artifacts.push(...matches);
      }
    }
    
    // Verify signatures (Windows)
    if (process.platform === 'win32') {
      try {
        const exeFile = validation.artifacts.find(f => f.endsWith('.exe'));
        if (exeFile) {
          const result = execSync(
            `signtool verify /pa "${path.join(distPath, exeFile)}"`,
            { encoding: 'utf8', stdio: 'pipe' }
          );
          validation.signatures = result.includes('Successfully verified');
        }
      } catch (error: any) {
        validation.errors.push(`Signature verification failed: ${error.message}`);
      }
    } else {
      // On non-Windows, check if file exists and is valid
      validation.signatures = validation.artifacts.some(f => f.endsWith('.exe'));
    }
    
    // Check auto-updater files
    validation.autoUpdater = files.some(f => f === 'latest.yml');
    
    // Generate checksums
    for (const file of validation.artifacts) {
      try {
        const filePath = path.join(distPath, file);
        const checksum = await generateChecksum(filePath);
        validation.checksums.set(file, checksum);
      } catch (error: any) {
        validation.errors.push(`Failed to generate checksum for ${file}: ${error.message}`);
      }
    }
    
  } catch (error: any) {
    validation.errors.push(`Windows validation error: ${error.message}`);
  }
  
  return validation;
}

async function validateMacBuild(distPath: string): Promise<BuildValidation> {
  const validation: BuildValidation = {
    platform: 'macos',
    artifacts: [],
    signatures: false,
    fileAssociations: false,
    autoUpdater: false,
    checksums: new Map(),
    errors: []
  };
  
  try {
    // Check for expected artifacts
    const expectedPatterns = [
      /^Scanalyzer-.*-mac.*\.dmg$/,
      /^Scanalyzer-.*-mac.*\.zip$/,
      /^latest-mac\.yml$/
    ];
    
    const files = await fs.readdir(distPath);
    
    for (const pattern of expectedPatterns) {
      const matches = files.filter(f => pattern.test(f));
      if (matches.length === 0) {
        validation.errors.push(`Missing expected artifact matching ${pattern}`);
      } else {
        validation.artifacts.push(...matches);
      }
    }
    
    // Verify signatures and notarization (macOS)
    if (process.platform === 'darwin') {
      try {
        const dmgFile = validation.artifacts.find(f => f.endsWith('.dmg'));
        if (dmgFile) {
          const dmgPath = path.join(distPath, dmgFile);
          
          // Mount DMG
          const mountResult = execSync(`hdiutil attach "${dmgPath}" -nobrowse`, {
            encoding: 'utf8'
          });
          const mountPoint = mountResult.split('\t').pop()?.trim();
          
          if (mountPoint) {
            try {
              // Check code signature
              const appPath = path.join(mountPoint, 'Scanalyzer.app');
              const signResult = execSync(
                `codesign -vvv --deep --strict "${appPath}" 2>&1`,
                { encoding: 'utf8' }
              );
              
              // Check notarization
              const notarizeResult = execSync(
                `spctl -a -vvv -t install "${appPath}" 2>&1`,
                { encoding: 'utf8' }
              );
              
              validation.signatures = 
                signResult.includes('valid on disk') && 
                notarizeResult.includes('accepted');
                
              if (!validation.signatures) {
                validation.errors.push('Code signature or notarization verification failed');
              }
              
            } finally {
              // Unmount DMG
              execSync(`hdiutil detach "${mountPoint}" -quiet`);
            }
          }
        }
      } catch (error: any) {
        validation.errors.push(`Signature verification failed: ${error.message}`);
      }
    } else {
      // On non-macOS, just check if DMG exists
      validation.signatures = validation.artifacts.some(f => f.endsWith('.dmg'));
    }
    
    // Check auto-updater files
    validation.autoUpdater = files.some(f => f.includes('latest-mac.yml'));
    
    // Generate checksums
    for (const file of validation.artifacts) {
      try {
        const filePath = path.join(distPath, file);
        const checksum = await generateChecksum(filePath);
        validation.checksums.set(file, checksum);
      } catch (error: any) {
        validation.errors.push(`Failed to generate checksum for ${file}: ${error.message}`);
      }
    }
    
  } catch (error: any) {
    validation.errors.push(`macOS validation error: ${error.message}`);
  }
  
  return validation;
}

async function validateLinuxBuild(distPath: string): Promise<BuildValidation> {
  const validation: BuildValidation = {
    platform: 'linux',
    artifacts: [],
    signatures: false,
    fileAssociations: false,
    autoUpdater: false,
    checksums: new Map(),
    errors: []
  };
  
  try {
    // Check for expected artifacts
    const expectedPatterns = [
      /^Scanalyzer-.*\.AppImage$/,
      /^Scanalyzer-.*\.deb$/,
      /^Scanalyzer-.*\.rpm$/,
      /^latest-linux\.yml$/
    ];
    
    const files = await fs.readdir(distPath);
    
    for (const pattern of expectedPatterns) {
      const matches = files.filter(f => pattern.test(f));
      if (matches.length === 0) {
        validation.errors.push(`Missing expected artifact matching ${pattern}`);
      } else {
        validation.artifacts.push(...matches);
      }
    }
    
    // Linux packages are not signed in the same way
    validation.signatures = validation.artifacts.length > 0;
    
    // Check auto-updater files
    validation.autoUpdater = files.some(f => f.includes('latest-linux.yml'));
    
    // Generate checksums
    for (const file of validation.artifacts) {
      try {
        const filePath = path.join(distPath, file);
        const checksum = await generateChecksum(filePath);
        validation.checksums.set(file, checksum);
      } catch (error: any) {
        validation.errors.push(`Failed to generate checksum for ${file}: ${error.message}`);
      }
    }
    
  } catch (error: any) {
    validation.errors.push(`Linux validation error: ${error.message}`);
  }
  
  return validation;
}

async function generateChecksum(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  
  return new Promise((resolve, reject) => {
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function testAutoUpdater(): Promise<boolean> {
  try {
    const latestFiles = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml'];
    const distPath = path.join(__dirname, '../electron/dist');
    
    for (const file of latestFiles) {
      const filePath = path.join(distPath, file);
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        
        // Validate YAML structure
        if (!content.includes('version:') || !content.includes('files:')) {
          console.error(`❌ Invalid update manifest: ${file}`);
          return false;
        }
      }
    }
    
    console.log('✅ Auto-updater files valid');
    return true;
  } catch (error) {
    console.error('❌ Auto-updater test failed:', error);
    return false;
  }
}

// Generate validation report
async function generateValidationReport(validations: BuildValidation[]): Promise<void> {
  const allErrors: string[] = [];
  validations.forEach(v => allErrors.push(...v.errors));
  
  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    validations,
    summary: {
      totalArtifacts: validations.reduce((sum, v) => sum + v.artifacts.length, 0),
      allSigned: validations.every(v => v.signatures || v.errors.length > 0),
      platforms: validations.map(v => v.platform),
      errors: allErrors
    }
  };
  
  // Save JSON report
  await fs.writeJson('build-validation-report.json', report, { spaces: 2 });
  
  // Generate markdown report
  const markdown = `# Build Validation Report

Generated: ${report.timestamp}

## Summary

- **Total Artifacts**: ${report.summary.totalArtifacts}
- **All Signed**: ${report.summary.allSigned ? '✅' : '❌'}
- **Platforms**: ${report.summary.platforms.join(', ')}
- **Total Errors**: ${report.summary.errors.length}

## Platform Details

${validations.map(v => `
### ${v.platform.toUpperCase()}

- **Artifacts**: ${v.artifacts.length}
- **Code Signed**: ${v.signatures ? '✅' : '❌'}
- **Auto-Updater**: ${v.autoUpdater ? '✅' : '❌'}
- **Errors**: ${v.errors.length}

#### Files
${v.artifacts.map(f => `- \`${f}\` (SHA256: \`${v.checksums.get(f)?.substring(0, 8)}...\`)`).join('\n')}

${v.errors.length > 0 ? `#### Errors\n${v.errors.map(e => `- ❌ ${e}`).join('\n')}` : ''}
`).join('\n')}

## Checksums

\`\`\`
${validations.flatMap(v => 
  Array.from(v.checksums.entries()).map(([file, hash]) => `${hash}  ${file}`)
).join('\n')}
\`\`\`

## Validation Status

${report.summary.errors.length === 0 ? '### ✅ All validations passed!' : `### ❌ ${report.summary.errors.length} errors found`}

${report.summary.errors.length > 0 ? `
### Errors Summary
${report.summary.errors.map(e => `- ${e}`).join('\n')}
` : ''}
`;
  
  await fs.writeFile('build-validation-report.md', markdown);
  
  // Print summary to console
  console.log('\n📊 Build Validation Summary:');
  console.log(`   Total Artifacts: ${report.summary.totalArtifacts}`);
  console.log(`   Platforms: ${report.summary.platforms.join(', ')}`);
  console.log(`   All Signed: ${report.summary.allSigned ? '✅' : '❌'}`);
  console.log(`   Errors: ${report.summary.errors.length}`);
  
  if (report.summary.errors.length > 0) {
    console.log('\n❌ Errors found:');
    report.summary.errors.forEach(error => console.log(`   - ${error}`));
  }
}

// Main execution
async function main() {
  console.log('🔍 Validating Scanalyzer builds...\n');
  
  try {
    // Validate builds
    const validations = await validateBuilds();
    
    if (validations.length === 0) {
      console.error('❌ No builds found to validate');
      process.exit(1);
    }
    
    // Test auto-updater
    const updaterValid = await testAutoUpdater();
    
    // Generate report
    await generateValidationReport(validations);
    
    console.log('\n📄 Reports generated:');
    console.log('   - build-validation-report.json');
    console.log('   - build-validation-report.md');
    
    // Exit with error if validation failed
    const hasErrors = validations.some(v => v.errors.length > 0) || !updaterValid;
    if (hasErrors) {
      console.log('\n❌ Build validation failed!');
      process.exit(1);
    } else {
      console.log('\n✅ Build validation passed!');
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { validateBuilds, generateValidationReport };