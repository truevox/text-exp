/**
 * Popup script for Collaborative Text Expander
 * Handles the extension popup interface
 */

import {
  SnippetMessages,
  SettingsMessages,
  SyncMessages,
} from "../shared/messaging.js";
import type { TextSnippet, ExtensionSettings } from "../shared/types.js";
import type {
  EnhancedSnippet,
  SnippetScope,
  SnippetPriority,
} from "../types/snippet-formats.js";
import { UI_CONFIG } from "../shared/constants.js";
import {
  ComprehensiveSnippetEditor,
  type SnippetEditResult,
} from "../ui/components/comprehensive-snippet-editor.js";
import type { TierStorageSchema } from "../types/snippet-formats.js";
import { ExtensionStorage } from "../shared/storage.js";
import type { StoreSnippetInfo } from "../ui/components/multi-store-editor.js";

/**
 * Main popup application class
 */
class PopupApp {
  private snippets: TextSnippet[] = [];
  private settings: ExtensionSettings | null = null;
  private currentEditingSnippet: TextSnippet | null = null;
  private searchQuery = "";
  private snippetEditor: ComprehensiveSnippetEditor | null = null;

  // DOM elements
  private elements = {
    searchInput: document.getElementById("searchInput") as HTMLInputElement,
    snippetList: document.getElementById("snippetList") as HTMLElement,
    emptyState: document.getElementById("emptyState") as HTMLElement,
    loadingState: document.getElementById("loadingState") as HTMLElement,
    addSnippetButton: document.getElementById(
      "addSnippetButton",
    ) as HTMLButtonElement,
    syncButton: document.getElementById("syncButton") as HTMLButtonElement,
    settingsButton: document.getElementById(
      "settingsButton",
    ) as HTMLButtonElement,
    syncStatus: document.getElementById("syncStatus") as HTMLElement,
    syncStatusClose: document.getElementById(
      "syncStatusClose",
    ) as HTMLButtonElement,

    // Modal elements
    snippetModal: document.getElementById("snippetModal") as HTMLElement,
    modalTitle: document.getElementById("modalTitle") as HTMLElement,
    modalClose: document.getElementById("modalClose") as HTMLButtonElement,
    modalCancel: document.getElementById("modalCancel") as HTMLButtonElement,
    modalSave: document.getElementById("modalSave") as HTMLButtonElement,
    advancedSnippetEditor: document.getElementById(
      "advancedSnippetEditor",
    ) as HTMLElement,
  };

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the popup application
   */
  private async initialize(): Promise<void> {
    try {
      this.setupEventListeners();
      await this.loadSettings();
      await this.loadSnippets();
      this.updateUI();
    } catch (error) {
      console.error("Failed to initialize popup:", error);
      this.showError("Failed to load extension data");
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Search
    this.elements.searchInput.addEventListener(
      "input",
      this.debounce(() => this.handleSearch(), UI_CONFIG.DEBOUNCE_DELAY),
    );

    // Buttons
    this.elements.addSnippetButton.addEventListener("click", () =>
      this.openAddSnippetPage(),
    );
    this.elements.syncButton.addEventListener("click", () =>
      this.syncSnippets(),
    );
    this.elements.settingsButton.addEventListener("click", () =>
      this.openSettings(),
    );

    // Modal
    this.elements.modalClose.addEventListener("click", () =>
      this.hideSnippetModal(),
    );
    this.elements.modalCancel.addEventListener("click", () =>
      this.hideSnippetModal(),
    );
    this.elements.modalSave.addEventListener("click", () =>
      this.handleSaveSnippet(),
    );

    // Sync status
    this.elements.syncStatusClose.addEventListener("click", () =>
      this.hideSyncStatus(),
    );

    // Close modal on overlay click
    this.elements.snippetModal.addEventListener("click", (e) => {
      if (e.target === this.elements.snippetModal) {
        this.hideSnippetModal();
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleKeydown(e));
  }

  /**
   * Load extension settings
   */
  private async loadSettings(): Promise<void> {
    try {
      this.settings = await SettingsMessages.getSettings();
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }

  /**
   * Load snippets from storage
   */
  private async loadSnippets(): Promise<void> {
    try {
      this.showLoading();
      console.log("🔍 [POPUP-DEBUG] Loading snippets via messaging...");
      const result = await SnippetMessages.getSnippets();
      // Ensure result is always an array
      this.snippets = Array.isArray(result) ? result : [];

      console.log(
        `📋 [POPUP-DEBUG] Loaded ${this.snippets.length} snippets:`,
        this.snippets.map((s) => ({
          trigger: s.trigger,
          source: (s as any).source,
        })),
      );

      // CRITICAL: Check specifically for ;pony snippet in popup
      const ponySnippet = this.snippets.find((s) => s.trigger === ";pony");
      if (ponySnippet) {
        console.log(`✅ [POPUP-DEBUG] ;pony snippet found in popup:`, {
          trigger: ponySnippet.trigger,
          content: ponySnippet.content,
          source: (ponySnippet as any).source,
        });
      } else {
        console.warn(`❌ [POPUP-DEBUG] ;pony snippet NOT found in popup`);
        console.warn(
          `🔍 [POPUP-DEBUG] Available triggers in popup:`,
          this.snippets.map((s) => s.trigger),
        );
      }

      this.hideLoading();
    } catch (error) {
      console.error("Failed to load snippets:", error);
      this.snippets = []; // Ensure snippets is an empty array on failure
      this.hideLoading();
      this.showError("Failed to load snippets");
    }
  }

  /**
   * Update the UI based on current state
   */
  private updateUI(): void {
    const filteredSnippets = this.getFilteredSnippets();

    if (filteredSnippets.length === 0) {
      this.showEmptyState();
    } else {
      this.hideEmptyState();
      this.renderSnippets(filteredSnippets);
    }
  }

  /**
   * Get filtered snippets based on search query
   */
  private getFilteredSnippets(): TextSnippet[] {
    if (!this.searchQuery) {
      return this.snippets;
    }

    const query = this.searchQuery.toLowerCase();
    return this.snippets.filter(
      (snippet) =>
        snippet.trigger.toLowerCase().includes(query) ||
        snippet.content.toLowerCase().includes(query) ||
        snippet.description?.toLowerCase().includes(query) ||
        snippet.tags?.some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  /**
   * Render snippets in the list
   */
  private renderSnippets(snippets: TextSnippet[]): void {
    this.elements.snippetList.innerHTML = "";

    // Ensure snippets is an array before calling forEach
    if (Array.isArray(snippets)) {
      snippets.forEach((snippet) => {
        const snippetElement = this.createSnippetElement(snippet);
        this.elements.snippetList.appendChild(snippetElement);
      });
    } else {
      console.error("renderSnippets called with non-array:", snippets);
    }
  }

  /**
   * Create a snippet list item element
   */
  private createSnippetElement(snippet: TextSnippet): HTMLElement {
    const element = document.createElement("div");
    element.className = "snippet-item";
    element.dataset.snippetId = snippet.id;

    const truncatedContent =
      snippet.content.length > 100
        ? snippet.content.substring(0, 100) + "..."
        : snippet.content;

    const tags =
      snippet.tags
        ?.map(
          (tag) => `<span class="snippet-tag">${this.escapeHtml(tag)}</span>`,
        )
        .join("") || "";

    const sharedIndicator = snippet.isShared
      ? '<span class="snippet-shared">Shared</span>'
      : "";

    element.innerHTML = `
      <div class="snippet-header">
        <span class="snippet-trigger">${this.escapeHtml(snippet.trigger)}</span>
        <div class="snippet-actions">
          <button class="snippet-action" data-action="use" title="Use Snippet">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          </button>
          <button class="snippet-action" data-action="edit" title="Edit Snippet">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m18 2 4 4-14 14H4v-4L18 2z"></path>
            </svg>
          </button>
          <button class="snippet-action" data-action="delete" title="Delete Snippet">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="m19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="snippet-content">${this.escapeHtml(truncatedContent)}</div>
      <div class="snippet-meta">
        <div class="snippet-tags">${tags}</div>
        ${sharedIndicator}
      </div>
    `;

    // Add event listeners to action buttons
    element.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest(".snippet-action") as HTMLButtonElement;

      if (button) {
        e.stopPropagation();
        const action = button.dataset.action;

        switch (action) {
          case "use":
            this.useSnippet(snippet);
            break;
          case "edit":
            this.editSnippet(snippet);
            break;
          case "delete":
            this.deleteSnippet(snippet);
            break;
        }
      } else {
        // Click on snippet item - show details or edit
        this.editSnippet(snippet);
      }
    });

    return element;
  }

  /**
   * Use a snippet (expand it in active tab)
   */
  private async useSnippet(snippet: TextSnippet): Promise<void> {
    try {
      await SnippetMessages.expandText(snippet.trigger);
      window.close(); // Close popup after use
    } catch (error) {
      console.error("Failed to use snippet:", error);
      this.showError("Failed to expand snippet");
    }
  }

  /**
   * Edit a snippet
   */
  private async editSnippet(snippet: TextSnippet): Promise<void> {
    this.currentEditingSnippet = snippet;
    this.elements.modalTitle.textContent = "Edit Snippet";

    await this.initializeSnippetEditor(snippet);
    this.showSnippetModal();
  }

  /**
   * Delete a snippet
   */
  private async deleteSnippet(snippet: TextSnippet): Promise<void> {
    if (!confirm(`Delete snippet "${snippet.trigger}"?`)) {
      return;
    }

    try {
      await SnippetMessages.deleteSnippet(snippet.id);
      await this.loadSnippets();
      this.updateUI();
      this.showSuccess("Snippet deleted successfully");
    } catch (error) {
      console.error("Failed to delete snippet:", error);
      this.showError("Failed to delete snippet");
    }
  }

  /**
   * Open add snippet page in new tab
   */
  private openAddSnippetPage(): void {
    chrome.tabs.create({
      url: chrome.runtime.getURL("add-snippet/add-snippet.html"),
    });
  }

  /**
   * Show add snippet modal
   */
  private async showAddSnippetModal(): Promise<void> {
    // Check if storage is configured before allowing snippet creation
    if (!(await this.isStorageConfigured())) {
      this.showStorageSetupToast();
      this.openSettingsToLocalSources();
      return;
    }

    this.currentEditingSnippet = null;
    this.elements.modalTitle.textContent = "Add Snippet";

    await this.initializeSnippetEditor();
    this.showSnippetModal();
  }

  /**
   * Show snippet modal
   */
  private showSnippetModal(): void {
    this.elements.snippetModal.classList.remove("hidden");
    // Focus will be handled by the snippet editor
  }

  /**
   * Hide snippet modal
   */
  private hideSnippetModal(): void {
    this.elements.snippetModal.classList.add("hidden");
    this.currentEditingSnippet = null;

    // Clean up snippet editor
    if (this.snippetEditor) {
      this.snippetEditor.destroy();
      this.snippetEditor = null;
    }
  }

  /**
   * Get all available stores in StoreSnippetInfo format
   */
  private async getAllAvailableStores(): Promise<StoreSnippetInfo[]> {
    console.log("🗄️ Gathering all available stores...");
    const stores: StoreSnippetInfo[] = [];

    try {
      // Get default appdata store status
      const defaultStoreResponse = await chrome.runtime.sendMessage({
        type: "GET_DEFAULT_STORE_STATUS",
      });

      if (defaultStoreResponse.success) {
        const defaultStatus = defaultStoreResponse.data;

        // Add default store (always present, even if not initialized)
        stores.push({
          storeId: "/drive.appstore",
          storeName: "/drive.appstore",
          displayName: "Default Store",
          scope: "personal", // Default store is always personal scope
          priority: 0, // Default store gets highest priority (0)
          snippetCount: defaultStatus.snippetCount || 0,
          isReadOnly: false,
          isDriveFile: true,
          lastModified: new Date().toISOString(),
          snippets: [], // Will be loaded separately when needed
        });
      }

      // Get custom stores from settings
      const settings = await ExtensionStorage.getSettings();
      const customStores = settings.configuredSources || [];

      // Add custom stores (sorted by priority from loadCustomStores)
      for (let index = 0; index < customStores.length; index++) {
        const customStore = customStores[index];
        const storePriority = (customStore as any).priority || index + 2; // Start from 2 (after default)

        stores.push({
          storeId: customStore.folderId,
          storeName: `${customStore.displayName}.json`,
          displayName: customStore.displayName,
          scope: customStore.scope, // personal, team, org (now SnippetScope)
          priority: storePriority, // Numeric priority from drag-and-drop order
          snippetCount: 0, // TODO: Get actual count from store
          isReadOnly: false, // TODO: Check permissions
          isDriveFile: customStore.provider === "google-drive",
          fileId: customStore.folderId,
          lastModified: new Date().toISOString(), // TODO: Get actual date
          snippets: [], // Will be loaded separately when needed
        });
      }

      console.log(`✅ Found ${stores.length} available stores:`, stores);
      return stores;
    } catch (error) {
      console.error("❌ Failed to get available stores:", error);
      // Return at least the default store
      return [
        {
          storeId: "/drive.appstore",
          storeName: "/drive.appstore",
          displayName: "Default Store",
          scope: "personal",
          priority: 0, // Default store gets highest priority
          snippetCount: 0,
          isReadOnly: false,
          isDriveFile: true,
          lastModified: new Date().toISOString(),
          snippets: [],
        },
      ];
    }
  }

  /**
   * Initialize the comprehensive snippet editor
   */
  private async initializeSnippetEditor(snippet?: TextSnippet): Promise<void> {
    // Clean up existing editor
    if (this.snippetEditor) {
      this.snippetEditor.destroy();
    }

    // Get all available stores for multi-store support
    const availableStores = await this.getAllAvailableStores();

    // Create default TierStorageSchema for appdata store
    const defaultTierData: TierStorageSchema = {
      schema: "priority-tier-v1",
      tier: "priority-0",
      snippets: snippet ? [this.convertToEnhancedSnippet(snippet)] : [],
      metadata: {
        version: "1.0.0",
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        owner: "user@example.com", // TODO: Get from auth
        description: "Default appdata store",
      },
    };

    this.snippetEditor = new ComprehensiveSnippetEditor({
      tierData: defaultTierData,
      mode: snippet ? "edit" : "create",
      snippetId: snippet?.id,
      enableContentTypeConversion: true,
      validateDependencies: true,
      autoFocus: true,
      compact: true,
      // Multi-store support
      availableStores: availableStores,
      showStoreSelector: true, // Enable the blue field multi-store selector
      defaultSelectedStores: ["/drive.appstore"], // Default to appdata store only
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

    await this.snippetEditor.init(this.elements.advancedSnippetEditor);
  }

  /**
   * Convert TextSnippet to EnhancedSnippet for comprehensive editor
   */
  private convertToEnhancedSnippet(snippet: TextSnippet): EnhancedSnippet {
    return {
      id: snippet.id,
      trigger: snippet.trigger,
      content: snippet.content,
      contentType: snippet.contentType || "html",
      snipDependencies: [],
      description: snippet.description || "",
      scope: "priority-0", // Default to priority-0 for appdata store
      variables:
        snippet.variables?.map((v) => ({
          name: v.name,
          prompt: v.placeholder,
          defaultValue: v.defaultValue,
        })) || [],
      images: [],
      tags: snippet.tags || [],
      createdAt: snippet.createdAt.toISOString(),
      createdBy: "user", // TODO: Get from auth
      updatedAt: snippet.updatedAt.toISOString(),
      updatedBy: "user", // TODO: Get from auth
    };
  }

  /**
   * Handle snippet save from comprehensive editor
   */
  private async handleSnippetSave(result: SnippetEditResult): Promise<void> {
    if (!result.success) {
      this.showError(
        "Save failed: " + (result.errors?.join(", ") || "Unknown error"),
      );
      return;
    }

    try {
      // DEBUG: Log the selected stores for troubleshooting
      console.log("🔍 [MULTI-STORE-DEBUG] Save result:", {
        hasSelectedStores:
          result.selectedStores && result.selectedStores.length > 0,
        selectedStores: result.selectedStores,
        selectedStoresCount: result.selectedStores?.length || 0,
        snippet: {
          trigger: result.snippet.trigger,
          content: result.snippet.content?.substring(0, 50) + "...",
        },
      });

      const hasSelectedStores =
        result.selectedStores && result.selectedStores.length > 0;

      if (this.currentEditingSnippet) {
        // Update existing snippet
        if (hasSelectedStores) {
          const updateResult = await SnippetMessages.updateSnippetInStores(
            this.currentEditingSnippet.id,
            result.snippet,
            result.selectedStores!,
          );

          if (updateResult.success) {
            this.showSuccess("Snippet updated successfully in selected stores");
          } else {
            const failedStores = updateResult.results
              .filter((r) => !r.success)
              .map((r) => r.storeId)
              .join(", ");
            this.showError(`Update failed in some stores: ${failedStores}`);
          }
        } else {
          // Fallback to single store update
          await SnippetMessages.updateSnippet(
            this.currentEditingSnippet.id,
            result.snippet,
          );
          this.showSuccess("Snippet updated successfully");
        }
      } else {
        // Add new snippet
        if (hasSelectedStores) {
          const addResult = await SnippetMessages.addSnippetToStores(
            result.snippet,
            result.selectedStores!,
          );

          if (addResult.success) {
            this.showSuccess("Snippet created successfully in selected stores");
          } else {
            const failedStores = addResult.results
              .filter((r) => !r.success)
              .map((r) => r.storeId)
              .join(", ");
            this.showError(`Creation failed in some stores: ${failedStores}`);
          }
        } else {
          // Fallback to single store creation (default appdata store)
          await SnippetMessages.addSnippet(result.snippet);
          this.showSuccess("Snippet added successfully");
        }
      }

      this.hideSnippetModal();
      await this.loadSnippets();
      this.updateUI();
    } catch (error) {
      console.error("Failed to save snippet:", error);
      this.showError("Failed to save snippet");
    }
  }

  /**
   * Handle save button click
   */
  private async handleSaveSnippet(): Promise<void> {
    if (this.snippetEditor) {
      await this.snippetEditor.save();
    }
  }

  /**
   * Handle search input
   */
  private handleSearch(): void {
    this.searchQuery = this.elements.searchInput.value.trim();
    this.updateUI();
  }

  /**
   * Sync snippets with cloud
   */
  private async syncSnippets(): Promise<void> {
    try {
      this.elements.syncButton.disabled = true;
      this.showSyncStatus("Syncing...", "info");

      await SyncMessages.syncSnippets();
      await this.loadSnippets();
      this.updateUI();

      this.showSyncStatus("Sync completed successfully", "success");
    } catch (error) {
      console.error("Sync failed:", error);
      // Safely access error message
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during sync";
      this.showSyncStatus("Sync failed: " + errorMessage, "error");
    } finally {
      this.elements.syncButton.disabled = false;
    }
  }

  /**
   * Open settings page
   */
  private openSettings(): void {
    chrome.runtime.openOptionsPage();
  }

  /**
   * Open settings page with anchor to Local Folder Sources section
   */
  private openSettingsToLocalSources(): void {
    chrome.tabs.create({
      url: chrome.runtime.getURL("options/options.html#local-folder-sources"),
    });
  }

  /**
   * Check if storage is properly configured
   */
  private async isStorageConfigured(): Promise<boolean> {
    try {
      if (!this.settings) {
        await this.loadSettings();
      }

      // Check if any cloud provider is selected (not just 'local')
      const isCloudProviderSelected =
        this.settings?.cloudProvider && this.settings.cloudProvider !== "local";

      // Check if any local filesystem sources are configured
      const hasLocalSources = false; // Local filesystem support removed

      return isCloudProviderSelected || hasLocalSources;
    } catch (error) {
      console.error("Failed to check storage configuration:", error);
      return false;
    }
  }

  /**
   * Show toast message about storage setup requirement
   */
  private showStorageSetupToast(): void {
    this.showSyncStatus(
      "You need to select where to store your snippets before you can create any",
      "info",
    );
  }

  /**
   * Show sync status message
   */
  private showSyncStatus(
    message: string,
    type: "info" | "success" | "error",
  ): void {
    this.elements.syncStatus.className = `sync-status ${type}`;
    this.elements.syncStatus.querySelector(".sync-status-text")!.textContent =
      message;
    this.elements.syncStatus.classList.remove("hidden");

    // Auto-hide success messages
    if (type === "success") {
      setTimeout(() => this.hideSyncStatus(), 3000);
    }
  }

  /**
   * Hide sync status
   */
  private hideSyncStatus(): void {
    this.elements.syncStatus.classList.add("hidden");
  }

  /**
   * Show loading state
   */
  private showLoading(): void {
    this.elements.loadingState.classList.remove("hidden");
    this.elements.snippetList.classList.add("hidden");
    this.elements.emptyState.classList.add("hidden");
  }

  /**
   * Hide loading state
   */
  private hideLoading(): void {
    this.elements.loadingState.classList.add("hidden");
    this.elements.snippetList.classList.remove("hidden");
  }

  /**
   * Show empty state
   */
  private showEmptyState(): void {
    this.elements.emptyState.classList.remove("hidden");
    this.elements.snippetList.classList.add("hidden");
  }

  /**
   * Hide empty state
   */
  private hideEmptyState(): void {
    this.elements.emptyState.classList.add("hidden");
    this.elements.snippetList.classList.remove("hidden");
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.showSyncStatus(message, "error");
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    this.showSyncStatus(message, "success");
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeydown(e: KeyboardEvent): void {
    // Escape key - close modal
    if (
      e.key === "Escape" &&
      !this.elements.snippetModal.classList.contains("hidden")
    ) {
      this.hideSnippetModal();
    }

    // Ctrl/Cmd + N - new snippet
    if (e.key === "n" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.openAddSnippetPage();
    }

    // Ctrl/Cmd + S - save snippet (when modal is open)
    if (
      e.key === "s" &&
      (e.ctrlKey || e.metaKey) &&
      !this.elements.snippetModal.classList.contains("hidden")
    ) {
      e.preventDefault();
      this.handleSaveSnippet();
    }

    // Ctrl/Cmd + F - focus search
    if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.elements.searchInput.focus();
    }
  }

  /**
   * Escape HTML for safe insertion
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Debounce utility function
   */
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    let timeoutId: number;

    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => func(...args), delay);
    };
  }
}

// Initialize popup when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new PopupApp();
  });
} else {
  new PopupApp();
}
