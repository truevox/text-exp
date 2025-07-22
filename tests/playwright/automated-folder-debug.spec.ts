/**
 * Automated Folder Selection Debug Test
 * Uses Playwright to automatically test and debug the folder selection issue
 */

import { test, expect, chromium, BrowserContext, Page } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../../build");

// Debug data collection
interface DebugData {
  consoleMessages: string[];
  errors: string[];
  networkRequests: string[];
  authStatus: string;
  folderPickerState: any;
  syncManagerState: any;
}

test.describe("Automated Folder Selection Debug", () => {
  let context: BrowserContext;
  let page: Page;
  let debugData: DebugData;

  test.beforeAll(async () => {
    // Launch browser with extension
    const pathToExtension = EXTENSION_PATH;
    context = await chromium.launchPersistentContext("", {
      headless: false, // Run headed so we can see what happens
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--disable-dev-shm-usage",
        "--disable-web-security", // For easier debugging
      ],
    });

    // Initialize debug data collection
    debugData = {
      consoleMessages: [],
      errors: [],
      networkRequests: [],
      authStatus: "unknown",
      folderPickerState: {},
      syncManagerState: {},
    };
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("Debug: Complete Folder Selection Flow Analysis", async () => {
    // Get the extension page
    const pages = context.pages();
    page = pages[0];

    // Set up comprehensive logging
    page.on("console", (msg) => {
      const message = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      debugData.consoleMessages.push(message);
      console.log(`🔍 [BROWSER] ${message}`);
    });

    page.on("pageerror", (error) => {
      const errorMsg = `Page Error: ${error.message}`;
      debugData.errors.push(errorMsg);
      console.error(`❌ [BROWSER] ${errorMsg}`);
    });

    page.on("request", (request) => {
      if (
        request.url().includes("googleapis") ||
        request.url().includes("chrome-extension")
      ) {
        const reqMsg = `${request.method()} ${request.url()}`;
        debugData.networkRequests.push(reqMsg);
        console.log(`🌐 [NETWORK] ${reqMsg}`);
      }
    });

    page.on("response", (response) => {
      if (
        !response.ok() &&
        (response.url().includes("googleapis") ||
          response.url().includes("chrome-extension"))
      ) {
        const errorMsg = `${response.status()} ${response.url()}`;
        debugData.errors.push(errorMsg);
        console.error(`❌ [NETWORK] ${errorMsg}`);
      }
    });

    console.log("🚀 [TEST] Starting automated folder selection debug...");

    // Step 1: Navigate to extension options page
    const extensionId = await page.evaluate(() => {
      return chrome.runtime.id;
    });

    console.log(`🔍 [TEST] Extension ID: ${extensionId}`);

    const optionsUrl = `chrome-extension://${extensionId}/options/options.html`;
    await page.goto(optionsUrl);
    await page.waitForLoadState("networkidle");

    console.log("✅ [TEST] Options page loaded");

    // Step 2: Wait for page initialization and collect initial state
    await page.waitForTimeout(2000);

    // Check if page loaded correctly
    await expect(page.locator("h1")).toContainText("PuffPuffPaste");
    console.log("✅ [TEST] Page title verified");

    // Step 3: Check authentication status
    const authSection = page.locator(".auth-section");
    await expect(authSection).toBeVisible();

    const connectButton = page.locator("#connectGoogleDriveButton");
    const isConnectVisible = await connectButton.isVisible();
    debugData.authStatus = isConnectVisible ? "disconnected" : "connected";

    console.log(`🔍 [TEST] Auth status: ${debugData.authStatus}`);

    // Step 4: Try to connect to Google Drive if not connected
    if (isConnectVisible) {
      console.log("🔐 [TEST] Attempting Google Drive connection...");

      // Mock the chrome.identity API for testing
      await page.addInitScript(() => {
        if (!window.chrome?.identity) {
          window.chrome = window.chrome || {};
          window.chrome.identity = {
            getAuthToken: (options: any, callback: any) => {
              console.log("🔍 [MOCK] chrome.identity.getAuthToken called");
              setTimeout(() => callback("mock-auth-token"), 100);
            },
            launchWebAuthFlow: (options: any, callback: any) => {
              console.log("🔍 [MOCK] chrome.identity.launchWebAuthFlow called");
              setTimeout(() => callback("mock-auth-code"), 100);
            },
          };
        }
      });

      await connectButton.click();
      await page.waitForTimeout(3000); // Wait for auth flow

      console.log("🔍 [TEST] Connect button clicked, waiting for response...");
    }

    // Step 5: Look for folder picker elements
    await page.waitForTimeout(1000);

    const folderSection = page.locator(".folders-section");
    await expect(folderSection).toBeVisible();
    console.log("✅ [TEST] Folder section visible");

    // Check for folder picker buttons
    const selectButtons = page.locator('button:has-text("Select Folder")');
    const buttonCount = await selectButtons.count();
    console.log(`🔍 [TEST] Found ${buttonCount} "Select Folder" buttons`);

    // Step 6: Try to trigger folder selection if buttons exist
    if (buttonCount > 0) {
      console.log(
        "🔍 [TEST] Attempting to click first Select Folder button...",
      );

      // Inject some debug helpers
      await page.evaluate(() => {
        // Add global debug function
        (window as any).debugSyncManager = () => {
          return new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { type: "GET_DEBUG_STATE" },
              (response) => {
                console.log("🔍 [DEBUG] SyncManager state:", response);
                resolve(response);
              },
            );
          });
        };
      });

      // Click the first select folder button
      await selectButtons.first().click();
      console.log("🔍 [TEST] Select folder button clicked");

      // Wait for modal or error
      await page.waitForTimeout(2000);

      // Check if modal appeared
      const modal = page.locator("#folderPickerModal");
      const isModalVisible = await modal.isVisible();
      console.log(`🔍 [TEST] Folder picker modal visible: ${isModalVisible}`);

      if (isModalVisible) {
        // Modal opened successfully - check its content
        const modalHeader = await page
          .locator(".modal-header h3")
          .textContent();
        console.log(`✅ [TEST] Modal opened with header: ${modalHeader}`);

        // Check for loading state
        const loading = page.locator("#folderPickerLoading");
        const isLoading = await loading.isVisible();
        console.log(`🔍 [TEST] Loading state: ${isLoading}`);

        // Check for errors
        const errorDiv = page.locator("#folderPickerError");
        const hasError = await errorDiv.isVisible();
        if (hasError) {
          const errorText = await errorDiv.textContent();
          console.error(`❌ [TEST] Error in modal: ${errorText}`);
          debugData.errors.push(`Modal error: ${errorText}`);
        }

        // Wait a bit more for folders to load or error to appear
        await page.waitForTimeout(3000);

        // Check final state
        const folderList = page.locator("#folderPickerList");
        const hasFolders = await folderList.isVisible();
        console.log(`🔍 [TEST] Folder list visible: ${hasFolders}`);

        if (hasFolders) {
          const folderItems = await folderList.locator(".folder-item").count();
          console.log(`✅ [TEST] Found ${folderItems} folders in list`);
        }
      } else {
        console.log("❌ [TEST] Modal did not open - checking for errors...");

        // Look for any error messages on the page
        const statusBanner = page.locator("#statusBanner");
        const hasBanner = await statusBanner.isVisible();
        if (hasBanner) {
          const bannerText = await statusBanner.textContent();
          console.error(`❌ [TEST] Status banner: ${bannerText}`);
          debugData.errors.push(`Status banner: ${bannerText}`);
        }
      }
    } else {
      console.log('❌ [TEST] No "Select Folder" buttons found');

      // Check if we need to add folders first
      const addFolderBtn = page.locator('button:has-text("Add Folder")');
      const hasAddBtn = await addFolderBtn.isVisible();
      console.log(`🔍 [TEST] "Add Folder" button visible: ${hasAddBtn}`);
    }

    // Step 7: Collect final debug information
    console.log("📊 [TEST] Collecting final debug data...");

    // Get any final console messages
    await page.waitForTimeout(1000);

    // Try to get sync manager state if possible
    try {
      debugData.syncManagerState = await page.evaluate(() => {
        return (window as any).debugSyncManager?.() || "Not available";
      });
    } catch (e) {
      console.log("🔍 [TEST] Could not get sync manager state");
    }

    // Step 8: Generate comprehensive debug report
    console.log("\n📋 [REPORT] FOLDER SELECTION DEBUG ANALYSIS");
    console.log("=".repeat(50));
    console.log(`Authentication Status: ${debugData.authStatus}`);
    console.log(`Console Messages: ${debugData.consoleMessages.length}`);
    console.log(`Errors Found: ${debugData.errors.length}`);
    console.log(`Network Requests: ${debugData.networkRequests.length}`);

    if (debugData.errors.length > 0) {
      console.log("\n❌ ERRORS DETECTED:");
      debugData.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    console.log("\n🔍 KEY CONSOLE MESSAGES:");
    const keyMessages = debugData.consoleMessages.filter(
      (msg) =>
        msg.includes("[DEBUG]") ||
        msg.includes("ERROR") ||
        msg.includes("Failed") ||
        msg.includes("No cloud provider") ||
        msg.includes("authentication"),
    );

    keyMessages.slice(-10).forEach((msg, i) => {
      // Show last 10 key messages
      console.log(`  ${i + 1}. ${msg}`);
    });

    if (keyMessages.length === 0) {
      console.log(
        "  ⚠️ No key debug messages found - this might indicate a deeper issue",
      );
    }

    // Determine likely root cause
    let rootCause = "Unknown";
    if (debugData.errors.some((e) => e.includes("No cloud provider"))) {
      rootCause = "SyncManager not properly initialized";
    } else if (debugData.errors.some((e) => e.includes("authentication"))) {
      rootCause = "Google Drive authentication failure";
    } else if (
      debugData.errors.some(
        (e) => e.includes("network") || e.includes("googleapis"),
      )
    ) {
      rootCause = "Network/API communication issue";
    } else if (debugData.consoleMessages.length === 0) {
      rootCause = "Extension not loading properly";
    }

    console.log(`\n🎯 LIKELY ROOT CAUSE: ${rootCause}`);
    console.log("=".repeat(50));

    // Assert that we got useful debug information
    expect(debugData.consoleMessages.length).toBeGreaterThan(0);
  });
});
