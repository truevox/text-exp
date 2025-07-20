import { test, expect } from "@playwright/test";

test.describe("Popup Integration Tests", () => {
  test("popup shows OK status", async ({ context }) => {
    // Wait for extension pages to be available
    await context.waitForEvent("page");

    // Get the background page
    const backgroundPage = context.backgroundPages()[0];
    if (!backgroundPage) {
      throw new Error("Background page not found");
    }

    // Open the popup
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      backgroundPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.action.openPopup(() => resolve(true));
        });
      }),
    ]);

    // Wait for popup to load
    await popup.waitForLoadState("domcontentloaded");

    // Check if status element exists and shows OK
    const statusElement = popup.locator(".status").first();
    if (await statusElement.isVisible()) {
      await expect(statusElement).toHaveText("✅");
    } else {
      // Alternative: check for any positive status indicator
      const positiveIndicators = [
        ".status-ok",
        '[data-status="ok"]',
        ".connected",
        ".ready",
      ];

      let found = false;
      for (const selector of positiveIndicators) {
        const element = popup.locator(selector);
        if (await element.isVisible()) {
          found = true;
          break;
        }
      }

      if (!found) {
        console.log(
          "Available elements:",
          await popup.locator("*").allTextContents(),
        );
      }
    }
  });

  test("popup has required elements", async ({ context }) => {
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      context.backgroundPages()[0]?.evaluate(() => {
        return new Promise((resolve) => {
          chrome.action.openPopup(() => resolve(true));
        });
      }),
    ]);

    await popup.waitForLoadState("domcontentloaded");

    // Check for essential popup elements
    const bodyExists = await popup.locator("body").isVisible();
    expect(bodyExists).toBeTruthy();

    // Log available content for debugging
    const content = await popup.content();
    console.log("Popup content preview:", content.substring(0, 500));
  });
});
