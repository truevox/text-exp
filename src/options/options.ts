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
   * Show add store dialog with store type selection
   */
  private showAddStoreDialog(): void {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Add New Store</h2>
          <button class="modal-close" id="closeAddStoreModal">&times;</button>
        </div>
        <div class="modal-body">
          <p>Choose the type of snippet store to add:</p>
          
          <div class="store-type-options">
            <div class="store-type-card" data-scope="personal">
              <div class="type-icon">👤</div>
              <h3>Personal Store</h3>
              <p>Private snippets for your personal use</p>
            </div>
            
            <div class="store-type-card" data-scope="team">
              <div class="type-icon">👥</div>
              <h3>Team Store</h3>
              <p>Shared snippets for team collaboration</p>
            </div>
            
            <div class="store-type-card" data-scope="org">
              <div class="type-icon">🏢</div>
              <h3>Organization Store</h3>
              <p>Company-wide snippet collections</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="cancelAddStore">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector("#closeAddStoreModal");
    const cancelBtn = modal.querySelector("#cancelAddStore");
    const typeCards = modal.querySelectorAll(".store-type-card");

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    closeBtn?.addEventListener("click", closeModal);
    cancelBtn?.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // Store type selection
    typeCards.forEach((card) => {
      card.addEventListener("click", () => {
        const scope = card.getAttribute("data-scope") as
          | "personal"
          | "team"
          | "org";
        closeModal();
        this.storeManager?.showAddCustomStoreDialog(scope);
      });
    });
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
