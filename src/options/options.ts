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

  // Folder picker state
  private selectedFolder: { id: string; name: string } | null = null;
  private availableFolders: Array<{
    id: string;
    name: string;
    parentId?: string;
    isFolder: boolean;
  }> = [];
  private currentParentId: string = "root";
  private breadcrumbPath: Array<{ id: string; name: string }> = [];

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
    this.elements.folderBreadcrumb =
      document.getElementById("folderBreadcrumb")!;
    this.elements.folderPickerLoading = document.getElementById(
      "folderPickerLoading",
    )!;
    this.elements.folderPickerError =
      document.getElementById("folderPickerError")!;
    this.elements.folderPickerList =
      document.getElementById("folderPickerList")!;
    this.elements.closeFolderPickerButton = document.getElementById(
      "closeFolderPickerButton",
    )!;
    this.elements.createFolderButton =
      document.getElementById("createFolderButton")!;
    this.elements.cancelFolderPickerButton = document.getElementById(
      "cancelFolderPickerButton",
    )!;
    this.elements.confirmFolderPickerButton = document.getElementById(
      "confirmFolderPickerButton",
    )!;
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

    // Folder picker event listeners
    this.elements.cancelFolderPickerButton.addEventListener("click", () => {
      this.closeFolderPicker();
    });

    this.elements.confirmFolderPickerButton.addEventListener("click", () => {
      this.confirmFolderSelection();
    });

    this.elements.createFolderButton.addEventListener("click", () => {
      this.handleCreateFolder();
    });

    // Close modal on background click
    this.elements.folderPickerModal.addEventListener("click", (e) => {
      if (e.target === this.elements.folderPickerModal) {
        this.closeFolderPicker();
      }
    });

    // Close modal on Escape key
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        !this.elements.folderPickerModal.classList.contains("hidden")
      ) {
        this.closeFolderPicker();
      }
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
   * Open folder picker modal and load Google Drive folders
   */
  private async openFolderPicker(priority: number): Promise<void> {
    try {
      this.currentPickerIndex = priority;

      // Reset folder picker state
      this.selectedFolder = null;
      this.availableFolders = [];
      this.currentParentId = "root";
      this.breadcrumbPath = [{ id: "root", name: "My Drive" }];

      // Show modal and loading state
      this.elements.folderPickerModal.classList.remove("hidden");
      this.showFolderPickerLoading();
      this.updateBreadcrumb();

      // Disable confirm button initially
      (this.elements.confirmFolderPickerButton as HTMLButtonElement).disabled =
        true;

      // Load Google Drive folders
      await this.loadGoogleDriveFolders();
    } catch (error) {
      console.error("Failed to open folder picker:", error);
      this.showFolderPickerError(
        `Failed to load folders: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load Google Drive folders from the current parent directory
   */
  private async loadGoogleDriveFolders(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_GOOGLE_DRIVE_FOLDERS",
        parentId: this.currentParentId,
      });

      if (response.success) {
        this.availableFolders = response.data;
        this.renderFolderList();
      } else {
        throw new Error(response.error || "Failed to fetch folders");
      }
    } catch (error) {
      throw new Error(
        `Failed to load Google Drive folders: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Render the list of folders in the modal
   */
  private renderFolderList(): void {
    this.hideFolderPickerLoading();

    if (this.availableFolders.length === 0) {
      this.elements.folderPickerList.innerHTML =
        '<p class="no-folders">No folders found. You can create a new folder.</p>';
    } else {
      const folderItems = this.availableFolders
        .map(
          (folder) => `
        <div class="folder-item" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
          <span class="folder-icon">📁</span>
          <div class="folder-details">
            <div class="folder-name">${folder.name}</div>
            <div class="folder-path">ID: ${folder.id}</div>
          </div>
          <div class="folder-actions">
            <button class="folder-action-button navigate-button" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
              Open →
            </button>
            <button class="folder-action-button select-button" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
              Select
            </button>
          </div>
        </div>
      `,
        )
        .join("");

      this.elements.folderPickerList.innerHTML = folderItems;

      // Add event listeners
      this.addFolderListEventListeners();
    }

    this.elements.folderPickerList.style.display = "block";
  }

  /**
   * Add event listeners to folder list items
   */
  private addFolderListEventListeners(): void {
    // Navigate buttons
    this.elements.folderPickerList
      .querySelectorAll(".navigate-button")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const folderId = button.getAttribute("data-folder-id")!;
          const folderName = button.getAttribute("data-folder-name")!;
          this.navigateToFolder(folderId, folderName);
        });
      });

    // Select buttons
    this.elements.folderPickerList
      .querySelectorAll(".select-button")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const folderElement = button.closest(".folder-item") as HTMLElement;
          this.selectFolderItem(folderElement);
        });
      });

    // Double-click navigation
    this.elements.folderPickerList
      .querySelectorAll(".folder-item")
      .forEach((item) => {
        item.addEventListener("dblclick", () => {
          const folderId = item.getAttribute("data-folder-id")!;
          const folderName = item.getAttribute("data-folder-name")!;
          this.navigateToFolder(folderId, folderName);
        });
      });
  }

  /**
   * Navigate to a specific folder
   */
  private async navigateToFolder(
    folderId: string,
    folderName: string,
  ): Promise<void> {
    try {
      // Update state
      this.currentParentId = folderId;
      this.breadcrumbPath.push({ id: folderId, name: folderName });

      // Show loading and update breadcrumb
      this.showFolderPickerLoading();
      this.updateBreadcrumb();

      // Load folders in new directory
      await this.loadGoogleDriveFolders();
    } catch (error) {
      console.error("Failed to navigate to folder:", error);
      this.showFolderPickerError(
        `Failed to open folder: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Select a folder item
   */
  private selectFolderItem(element: HTMLElement): void {
    console.log("selectFolderItem called with element:", element);

    // Remove previous selection
    this.elements.folderPickerList
      .querySelectorAll(".folder-item")
      .forEach((item) => item.classList.remove("selected"));

    // Select current item
    element.classList.add("selected");

    // Store selected folder
    const folderId = element.getAttribute("data-folder-id");
    const folderName = element.getAttribute("data-folder-name");

    console.log("Selecting folder:", { id: folderId, name: folderName });

    this.selectedFolder = {
      id: folderId!,
      name: folderName!,
    };

    console.log("selectedFolder set to:", this.selectedFolder);

    // Enable confirm button
    (this.elements.confirmFolderPickerButton as HTMLButtonElement).disabled =
      false;
  }

  /**
   * Update breadcrumb navigation
   */
  private updateBreadcrumb(): void {
    const breadcrumbItems = this.breadcrumbPath
      .map((item, index) => {
        const isLast = index === this.breadcrumbPath.length - 1;
        return `<span class="breadcrumb-item ${isLast ? "current" : ""}" data-folder-id="${item.id}">
          ${index === 0 ? "📁" : ""} ${item.name}
        </span>`;
      })
      .join("");

    this.elements.folderBreadcrumb.innerHTML = breadcrumbItems;

    // Add click listeners to breadcrumb items
    this.elements.folderBreadcrumb
      .querySelectorAll(".breadcrumb-item:not(.current)")
      .forEach((item) => {
        item.addEventListener("click", () => {
          const folderId = item.getAttribute("data-folder-id")!;
          this.navigateToBreadcrumbFolder(folderId);
        });
      });
  }

  /**
   * Navigate to a breadcrumb folder
   */
  private async navigateToBreadcrumbFolder(folderId: string): Promise<void> {
    try {
      // Find the index of this folder in breadcrumb
      const index = this.breadcrumbPath.findIndex(
        (item) => item.id === folderId,
      );
      if (index === -1) return;

      // Update state
      this.currentParentId = folderId;
      this.breadcrumbPath = this.breadcrumbPath.slice(0, index + 1);

      // Show loading and update breadcrumb
      this.showFolderPickerLoading();
      this.updateBreadcrumb();

      // Load folders in selected directory
      await this.loadGoogleDriveFolders();
    } catch (error) {
      console.error("Failed to navigate to breadcrumb folder:", error);
      this.showFolderPickerError(
        `Failed to navigate: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Show folder picker loading state
   */
  private showFolderPickerLoading(): void {
    this.elements.folderPickerLoading.style.display = "block";
    this.elements.folderPickerList.style.display = "none";
    this.hideFolderPickerError();
  }

  /**
   * Hide folder picker loading state
   */
  private hideFolderPickerLoading(): void {
    this.elements.folderPickerLoading.style.display = "none";
  }

  /**
   * Show folder picker error
   */
  private showFolderPickerError(message: string): void {
    this.elements.folderPickerError.textContent = message;
    this.elements.folderPickerError.classList.remove("hidden");
    this.hideFolderPickerLoading();
    this.elements.folderPickerList.style.display = "none";
  }

  /**
   * Hide folder picker error
   */
  private hideFolderPickerError(): void {
    this.elements.folderPickerError.classList.add("hidden");
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

  /**
   * Close the folder picker modal
   */
  private closeFolderPicker(): void {
    this.elements.folderPickerModal.classList.add("hidden");
    this.selectedFolder = null;
    this.availableFolders = [];
    (this.elements.confirmFolderPickerButton as HTMLButtonElement).disabled =
      true;

    // Reset modal state
    this.hideFolderPickerError();
    this.hideFolderPickerLoading();
    this.elements.folderPickerList.style.display = "none";
  }

  /**
   * Confirm folder selection and update folder picker
   */
  private async confirmFolderSelection(): Promise<void> {
    console.log(
      "confirmFolderSelection called, selectedFolder:",
      this.selectedFolder,
    );

    if (!this.selectedFolder) {
      console.error("No folder selected");
      this.showStatus("Please select a folder first", "warning");
      return;
    }

    try {
      const picker = this.folderPickers[this.currentPickerIndex - 1];
      if (!picker) {
        console.error("Invalid folder picker index:", this.currentPickerIndex);
        this.showStatus("Invalid folder picker", "error");
        return;
      }

      // Ask for custom display name
      const customDisplayName = prompt(
        `Enter a display name for this folder:`,
        this.selectedFolder.name,
      );
      const finalDisplayName = customDisplayName || this.selectedFolder.name;

      // Determine scope based on picker priority
      let scope: "personal" | "department" | "org";
      switch (picker.priority) {
        case 1:
          scope = "personal";
          break;
        case 2:
          scope = "department";
          break;
        case 3:
          scope = "org";
          break;
        default:
          scope = "personal";
      }

      // Update the folder picker display
      picker.folderName.textContent = finalDisplayName;
      picker.folderId.textContent = this.selectedFolder.id;

      // Update the configured source
      picker.source = {
        provider: "google-drive",
        scope: scope,
        folderId: this.selectedFolder.id,
        displayName: finalDisplayName,
      };

      console.log("Updated picker source:", picker.source);
      console.log("All folder pickers:", this.folderPickers);

      // Save settings with the updated folder
      await this.saveFolderPickerSettings();

      // Close modal and show success
      this.closeFolderPicker();
      this.showStatus(`Folder configured: ${finalDisplayName}`, "success");

      // Add another folder picker if needed (up to 3 total)
      if (this.folderPickers.length < 3) {
        this.addFolderPicker(null, this.folderPickers.length + 1);
      }
    } catch (error) {
      console.error("Failed to confirm folder selection:", error);
      this.showStatus(
        `Failed to save folder selection: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Save folder picker settings to storage
   */
  private async saveFolderPickerSettings(): Promise<void> {
    try {
      const configuredSources = this.folderPickers
        .filter((picker) => picker.source !== null)
        .map((picker) => picker.source!);

      console.log("Saving configured sources:", configuredSources);

      await SettingsMessages.updateSettings({
        configuredSources: configuredSources,
      });

      // Update local settings
      this.settings.configuredSources = configuredSources;

      // ALSO save as scoped sources for sync manager
      const scopedSources = configuredSources.map((source) => ({
        name: source.scope,
        folderId: source.folderId,
        displayName: source.displayName,
        provider: source.provider,
      }));

      console.log(
        "Also saving scoped sources for sync manager:",
        scopedSources,
      );
      await ExtensionStorage.setScopedSources(scopedSources);

      console.log(
        "Settings saved successfully, configuredSources:",
        configuredSources,
      );
    } catch (error) {
      console.error("Failed to save folder picker settings:", error);
      throw error;
    }
  }

  /**
   * Handle creating a new folder in Google Drive
   */
  private async handleCreateFolder(): Promise<void> {
    const folderName = prompt(
      "Enter a name for the new folder:",
      "PuffPuffPaste Snippets",
    );
    if (!folderName) {
      return;
    }

    try {
      this.showFolderPickerLoading();

      const response = await chrome.runtime.sendMessage({
        type: "CREATE_GOOGLE_DRIVE_FOLDER",
        folderName: folderName,
        parentId: this.currentParentId,
      });

      if (response.success) {
        // Add new folder to available folders and refresh list
        this.availableFolders.unshift(response.data);
        this.renderFolderList();
        this.showStatus(`Created folder: ${folderName}`, "success");
      } else {
        throw new Error(response.error || "Failed to create folder");
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
      this.showFolderPickerError(
        `Failed to create folder: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ...existing code...
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
