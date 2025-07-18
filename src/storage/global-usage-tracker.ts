/**
 * Global Usage Tracker for PuffPuffPaste
 * Manages usage analytics in Google Drive appdata folder
 * Handles read-only scenarios gracefully with fallback strategies
 */

import type { EnhancedSnippet } from "../types/snippet-formats.js";

/**
 * Usage tracking entry structure
 */
export interface UsageTrackingEntry {
  id: string;
  trigger: string;
  preview40: string;
  usageCount: number;
  firstUsed: Date | null;
  lastUsed: Date | null;
  sourceStores: string[];
  contentType: string;
  tags: string[];
  scope: "personal" | "team" | "org";
  priority: number;
  isReadOnly: boolean;
  readOnlyStores: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Usage event entry structure
 */
export interface UsageEvent {
  eventId?: number;
  snippetId: string;
  eventType: "used" | "created" | "updated" | "deleted" | "read_only_attempt";
  timestamp: Date;
  context?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * Read-only access log entry
 */
export interface ReadOnlyAccessLog {
  logId?: number;
  storeId: string;
  operationType: "snippet_update" | "usage_track" | "db_write";
  attemptedAt: Date;
  errorDetails?: string;
  fallbackUsed?: string;
}

/**
 * Global usage tracker configuration
 */
export interface GlobalUsageTrackerConfig {
  enableFallbackMode: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableOfflineQueue: boolean;
  enableReadOnlyLogging: boolean;
}

/**
 * Default configuration for global usage tracker
 */
const DEFAULT_CONFIG: GlobalUsageTrackerConfig = {
  enableFallbackMode: true,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  enableOfflineQueue: true,
  enableReadOnlyLogging: true,
};

/**
 * Global Usage Tracker
 * Tracks snippet usage across all stores in Google Drive appdata
 */
export class GlobalUsageTracker {
  private config: GlobalUsageTrackerConfig;
  private dbConnection: any | null = null;
  private isReadOnly: boolean = false;
  private offlineQueue: UsageEvent[] = [];
  private initializationPromise: Promise<void> | null = null;

  constructor(config: Partial<GlobalUsageTrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the global usage tracker
   * Handles read-only scenarios gracefully
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  private async _performInitialization(): Promise<void> {
    try {
      console.log("🗄️ [GLOBAL-USAGE] Initializing global usage tracker...");

      // Try to initialize database connection
      await this._initializeDatabase();

      // Test write access
      await this._testWriteAccess();

      // Process any queued events
      if (this.offlineQueue.length > 0) {
        await this._processOfflineQueue();
      }

      console.log(
        "✅ [GLOBAL-USAGE] Global usage tracker initialized successfully",
      );
    } catch (error) {
      console.warn(
        "⚠️ [GLOBAL-USAGE] Failed to initialize with write access:",
        error,
      );

      if (this.config.enableFallbackMode) {
        await this._initializeFallbackMode();
      } else {
        throw error;
      }
    }
  }

  /**
   * Initialize database connection to Google Drive appdata
   */
  private async _initializeDatabase(): Promise<void> {
    try {
      // In a real implementation, this would connect to Google Drive API
      // For now, we'll simulate the connection
      console.log("🔗 [GLOBAL-USAGE] Connecting to Google Drive appdata...");

      // Mock database connection - replace with actual Google Drive API calls
      this.dbConnection = {
        connected: true,
        readOnly: false,
        lastSync: new Date(),
      };

      // Create tables if they don't exist
      await this._createTablesIfNeeded();
    } catch (error) {
      console.error("❌ [GLOBAL-USAGE] Database initialization failed:", error);
      throw error;
    }
  }

  /**
   * Create database tables if they don't exist
   */
  private async _createTablesIfNeeded(): Promise<void> {
    try {
      // In a real implementation, this would execute the SQL schema
      // For now, we'll simulate table creation
      console.log("🏗️ [GLOBAL-USAGE] Creating database tables...");

      // Mock table creation - replace with actual SQL execution
      const tables = [
        "global_snippet_usage",
        "global_usage_events",
        "read_only_access_log",
        "schema_version",
      ];

      for (const table of tables) {
        console.log(`📊 [GLOBAL-USAGE] Created table: ${table}`);
      }
    } catch (error) {
      console.error("❌ [GLOBAL-USAGE] Table creation failed:", error);
      throw error;
    }
  }

  /**
   * Test write access to the database
   */
  private async _testWriteAccess(): Promise<void> {
    try {
      // Test with a simple write operation
      const testEvent: UsageEvent = {
        snippetId: "test-write-access",
        eventType: "created",
        timestamp: new Date(),
        context: "write_access_test",
        success: true,
      };

      await this._writeUsageEvent(testEvent);

      // Clean up test data
      await this._cleanupTestData("test-write-access");

      this.isReadOnly = false;
      console.log("✅ [GLOBAL-USAGE] Write access confirmed");
    } catch (error) {
      console.warn(
        "⚠️ [GLOBAL-USAGE] Write access failed, enabling read-only mode:",
        error,
      );
      this.isReadOnly = true;

      if (this.config.enableReadOnlyLogging) {
        await this._logReadOnlyAccess("global_db", "db_write", error);
      }

      throw error;
    }
  }

  /**
   * Initialize fallback mode for read-only scenarios
   */
  private async _initializeFallbackMode(): Promise<void> {
    console.log("🔄 [GLOBAL-USAGE] Initializing fallback mode...");

    this.isReadOnly = true;

    // Set up offline queue for eventual synchronization
    if (this.config.enableOfflineQueue) {
      console.log(
        "📦 [GLOBAL-USAGE] Offline queue enabled for read-only fallback",
      );
    }

    // Try to at least read existing data
    try {
      await this._validateReadAccess();
      console.log("✅ [GLOBAL-USAGE] Read-only mode initialized successfully");
    } catch (error) {
      console.warn(
        "⚠️ [GLOBAL-USAGE] Complete fallback mode - no database access",
      );
    }
  }

  /**
   * Validate read access to the database
   */
  private async _validateReadAccess(): Promise<void> {
    try {
      // Test reading from the database
      await this._getRecentUsage(1);
      console.log("✅ [GLOBAL-USAGE] Read access confirmed");
    } catch (error) {
      console.warn("⚠️ [GLOBAL-USAGE] Read access failed:", error);
      throw error;
    }
  }

  /**
   * Track snippet usage
   * Handles read-only scenarios with graceful fallback
   */
  async trackUsage(snippet: EnhancedSnippet, context?: string): Promise<void> {
    // Validate input snippet
    if (!snippet || typeof snippet !== "object" || !snippet.id) {
      console.warn(
        "⚠️ [GLOBAL-USAGE] Invalid snippet provided - skipping tracking",
      );
      return;
    }

    try {
      await this.initialize();

      const usageEvent: UsageEvent = {
        snippetId: snippet.id,
        eventType: "used",
        timestamp: new Date(),
        context,
        userAgent: navigator.userAgent,
        success: true,
      };

      if (this.isReadOnly) {
        await this._handleReadOnlyUsageTracking(usageEvent);
      } else {
        await this._trackUsageWithRetry(snippet, usageEvent);
      }
    } catch (error) {
      console.error("❌ [GLOBAL-USAGE] Usage tracking failed:", error);

      if (this.config.enableOfflineQueue) {
        await this._queueUsageEvent(snippet, context);
      }
    }
  }

  /**
   * Track usage with retry logic
   */
  private async _trackUsageWithRetry(
    snippet: EnhancedSnippet,
    usageEvent: UsageEvent,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetryAttempts; attempt++) {
      try {
        await this._performUsageTracking(snippet, usageEvent);
        return; // Success
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `⚠️ [GLOBAL-USAGE] Usage tracking attempt ${attempt} failed:`,
          error,
        );

        if (attempt < this.config.maxRetryAttempts) {
          await this._delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    // All retries failed
    throw lastError;
  }

  /**
   * Perform the actual usage tracking
   */
  private async _performUsageTracking(
    snippet: EnhancedSnippet,
    usageEvent: UsageEvent,
  ): Promise<void> {
    try {
      // Update or create usage entry
      await this._upsertUsageEntry(snippet);

      // Log the usage event
      await this._writeUsageEvent(usageEvent);

      console.log(
        `📈 [GLOBAL-USAGE] Tracked usage for snippet: ${snippet.trigger}`,
      );
    } catch (error) {
      console.error(
        "❌ [GLOBAL-USAGE] Usage tracking operation failed:",
        error,
      );
      throw error;
    }
  }

  /**
   * Handle read-only usage tracking scenarios
   */
  private async _handleReadOnlyUsageTracking(
    usageEvent: UsageEvent,
  ): Promise<void> {
    console.log("📦 [GLOBAL-USAGE] Queuing usage event for read-only scenario");

    if (this.config.enableOfflineQueue) {
      this.offlineQueue.push(usageEvent);
    }

    if (this.config.enableReadOnlyLogging) {
      await this._logReadOnlyAccess(
        "global_db",
        "usage_track",
        "Database is read-only",
      );
    }
  }

  /**
   * Queue usage event for offline processing
   */
  private async _queueUsageEvent(
    snippet: EnhancedSnippet,
    context?: string,
  ): Promise<void> {
    const usageEvent: UsageEvent = {
      snippetId: snippet.id,
      eventType: "used",
      timestamp: new Date(),
      context: context || "offline_queue",
      success: false,
      errorMessage: "Queued for offline processing",
    };

    this.offlineQueue.push(usageEvent);
    console.log(
      `📦 [GLOBAL-USAGE] Queued usage event for ${snippet.trigger} (queue size: ${this.offlineQueue.length})`,
    );
  }

  /**
   * Process offline queue when connection is restored
   */
  private async _processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    console.log(
      `🔄 [GLOBAL-USAGE] Processing offline queue (${this.offlineQueue.length} events)`,
    );

    const events = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const event of events) {
      try {
        event.success = true;
        event.errorMessage = undefined;
        await this._writeUsageEvent(event);
      } catch (error) {
        console.warn(
          "⚠️ [GLOBAL-USAGE] Failed to process queued event:",
          error,
        );
        // Re-queue the event
        this.offlineQueue.push(event);
      }
    }

    console.log(
      `✅ [GLOBAL-USAGE] Processed offline queue. Remaining: ${this.offlineQueue.length}`,
    );
  }

  /**
   * Upsert usage entry in the database
   */
  private async _upsertUsageEntry(snippet: EnhancedSnippet): Promise<void> {
    // In a real implementation, this would execute SQL upsert
    console.log(
      `📊 [GLOBAL-USAGE] Upserting usage entry for ${snippet.trigger}`,
    );

    // Mock implementation - replace with actual database operations
    const entry: UsageTrackingEntry = {
      id: snippet.id,
      trigger: snippet.trigger,
      preview40: snippet.content.substring(0, 40),
      usageCount: 1, // This would be incremented in real implementation
      firstUsed: new Date(),
      lastUsed: new Date(),
      sourceStores: ["local"], // This would come from the snippet metadata
      contentType: snippet.contentType || "plaintext",
      tags: snippet.tags || [],
      scope: snippet.scope || "personal",
      priority: 0, // Calculated by database triggers
      isReadOnly: false, // This would be determined by store permissions
      readOnlyStores: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Simulate database upsert
    console.log("💾 [GLOBAL-USAGE] Usage entry upserted:", entry);
  }

  /**
   * Write usage event to the database
   */
  private async _writeUsageEvent(event: UsageEvent): Promise<void> {
    // In a real implementation, this would execute SQL insert
    console.log("📝 [GLOBAL-USAGE] Writing usage event:", event);

    // Mock implementation - replace with actual database operations
  }

  /**
   * Log read-only access attempt
   */
  private async _logReadOnlyAccess(
    storeId: string,
    operationType: "snippet_update" | "usage_track" | "db_write",
    error?: any,
  ): Promise<void> {
    const logEntry: ReadOnlyAccessLog = {
      storeId,
      operationType,
      attemptedAt: new Date(),
      errorDetails: error?.message || String(error),
      fallbackUsed: this.config.enableOfflineQueue ? "offline_queue" : "none",
    };

    console.log("📋 [GLOBAL-USAGE] Logging read-only access:", logEntry);

    // In a real implementation, this would be stored in the database
    // For now, we'll just log it
  }

  /**
   * Get recent usage data
   */
  async getRecentUsage(limit: number = 10): Promise<UsageTrackingEntry[]> {
    try {
      await this.initialize();
      return await this._getRecentUsage(limit);
    } catch (error) {
      console.error("❌ [GLOBAL-USAGE] Failed to get recent usage:", error);
      return [];
    }
  }

  private async _getRecentUsage(limit: number): Promise<UsageTrackingEntry[]> {
    // In a real implementation, this would query the database
    console.log(`📊 [GLOBAL-USAGE] Getting recent usage (limit: ${limit})`);

    // Mock implementation - replace with actual database query
    return [];
  }

  /**
   * Get most used snippets
   */
  async getMostUsed(limit: number = 10): Promise<UsageTrackingEntry[]> {
    try {
      await this.initialize();

      // In a real implementation, this would query the database
      console.log(
        `📈 [GLOBAL-USAGE] Getting most used snippets (limit: ${limit})`,
      );

      // Mock implementation
      return [];
    } catch (error) {
      console.error(
        "❌ [GLOBAL-USAGE] Failed to get most used snippets:",
        error,
      );
      return [];
    }
  }

  /**
   * Get usage statistics summary
   */
  async getUsageStats(): Promise<{
    totalSnippets: number;
    totalUsage: number;
    readOnlySnippets: number;
    queuedEvents: number;
    isReadOnlyMode: boolean;
  }> {
    try {
      await this.initialize();

      // In a real implementation, this would aggregate database data
      return {
        totalSnippets: 0,
        totalUsage: 0,
        readOnlySnippets: 0,
        queuedEvents: this.offlineQueue.length,
        isReadOnlyMode: this.isReadOnly,
      };
    } catch (error) {
      console.error("❌ [GLOBAL-USAGE] Failed to get usage stats:", error);
      return {
        totalSnippets: 0,
        totalUsage: 0,
        readOnlySnippets: 0,
        queuedEvents: this.offlineQueue.length,
        isReadOnlyMode: true,
      };
    }
  }

  /**
   * Force sync with remote database
   */
  async forceSync(): Promise<boolean> {
    try {
      console.log("🔄 [GLOBAL-USAGE] Forcing sync with remote database...");

      // Test write access again
      await this._testWriteAccess();

      // Process offline queue
      await this._processOfflineQueue();

      console.log("✅ [GLOBAL-USAGE] Force sync completed successfully");
      return true;
    } catch (error) {
      console.error("❌ [GLOBAL-USAGE] Force sync failed:", error);
      return false;
    }
  }

  /**
   * Clean up test data
   */
  private async _cleanupTestData(snippetId: string): Promise<void> {
    // In a real implementation, this would delete test records
    console.log(`🧹 [GLOBAL-USAGE] Cleaning up test data for ${snippetId}`);
  }

  /**
   * Utility function for delays
   */
  private async _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispose of the tracker and clean up resources
   */
  async dispose(): Promise<void> {
    try {
      // Process any remaining queued events
      if (this.offlineQueue.length > 0) {
        await this._processOfflineQueue();
      }

      // Close database connection
      if (this.dbConnection) {
        console.log("🔌 [GLOBAL-USAGE] Closing database connection");
        this.dbConnection = null;
      }

      console.log("✅ [GLOBAL-USAGE] Global usage tracker disposed");
    } catch (error) {
      console.error("❌ [GLOBAL-USAGE] Error during disposal:", error);
    }
  }
}

// Export singleton instance
export const globalUsageTracker = new GlobalUsageTracker();
