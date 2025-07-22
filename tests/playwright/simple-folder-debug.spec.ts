/**
 * Simple Folder Selection Debug Test
 * Direct test of the built extension without complicated context switching
 */

import { test, expect, chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, "../../build");

test("Debug Folder Selection Issue", async () => {
  console.log("🚀 [TEST] Starting folder selection debug...");
  console.log("📁 [TEST] Extension path:", EXTENSION_PATH);

  // Launch Chrome with the extension
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect debug info
  const debugMessages: string[] = [];
  const errors: string[] = [];

  page.on("console", (msg) => {
    const message = `[${msg.type()}] ${msg.text()}`;
    debugMessages.push(message);
    if (
      msg.type() === "error" ||
      message.includes("ERROR") ||
      message.includes("Failed")
    ) {
      console.error(`❌ [BROWSER] ${message}`);
    } else if (message.includes("[DEBUG]")) {
      console.log(`🔍 [BROWSER] ${message}`);
    } else {
      console.log(`📝 [BROWSER] ${message}`);
    }
  });

  page.on("pageerror", (error) => {
    const errorMsg = `Page Error: ${error.message}`;
    errors.push(errorMsg);
    console.error(`❌ [PAGE] ${errorMsg}`);
  });

  try {
    // Navigate to a simple page first to get extension ID
    await page.goto("chrome://extensions/");
    await page.waitForLoadState("networkidle");

    // Find our extension ID by looking for PuffPuffPaste
    const extensionId = await page.evaluate(() => {
      const extensions = document.querySelectorAll("extensions-item");
      for (const ext of extensions) {
        const nameElement = ext.shadowRoot?.querySelector("#name");
        if (nameElement?.textContent?.includes("PuffPuffPaste")) {
          const idElement = ext.shadowRoot?.querySelector("#extension-id");
          return idElement?.textContent?.replace("ID: ", "") || null;
        }
      }
      return null;
    });

    console.log(`🔍 [TEST] Found extension ID: ${extensionId || "Not found"}`);

    if (!extensionId) {
      console.error("❌ [TEST] Extension not found or not loaded properly");

      // Try to see what extensions are loaded
      const loadedExtensions = await page.evaluate(() => {
        const extensions = document.querySelectorAll("extensions-item");
        return Array.from(extensions).map((ext) => {
          const name =
            ext.shadowRoot?.querySelector("#name")?.textContent || "Unknown";
          const id =
            ext.shadowRoot?.querySelector("#extension-id")?.textContent ||
            "No ID";
          return { name, id };
        });
      });

      console.log("🔍 [TEST] Loaded extensions:", loadedExtensions);
      throw new Error("Extension not loaded properly");
    }

    // Navigate to the extension options page
    const optionsUrl = `chrome-extension://${extensionId}/options/options.html`;
    console.log(`🔍 [TEST] Navigating to: ${optionsUrl}`);

    await page.goto(optionsUrl);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000); // Give time for initialization

    // Verify page loaded
    await expect(page.locator("h1")).toContainText("PuffPuffPaste");
    console.log("✅ [TEST] Options page loaded successfully");

    // Check for any immediate console errors
    await page.waitForTimeout(1000);

    // Look for authentication section
    const authSection = page.locator(".auth-section");
    await expect(authSection).toBeVisible();
    console.log("✅ [TEST] Auth section found");

    // Check current auth status
    const connectBtn = page.locator("#connectGoogleDriveButton");
    const disconnectBtn = page.locator("#disconnectGoogleDriveButton");

    const isConnectVisible = await connectBtn.isVisible();
    const isDisconnectVisible = await disconnectBtn.isVisible();

    console.log(
      `🔍 [TEST] Auth status - Connect visible: ${isConnectVisible}, Disconnect visible: ${isDisconnectVisible}`,
    );

    // If not connected, try to connect
    if (isConnectVisible) {
      console.log("🔐 [TEST] Attempting to connect to Google Drive...");
      await connectBtn.click();
      await page.waitForTimeout(3000); // Wait for auth attempt
    }

    // Look for folder selection area
    const folderSection = page.locator(".folders-section");
    await expect(folderSection).toBeVisible();
    console.log("✅ [TEST] Folder section found");

    // Look for folder picker elements
    const folderPickers = page.locator("#folderPickers");
    const hasPickerArea = await folderPickers.isVisible();
    console.log(`🔍 [TEST] Folder picker area visible: ${hasPickerArea}`);

    // Look for any Select Folder buttons
    const selectButtons = page
      .locator("button")
      .filter({ hasText: "Select Folder" });
    const buttonCount = await selectButtons.count();
    console.log(`🔍 [TEST] Found ${buttonCount} "Select Folder" buttons`);

    if (buttonCount > 0) {
      console.log(
        "🔍 [TEST] Attempting to click first Select Folder button...",
      );

      // Click the first button
      await selectButtons.first().click();
      await page.waitForTimeout(2000);

      // Check if modal opened
      const modal = page.locator("#folderPickerModal");
      const isModalVisible = await modal.isVisible();
      console.log(`🔍 [TEST] Folder picker modal visible: ${isModalVisible}`);

      if (isModalVisible) {
        console.log("✅ [TEST] Modal opened successfully");

        // Check modal content
        const modalHeader = await page
          .locator(".modal-header h3")
          .textContent();
        console.log(`🔍 [TEST] Modal header: ${modalHeader}`);

        // Check for loading state
        const loading = page.locator("#folderPickerLoading");
        const isLoading = await loading.isVisible();
        console.log(`🔍 [TEST] Loading visible: ${isLoading}`);

        // Wait for loading to complete or error to appear
        await page.waitForTimeout(5000);

        // Check for errors
        const errorDiv = page.locator("#folderPickerError");
        const hasError = await errorDiv.isVisible();

        if (hasError) {
          const errorText = await errorDiv.textContent();
          console.error(`❌ [TEST] Modal error: ${errorText}`);
          errors.push(`Modal error: ${errorText}`);
        } else {
          // Check if folders loaded
          const folderList = page.locator("#folderPickerList");
          const hasFolders = await folderList.isVisible();
          console.log(`🔍 [TEST] Folder list visible: ${hasFolders}`);

          if (hasFolders) {
            const items = await folderList.locator(".folder-item").count();
            console.log(`✅ [TEST] Found ${items} folder items`);
          }
        }
      } else {
        console.error("❌ [TEST] Modal did not open");

        // Check for error banners
        const statusBanner = page.locator("#statusBanner");
        const hasBanner = await statusBanner.isVisible();
        if (hasBanner) {
          const bannerText = await statusBanner.textContent();
          console.error(`❌ [TEST] Status banner: ${bannerText}`);
          errors.push(`Status banner: ${bannerText}`);
        }
      }
    } else {
      console.log(
        "ℹ️ [TEST] No Select Folder buttons found - checking for Add Folder option...",
      );

      const addButtons = page.locator("button").filter({ hasText: "Add" });
      const addCount = await addButtons.count();
      console.log(`🔍 [TEST] Found ${addCount} "Add" buttons`);
    }

    // Final wait to catch any delayed messages
    await page.waitForTimeout(2000);

    // Generate debug report
    console.log("\n📋 [REPORT] AUTOMATED DEBUG RESULTS");
    console.log("=".repeat(50));
    console.log(`Total console messages: ${debugMessages.length}`);
    console.log(`Errors detected: ${errors.length}`);

    // Show key debug messages
    const keyMessages = debugMessages.filter(
      (msg) =>
        msg.includes("[DEBUG]") ||
        msg.includes("ERROR") ||
        msg.includes("Failed") ||
        msg.includes("No cloud provider") ||
        msg.includes("authentication") ||
        msg.includes("SyncManager") ||
        msg.includes("FOLDER-PICKER"),
    );

    if (keyMessages.length > 0) {
      console.log("\n🔍 KEY DEBUG MESSAGES:");
      keyMessages.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg}`);
      });
    } else {
      console.log("\n⚠️ No specific debug messages found");
    }

    if (errors.length > 0) {
      console.log("\n❌ ERRORS FOUND:");
      errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    // Determine root cause
    let diagnosis = "Success";
    if (errors.some((e) => e.includes("No cloud provider"))) {
      diagnosis = "SyncManager currentAdapter is null";
    } else if (errors.some((e) => e.includes("authentication"))) {
      diagnosis = "Google Drive authentication failed";
    } else if (keyMessages.some((m) => m.includes("Failed to load folders"))) {
      diagnosis = "Folder loading API call failed";
    } else if (debugMessages.length < 5) {
      diagnosis = "Extension initialization issue";
    } else if (errors.length > 0) {
      diagnosis = "Other error detected";
    }

    console.log(`\n🎯 DIAGNOSIS: ${diagnosis}`);
    console.log("=".repeat(50));

    // Keep browser open for manual inspection if needed
    console.log("\n⏸️ Browser will remain open for manual inspection...");
    await page.waitForTimeout(10000); // Keep open for 10 seconds
  } catch (error) {
    console.error("❌ [TEST] Test failed:", error);
    throw error;
  } finally {
    await browser.close();
  }
});
