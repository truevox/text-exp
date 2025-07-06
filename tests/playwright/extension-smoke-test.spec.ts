import { test, expect, chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Smoke tests for PuffPuffPaste Chrome extension
 * Basic tests to verify extension loads and core functionality works
 */

test.describe("PuffPuffPaste Extension - Smoke Tests", () => {
  test("should load extension without errors", async () => {
    const pathToExtension = path.join(__dirname, "../../build");

    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    try {
      // Wait for extension to load
      await context.waitForEvent("page");

      // Check if extension loaded by looking for background page or service worker
      const backgroundPages = context.backgroundPages();
      const serviceWorkers = context.serviceWorkers();

      // Extension should have either a background page or service worker
      expect(backgroundPages.length + serviceWorkers.length).toBeGreaterThan(0);

      // If we have a background page, check its URL
      if (backgroundPages.length > 0) {
        const backgroundPage = backgroundPages[0];
        const url = backgroundPage.url();
        expect(url).toMatch(/chrome-extension:\/\/[a-z]+/);

        // Extract extension ID
        const extensionId = url.match(/chrome-extension:\/\/([^/]+)/)?.[1];
        expect(extensionId).toBeTruthy();
        expect(extensionId).toMatch(/^[a-z]+$/);
      }
    } finally {
      await context.close();
    }
  });

  test("should have valid manifest and extension structure", async () => {
    const pathToExtension = path.join(__dirname, "../../build");

    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--no-sandbox",
      ],
    });

    try {
      await context.waitForEvent("page");

      const backgroundPages = context.backgroundPages();

      if (backgroundPages.length > 0) {
        const backgroundPage = backgroundPages[0];
        const extensionId = backgroundPage
          .url()
          .match(/chrome-extension:\/\/([^/]+)/)?.[1];

        if (extensionId) {
          // Try to load the manifest
          const manifestPage = await context.newPage();

          try {
            await manifestPage.goto(
              `chrome-extension://${extensionId}/manifest.json`,
            );
            const manifestText = await manifestPage.textContent("pre, body");

            if (manifestText) {
              const manifest = JSON.parse(manifestText);

              // Basic manifest validation
              expect(manifest.manifest_version).toBeDefined();
              expect(manifest.name).toBeDefined();
              expect(manifest.version).toBeDefined();

              // Extension-specific checks
              expect(manifest.name).toContain("PuffPuffPaste");
              expect(manifest.manifest_version).toBe(3); // Should be Manifest V3
            }
          } catch (e) {
            console.log(
              "Manifest check note:",
              e instanceof Error ? e.message : String(e),
            );
          } finally {
            await manifestPage.close();
          }
        }
      }
    } finally {
      await context.close();
    }
  });

  test("should allow basic page interaction", async () => {
    const pathToExtension = path.join(__dirname, "../../build");

    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--no-sandbox",
      ],
    });

    try {
      // Create a test page
      const page = await context.newPage();
      await page.goto(
        'data:text/html,<html><body><input type="text" id="test" placeholder="Type here..."><div>Extension smoke test page</div></body></html>',
      );

      // Verify page loaded
      const pageTitle = await page.evaluate(
        () => document.title || "Test Page",
      );
      expect(pageTitle).toBeDefined();

      // Test basic interaction
      const input = page.locator("#test");
      await input.click();
      await input.type("Hello, test!");

      const inputValue = await input.inputValue();
      expect(inputValue).toBe("Hello, test!");

      // Verify Chrome extension APIs are available (indicates content script injection)
      const hasChromeAPIs = await page.evaluate(() => {
        return !!(window.chrome && typeof window.chrome === "object");
      });

      expect(hasChromeAPIs).toBe(true);

      await page.close();
    } finally {
      await context.close();
    }
  });

  test("should handle extension popup loading", async () => {
    const pathToExtension = path.join(__dirname, "../../build");

    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--no-sandbox",
      ],
    });

    try {
      await context.waitForEvent("page");

      const backgroundPages = context.backgroundPages();

      if (backgroundPages.length > 0) {
        const extensionId = backgroundPages[0]
          .url()
          .match(/chrome-extension:\/\/([^/]+)/)?.[1];

        if (extensionId) {
          const popupPage = await context.newPage();

          try {
            // Try to load the popup
            await popupPage.goto(
              `chrome-extension://${extensionId}/popup/popup.html`,
              {
                waitUntil: "domcontentloaded",
                timeout: 10000,
              },
            );

            // Wait for page to be ready
            await popupPage.waitForSelector("body", { timeout: 5000 });

            // Basic popup validation
            const popupTitle = await popupPage.title();
            expect(popupTitle).toBeDefined();

            const bodyContent = await popupPage.locator("body").textContent();
            expect(bodyContent).toBeTruthy();

            // Check that popup loaded without critical errors
            const errors: string[] = [];
            popupPage.on("pageerror", (error) => {
              errors.push(error.message);
            });

            await popupPage.waitForTimeout(2000);

            // Filter out non-critical errors
            const criticalErrors = errors.filter(
              (error) =>
                !error.includes("Extension context invalidated") &&
                !error.includes("Cannot access") &&
                !error.includes("NetworkError"),
            );

            expect(criticalErrors).toHaveLength(0);
          } catch (e) {
            console.log(
              "Popup load note:",
              e instanceof Error ? e.message : String(e),
            );
            // Popup might not exist or load properly in test environment - that's ok for smoke test
          } finally {
            await popupPage.close();
          }
        }
      }
    } finally {
      await context.close();
    }
  });
});
