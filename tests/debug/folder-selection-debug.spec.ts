/**
 * Debug Test for Folder Selection Issue
 * This test will help identify the root cause of the folder picker error
 */

import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../..");
const BUILD_PATH = path.resolve(EXTENSION_PATH, "build");

test.describe("Folder Selection Debug", () => {
  test.beforeEach(async ({ page, context }) => {
    // Load the extension
    await context.addInitScript(() => {
      // Mock chrome APIs if needed
      if (!globalThis.chrome) {
        globalThis.chrome = {
          runtime: {
            sendMessage: (message: any) => {
              console.log("🔍 [TEST] Mock sendMessage called:", message);
              return Promise.resolve({
                success: false,
                error: "Mock: No cloud provider configured",
              });
            },
            getManifest: () => ({ version: "1.0.0" }),
            getURL: (path: string) => `chrome-extension://test/${path}`,
          },
          storage: {
            local: {
              get: () => Promise.resolve({}),
              set: () => Promise.resolve(),
            },
            sync: {
              get: () => Promise.resolve({}),
              set: () => Promise.resolve(),
            },
          },
          identity: {
            getAuthToken: () => Promise.resolve("mock-token"),
          },
        };
      }
    });

    // Navigate to the options page
    await page.goto(`file://${BUILD_PATH}/options/options.html`);

    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test("Debug: Initial Page State", async ({ page }) => {
    console.log("🔍 [TEST] Starting debug test...");

    // Check if options page loads
    await expect(page.locator("h1")).toContainText("PuffPuffPaste");
    console.log("✅ [TEST] Options page loaded successfully");

    // Check authentication section
    const authSection = page.locator(".auth-section");
    await expect(authSection).toBeVisible();
    console.log("✅ [TEST] Authentication section visible");

    // Check folder section
    const folderSection = page.locator(".folders-section");
    await expect(folderSection).toBeVisible();
    console.log("✅ [TEST] Folder section visible");
  });

  test("Debug: Google Drive Connection Flow", async ({ page }) => {
    console.log("🔍 [TEST] Testing Google Drive connection...");

    // Check initial state
    const connectButton = page.locator("#connectGoogleDriveButton");
    await expect(connectButton).toBeVisible();
    console.log("✅ [TEST] Connect button visible");

    // Try clicking connect button
    await connectButton.click();
    console.log("🔍 [TEST] Clicked connect button");

    // Check for any error messages or status changes
    await page.waitForTimeout(2000);

    // Log any console messages
    page.on("console", (msg) => {
      console.log(`🔍 [BROWSER] ${msg.type()}: ${msg.text()}`);
    });

    // Check if authentication status changed
    const authStatus = page.locator("#authStatus");
    const statusText = await authStatus.textContent();
    console.log("🔍 [TEST] Auth status after click:", statusText);
  });

  test("Debug: Folder Picker Modal", async ({ page }) => {
    console.log("🔍 [TEST] Testing folder picker modal...");

    // First, we need to simulate being authenticated
    await page.evaluate(() => {
      // Mock authentication state
      window.localStorage.setItem("auth-status", "connected");
    });

    // Look for folder picker elements
    const folderPickers = page.locator("#folderPickers");
    await expect(folderPickers).toBeVisible();
    console.log("✅ [TEST] Folder pickers section visible");

    // Try to find a select folder button
    const selectButtons = page.locator('button:has-text("Select Folder")');
    const buttonCount = await selectButtons.count();
    console.log("🔍 [TEST] Found select folder buttons:", buttonCount);

    if (buttonCount > 0) {
      // Click first select folder button
      await selectButtons.first().click();
      console.log("🔍 [TEST] Clicked select folder button");

      // Check if modal appears
      const modal = page.locator("#folderPickerModal");
      const isModalVisible = await modal.isVisible();
      console.log("🔍 [TEST] Modal visible after click:", isModalVisible);

      if (isModalVisible) {
        // Check modal content
        const modalHeader = page.locator(".modal-header h3");
        const headerText = await modalHeader.textContent();
        console.log("🔍 [TEST] Modal header:", headerText);

        // Check for loading state
        const loading = page.locator("#folderPickerLoading");
        const isLoading = await loading.isVisible();
        console.log("🔍 [TEST] Loading state visible:", isLoading);

        // Check for error messages
        const errorDiv = page.locator("#folderPickerError");
        const isErrorVisible = await errorDiv.isVisible();
        console.log("🔍 [TEST] Error div visible:", isErrorVisible);

        if (isErrorVisible) {
          const errorText = await errorDiv.textContent();
          console.log("❌ [TEST] Error message:", errorText);
        }
      }
    }
  });

  test("Debug: Console Errors and Network Requests", async ({ page }) => {
    console.log("🔍 [TEST] Monitoring console and network activity...");

    const consoleMessages: string[] = [];
    const networkErrors: string[] = [];

    // Capture console messages
    page.on("console", (msg) => {
      const message = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push(message);
      console.log(`🔍 [BROWSER] ${message}`);
    });

    // Capture page errors
    page.on("pageerror", (error) => {
      const errorMessage = `Page Error: ${error.message}`;
      consoleMessages.push(errorMessage);
      console.error(`❌ [BROWSER] ${errorMessage}`);
    });

    // Monitor network requests
    page.on("request", (request) => {
      if (
        request.url().includes("googleapis") ||
        request.url().includes("chrome-extension")
      ) {
        console.log(
          `🌐 [NETWORK] Request: ${request.method()} ${request.url()}`,
        );
      }
    });

    page.on("response", (response) => {
      if (
        !response.ok() &&
        (response.url().includes("googleapis") ||
          response.url().includes("chrome-extension"))
      ) {
        const errorMessage = `Network Error: ${response.status()} ${response.url()}`;
        networkErrors.push(errorMessage);
        console.error(`❌ [NETWORK] ${errorMessage}`);
      }
    });

    // Try to trigger the folder selection flow
    await page.reload();
    await page.waitForTimeout(3000);

    // Try clicking connect button if it exists
    const connectButton = page.locator("#connectGoogleDriveButton");
    if (await connectButton.isVisible()) {
      await connectButton.click();
      await page.waitForTimeout(2000);
    }

    // Report findings
    console.log("📊 [TEST] Summary:");
    console.log(`- Console messages: ${consoleMessages.length}`);
    console.log(`- Network errors: ${networkErrors.length}`);

    if (networkErrors.length > 0) {
      console.log("❌ [TEST] Network errors found:", networkErrors);
    }

    // Look for specific error patterns
    const hasAuthError = consoleMessages.some(
      (msg) =>
        msg.includes("No cloud provider") ||
        msg.includes("authentication") ||
        msg.includes("currentAdapter"),
    );

    console.log("🔍 [TEST] Has authentication/adapter errors:", hasAuthError);
  });
});
