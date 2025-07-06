/**
 * Sync Service for Options Page
 * Handles all cloud synchronization operations including authentication, connection management, and sync operations
 */

import { SyncMessages } from "../../shared/messaging.js";
import { CLOUD_PROVIDERS } from "../../shared/constants.js";
import type { ExtensionSettings } from "../../shared/types.js";
import type { OptionsElements } from "../utils/dom-elements.js";

export interface SyncStatus {
  isOnline: boolean;
  lastSync?: string;
  error?: string;
}

export type StatusCallback = (
  message: string,
  type: "success" | "error" | "warning" | "info",
) => void;
export type DataStatsCallback = () => Promise<void>;
export type SnippetsCallback = () => Promise<void>;

export class SyncService {
  private elements: OptionsElements;
  private showStatus: StatusCallback;
  private updateDataStats: DataStatsCallback;
  private loadAndRenderSyncedSnippets: SnippetsCallback;

  constructor(
    elements: OptionsElements,
    showStatus: StatusCallback,
    updateDataStats: DataStatsCallback,
    loadAndRenderSyncedSnippets: SnippetsCallback,
  ) {
    this.elements = elements;
    this.showStatus = showStatus;
    this.updateDataStats = updateDataStats;
    this.loadAndRenderSyncedSnippets = loadAndRenderSyncedSnippets;
  }

  /**
   * Update cloud status display based on current provider and sync status
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
   * Handle connect/disconnect button click
   */
  async handleConnect(settings: ExtensionSettings): Promise<void> {
    try {
      const isConnected =
        this.elements.connectButton.textContent === "Disconnect";

      if (isConnected) {
        await this.handleDisconnect(settings);
      } else {
        await this.handleAuthenticate(settings);
      }
    } catch (error) {
      console.error("Connection failed:", error);
      this.showStatus(
        `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      throw error;
    }
  }

  /**
   * Handle cloud provider authentication
   */
  async handleAuthenticate(settings: ExtensionSettings): Promise<void> {
    const provider = settings.cloudProvider;
    if (provider === "local") {
      this.showStatus("No authentication needed for local storage", "info");
      return;
    }

    try {
      this.showStatus(
        `Authenticating with ${CLOUD_PROVIDERS[provider as keyof typeof CLOUD_PROVIDERS]?.name || provider}...`,
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
      throw error;
    }
  }

  /**
   * Handle cloud provider disconnection
   */
  async handleDisconnect(settings: ExtensionSettings): Promise<void> {
    const provider = settings.cloudProvider;

    try {
      this.showStatus(
        `Disconnecting from ${CLOUD_PROVIDERS[provider as keyof typeof CLOUD_PROVIDERS]?.name || provider}...`,
        "info",
      );
      await SyncMessages.disconnectCloud();
      this.showStatus("Disconnected successfully!", "success");
    } catch (error) {
      console.error("Disconnect failed:", error);
      this.showStatus(
        `Disconnect failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      throw error;
    }
  }

  /**
   * Handle manual sync operation
   */
  async handleSyncNow(): Promise<void> {
    try {
      this.setSyncButtonState(true, "Syncing...");

      await SyncMessages.syncSnippets();
      await this.updateDataStats();
      await this.loadAndRenderSyncedSnippets();

      this.showStatus("Sync completed successfully", "success");
    } catch (error) {
      console.error("Sync failed:", error);
      this.showStatus(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      this.setSyncButtonState(false, "Sync Now");
    }
  }

  /**
   * Handle force upload operation
   */
  async handleForceUpload(): Promise<void> {
    if (!confirm("This will overwrite cloud data with local data. Continue?")) {
      return;
    }

    try {
      this.elements.forceUploadButton.disabled = true;
      this.showStatus("Force uploading...", "info");

      // TODO: Implement force upload functionality
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
   * Handle force download operation
   */
  async handleForceDownload(): Promise<void> {
    if (!confirm("This will overwrite local data with cloud data. Continue?")) {
      return;
    }

    try {
      this.elements.forceDownloadButton.disabled = true;
      this.showStatus("Force downloading...", "info");

      // TODO: Implement force download functionality
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
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const status = await SyncMessages.getSyncStatus();
      return {
        isOnline: status?.isOnline || false,
        lastSync: status?.lastSync,
        error: status?.error,
      };
    } catch (error) {
      console.error("Failed to get sync status:", error);
      return {
        isOnline: false,
        error: "Failed to get sync status",
      };
    }
  }

  /**
   * Set sync button state
   */
  private setSyncButtonState(disabled: boolean, text: string): void {
    this.elements.syncNowButton.disabled = disabled;
    this.elements.syncNowButton.textContent = text;
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
   * Check if cloud provider is connected
   */
  async isConnected(): Promise<boolean> {
    const status = await this.getSyncStatus();
    return status.isOnline;
  }

  /**
   * Force refresh of sync status
   */
  async refreshStatus(settings: ExtensionSettings): Promise<void> {
    await this.updateCloudStatus(settings);
  }

  /**
   * Validate cloud provider settings
   */
  validateCloudSettings(settings: ExtensionSettings): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!settings.cloudProvider) {
      errors.push("Cloud provider must be selected");
    }

    if (settings.syncInterval < 1 || settings.syncInterval > 1440) {
      errors.push("Sync interval must be between 1 and 1440 minutes");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
