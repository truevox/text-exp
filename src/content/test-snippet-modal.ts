/**
 * Test Snippet Modal for Content Script
 * Handles the display and interaction with the test snippet customization modal
 */

import { ExtensionStorage } from "../shared/storage";

/**
 * Test Snippet Modal Manager
 * Manages the test snippet customization modal UI
 */
export class TestSnippetModal {
  /**
   * Show test snippet customization modal
   */
  static async show(): Promise<void> {
    return new Promise((resolve) => {
      const modal = TestSnippetModal.createTestCustomizationModal(resolve);
      document.body.appendChild(modal);

      // Focus the input field
      const input = modal.querySelector("input") as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  /**
   * Create test snippet customization modal
   */
  private static createTestCustomizationModal(
    onComplete: () => void,
  ): HTMLElement {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      min-width: 400px;
      max-width: 500px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    `;

    modal.innerHTML = `
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #333;">
        🧪 Test Snippet Found!
      </h2>
      <p style="margin: 0 0 20px 0; color: #666; line-height: 1.4;">
        PuffPuffPaste includes a built-in test snippet to verify basic functionality. 
        You can customize or disable it:
      </p>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">
          Trigger (current: ;htest):
        </label>
        <input type="text" id="customTrigger" value=";htest" 
               style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
      </div>
      
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
        <button id="disableBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; color: #333; border-radius: 4px; cursor: pointer; font-size: 14px;">
          Disable Test
        </button>
        <button id="saveBtn" style="padding: 8px 16px; border: 1px solid #007bff; background: #007bff; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
          Save & Continue
        </button>
      </div>
    `;

    overlay.appendChild(modal);

    // Handle buttons
    const saveBtn = modal.querySelector("#saveBtn") as HTMLButtonElement;
    const disableBtn = modal.querySelector("#disableBtn") as HTMLButtonElement;
    const input = modal.querySelector("#customTrigger") as HTMLInputElement;

    saveBtn.addEventListener("click", async () => {
      const newTrigger = input.value.trim();
      if (newTrigger && newTrigger !== ";htest") {
        await ExtensionStorage.setSettings({ testTrigger: newTrigger });
      }
      await ExtensionStorage.setSettings({ hasSeenTestSnippet: true });
      document.body.removeChild(overlay);
      onComplete();
    });

    disableBtn.addEventListener("click", async () => {
      await ExtensionStorage.setSettings({
        disableTestSnippet: true,
        hasSeenTestSnippet: true,
      });
      document.body.removeChild(overlay);
      onComplete();
    });

    // Handle Enter key
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        saveBtn.click();
      }
    });

    return overlay;
  }
}
