import { test, expect, chromium } from '@playwright/test';

test.describe('Performance Metrics', () => {
  test('should meet Core Web Vitals benchmarks', async ({ page, browserName }) => {
    // Skip on non-Chrome browsers
    test.skip(browserName !== 'chromium', 'Performance metrics only available in Chrome');
    
    // Enable performance metrics collection
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');
    
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Collect Core Web Vitals
    const metrics = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        let lcp: number | undefined;
        let fid: number | undefined;
        let cls: number | undefined;
        let fcp: number | undefined;
        let ttfb: number | undefined;
        
        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // First Input Delay
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const firstEntry = entries[0];
          fid = firstEntry.processingStart - firstEntry.startTime;
        }).observe({ entryTypes: ['first-input'] });
        
        // Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          cls = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });
        
        // First Contentful Paint & Time to First Byte
        const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
        ttfb = navTiming.responseStart - navTiming.requestStart;
        
        // Wait a bit to collect metrics
        setTimeout(() => {
          resolve({
            lcp: lcp || 0,
            fid: fid || 0,
            cls: cls || 0,
            fcp: fcp || 0,
            ttfb: ttfb || 0
          });
        }, 5000);
      });
    });
    
    // Assert Core Web Vitals thresholds
    expect(metrics.lcp).toBeLessThan(2500); // Good LCP < 2.5s
    expect(metrics.fid).toBeLessThan(100);  // Good FID < 100ms
    expect(metrics.cls).toBeLessThan(0.1);  // Good CLS < 0.1
    expect(metrics.fcp).toBeLessThan(1800); // Good FCP < 1.8s
    expect(metrics.ttfb).toBeLessThan(800); // Good TTFB < 800ms
    
    console.log('Performance Metrics:', metrics);
  });
  
  test('should handle large datasets efficiently', async ({ page }) => {
    // Navigate to findings page with large dataset
    await page.goto('/findings?mock=large'); // Mock parameter for testing
    
    // Measure initial render time
    const startTime = Date.now();
    await page.waitForSelector('table');
    const initialRenderTime = Date.now() - startTime;
    
    expect(initialRenderTime).toBeLessThan(2000); // Should render in < 2s
    
    // Test virtual scrolling performance
    const scrollContainer = await page.locator('[data-testid="virtual-scroller"]');
    
    // Measure scroll performance
    const scrollPerfData = await page.evaluate(async (selector) => {
      const container = document.querySelector(selector);
      if (!container) return null;
      
      const measurements: number[] = [];
      const scrollSteps = 10;
      const scrollAmount = container.scrollHeight / scrollSteps;
      
      for (let i = 0; i < scrollSteps; i++) {
        const start = performance.now();
        container.scrollTop = scrollAmount * i;
        
        // Wait for next frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const frameTime = performance.now() - start;
        measurements.push(frameTime);
      }
      
      return {
        avgFrameTime: measurements.reduce((a, b) => a + b) / measurements.length,
        maxFrameTime: Math.max(...measurements),
        fps: 1000 / (measurements.reduce((a, b) => a + b) / measurements.length)
      };
    }, '[data-testid="virtual-scroller"]');
    
    expect(scrollPerfData).not.toBeNull();
    expect(scrollPerfData!.fps).toBeGreaterThan(30); // Should maintain > 30fps
    expect(scrollPerfData!.maxFrameTime).toBeLessThan(50); // No frame should take > 50ms
  });
  
  test('should optimize bundle size', async ({ page }) => {
    // Intercept network requests
    const resources: Array<{ url: string; size: number; type: string }> = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      const headers = response.headers();
      const contentLength = headers['content-length'];
      
      if (contentLength && (url.includes('.js') || url.includes('.css'))) {
        resources.push({
          url,
          size: parseInt(contentLength),
          type: url.includes('.js') ? 'js' : 'css'
        });
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Calculate bundle sizes
    const jsBundleSize = resources
      .filter(r => r.type === 'js')
      .reduce((sum, r) => sum + r.size, 0);
      
    const cssBundleSize = resources
      .filter(r => r.type === 'css')
      .reduce((sum, r) => sum + r.size, 0);
    
    // Assert bundle size limits
    expect(jsBundleSize).toBeLessThan(500 * 1024); // JS < 500KB
    expect(cssBundleSize).toBeLessThan(100 * 1024); // CSS < 100KB
    
    console.log(`Bundle sizes - JS: ${(jsBundleSize / 1024).toFixed(2)}KB, CSS: ${(cssBundleSize / 1024).toFixed(2)}KB`);
  });
  
  test('should load images efficiently', async ({ page }) => {
    await page.goto('/');
    
    // Check for lazy loading
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const loading = await img.getAttribute('loading');
      const isAboveFold = await img.isIntersectingViewport();
      
      if (!isAboveFold) {
        expect(loading).toBe('lazy');
      }
    }
    
    // Check for proper image formats
    const imageRequests = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(entry => entry.name.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i))
        .map(entry => ({
          url: entry.name,
          duration: entry.duration,
          size: (entry as any).encodedBodySize
        }));
    });
    
    // Prefer modern formats
    const modernFormats = imageRequests.filter(img => 
      img.url.match(/\.(webp|avif)$/i)
    );
    
    expect(modernFormats.length).toBeGreaterThan(0);
    
    // Images should load quickly
    imageRequests.forEach(img => {
      expect(img.duration).toBeLessThan(1000); // Each image < 1s
    });
  });
  
  test('should cache resources effectively', async ({ page }) => {
    // First visit
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Collect resource timing
    const firstVisitResources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(entry => ({
        name: entry.name,
        duration: entry.duration,
        cached: (entry as any).transferSize === 0
      }));
    });
    
    // Second visit (should use cache)
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const secondVisitResources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(entry => ({
        name: entry.name,
        duration: entry.duration,
        cached: (entry as any).transferSize === 0
      }));
    });
    
    // Static assets should be cached
    const cachedResources = secondVisitResources.filter(r => r.cached);
    const cacheRatio = cachedResources.length / secondVisitResources.length;
    
    expect(cacheRatio).toBeGreaterThan(0.7); // At least 70% cache hit rate
    
    // Cached resources should load faster
    const avgFirstVisitDuration = firstVisitResources.reduce((sum, r) => sum + r.duration, 0) / firstVisitResources.length;
    const avgSecondVisitDuration = secondVisitResources.reduce((sum, r) => sum + r.duration, 0) / secondVisitResources.length;
    
    expect(avgSecondVisitDuration).toBeLessThan(avgFirstVisitDuration * 0.5); // 50% faster on second visit
  });
});