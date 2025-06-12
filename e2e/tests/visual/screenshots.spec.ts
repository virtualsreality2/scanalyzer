import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Set consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
  });

  test('dashboard appearance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for dynamic content
    await page.waitForSelector('[data-testid="summary-cards"]');
    await page.waitForTimeout(500); // Brief wait for any final rendering
    
    // Full page screenshot
    await expect(page).toHaveScreenshot('dashboard-full.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [page.locator('[data-testid="timestamp"]')] // Mask dynamic timestamps
    });
    
    // Component screenshots
    await expect(page.locator('[data-testid="summary-cards"]'))
      .toHaveScreenshot('dashboard-summary-cards.png');
    
    await expect(page.locator('[data-testid="severity-chart"]'))
      .toHaveScreenshot('dashboard-severity-chart.png');
    
    await expect(page.locator('[data-testid="trend-chart"]'))
      .toHaveScreenshot('dashboard-trend-chart.png');
  });

  test('dark mode appearance', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Toggle dark mode
    await page.click('[aria-label="Toggle theme"]');
    await page.waitForTimeout(300); // Wait for theme transition
    
    // Verify dark mode is active
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);
    
    // Full page screenshot in dark mode
    await expect(page).toHaveScreenshot('dashboard-dark.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [page.locator('[data-testid="timestamp"]')]
    });
    
    // Navigate to other pages in dark mode
    await page.click('a:has-text("Findings")');
    await page.waitForSelector('table');
    await expect(page).toHaveScreenshot('findings-dark.png', {
      fullPage: true,
      animations: 'disabled'
    });
    
    await page.click('a:has-text("Upload")');
    await expect(page).toHaveScreenshot('upload-dark.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('responsive layouts', async ({ page }) => {
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot(`dashboard-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        mask: [page.locator('[data-testid="timestamp"]')]
      });
      
      // Test mobile menu if applicable
      if (viewport.name === 'mobile') {
        const menuButton = page.locator('[aria-label="Open menu"]');
        if (await menuButton.isVisible()) {
          await menuButton.click();
          await expect(page.locator('[data-testid="mobile-menu"]'))
            .toHaveScreenshot('mobile-menu.png');
        }
      }
    }
  });

  test('findings table states', async ({ page }) => {
    await page.goto('/findings');
    await page.waitForLoadState('networkidle');
    
    // Empty state
    await expect(page.locator('[data-testid="empty-state"]'))
      .toHaveScreenshot('findings-empty.png');
    
    // Mock data for populated state
    await page.route('**/api/v1/findings', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          findings: Array.from({ length: 10 }, (_, i) => ({
            id: `finding-${i}`,
            title: `Security Finding ${i}`,
            severity: ['critical', 'high', 'medium', 'low'][i % 4],
            tool: ['nmap', 'nessus', 'burp'][i % 3],
            created_at: new Date().toISOString()
          })),
          total: 10
        })
      });
    });
    
    await page.reload();
    await page.waitForSelector('table');
    
    // Table with data
    await expect(page.locator('[data-testid="findings-table"]'))
      .toHaveScreenshot('findings-table.png');
    
    // With filters open
    await page.click('button:has-text("Filters")');
    await page.waitForSelector('[data-testid="filters-panel"]');
    await expect(page.locator('[data-testid="filters-panel"]'))
      .toHaveScreenshot('findings-filters.png');
  });

  test('upload states', async ({ page }) => {
    await page.goto('/upload');
    await page.waitForLoadState('networkidle');
    
    // Initial state
    await expect(page.locator('[data-testid="upload-area"]'))
      .toHaveScreenshot('upload-initial.png');
    
    // Drag over state
    const dropzone = page.locator('[data-testid="file-dropzone"]');
    await dropzone.dispatchEvent('dragenter');
    await expect(dropzone).toHaveScreenshot('upload-dragover.png');
    
    // With files selected
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      {
        name: 'test-report.xml',
        mimeType: 'text/xml',
        buffer: Buffer.from('<xml>test</xml>')
      }
    ]);
    
    await expect(page.locator('[data-testid="file-list"]'))
      .toHaveScreenshot('upload-files-selected.png');
  });

  test('modal and dialog states', async ({ page }) => {
    await page.goto('/findings');
    
    // Mock some findings data
    await page.route('**/api/v1/findings', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          findings: [{ 
            id: '1', 
            title: 'Test Finding', 
            severity: 'high',
            tool: 'nmap',
            created_at: new Date().toISOString()
          }],
          total: 1
        })
      });
    });
    
    await page.reload();
    await page.waitForSelector('table');
    
    // Export modal
    await page.click('button:has-text("Export")');
    await page.waitForSelector('[role="dialog"]');
    await expect(page.locator('[role="dialog"]'))
      .toHaveScreenshot('export-modal.png');
    
    // Close modal
    await page.keyboard.press('Escape');
    
    // Confirmation dialog (mock)
    await page.evaluate(() => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('data-testid', 'confirmation-dialog');
      dialog.innerHTML = `
        <h2>Confirm Action</h2>
        <p>Are you sure you want to delete this finding?</p>
        <button>Cancel</button>
        <button>Delete</button>
      `;
      dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      `;
      document.body.appendChild(dialog);
    });
    
    await expect(page.locator('[data-testid="confirmation-dialog"]'))
      .toHaveScreenshot('confirmation-dialog.png');
  });

  test('loading and error states', async ({ page }) => {
    // Loading state
    await page.route('**/api/v1/findings', async route => {
      await page.waitForTimeout(5000); // Simulate slow response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ findings: [], total: 0 })
      });
    });
    
    page.goto('/findings');
    await page.waitForSelector('[data-testid="loading-spinner"]');
    await expect(page.locator('[data-testid="loading-spinner"]'))
      .toHaveScreenshot('loading-state.png');
    
    // Error state
    await page.route('**/api/v1/findings', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.reload();
    await page.waitForSelector('[data-testid="error-message"]');
    await expect(page.locator('[data-testid="error-message"]'))
      .toHaveScreenshot('error-state.png');
  });

  test('hover and focus states', async ({ page }) => {
    await page.goto('/');
    
    // Button hover state
    const button = page.locator('button').first();
    await button.hover();
    await expect(button).toHaveScreenshot('button-hover.png');
    
    // Input focus state
    await page.click('a:has-text("Findings")');
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.focus();
    await expect(searchInput).toHaveScreenshot('input-focus.png');
    
    // Link focus state (keyboard navigation)
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveScreenshot('link-focus.png');
  });
});