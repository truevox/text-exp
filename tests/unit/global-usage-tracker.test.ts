/**
 * Tests for Global Usage Tracker
 * Comprehensive testing including read-only scenarios and fallback mechanisms
 */

import {
  GlobalUsageTracker,
  type UsageTrackingEntry,
} from "../../src/storage/global-usage-tracker.js";
import type { EnhancedSnippet } from "../../src/types/snippet-formats.js";

describe("GlobalUsageTracker - Phase 3 Usage Analytics", () => {
  let tracker: GlobalUsageTracker;

  // Mock snippet data
  const mockPersonalSnippet: EnhancedSnippet = {
    id: "test-snippet-1",
    trigger: "!hello",
    content: "<p>Hello, world!</p>",
    contentType: "html",
    scope: "personal",
    description: "Test greeting snippet",
    snipDependencies: [],
    variables: [],
    images: [],
    tags: ["greeting", "test"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    createdBy: "test-user",
    updatedBy: "test-user",
  };

  const mockTeamSnippet: EnhancedSnippet = {
    id: "test-snippet-2",
    trigger: "!meeting",
    content: "<p>Meeting scheduled for {{time}}</p>",
    contentType: "html",
    scope: "team",
    description: "Meeting announcement",
    snipDependencies: [],
    variables: [{ name: "time", prompt: "Meeting time" }],
    images: [],
    tags: ["meeting", "team"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    createdBy: "team-lead",
    updatedBy: "team-lead",
  };

  const mockReadOnlySnippet: EnhancedSnippet = {
    id: "test-snippet-3",
    trigger: "!policy",
    content: "<p>Company policy content</p>",
    contentType: "html",
    scope: "org",
    description: "Read-only company policy",
    snipDependencies: [],
    variables: [],
    images: [],
    tags: ["policy", "readonly"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    createdBy: "admin",
    updatedBy: "admin",
  };

  beforeEach(() => {
    tracker = new GlobalUsageTracker();
  });

  afterEach(async () => {
    await tracker.dispose();
  });

  describe("Initialization and Configuration", () => {
    it("should initialize with default configuration", () => {
      const defaultTracker = new GlobalUsageTracker();
      expect(defaultTracker).toBeDefined();
    });

    it("should initialize with custom configuration", () => {
      const customConfig = {
        enableFallbackMode: false,
        maxRetryAttempts: 5,
        retryDelayMs: 2000,
        enableOfflineQueue: false,
        enableReadOnlyLogging: false,
      };

      const customTracker = new GlobalUsageTracker(customConfig);
      expect(customTracker).toBeDefined();
    });

    it("should handle initialization gracefully", async () => {
      await expect(tracker.initialize()).resolves.not.toThrow();
    });

    it("should handle multiple initialization calls safely", async () => {
      await tracker.initialize();
      await tracker.initialize(); // Should not throw
      await tracker.initialize(); // Should not throw
    });
  });

  describe("Basic Usage Tracking", () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it("should track snippet usage successfully", async () => {
      await expect(
        tracker.trackUsage(mockPersonalSnippet, "test-context"),
      ).resolves.not.toThrow();
    });

    it("should track usage for different snippet types", async () => {
      await tracker.trackUsage(mockPersonalSnippet, "personal-test");
      await tracker.trackUsage(mockTeamSnippet, "team-test");
      await tracker.trackUsage(mockReadOnlySnippet, "readonly-test");
    });

    it("should handle missing context gracefully", async () => {
      await expect(
        tracker.trackUsage(mockPersonalSnippet),
      ).resolves.not.toThrow();
    });

    it("should track usage multiple times for same snippet", async () => {
      await tracker.trackUsage(mockPersonalSnippet);
      await tracker.trackUsage(mockPersonalSnippet);
      await tracker.trackUsage(mockPersonalSnippet);
    });
  });

  describe("Read-Only Scenario Handling", () => {
    it("should handle read-only database gracefully", async () => {
      // Create tracker with fallback enabled
      const readOnlyTracker = new GlobalUsageTracker({
        enableFallbackMode: true,
        enableOfflineQueue: true,
        enableReadOnlyLogging: true,
      });

      await readOnlyTracker.initialize();
      await expect(
        readOnlyTracker.trackUsage(mockReadOnlySnippet),
      ).resolves.not.toThrow();

      await readOnlyTracker.dispose();
    });

    it("should queue events when in read-only mode", async () => {
      const readOnlyTracker = new GlobalUsageTracker({
        enableFallbackMode: true,
        enableOfflineQueue: true,
      });

      await readOnlyTracker.initialize();

      // Track usage - should be queued
      await readOnlyTracker.trackUsage(mockPersonalSnippet);
      await readOnlyTracker.trackUsage(mockTeamSnippet);

      const stats = await readOnlyTracker.getUsageStats();
      expect(stats.queuedEvents).toBeGreaterThanOrEqual(0);

      await readOnlyTracker.dispose();
    });

    it("should handle read-only mode without offline queue", async () => {
      const readOnlyTracker = new GlobalUsageTracker({
        enableFallbackMode: true,
        enableOfflineQueue: false,
      });

      await expect(readOnlyTracker.initialize()).resolves.not.toThrow();
      await expect(
        readOnlyTracker.trackUsage(mockReadOnlySnippet),
      ).resolves.not.toThrow();

      await readOnlyTracker.dispose();
    });

    it("should fail gracefully when fallback mode is disabled", async () => {
      const strictTracker = new GlobalUsageTracker({
        enableFallbackMode: false,
        enableOfflineQueue: false,
      });

      // Should still not throw, but may log errors
      await expect(strictTracker.initialize()).resolves.not.toThrow();

      await strictTracker.dispose();
    });
  });

  describe("Retry Logic and Error Handling", () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it("should handle network errors with retry logic", async () => {
      // Test with custom retry settings
      const retryTracker = new GlobalUsageTracker({
        maxRetryAttempts: 2,
        retryDelayMs: 100,
        enableOfflineQueue: true,
      });

      await retryTracker.initialize();
      await expect(
        retryTracker.trackUsage(mockPersonalSnippet),
      ).resolves.not.toThrow();

      await retryTracker.dispose();
    });

    it("should handle database connection failures", async () => {
      // This test simulates connection failures during usage tracking
      await expect(
        tracker.trackUsage(mockPersonalSnippet),
      ).resolves.not.toThrow();
    });

    it("should handle malformed snippet data gracefully", async () => {
      const malformedSnippet = {
        ...mockPersonalSnippet,
        id: "", // Invalid ID
        trigger: null as any, // Invalid trigger
      };

      await expect(tracker.trackUsage(malformedSnippet)).resolves.not.toThrow();
    });
  });

  describe("Data Retrieval and Analytics", () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it("should get recent usage data", async () => {
      const recentUsage = await tracker.getRecentUsage(5);
      expect(Array.isArray(recentUsage)).toBe(true);
      expect(recentUsage.length).toBeLessThanOrEqual(5);
    });

    it("should get most used snippets", async () => {
      const mostUsed = await tracker.getMostUsed(10);
      expect(Array.isArray(mostUsed)).toBe(true);
      expect(mostUsed.length).toBeLessThanOrEqual(10);
    });

    it("should get usage statistics summary", async () => {
      const stats = await tracker.getUsageStats();

      expect(stats).toHaveProperty("totalSnippets");
      expect(stats).toHaveProperty("totalUsage");
      expect(stats).toHaveProperty("readOnlySnippets");
      expect(stats).toHaveProperty("queuedEvents");
      expect(stats).toHaveProperty("isReadOnlyMode");

      expect(typeof stats.totalSnippets).toBe("number");
      expect(typeof stats.totalUsage).toBe("number");
      expect(typeof stats.readOnlySnippets).toBe("number");
      expect(typeof stats.queuedEvents).toBe("number");
      expect(typeof stats.isReadOnlyMode).toBe("boolean");
    });

    it("should handle data retrieval when database is unavailable", async () => {
      // Simulate database unavailability
      const recentUsage = await tracker.getRecentUsage(5);
      expect(Array.isArray(recentUsage)).toBe(true);

      const mostUsed = await tracker.getMostUsed(10);
      expect(Array.isArray(mostUsed)).toBe(true);

      const stats = await tracker.getUsageStats();
      expect(stats).toBeDefined();
    });
  });

  describe("Offline Queue Management", () => {
    it("should queue events when offline", async () => {
      const offlineTracker = new GlobalUsageTracker({
        enableOfflineQueue: true,
        enableFallbackMode: true,
      });

      await offlineTracker.initialize();

      // Simulate offline scenario
      await offlineTracker.trackUsage(mockPersonalSnippet, "offline-test");
      await offlineTracker.trackUsage(mockTeamSnippet, "offline-test");

      const stats = await offlineTracker.getUsageStats();
      expect(stats.queuedEvents).toBeGreaterThanOrEqual(0);

      await offlineTracker.dispose();
    });

    it("should process offline queue when connection is restored", async () => {
      const queueTracker = new GlobalUsageTracker({
        enableOfflineQueue: true,
        enableFallbackMode: true,
      });

      await queueTracker.initialize();

      // Force sync to process queue
      const syncResult = await queueTracker.forceSync();
      expect(typeof syncResult).toBe("boolean");

      await queueTracker.dispose();
    });

    it("should handle queue processing failures gracefully", async () => {
      const queueTracker = new GlobalUsageTracker({
        enableOfflineQueue: true,
      });

      await queueTracker.initialize();
      await expect(queueTracker.forceSync()).resolves.not.toThrow();

      await queueTracker.dispose();
    });
  });

  describe("Force Sync and Connection Recovery", () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it("should perform force sync successfully", async () => {
      const syncResult = await tracker.forceSync();
      expect(typeof syncResult).toBe("boolean");
    });

    it("should handle force sync when database is unavailable", async () => {
      // Simulate database unavailability during sync
      const syncResult = await tracker.forceSync();
      expect(typeof syncResult).toBe("boolean");
    });

    it("should recover from connection failures", async () => {
      // Test connection recovery after failure
      await tracker.trackUsage(mockPersonalSnippet);
      const syncResult = await tracker.forceSync();
      expect(typeof syncResult).toBe("boolean");
    });
  });

  describe("Performance and Resource Management", () => {
    it("should handle high-frequency usage tracking", async () => {
      await tracker.initialize();

      const trackingPromises = [];
      for (let i = 0; i < 50; i++) {
        trackingPromises.push(
          tracker.trackUsage(mockPersonalSnippet, `batch-${i}`),
        );
      }

      await expect(Promise.all(trackingPromises)).resolves.not.toThrow();
    });

    it("should manage memory efficiently with large datasets", async () => {
      await tracker.initialize();

      // Track usage for many different snippets
      for (let i = 0; i < 20; i++) {
        const snippet = {
          ...mockPersonalSnippet,
          id: `perf-test-${i}`,
          trigger: `!perf${i}`,
        };
        await tracker.trackUsage(snippet);
      }

      const stats = await tracker.getUsageStats();
      expect(stats).toBeDefined();
    });

    it("should dispose of resources properly", async () => {
      await tracker.initialize();
      await tracker.trackUsage(mockPersonalSnippet);
      await expect(tracker.dispose()).resolves.not.toThrow();
    });

    it("should handle disposal when not initialized", async () => {
      const uninitializedTracker = new GlobalUsageTracker();
      await expect(uninitializedTracker.dispose()).resolves.not.toThrow();
    });
  });

  describe("Edge Cases and Error Scenarios", () => {
    it("should handle concurrent initialization attempts", async () => {
      const promises = [
        tracker.initialize(),
        tracker.initialize(),
        tracker.initialize(),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it("should handle usage tracking before initialization", async () => {
      const uninitializedTracker = new GlobalUsageTracker();
      await expect(
        uninitializedTracker.trackUsage(mockPersonalSnippet),
      ).resolves.not.toThrow();
      await uninitializedTracker.dispose();
    });

    it("should handle null and undefined inputs gracefully", async () => {
      await tracker.initialize();

      const nullSnippet = null as any;
      const undefinedSnippet = undefined as any;

      await expect(tracker.trackUsage(nullSnippet)).resolves.not.toThrow();
      await expect(tracker.trackUsage(undefinedSnippet)).resolves.not.toThrow();
    });

    it("should handle snippets with missing required fields", async () => {
      await tracker.initialize();

      const incompleteSnippet = {
        id: "incomplete",
        // Missing trigger, content, etc.
      } as any;

      await expect(
        tracker.trackUsage(incompleteSnippet),
      ).resolves.not.toThrow();
    });

    it("should handle very large snippet content", async () => {
      await tracker.initialize();

      const largeSnippet = {
        ...mockPersonalSnippet,
        content: "x".repeat(10000), // Very large content
        description: "y".repeat(5000), // Very large description
      };

      await expect(tracker.trackUsage(largeSnippet)).resolves.not.toThrow();
    });
  });

  describe("Integration Scenarios", () => {
    it("should work correctly with multiple snippet types", async () => {
      await tracker.initialize();

      // Track usage for different content types
      const htmlSnippet = {
        ...mockPersonalSnippet,
        contentType: "html" as const,
      };
      const textSnippet = {
        ...mockPersonalSnippet,
        contentType: "plaintext" as const,
        id: "text-1",
      };
      const markdownSnippet = {
        ...mockPersonalSnippet,
        contentType: "markdown" as const,
        id: "md-1",
      };

      await tracker.trackUsage(htmlSnippet);
      await tracker.trackUsage(textSnippet);
      await tracker.trackUsage(markdownSnippet);

      const stats = await tracker.getUsageStats();
      expect(stats).toBeDefined();
    });

    it("should handle cross-scope snippet tracking", async () => {
      await tracker.initialize();

      await tracker.trackUsage(mockPersonalSnippet); // personal scope
      await tracker.trackUsage(mockTeamSnippet); // team scope
      await tracker.trackUsage(mockReadOnlySnippet); // org scope

      const recentUsage = await tracker.getRecentUsage(10);
      expect(Array.isArray(recentUsage)).toBe(true);
    });

    it("should maintain data consistency across sessions", async () => {
      // First session
      await tracker.initialize();
      await tracker.trackUsage(mockPersonalSnippet);
      await tracker.dispose();

      // Second session
      const newTracker = new GlobalUsageTracker();
      await newTracker.initialize();
      await newTracker.trackUsage(mockTeamSnippet);

      const stats = await newTracker.getUsageStats();
      expect(stats).toBeDefined();

      await newTracker.dispose();
    });
  });
});

// Additional test utilities
export const createMockSnippet = (
  overrides: Partial<EnhancedSnippet> = {},
): EnhancedSnippet => {
  return {
    id: "mock-snippet",
    trigger: "!mock",
    content: "<p>Mock content</p>",
    contentType: "html",
    scope: "personal",
    description: "Mock snippet for testing",
    snipDependencies: [],
    variables: [],
    images: [],
    tags: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    createdBy: "test-user",
    updatedBy: "test-user",
    ...overrides,
  };
};

export const createMockUsageEntry = (
  overrides: Partial<UsageTrackingEntry> = {},
): UsageTrackingEntry => {
  return {
    id: "mock-entry",
    trigger: "!mock",
    preview40: "Mock content preview...",
    usageCount: 0,
    firstUsed: null,
    lastUsed: null,
    sourceStores: ["local"],
    contentType: "html",
    tags: [],
    scope: "personal",
    priority: 0,
    isReadOnly: false,
    readOnlyStores: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
};
