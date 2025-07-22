/**
 * Add Snippet page - simplified version using existing popup editor
 */

import { ComprehensiveSnippetEditor } from "../ui/components/comprehensive-snippet-editor.js";
import { ExtensionStorage } from "../shared/storage.js";
import type { SnippetEditResult } from "../ui/components/comprehensive-snippet-editor.js";
import type {
  TierStorageSchema,
  SimpleStoreSchema,
} from "../types/snippet-formats.js";
import type { StoreSnippetInfo } from "../ui/components/multi-store-editor.js";

class AddSnippetPage {
  private editor: ComprehensiveSnippetEditor | null = null;
  private availableStores: StoreSnippetInfo[] = [];

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.initializeEditor();
      this.setupEventListeners();
    } catch (error) {
      console.error("Failed to initialize Add Snippet page:", error);
      this.showError(
        "Failed to initialize page. Please refresh and try again.",
      );
    }
  }

  private async initializeEditor(): Promise<void> {
    const container = document.getElementById("snippet-editor-container");
    if (!container) return;

    // Check if storage is configured
    if (!(await this.isStorageConfigured())) {
      container.innerHTML = `
        <div class="error">
          <h3>Storage not configured</h3>
          <p>Please configure at least one storage source in the extension options before creating snippets.</p>
          <button type="button" id="open-options-btn" class="btn btn-primary">Open Options</button>
        </div>
      `;

      // Add event listener for the options button
      const optionsBtn = container.querySelector("#open-options-btn");
      optionsBtn?.addEventListener("click", () => {
        chrome.runtime.openOptionsPage();
      });
      return;
    }

    try {
      // Load available stores for selection
      this.availableStores = await this.loadAvailableStores();

      // Create default TierStorageSchema for new snippet (legacy format for editor compatibility)
      const defaultTierData: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal", // Use 'personal' instead of 'priority-0' for compatibility
        snippets: [],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "user",
          description: "New snippet creation",
        },
      };

      this.editor = new ComprehensiveSnippetEditor({
        tierData: defaultTierData,
        mode: "create",
        enableContentTypeConversion: true,
        validateDependencies: true,
        autoFocus: true,
        compact: false,
        // Enable multi-store selector for simple priority system
        showStoreSelector: true,
        availableStores: this.availableStores,
        defaultSelectedStores: this.getDefaultSelectedStores(),
        onSave: async (result: SnippetEditResult) => {
          await this.handleSnippetSave(result);
        },
        onError: (error: Error) => {
          this.showError("Editor error: " + error.message);
        },
        onContentChange: (_content: string) => {
          // Handle content change if needed
        },
      });

      await this.editor.init(container);
    } catch (error) {
      console.error("Failed to initialize editor:", error);
      container.innerHTML =
        '<div class="error">Failed to initialize editor. Please refresh and try again.</div>';
    }
  }

  private async isStorageConfigured(): Promise<boolean> {
    try {
      const settings = await ExtensionStorage.getSettings();

      // Check if we have at least the default appdata store or configured sources
      const hasDefaultStore = await this.checkDefaultStore();
      const hasCustomStores =
        settings.configuredSources && settings.configuredSources.length > 0;

      return hasDefaultStore || hasCustomStores;
    } catch (error) {
      console.error("Error checking storage configuration:", error);
      return false;
    }
  }

  private async checkDefaultStore(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_DEFAULT_STORE_STATUS",
      });

      // The response format is { success: true, data: { initialized, appdataStoreExists, hasWelcomeSnippets, snippetCount } }
      return (
        (response?.success &&
          (response.data?.initialized || response.data?.appdataStoreExists)) ||
        false
      );
    } catch (error) {
      console.error("Error checking default store:", error);
      return false;
    }
  }

  /**
   * Load available stores for the snippet editor selector
   */
  private async loadAvailableStores(): Promise<StoreSnippetInfo[]> {
    try {
      const stores: StoreSnippetInfo[] = [];

      // Add default store if it exists
      const defaultStoreExists = await this.checkDefaultStore();
      if (defaultStoreExists) {
        const defaultStoreResponse = await chrome.runtime.sendMessage({
          type: "GET_DEFAULT_STORE_STATUS",
        });

        if (defaultStoreResponse.success) {
          const defaultStore: StoreSnippetInfo = {
            storeId: "/drive.appstore", // Use ID that background service worker expects
            storeName: "Default Store",
            displayName: "Default Store (AppData)",
            scope: "personal", // Legacy compatibility
            priority: 0, // Highest priority
            snippetCount: defaultStoreResponse.data.snippetCount || 0,
            isReadOnly: false,
            isDriveFile: true,
            lastModified: new Date().toISOString(),
            snippets: [], // Not needed for selection UI
          };
          stores.push(defaultStore);
        }
      }

      // Add custom stores from settings
      const settings = await ExtensionStorage.getSettings();
      if (settings.configuredSources) {
        settings.configuredSources.forEach((source, index) => {
          const customStore: StoreSnippetInfo = {
            storeId: source.folderId,
            storeName: source.displayName,
            displayName: `${source.displayName} (Custom)`,
            scope: source.scope || "personal", // Legacy compatibility
            priority: (source as any).priority || index + 1, // Use saved priority or fallback (1, 2, 3... after default store's 0)
            snippetCount: 0, // Could be populated from actual count
            isReadOnly: source.readOnly || false,
            isDriveFile: source.provider === "google-drive",
            fileId: source.folderId,
            lastModified: new Date().toISOString(),
            snippets: [], // Not needed for selection UI
          };
          stores.push(customStore);
        });
      }

      // Sort by priority (0 = highest priority)
      stores.sort((a, b) => a.priority - b.priority);

      console.log("✅ Loaded available stores for selection:", stores);
      return stores;
    } catch (error) {
      console.error("❌ Error loading available stores:", error);
      return [];
    }
  }

  /**
   * Get default selected stores (should select the highest priority store by default)
   */
  private getDefaultSelectedStores(): string[] {
    if (this.availableStores.length === 0) {
      // Fallback to default store ID if no stores loaded
      return ["/drive.appstore"];
    }

    // Select the highest priority store (priority 0) by default
    const highestPriorityStore = this.availableStores.find(
      (store) => store.priority === 0,
    );
    if (highestPriorityStore) {
      return [highestPriorityStore.storeId];
    }

    // Fallback to first available store
    return [this.availableStores[0].storeId];
  }

  private async handleSnippetSave(result: SnippetEditResult): Promise<void> {
    console.log(
      "🔍 [SAVE-DEBUG] handleSnippetSave called with result:",
      result,
    );

    if (!result.success || !result.snippet) {
      const errorMsg =
        result.errors && result.errors.length > 0
          ? result.errors.join(", ")
          : "Failed to create snippet";
      this.showError(errorMsg);
      return;
    }

    console.log("🔍 [SAVE-DEBUG] Snippet to save:");
    console.log("  - ID:", result.snippet.id);
    console.log("  - Trigger:", result.snippet.trigger);
    console.log(
      "  - Content:",
      result.snippet.content
        ? `"${result.snippet.content.substring(0, 100)}..."`
        : "(empty/undefined)",
    );
    console.log("  - Content length:", result.snippet.content?.length || 0);
    console.log("  - Content type:", result.snippet.contentType);

    try {
      // Determine which stores to save to
      const selectedStores =
        result.selectedStores || this.getDefaultSelectedStores();

      console.log("🔍 [SAVE-DEBUG] Selected stores:", selectedStores);

      // Use multi-store save with selected stores
      const saveResponse = await chrome.runtime.sendMessage({
        type: "ADD_SNIPPET_MULTI_STORE",
        snippet: result.snippet,
        storeIds: selectedStores,
      });

      if (saveResponse.success) {
        const storeCount = selectedStores.length;
        const message = `Snippet created successfully in ${storeCount} store${storeCount === 1 ? "" : "s"}!`;
        this.showSuccess(message);
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        throw new Error(saveResponse.error || "Failed to save snippet");
      }
    } catch (error) {
      console.error("Failed to save snippet:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.showError("Failed to create snippet: " + errorMsg);
    }
  }

  private setupEventListeners(): void {
    const cancelButton = document.getElementById("cancel-button");
    const saveButton = document.getElementById("save-button");

    cancelButton?.addEventListener("click", () => {
      window.close();
    });

    // The save button is handled by the editor itself
    saveButton?.addEventListener("click", async () => {
      if (this.editor) {
        await this.editor.save();
      }
    });

    // Close page on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        window.close();
      }
    });
  }

  private showError(message: string): void {
    this.showMessage(message, "error");
  }

  private showSuccess(message: string): void {
    this.showMessage(message, "success");
  }

  private showMessage(message: string, type: "error" | "success"): void {
    // Remove any existing messages
    const existingMessages = document.querySelectorAll(".error, .success");
    existingMessages.forEach((msg) => msg.remove());

    // Create new message
    const messageDiv = document.createElement("div");
    messageDiv.className = type;
    messageDiv.textContent = message;

    // Insert at the top of main content
    const mainContent = document.querySelector(".main-content");
    if (mainContent) {
      mainContent.insertBefore(messageDiv, mainContent.firstChild);
    }

    // Auto-remove error messages after 5 seconds
    if (type === "error") {
      setTimeout(() => {
        messageDiv.remove();
      }, 5000);
    }
  }
}

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new AddSnippetPage();
});
