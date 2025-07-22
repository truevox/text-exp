/**
 * Store Manager Component for Options Page
 * Handles default appdata store and additional custom store management
 * OAuth scope compliant - no folder browsing
 */

import { SettingsMessages } from "../../shared/messaging.js";
import { ExtensionStorage } from "../../shared/storage.js";
import type { OptionsElements } from "../utils/dom-elements.js";
import type { ConfiguredScopedSource } from "../../shared/types.js";

export interface DefaultStoreStatus {
  initialized: boolean;
  appdataStoreExists: boolean;
  hasWelcomeSnippets: boolean;
  snippetCount: number;
}

export type StoreStatusCallback = (
  message: string,
  type: "success" | "error" | "warning" | "info",
) => void;

export class StoreManagerComponent {
  private elements: OptionsElements;
  private showStatus: StoreStatusCallback;
  private defaultStoreStatus: DefaultStoreStatus | null = null;
  private customStores: ConfiguredScopedSource[] = [];
  private storeValidationStatus: Map<string, "success" | "warning" | "error"> =
    new Map();

  constructor(elements: OptionsElements, showStatus: StoreStatusCallback) {
    this.elements = elements;
    this.showStatus = showStatus;
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for store management
   */
  private initializeEventListeners(): void {
    // Initialize default store button (dynamically created)
    this.attachDefaultStoreListeners();

    // View default store button (dynamically created)
    this.attachViewStoreListeners();
  }

  /**
   * Attach event listeners to dynamically created default store elements
   */
  private attachDefaultStoreListeners(): void {
    const initDefaultStoreBtn = document.getElementById(
      "initializeDefaultStore",
    );
    if (initDefaultStoreBtn) {
      initDefaultStoreBtn.addEventListener("click", () => {
        this.initializeDefaultStore();
      });
    }
  }

  /**
   * Attach event listeners to dynamically created view store elements
   */
  private attachViewStoreListeners(): void {
    const viewDefaultStoreBtn = document.getElementById("viewDefaultStore");
    if (viewDefaultStoreBtn) {
      viewDefaultStoreBtn.addEventListener("click", () => {
        this.viewDefaultStore();
      });
    }
  }

  /**
   * Load and display default store status
   */
  async loadDefaultStoreStatus(): Promise<void> {
    try {
      console.log("📋 Loading default store status...");

      const response = await chrome.runtime.sendMessage({
        type: "GET_DEFAULT_STORE_STATUS",
      });

      if (response.success) {
        this.defaultStoreStatus = response.data;

        // Also load custom stores
        await this.loadCustomStores();

        this.updateStoreStatusDisplay();
      } else {
        console.error("❌ Failed to get default store status:", response.error);
        this.showStatus("Failed to load store status", "error");
      }
    } catch (error) {
      console.error("❌ Error loading default store status:", error);
      this.showStatus("Error loading store status", "error");
    }
  }

  /**
   * Validate access to custom stores
   */
  async validateCustomStores(): Promise<void> {
    console.log("🔍 Validating custom store access...");

    // Clear previous validation status
    this.storeValidationStatus.clear();

    // Validate each custom store
    for (const store of this.customStores) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: "VALIDATE_STORE_FILE",
          fileId: store.folderId,
        });

        if (
          response.success &&
          response.data.isValid &&
          response.data.canRead
        ) {
          this.storeValidationStatus.set(store.folderId, "success");
        } else if (response.success && response.data.canRead) {
          this.storeValidationStatus.set(store.folderId, "warning");
        } else {
          this.storeValidationStatus.set(store.folderId, "error");
        }
      } catch (error) {
        console.error(
          `❌ Failed to validate store ${store.displayName}:`,
          error,
        );
        this.storeValidationStatus.set(store.folderId, "error");
      }
    }

    console.log(
      "✅ Store validation completed:",
      Object.fromEntries(this.storeValidationStatus),
    );
  }

  /**
   * Load custom stores from extension settings with saved priority order
   */
  async loadCustomStores(): Promise<void> {
    try {
      console.log("📋 Loading custom stores...");

      const settings = await ExtensionStorage.getSettings();
      this.customStores = settings.configuredSources || [];

      // Sort stores by their saved priority order (if available)
      this.customStores.sort((a, b) => {
        const priorityA = (a as any).priority || 999;
        const priorityB = (b as any).priority || 999;
        return priorityA - priorityB;
      });

      console.log(
        `✅ Loaded ${this.customStores.length} custom stores in priority order:`,
        this.customStores,
      );

      // Validate store access if we have custom stores
      if (this.customStores.length > 0) {
        await this.validateCustomStores();
      }
    } catch (error) {
      console.error("❌ Error loading custom stores:", error);
      this.customStores = [];
    }
  }

  /**
   * Update the store status display in the UI
   */
  private updateStoreStatusDisplay(): void {
    if (!this.defaultStoreStatus) return;

    // Update both the default store status section AND the active stores list
    this.updateDefaultStoreStatusSection();
    this.updateActiveStoresList();
  }

  /**
   * Update the default store status section
   */
  private updateDefaultStoreStatusSection(): void {
    const statusContainer = document.getElementById("defaultStoreStatus");
    if (!statusContainer) return;

    const status = this.defaultStoreStatus!;
    let statusHtml = "";

    if (status.initialized && status.appdataStoreExists) {
      statusHtml = `
        <div class="store-info">
          <h3>Default Appdata Store</h3>
          <p class="store-description">
            Your primary snippet store, automatically synced to Google Drive's application data folder.
          </p>
          <div id="defaultStoreInfo" class="store-status">
            <span class="status-indicator success"></span>
            <span class="status-text">Active with ${status.snippetCount} snippet${status.snippetCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div class="store-actions">
          <button id="viewDefaultStore" class="secondary-button">View Snippets</button>
        </div>
      `;
    } else if (status.initialized && !status.appdataStoreExists) {
      statusHtml = `
        <div class="store-info">
          <h3>Default Appdata Store</h3>
          <p class="store-description">
            Your primary snippet store, automatically synced to Google Drive's application data folder.
          </p>
          <div id="defaultStoreInfo" class="store-status">
            <span class="status-indicator warning"></span>
            <span class="status-text">Store file missing - needs recreation</span>
          </div>
        </div>
        <div class="store-actions">
          <button id="initializeDefaultStore" class="primary-button">Recreate Store</button>
        </div>
      `;
    } else {
      statusHtml = `
        <div class="store-info">
          <h3>Default Appdata Store</h3>
          <p class="store-description">
            Your primary snippet store, automatically synced to Google Drive's application data folder.
          </p>
          <div id="defaultStoreInfo" class="store-status">
            <span class="status-indicator warning"></span>
            <span class="status-text">Setting up automatically in background...</span>
          </div>
        </div>
      `;
    }

    statusContainer.innerHTML = statusHtml;

    // Re-attach event listeners after updating HTML
    this.attachDefaultStoreListeners();
    this.attachViewStoreListeners();
  }

  /**
   * Update the active stores list with draggable items
   */
  private updateActiveStoresList(): void {
    const activeStoresList = document.getElementById("activeStoresList");
    if (!activeStoresList) return;

    let storesHtml = "";

    // Always add default store to the list (it should always be there)
    let defaultStoreStatus = "warning";
    let defaultStoreTooltip = "Default store status unknown";
    let snippetCountText = "Loading...";

    if (
      this.defaultStoreStatus?.initialized &&
      this.defaultStoreStatus.appdataStoreExists
    ) {
      defaultStoreStatus = "success";
      defaultStoreTooltip = "Default store active and syncing";
      snippetCountText = `${this.defaultStoreStatus.snippetCount} snippet${this.defaultStoreStatus.snippetCount !== 1 ? "s" : ""}`;
    } else if (
      this.defaultStoreStatus?.initialized &&
      !this.defaultStoreStatus.appdataStoreExists
    ) {
      defaultStoreStatus = "warning";
      defaultStoreTooltip = "Default store needs recreation";
      snippetCountText = "Needs setup";
    } else {
      defaultStoreStatus = "warning";
      defaultStoreTooltip = "Default store initializing";
      snippetCountText = "Setting up...";
    }

    storesHtml += `
      <div class="store-item default-store" data-store-id="default" data-priority="0">
        <div class="store-drag-handle">⋮⋮</div>
        <div class="store-info">
          <div class="store-name">Default Store</div>
          <div class="store-details">
            <span class="store-type">Default Store (AppData)</span>
            <span class="store-count">${snippetCountText}</span>
          </div>
        </div>
        <div class="store-status-indicator ${defaultStoreStatus}" title="${defaultStoreTooltip}"></div>
        <div class="store-actions">
          <button class="btn-icon view-btn" title="View snippets">👁️</button>
          <button class="btn-icon delete-btn" title="Cannot delete default store" disabled>🗑️</button>
        </div>
      </div>
    `;

    // Add custom stores to the list
    this.customStores.forEach((store, index) => {
      const priority = this.defaultStoreStatus?.initialized
        ? index + 1 // Default store takes priority 0, custom stores get 1, 2, 3...
        : index; // If no default store, custom stores start from 0
      // No more scope-based display names - using simple store names

      const validationStatus =
        this.storeValidationStatus.get(store.folderId) || "warning";
      const statusLabels = {
        success: "Store accessible and valid",
        warning: "Store accessible but may have issues",
        error: "Store inaccessible or invalid",
      };

      storesHtml += `
        <div class="store-item custom-store" data-store-id="${store.folderId}" data-priority="${priority}">
          <div class="store-drag-handle">⋮⋮</div>
          <div class="store-info">
            <div class="store-name">${store.displayName}</div>
            <div class="store-details">
              <span class="store-type">Custom Store (${store.provider === "google-drive" ? "Google Drive" : store.provider})</span>
              <span class="store-count">Loading...</span>
            </div>
          </div>
          <div class="store-status-indicator ${validationStatus}" title="${statusLabels[validationStatus]}"></div>
          <div class="store-actions">
            <button class="btn-icon view-btn" title="View snippets">👁️</button>
            <button class="btn-icon delete-btn" title="Remove this store">🗑️</button>
          </div>
        </div>
      `;
    });

    // If no stores exist, show helpful message
    if (!storesHtml) {
      storesHtml = `
        <div class="empty-stores-message">
          <p>No stores configured yet. Click "Add Store" to get started.</p>
        </div>
      `;
    }

    activeStoresList.innerHTML = storesHtml;

    // Initialize drag-and-drop functionality
    this.initializeDragAndDrop();
  }

  /**
   * Initialize drag-and-drop functionality for store reordering
   */
  private initializeDragAndDrop(): void {
    const activeStoresList = document.getElementById("activeStoresList");
    if (!activeStoresList) return;

    const storeItems = activeStoresList.querySelectorAll(".store-item");

    storeItems.forEach((item) => {
      const element = item as HTMLElement;
      element.draggable = true;

      element.addEventListener("dragstart", this.handleDragStart.bind(this));
      element.addEventListener("dragover", this.handleDragOver.bind(this));
      element.addEventListener("drop", this.handleDrop.bind(this));
      element.addEventListener("dragend", this.handleDragEnd.bind(this));
    });

    // Add event listeners for store actions
    activeStoresList.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const storeItem = (e.target as HTMLElement).closest(
          ".store-item",
        ) as HTMLElement;
        const storeId = storeItem?.dataset.storeId;
        const storeName = storeItem?.querySelector(".store-name")?.textContent;

        if (storeId && storeName && storeId !== "default") {
          this.handleRemoveStore(storeId, storeName);
        }
      });
    });

    activeStoresList.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const storeItem = (e.target as HTMLElement).closest(
          ".store-item",
        ) as HTMLElement;
        const storeId = storeItem?.dataset.storeId;

        if (storeId) {
          this.handleViewStore(storeId);
        }
      });
    });
  }

  /**
   * Handle drag start event
   */
  private handleDragStart(e: DragEvent): void {
    const target = e.target as HTMLElement;
    const storeItem = target.closest(".store-item") as HTMLElement;

    if (!storeItem) return;

    storeItem.classList.add("dragging");
    e.dataTransfer?.setData("text/plain", storeItem.dataset.storeId || "");
  }

  /**
   * Handle drag over event
   */
  private handleDragOver(e: DragEvent): void {
    e.preventDefault();

    const target = e.target as HTMLElement;
    const storeItem = target.closest(".store-item") as HTMLElement;

    if (!storeItem) return;

    storeItem.classList.add("drag-over");
  }

  /**
   * Handle drop event
   */
  private handleDrop(e: DragEvent): void {
    e.preventDefault();

    const target = e.target as HTMLElement;
    const targetStoreItem = target.closest(".store-item") as HTMLElement;
    const draggedStoreId = e.dataTransfer?.getData("text/plain");

    if (!targetStoreItem || !draggedStoreId) return;

    const draggedStoreItem = document.querySelector(
      `[data-store-id="${draggedStoreId}"]`,
    ) as HTMLElement;

    if (!draggedStoreItem || draggedStoreItem === targetStoreItem) {
      this.clearDragStyles();
      return;
    }

    // Perform the reordering
    this.reorderStores(draggedStoreItem, targetStoreItem);

    this.clearDragStyles();
  }

  /**
   * Handle drag end event
   */
  private handleDragEnd(): void {
    this.clearDragStyles();
  }

  /**
   * Clear all drag-related styles
   */
  private clearDragStyles(): void {
    document.querySelectorAll(".store-item").forEach((item) => {
      item.classList.remove("dragging", "drag-over");
    });
  }

  /**
   * Reorder stores based on drag and drop
   */
  private async reorderStores(
    draggedItem: HTMLElement,
    targetItem: HTMLElement,
  ): Promise<void> {
    try {
      const activeStoresList = document.getElementById("activeStoresList");
      if (!activeStoresList) return;

      // Get current positions
      const allItems = Array.from(
        activeStoresList.querySelectorAll(".store-item"),
      );
      const draggedIndex = allItems.indexOf(draggedItem);
      const targetIndex = allItems.indexOf(targetItem);

      if (draggedIndex === -1 || targetIndex === -1) return;

      // Determine insertion position
      const insertBeforeTarget = draggedIndex > targetIndex;

      // Reorder in DOM
      if (insertBeforeTarget) {
        activeStoresList.insertBefore(draggedItem, targetItem);
      } else {
        activeStoresList.insertBefore(draggedItem, targetItem.nextSibling);
      }

      // Update priority values
      this.updateStorePriorities();

      // Save new order to settings
      await this.saveStoreOrder();

      this.showStatus("Store order updated", "success");
    } catch (error) {
      console.error("❌ Failed to reorder stores:", error);
      this.showStatus("Failed to reorder stores", "error");
    }
  }

  /**
   * Update priority values for all stores after reordering
   * Uses 0-based indexing: 0 = highest priority, 1, 2, 3... = lower priority
   */
  private updateStorePriorities(): void {
    const activeStoresList = document.getElementById("activeStoresList");
    if (!activeStoresList) return;

    const storeItems = activeStoresList.querySelectorAll(".store-item");
    storeItems.forEach((item, index) => {
      const element = item as HTMLElement;
      element.dataset.priority = index.toString(); // 0-based: 0 = highest priority
    });
  }

  /**
   * Save the current store order to settings using numeric priorities
   */
  private async saveStoreOrder(): Promise<void> {
    try {
      console.log("🔄 Saving store order with numeric priorities...");

      const activeStoresList = document.getElementById("activeStoresList");
      if (!activeStoresList) return;

      // Build ordered list of stores with their numeric priorities
      const storeOrder: Array<{
        storeId: string;
        priority: number;
        isDefault: boolean;
      }> = [];

      const storeItems = activeStoresList.querySelectorAll(".store-item");
      storeItems.forEach((item, index) => {
        const element = item as HTMLElement;
        const storeId = element.dataset.storeId;
        const priority = index; // 0-based priority (0 = highest, FILO ordering)
        const isDefault = element.classList.contains("default-store");

        if (storeId) {
          storeOrder.push({
            storeId,
            priority,
            isDefault,
          });
        }
      });

      // Save to extension settings
      const settings = await ExtensionStorage.getSettings();

      // Update the configured sources with their new priorities
      if (settings.configuredSources) {
        settings.configuredSources.forEach((source) => {
          const orderItem = storeOrder.find(
            (item) => item.storeId === source.folderId && !item.isDefault,
          );
          if (orderItem) {
            // Store the priority in the source configuration
            (source as any).priority = orderItem.priority;
          }
        });

        // Sort configured sources by their new priority
        settings.configuredSources.sort((a, b) => {
          const priorityA = (a as any).priority || 999;
          const priorityB = (b as any).priority || 999;
          return priorityA - priorityB;
        });
      }

      // Save the store order as a separate setting for reference
      (settings as any).storeOrder = storeOrder;

      await ExtensionStorage.setSettings(settings);

      console.log("✅ Store order saved successfully:", storeOrder);
    } catch (error) {
      console.error("❌ Failed to save store order:", error);
      throw error;
    }
  }

  /**
   * Initialize the default appdata store
   */
  private async initializeDefaultStore(): Promise<void> {
    try {
      this.showStatus("Creating default store...", "info");

      const response = await chrome.runtime.sendMessage({
        type: "INITIALIZE_DEFAULT_STORE",
      });

      if (response.success) {
        this.showStatus("Default store created successfully!", "success");
        await this.loadDefaultStoreStatus(); // Refresh status
      } else {
        console.error("❌ Failed to initialize default store:", response.error);
        this.showStatus(
          `Failed to create default store: ${response.error}`,
          "error",
        );
      }
    } catch (error) {
      console.error("❌ Error initializing default store:", error);
      this.showStatus("Error creating default store", "error");
    }
  }

  /**
   * Show dialog for adding custom stores (simplified - no scopes)
   */
  public showAddCustomStoreDialog(): void {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add New Store</h2>
          <button class="modal-close" id="closeAddStoreModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>Choose how to set up your new snippet store:</p>
          
          <div class="store-option-cards">
            <div class="store-option-card" id="createNewStore">
              <div class="option-icon">📝</div>
              <h3>Create New Store</h3>
              <p>Create a new JSON file for storing snippets</p>
              <ul>
                <li>✅ Privacy-focused (OAuth compliant)</li>
                <li>✅ Ready to use immediately</li>
                <li>✅ Properly structured format</li>
              </ul>
              <button class="btn btn-primary">Create New</button>
            </div>
            
            <div class="store-option-card" id="selectExistingStore">
              <div class="option-icon">📁</div>
              <h3>Select Existing File</h3>
              <p>Choose an existing JSON snippet file from your Drive</p>
              <ul>
                <li>✅ Use existing snippet collections</li>
                <li>✅ Migrate from other tools</li>
                <li>⚠️ Must be proper JSON format</li>
              </ul>
              <button class="btn btn-secondary">Select File</button>
            </div>
          </div>
          
          <div class="oauth-info">
            <p><strong>Privacy Note:</strong> We can only access files you explicitly select or that we create. We cannot browse your Drive or see other files.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancelAddStore">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners for modal
    const closeBtn = modal.querySelector("#closeAddStoreModal");
    const cancelBtn = modal.querySelector("#cancelAddStore");
    const createBtn = modal.querySelector("#createNewStore .btn");
    const selectBtn = modal.querySelector("#selectExistingStore .btn");

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    closeBtn?.addEventListener("click", closeModal);
    cancelBtn?.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    createBtn?.addEventListener("click", () => {
      closeModal();
      this.createNewCustomStore();
    });

    selectBtn?.addEventListener("click", () => {
      closeModal();
      this.selectExistingCustomStore();
    });
  }

  /**
   * Create a new custom store file (simplified - no scopes)
   */
  private async createNewCustomStore(): Promise<void> {
    try {
      // Show name input dialog
      const storeName = prompt(
        "Enter a name for your new store:",
        "My Snippets",
      );

      if (!storeName) {
        return; // User cancelled
      }

      this.showStatus(`Creating store: ${storeName}...`, "info");

      // Create store via service worker
      const response = await chrome.runtime.sendMessage({
        type: "CREATE_SIMPLE_STORE",
        storeName: storeName,
        description: "Snippet store created by user",
      });

      if (response.success) {
        this.showStatus(`Successfully created store: ${storeName}`, "success");
        console.log("✅ Custom store created:", response.data);

        // Refresh the store manager UI to show the new store
        await this.refreshStoreStatus();
      } else {
        console.error("❌ Failed to create custom store:", response.error);
        this.showStatus(`Failed to create store: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Error creating store:", error);
      this.showStatus("Error creating store", "error");
    }
  }

  /**
   * Select an existing custom store file (simplified - no scopes)
   */
  private async selectExistingCustomStore(): Promise<void> {
    try {
      this.showStatus("Opening file selector...", "info");

      // Show file selection modal
      this.showFileSelectionModal();
    } catch (error) {
      console.error("❌ Error selecting store:", error);
      this.showStatus("Error selecting store", "error");
    }
  }

  /**
   * Show file selection modal with multiple options (simplified - no scopes)
   */
  private showFileSelectionModal(): void {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Select Store File</h2>
          <button class="modal-close" id="closeFileSelectionModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>Choose how to select your existing snippet store:</p>
          
          <div class="file-selection-options">
            <div class="selection-option">
              <h3>🔗 Google Drive Share Link</h3>
              <p>Paste a Google Drive share link to your snippet store file:</p>
              <input type="text" id="shareLinkInput" placeholder="https://drive.google.com/file/d/..." class="form-input">
              <button id="useShareLink" class="btn btn-primary">Use This File</button>
            </div>
            
            <div class="selection-option disabled">
              <h3>📁 Google Drive Picker (Coming Soon)</h3>
              <p>Browse and select files directly from your Google Drive</p>
              <button class="btn btn-secondary" disabled>Open Drive Picker</button>
              <small>This feature will be available in a future update</small>
            </div>
          </div>
          
          <div class="oauth-info">
            <p><strong>Privacy Note:</strong> We can only access files you explicitly select. We cannot browse your Drive or see other files.</p>
            <p><strong>File Requirements:</strong> The selected file must be a JSON file containing snippet data.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancelFileSelection">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector("#closeFileSelectionModal");
    const cancelBtn = modal.querySelector("#cancelFileSelection");
    const useShareLinkBtn = modal.querySelector("#useShareLink");
    const shareLinkInput = modal.querySelector(
      "#shareLinkInput",
    ) as HTMLInputElement;

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    closeBtn?.addEventListener("click", closeModal);
    cancelBtn?.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    useShareLinkBtn?.addEventListener("click", async () => {
      const shareLink = shareLinkInput.value.trim();
      if (!shareLink) {
        this.showStatus("Please enter a Google Drive share link", "warning");
        return;
      }

      closeModal();
      await this.processShareLink(shareLink);
    });

    // Auto-focus the input
    setTimeout(() => shareLinkInput?.focus(), 100);
  }

  /**
   * Process a Google Drive share link (simplified - no scopes)
   */
  private async processShareLink(shareLink: string): Promise<void> {
    try {
      this.showStatus("Processing Google Drive share link...", "info");

      // Extract file ID from share link
      const response = await chrome.runtime.sendMessage({
        type: "GET_FILE_FROM_SHARE_LINK",
        shareLink: shareLink,
      });

      if (!response.success) {
        this.showStatus(`Invalid share link: ${response.error}`, "error");
        return;
      }

      const fileInfo = response.data;
      console.log("📁 File info from share link:", fileInfo);

      // Validate the file
      const validationResponse = await chrome.runtime.sendMessage({
        type: "VALIDATE_STORE_FILE",
        fileId: fileInfo.fileId,
      });

      if (!validationResponse.success) {
        this.showStatus(
          `File validation failed: ${validationResponse.error}`,
          "error",
        );
        return;
      }

      if (!validationResponse.data.isValid) {
        this.showStatus("Selected file is not a valid snippet store", "error");
        return;
      }

      // Configure the store
      const displayName = prompt(
        "Enter a name for this store:",
        fileInfo.fileName.replace(".json", ""),
      );

      if (!displayName) {
        return; // User cancelled
      }

      const configResponse = await chrome.runtime.sendMessage({
        type: "SELECT_EXISTING_SIMPLE_STORE",
        fileId: fileInfo.fileId,
        displayName: displayName,
      });

      if (configResponse.success) {
        this.showStatus(`Successfully added store: ${displayName}`, "success");
        console.log("✅ Store configured:", configResponse.data);

        // Refresh the store manager UI
        await this.refreshStoreStatus();
      } else {
        this.showStatus(
          `Failed to configure store: ${configResponse.error}`,
          "error",
        );
      }
    } catch (error) {
      console.error("❌ Error processing share link:", error);
      this.showStatus("Error processing share link", "error");
    }
  }

  /**
   * View default store snippets
   */
  private viewDefaultStore(): void {
    // TODO: Open snippet editor/viewer for default store
    this.showStatus("Opening default store viewer...", "info");
    console.log("Viewing default store snippets");
  }

  /**
   * Get current default store status
   */
  getDefaultStoreStatus(): DefaultStoreStatus | null {
    return this.defaultStoreStatus;
  }

  /**
   * Handle store removal
   */
  async handleRemoveStore(storeId: string, storeName: string): Promise<void> {
    if (storeId === "default") {
      this.showStatus("Cannot remove default store", "warning");
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to remove the store "${storeName}"?\n\nThis will only remove it from PuffPuffPaste. The Google Drive file will not be deleted.`,
    );

    if (!confirmed) return;

    try {
      this.showStatus(`Removing store: ${storeName}...`, "info");

      // Remove from settings
      const settings = await ExtensionStorage.getSettings();
      settings.configuredSources = (settings.configuredSources || []).filter(
        (store) => store.folderId !== storeId,
      );

      await ExtensionStorage.setSettings(settings);

      // Update local state
      this.customStores = this.customStores.filter(
        (store) => store.folderId !== storeId,
      );
      this.storeValidationStatus.delete(storeId);

      // Refresh UI
      this.updateStoreStatusDisplay();

      this.showStatus(`Store "${storeName}" removed successfully`, "success");
    } catch (error) {
      console.error("❌ Failed to remove store:", error);
      this.showStatus(
        `Failed to remove store: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    }
  }

  /**
   * Handle viewing store contents
   */
  handleViewStore(storeId: string): void {
    // TODO: Implement store viewer
    this.showStatus("Store viewer coming soon!", "info");
    console.log("👁️ Viewing store:", storeId);
  }

  /**
   * Refresh store status from server - loads both default and custom stores
   */
  async refreshStoreStatus(): Promise<void> {
    // Load default store status (which also loads custom stores)
    await this.loadDefaultStoreStatus();
  }
}
