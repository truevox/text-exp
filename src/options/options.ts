/**
 * Simplified Options page script for PuffPuffPaste
 * Focuses on automatic Google Drive authentication and simplified store management
 */

import { SettingsMessages, SyncMessages } from "../shared/messaging.js";
import { ExtensionStorage } from "../shared/storage.js";
import { StoreManagerComponent } from "./components/store-manager.js";
import type { ExtensionSettings } from "../shared/types.js";
import { DEFAULT_SETTINGS } from "../shared/constants.js";

/**
 * Simplified Options page application class
 */
class OptionsApp {
  private settings: ExtensionSettings = DEFAULT_SETTINGS;
  private storeManager: StoreManagerComponent | null = null;

  // DOM elements
  private elements: Record<string, HTMLElement> = {};

  constructor() {
    this.initializeElements();
    this.initialize();
  }

  /**
   * Initialize DOM elements
   */
  private initializeElements(): void {
    // Main elements
    this.elements.statusBanner = document.getElementById("statusBanner")!;
    this.elements.statusText = document.querySelector(".status-text")!;
    this.elements.statusClose = document.querySelector(".status-close");

    if (!this.elements.statusClose) {
      console.warn("Status close button not found in DOM");
      return; // Exit early if critical elements are missing
    }

    // Store manager elements
    this.elements.defaultStoreStatus =
      document.getElementById("defaultStoreStatus")!;
    this.elements.storeListSection =
      document.getElementById("storeListSection")!;
    this.elements.activeStoresList =
      document.getElementById("activeStoresList")!;
    this.elements.addStoreButton = document.getElementById("addStoreButton")!;

    // Sync elements
    this.elements.lastSyncTime = document.getElementById("lastSyncTime")!;
    this.elements.snippetCount = document.getElementById("snippetCount")!;
    this.elements.syncNowButton = document.getElementById("syncNowButton")!;

    // Danger zone elements
    this.elements.deleteAllDataButton = document.getElementById(
      "deleteAllDataButton",
    )!;

    // Modal elements for confirmations
    this.elements.confirmationModal =
      document.getElementById("confirmationModal")!;
    this.elements.confirmationTitle =
      document.getElementById("confirmationTitle")!;
    this.elements.confirmationMessage = document.getElementById(
      "confirmationMessage",
    )!;
    this.elements.confirmConfirmationButton = document.getElementById(
      "confirmConfirmationButton",
    )!;
  }

  /**
   * Initialize the options page
   */
  private async initialize(): Promise<void> {
    try {
      // Load settings
      await this.loadSettings();

      // Setup event listeners
      this.setupEventListeners();

      // Update UI
      await this.updateUI();

      // Initialize store manager
      this.initializeStoreManager();

      // Update sync status
      this.updateSyncStatus();
    } catch (error) {
      console.error("Failed to initialize options page:", error);
      this.showStatus("Failed to initialize options page", "error");
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Status banner close
    if (this.elements.statusClose) {
      this.elements.statusClose.addEventListener("click", () => {
        this.hideStatus();
      });
    }

    // Sync
    if (this.elements.syncNowButton) {
      this.elements.syncNowButton.addEventListener("click", () => {
        this.handleSyncNow();
      });
    }

    // Danger zone
    if (this.elements.deleteAllDataButton) {
      this.elements.deleteAllDataButton.addEventListener("click", () => {
        this.handleDeleteAllData();
      });
    }

    // Modal close handlers
    document.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.closeAllModals();
      });
    });

    // Add Store button
    if (this.elements.addStoreButton) {
      this.elements.addStoreButton.addEventListener("click", () => {
        this.handleAddStore();
      });
    }

    // Store manager will handle its own event listeners

    // Confirmation modal
    document
      .getElementById("cancelConfirmationButton")
      ?.addEventListener("click", () => {
        this.closeAllModals();
      });
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      this.settings = await SettingsMessages.getSettings();
    } catch (error) {
      console.error("Failed to load settings:", error);
      this.settings = DEFAULT_SETTINGS;
    }
  }

  /**
   * Update UI based on current settings
   */
  private async updateUI(): Promise<void> {
    // Authentication happens automatically in background
    console.log("✅ UI updated - authentication is automatic");
  }

  /**
   * Initialize store manager for OAuth-compliant store management
   */
  private initializeStoreManager(): void {
    console.log("🏗️ Initializing store manager...");

    try {
      // Create store manager instance
      this.storeManager = new StoreManagerComponent(
        this.elements as any, // Type conversion for compatibility
        (message: string, type: "success" | "error" | "warning" | "info") => {
          this.showStatus(message, type);
        },
      );

      // Load default store status
      this.storeManager.loadDefaultStoreStatus();

      console.log("✅ Store manager initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize store manager:", error);
      this.showStatus("Failed to initialize store management", "error");
    }
  }

  /**
   * Handle sync now
   */
  private async handleSyncNow(): Promise<void> {
    try {
      this.showStatus("Syncing snippets...", "info");
      (this.elements.syncNowButton as HTMLButtonElement).disabled = true;

      await SyncMessages.syncSnippets();

      this.updateSyncStatus();
      this.showStatus("Sync completed successfully", "success");
    } catch (error) {
      console.error("Sync failed:", error);
      this.showStatus("Sync failed", "error");
    } finally {
      (this.elements.syncNowButton as HTMLButtonElement).disabled = false;
    }
  }

  /**
   * Handle delete all data
   */
  private handleDeleteAllData(): void {
    this.elements.confirmationTitle.textContent = "Delete All Data";
    this.elements.confirmationMessage.textContent =
      "This will permanently delete all local snippets and reset all settings. Your Google Drive files will not be affected. This action cannot be undone.";

    this.elements.confirmConfirmationButton.onclick = () => {
      this.executeDeleteAllData();
    };

    this.elements.confirmationModal.classList.remove("hidden");
  }

  /**
   * Execute delete all data
   */
  private async executeDeleteAllData(): Promise<void> {
    try {
      this.showStatus("Deleting all data...", "info");

      // Clear all storage
      await ExtensionStorage.clearAll();

      // Reset settings
      this.settings = DEFAULT_SETTINGS;
      await SettingsMessages.updateSettings(this.settings);

      // Update UI
      await this.updateUI();
      this.updateSyncStatus();

      this.closeAllModals();
      this.showStatus("All data deleted successfully", "success");
    } catch (error) {
      console.error("Failed to delete all data:", error);
      this.showStatus("Failed to delete all data", "error");
    }
  }

  /**
   * Update sync status display
   */
  private async updateSyncStatus(): Promise<void> {
    try {
      const snippets = await ExtensionStorage.getSnippets();
      this.elements.snippetCount.textContent = snippets.length.toString();

      // Update last sync time (would be stored in settings)
      this.elements.lastSyncTime.textContent = "Just now";
    } catch (error) {
      console.error("Failed to update sync status:", error);
      this.elements.snippetCount.textContent = "0";
      this.elements.lastSyncTime.textContent = "Never";
    }
  }

  /**
   * Show status message
   */
  private showStatus(
    message: string,
    type: "success" | "error" | "warning" | "info",
  ): void {
    this.elements.statusText.textContent = message;
    this.elements.statusBanner.className = `status-banner ${type}`;
    this.elements.statusBanner.classList.remove("hidden");

    // Auto-hide after 5 seconds for success/info messages
    if (type === "success" || type === "info") {
      setTimeout(() => {
        this.hideStatus();
      }, 5000);
    }
  }

  /**
   * Hide status message
   */
  private hideStatus(): void {
    this.elements.statusBanner.classList.add("hidden");
  }

  /**
   * Handle add store button click
   */
  private handleAddStore(): void {
    // Delegate to store manager
    if (this.storeManager) {
      this.showAddStoreDialog();
    } else {
      this.showStatus("Store manager not initialized", "error");
    }
  }

  /**
   * Show simple add store dialog - goes directly to folder selection
   */
  private showAddStoreDialog(): void {
    // Delegate to store manager for simplified store creation
    if (this.storeManager) {
      this.showSimpleAddStoreDialog();
    } else {
      this.showStatus("Store manager not initialized", "error");
    }
  }

  /**
   * Show simplified add store dialog without scope selection
   */
  private showSimpleAddStoreDialog(): void {
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
      this.createNewStore();
    });

    selectBtn?.addEventListener("click", () => {
      closeModal();
      this.selectExistingStore();
    });
  }

  /**
   * Create a new store without scope selection
   */
  private async createNewStore(): Promise<void> {
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
        description: `Snippet store created by user`,
      });

      if (response.success) {
        this.showStatus(`Successfully created store: ${storeName}`, "success");
        console.log("✅ Simple store created:", response.data);

        // Refresh the store manager UI to show the new store
        await this.storeManager?.refreshStoreStatus();
      } else {
        console.error("❌ Failed to create store:", response.error);
        this.showStatus(`Failed to create store: ${response.error}`, "error");
      }
    } catch (error) {
      console.error("❌ Error creating store:", error);
      this.showStatus("Error creating store", "error");
    }
  }

  /**
   * Select an existing store file without scope selection
   */
  private async selectExistingStore(): Promise<void> {
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
   * Show file selection modal for existing stores
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
   * Process a Google Drive share link for store selection
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
        await this.storeManager?.refreshStoreStatus();
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
   * Close all modals
   */
  private closeAllModals(): void {
    this.elements.confirmationModal.classList.add("hidden");
  }
}

// Initialize the options page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new OptionsApp();
});
