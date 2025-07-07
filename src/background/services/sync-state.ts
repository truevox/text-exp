/**
 * Sync State Manager
 * Manages synchronization state and auto-sync intervals
 */

export class SyncStateManager {
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Set sync in progress state
   */
  setSyncInProgress(inProgress: boolean): void {
    this.syncInProgress = inProgress;
  }

  /**
   * Start auto-sync with specified interval
   */
  startAutoSync(
    intervalMinutes: number,
    syncCallback: () => Promise<void>,
  ): void {
    this.stopAutoSync(); // Clear any existing interval

    if (intervalMinutes > 0) {
      this.syncInterval = setInterval(
        async () => {
          try {
            console.log("🔄 Auto-sync triggered");
            await syncCallback();
          } catch (error) {
            console.error("Auto-sync failed:", error);
          }
        },
        intervalMinutes * 60 * 1000,
      ); // Convert minutes to milliseconds

      console.log(
        `⏰ Auto-sync started with ${intervalMinutes} minute interval`,
      );
    }
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log("⏹️ Auto-sync stopped");
    }
  }

  /**
   * Get current auto-sync interval ID
   */
  getCurrentInterval(): NodeJS.Timeout | null {
    return this.syncInterval;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopAutoSync();
  }
}
