/**
 * Options page script for PuffPuffPaste Chrome Extension
 * Orchestrates all services and components using dependency injection
 */

import {
  initializeDOMElements,
  waitForDOMReady,
} from "./utils/dom-elements.js";
import { SettingsService } from "./services/settings-service.js";
import { SyncService } from "./services/sync-service.js";
import { DataManagementService } from "./services/data-management-service.js";
import { FolderPickerComponent } from "./components/folder-picker.js";
import { GlobalToggleComponent } from "./components/global-toggle.js";
import { OptionsUI, type UICallbacks } from "./options-ui.js";
import type { ExtensionSettings } from "../shared/types.js";

/**
 * Main Options Application Class
 * Acts as an orchestrator coordinating all services and components
 */
class OptionsApp {
  // Core services
  private settingsService!: SettingsService;
  private syncService!: SyncService;
  private dataService!: DataManagementService;

  // UI components
  private ui!: OptionsUI;
  private folderPicker!: FolderPickerComponent;
  private globalToggle!: GlobalToggleComponent;

  // Application state
  private settings: ExtensionSettings | null = null;

  /**
   * Initialize the options application
   */
  async initialize(): Promise<void> {
    try {
      // Wait for DOM to be ready
      await waitForDOMReady();

      // Initialize DOM elements
      const elements = initializeDOMElements();

      // Initialize services with dependency injection
      this.initializeServices(elements);

      // Initialize UI components
      this.initializeComponents(elements);

      // Load initial data and render UI
      await this.loadAndRender();

      console.log("✅ Options app initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize options app:", error);
      this.showFatalError("Failed to initialize options page");
    }
  }

  /**
   * Initialize all services
   */
  private initializeServices(elements: any): void {
    // Initialize settings service
    this.settingsService = new SettingsService(elements);

    // Initialize sync service with callbacks
    this.syncService = new SyncService(
      elements,
      (message, type) => this.ui.showStatus(message, type),
      async () => {
        await this.dataService.updateDataStats();
      },
      () => this.ui.loadAndRenderSyncedSnippets(),
    );

    // Initialize data management service
    this.dataService = new DataManagementService(elements, (message, type) =>
      this.ui.showStatus(message, type),
    );
  }

  /**
   * Initialize UI components
   */
  private initializeComponents(elements: any): void {
    // Create UI callbacks object
    const callbacks: UICallbacks = {
      onSettingsChange: () => this.handleSettingsChange(),
      onProviderChange: () => this.handleProviderChange(),
      onConnect: () => this.handleConnect(),
      onSyncNow: () => this.handleSyncNow(),
      onForceUpload: () => this.handleForceUpload(),
      onForceDownload: () => this.handleForceDownload(),
      onSelectFolder: (scope) => this.handleSelectFolder(scope),
      onCleanupStorage: () => this.handleCleanupStorage(),
      onClearLocal: () => this.handleClearLocal(),
      onResetAll: () => this.handleResetAll(),
      onExport: () => this.handleExport(),
      onImport: () => this.handleImport(),
      onFileImport: () => this.handleFileImport(),
      onViewLogs: () => this.handleViewLogs(),
      onGetStarted: () => this.handleGetStarted(),
      onEditShortcut: () => this.handleEditShortcut(),
      onCreateFolder: () => this.handleCreateFolder(),
      onConfirmFolderSelection: () => this.handleConfirmFolderSelection(),
      onCloseFolderPicker: () => this.handleCloseFolderPicker(),
    };

    // Initialize UI manager
    this.ui = new OptionsUI(elements, callbacks);

    // Initialize folder picker component
    this.folderPicker = new FolderPickerComponent(elements, (message, type) =>
      this.ui.showStatus(message, type),
    );

    // Initialize global toggle component
    this.globalToggle = new GlobalToggleComponent(
      elements,
      (message, type) => this.ui.showStatus(message, type),
      () => this.handleSettingsChange(),
    );
  }

  /**
   * Load initial data and render UI
   */
  private async loadAndRender(): Promise<void> {
    try {
      // Load settings
      this.settings = await this.settingsService.loadSettings();

      // Update UI with loaded settings
      this.ui.updateUI(this.settings);
      this.globalToggle.updateFromSettings(
        this.settings.globalToggleEnabled,
        this.settings.globalToggleShortcut,
      );

      // Update cloud status
      await this.ui.updateCloudStatus(this.settings);

      // Load and render data
      await this.ui.updateDataStats();
      await this.ui.loadAndRenderSyncedSnippets();

      // Manage setup visibility
      await this.ui.manageSetupVisibility();
    } catch (error) {
      console.error("Failed to load and render initial data:", error);
      this.ui.showStatus("Failed to load options data", "error");
    }
  }

  /**
   * Event Handlers
   */

  private async handleSettingsChange(): Promise<void> {
    try {
      await this.settingsService.saveSettings();
      this.settings = this.settingsService.getSettings();
      this.ui.showStatus("Settings saved successfully", "success");
    } catch (error) {
      console.error("Failed to save settings:", error);
      this.ui.showStatus("Failed to save settings", "error");
    }
  }

  private async handleProviderChange(): Promise<void> {
    try {
      await this.settingsService.handleProviderChange();
      this.settings = this.settingsService.getSettings();
      await this.ui.updateCloudStatus(this.settings);
    } catch (error) {
      console.error("Failed to handle provider change:", error);
      this.ui.showStatus("Failed to update provider", "error");
    }
  }

  private async handleConnect(): Promise<void> {
    if (!this.settings) return;

    try {
      await this.syncService.handleConnect(this.settings);

      // Reload settings after connect/disconnect
      this.settings = await this.settingsService.loadSettings();
      await this.ui.updateCloudStatus(this.settings);
    } catch (error) {
      console.error("Connection operation failed:", error);
    }
  }

  private async handleSyncNow(): Promise<void> {
    await this.syncService.handleSyncNow();
  }

  private async handleForceUpload(): Promise<void> {
    await this.syncService.handleForceUpload();
  }

  private async handleForceDownload(): Promise<void> {
    await this.syncService.handleForceDownload();
  }

  private async handleSelectFolder(
    scope: "personal" | "department" | "org",
  ): Promise<void> {
    if (!this.settings) return;

    await this.folderPicker.handleSelectFolder(
      scope,
      this.settings.cloudProvider,
    );

    // Reload settings to get updated folder configuration
    this.settings = await this.settingsService.loadSettings();
    this.ui.updateUI(this.settings);
  }

  private async handleCleanupStorage(): Promise<void> {
    try {
      await this.dataService.handleCleanupStorage();

      // Refresh data after cleanup
      this.settings = await this.settingsService.loadSettings();
      this.ui.updateUI(this.settings);
      await this.ui.updateDataStats();
    } catch (error) {
      console.error("Storage cleanup failed:", error);
    }
  }

  private async handleClearLocal(): Promise<void> {
    try {
      await this.dataService.handleClearLocal();

      // Reload everything after clearing
      this.settings = await this.settingsService.loadSettings();
      this.ui.updateUI(this.settings);
      await this.ui.updateDataStats();
    } catch (error) {
      console.error("Clear local failed:", error);
    }
  }

  private async handleResetAll(): Promise<void> {
    try {
      await this.dataService.handleResetAll();

      // Reload settings after reset
      this.settings = await this.settingsService.loadSettings();
      this.ui.updateUI(this.settings);
      this.globalToggle.updateFromSettings(
        this.settings.globalToggleEnabled,
        this.settings.globalToggleShortcut,
      );
    } catch (error) {
      console.error("Reset all failed:", error);
    }
  }

  private async handleExport(): Promise<void> {
    await this.dataService.handleExport();
  }

  private handleImport(): void {
    this.dataService.handleImport();
  }

  private async handleFileImport(): Promise<void> {
    try {
      await this.dataService.handleFileImport();

      // Reload everything after import
      this.settings = await this.settingsService.loadSettings();
      this.ui.updateUI(this.settings);
      await this.ui.updateDataStats();

      // Clear the file input
      this.dataService.clearFileInput();
    } catch (error) {
      console.error("File import failed:", error);
    }
  }

  private async handleViewLogs(): Promise<void> {
    try {
      // Open developer tools to view console logs
      this.ui.showStatus("Check the browser console for detailed logs", "info");
    } catch (error) {
      console.error("Failed to show logs:", error);
    }
  }

  private async handleGetStarted(): Promise<void> {
    try {
      // Guide user through initial setup
      this.ui.showStatus(
        "Welcome! Please configure your cloud provider to get started.",
        "info",
      );

      // Focus on cloud provider selection
      const hash = "#cloud-sync-section";
      window.location.hash = hash;
    } catch (error) {
      console.error("Get started failed:", error);
    }
  }

  private handleEditShortcut(): void {
    // Global toggle component handles this internally
    // This is just a placeholder for the callback interface
  }

  private async handleCreateFolder(): Promise<void> {
    // Folder picker component handles this internally
    // This is just a placeholder for the callback interface
  }

  private async handleConfirmFolderSelection(): Promise<void> {
    // Folder picker component handles this internally
    // This is just a placeholder for the callback interface
  }

  private handleCloseFolderPicker(): void {
    // Folder picker component handles this internally
    // This is just a placeholder for the callback interface
  }

  /**
   * Show fatal error message
   */
  private showFatalError(message: string): void {
    document.body.innerHTML = `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #dc3545;
        text-align: center;
        padding: 20px;
      ">
        <h1>❌ Error</h1>
        <p>${message}</p>
        <button onclick="window.location.reload()" style="
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 20px;
        ">
          Reload Page
        </button>
      </div>
    `;
  }

  /**
   * Cleanup resources when app is destroyed
   */
  destroy(): void {
    // Reset components
    this.folderPicker?.reset();
    this.globalToggle?.reset();

    console.log("Options app destroyed");
  }
}

/**
 * Initialize the options application when DOM is ready
 */
document.addEventListener("DOMContentLoaded", async () => {
  const app = new OptionsApp();
  await app.initialize();

  // Store app instance globally for debugging
  (window as any).optionsApp = app;

  // Handle page unload
  window.addEventListener("beforeunload", () => {
    app.destroy();
  });
});

// Export for testing
export { OptionsApp };
