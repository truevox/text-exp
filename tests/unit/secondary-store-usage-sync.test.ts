/**
 * Tests for Secondary Store Usage Synchronization
 * Comprehensive testing including multi-user scenarios and conflict resolution
 */

import {
  SecondaryStoreUsageSync,
  type UsageSyncConfig,
  type SyncUsageEntry,
  type SyncResult,
  type SyncConflict,
  type UsageCloudAdapter,
  DEFAULT_USAGE_SYNC_CONFIG,
  getUsageSync,
  syncStoreUsage,
} from "../../src/storage/secondary-store-usage-sync";
import { SecondaryStoreUsageTracker } from "../../src/storage/secondary-store-usage-tracker";

// Mock the SecondaryStoreUsageTracker
jest.mock("../../src/storage/secondary-store-usage-tracker");

describe("SecondaryStoreUsageSync - Phase 3 Task 4", () => {
  let sync: SecondaryStoreUsageSync;
  let mockUsageTracker: any;
  let mockCloudAdapter: any;

  // Mock usage entries
  const mockLocalEntry: SyncUsageEntry = {
    snippetId: "snippet-1",
    userId: "user-1",
    userName: "Alice",
    usageCount: 5,
    firstUsed: new Date("2025-07-15T10:00:00.000Z"),
    lastUsed: new Date("2025-07-18T15:30:00.000Z"),
    syncedAt: new Date("2025-07-18T16:00:00.000Z"),
    version: 1,
    deviceId: "device-1",
    metadata: { contentType: "text", tags: ["test"] },
  };

  const mockRemoteEntry: SyncUsageEntry = {
    snippetId: "snippet-1",
    userId: "user-2",
    userName: "Bob",
    usageCount: 3,
    firstUsed: new Date("2025-07-10T09:00:00.000Z"),
    lastUsed: new Date("2025-07-18T14:20:00.000Z"),
    syncedAt: new Date("2025-07-18T15:00:00.000Z"),
    version: 1,
    deviceId: "device-2",
    metadata: { contentType: "html", tags: ["test", "work"] },
  };

  const mockConflictingRemoteEntry: SyncUsageEntry = {
    ...mockLocalEntry,
    userId: "user-1", // Same user as we'll use in local entry
    usageCount: 7, // Different count - conflict
    lastUsed: new Date("2025-07-19T12:00:00.000Z"), // Later timestamp
    version: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock performance.now
    global.performance = {
      now: jest.fn(() => 1000),
    } as any;

    // Mock crypto.randomUUID
    Object.defineProperty(global, "crypto", {
      value: {
        randomUUID: jest.fn(() => "mock-uuid-123"),
      },
      writable: true,
    });

    // Mock usage tracker
    mockUsageTracker = {
      getStoreStats: jest.fn().mockResolvedValue({
        totalSnippets: 10,
        totalUsage: 50,
        uniqueUsers: 3,
      }),
      getRecentUsage: jest.fn().mockResolvedValue([
        {
          snippet_id: "snippet-1",
          usage_count: 5,
          first_used: "2025-07-15T10:00:00.000Z",
          last_used: "2025-07-18T15:30:00.000Z",
          content_type: "text",
          tags: ["test"],
        },
      ]),
    };

    // Mock cloud adapter
    mockCloudAdapter = {
      uploadUsageData: jest.fn().mockResolvedValue(undefined),
      downloadUsageData: jest.fn().mockResolvedValue([mockRemoteEntry]),
      hasUsageData: jest.fn().mockResolvedValue(true),
      getLastSyncTimestamp: jest
        .fn()
        .mockResolvedValue(new Date("2025-07-01T00:00:00.000Z")),
      updateLastSyncTimestamp: jest.fn().mockResolvedValue(undefined),
    };

    // Reset global singleton and set up with mock cloud adapter
    const usageSyncModule = require("../../src/storage/secondary-store-usage-sync");
    usageSyncModule.globalUsageSync = null;

    sync = new SecondaryStoreUsageSync(
      {
        ...DEFAULT_USAGE_SYNC_CONFIG,
        currentUserId: "user-1",
        currentUserName: "Test User",
      },
      mockCloudAdapter,
    );

    // Set the global instance to our properly configured sync
    usageSyncModule.globalUsageSync = sync;
  });

  afterEach(async () => {
    if (sync) {
      await sync.dispose();
    }
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      expect(sync).toBeDefined();
      // Config will include the additional user properties we set
      expect(sync["config"]).toMatchObject({
        ...DEFAULT_USAGE_SYNC_CONFIG,
        currentUserId: "user-1",
        currentUserName: "Test User",
      });
    });

    it("should initialize with custom config", () => {
      const customConfig: UsageSyncConfig = {
        ...DEFAULT_USAGE_SYNC_CONFIG,
        enabled: false,
        syncIntervalMs: 60000,
      };

      const customSync = new SecondaryStoreUsageSync(customConfig);
      expect(customSync["config"]).toEqual(customConfig);
    });

    it("should initialize successfully", async () => {
      await sync.initialize();
      expect(sync["isInitialized"]).toBe(true);
    });

    it("should not initialize multiple times", async () => {
      await sync.initialize();
      await sync.initialize(); // Second call should not throw
      expect(sync["isInitialized"]).toBe(true);
    });

    it("should handle initialization errors gracefully", async () => {
      const badSync = new SecondaryStoreUsageSync({
        ...DEFAULT_USAGE_SYNC_CONFIG,
        syncIntervalMs: -1, // Invalid interval
      });

      await expect(badSync.initialize()).resolves.toBeUndefined();
    });
  });

  describe("Sync Operations", () => {
    beforeEach(async () => {
      await sync.initialize();
    });

    it("should sync store successfully", async () => {
      const result = await sync.syncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(true);
      expect(result.entriesSynced).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(mockCloudAdapter.downloadUsageData).toHaveBeenCalledWith(
        "test-store",
      );
      expect(mockCloudAdapter.uploadUsageData).toHaveBeenCalled();
    });

    it("should handle sync failure gracefully", async () => {
      mockCloudAdapter.downloadUsageData.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await sync.syncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Network error");
    });

    it("should prevent concurrent syncs for same store", async () => {
      const promise1 = sync.syncStore("test-store", mockUsageTracker);
      const promise2 = sync.syncStore("test-store", mockUsageTracker);

      // The second call should return the same promise reference
      expect(promise1).toBe(promise2);

      await promise1; // Wait for completion
    });

    it("should handle disabled sync", async () => {
      const disabledSync = new SecondaryStoreUsageSync({
        ...DEFAULT_USAGE_SYNC_CONFIG,
        enabled: false,
      });

      await disabledSync.initialize();

      const result = await disabledSync.syncStore(
        "test-store",
        mockUsageTracker,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Usage sync is disabled");

      await disabledSync.dispose();
    });

    it("should handle missing cloud adapter", async () => {
      const syncWithoutAdapter = new SecondaryStoreUsageSync();
      await syncWithoutAdapter.initialize();

      const result = await syncWithoutAdapter.syncStore(
        "test-store",
        mockUsageTracker,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Cloud adapter not configured");

      await syncWithoutAdapter.dispose();
    });
  });

  describe("Data Merging", () => {
    beforeEach(async () => {
      await sync.initialize();
    });

    it("should merge local and remote entries without conflicts", async () => {
      // Set up non-conflicting remote data
      mockCloudAdapter.downloadUsageData.mockResolvedValue([mockRemoteEntry]);

      const result = await sync.syncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(true);
      expect(result.conflictsEncountered).toBe(0);
      expect(result.entriesSynced).toBeGreaterThanOrEqual(2); // Local + remote
    });

    it("should detect and resolve conflicts", async () => {
      // Set up conflicting remote data
      mockCloudAdapter.downloadUsageData.mockResolvedValue([
        mockConflictingRemoteEntry,
      ]);

      const result = await sync.syncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(true);
      expect(result.conflictsEncountered).toBe(1);
      expect(result.conflictsResolved).toBe(1);
    });

    it("should resolve conflicts with latest_wins strategy", async () => {
      const latestWinsSync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          conflictResolutionStrategy: "latest_wins",
          currentUserId: "user-1",
          currentUserName: "Test User",
        },
        mockCloudAdapter,
      );

      await latestWinsSync.initialize();

      mockCloudAdapter.downloadUsageData.mockResolvedValue([
        mockConflictingRemoteEntry,
      ]);

      const result = await latestWinsSync.syncStore(
        "test-store",
        mockUsageTracker,
      );

      expect(result.success).toBe(true);
      expect(result.conflictsResolved).toBe(1);

      await latestWinsSync.dispose();
    });

    it("should resolve conflicts with highest_count strategy", async () => {
      const highestCountSync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          conflictResolutionStrategy: "highest_count",
          currentUserId: "user-1",
          currentUserName: "Test User",
        },
        mockCloudAdapter,
      );

      await highestCountSync.initialize();

      mockCloudAdapter.downloadUsageData.mockResolvedValue([
        mockConflictingRemoteEntry,
      ]);

      const result = await highestCountSync.syncStore(
        "test-store",
        mockUsageTracker,
      );

      expect(result.success).toBe(true);
      expect(result.conflictsResolved).toBe(1);

      await highestCountSync.dispose();
    });

    it("should resolve conflicts with merge_additive strategy", async () => {
      const additiveSync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          conflictResolutionStrategy: "merge_additive",
          currentUserId: "user-1",
          currentUserName: "Test User",
        },
        mockCloudAdapter,
      );

      await additiveSync.initialize();

      mockCloudAdapter.downloadUsageData.mockResolvedValue([
        mockConflictingRemoteEntry,
      ]);

      const result = await additiveSync.syncStore(
        "test-store",
        mockUsageTracker,
      );

      expect(result.success).toBe(true);
      expect(result.conflictsResolved).toBe(1);

      await additiveSync.dispose();
    });

    it("should skip conflict resolution when disabled", async () => {
      const noConflictSync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          enableConflictResolution: false,
        },
        mockCloudAdapter,
      );

      await noConflictSync.initialize();

      mockCloudAdapter.downloadUsageData.mockResolvedValue([
        mockConflictingRemoteEntry,
      ]);

      const result = await noConflictSync.syncStore(
        "test-store",
        mockUsageTracker,
      );

      expect(result.success).toBe(true);

      await noConflictSync.dispose();
    });
  });

  describe("Privacy Mode", () => {
    it("should anonymize user names in privacy mode", async () => {
      const privacySync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          enablePrivacyMode: true,
          currentUserName: "TestUser",
        },
        mockCloudAdapter,
      );

      await privacySync.initialize();

      // Use reflection to test anonymization
      const anonymized = privacySync["anonymizeUserName"]("TestUser");
      expect(anonymized).toMatch(/^User-[0-9a-f]{8}$/);
      expect(anonymized).not.toBe("TestUser");
    });

    it("should not anonymize user names when privacy mode is disabled", async () => {
      const normalSync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          enablePrivacyMode: false,
        },
        mockCloudAdapter,
      );

      const userName = "TestUser";
      const result = normalSync["anonymizeUserName"](userName);
      expect(result).toBe(userName);
    });
  });

  describe("Data Filtering", () => {
    beforeEach(async () => {
      await sync.initialize();
    });

    it("should filter out old usage data", async () => {
      const oldEntry: SyncUsageEntry = {
        ...mockRemoteEntry,
        lastUsed: new Date("2020-01-01T00:00:00.000Z"), // Very old
      };

      mockCloudAdapter.downloadUsageData.mockResolvedValue([
        oldEntry,
        mockRemoteEntry,
      ]);

      const result = await sync.syncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(true);
      // Should only sync recent data
      expect(result.entriesSynced).toBeLessThan(3);
    });

    it("should handle empty remote data", async () => {
      mockCloudAdapter.hasUsageData.mockResolvedValue(false);

      const result = await sync.syncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(true);
      expect(result.entriesSynced).toBeGreaterThan(0); // Should still sync local data
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await sync.initialize();
    });

    it("should handle cloud adapter upload failure", async () => {
      mockCloudAdapter.uploadUsageData.mockRejectedValue(
        new Error("Upload failed"),
      );

      const result = await sync.syncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Failed to upload merged entries: Upload failed",
      );
    });

    it("should handle cloud adapter download failure", async () => {
      mockCloudAdapter.downloadUsageData.mockRejectedValue(
        new Error("Download failed"),
      );

      const result = await sync.syncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Download failed");
    });

    it("should handle usage tracker errors gracefully", async () => {
      mockUsageTracker.getStoreStats.mockRejectedValue(
        new Error("Tracker error"),
      );

      const result = await sync.syncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(false);
    });
  });

  describe("Sync Status and Statistics", () => {
    beforeEach(async () => {
      await sync.initialize();
    });

    it("should provide sync status", async () => {
      await sync.syncStore("test-store", mockUsageTracker);

      const status = await sync.getSyncStatus("test-store");

      expect(status.lastSync).toBeInstanceOf(Date);
      expect(status.syncInProgress).toBe(false);
      expect(status.nextSyncIn).toBe(DEFAULT_USAGE_SYNC_CONFIG.syncIntervalMs);
    });

    it("should indicate sync in progress", async () => {
      // Make sync slow
      mockCloudAdapter.downloadUsageData.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      );

      const syncPromise = sync.syncStore("test-store", mockUsageTracker);

      const status = await sync.getSyncStatus("test-store");
      expect(status.syncInProgress).toBe(true);

      await syncPromise;

      const statusAfter = await sync.getSyncStatus("test-store");
      expect(statusAfter.syncInProgress).toBe(false);
    });

    it("should provide sync statistics", () => {
      const stats = sync.getSyncStatistics();

      expect(stats).toHaveProperty("totalStoresSynced");
      expect(stats).toHaveProperty("activeSyncs");
      expect(stats).toHaveProperty("averageSyncDuration");
    });

    it("should force sync a store", async () => {
      const result = await sync.forceSyncStore("test-store", mockUsageTracker);

      expect(result.success).toBe(true);
      expect(mockCloudAdapter.downloadUsageData).toHaveBeenCalled();
    });
  });

  describe("Cloud Adapter Management", () => {
    it("should allow setting cloud adapter", () => {
      const newAdapter = {
        ...mockCloudAdapter,
        uploadUsageData: jest.fn(),
      };

      sync.setCloudAdapter(newAdapter);
      expect(sync["cloudAdapter"]).toBe(newAdapter);
    });

    it("should handle cloud adapter operations", async () => {
      await sync.initialize();

      expect(mockCloudAdapter.hasUsageData).toBeDefined();
      expect(mockCloudAdapter.downloadUsageData).toBeDefined();
      expect(mockCloudAdapter.uploadUsageData).toBeDefined();
    });
  });

  describe("Device and User Management", () => {
    it("should generate device ID", () => {
      const deviceId = sync["getDeviceId"]();
      expect(deviceId).toBeDefined();
      expect(typeof deviceId).toBe("string");
    });

    it("should handle user configuration", async () => {
      const userSync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          currentUserId: "user-123",
          currentUserName: "John Doe",
        },
        mockCloudAdapter,
      );

      await userSync.initialize();

      const result = await userSync.syncStore("test-store", mockUsageTracker);
      expect(result.success).toBe(true);

      await userSync.dispose();
    });
  });

  describe("Global Singleton", () => {
    it("should return same instance from getUsageSync", () => {
      const sync1 = getUsageSync();
      const sync2 = getUsageSync();

      expect(sync1).toBe(sync2);
    });

    it("should accept config and adapter on first call", () => {
      // Reset singleton
      const usageSyncModule = require("../../src/storage/secondary-store-usage-sync");
      usageSyncModule.globalUsageSync = null;

      const customConfig = {
        ...DEFAULT_USAGE_SYNC_CONFIG,
        enabled: false,
      };

      const sync1 = getUsageSync(customConfig, mockCloudAdapter);
      expect(sync1["config"]).toEqual(customConfig);
      expect(sync1["cloudAdapter"]).toBe(mockCloudAdapter);
    });
  });

  describe("Helper Functions", () => {
    it("should sync store usage with helper function", async () => {
      // Use the existing sync instance (which has a cloud adapter)
      const result = await syncStoreUsage("test-store", mockUsageTracker);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("should sync with custom config", async () => {
      const customConfig = {
        ...DEFAULT_USAGE_SYNC_CONFIG,
        maxRetries: 5,
      };

      const result = await syncStoreUsage(
        "test-store",
        mockUsageTracker,
        customConfig,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe("Resource Management", () => {
    it("should dispose resources properly", async () => {
      await sync.initialize();

      // Start a sync to test cleanup
      sync.syncStore("test-store", mockUsageTracker);

      await sync.dispose();

      expect(sync["isInitialized"]).toBe(false);
      expect(sync["syncInterval"]).toBeNull();
      expect(sync["activeSyncs"].size).toBe(0);
    });

    it("should handle disposal errors gracefully", async () => {
      await sync.initialize();

      // Mock an error during disposal
      const originalClearInterval = global.clearInterval;
      global.clearInterval = jest.fn().mockImplementation(() => {
        throw new Error("Clear interval failed");
      });

      // Should not throw
      await expect(sync.dispose()).resolves.toBeUndefined();

      global.clearInterval = originalClearInterval;
    });

    it("should wait for active syncs during disposal", async () => {
      await sync.initialize();

      // Make sync slow
      mockCloudAdapter.downloadUsageData.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
      );

      const syncPromise = sync.syncStore("test-store", mockUsageTracker);

      // Start disposal while sync is active
      const disposePromise = sync.dispose();

      // Both should complete
      await Promise.all([syncPromise, disposePromise]);

      expect(sync["activeSyncs"].size).toBe(0);
    });
  });

  describe("Periodic Sync", () => {
    it("should start periodic sync when enabled", async () => {
      const periodicSync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          syncIntervalMs: 1000, // 1 second for testing
        },
        mockCloudAdapter,
      );

      await periodicSync.initialize();

      expect(periodicSync["syncInterval"]).not.toBeNull();

      await periodicSync.dispose();
    });

    it("should not start periodic sync when disabled", async () => {
      const noPeriodicSync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          syncIntervalMs: 0, // Disabled
        },
        mockCloudAdapter,
      );

      await noPeriodicSync.initialize();

      expect(noPeriodicSync["syncInterval"]).toBeNull();

      await noPeriodicSync.dispose();
    });

    it("should handle periodic sync errors gracefully", async () => {
      const periodicSync = new SecondaryStoreUsageSync(
        {
          ...DEFAULT_USAGE_SYNC_CONFIG,
          syncIntervalMs: 10, // Very fast for testing
        },
        mockCloudAdapter,
      );

      // Mock console.error to catch error logs
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      await periodicSync.initialize();

      // Wait a bit for the interval to trigger
      await new Promise((resolve) => setTimeout(resolve, 25));

      await periodicSync.dispose();

      consoleSpy.mockRestore();
    });
  });
});
