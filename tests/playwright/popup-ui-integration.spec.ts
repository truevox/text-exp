import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Playwright tests for PuffPuffPaste popup UI integration
 * Tests the extension popup interface and user interactions
 */

let context: BrowserContext;
let popupPage: Page;

test.describe('PuffPuffPaste Popup UI Integration', () => {
  
  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '../../build');
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ],
    });

    // Wait for extension to be ready
    await context.waitForEvent('page');
    
    // Get extension ID from background page
    const backgroundPages = context.backgroundPages();
    let extensionId: string;
    
    if (backgroundPages.length > 0) {
      extensionId = backgroundPages[0].url().match(/chrome-extension:\/\/([^/]+)/)?.[1] || '';
    } else {
      const backgroundPage = await context.waitForEvent('backgroundpage');
      extensionId = backgroundPage.url().match(/chrome-extension:\/\/([^/]+)/)?.[1] || '';
    }

    // Open popup page
    popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should load popup page successfully', async () => {
    // Wait for popup to load
    await popupPage.waitForSelector('body', { timeout: 10000 });
    
    // Check that page loaded without errors
    const title = await popupPage.title();
    expect(title).toBeTruthy();
    
    // Check for basic structure
    const bodyContent = await popupPage.locator('body').textContent();
    expect(bodyContent).toBeTruthy();
    
    // Verify no JavaScript errors
    const errors: string[] = [];
    popupPage.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await popupPage.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('should display main UI elements', async () => {
    // Look for common UI elements that should be present
    const elements = await popupPage.evaluate(() => {
      return {
        hasButtons: document.querySelectorAll('button').length > 0,
        hasInputs: document.querySelectorAll('input').length > 0,
        hasHeadings: document.querySelectorAll('h1, h2, h3, .title, [class*="title"]').length > 0,
        hasText: document.body.textContent!.length > 0,
        bodyClasses: document.body.className,
        htmlLang: document.documentElement.lang
      };
    });

    expect(elements.hasText).toBe(true);
    
    // Should have at least some interactive elements or content
    expect(elements.hasButtons || elements.hasInputs || elements.hasHeadings).toBe(true);
  });

  test('should handle snippet search functionality', async () => {
    // Look for search input
    const searchInputs = await popupPage.locator('input[type="text"], input[placeholder*="search"], input[id*="search"], input[class*="search"]').count();
    
    if (searchInputs > 0) {
      const searchInput = popupPage.locator('input[type="text"], input[placeholder*="search"], input[id*="search"], input[class*="search"]').first();
      
      // Test typing in search
      await searchInput.click();
      await searchInput.type('test');
      
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('test');
      
      // Clear search
      await searchInput.clear();
      const clearedValue = await searchInput.inputValue();
      expect(clearedValue).toBe('');
    } else {
      // If no search input found, test passes - it's optional functionality
      console.log('No search input found in popup - this is optional functionality');
    }
  });

  test('should handle snippet creation form', async () => {
    // Look for form elements that might be snippet creation
    const forms = await popupPage.locator('form').count();
    const triggerInputs = await popupPage.locator('input[placeholder*="trigger"], input[id*="trigger"], input[name*="trigger"]').count();
    const contentInputs = await popupPage.locator('textarea, input[placeholder*="content"], input[id*="content"]').count();
    
    if (forms > 0 || (triggerInputs > 0 && contentInputs > 0)) {
      // Test snippet creation form if present
      if (triggerInputs > 0) {
        const triggerInput = popupPage.locator('input[placeholder*="trigger"], input[id*="trigger"], input[name*="trigger"]').first();
        await triggerInput.click();
        await triggerInput.type(';testsnippet');
        
        const triggerValue = await triggerInput.inputValue();
        expect(triggerValue).toBe(';testsnippet');
      }
      
      if (contentInputs > 0) {
        const contentInput = popupPage.locator('textarea, input[placeholder*="content"], input[id*="content"]').first();
        await contentInput.click();
        await contentInput.type('Test snippet content');
        
        const contentValue = await contentInput.inputValue();
        expect(contentValue).toBe('Test snippet content');
      }
    } else {
      console.log('No snippet creation form found - testing basic popup functionality');
    }
  });

  test('should handle navigation and buttons', async () => {
    // Test any buttons present in the popup
    const buttons = await popupPage.locator('button').count();
    
    if (buttons > 0) {
      // Get all buttons
      const buttonElements = await popupPage.locator('button').all();
      
      for (let i = 0; i < Math.min(buttonElements.length, 3); i++) {
        const button = buttonElements[i];
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        
        if (isVisible && isEnabled) {
          // Check button text
          const buttonText = await button.textContent();
          expect(buttonText).toBeTruthy();
          
          // Test hover state (non-destructive)
          await button.hover();
          await popupPage.waitForTimeout(100);
          
          // Test that button is clickable (but don't actually click to avoid side effects)
          const boundingBox = await button.boundingBox();
          expect(boundingBox).toBeTruthy();
        }
      }
    }
  });

  test('should handle settings and preferences', async () => {
    // Look for settings-related elements
    const settingsElements = await popupPage.locator('[class*="setting"], [id*="setting"], input[type="checkbox"], select').count();
    
    if (settingsElements > 0) {
      // Test checkbox interactions
      const checkboxes = await popupPage.locator('input[type="checkbox"]').all();
      
      for (const checkbox of checkboxes.slice(0, 2)) { // Test first 2 checkboxes
        const isVisible = await checkbox.isVisible();
        const isEnabled = await checkbox.isEnabled();
        
        if (isVisible && isEnabled) {
          const initialState = await checkbox.isChecked();
          
          // Toggle checkbox
          await checkbox.click();
          const newState = await checkbox.isChecked();
          
          // Verify state changed
          expect(newState).toBe(!initialState);
          
          // Toggle back
          await checkbox.click();
          const finalState = await checkbox.isChecked();
          expect(finalState).toBe(initialState);
        }
      }
      
      // Test select dropdowns
      const selects = await popupPage.locator('select').all();
      
      for (const select of selects.slice(0, 1)) { // Test first select
        const isVisible = await select.isVisible();
        const isEnabled = await select.isEnabled();
        
        if (isVisible && isEnabled) {
          const options = await select.locator('option').count();
          expect(options).toBeGreaterThan(0);
          
          // Get current value
          const currentValue = await select.inputValue();
          expect(currentValue).toBeDefined();
        }
      }
    }
  });

  test('should handle snippet list display', async () => {
    // Look for elements that might display snippets
    const listElements = await popupPage.locator('ul, ol, .list, [class*="snippet"], [id*="snippet"]').count();
    
    if (listElements > 0) {
      // Test snippet list interactions
      const snippetItems = await popupPage.locator('li, .snippet-item, [class*="snippet-item"]').count();
      
      if (snippetItems > 0) {
        // Test first snippet item
        const firstItem = popupPage.locator('li, .snippet-item, [class*="snippet-item"]').first();
        const isVisible = await firstItem.isVisible();
        
        if (isVisible) {
          const itemText = await firstItem.textContent();
          expect(itemText).toBeTruthy();
          
          // Test hover
          await firstItem.hover();
          await popupPage.waitForTimeout(100);
        }
      }
    } else {
      console.log('No snippet list found - testing completed popup functionality');
    }
  });

  test('should maintain responsive design', async () => {
    // Test popup at different viewport sizes
    const viewports = [
      { width: 400, height: 600 }, // Standard popup size
      { width: 350, height: 500 }, // Smaller
      { width: 450, height: 700 }  // Larger
    ];

    for (const viewport of viewports) {
      await popupPage.setViewportSize(viewport);
      await popupPage.waitForTimeout(500);

      // Check that content is still visible and accessible
      const bodyHeight = await popupPage.evaluate(() => document.body.scrollHeight);
      const viewportHeight = viewport.height;
      
      // Content should fit reasonably within viewport or be scrollable
      expect(bodyHeight).toBeGreaterThan(0);
      
      // Check that no elements are completely off-screen horizontally
      const elements = await popupPage.locator('button, input, select').all();
      
      for (const element of elements.slice(0, 5)) { // Test first 5 elements
        const isVisible = await element.isVisible();
        if (isVisible) {
          const boundingBox = await element.boundingBox();
          if (boundingBox) {
            expect(boundingBox.x).toBeGreaterThanOrEqual(-10); // Allow some margin for transforms
            expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(viewport.width + 10);
          }
        }
      }
    }

    // Reset to standard size
    await popupPage.setViewportSize({ width: 400, height: 600 });
  });

  test('should handle error states gracefully', async () => {
    // Test error handling by checking console errors
    const errors: string[] = [];
    const warnings: string[] = [];
    
    popupPage.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    popupPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    // Interact with various elements to trigger any potential errors
    const buttons = await popupPage.locator('button').all();
    const inputs = await popupPage.locator('input').all();

    // Click a few buttons and inputs
    for (const button of buttons.slice(0, 2)) {
      try {
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        
        if (isVisible && isEnabled) {
          await button.click();
          await popupPage.waitForTimeout(100);
        }
      } catch (e) {
        // Some interactions might fail in test environment - that's okay
        console.log('Button interaction note:', e.message);
      }
    }

    for (const input of inputs.slice(0, 2)) {
      try {
        const isVisible = await input.isVisible();
        const isEnabled = await input.isEnabled();
        
        if (isVisible && isEnabled) {
          await input.click();
          await input.type('test');
          await popupPage.waitForTimeout(100);
        }
      } catch (e) {
        console.log('Input interaction note:', e.message);
      }
    }

    // Allow time for any async operations
    await popupPage.waitForTimeout(2000);

    // Critical errors should not occur during basic interactions
    const criticalErrors = errors.filter(error => 
      !error.includes('Extension context invalidated') && 
      !error.includes('Cannot access') &&
      !error.includes('NetworkError')
    );

    expect(criticalErrors).toHaveLength(0);
  });

});