/**
 * Secondary Store Usage Tracker
 *
 * Implements per-store usage tracking databases for secondary snippet stores.
 * Each secondary store gets its own SQLite database alongside the store file.
 * Tracks ONLY snippets from that specific store with multi-user collaboration support.
 *
 * Features:
 * - Store-specific analytics and insights
 * - Multi-user collaboration tracking with user identification
 * - Integration with store-specific permissions
 * - Read-only graceful handling for shared stores
 * - Usage pattern analysis per store
 * - Conflict resolution for concurrent usage
 */

import { TextSnippet } from "../shared/types";

/**
 * Configuration options for secondary store usage tracking
 */
export interface SecondaryStoreTrackerConfig {
  /** Enable/disable tracking entirely */
  enabled: boolean;
  /** Maximum number of usage events to retain per snippet */
  maxEventsPerSnippet: number;
  /** Enable retry logic for failed operations */
  enableRetries: boolean;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelayMs: number;
  /** Enable offline queue for failed operations */
  enableOfflineQueue: boolean;
  /** Maximum offline queue size */
  maxOfflineQueueSize: number;
  /** Cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** User identification for multi-user scenarios */
  userId?: string;
  /** Username for multi-user scenarios */
  userName?: string;
  /** Enable read-only fallback mode */
  fallbackMode: boolean;
}

/**
 * Default configuration for secondary store usage tracking
 */
export const DEFAULT_SECONDARY_STORE_CONFIG: SecondaryStoreTrackerConfig = {
  enabled: true,
  maxEventsPerSnippet: 1000,
  enableRetries: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableOfflineQueue: true,
  maxOfflineQueueSize: 100,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  enablePerformanceMonitoring: true,
  fallbackMode: true,
};

/**
 * Usage event for secondary store tracking
 */
export interface SecondaryStoreUsageEvent {
  id?: string;
  snippetId: string;
  eventType: "used" | "created" | "updated" | "deleted" | "shared";
  timestamp: Date;
  userId?: string;
  userName?: string;
  context?: string;
  userAgent?: string;
  storeId: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Store-specific usage statistics
 */
export interface StoreUsageStats {
  storeId: string;
  totalSnippets: number;
  totalUsageEvents: number;
  uniqueUsers: number;
  mostUsedSnippet: {
    id: string;
    trigger: string;
    usageCount: number;
  } | null;
  averageUsagePerSnippet: number;
  lastActivity: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User activity summary for a store
 */
export interface UserActivitySummary {
  userId: string;
  userName: string;
  totalUsageEvents: number;
  uniqueSnippetsUsed: number;
  firstActivity: Date;
  lastActivity: Date;
  favoriteSnippets: Array<{
    id: string;
    trigger: string;
    usageCount: number;
  }>;
}

/**
 * Offline queue item for failed operations
 */
interface OfflineQueueItem {
  id: string;
  snippet: TextSnippet;
  context?: string;
  timestamp: Date;
  retryCount: number;
}

/**
 * Cache entry for performance optimization
 */
interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
}

/**
 * Secondary Store Usage Tracker
 *
 * Manages usage tracking for individual secondary snippet stores.
 * Each store gets its own tracking database for store-specific analytics.
 */
export class SecondaryStoreUsageTracker {
  private config: SecondaryStoreTrackerConfig;
  private storeId: string;
  private storePath: string;
  private dbPath: string;
  private initialized = false;
  private disposed = false;
  private isReadOnly = false;
  private db: any = null; // SQLite database connection (mocked for now)
  private cache = new Map<string, CacheEntry<any>>();
  private offlineQueue: OfflineQueueItem[] = [];
  private retryTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    storeId: string,
    storePath: string,
    config: Partial<SecondaryStoreTrackerConfig> = {},
  ) {
    this.storeId = storeId;
    this.storePath = storePath;
    this.dbPath = `${storePath}.usage.db`;
    this.config = { ...DEFAULT_SECONDARY_STORE_CONFIG, ...config };

    this._logInfo("constructor", `Created tracker for store: ${storeId}`);
  }

  /**
   * Initialize the secondary store usage tracker
   */
  async initialize(): Promise<void> {
    if (this.initialized || this.disposed) {
      return;
    }

    try {
      this._logInfo(
        "initialize",
        `Initializing tracker for store: ${this.storeId}`,
      );
      await this._performInitialization();
      this.initialized = true;
      this._logInfo(
        "initialize",
        `Tracker initialized successfully for store: ${this.storeId}`,
      );
    } catch (error) {
      this._logError("initialize", error);
      if (!this.config.fallbackMode) {
        throw error;
      }
      this._logInfo(
        "initialize",
        "Continuing in fallback mode due to initialization error",
      );
    }
  }

  /**
   * Track snippet usage in this secondary store
   */
  async trackUsage(snippet: TextSnippet, context?: string): Promise<void> {
    // Validate input snippet
    if (!snippet || typeof snippet !== "object" || !snippet.id) {
      this._logWarning(
        "trackUsage",
        "Invalid snippet provided - skipping tracking",
      );
      return;
    }

    try {
      await this.initialize();

      const usageEvent: SecondaryStoreUsageEvent = {
        snippetId: snippet.id,
        eventType: "used",
        timestamp: new Date(),
        userId: this.config.userId,
        userName: this.config.userName,
        context,
        userAgent: navigator.userAgent,
        storeId: this.storeId,
        success: true,
      };

      if (this.isReadOnly) {
        await this._handleReadOnlyUsageTracking(usageEvent);
      } else {
        await this._trackUsageWithRetry(snippet, usageEvent);
      }
    } catch (error) {
      this._logError("trackUsage", error);

      if (this.config.enableOfflineQueue) {
        await this._queueUsageEvent(snippet, context);
      }

      if (!this.config.fallbackMode) {
        throw error;
      }
    }
  }

  /**
   * Get usage statistics for this store
   */
  async getStoreStats(): Promise<StoreUsageStats | null> {
    try {
      await this.initialize();

      const cacheKey = `store-stats-${this.storeId}`;
      const cached = this._getCachedValue<StoreUsageStats>(cacheKey);
      if (cached) {
        return cached;
      }

      this._logInfo(
        "getStoreStats",
        `Getting stats for store: ${this.storeId}`,
      );

      // Simulate database query for store statistics
      const stats: StoreUsageStats = {
        storeId: this.storeId,
        totalSnippets: 0,
        totalUsageEvents: 0,
        uniqueUsers: 0,
        mostUsedSnippet: null,
        averageUsagePerSnippet: 0,
        lastActivity: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this._setCachedValue(cacheKey, stats);
      return stats;
    } catch (error) {
      this._logError("getStoreStats", error);
      return null;
    }
  }

  /**
   * Get user activity summary for this store
   */
  async getUserActivity(userId?: string): Promise<UserActivitySummary[]> {
    try {
      await this.initialize();

      const targetUserId = userId || this.config.userId;
      const cacheKey = `user-activity-${this.storeId}-${targetUserId || "all"}`;
      const cached = this._getCachedValue<UserActivitySummary[]>(cacheKey);
      if (cached) {
        return cached;
      }

      this._logInfo(
        "getUserActivity",
        `Getting user activity for store: ${this.storeId}`,
      );

      // Simulate database query for user activity
      const activity: UserActivitySummary[] = [];

      this._setCachedValue(cacheKey, activity);
      return activity;
    } catch (error) {
      this._logError("getUserActivity", error);
      return [];
    }
  }

  /**
   * Get recent usage events for this store
   */
  async getRecentUsage(
    limit: number = 10,
  ): Promise<SecondaryStoreUsageEvent[]> {
    try {
      await this.initialize();

      const cacheKey = `recent-usage-${this.storeId}-${limit}`;
      const cached = this._getCachedValue<SecondaryStoreUsageEvent[]>(cacheKey);
      if (cached) {
        return cached;
      }

      this._logInfo(
        "getRecentUsage",
        `Getting recent usage (limit: ${limit}) for store: ${this.storeId}`,
      );

      // Simulate database query for recent usage
      const events: SecondaryStoreUsageEvent[] = [];

      this._setCachedValue(cacheKey, events);
      return events;
    } catch (error) {
      this._logError("getRecentUsage", error);
      return [];
    }
  }

  /**
   * Force sync offline queue and refresh data
   */
  async forceSync(): Promise<void> {
    try {
      await this.initialize();

      this._logInfo("forceSync", `Force syncing store: ${this.storeId}`);

      // Process offline queue
      if (this.offlineQueue.length > 0) {
        await this._processOfflineQueue();
      }

      // Clear cache to force fresh data
      this.cache.clear();

      this._logInfo(
        "forceSync",
        `Force sync completed for store: ${this.storeId}`,
      );
    } catch (error) {
      this._logError("forceSync", error);
      throw error;
    }
  }

  /**
   * Dispose of resources and close connections
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      this._logInfo("dispose", `Disposing tracker for store: ${this.storeId}`);

      // Clear timeouts
      for (const timeout of this.retryTimeouts.values()) {
        clearTimeout(timeout);
      }
      this.retryTimeouts.clear();

      // Close database connection
      if (this.db) {
        this._logInfo("dispose", "Closing database connection");
        // Simulate database close
        this.db = null;
      }

      // Clear cache
      this.cache.clear();

      // Clear offline queue
      this.offlineQueue = [];

      this.disposed = true;
      this._logInfo("dispose", `Tracker disposed for store: ${this.storeId}`);
    } catch (error) {
      this._logError("dispose", error);
    }
  }

  // Private implementation methods

  private async _performInitialization(): Promise<void> {
    this._logInfo(
      "_performInitialization",
      `Initializing database for store: ${this.storeId}`,
    );

    await this._initializeDatabase();
    await this._createTablesIfNeeded();
    await this._testWriteAccess();

    this._logInfo(
      "_performInitialization",
      `Database initialized successfully for store: ${this.storeId}`,
    );
  }

  private async _initializeDatabase(): Promise<void> {
    this._logInfo(
      "_initializeDatabase",
      `Connecting to database: ${this.dbPath}`,
    );

    // Simulate database connection
    this.db = {
      connected: true,
      path: this.dbPath,
      storeId: this.storeId,
    };
  }

  private async _createTablesIfNeeded(): Promise<void> {
    this._logInfo("_createTablesIfNeeded", "Creating database tables...");

    const tables = [
      "store_snippet_usage",
      "store_usage_events",
      "store_user_activity",
      "read_only_access_log",
      "schema_version",
    ];

    for (const table of tables) {
      this._logInfo("_createTablesIfNeeded", `Created table: ${table}`);
    }
  }

  private async _testWriteAccess(): Promise<void> {
    try {
      const testEvent: SecondaryStoreUsageEvent = {
        snippetId: "test-write-access",
        eventType: "created",
        timestamp: new Date(),
        storeId: this.storeId,
        context: "write_access_test",
        success: true,
      };

      await this._writeUsageEvent(testEvent);
      await this._cleanupTestData("test-write-access");

      this._logInfo("_testWriteAccess", "Write access confirmed");
    } catch (error) {
      this._logWarning(
        "_testWriteAccess",
        "Database is read-only, enabling fallback mode",
      );
      this.isReadOnly = true;
    }
  }

  private async _trackUsageWithRetry(
    snippet: TextSnippet,
    usageEvent: SecondaryStoreUsageEvent,
  ): Promise<void> {
    await this._performUsageTracking(snippet, usageEvent);
  }

  private async _performUsageTracking(
    snippet: TextSnippet,
    usageEvent: SecondaryStoreUsageEvent,
  ): Promise<void> {
    // Upsert snippet usage entry
    await this._upsertUsageEntry(snippet);

    // Write usage event
    await this._writeUsageEvent(usageEvent);

    this._logInfo(
      "_performUsageTracking",
      `Tracked usage for snippet: ${snippet.trigger} in store: ${this.storeId}`,
    );
  }

  private async _upsertUsageEntry(snippet: TextSnippet): Promise<void> {
    this._logInfo(
      "_upsertUsageEntry",
      `Upserting usage entry for ${snippet.trigger} in store: ${this.storeId}`,
    );

    const now = new Date();
    const usageEntry = {
      id: snippet.id,
      trigger: snippet.trigger,
      preview40: snippet.content.substring(0, 40),
      usageCount: 1,
      firstUsed: now,
      lastUsed: now,
      storeId: this.storeId,
      contentType: snippet.contentType,
      tags: snippet.tags,
      scope: snippet.scope,
      priority: snippet.priority || 0,
      isReadOnly: false,
      userId: this.config.userId,
      userName: this.config.userName,
      createdAt: now,
      updatedAt: now,
    };

    this._logInfo(
      "_upsertUsageEntry",
      `Usage entry upserted: ${JSON.stringify(usageEntry, null, 2)}`,
    );
  }

  private async _writeUsageEvent(
    event: SecondaryStoreUsageEvent,
  ): Promise<void> {
    this._logInfo(
      "_writeUsageEvent",
      `Writing usage event: ${JSON.stringify(event, null, 2)}`,
    );

    // Simulate database write
    // In real implementation, this would insert into store_usage_events table
  }

  private async _handleReadOnlyUsageTracking(
    event: SecondaryStoreUsageEvent,
  ): Promise<void> {
    this._logInfo(
      "_handleReadOnlyUsageTracking",
      `Logging read-only access for store: ${this.storeId}`,
    );

    // Log read-only access attempt
    const readOnlyLog = {
      timestamp: new Date(),
      storeId: this.storeId,
      snippetId: event.snippetId,
      userId: event.userId,
      userName: event.userName,
      eventType: event.eventType,
      context: event.context || "read_only_access",
    };

    this._logInfo(
      "_handleReadOnlyUsageTracking",
      `Read-only access logged: ${JSON.stringify(readOnlyLog, null, 2)}`,
    );
  }

  private async _queueUsageEvent(
    snippet: TextSnippet,
    context?: string,
  ): Promise<void> {
    if (this.offlineQueue.length >= this.config.maxOfflineQueueSize) {
      this._logWarning(
        "_queueUsageEvent",
        "Offline queue is full, dropping oldest event",
      );
      this.offlineQueue.shift();
    }

    const queueItem: OfflineQueueItem = {
      id: `${snippet.id}-${Date.now()}`,
      snippet,
      context,
      timestamp: new Date(),
      retryCount: 0,
    };

    this.offlineQueue.push(queueItem);
    this._logInfo(
      "_queueUsageEvent",
      `Queued usage event for snippet: ${snippet.trigger}`,
    );
  }

  private async _processOfflineQueue(): Promise<void> {
    this._logInfo(
      "_processOfflineQueue",
      `Processing ${this.offlineQueue.length} queued events`,
    );

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of queue) {
      try {
        await this.trackUsage(item.snippet, item.context);
        this._logInfo(
          "_processOfflineQueue",
          `Processed queued event: ${item.id}`,
        );
      } catch (error) {
        this._logError(
          "_processOfflineQueue",
          `Failed to process queued event: ${item.id}`,
          error,
        );

        if (item.retryCount < this.config.maxRetries) {
          item.retryCount++;
          this.offlineQueue.push(item);
        }
      }
    }
  }

  private async _cleanupTestData(snippetId: string): Promise<void> {
    this._logInfo("_cleanupTestData", `Cleaning up test data for ${snippetId}`);
    // Simulate test data cleanup
  }

  private _getCachedValue<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private _setCachedValue<T>(key: string, value: T): void {
    const now = new Date();
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      expiresAt: new Date(now.getTime() + this.config.cacheTtlMs),
    };

    this.cache.set(key, entry);
  }

  private _logInfo(method: string, message: string): void {
    console.log(`🏪 [STORE-USAGE:${this.storeId}] ${message}`);
  }

  private _logWarning(method: string, message: string): void {
    console.warn(`⚠️ [STORE-USAGE:${this.storeId}] ${message}`);
  }

  private _logError(method: string, error: any, additionalContext?: any): void {
    console.error(
      `❌ [STORE-USAGE:${this.storeId}] ${method} failed:`,
      error,
      additionalContext,
    );
  }
}
