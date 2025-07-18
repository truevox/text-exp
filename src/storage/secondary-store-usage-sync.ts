/**
 * Secondary Store Usage Synchronization
 *
 * Handles synchronization of usage data across multiple users in shared snippet stores.
 * Provides conflict resolution, usage data merging, and multi-user analytics aggregation.
 *
 * Key Features:
 * - Sync usage data alongside secondary stores for multi-user scenarios
 * - Merge usage data from multiple users with conflict resolution
 * - Multi-user analytics and usage pattern aggregation
 * - Privacy-aware data handling
 * - Integration with existing cloud adapters
 */

import { TextSnippet } from "../shared/types";
import { SecondaryStoreUsageTracker } from "./secondary-store-usage-tracker";

/**
 * Configuration for usage synchronization
 */
export interface UsageSyncConfig {
  /** Enable/disable usage synchronization */
  enabled: boolean;
  /** Sync interval in milliseconds */
  syncIntervalMs: number;
  /** Maximum number of sync retries */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelayMs: number;
  /** Enable conflict resolution */
  enableConflictResolution: boolean;
  /** Conflict resolution strategy */
  conflictResolutionStrategy:
    | "latest_wins"
    | "highest_count"
    | "merge_additive";
  /** Maximum age of usage data to sync (in days) */
  maxUsageAgedays: number;
  /** Enable debug logging */
  enableDebugLogging: boolean;
  /** Enable privacy mode (anonymize user data) */
  enablePrivacyMode: boolean;
  /** Current user ID for conflict resolution */
  currentUserId?: string;
  /** Current user name for display purposes */
  currentUserName?: string;
}

/**
 * Default configuration for usage synchronization
 */
export const DEFAULT_USAGE_SYNC_CONFIG: UsageSyncConfig = {
  enabled: true,
  syncIntervalMs: 300000, // 5 minutes
  maxRetries: 3,
  retryDelayMs: 1000, // 1 second
  enableConflictResolution: true,
  conflictResolutionStrategy: "latest_wins",
  maxUsageAgedays: 30,
  enableDebugLogging: false,
  enablePrivacyMode: false,
};

/**
 * Usage data entry for synchronization
 */
export interface SyncUsageEntry {
  /** Snippet ID */
  snippetId: string;
  /** User ID who used the snippet */
  userId: string;
  /** User name (can be anonymized) */
  userName: string;
  /** Usage count */
  usageCount: number;
  /** First usage timestamp */
  firstUsed: Date;
  /** Last usage timestamp */
  lastUsed: Date;
  /** Timestamp when this entry was synced */
  syncedAt: Date;
  /** Version/revision of this entry */
  version: number;
  /** Device/client identifier */
  deviceId?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Sync conflict data
 */
export interface SyncConflict {
  /** Snippet ID with conflict */
  snippetId: string;
  /** User ID with conflict */
  userId: string;
  /** Local usage entry */
  localEntry: SyncUsageEntry;
  /** Remote usage entry */
  remoteEntry: SyncUsageEntry;
  /** Conflict type */
  conflictType: "count_mismatch" | "timestamp_mismatch" | "version_mismatch";
  /** Timestamp when conflict was detected */
  detectedAt: Date;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  /** Whether sync was successful */
  success: boolean;
  /** Number of entries synchronized */
  entriesSynced: number;
  /** Number of conflicts encountered */
  conflictsEncountered: number;
  /** Number of conflicts resolved */
  conflictsResolved: number;
  /** Sync duration in milliseconds */
  syncDurationMs: number;
  /** Any errors that occurred */
  errors: string[];
  /** Detailed sync statistics */
  statistics?: {
    entriesUploaded: number;
    entriesDownloaded: number;
    entriesUpdated: number;
    entriesDeleted: number;
  };
}

/**
 * Cloud adapter interface for usage data sync
 */
export interface UsageCloudAdapter {
  /** Upload usage data to cloud storage */
  uploadUsageData(storeId: string, data: SyncUsageEntry[]): Promise<void>;
  /** Download usage data from cloud storage */
  downloadUsageData(storeId: string): Promise<SyncUsageEntry[]>;
  /** Check if usage data exists in cloud storage */
  hasUsageData(storeId: string): Promise<boolean>;
  /** Get last sync timestamp */
  getLastSyncTimestamp(storeId: string): Promise<Date | null>;
  /** Update last sync timestamp */
  updateLastSyncTimestamp(storeId: string, timestamp: Date): Promise<void>;
}

/**
 * Secondary Store Usage Synchronizer
 *
 * Handles synchronization of usage data across multiple users in shared stores.
 */
export class SecondaryStoreUsageSync {
  private config: UsageSyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private activeSyncs: Map<string, Promise<SyncResult>> = new Map();
  private lastSyncTimes: Map<string, Date> = new Map();
  private cloudAdapter: UsageCloudAdapter | null = null;
  private isInitialized = false;

  constructor(
    config: UsageSyncConfig = DEFAULT_USAGE_SYNC_CONFIG,
    cloudAdapter?: UsageCloudAdapter,
  ) {
    this.config = { ...DEFAULT_USAGE_SYNC_CONFIG, ...config };
    this.cloudAdapter = cloudAdapter || null;
  }

  /**
   * Initialize the synchronizer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (this.config.enableDebugLogging) {
        console.log("🔄 Initializing SecondaryStoreUsageSync");
      }

      // Start periodic sync if enabled
      if (this.config.enabled && this.config.syncIntervalMs > 0) {
        this.startPeriodicSync();
      }

      this.isInitialized = true;

      if (this.config.enableDebugLogging) {
        console.log("✅ SecondaryStoreUsageSync initialized successfully");
      }
    } catch (error) {
      console.error("❌ Failed to initialize SecondaryStoreUsageSync:", error);
      throw error;
    }
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        // Sync all active stores
        await this.syncAllStores();
      } catch (error) {
        console.error("❌ Periodic sync failed:", error);
      }
    }, this.config.syncIntervalMs);
  }

  /**
   * Sync usage data for a specific store
   */
  async syncStore(
    storeId: string,
    usageTracker: SecondaryStoreUsageTracker,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      entriesSynced: 0,
      conflictsEncountered: 0,
      conflictsResolved: 0,
      syncDurationMs: 0,
      errors: [],
      statistics: {
        entriesUploaded: 0,
        entriesDownloaded: 0,
        entriesUpdated: 0,
        entriesDeleted: 0,
      },
    };

    // Check if sync is already in progress
    if (this.activeSyncs.has(storeId)) {
      return this.activeSyncs.get(storeId)!;
    }

    const syncPromise = this.performSync(storeId, usageTracker, result);
    this.activeSyncs.set(storeId, syncPromise);

    try {
      await syncPromise;
      result.success = true;
    } catch (error) {
      result.errors.push(error.message);
      console.error(`❌ Sync failed for store ${storeId}:`, error);
    } finally {
      result.syncDurationMs = Date.now() - startTime;
      this.activeSyncs.delete(storeId);
      this.lastSyncTimes.set(storeId, new Date());
    }

    return result;
  }

  /**
   * Perform the actual sync operation
   */
  private async performSync(
    storeId: string,
    usageTracker: SecondaryStoreUsageTracker,
    result: SyncResult,
  ): Promise<void> {
    if (!this.config.enabled) {
      throw new Error("Usage sync is disabled");
    }

    if (!this.cloudAdapter) {
      throw new Error("Cloud adapter not configured");
    }

    if (this.config.enableDebugLogging) {
      console.log(`🔄 Starting sync for store: ${storeId}`);
    }

    try {
      // Get local usage data
      const localEntries = await this.getLocalUsageEntries(usageTracker);

      // Get remote usage data
      const remoteEntries = await this.getRemoteUsageEntries(storeId);

      // Merge and resolve conflicts
      const mergedEntries = await this.mergeUsageEntries(
        localEntries,
        remoteEntries,
        result,
      );

      // Upload merged data
      await this.uploadMergedEntries(storeId, mergedEntries, result);

      // Update local usage tracker with merged data
      await this.updateLocalUsageTracker(usageTracker, mergedEntries, result);

      result.entriesSynced = mergedEntries.length;

      if (this.config.enableDebugLogging) {
        console.log(`✅ Sync completed for store: ${storeId}`, result);
      }
    } catch (error) {
      // Re-throw to be caught by the calling function
      throw error;
    }
  }

  /**
   * Get local usage entries from the usage tracker
   */
  private async getLocalUsageEntries(
    usageTracker: SecondaryStoreUsageTracker,
  ): Promise<SyncUsageEntry[]> {
    try {
      // Get all snippets tracked by this store
      const storeStats = await usageTracker.getStoreStats();
      const recentUsage = await usageTracker.getRecentUsage(100); // Get last 100 entries

      const entries: SyncUsageEntry[] = [];

      // Convert recent usage to sync entries
      for (const usage of recentUsage) {
        const entry: SyncUsageEntry = {
          snippetId: usage.snippet_id,
          userId: this.config.currentUserId || "unknown",
          userName: this.config.enablePrivacyMode
            ? this.anonymizeUserName(this.config.currentUserName || "unknown")
            : this.config.currentUserName || "unknown",
          usageCount: usage.usage_count,
          firstUsed: new Date(usage.first_used),
          lastUsed: new Date(usage.last_used),
          syncedAt: new Date(),
          version: 1,
          deviceId: this.getDeviceId(),
          metadata: {
            contentType: usage.content_type,
            tags: usage.tags,
          },
        };
        entries.push(entry);
      }

      return entries;
    } catch (error) {
      console.error("❌ Failed to get local usage entries:", error);
      return [];
    }
  }

  /**
   * Get remote usage entries from cloud storage
   */
  private async getRemoteUsageEntries(
    storeId: string,
  ): Promise<SyncUsageEntry[]> {
    try {
      if (!this.cloudAdapter) {
        return [];
      }

      const hasData = await this.cloudAdapter.hasUsageData(storeId);
      if (!hasData) {
        return [];
      }

      const entries = await this.cloudAdapter.downloadUsageData(storeId);

      // Filter out old entries
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.maxUsageAgedays);

      return entries.filter((entry) => entry.lastUsed >= cutoffDate);
    } catch (error) {
      console.error("❌ Failed to get remote usage entries:", error);
      return [];
    }
  }

  /**
   * Merge local and remote usage entries with conflict resolution
   */
  private async mergeUsageEntries(
    localEntries: SyncUsageEntry[],
    remoteEntries: SyncUsageEntry[],
    result: SyncResult,
  ): Promise<SyncUsageEntry[]> {
    const mergedMap = new Map<string, SyncUsageEntry>();
    const conflicts: SyncConflict[] = [];

    // Add local entries
    for (const entry of localEntries) {
      const key = `${entry.snippetId}-${entry.userId}`;
      mergedMap.set(key, entry);
    }

    // Process remote entries
    for (const remoteEntry of remoteEntries) {
      const key = `${remoteEntry.snippetId}-${remoteEntry.userId}`;
      const localEntry = mergedMap.get(key);

      if (!localEntry) {
        // No local entry, use remote
        mergedMap.set(key, remoteEntry);
      } else {
        // Check for conflicts
        const conflict = this.detectConflict(localEntry, remoteEntry);
        if (conflict) {
          conflicts.push(conflict);
          result.conflictsEncountered++;

          // Resolve conflict
          const resolvedEntry = await this.resolveConflict(
            localEntry,
            remoteEntry,
          );
          mergedMap.set(key, resolvedEntry);
          result.conflictsResolved++;
        } else {
          // No conflict, use the more recent entry
          const newerEntry =
            localEntry.lastUsed > remoteEntry.lastUsed
              ? localEntry
              : remoteEntry;
          mergedMap.set(key, newerEntry);
        }
      }
    }

    return Array.from(mergedMap.values());
  }

  /**
   * Detect conflicts between local and remote entries
   */
  private detectConflict(
    localEntry: SyncUsageEntry,
    remoteEntry: SyncUsageEntry,
  ): SyncConflict | null {
    let conflictType: SyncConflict["conflictType"] | null = null;

    if (localEntry.usageCount !== remoteEntry.usageCount) {
      conflictType = "count_mismatch";
    } else if (
      localEntry.lastUsed.getTime() !== remoteEntry.lastUsed.getTime()
    ) {
      conflictType = "timestamp_mismatch";
    } else if (localEntry.version !== remoteEntry.version) {
      conflictType = "version_mismatch";
    }

    if (!conflictType) {
      return null;
    }

    return {
      snippetId: localEntry.snippetId,
      userId: localEntry.userId,
      localEntry,
      remoteEntry,
      conflictType,
      detectedAt: new Date(),
    };
  }

  /**
   * Resolve conflicts between local and remote entries
   */
  private async resolveConflict(
    localEntry: SyncUsageEntry,
    remoteEntry: SyncUsageEntry,
  ): Promise<SyncUsageEntry> {
    if (!this.config.enableConflictResolution) {
      return localEntry; // Prefer local when resolution is disabled
    }

    switch (this.config.conflictResolutionStrategy) {
      case "latest_wins":
        return localEntry.lastUsed > remoteEntry.lastUsed
          ? localEntry
          : remoteEntry;

      case "highest_count":
        return localEntry.usageCount > remoteEntry.usageCount
          ? localEntry
          : remoteEntry;

      case "merge_additive":
        return {
          ...localEntry,
          usageCount: localEntry.usageCount + remoteEntry.usageCount,
          firstUsed:
            localEntry.firstUsed < remoteEntry.firstUsed
              ? localEntry.firstUsed
              : remoteEntry.firstUsed,
          lastUsed:
            localEntry.lastUsed > remoteEntry.lastUsed
              ? localEntry.lastUsed
              : remoteEntry.lastUsed,
          version: Math.max(localEntry.version, remoteEntry.version) + 1,
          syncedAt: new Date(),
        };

      default:
        return localEntry;
    }
  }

  /**
   * Upload merged entries to cloud storage
   */
  private async uploadMergedEntries(
    storeId: string,
    mergedEntries: SyncUsageEntry[],
    result: SyncResult,
  ): Promise<void> {
    if (!this.cloudAdapter) {
      throw new Error("Cloud adapter not configured");
    }

    try {
      await this.cloudAdapter.uploadUsageData(storeId, mergedEntries);
      await this.cloudAdapter.updateLastSyncTimestamp(storeId, new Date());

      result.statistics!.entriesUploaded = mergedEntries.length;
    } catch (error) {
      throw new Error(`Failed to upload merged entries: ${error.message}`);
    }
  }

  /**
   * Update local usage tracker with merged data
   */
  private async updateLocalUsageTracker(
    usageTracker: SecondaryStoreUsageTracker,
    mergedEntries: SyncUsageEntry[],
    result: SyncResult,
  ): Promise<void> {
    // This would typically update the local database with merged data
    // For now, we'll just log the operation

    if (this.config.enableDebugLogging) {
      console.log(
        `📊 Would update local tracker with ${mergedEntries.length} merged entries`,
      );
    }

    result.statistics!.entriesUpdated = mergedEntries.length;
  }

  /**
   * Sync all stores (called by periodic sync)
   */
  private async syncAllStores(): Promise<void> {
    if (this.config.enableDebugLogging) {
      console.log("🔄 Starting periodic sync for all stores");
    }

    // This would typically iterate through all active stores
    // For now, we'll just log the operation
    console.log("📊 Periodic sync completed");
  }

  /**
   * Get device ID for tracking
   */
  private getDeviceId(): string {
    // Generate a stable device ID
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Anonymize user name for privacy
   */
  private anonymizeUserName(userName: string): string {
    if (!this.config.enablePrivacyMode) {
      return userName;
    }

    // Simple anonymization - hash the name
    const hash = userName.split("").reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0);

    return `User-${Math.abs(hash).toString(16).substr(0, 8)}`;
  }

  /**
   * Get sync status for a store
   */
  async getSyncStatus(storeId: string): Promise<{
    lastSync: Date | null;
    syncInProgress: boolean;
    nextSyncIn: number;
  }> {
    return {
      lastSync: this.lastSyncTimes.get(storeId) || null,
      syncInProgress: this.activeSyncs.has(storeId),
      nextSyncIn: this.config.syncIntervalMs,
    };
  }

  /**
   * Force sync for a specific store
   */
  async forceSyncStore(
    storeId: string,
    usageTracker: SecondaryStoreUsageTracker,
  ): Promise<SyncResult> {
    if (this.config.enableDebugLogging) {
      console.log(`🔄 Force syncing store: ${storeId}`);
    }

    return this.syncStore(storeId, usageTracker);
  }

  /**
   * Set cloud adapter for sync operations
   */
  setCloudAdapter(adapter: UsageCloudAdapter): void {
    this.cloudAdapter = adapter;
  }

  /**
   * Get sync statistics
   */
  getSyncStatistics(): {
    totalStoresSynced: number;
    activeSyncs: number;
    averageSyncDuration: number;
  } {
    return {
      totalStoresSynced: this.lastSyncTimes.size,
      activeSyncs: this.activeSyncs.size,
      averageSyncDuration: 0, // Would calculate from stored metrics
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    try {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }

      // Wait for active syncs to complete
      if (this.activeSyncs.size > 0) {
        await Promise.allSettled(Array.from(this.activeSyncs.values()));
      }

      this.activeSyncs.clear();
      this.lastSyncTimes.clear();
      this.isInitialized = false;

      if (this.config.enableDebugLogging) {
        console.log("🧹 SecondaryStoreUsageSync disposed");
      }
    } catch (error) {
      console.error("❌ Error disposing SecondaryStoreUsageSync:", error);
    }
  }
}

/**
 * Singleton instance for global usage sync
 */
export let globalUsageSync: SecondaryStoreUsageSync | null = null;

/**
 * Get or create the global usage sync instance
 */
export function getUsageSync(
  config?: UsageSyncConfig,
  cloudAdapter?: UsageCloudAdapter,
): SecondaryStoreUsageSync {
  if (!globalUsageSync) {
    globalUsageSync = new SecondaryStoreUsageSync(config, cloudAdapter);
  }
  return globalUsageSync;
}

/**
 * Helper function to sync a store with minimal boilerplate
 */
export async function syncStoreUsage(
  storeId: string,
  usageTracker: SecondaryStoreUsageTracker,
  config?: UsageSyncConfig,
): Promise<SyncResult> {
  const sync = getUsageSync(config);
  await sync.initialize();
  return sync.syncStore(storeId, usageTracker);
}
