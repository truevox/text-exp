/**
 * Simplified Options page script for PuffPuffPaste
 * Focuses on Google Drive authentication and dynamic folder management
 */

import { SettingsMessages, SyncMessages } from "../shared/messaging.js";
import { ExtensionStorage } from "../shared/storage.js";
import type {
  ExtensionSettings,
  ConfiguredScopedSource,
} from "../shared/types.js";
import { DEFAULT_SETTINGS } from "../shared/constants.js";

/**
 * Simplified Options page application class
 */
class OptionsApp {
  private settings: ExtensionSettings = DEFAULT_SETTINGS;
  private folderPickers: FolderPickerInstance[] = [];
  private currentPickerIndex = 0;

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
    this.elements.statusClose = document.querySelector(".status-close")!;

    // Authentication elements
    this.elements.authStatus = document.getElementById("authStatus")!;
    this.elements.authDisconnected =
      document.querySelector(".auth-disconnected")!;
    this.elements.authConnected = document.querySelector(".auth-connected")!;
    this.elements.authEmail = document.getElementById("authEmail")!;
    this.elements.connectButton = document.getElementById(
      "connectGoogleDriveButton",
    )!;
    this.elements.disconnectButton = document.getElementById(
      "disconnectGoogleDriveButton",
    )!;

    // Folder picker elements
    this.elements.folderPickers = document.getElementById("folderPickers")!;
    this.elements.folderPickerTemplate = document.getElementById(
      "folderPickerTemplate",
    )!;

    // Sync elements
    this.elements.lastSyncTime = document.getElementById("lastSyncTime")!;
    this.elements.snippetCount = document.getElementById("snippetCount")!;
    this.elements.syncNowButton = document.getElementById("syncNowButton")!;

    // Danger zone elements
    this.elements.deleteAllDataButton = document.getElementById(
      "deleteAllDataButton",
    )!;

    // Modal elements
    this.elements.folderPickerModal =
      document.getElementById("folderPickerModal")!;
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
      this.updateUI();

      // Initialize folder pickers
      this.initializeFolderPickers();

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
    this.elements.statusClose.addEventListener("click", () => {
      this.hideStatus();
    });

    // Authentication
    this.elements.connectButton.addEventListener("click", () => {
      this.handleConnectGoogleDrive();
    });

    this.elements.disconnectButton.addEventListener("click", () => {
      this.handleDisconnectGoogleDrive();
    });

    // Sync
    this.elements.syncNowButton.addEventListener("click", () => {
      this.handleSyncNow();
    });

    // Danger zone
    this.elements.deleteAllDataButton.addEventListener("click", () => {
      this.handleDeleteAllData();
    });

    // Modal close handlers
    document.querySelectorAll(".modal-close").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.closeAllModals();
      });
    });

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
  private updateUI(): void {
    // Update authentication status
    this.updateAuthenticationStatus();

    // Update folder pickers
    this.updateFolderPickers();
  }

  /**
   * Update authentication status display
   */
  private updateAuthenticationStatus(): void {
    // This would check actual auth status
    const isAuthenticated = this.settings.cloudProvider === "google-drive";

    if (isAuthenticated) {
      this.elements.authDisconnected.classList.add("hidden");
      this.elements.authConnected.classList.remove("hidden");
      this.elements.authEmail.textContent = "Connected"; // Would show actual email
    } else {
      this.elements.authDisconnected.classList.remove("hidden");
      this.elements.authConnected.classList.add("hidden");
    }
  }

  /**
   * Initialize folder pickers based on configured sources
   */
  private initializeFolderPickers(): void {
    // Clear existing pickers
    this.elements.folderPickers.innerHTML = "";
    this.folderPickers = [];

    // Add configured sources
    const configuredSources = this.settings.configuredSources || [];
    configuredSources.forEach((source, index) => {
      this.addFolderPicker(source, index + 1);
    });

    // Always add one empty picker for adding new folders
    this.addFolderPicker(null, configuredSources.length + 1);
  }

  /**
   * Add a folder picker instance
   */
  private addFolderPicker(
    source: ConfiguredScopedSource | null,
    priority: number,
  ): void {
    const template = this.elements.folderPickerTemplate.cloneNode(
      true,
    ) as HTMLElement;
    template.id = `folderPicker${priority}`;
    template.classList.remove("hidden");

    const pickerItem = template.querySelector(".folder-picker-item")!;
    pickerItem.setAttribute("data-priority", priority.toString());

    const prioritySpan = template.querySelector(".folder-priority")!;
    prioritySpan.textContent = `Priority ${priority}`;

    const folderName = template.querySelector(".folder-name")!;
    const folderId = template.querySelector(".folder-id")!;
    const selectBtn = template.querySelector(".folder-select-btn")!;
    const removeBtn = template.querySelector(".folder-remove-btn")!;

    if (source) {
      folderName.textContent = source.displayName;
      folderId.textContent = `ID: ${source.folderId}`;
      selectBtn.textContent = "Change Folder";
    } else {
      folderName.textContent = "Select a folder...";
      folderId.textContent = "";
      selectBtn.textContent = "Select Folder";
    }

    // Event listeners
    selectBtn.addEventListener("click", () => {
      this.openFolderPicker(priority);
    });

    removeBtn.addEventListener("click", () => {
      this.removeFolderPicker(priority);
    });

    // Hide remove button for first picker
    if (priority === 1) {
      (removeBtn as HTMLElement).style.display = "none";
    }

    this.elements.folderPickers.appendChild(template);

    const instance: FolderPickerInstance = {
      element: template,
      priority,
      source,
      selectBtn: selectBtn as HTMLButtonElement,
      removeBtn: removeBtn as HTMLButtonElement,
      folderName: folderName as HTMLElement,
      folderId: folderId as HTMLElement,
    };

    this.folderPickers.push(instance);
  }

  /**
   * Update folder pickers display
   */
  private updateFolderPickers(): void {
    this.initializeFolderPickers();
  }

  /**
   * Handle Google Drive connection
   */
  private async handleConnectGoogleDrive(): Promise<void> {
    try {
      this.showStatus("Connecting to Google Drive...", "info");

      // Call background script to authenticate
      const response = await chrome.runtime.sendMessage({
        type: "AUTHENTICATE_GOOGLE_DRIVE",
      });

      if (response.success) {
        this.settings.cloudProvider = "google-drive";
        await SettingsMessages.updateSettings(this.settings);
        this.updateAuthenticationStatus();
        this.showStatus("Successfully connected to Google Drive", "success");
      } else {
        throw new Error(response.error || "Authentication failed");
      }
    } catch (error) {
      console.error("Failed to connect to Google Drive:", error);
      this.showStatus("Failed to connect to Google Drive", "error");
    }
  }

  /**
   * Handle Google Drive disconnection
   */
  private async handleDisconnectGoogleDrive(): Promise<void> {
    try {
      this.showStatus("Disconnecting from Google Drive...", "info");

      // Call background script to disconnect
      const response = await chrome.runtime.sendMessage({
        type: "DISCONNECT_GOOGLE_DRIVE",
      });

      if (response.success) {
        this.settings.cloudProvider = "local";
        this.settings.configuredSources = [];
        await SettingsMessages.updateSettings(this.settings);
        this.updateAuthenticationStatus();
        this.updateFolderPickers();
        this.showStatus("Disconnected from Google Drive", "success");
      } else {
        throw new Error(response.error || "Disconnection failed");
      }
    } catch (error) {
      console.error("Failed to disconnect from Google Drive:", error);
      this.showStatus("Failed to disconnect from Google Drive", "error");
    }
  }

  /**
   * Open folder picker modal
   */
  private openFolderPicker(priority: number): void {
    this.currentPickerIndex = priority;
    this.elements.folderPickerModal.classList.remove("hidden");
    // Folder picker modal logic would go here
  }

  /**
   * Remove folder picker
   */
  private async removeFolderPicker(priority: number): Promise<void> {
    if (priority === 1) return; // Cannot remove first picker

    const configuredSources = this.settings.configuredSources || [];
    const updatedSources = configuredSources.filter(
      (_, index) => index !== priority - 1,
    );

    this.settings.configuredSources = updatedSources;
    await SettingsMessages.updateSettings(this.settings);

    this.updateFolderPickers();
    this.showStatus(`Removed folder picker ${priority}`, "success");
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
      this.updateUI();
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
   * Close all modals
   */
  private closeAllModals(): void {
    this.elements.folderPickerModal.classList.add("hidden");
    this.elements.confirmationModal.classList.add("hidden");
  }
}

/**
 * Folder picker instance interface
 */
interface FolderPickerInstance {
  element: HTMLElement;
  priority: number;
  source: ConfiguredScopedSource | null;
  selectBtn: HTMLButtonElement;
  removeBtn: HTMLButtonElement;
  folderName: HTMLElement;
  folderId: HTMLElement;
}

// Initialize the options page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new OptionsApp();
});
