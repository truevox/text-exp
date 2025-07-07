/**
 * UI Manager for Options Page
 * Handles all DOM manipulation, event listeners, status display, and rendering
 */

import { SnippetMessages, SyncMessages } from "../shared/messaging.js";
import { ExtensionStorage } from "../shared/storage.js";
import { CLOUD_PROVIDERS } from "../shared/constants.js";
import type { ExtensionSettings, TextSnippet } from "../shared/types.js";
import type { OptionsElements } from "./utils/dom-elements.js";
import { EventHandlerManager } from "./event-handler-manager.js";

export type StatusType = "success" | "error" | "warning" | "info";

export interface UICallbacks {
  onSettingsChange: () => Promise<void>;
  onProviderChange: () => Promise<void>;
  onConnect: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onForceUpload: () => Promise<void>;
  onForceDownload: () => Promise<void>;
  onSelectFolder: (scope: "personal" | "department" | "org") => Promise<void>;
  onCleanupStorage: () => Promise<void>;
  onClearLocal: () => Promise<void>;
  onResetAll: () => Promise<void>;
  onExport: () => Promise<void>;
  onImport: () => void;
  onFileImport: () => Promise<void>;
  onViewLogs: () => Promise<void>;
  onGetStarted: () => Promise<void>;
  onEditShortcut: () => void;
  onCreateFolder: () => Promise<void>;
  onConfirmFolderSelection: () => Promise<void>;
  onCloseFolderPicker: () => void;
}

export class OptionsUI {
  private elements: OptionsElements;
  private callbacks: UICallbacks;
  private eventHandlerManager: EventHandlerManager;

  constructor(elements: OptionsElements, callbacks: UICallbacks) {
    this.elements = elements;
    this.callbacks = callbacks;
    this.eventHandlerManager = new EventHandlerManager(elements, callbacks);
    this.eventHandlerManager.setupEventListeners();
    this.updateVersion();
  }


  /**
   * Show status message
   */
  showStatus(message: string, type: StatusType): void {
    this.elements.statusBanner.className = `status-banner ${type}`;
    this.elements.statusText.textContent = message;
    this.elements.statusBanner.classList.remove("hidden");

    // Auto-hide success messages
    if (type === "success") {
      setTimeout(() => this.elements.statusBanner.classList.add("hidden"), 3000);
    }
  }


  /**
   * Update UI elements with settings values
   */
  updateUI(settings: ExtensionSettings): void {
    // General settings
    if (this.elements.enabledCheckbox)
      this.elements.enabledCheckbox.checked = settings.enabled;
    if (this.elements.caseSensitiveCheckbox)
      this.elements.caseSensitiveCheckbox.checked = settings.caseSensitive;
    if (this.elements.notificationsCheckbox)
      this.elements.notificationsCheckbox.checked = settings.showNotifications;
    if (this.elements.triggerDelaySlider)
      this.elements.triggerDelaySlider.value = settings.triggerDelay.toString();
    // Update trigger delay display
    if (this.elements.triggerDelayValue) {
      this.elements.triggerDelayValue.textContent = `${settings.triggerDelay}ms`;
    }

    // Global toggle settings
    if (this.elements.globalToggleEnabledCheckbox)
      this.elements.globalToggleEnabledCheckbox.checked =
        settings.globalToggleEnabled;
    if (this.elements.globalToggleShortcut)
      this.elements.globalToggleShortcut.value = settings.globalToggleShortcut;
    // Update global toggle status display
    if (this.elements.globalToggleStatus) {
      const statusBadge = this.elements.globalToggleStatus.querySelector(".status-badge");
      if (statusBadge) {
        statusBadge.textContent = settings.globalToggleEnabled ? "Active" : "Disabled";
        statusBadge.className = `status-badge ${settings.globalToggleEnabled ? "enabled" : "disabled"}`;
      }
    }

    // Cloud settings
    if (this.elements.cloudProviderSelect)
      this.elements.cloudProviderSelect.value = settings.cloudProvider;
    if (this.elements.autoSyncCheckbox)
      this.elements.autoSyncCheckbox.checked = settings.autoSync;
    if (this.elements.syncIntervalSlider)
      this.elements.syncIntervalSlider.value = settings.syncInterval.toString();
    // Update sync interval display
    if (this.elements.syncIntervalValue) {
      this.elements.syncIntervalValue.textContent = `${settings.syncInterval} minutes`;
    }

    // Collaboration
    if (this.elements.sharedSnippetsCheckbox)
      this.elements.sharedSnippetsCheckbox.checked =
        settings.enableSharedSnippets;

    // Debug settings (if debug checkbox exists)
    if (this.elements.debugCheckbox)
      this.elements.debugCheckbox.checked = (settings as any).debug || false;

    // Scoped folder settings
    this.updateScopedFolderInputs(settings);
  }

  /**
   * Update scoped folder input displays
   */
  private updateScopedFolderInputs(settings: ExtensionSettings): void {
    if (settings.configuredSources) {
      const personalSource = settings.configuredSources.find(
        (s) => s.scope === "personal",
      );
      if (this.elements.personalFolderIdInput && personalSource) {
        this.elements.personalFolderIdInput.value = personalSource.displayName;
      }

      const departmentSource = settings.configuredSources.find(
        (s) => s.scope === "department",
      );
      if (this.elements.departmentFolderIdInput && departmentSource) {
        this.elements.departmentFolderIdInput.value =
          departmentSource.displayName;
      }

      const organizationSource = settings.configuredSources.find(
        (s) => s.scope === "org",
      );
      if (this.elements.organizationFolderIdInput && organizationSource) {
        this.elements.organizationFolderIdInput.value =
          organizationSource.displayName;
      }
    }
  }

  /**
   * Update cloud status display
   */
  async updateCloudStatus(settings: ExtensionSettings): Promise<void> {
    const provider = settings.cloudProvider;
    const syncStatus = await SyncMessages.getSyncStatus();

    if (provider === "local") {
      this.updateLocalStorageStatus();
    } else {
      await this.updateCloudProviderStatus(provider, syncStatus);
    }
  }

  /**
   * Update status display for local storage
   */
  private updateLocalStorageStatus(): void {
    this.elements.statusIndicator.className = "status-indicator online";
    this.elements.statusTitle.textContent = "Local Storage";
    this.elements.statusDetails.textContent = "Using local storage only";
    this.elements.connectButton.style.display = "none";
    this.elements.lastSyncInfo.textContent = "";
    this.elements.syncErrorInfo.textContent = "";
  }

  /**
   * Update status display for cloud providers
   */
  private async updateCloudProviderStatus(
    provider: string,
    syncStatus: any,
  ): Promise<void> {
    try {
      console.log("🔍 Checking cloud connection status for", provider);
      const isConnected = syncStatus?.isOnline || false;
      console.log("🔍 Connection status:", { isConnected, syncStatus });

      if (isConnected) {
        this.updateConnectedStatus(provider);
      } else {
        this.updateDisconnectedStatus(provider);
      }

      this.updateSyncInfo(syncStatus);
      this.elements.connectButton.style.display = "block";
    } catch (error) {
      this.updateErrorStatus();
    }
  }

  /**
   * Update status for connected cloud provider
   */
  private updateConnectedStatus(provider: string): void {
    this.elements.statusIndicator.className = "status-indicator online";
    this.elements.statusTitle.textContent = "Connected";
    this.elements.statusDetails.textContent = `Connected to ${CLOUD_PROVIDERS[provider as keyof typeof CLOUD_PROVIDERS]?.name || provider}`;
    this.elements.connectButton.textContent = "Disconnect";
  }

  /**
   * Update status for disconnected cloud provider
   */
  private updateDisconnectedStatus(provider: string): void {
    this.elements.statusIndicator.className = "status-indicator offline";
    this.elements.statusTitle.textContent = "Not Connected";
    this.elements.statusDetails.textContent = `Connect to ${CLOUD_PROVIDERS[provider as keyof typeof CLOUD_PROVIDERS]?.name || provider}`;
    this.elements.connectButton.textContent = "Connect";
  }

  /**
   * Update sync information display
   */
  private updateSyncInfo(syncStatus: any): void {
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
  }

  /**
   * Update status for connection error
   */
  private updateErrorStatus(): void {
    this.elements.statusIndicator.className = "status-indicator offline";
    this.elements.statusTitle.textContent = "Connection Error";
    this.elements.statusDetails.textContent =
      "Failed to check connection status";
    this.elements.connectButton.style.display = "block";
    this.elements.lastSyncInfo.textContent = "";
    this.elements.syncErrorInfo.textContent = "";
  }

  /**
   * Load and render synced snippets
   */
  async loadAndRenderSyncedSnippets(): Promise<void> {
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
   * Update data statistics display
   */
  async updateDataStats(): Promise<void> {
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
   * Manage setup section visibility
   */
  async manageSetupVisibility(): Promise<void> {
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
   * Check if storage is configured
   */
  private async isStorageConfigured(): Promise<boolean> {
    try {
      const snippets = await SnippetMessages.getSnippets();
      return snippets.length > 0;
    } catch {
      return false;
    }
  }


  /**
   * Update version display
   */
  private updateVersion(): void {
    const manifest = chrome.runtime.getManifest();
    this.elements.versionNumber.textContent = manifest.version;
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
   * Format relative time for display
   */
  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return "Just now";
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Show loading state
   */
  showLoading(element: HTMLElement, text: string = "Loading..."): void {
    element.classList.add("loading");
    const originalText = element.textContent;
    element.textContent = text;
    element.setAttribute("data-original-text", originalText || "");
  }

  /**
   * Hide loading state
   */
  hideLoading(element: HTMLElement): void {
    element.classList.remove("loading");
    const originalText = element.getAttribute("data-original-text");
    if (originalText) {
      element.textContent = originalText;
      element.removeAttribute("data-original-text");
    }
  }

  /**
   * Disable element
   */
  disable(element: HTMLButtonElement | HTMLInputElement): void {
    element.disabled = true;
  }

  /**
   * Enable element
   */
  enable(element: HTMLButtonElement | HTMLInputElement): void {
    element.disabled = false;
  }

  /**
   * Toggle element visibility
   */
  toggleVisibility(element: HTMLElement, visible: boolean): void {
    if (visible) {
      element.classList.remove("hidden");
    } else {
      element.classList.add("hidden");
    }
  }
}
