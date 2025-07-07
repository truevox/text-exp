/**
 * Notification Service
 * Handles showing notifications to users
 */

import { ExtensionStorage } from "../../shared/storage.js";

export class NotificationService {
  /**
   * Show notification to user if notifications are enabled
   */
  static async showNotification(message: string): Promise<void> {
    try {
      const settings = await ExtensionStorage.getSettings();

      if (settings.showNotifications) {
        if (chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon-48.png",
            title: "Text Expander",
            message,
          });
        } else {
          console.warn("chrome.notifications API not available.");
        }
      }
    } catch (error) {
      console.error("Failed to show notification:", error);
    }
  }

  /**
   * Show sync success notification
   */
  static async showSyncSuccess(snippetCount: number): Promise<void> {
    await this.showNotification(
      `Sync completed successfully! ${snippetCount} snippets synchronized.`,
    );
  }

  /**
   * Show sync error notification
   */
  static async showSyncError(error: string): Promise<void> {
    await this.showNotification(`Sync failed: ${error}`);
  }

  /**
   * Show authentication success notification
   */
  static async showAuthSuccess(provider: string): Promise<void> {
    await this.showNotification(`Successfully connected to ${provider}`);
  }

  /**
   * Show authentication error notification
   */
  static async showAuthError(provider: string, error: string): Promise<void> {
    await this.showNotification(`Failed to connect to ${provider}: ${error}`);
  }
}
