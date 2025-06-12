#!/usr/bin/env ts-node

import * as fs from 'fs-extra';
import * as path from 'path';
import { marked } from 'marked';
import * as glob from 'glob';
import { program } from 'commander';
import chalk from 'chalk';

interface ValidationResult {
  file: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: DocumentStats;
}

interface ValidationError {
  line: number;
  message: string;
  type: 'broken-link' | 'missing-image' | 'invalid-format' | 'missing-section';
}

interface ValidationWarning {
  line: number;
  message: string;
  type: 'long-line' | 'missing-alt-text' | 'inconsistent-heading' | 'todo';
}

interface DocumentStats {
  wordCount: number;
  linkCount: number;
  imageCount: number;
  codeBlockCount: number;
  headingCount: number;
}

class DocumentationValidator {
  private docsRoot: string;
  private results: ValidationResult[] = [];
  private allLinks: Map<string, string[]> = new Map();
  private allImages: Set<string> = new Set();

  constructor(docsRoot: string) {
    this.docsRoot = path.resolve(docsRoot);
  }

  async validate(): Promise<void> {
    console.log(chalk.blue('🔍 Validating documentation...\n'));

    // Find all markdown files
    const files = glob.sync('**/*.md', { 
      cwd: this.docsRoot,
      ignore: ['node_modules/**', '**/README.md']
    });

    // First pass: collect all links and images
    console.log(chalk.gray('Collecting references...'));
    for (const file of files) {
      await this.collectReferences(file);
    }

    // Second pass: validate each file
    console.log(chalk.gray('Validating files...\n'));
    for (const file of files) {
      const result = await this.validateFile(file);
      this.results.push(result);
      this.printFileResult(result);
    }

    // Print summary
    this.printSummary();
  }

  private async collectReferences(relativePath: string): Promise<void> {
    const fullPath = path.join(this.docsRoot, relativePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Collect internal links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      const link = match[2];
      if (!link.startsWith('http') && !link.startsWith('mailto:')) {
        if (!this.allLinks.has(link)) {
          this.allLinks.set(link, []);
        }
        this.allLinks.get(link)!.push(relativePath);
      }
    }

    // Collect images
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = imageRegex.exec(content)) !== null) {
      const imagePath = match[2];
      if (!imagePath.startsWith('http')) {
        this.allImages.add(imagePath);
      }
    }
  }

  private async validateFile(relativePath: string): Promise<ValidationResult> {
    const fullPath = path.join(this.docsRoot, relativePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const stats: DocumentStats = {
      wordCount: 0,
      linkCount: 0,
      imageCount: 0,
      codeBlockCount: 0,
      headingCount: 0
    };

    // Validate line by line
    let inCodeBlock = false;
    let headingLevel = 0;
    let lastHeadingLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for code blocks
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (inCodeBlock) stats.codeBlockCount++;
        continue;
      }

      if (inCodeBlock) continue;

      // Check line length
      if (line.length > 120 && !line.startsWith('|')) {
        warnings.push({
          line: lineNumber,
          message: `Line exceeds 120 characters (${line.length})`,
          type: 'long-line'
        });
      }

      // Check headings
      const headingMatch = line.match(/^(#+)\s+(.+)$/);
      if (headingMatch) {
        stats.headingCount++;
        headingLevel = headingMatch[1].length;
        
        // Check heading hierarchy
        if (lastHeadingLevel > 0 && headingLevel > lastHeadingLevel + 1) {
          warnings.push({
            line: lineNumber,
            message: `Heading level skipped (${lastHeadingLevel} → ${headingLevel})`,
            type: 'inconsistent-heading'
          });
        }
        lastHeadingLevel = headingLevel;
      }

      // Check links
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(line)) !== null) {
        stats.linkCount++;
        const linkPath = linkMatch[2];
        
        if (!linkPath.startsWith('http') && !linkPath.startsWith('mailto:')) {
          // Internal link
          const resolvedPath = this.resolveLink(relativePath, linkPath);
          if (!this.isValidInternalLink(resolvedPath)) {
            errors.push({
              line: lineNumber,
              message: `Broken internal link: ${linkPath}`,
              type: 'broken-link'
            });
          }
        } else if (linkPath.startsWith('http')) {
          // External link validation would go here
          // For now, just count them
        }
      }

      // Check images
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let imageMatch;
      while ((imageMatch = imageRegex.exec(line)) !== null) {
        stats.imageCount++;
        const altText = imageMatch[1];
        const imagePath = imageMatch[2];
        
        if (!altText || altText.trim() === '') {
          warnings.push({
            line: lineNumber,
            message: 'Image missing alt text',
            type: 'missing-alt-text'
          });
        }
        
        if (!imagePath.startsWith('http')) {
          const resolvedPath = this.resolveLink(relativePath, imagePath);
          if (!this.isValidImage(resolvedPath)) {
            errors.push({
              line: lineNumber,
              message: `Missing image: ${imagePath}`,
              type: 'missing-image'
            });
          }
        }
      }

      // Check for TODOs
      if (line.includes('TODO') || line.includes('FIXME')) {
        warnings.push({
          line: lineNumber,
          message: 'Contains TODO/FIXME',
          type: 'todo'
        });
      }

      // Count words (rough estimate)
      if (!line.startsWith('#') && line.trim() !== '') {
        stats.wordCount += line.split(/\s+/).filter(w => w.length > 0).length;
      }
    }

    // Check for required sections based on file type
    const requiredSections = this.getRequiredSections(relativePath);
    for (const section of requiredSections) {
      if (!content.includes(`# ${section}`) && !content.includes(`## ${section}`)) {
        errors.push({
          line: 0,
          message: `Missing required section: ${section}`,
          type: 'missing-section'
        });
      }
    }

    return { file: relativePath, errors, warnings, stats };
  }

  private resolveLink(fromFile: string, link: string): string {
    if (link.startsWith('/')) {
      // Absolute path from docs root
      return link.substring(1);
    } else {
      // Relative path
      const dir = path.dirname(fromFile);
      return path.posix.normalize(path.posix.join(dir, link));
    }
  }

  private isValidInternalLink(link: string): boolean {
    // Remove anchor if present
    const linkWithoutAnchor = link.split('#')[0];
    
    // Check if file exists
    const fullPath = path.join(this.docsRoot, linkWithoutAnchor);
    
    // If no extension, assume .md
    if (!path.extname(linkWithoutAnchor)) {
      return fs.existsSync(fullPath + '.md') || fs.existsSync(fullPath + '/index.md');
    }
    
    return fs.existsSync(fullPath);
  }

  private isValidImage(imagePath: string): boolean {
    const fullPath = path.join(this.docsRoot, imagePath);
    return fs.existsSync(fullPath);
  }

  private getRequiredSections(file: string): string[] {
    // Define required sections based on file type
    if (file.includes('troubleshooting')) {
      return ['Problem', 'Solution'];
    } else if (file.includes('api-reference')) {
      return ['Parameters', 'Returns', 'Example'];
    } else if (file.includes('user-guide/features')) {
      return ['Overview', 'How to Use'];
    } else if (file.includes('getting-started')) {
      return ['Prerequisites', 'Installation'];
    }
    return [];
  }

  private printFileResult(result: ValidationResult): void {
    const hasIssues = result.errors.length > 0 || result.warnings.length > 0;
    
    if (hasIssues) {
      console.log(chalk.yellow(`📄 ${result.file}`));
      
      // Print errors
      for (const error of result.errors) {
        console.log(chalk.red(`  ❌ Line ${error.line}: ${error.message}`));
      }
      
      // Print warnings
      for (const warning of result.warnings) {
        console.log(chalk.yellow(`  ⚠️  Line ${warning.line}: ${warning.message}`));
      }
      
      console.log();
    } else {
      console.log(chalk.green(`✅ ${result.file}`));
    }
  }

  private printSummary(): void {
    console.log(chalk.blue('\n📊 Validation Summary\n'));

    let totalErrors = 0;
    let totalWarnings = 0;
    let totalWords = 0;
    let totalLinks = 0;
    let totalImages = 0;

    for (const result of this.results) {
      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
      totalWords += result.stats.wordCount;
      totalLinks += result.stats.linkCount;
      totalImages += result.stats.imageCount;
    }

    console.log(`Files validated: ${this.results.length}`);
    console.log(`Total errors: ${totalErrors > 0 ? chalk.red(totalErrors) : chalk.green(totalErrors)}`);
    console.log(`Total warnings: ${totalWarnings > 0 ? chalk.yellow(totalWarnings) : chalk.green(totalWarnings)}`);
    console.log(`\nContent Statistics:`);
    console.log(`  Words: ${totalWords.toLocaleString()}`);
    console.log(`  Links: ${totalLinks}`);
    console.log(`  Images: ${totalImages}`);

    // Check for orphaned files
    console.log(chalk.blue('\n🔗 Link Analysis\n'));
    
    const orphanedFiles: string[] = [];
    for (const file of this.results.map(r => r.file)) {
      let isLinked = false;
      for (const [link, sources] of this.allLinks) {
        if (link.includes(file) || link + '.md' === file) {
          isLinked = true;
          break;
        }
      }
      if (!isLinked && file !== 'index.md') {
        orphanedFiles.push(file);
      }
    }

    if (orphanedFiles.length > 0) {
      console.log(chalk.yellow('⚠️  Orphaned files (not linked from anywhere):'));
      for (const file of orphanedFiles) {
        console.log(`  - ${file}`);
      }
    } else {
      console.log(chalk.green('✅ All files are properly linked'));
    }

    // Generate validation report
    if (totalErrors > 0 || totalWarnings > 0) {
      this.generateReport();
    }

    // Exit with error code if errors found
    if (totalErrors > 0) {
      process.exit(1);
    }
  }

  private generateReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesValidated: this.results.length,
        totalErrors: this.results.reduce((sum, r) => sum + r.errors.length, 0),
        totalWarnings: this.results.reduce((sum, r) => sum + r.warnings.length, 0)
      },
      results: this.results.filter(r => r.errors.length > 0 || r.warnings.length > 0)
    };

    const reportPath = path.join(this.docsRoot, 'validation-report.json');
    fs.writeJsonSync(reportPath, report, { spaces: 2 });
    console.log(chalk.gray(`\nDetailed report saved to: ${reportPath}`));
  }
}

// CLI
program
  .name('validate-docs')
  .description('Validate Scanalyzer documentation')
  .option('-d, --docs <path>', 'Documentation root directory', './docs')
  .option('--fix', 'Attempt to fix simple issues')
  .action(async (options) => {
    const validator = new DocumentationValidator(options.docs);
    await validator.validate();
  });

program.parse();

// Export for programmatic use
export { DocumentationValidator, ValidationResult };