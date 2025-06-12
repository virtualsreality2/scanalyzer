import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Complete Security Analysis Workflow', () => {
  test('should complete full analysis from upload to export', async ({ page }) => {
    // Start at dashboard
    await page.goto('/');
    await expect(page).toHaveTitle(/Scanalyzer/);
    
    // Check dashboard loads
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('[data-testid="summary-cards"]')).toBeVisible();
    
    // Navigate to upload
    await page.click('a:has-text("Upload Report")');
    await expect(page.locator('h1')).toContainText('Upload Security Reports');
    
    // Upload report
    const fileInput = await page.locator('input[type="file"]');
    const sampleFile = path.join(__dirname, '../../fixtures/reports/sample-nmap.xml');
    await fileInput.setInputFiles(sampleFile);
    
    // Verify file appears in list
    await expect(page.locator('text=sample-nmap.xml')).toBeVisible();
    
    // Click upload button
    await page.click('button:has-text("Upload")');
    
    // Wait for processing
    await expect(page.locator('text=Processing')).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toBeVisible();
    
    // Wait for completion (max 30 seconds)
    await expect(page.locator('text=Upload complete')).toBeVisible({ timeout: 30000 });
    
    // View findings
    await page.click('button:has-text("View Findings")');
    await expect(page.locator('h1')).toContainText('Findings');
    
    // Verify findings table
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('tr[data-testid="finding-row"]')).toHaveCount.greaterThan(0);
    
    // Apply filters
    await page.click('button:has-text("Filters")');
    await page.check('input[value="high"]');
    await page.check('input[value="critical"]');
    await page.click('button:has-text("Apply")');
    
    // Verify filtered results
    const rowCount = await page.locator('tr[data-testid="finding-row"]').count();
    expect(rowCount).toBeGreaterThan(0);
    
    // Select findings for export
    await page.click('input[type="checkbox"][data-testid="select-all"]');
    
    // Export results
    await page.click('button:has-text("Export")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Select CSV format
    await page.click('label:has-text("CSV")');
    await page.click('button:has-text("Download")');
    
    // Wait for download
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toMatch(/findings.*\.csv/);
    
    // Verify file downloaded
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
  });
  
  test('should handle concurrent operations', async ({ browser }) => {
    // Create multiple contexts for different users
    const contexts = await Promise.all(
      Array(5).fill(0).map(() => browser.newContext())
    );
    
    const pages = await Promise.all(
      contexts.map(ctx => ctx.newPage())
    );
    
    // Navigate all to upload page
    await Promise.all(pages.map(page => 
      page.goto('/upload')
    ));
    
    // Prepare test files
    const testFiles = Array(5).fill(0).map((_, i) => 
      path.join(__dirname, `../../fixtures/reports/test-report-${i}.xml`)
    );
    
    // Simultaneous uploads
    await Promise.all(pages.map(async (page, i) => {
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFiles[i]);
      await page.click('button:has-text("Upload")');
    }));
    
    // All should show processing
    await Promise.all(pages.map(page => 
      expect(page.locator('text=Processing')).toBeVisible()
    ));
    
    // All should complete eventually
    await Promise.all(pages.map(page => 
      expect(page.locator('text=Upload complete')).toBeVisible({ timeout: 60000 })
    ));
    
    // Cleanup contexts
    await Promise.all(contexts.map(ctx => ctx.close()));
  });
  
  test('should maintain state across navigation', async ({ page }) => {
    // Upload a report first
    await page.goto('/upload');
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../../fixtures/reports/sample-nmap.xml'));
    await page.click('button:has-text("Upload")');
    await expect(page.locator('text=Upload complete')).toBeVisible({ timeout: 30000 });
    
    // Go to findings
    await page.click('button:has-text("View Findings")');
    
    // Apply some filters
    await page.click('button:has-text("Filters")');
    await page.check('input[value="high"]');
    await page.fill('input[placeholder="Search findings..."]', 'SQL injection');
    await page.click('button:has-text("Apply")');
    
    // Navigate away
    await page.click('a:has-text("Dashboard")');
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Navigate back
    await page.click('a:has-text("Findings")');
    
    // Filters should be preserved
    await expect(page.locator('input[value="high"]')).toBeChecked();
    await expect(page.locator('input[placeholder="Search findings..."]')).toHaveValue('SQL injection');
  });
  
  test('should handle errors gracefully', async ({ page }) => {
    await page.goto('/upload');
    
    // Try to upload invalid file
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../../fixtures/invalid/corrupted.xml'));
    await page.click('button:has-text("Upload")');
    
    // Should show error
    await expect(page.locator('text=Upload failed')).toBeVisible();
    await expect(page.locator('text=Invalid file format')).toBeVisible();
    
    // Should allow retry
    await expect(page.locator('button:has-text("Retry")')).toBeVisible();
  });
});