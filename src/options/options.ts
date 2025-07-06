/**
 * Options page script for Collaborative Text Expander
 * Handles extension settings and configuration
 */

import {
  SettingsMessages,
  SnippetMessages,
  SyncMessages,
} from "../shared/messaging.js";
import { ExtensionStorage } from "../shared/storage.js";
import type {
  ExtensionSettings,
  ConfiguredScopedSource,
  TextSnippet,
} from "../shared/types.js";
import { DEFAULT_SETTINGS, CLOUD_PROVIDERS } from "../shared/constants.js";
import { StorageCleanup } from "../utils/storage-cleanup.js";

/**
 * Options page application class
 */
class OptionsApp {
  private settings: ExtensionSettings = DEFAULT_SETTINGS;
  private syncManager: any = null; // Will be imported dynamically

  // Folder picker state
  private currentFolderScope: "personal" | "department" | "org" | null = null;
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
  private elements = {
    // General settings
    enabledCheckbox: document.getElementById(
      "enabledCheckbox",
    ) as HTMLInputElement,
    caseSensitiveCheckbox: document.getElementById(
      "caseSensitiveCheckbox",
    ) as HTMLInputElement,
    notificationsCheckbox: document.getElementById(
      "notificationsCheckbox",
    ) as HTMLInputElement,
    triggerDelaySlider: document.getElementById(
      "triggerDelaySlider",
    ) as HTMLInputElement,
    triggerDelayValue: document.getElementById(
      "triggerDelayValue",
    ) as HTMLElement,

    // Global toggle settings
    globalToggleEnabledCheckbox: document.getElementById(
      "globalToggleEnabledCheckbox",
    ) as HTMLInputElement,
    globalToggleShortcut: document.getElementById(
      "globalToggleShortcut",
    ) as HTMLInputElement,
    editShortcutButton: document.getElementById(
      "editShortcutButton",
    ) as HTMLButtonElement,
    globalToggleStatus: document.getElementById(
      "globalToggleStatus",
    ) as HTMLElement,
    shortcutHelp: document.getElementById("shortcutHelp") as HTMLElement,

    // Initial Setup
    initialSetupSection: document.getElementById(
      "initial-setup-section",
    ) as HTMLElement,
    getStartedButton: document.getElementById(
      "getStartedButton",
    ) as HTMLButtonElement,

    // Cloud sync settings
    cloudProviderSelect: document.getElementById(
      "cloudProviderSelect",
    ) as HTMLSelectElement,
    autoSyncCheckbox: document.getElementById(
      "autoSyncCheckbox",
    ) as HTMLInputElement,
    syncIntervalSlider: document.getElementById(
      "syncIntervalSlider",
    ) as HTMLInputElement,
    syncIntervalValue: document.getElementById(
      "syncIntervalValue",
    ) as HTMLElement,

    // Scoped folder settings
    personalFolderIdInput: document.getElementById(
      "personalFolderIdInput",
    ) as HTMLInputElement,
    selectPersonalFolderButton: document.getElementById(
      "selectPersonalFolderButton",
    ) as HTMLButtonElement,
    departmentFolderIdInput: document.getElementById(
      "departmentFolderIdInput",
    ) as HTMLInputElement,
    selectDepartmentFolderButton: document.getElementById(
      "selectDepartmentFolderButton",
    ) as HTMLButtonElement,
    organizationFolderIdInput: document.getElementById(
      "organizationFolderIdInput",
    ) as HTMLInputElement,
    selectOrganizationFolderButton: document.getElementById(
      "selectOrganizationFolderButton",
    ) as HTMLButtonElement,

    // Cloud status
    cloudStatus: document.getElementById("cloudStatus") as HTMLElement,
    statusIndicator: document.getElementById("statusIndicator") as HTMLElement,
    statusTitle: document.getElementById("statusTitle") as HTMLElement,
    statusDetails: document.getElementById("statusDetails") as HTMLElement,
    lastSyncInfo: document.getElementById("lastSyncInfo") as HTMLElement,
    syncErrorInfo: document.getElementById("syncErrorInfo") as HTMLElement,
    connectButton: document.getElementById(
      "connectButton",
    ) as HTMLButtonElement,

    // Sync actions
    syncNowButton: document.getElementById(
      "syncNowButton",
    ) as HTMLButtonElement,
    forceUploadButton: document.getElementById(
      "forceUploadButton",
    ) as HTMLButtonElement,
    forceDownloadButton: document.getElementById(
      "forceDownloadButton",
    ) as HTMLButtonElement,

    // Collaboration
    sharedSnippetsCheckbox: document.getElementById(
      "sharedSnippetsCheckbox",
    ) as HTMLInputElement,

    // Data management
    totalSnippets: document.getElementById("totalSnippets") as HTMLElement,
    storageUsed: document.getElementById("storageUsed") as HTMLElement,
    lastSync: document.getElementById("lastSync") as HTMLElement,
    cleanupStorageButton: document.getElementById(
      "cleanupStorageButton",
    ) as HTMLButtonElement,
    clearLocalButton: document.getElementById(
      "clearLocalButton",
    ) as HTMLButtonElement,
    resetAllButton: document.getElementById(
      "resetAllButton",
    ) as HTMLButtonElement,

    // Synced Snippets
    syncedSnippetsList: document.getElementById(
      "syncedSnippetsList",
    ) as HTMLElement,

    // Advanced
    debugCheckbox: document.getElementById("debugCheckbox") as HTMLInputElement,
    viewLogsButton: document.getElementById(
      "viewLogsButton",
    ) as HTMLButtonElement,

    // Header actions
    exportButton: document.getElementById("exportButton") as HTMLButtonElement,
    importButton: document.getElementById("importButton") as HTMLButtonElement,
    importFileInput: document.getElementById(
      "importFileInput",
    ) as HTMLInputElement,

    // Status banner
    statusBanner: document.getElementById("statusBanner") as HTMLElement,
    statusText: document.querySelector(".status-text") as HTMLElement,
    statusClose: document.querySelector(".status-close") as HTMLButtonElement,

    // Footer
    versionNumber: document.getElementById("versionNumber") as HTMLElement,
    helpLink: document.getElementById("helpLink") as HTMLElement,
    feedbackLink: document.getElementById("feedbackLink") as HTMLElement,
    privacyLink: document.getElementById("privacyLink") as HTMLElement,

    // Folder Picker Modal
    folderPickerModal: document.getElementById(
      "folderPickerModal",
    ) as HTMLElement,
    closeFolderPickerButton: document.getElementById(
      "closeFolderPickerButton",
    ) as HTMLButtonElement,
    folderPickerLoading: document.getElementById(
      "folderPickerLoading",
    ) as HTMLElement,
    folderPickerList: document.getElementById(
      "folderPickerList",
    ) as HTMLElement,
    folderPickerError: document.getElementById(
      "folderPickerError",
    ) as HTMLElement,
    folderBreadcrumb: document.getElementById(
      "folderBreadcrumb",
    ) as HTMLElement,
    createFolderButton: document.getElementById(
      "createFolderButton",
    ) as HTMLButtonElement,
    cancelFolderPickerButton: document.getElementById(
      "cancelFolderPickerButton",
    ) as HTMLButtonElement,
    confirmFolderPickerButton: document.getElementById(
      "confirmFolderPickerButton",
    ) as HTMLButtonElement,
  };

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the options page
   */
  private async initialize(): Promise<void> {
    try {
      this.setupEventListeners();
      await this.loadSettings();
      await this.updateUI();
      await this.updateDataStats();
      await this.loadAndRenderSyncedSnippets(); // New call
      this.updateVersion();
      this.handleAnchorNavigation();
      await this.manageSetupVisibility(); // New method to manage visibility
    } catch (error) {
      console.error("Failed to initialize options page:", error);
      this.showStatus("Failed to load settings", "error");
    }
  }

  /**
   * Manage visibility of setup sections based on configuration
   */
  private async manageSetupVisibility(): Promise<void> {
    const isConfigured = await this.isStorageConfigured();

    if (isConfigured) {
      this.elements.initialSetupSection.classList.add("hidden");
    } else {
      this.elements.initialSetupSection.classList.remove("hidden");
      // Hide other sections until setup is complete
      document
        .querySelectorAll(".settings-section:not(#initial-setup-section)")
        .forEach((section) => {
          section.classList.add("hidden");
        });
    }
  }

  /**
   * Check if storage is properly configured (similar to popup logic)
   */
  private async isStorageConfigured(): Promise<boolean> {
    // Check if cloud provider is configured (not just 'local')
    if (
      this.settings?.cloudProvider &&
      this.settings.cloudProvider !== "local"
    ) {
      // For now, assume configured if a cloud provider is selected
      // In future, check for valid credentials
      return true;
    }

    // Check if local filesystem sources are configured
    const scopedSources = await ExtensionStorage.getScopedSources();
    return scopedSources.length > 0;
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Initial Setup
    this.elements.getStartedButton.addEventListener("click", () =>
      this.handleGetStarted(),
    );

    // General settings
    this.elements.enabledCheckbox.addEventListener("change", () =>
      this.saveSettings(),
    );
    this.elements.caseSensitiveCheckbox.addEventListener("change", () =>
      this.saveSettings(),
    );
    this.elements.notificationsCheckbox.addEventListener("change", () =>
      this.saveSettings(),
    );

    this.elements.triggerDelaySlider.addEventListener("input", () => {
      this.updateTriggerDelayValue();
      this.saveSettings();
    });

    // Global toggle settings
    this.elements.globalToggleEnabledCheckbox.addEventListener("change", () => {
      this.updateGlobalToggleStatus();
      this.saveSettings();
    });

    this.elements.editShortcutButton.addEventListener("click", () =>
      this.handleEditShortcut(),
    );

    this.elements.globalToggleShortcut.addEventListener("keydown", (e) =>
      this.handleShortcutCapture(e),
    );

    // Cloud settings
    this.elements.cloudProviderSelect.addEventListener("change", () =>
      this.handleProviderChange(),
    );
    this.elements.autoSyncCheckbox.addEventListener("change", () =>
      this.saveSettings(),
    );

    this.elements.syncIntervalSlider.addEventListener("input", () => {
      this.updateSyncIntervalValue();
      this.saveSettings();
    });

    // Scoped folder selection
    this.elements.selectPersonalFolderButton.addEventListener("click", () =>
      this.handleSelectFolder("personal"),
    );
    this.elements.selectDepartmentFolderButton.addEventListener("click", () =>
      this.handleSelectFolder("department"),
    );
    this.elements.selectOrganizationFolderButton.addEventListener("click", () =>
      this.handleSelectFolder("org"),
    );

    // Cloud actions
    this.elements.connectButton.addEventListener("click", () =>
      this.handleConnect(),
    );
    this.elements.syncNowButton.addEventListener("click", () =>
      this.handleSyncNow(),
    );
    this.elements.forceUploadButton.addEventListener("click", () =>
      this.handleForceUpload(),
    );
    this.elements.forceDownloadButton.addEventListener("click", () =>
      this.handleForceDownload(),
    );

    // Collaboration
    this.elements.sharedSnippetsCheckbox.addEventListener("change", () =>
      this.saveSettings(),
    );

    // Data management
    this.elements.cleanupStorageButton.addEventListener("click", () =>
      this.handleCleanupStorage(),
    );
    this.elements.clearLocalButton.addEventListener("click", () =>
      this.handleClearLocal(),
    );
    this.elements.resetAllButton.addEventListener("click", () =>
      this.handleResetAll(),
    );

    // Advanced
    this.elements.debugCheckbox.addEventListener("change", () =>
      this.saveSettings(),
    );
    this.elements.viewLogsButton.addEventListener("click", () =>
      this.handleViewLogs(),
    );

    // Header actions
    this.elements.exportButton.addEventListener("click", () =>
      this.handleExport(),
    );
    this.elements.importButton.addEventListener("click", () =>
      this.handleImport(),
    );
    this.elements.importFileInput.addEventListener("change", () =>
      this.handleFileImport(),
    );

    // Status banner
    this.elements.statusClose.addEventListener("click", () =>
      this.hideStatus(),
    );

    // Footer links
    this.elements.helpLink.addEventListener("click", (e) =>
      this.handleExternalLink(e, "help"),
    );
    this.elements.feedbackLink.addEventListener("click", (e) =>
      this.handleExternalLink(e, "feedback"),
    );
    this.elements.privacyLink.addEventListener("click", (e) =>
      this.handleExternalLink(e, "privacy"),
    );

    // Folder Picker Modal
    this.elements.closeFolderPickerButton.addEventListener("click", () =>
      this.closeFolderPicker(),
    );
    this.elements.cancelFolderPickerButton.addEventListener("click", () =>
      this.closeFolderPicker(),
    );
    this.elements.confirmFolderPickerButton.addEventListener("click", () =>
      this.confirmFolderSelection(),
    );
    this.elements.createFolderButton.addEventListener("click", () =>
      this.handleCreateFolder(),
    );

    // Close modal on backdrop click
    this.elements.folderPickerModal.addEventListener("click", (e) => {
      if (e.target === this.elements.folderPickerModal) {
        this.closeFolderPicker();
      }
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
   * Update UI with current settings
   */
  private async updateUI(): Promise<void> {
    // General settings
    if (this.elements.enabledCheckbox)
      this.elements.enabledCheckbox.checked = this.settings.enabled;
    if (this.elements.caseSensitiveCheckbox)
      this.elements.caseSensitiveCheckbox.checked = this.settings.caseSensitive;
    if (this.elements.notificationsCheckbox)
      this.elements.notificationsCheckbox.checked =
        this.settings.showNotifications;
    if (this.elements.triggerDelaySlider)
      this.elements.triggerDelaySlider.value =
        this.settings.triggerDelay.toString();
    this.updateTriggerDelayValue();

    // Global toggle settings
    if (this.elements.globalToggleEnabledCheckbox)
      this.elements.globalToggleEnabledCheckbox.checked =
        this.settings.globalToggleEnabled;
    if (this.elements.globalToggleShortcut)
      this.elements.globalToggleShortcut.value =
        this.settings.globalToggleShortcut;
    this.updateGlobalToggleStatus();

    // Cloud settings
    if (this.elements.cloudProviderSelect)
      this.elements.cloudProviderSelect.value = this.settings.cloudProvider;
    if (this.elements.autoSyncCheckbox)
      this.elements.autoSyncCheckbox.checked = this.settings.autoSync;
    if (this.elements.syncIntervalSlider)
      this.elements.syncIntervalSlider.value =
        this.settings.syncInterval.toString();
    this.updateSyncIntervalValue();

    // Collaboration
    if (this.elements.sharedSnippetsCheckbox)
      this.elements.sharedSnippetsCheckbox.checked =
        this.settings.enableSharedSnippets;

    // Scoped folder settings - populate from configured sources
    if (this.settings.configuredSources) {
      const personalSource = this.settings.configuredSources.find(
        (s) => s.scope === "personal",
      );
      if (this.elements.personalFolderIdInput && personalSource) {
        this.elements.personalFolderIdInput.value = personalSource.displayName;
      }

      const departmentSource = this.settings.configuredSources.find(
        (s) => s.scope === "department",
      );
      if (this.elements.departmentFolderIdInput && departmentSource) {
        this.elements.departmentFolderIdInput.value =
          departmentSource.displayName;
      }

      const organizationSource = this.settings.configuredSources.find(
        (s) => s.scope === "org",
      );
      if (this.elements.organizationFolderIdInput && organizationSource) {
        this.elements.organizationFolderIdInput.value =
          organizationSource.displayName;
      }
    }

    // Update cloud status
    await this.updateCloudStatus();
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      const newSettings: Partial<ExtensionSettings> = {
        enabled: this.elements.enabledCheckbox.checked,
        caseSensitive: this.elements.caseSensitiveCheckbox.checked,
        showNotifications: this.elements.notificationsCheckbox.checked,
        triggerDelay: parseInt(this.elements.triggerDelaySlider.value),
        globalToggleEnabled: this.elements.globalToggleEnabledCheckbox.checked,
        globalToggleShortcut: this.elements.globalToggleShortcut.value,
        cloudProvider: this.elements.cloudProviderSelect.value as any,
        autoSync: this.elements.autoSyncCheckbox.checked,
        syncInterval: parseInt(this.elements.syncIntervalSlider.value),
        enableSharedSnippets: this.elements.sharedSnippetsCheckbox.checked,
      };

      await SettingsMessages.updateSettings(newSettings);
      this.settings = { ...this.settings, ...newSettings };

      this.showStatus("Settings saved successfully", "success");
    } catch (error) {
      console.error("Failed to save settings:", error);
      this.showStatus("Failed to save settings", "error");
    }
  }

  /**
   * Handle Get Started button click
   */
  private handleGetStarted(): void {
    this.elements.initialSetupSection.classList.add("hidden");
    document
      .querySelectorAll(".settings-section:not(#initial-setup-section)")
      .forEach((section) => {
        section.classList.remove("hidden");
      });
    // Scroll to Cloud Synchronization section
    const cloudSyncSection = document.getElementById("cloud-sync-section"); // Assuming this ID exists
    if (cloudSyncSection) {
      cloudSyncSection.scrollIntoView({ behavior: "smooth" });
    }
  }

  /**
   * Handle cloud provider change
   */
  private async handleProviderChange(): Promise<void> {
    await this.saveSettings();
    await this.updateCloudStatus();
  }

  /**
   * Update cloud status display
   */
  private async updateCloudStatus(): Promise<void> {
    const provider = this.settings.cloudProvider;
    const syncStatus = await SyncMessages.getSyncStatus();

    if (provider === "local") {
      this.elements.statusIndicator.className = "status-indicator online";
      this.elements.statusTitle.textContent = "Local Storage";
      this.elements.statusDetails.textContent = "Using local storage only";
      this.elements.connectButton.style.display = "none";
      this.elements.lastSyncInfo.textContent = "";
      this.elements.syncErrorInfo.textContent = "";
    } else {
      // For cloud providers, check connection status
      try {
        // Force a fresh sync status check
        console.log("🔍 Checking cloud connection status for", provider);
        const isConnected = syncStatus?.isOnline || false;
        console.log("🔍 Connection status:", { isConnected, syncStatus });

        if (isConnected) {
          this.elements.statusIndicator.className = "status-indicator online";
          this.elements.statusTitle.textContent = "Connected";
          this.elements.statusDetails.textContent = `Connected to ${CLOUD_PROVIDERS[provider].name}`;
          this.elements.connectButton.textContent = "Disconnect";
        } else {
          this.elements.statusIndicator.className = "status-indicator offline";
          this.elements.statusTitle.textContent = "Not Connected";
          this.elements.statusDetails.textContent = `Connect to ${CLOUD_PROVIDERS[provider].name}`;
          this.elements.connectButton.textContent = "Connect";
        }

        // Display last sync time
        if (syncStatus?.lastSync) {
          this.elements.lastSyncInfo.textContent = `Last sync: ${this.formatRelativeTime(new Date(syncStatus.lastSync))}`;
        } else {
          this.elements.lastSyncInfo.textContent = "Last sync: Never";
        }

        // Display sync error
        if (syncStatus?.error) {
          this.elements.syncErrorInfo.textContent = `Error: ${syncStatus.error}`;
          this.elements.syncErrorInfo.style.display = "block";
        } else {
          this.elements.syncErrorInfo.textContent = "";
          this.elements.syncErrorInfo.style.display = "none";
        }

        this.elements.connectButton.style.display = "block";
      } catch (error) {
        this.elements.statusIndicator.className = "status-indicator offline";
        this.elements.statusTitle.textContent = "Connection Error";
        this.elements.statusDetails.textContent =
          "Failed to check connection status";
        this.elements.connectButton.style.display = "block";
        this.elements.lastSyncInfo.textContent = "";
        this.elements.syncErrorInfo.textContent = "";
      }
    }
  }

  /**
   * Handle folder selection for a given scope
   */
  private async handleSelectFolder(
    scope: "personal" | "department" | "org",
  ): Promise<void> {
    try {
      const provider = this.settings.cloudProvider;
      if (provider === "local") {
        this.showStatus("Please select a cloud provider first.", "warning");
        return;
      }

      if (provider !== "google-drive") {
        this.showStatus(
          "Folder picker is currently only available for Google Drive.",
          "warning",
        );
        return;
      }

      // Store the current scope for use in confirmation
      this.currentFolderScope = scope;

      // Open the folder picker modal
      await this.openFolderPicker();
    } catch (error) {
      console.error(`Failed to open folder picker for ${scope}:`, error);
      this.showStatus(
        `Failed to open folder picker: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Handle connect/disconnect button
   */
  private async handleConnect(): Promise<void> {
    try {
      const isConnected =
        this.elements.connectButton.textContent === "Disconnect";

      if (isConnected) {
        // Disconnect
        await this.handleDisconnect();
      } else {
        // Connect
        await this.handleAuthenticate();
      }

      // Force a UI refresh after connect/disconnect
      await this.updateCloudStatus();
    } catch (error) {
      console.error("Connection failed:", error);
      this.showStatus(
        `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Handle authentication
   */
  private async handleAuthenticate(): Promise<void> {
    try {
      const provider = this.settings.cloudProvider;
      if (provider === "local") {
        this.showStatus("No authentication needed for local storage", "info");
        return;
      }

      this.showStatus(
        `Authenticating with ${CLOUD_PROVIDERS[provider].name}...`,
        "info",
      );
      await SyncMessages.authenticateCloud();
      this.showStatus("Authentication successful!", "success");
    } catch (error) {
      console.error("Authentication failed:", error);
      this.showStatus(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      throw error; // Re-throw to be caught by handleConnect
    }
  }

  /**
   * Handle disconnect
   */
  private async handleDisconnect(): Promise<void> {
    try {
      const provider = this.settings.cloudProvider;
      this.showStatus(
        `Disconnecting from ${CLOUD_PROVIDERS[provider].name}...`,
        "info",
      );
      await SyncMessages.disconnectCloud();

      // Force reload settings after disconnect
      await this.loadSettings();

      this.showStatus("Disconnected successfully!", "success");
      await this.updateCloudStatus(); // Refresh status after disconnect
    } catch (error) {
      console.error("Disconnect failed:", error);
      this.showStatus(
        `Disconnect failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Handle sync now
   */
  private async handleSyncNow(): Promise<void> {
    try {
      this.elements.syncNowButton.disabled = true;
      this.elements.syncNowButton.textContent = "Syncing...";

      await SyncMessages.syncSnippets();
      await this.updateDataStats();
      await this.loadAndRenderSyncedSnippets(); // Refresh snippets after sync

      this.showStatus("Sync completed successfully", "success");
    } catch (error) {
      console.error("Sync failed:", error);
      this.showStatus(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      this.elements.syncNowButton.disabled = false;
      this.elements.syncNowButton.textContent = "Sync Now";
    }
  }

  /**
   * Handle force upload
   */

  /**
   * Handle force upload
   */
  private async handleForceUpload(): Promise<void> {
    if (!confirm("This will overwrite cloud data with local data. Continue?")) {
      return;
    }

    try {
      this.elements.forceUploadButton.disabled = true;
      this.showStatus("Force uploading...", "info");

      // Implementation would go here
      this.showStatus("Force upload not implemented yet", "warning");
    } catch (error) {
      console.error("Force upload failed:", error);
      this.showStatus(
        `Force upload failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      this.elements.forceUploadButton.disabled = false;
    }
  }

  /**
   * Handle force download
   */
  private async handleForceDownload(): Promise<void> {
    if (!confirm("This will overwrite local data with cloud data. Continue?")) {
      return;
    }

    try {
      this.elements.forceDownloadButton.disabled = true;
      this.showStatus("Force downloading...", "info");

      // Implementation would go here
      this.showStatus("Force download not implemented yet", "warning");
    } catch (error) {
      console.error("Force download failed:", error);
      this.showStatus(
        `Force download failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      this.elements.forceDownloadButton.disabled = false;
    }
  }

  /**
   * Update data statistics
   */
  private async updateDataStats(): Promise<void> {
    try {
      const snippets = await SnippetMessages.getSnippets();
      const storageUsage = await ExtensionStorage.getStorageUsage();
      const lastSync = await ExtensionStorage.getLastSync();

      if (this.elements.totalSnippets)
        this.elements.totalSnippets.textContent = snippets.length.toString();
      if (this.elements.storageUsed)
        this.elements.storageUsed.textContent = this.formatBytes(
          storageUsage.local + storageUsage.sync,
        );
      if (this.elements.lastSync)
        this.elements.lastSync.textContent = lastSync
          ? this.formatRelativeTime(lastSync)
          : "Never";
    } catch (error) {
      console.error("Failed to update data stats:", error);
    }
  }

  /**
   * Handle storage cleanup - remove invalid sources
   */
  private async handleCleanupStorage(): Promise<void> {
    try {
      this.elements.cleanupStorageButton.disabled = true;
      this.elements.cleanupStorageButton.textContent = "Cleaning...";

      // Get cleanup status first
      const status = await StorageCleanup.getCleanupStatus();

      if (!status.needsCleanup) {
        this.showStatus("No cleanup needed - all sources are valid", "success");
        return;
      }

      // Show what will be cleaned
      const message = `This will clean up:\n${status.recommendations.join("\n")}\n\nContinue?`;
      if (!confirm(message)) {
        return;
      }

      // Perform cleanup
      const result = await StorageCleanup.clearInvalidSources();

      if (result.errors.length > 0) {
        this.showStatus(
          `Cleanup completed with errors: ${result.errors.join(", ")}`,
          "warning",
        );
      } else if (result.cleaned > 0) {
        this.showStatus(
          `Cleanup successful: removed ${result.cleaned} invalid sources`,
          "success",
        );
      } else {
        this.showStatus("No invalid sources found to clean", "info");
      }

      // Refresh UI
      await this.loadSettings();
      await this.updateUI();
      await this.updateDataStats();
    } catch (error) {
      console.error("Storage cleanup failed:", error);
      this.showStatus(
        `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      this.elements.cleanupStorageButton.disabled = false;
      this.elements.cleanupStorageButton.textContent =
        "Clean Up Invalid Sources";
    }
  }

  /**
   * Handle clear local data
   */
  private async handleClearLocal(): Promise<void> {
    if (
      !confirm(
        "This will delete all local snippets and settings. This action cannot be undone. Continue?",
      )
    ) {
      return;
    }

    try {
      await ExtensionStorage.clearAll();
      await this.loadSettings();
      await this.updateUI();
      await this.updateDataStats();

      this.showStatus("Local data cleared successfully", "success");
    } catch (error) {
      console.error("Failed to clear local data:", error);
      this.showStatus("Failed to clear local data", "error");
    }
  }

  /**
   * Handle reset all settings
   */
  private async handleResetAll(): Promise<void> {
    if (!confirm("This will reset all settings to defaults. Continue?")) {
      return;
    }

    try {
      await SettingsMessages.updateSettings(DEFAULT_SETTINGS);
      this.settings = DEFAULT_SETTINGS;
      await this.updateUI();

      this.showStatus("Settings reset to defaults", "success");
    } catch (error) {
      console.error("Failed to reset settings:", error);
      this.showStatus("Failed to reset settings", "error");
    }
  }

  /**
   * Handle view logs
   */
  private handleViewLogs(): void {
    // Open browser console or logs page
    this.showStatus("Debug logs available in browser console", "info");
    console.log("Text Expander Debug Information:");
    console.log("Settings:", this.settings);
    console.log("User Agent:", navigator.userAgent);
    console.log("Extension ID:", chrome.runtime.id);
  }

  /**
   * Handle data export
   */
  private async handleExport(): Promise<void> {
    try {
      const exportData = await ExtensionStorage.exportData();
      const blob = new Blob([exportData], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `text-expander-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
      this.showStatus("Data exported successfully", "success");
    } catch (error) {
      console.error("Export failed:", error);
      this.showStatus("Export failed", "error");
    }
  }

  /**
   * Handle data import
   */
  private handleImport(): void {
    this.elements.importFileInput.click();
  }

  /**
   * Handle file import
   */
  private async handleFileImport(): Promise<void> {
    const file = this.elements.importFileInput.files?.[0];
    if (!file) return;

    try {
      const content = await this.readFileAsText(file);
      await ExtensionStorage.importData(content);

      await this.loadSettings();
      await this.updateUI();
      await this.updateDataStats();

      this.showStatus("Data imported successfully", "success");
    } catch (error) {
      console.error("Import failed:", error);
      this.showStatus(
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Handle external links
   */
  private handleExternalLink(e: Event, type: string): void {
    e.preventDefault();

    const urls = {
      help: "https://example.com/help",
      feedback: "https://example.com/feedback",
      privacy: "https://example.com/privacy",
    };

    const url = urls[type as keyof typeof urls];
    if (url) {
      chrome.tabs.create({ url });
    }
  }

  /**
   * Load and render synced snippets
   */
  private async loadAndRenderSyncedSnippets(): Promise<void> {
    try {
      const snippets = await SnippetMessages.getSnippets();
      this.renderSyncedSnippets(snippets);
    } catch (error) {
      console.error("Failed to load and render synced snippets:", error);
      if (this.elements.syncedSnippetsList) {
        this.elements.syncedSnippetsList.innerHTML =
          '<p class="setting-description error">Failed to load snippets.</p>';
      }
    }
  }

  /**
   * Render synced snippets list
   */
  private renderSyncedSnippets(snippets: TextSnippet[]): void {
    const container = this.elements.syncedSnippetsList;
    if (!container) return;

    container.innerHTML = ""; // Clear previous content

    if (snippets.length === 0) {
      container.innerHTML =
        '<p class="setting-description">No synced snippets found.</p>';
      return;
    }

    // Sort snippets by trigger for consistent display
    snippets.sort((a, b) => a.trigger.localeCompare(b.trigger));

    snippets.forEach((snippet) => {
      const snippetItem = document.createElement("div");
      snippetItem.className = "synced-snippet-item";

      const scopeIndicator = snippet.scope
        ? `<span class="snippet-scope-indicator scope-${snippet.scope}">${snippet.scope.charAt(0).toUpperCase()}</span>`
        : "";
      const truncatedContent =
        snippet.content.length > 100
          ? snippet.content.substring(0, 100) + "..."
          : snippet.content;

      snippetItem.innerHTML = `
        <div class="snippet-info">
          <span class="snippet-trigger">${snippet.trigger}</span>
          <span class="snippet-content">${truncatedContent}</span>
        </div>
        ${scopeIndicator}
      `;
      container.appendChild(snippetItem);
    });
  }

  /**
   * Update trigger delay value display
   */
  private updateTriggerDelayValue(): void {
    const value = parseInt(this.elements.triggerDelaySlider.value);
    this.elements.triggerDelayValue.textContent = `${value}ms`;
  }

  /**
   * Update sync interval value display
   */
  private updateSyncIntervalValue(): void {
    const value = parseInt(this.elements.syncIntervalSlider.value);
    this.elements.syncIntervalValue.textContent = `${value} minutes`;
  }

  /**
   * Update global toggle status display
   */
  private updateGlobalToggleStatus(): void {
    const isEnabled = this.elements.globalToggleEnabledCheckbox.checked;
    const statusBadge =
      this.elements.globalToggleStatus.querySelector(".status-badge");

    if (statusBadge) {
      statusBadge.textContent = isEnabled ? "Active" : "Disabled";
      statusBadge.className = `status-badge ${isEnabled ? "enabled" : "disabled"}`;
    }
  }

  /**
   * Handle edit shortcut button click
   */
  private handleEditShortcut(): void {
    const isEditing = this.elements.globalToggleShortcut.readOnly;

    if (isEditing) {
      // Enable editing
      this.elements.globalToggleShortcut.readOnly = false;
      this.elements.globalToggleShortcut.focus();
      this.elements.globalToggleShortcut.select();
      this.elements.shortcutHelp.style.display = "block";

      // Update button
      const buttonIcon =
        this.elements.editShortcutButton.querySelector(".button-icon");
      const buttonText =
        this.elements.editShortcutButton.querySelector(".button-text");
      if (buttonIcon) buttonIcon.textContent = "💾";
      if (buttonText) buttonText.textContent = "Save";
    } else {
      // Save and disable editing
      this.elements.globalToggleShortcut.readOnly = true;
      this.elements.shortcutHelp.style.display = "none";

      // Update button
      const buttonIcon =
        this.elements.editShortcutButton.querySelector(".button-icon");
      const buttonText =
        this.elements.editShortcutButton.querySelector(".button-text");
      if (buttonIcon) buttonIcon.textContent = "✏️";
      if (buttonText) buttonText.textContent = "Edit";

      // Save settings
      this.saveSettings();
    }
  }

  /**
   * Handle shortcut capture during editing
   */
  private handleShortcutCapture(event: KeyboardEvent): void {
    if (this.elements.globalToggleShortcut.readOnly) return;

    event.preventDefault();

    const modifiers: string[] = [];
    const key = event.key;

    // Capture modifiers
    if (event.ctrlKey) modifiers.push("Ctrl");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    if (event.metaKey)
      modifiers.push(navigator.platform.includes("Mac") ? "Cmd" : "Meta");

    // Don't capture modifier keys alone
    if (["Control", "Alt", "Shift", "Meta"].includes(key)) return;

    // Build shortcut string
    let shortcut = "";
    if (modifiers.length > 0) {
      shortcut = modifiers.join("+") + "+" + key.toUpperCase();
    } else {
      shortcut = key.toUpperCase();
    }

    // Validate shortcut (require at least one modifier)
    if (modifiers.length === 0) {
      this.showStatus(
        "Shortcut must include at least one modifier key (Ctrl, Alt, Shift, or Meta)",
        "error",
      );
      return;
    }

    // Update input value
    this.elements.globalToggleShortcut.value = shortcut;
  }

  /**
   * Update version number
   */
  private updateVersion(): void {
    const manifest = chrome.runtime.getManifest();
    this.elements.versionNumber.textContent = manifest.version;
  }

  /**
   * Show status message
   */
  private showStatus(
    message: string,
    type: "success" | "error" | "warning" | "info",
  ): void {
    this.elements.statusBanner.className = `status-banner ${type}`;
    this.elements.statusText.textContent = message;
    this.elements.statusBanner.classList.remove("hidden");

    // Auto-hide success messages
    if (type === "success") {
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  /**
   * Hide status message
   */
  private hideStatus(): void {
    this.elements.statusBanner.classList.add("hidden");
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  /**
   * Handle anchor navigation from URL hash
   */
  private handleAnchorNavigation(): void {
    const hash = window.location.hash;
    if (hash) {
      const targetId = hash.substring(1); // Remove the # symbol
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        // Scroll to the element with smooth behavior
        targetElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });

        // Add a highlight effect to draw attention
        targetElement.style.transition = "background-color 0.5s ease";
        targetElement.style.backgroundColor = "#e3f2fd";

        // Remove the highlight after 2 seconds
        setTimeout(() => {
          targetElement.style.backgroundColor = "";
        }, 2000);
      }
    }
  }

  /**
   * Format relative time
   */
  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString();
  }

  /**
   * Read file as text
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  // ================================
  // Folder Picker Modal Methods
  // ================================

  /**
   * Open the folder picker modal and load available folders
   */
  private async openFolderPicker(): Promise<void> {
    // Reset state
    this.selectedFolder = null;
    this.availableFolders = [];
    this.currentParentId = "root";
    this.breadcrumbPath = [{ id: "root", name: "My Drive" }];

    // Show loading state
    this.showFolderPickerLoading();
    this.elements.folderPickerModal.style.display = "flex";

    // Update breadcrumb
    this.updateBreadcrumb();

    try {
      // Load folders from Google Drive
      await this.loadAvailableFolders();
    } catch (error) {
      console.error("Failed to load folders:", error);
      this.showFolderPickerError(
        `Failed to load folders: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load available folders from Google Drive
   */
  private async loadAvailableFolders(parentId?: string): Promise<void> {
    try {
      // Call the background script to get folders without auto-selecting
      const response = await chrome.runtime.sendMessage({
        type: "GET_GOOGLE_DRIVE_FOLDERS",
        parentId: parentId || this.currentParentId,
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
        <div class="folder-item navigable" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
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

      // Add click listeners to navigate buttons
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

      // Add click listeners to select buttons
      this.elements.folderPickerList
        .querySelectorAll(".select-button")
        .forEach((button) => {
          button.addEventListener("click", (e) => {
            e.stopPropagation();
            const folderElement = button.closest(".folder-item") as HTMLElement;
            this.selectFolderItem(folderElement);
          });
        });

      // Add double-click listeners to folder items for navigation
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

    this.elements.folderPickerList.style.display = "block";
  }

  /**
   * Handle folder item selection
   */
  private selectFolderItem(element: HTMLElement): void {
    // Remove previous selection
    this.elements.folderPickerList
      .querySelectorAll(".folder-item")
      .forEach((item) => {
        item.classList.remove("selected");
      });

    // Select current item
    element.classList.add("selected");

    // Store selected folder
    this.selectedFolder = {
      id: element.getAttribute("data-folder-id")!,
      name: element.getAttribute("data-folder-name")!,
    };

    // Enable confirm button
    this.elements.confirmFolderPickerButton.disabled = false;
  }

  /**
   * Confirm folder selection and save to settings
   */
  private async confirmFolderSelection(): Promise<void> {
    if (!this.selectedFolder || !this.currentFolderScope) {
      return;
    }

    try {
      const scope = this.currentFolderScope;
      const folder = this.selectedFolder;

      // Ask for custom display name
      const customDisplayName = prompt(
        `Enter a display name for your ${scope} snippets:`,
        folder.name,
      );
      const finalDisplayName = customDisplayName || folder.name;

      // Create configured source
      const newConfiguredSource: ConfiguredScopedSource = {
        provider: this.settings.cloudProvider,
        scope: scope,
        folderId: folder.id,
        displayName: finalDisplayName,
      };

      // Update settings
      const updatedConfiguredSources = this.settings.configuredSources.filter(
        (s) => s.scope !== scope,
      );
      updatedConfiguredSources.push(newConfiguredSource);

      await SettingsMessages.updateSettings({
        configuredSources: updatedConfiguredSources,
      });
      this.settings.configuredSources = updatedConfiguredSources;

      // Update UI
      this.updateFolderInputDisplay(scope, finalDisplayName);

      // Close modal and show success
      this.closeFolderPicker();
      this.showStatus(
        `Folder selected for ${scope}: ${finalDisplayName}`,
        "success",
      );
    } catch (error) {
      console.error("Failed to save folder selection:", error);
      this.showStatus(
        `Failed to save folder selection: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Update the folder input display with selected folder
   */
  private updateFolderInputDisplay(
    scope: "personal" | "department" | "org",
    displayName: string,
  ): void {
    switch (scope) {
      case "personal":
        this.elements.personalFolderIdInput.value = displayName;
        break;
      case "department":
        this.elements.departmentFolderIdInput.value = displayName;
        break;
      case "org":
        this.elements.organizationFolderIdInput.value = displayName;
        break;
    }
  }

  /**
   * Handle creating a new folder
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

      // Call background script to create folder
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

  /**
   * Close the folder picker modal
   */
  private closeFolderPicker(): void {
    this.elements.folderPickerModal.style.display = "none";
    this.selectedFolder = null;
    this.currentFolderScope = null;
    this.availableFolders = [];
    this.elements.confirmFolderPickerButton.disabled = true;

    // Reset modal state
    this.hideFolderPickerError();
    this.hideFolderPickerLoading();
    this.elements.folderPickerList.style.display = "none";
  }

  /**
   * Show loading state in folder picker
   */
  private showFolderPickerLoading(): void {
    this.elements.folderPickerLoading.style.display = "block";
    this.elements.folderPickerList.style.display = "none";
    this.hideFolderPickerError();
  }

  /**
   * Hide loading state in folder picker
   */
  private hideFolderPickerLoading(): void {
    this.elements.folderPickerLoading.style.display = "none";
  }

  /**
   * Show error message in folder picker
   */
  private showFolderPickerError(message: string): void {
    this.elements.folderPickerError.textContent = message;
    this.elements.folderPickerError.style.display = "block";
    this.hideFolderPickerLoading();
    this.elements.folderPickerList.style.display = "none";
  }

  /**
   * Hide error message in folder picker
   */
  private hideFolderPickerError(): void {
    this.elements.folderPickerError.style.display = "none";
  }

  /**
   * Navigate to a folder
   */
  private async navigateToFolder(
    folderId: string,
    folderName: string,
  ): Promise<void> {
    try {
      // Update current state
      this.currentParentId = folderId;
      this.breadcrumbPath.push({ id: folderId, name: folderName });

      // Show loading
      this.showFolderPickerLoading();

      // Update breadcrumb
      this.updateBreadcrumb();

      // Load folders in the new directory
      await this.loadAvailableFolders();
    } catch (error) {
      console.error("Failed to navigate to folder:", error);
      this.showFolderPickerError(
        `Failed to open folder: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

      // Show loading
      this.showFolderPickerLoading();

      // Update breadcrumb
      this.updateBreadcrumb();

      // Load folders in the selected directory
      await this.loadAvailableFolders();
    } catch (error) {
      console.error("Failed to navigate to breadcrumb folder:", error);
      this.showFolderPickerError(
        `Failed to navigate: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
}

// Initialize options page when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new OptionsApp();
  });
} else {
  new OptionsApp();
}
