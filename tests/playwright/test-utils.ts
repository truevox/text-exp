/**
 * Test Utilities for Playwright Extension Tests
 * Provides common functionality for testing PuffPuffPaste extension
 */

import {
  type BrowserContext,
  type Page,
  expect,
  chromium,
} from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ExtensionContext {
  context: BrowserContext;
  extensionPage: Page;
  extensionId: string;
}

export interface TestSnippet {
  trigger: string;
  content: string;
  description?: string;
  contentType?: "text" | "html";
  variables?: Array<{
    name: string;
    description: string;
    defaultValue?: string;
  }>;
}

/**
 * Sets up Chrome extension context for testing
 */
export async function setupExtensionContext(): Promise<ExtensionContext> {
  const pathToExtension = path.join(__dirname, "../../build");

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
    ],
  });

  // Wait for extension to load
  await context.waitForEvent("page");

  // Get extension background page/service worker
  let extensionPage: Page;
  const backgroundPages = context.backgroundPages();
  if (backgroundPages.length > 0) {
    extensionPage = backgroundPages[0];
  } else {
    extensionPage = await context.waitForEvent("backgroundpage");
  }

  // Get extension ID
  const extensionId = extensionPage
    .url()
    .match(/chrome-extension:\/\/([^/]+)/)?.[1];

  if (!extensionId) {
    throw new Error("Could not determine extension ID");
  }

  return { context, extensionPage, extensionId };
}

/**
 * Opens extension popup
 */
export async function openPopup(
  extensionContext: ExtensionContext,
): Promise<Page> {
  const popupPage = await extensionContext.context.newPage();
  await popupPage.goto(
    `chrome-extension://${extensionContext.extensionId}/popup/popup.html`,
  );
  await popupPage.waitForSelector("body");
  return popupPage;
}

/**
 * Opens extension options page
 */
export async function openOptionsPage(
  extensionContext: ExtensionContext,
): Promise<Page> {
  const optionsPage = await extensionContext.context.newPage();
  await optionsPage.goto(
    `chrome-extension://${extensionContext.extensionId}/options/options.html`,
  );
  await optionsPage.waitForSelector("body");
  return optionsPage;
}

/**
 * Creates a snippet using the popup interface
 */
export async function createSnippet(
  popupPage: Page,
  snippet: TestSnippet,
): Promise<void> {
  // Click Add Snippet button
  await popupPage.click("#addSnippetButton");

  // Wait for modal to open
  await popupPage.waitForSelector("#snippetModal:not(.hidden)");

  // Wait for advanced editor to initialize
  await popupPage.waitForSelector("#advancedSnippetEditor");

  // Fill in snippet details - look for the form inputs in the advanced editor
  await popupPage.waitForTimeout(500); // Give editor time to render

  // Try multiple selectors for trigger input
  const triggerSelectors = [
    '#advancedSnippetEditor input[name="trigger"]',
    '#advancedSnippetEditor input[placeholder*="trigger"]',
    "#advancedSnippetEditor .trigger-input input",
    '#advancedSnippetEditor input[type="text"]:first-of-type',
  ];

  let triggerInput;
  for (const selector of triggerSelectors) {
    try {
      triggerInput = popupPage.locator(selector);
      if (await triggerInput.isVisible()) break;
    } catch (e) {
      continue;
    }
  }

  if (triggerInput && (await triggerInput.isVisible())) {
    await triggerInput.fill(snippet.trigger);
  } else {
    // Fallback: use JavaScript to set values
    await popupPage.evaluate((trigger) => {
      const inputs = document.querySelectorAll(
        "#advancedSnippetEditor input[type='text']",
      );
      if (inputs[0]) (inputs[0] as HTMLInputElement).value = trigger;
    }, snippet.trigger);
  }

  // Try multiple selectors for content
  const contentSelectors = [
    '#advancedSnippetEditor textarea[name="content"]',
    '#advancedSnippetEditor textarea[placeholder*="content"]',
    "#advancedSnippetEditor .content-input textarea",
    "#advancedSnippetEditor textarea",
  ];

  let contentInput;
  for (const selector of contentSelectors) {
    try {
      contentInput = popupPage.locator(selector);
      if (await contentInput.isVisible()) break;
    } catch (e) {
      continue;
    }
  }

  if (contentInput && (await contentInput.isVisible())) {
    await contentInput.fill(snippet.content);
  } else {
    // Fallback: use JavaScript to set content
    await popupPage.evaluate((content) => {
      const textareas = document.querySelectorAll(
        "#advancedSnippetEditor textarea",
      );
      if (textareas[0]) (textareas[0] as HTMLTextAreaElement).value = content;
    }, snippet.content);
  }

  // Set description if provided
  if (snippet.description) {
    const descriptionSelectors = [
      '#advancedSnippetEditor input[name="description"]',
      '#advancedSnippetEditor input[placeholder*="description"]',
      "#advancedSnippetEditor .description-input input",
    ];

    let descriptionInput;
    for (const selector of descriptionSelectors) {
      try {
        descriptionInput = popupPage.locator(selector);
        if (await descriptionInput.isVisible()) {
          await descriptionInput.fill(snippet.description);
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }

  // Save the snippet
  await popupPage.click("#modalSave");

  // Wait for modal to close
  await popupPage.waitForSelector("#snippetModal.hidden", { timeout: 5000 });

  // Wait for snippet to appear in list
  await popupPage.waitForTimeout(1000);
}

/**
 * Creates a test page with various input types
 */
export async function createTestPage(context: BrowserContext): Promise<Page> {
  const testPage = await context.newPage();
  await testPage.goto(
    "data:text/html,<html><head><title>PuffPuffPaste Test Page</title></head><body>" +
      "<h1>PuffPuffPaste Testing Page</h1>" +
      '<div style="margin: 20px 0;">' +
      '<label for="test-input">Regular Input:</label><br>' +
      '<input type="text" id="test-input" style="width:100%;height:40px;font-size:16px;padding:5px;" placeholder="Type here to test expansion...">' +
      "</div>" +
      '<div style="margin: 20px 0;">' +
      '<label for="test-textarea">Textarea:</label><br>' +
      '<textarea id="test-textarea" style="width:100%;height:100px;font-size:16px;padding:5px;" placeholder="Test area for expansion..."></textarea>' +
      "</div>" +
      '<div style="margin: 20px 0;">' +
      '<label for="test-contenteditable">ContentEditable Div:</label><br>' +
      '<div id="test-contenteditable" contenteditable="true" style="width:100%;height:100px;border:1px solid #ccc;font-size:16px;padding:5px;" placeholder="ContentEditable area...">Click here to test</div>' +
      "</div>" +
      "</body></html>",
  );
  return testPage;
}

/**
 * Tests snippet expansion in a given element
 */
export async function testSnippetExpansion(
  testPage: Page,
  elementSelector: string,
  snippet: TestSnippet,
  expectedContent?: string,
): Promise<void> {
  const element = testPage.locator(elementSelector);
  await element.click();

  // Clear any existing content
  await testPage.keyboard.press("Control+A");
  await testPage.keyboard.press("Delete");

  // Type the trigger
  await element.type(snippet.trigger);

  // Wait for expansion
  await testPage.waitForTimeout(1000);

  // Check if text was expanded
  const actualValue = await getElementContent(testPage, elementSelector);

  // Verify expansion worked
  const expected = expectedContent || snippet.content;
  expect(actualValue).toContain(expected);
}

/**
 * Gets content from different types of elements
 */
async function getElementContent(
  page: Page,
  selector: string,
): Promise<string> {
  const element = page.locator(selector);
  const tagName = await element.evaluate((el) => el.tagName.toLowerCase());

  if (tagName === "input" || tagName === "textarea") {
    return await element.inputValue();
  } else {
    return (await element.textContent()) || "";
  }
}

/**
 * Navigates to a real website for testing
 */
export async function navigateToSite(
  context: BrowserContext,
  url: string,
): Promise<Page> {
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Wait for page to be interactive
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  } catch (error) {
    console.warn(`Failed to load ${url}, continuing with basic load:`, error);
  }

  return page;
}

/**
 * Finds and focuses on the main text input on a page
 */
export async function findMainTextInput(page: Page): Promise<string> {
  // Try different common selectors for text inputs
  const inputSelectors = [
    'textarea:not([style*="display: none"]):not([style*="visibility: hidden"])',
    'input[type="text"]:not([style*="display: none"]):not([style*="visibility: hidden"])',
    '[contenteditable="true"]:not([style*="display: none"]):not([style*="visibility: hidden"])',
    ".ace_editor .ace_text-input", // ACE Editor
    ".CodeMirror textarea", // CodeMirror
    "#editor", // Generic editor
    '[role="textbox"]',
  ];

  for (const selector of inputSelectors) {
    try {
      const elements = page.locator(selector);
      const count = await elements.count();

      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        if (await element.isVisible()) {
          // Try to focus and see if it works
          await element.click({ timeout: 1000 });
          return selector;
        }
      }
    } catch (e) {
      // Continue to next selector
      continue;
    }
  }

  throw new Error("No suitable text input found on page");
}

/**
 * Takes a screenshot for debugging
 */
export async function takeDebugScreenshot(
  page: Page,
  name: string,
): Promise<void> {
  await page.screenshot({
    path: `tests/playwright-report/debug-${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

/**
 * Waits for extension to be ready
 */
export async function waitForExtensionReady(
  extensionContext: ExtensionContext,
): Promise<void> {
  // Check if extension is responding
  const popupPage = await openPopup(extensionContext);

  // Wait for popup to show ready state (no loading indicators)
  await popupPage.waitForSelector("#loadingState", {
    state: "hidden",
    timeout: 10000,
  });

  await popupPage.close();
}

/**
 * Cleans up extension context
 */
export async function cleanupExtensionContext(
  extensionContext: ExtensionContext,
): Promise<void> {
  if (extensionContext && extensionContext.context) {
    await extensionContext.context.close();
  }
}
