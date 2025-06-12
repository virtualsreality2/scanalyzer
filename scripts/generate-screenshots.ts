#!/usr/bin/env ts-node

import { chromium, Page, Browser, BrowserContext } from 'playwright';
import sharp from 'sharp';
import * as fs from 'fs-extra';
import * as path from 'path';
import { program } from 'commander';

interface ScreenshotConfig {
  name: string;
  url: string;
  selector?: string;
  fullPage?: boolean;
  annotations?: Annotation[];
  actions?: Action[];
  viewport?: { width: number; height: number };
  theme?: 'light' | 'dark';
  maskSelectors?: string[];
}

interface Annotation {
  type: 'arrow' | 'highlight' | 'text' | 'blur';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
}

interface Action {
  type: 'click' | 'type' | 'hover' | 'wait';
  selector?: string;
  text?: string;
  timeout?: number;
}

const SCREENSHOT_CONFIGS: ScreenshotConfig[] = [
  // Dashboard Screenshots
  {
    name: 'dashboard-overview',
    url: '/',
    fullPage: true,
    annotations: [
      {
        type: 'highlight',
        x: 20,
        y: 100,
        width: 300,
        height: 400,
        color: '#4F46E5'
      },
      {
        type: 'text',
        x: 340,
        y: 150,
        text: 'Navigation sidebar for quick access',
        color: '#4F46E5'
      },
      {
        type: 'arrow',
        x: 340,
        y: 170,
        direction: 'left',
        color: '#4F46E5'
      }
    ]
  },
  {
    name: 'dashboard-dark',
    url: '/',
    fullPage: true,
    theme: 'dark',
    actions: [
      { type: 'click', selector: '[aria-label="Toggle theme"]' },
      { type: 'wait', timeout: 500 }
    ]
  },
  {
    name: 'summary-cards',
    url: '/',
    selector: '[data-testid="summary-cards"]',
    annotations: [
      {
        type: 'highlight',
        x: 10,
        y: 10,
        width: 280,
        height: 120,
        color: '#EF4444'
      },
      {
        type: 'text',
        x: 300,
        y: 70,
        text: 'Critical findings requiring immediate attention',
        color: '#EF4444'
      }
    ]
  },

  // Upload Screenshots
  {
    name: 'upload-interface',
    url: '/upload',
    fullPage: false,
    selector: '[data-testid="upload-area"]'
  },
  {
    name: 'upload-dragover',
    url: '/upload',
    selector: '[data-testid="file-dropzone"]',
    actions: [
      { type: 'hover', selector: '[data-testid="file-dropzone"]' }
    ],
    annotations: [
      {
        type: 'text',
        x: 50,
        y: 50,
        text: 'Drag files here',
        color: '#10B981'
      }
    ]
  },
  {
    name: 'upload-progress',
    url: '/upload',
    fullPage: false,
    actions: [
      {
        type: 'click',
        selector: 'input[type="file"]'
      }
    ]
  },

  // Findings Screenshots
  {
    name: 'findings-main',
    url: '/findings',
    fullPage: true,
    maskSelectors: ['[data-testid="timestamp"]'],
    annotations: [
      {
        type: 'highlight',
        x: 20,
        y: 80,
        width: 200,
        height: 50,
        color: '#3B82F6'
      },
      {
        type: 'text',
        x: 230,
        y: 105,
        text: 'Search across all findings',
        color: '#3B82F6'
      }
    ]
  },
  {
    name: 'filter-panel',
    url: '/findings',
    selector: '[data-testid="filters-panel"]',
    actions: [
      { type: 'click', selector: 'button:has-text("Filters")' },
      { type: 'wait', timeout: 300 }
    ]
  },
  {
    name: 'finding-detail',
    url: '/findings',
    fullPage: false,
    actions: [
      { type: 'click', selector: 'tr[data-row-index="0"]' },
      { type: 'wait', timeout: 500 }
    ],
    selector: '[data-testid="finding-detail"]',
    annotations: [
      {
        type: 'blur',
        x: 100,
        y: 200,
        width: 400,
        height: 100
      },
      {
        type: 'arrow',
        x: 520,
        y: 250,
        direction: 'left',
        color: '#EF4444'
      },
      {
        type: 'text',
        x: 530,
        y: 240,
        text: 'Sensitive data redacted',
        color: '#EF4444'
      }
    ]
  },

  // Export Modal
  {
    name: 'export-modal',
    url: '/findings',
    selector: '[role="dialog"]',
    actions: [
      { type: 'click', selector: 'button:has-text("Export")' },
      { type: 'wait', timeout: 300 }
    ]
  },

  // Settings
  {
    name: 'settings-general',
    url: '/settings',
    fullPage: false,
    selector: '[data-testid="settings-content"]'
  },

  // Welcome Screen
  {
    name: 'welcome-screen',
    url: '/?firstLaunch=true',
    fullPage: true
  },

  // Mobile Views
  {
    name: 'mobile-dashboard',
    url: '/',
    fullPage: true,
    viewport: { width: 375, height: 667 },
    actions: [
      { type: 'wait', timeout: 1000 }
    ]
  },
  {
    name: 'mobile-menu',
    url: '/',
    viewport: { width: 375, height: 667 },
    selector: '[data-testid="mobile-menu"]',
    actions: [
      { type: 'click', selector: '[aria-label="Open menu"]' },
      { type: 'wait', timeout: 300 }
    ]
  }
];

async function setupMockData(page: Page) {
  // Intercept API calls and provide mock data
  await page.route('**/api/v1/reports/summary', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total_reports: 42,
        total_findings: 1337,
        critical_findings: 15,
        high_findings: 47,
        medium_findings: 123,
        low_findings: 502,
        info_findings: 650,
        recent_reports: [
          {
            id: '1',
            filename: 'prowler-prod-scan.json',
            tool: 'prowler',
            created_at: new Date().toISOString(),
            findings_count: 234
          },
          {
            id: '2',
            filename: 'checkov-infrastructure.json',
            tool: 'checkov',
            created_at: new Date(Date.now() - 86400000).toISOString(),
            findings_count: 156
          }
        ]
      })
    });
  });

  await page.route('**/api/v1/findings**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        findings: [
          {
            id: '1',
            title: 'SQL Injection in User Authentication',
            description: 'User input is not properly sanitized before being used in SQL query',
            severity: 'critical',
            tool: 'bandit',
            category: 'Injection',
            file_path: '/app/auth/login.py',
            line_number: 45,
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            title: 'Hardcoded AWS Credentials',
            description: 'AWS access keys found in source code',
            severity: 'critical',
            tool: 'checkov',
            category: 'Authentication',
            file_path: '/config/aws.js',
            line_number: 12,
            created_at: new Date().toISOString()
          },
          {
            id: '3',
            title: 'Missing HTTPS in Production',
            description: 'Application accepts HTTP connections in production environment',
            severity: 'high',
            tool: 'prowler',
            category: 'Encryption',
            file_path: '/terraform/main.tf',
            line_number: 78,
            created_at: new Date().toISOString()
          }
        ],
        total: 1337,
        page: 1,
        page_size: 20
      })
    });
  });
}

async function applyAnnotations(imagePath: string, annotations: Annotation[]) {
  if (!annotations || annotations.length === 0) return;

  const image = sharp(imagePath);
  const metadata = await image.metadata();
  
  // Create SVG overlay with annotations
  const svgAnnotations = annotations.map(ann => {
    switch (ann.type) {
      case 'highlight':
        return `<rect x="${ann.x}" y="${ann.y}" width="${ann.width}" height="${ann.height}" 
                fill="none" stroke="${ann.color || '#4F46E5'}" stroke-width="3" 
                stroke-dasharray="5,5" rx="4" opacity="0.8"/>`;
      
      case 'arrow':
        const arrowPaths = {
          up: 'M0,20 L10,0 L20,20 M10,0 L10,40',
          down: 'M0,0 L10,20 L20,0 M10,20 L10,40',
          left: 'M20,0 L0,10 L20,20 M0,10 L40,10',
          right: 'M0,0 L20,10 L0,20 M20,10 L40,10'
        };
        return `<g transform="translate(${ann.x}, ${ann.y})">
                <path d="${arrowPaths[ann.direction || 'left']}" 
                stroke="${ann.color || '#EF4444'}" stroke-width="3" fill="none"/>
                </g>`;
      
      case 'text':
        return `<text x="${ann.x}" y="${ann.y}" font-family="Arial, sans-serif" 
                font-size="16" font-weight="bold" fill="${ann.color || '#000'}"
                filter="url(#textBg)">${ann.text}</text>`;
      
      case 'blur':
        return `<rect x="${ann.x}" y="${ann.y}" width="${ann.width}" height="${ann.height}"
                fill="rgba(0,0,0,0.8)" filter="url(#blur)" rx="4"/>`;
      
      default:
        return '';
    }
  }).join('\n');

  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}">
      <defs>
        <filter id="blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="10"/>
        </filter>
        <filter id="textBg" x="-20%" y="-20%" width="140%" height="140%">
          <feFlood flood-color="white" flood-opacity="0.9"/>
          <feComposite in="SourceGraphic" operator="over"/>
        </filter>
      </defs>
      ${svgAnnotations}
    </svg>
  `;

  // Composite the SVG overlay onto the image
  await sharp(imagePath)
    .composite([{
      input: Buffer.from(svg),
      top: 0,
      left: 0
    }])
    .toFile(imagePath.replace('.png', '-annotated.png'));

  // Replace original with annotated version
  await fs.move(imagePath.replace('.png', '-annotated.png'), imagePath, { overwrite: true });
}

async function generateScreenshot(
  page: Page,
  config: ScreenshotConfig,
  outputDir: string
) {
  console.log(`📸 Generating screenshot: ${config.name}`);

  // Set viewport if specified
  if (config.viewport) {
    await page.setViewportSize(config.viewport);
  }

  // Navigate to URL
  await page.goto(`http://localhost:3000${config.url}`, {
    waitUntil: 'networkidle'
  });

  // Apply theme if specified
  if (config.theme === 'dark') {
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
  }

  // Execute actions
  if (config.actions) {
    for (const action of config.actions) {
      switch (action.type) {
        case 'click':
          await page.click(action.selector!);
          break;
        case 'type':
          await page.fill(action.selector!, action.text!);
          break;
        case 'hover':
          await page.hover(action.selector!);
          break;
        case 'wait':
          await page.waitForTimeout(action.timeout || 1000);
          break;
      }
    }
  }

  // Take screenshot
  const outputPath = path.join(outputDir, `${config.name}.png`);
  const screenshotOptions: any = {
    path: outputPath,
    animations: 'disabled'
  };

  if (config.fullPage) {
    screenshotOptions.fullPage = true;
  }

  if (config.maskSelectors) {
    screenshotOptions.mask = config.maskSelectors.map(selector => 
      page.locator(selector)
    );
  }

  if (config.selector) {
    await page.locator(config.selector).screenshot(screenshotOptions);
  } else {
    await page.screenshot(screenshotOptions);
  }

  // Apply annotations
  if (config.annotations) {
    await applyAnnotations(outputPath, config.annotations);
  }

  console.log(`   ✅ Saved to ${outputPath}`);
}

async function generateAllScreenshots(options: any) {
  const browser = await chromium.launch({
    headless: options.headless
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2, // Retina display quality
    hasTouch: false
  });

  const page = await context.newPage();

  // Setup mock data
  await setupMockData(page);

  // Create output directory
  const outputDir = path.resolve(options.output);
  await fs.ensureDir(outputDir);

  // Generate screenshots
  const configs = options.only 
    ? SCREENSHOT_CONFIGS.filter(c => c.name === options.only)
    : SCREENSHOT_CONFIGS;

  for (const config of configs) {
    try {
      await generateScreenshot(page, config, outputDir);
    } catch (error) {
      console.error(`   ❌ Failed to generate ${config.name}:`, error);
    }
  }

  await browser.close();
  console.log(`\n✨ Generated ${configs.length} screenshots in ${outputDir}`);
}

// CLI
program
  .name('generate-screenshots')
  .description('Generate screenshots for Scanalyzer documentation')
  .option('-o, --output <dir>', 'Output directory', './docs/images/screenshots')
  .option('-h, --headless', 'Run in headless mode', true)
  .option('--only <name>', 'Generate only specific screenshot')
  .action(generateAllScreenshots);

program.parse();

// Export for programmatic use
export { generateScreenshot, generateAllScreenshots, SCREENSHOT_CONFIGS };