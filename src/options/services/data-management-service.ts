/**
 * Data Management Service for Options Page
 * Handles all data operations including export, import, cleanup, and statistics
 */

import { SnippetMessages, SettingsMessages } from "../../shared/messaging.js";
import { ExtensionStorage } from "../../shared/storage.js";
import { StorageCleanup } from "../../utils/storage-cleanup.js";
import { DEFAULT_SETTINGS } from "../../shared/constants.js";
import type { OptionsElements } from "../utils/dom-elements.js";

export interface StorageStats {
  totalSnippets: number;
  storageUsage: {
    local: number;
    sync: number;
    total: number;
  };
  lastSync: Date | null;
}

export interface CleanupResult {
  cleaned: number;
  errors: string[];
}

export type StatusCallback = (
  message: string,
  type: "success" | "error" | "warning" | "info",
) => void;

export class DataManagementService {
  private elements: OptionsElements;
  private showStatus: StatusCallback;

  constructor(elements: OptionsElements, showStatus: StatusCallback) {
    this.elements = elements;
    this.showStatus = showStatus;
  }

  /**
   * Update data statistics display
   */
  async updateDataStats(): Promise<StorageStats> {
    try {
      const snippets = await SnippetMessages.getSnippets();
      const storageUsage = await ExtensionStorage.getStorageUsage();
      const lastSync = await ExtensionStorage.getLastSync();

      const stats: StorageStats = {
        totalSnippets: snippets.length,
        storageUsage: {
          local: storageUsage.local,
          sync: storageUsage.sync,
          total: storageUsage.local + storageUsage.sync,
        },
        lastSync,
      };

      this.updateStatsDisplay(stats);
      return stats;
    } catch (error) {
      console.error("Failed to update data stats:", error);
      throw new Error("Failed to update data statistics");
    }
  }

  /**
   * Update statistics display elements
   */
  private updateStatsDisplay(stats: StorageStats): void {
    if (this.elements.totalSnippets) {
      this.elements.totalSnippets.textContent = stats.totalSnippets.toString();
    }
    if (this.elements.storageUsed) {
      this.elements.storageUsed.textContent = this.formatBytes(
        stats.storageUsage.total,
      );
    }
    if (this.elements.lastSync) {
      this.elements.lastSync.textContent = stats.lastSync
        ? this.formatRelativeTime(stats.lastSync)
        : "Never";
    }
  }

  /**
   * Handle storage cleanup - remove invalid sources
   */
  async handleCleanupStorage(): Promise<CleanupResult> {
    try {
      this.setCleanupButtonState(true, "Cleaning...");

      // Get cleanup status first
      const status = await StorageCleanup.getCleanupStatus();

      if (!status.needsCleanup) {
        this.showStatus("No cleanup needed - all sources are valid", "success");
        return { cleaned: 0, errors: [] };
      }

      // Show what will be cleaned
      const message = `This will clean up:\n${status.recommendations.join("\n")}\n\nContinue?`;
      if (!confirm(message)) {
        return { cleaned: 0, errors: [] };
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

      return result;
    } catch (error) {
      console.error("Storage cleanup failed:", error);
      this.showStatus(
        `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      throw error;
    } finally {
      this.setCleanupButtonState(false, "Clean Up Invalid Sources");
    }
  }

  /**
   * Handle clear local data
   */
  async handleClearLocal(): Promise<void> {
    if (
      !confirm(
        "This will delete all local snippets and settings. This action cannot be undone. Continue?",
      )
    ) {
      return;
    }

    try {
      await ExtensionStorage.clearAll();
      this.showStatus("Local data cleared successfully", "success");
    } catch (error) {
      console.error("Failed to clear local data:", error);
      this.showStatus("Failed to clear local data", "error");
      throw error;
    }
  }

  /**
   * Handle reset all settings to defaults
   */
  async handleResetAll(): Promise<void> {
    if (!confirm("This will reset all settings to defaults. Continue?")) {
      return;
    }

    try {
      await SettingsMessages.updateSettings(DEFAULT_SETTINGS);
      this.showStatus("Settings reset to defaults", "success");
    } catch (error) {
      console.error("Failed to reset settings:", error);
      this.showStatus("Failed to reset settings", "error");
      throw error;
    }
  }

  /**
   * Handle data export
   */
  async handleExport(): Promise<void> {
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
      throw error;
    }
  }

  /**
   * Handle data import trigger
   */
  handleImport(): void {
    this.elements.importFileInput.click();
  }

  /**
   * Handle file import processing
   */
  async handleFileImport(): Promise<void> {
    const file = this.elements.importFileInput.files?.[0];
    if (!file) return;

    try {
      const content = await this.readFileAsText(file);
      await ExtensionStorage.importData(content);
      this.showStatus("Data imported successfully", "success");
    } catch (error) {
      console.error("Import failed:", error);
      this.showStatus(
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      throw error;
    }
  }

  /**
   * Get current storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const snippets = await SnippetMessages.getSnippets();
      const storageUsage = await ExtensionStorage.getStorageUsage();
      const lastSync = await ExtensionStorage.getLastSync();

      return {
        totalSnippets: snippets.length,
        storageUsage: {
          local: storageUsage.local,
          sync: storageUsage.sync,
          total: storageUsage.local + storageUsage.sync,
        },
        lastSync,
      };
    } catch (error) {
      console.error("Failed to get storage stats:", error);
      throw new Error("Failed to get storage statistics");
    }
  }

  /**
   * Get cleanup status without performing cleanup
   */
  async getCleanupStatus(): Promise<{
    needsCleanup: boolean;
    recommendations: string[];
  }> {
    try {
      return await StorageCleanup.getCleanupStatus();
    } catch (error) {
      console.error("Failed to get cleanup status:", error);
      throw new Error("Failed to get cleanup status");
    }
  }

  /**
   * Validate export data format
   */
  async validateExportData(): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const exportData = await ExtensionStorage.exportData();
      const data = JSON.parse(exportData);
      const errors: string[] = [];

      // Validate required properties
      if (!Object.prototype.hasOwnProperty.call(data, "settings")) {
        errors.push("Missing settings data");
      }
      if (!Object.prototype.hasOwnProperty.call(data, "snippets")) {
        errors.push("Missing snippets data");
      }
      if (!Object.prototype.hasOwnProperty.call(data, "version")) {
        errors.push("Missing version information");
      }

      // Validate snippets array
      if (data.snippets && !Array.isArray(data.snippets)) {
        errors.push("Snippets data is not an array");
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          `Export validation failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Get data size breakdown
   */
  async getDataSizeBreakdown(): Promise<{
    snippets: number;
    settings: number;
    cache: number;
    total: number;
  }> {
    try {
      const snippets = await SnippetMessages.getSnippets();
      const settings = await SettingsMessages.getSettings();

      const snippetsSize = new TextEncoder().encode(
        JSON.stringify(snippets),
      ).length;
      const settingsSize = new TextEncoder().encode(
        JSON.stringify(settings),
      ).length;

      const storageUsage = await ExtensionStorage.getStorageUsage();
      const cacheSize =
        storageUsage.local + storageUsage.sync - snippetsSize - settingsSize;

      return {
        snippets: snippetsSize,
        settings: settingsSize,
        cache: Math.max(0, cacheSize),
        total: storageUsage.local + storageUsage.sync,
      };
    } catch (error) {
      console.error("Failed to get data size breakdown:", error);
      throw new Error("Failed to get data size breakdown");
    }
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
   * Set cleanup button state
   */
  private setCleanupButtonState(disabled: boolean, text: string): void {
    this.elements.cleanupStorageButton.disabled = disabled;
    this.elements.cleanupStorageButton.textContent = text;
  }

  /**
   * Clear file input after processing
   */
  clearFileInput(): void {
    this.elements.importFileInput.value = "";
  }

  /**
   * Check if data needs cleanup
   */
  async needsCleanup(): Promise<boolean> {
    try {
      const status = await this.getCleanupStatus();
      return status.needsCleanup;
    } catch {
      return false;
    }
  }

  /**
   * Get estimated export file size
   */
  async getEstimatedExportSize(): Promise<number> {
    try {
      const exportData = await ExtensionStorage.exportData();
      return new TextEncoder().encode(exportData).length;
    } catch (error) {
      console.error("Failed to estimate export size:", error);
      return 0;
    }
  }
}
