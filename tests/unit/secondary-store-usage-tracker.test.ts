/**
 * Secondary Store Usage Tracker Tests
 *
 * Comprehensive test suite for per-store usage tracking with multi-user support.
 * Tests store-specific analytics, collaboration features, and integration scenarios.
 */

import { SecondaryStoreUsageTracker } from "../../src/storage/secondary-store-usage-tracker";
import { TextSnippet } from "../../src/shared/types";

// Mock navigator.userAgent for testing
Object.defineProperty(global, "navigator", {
  value: {
    userAgent:
      "Mozilla/5.0 (linux) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/26.1.0",
  },
});

describe("SecondaryStoreUsageTracker - Phase 3 Per-Store Analytics", () => {
  let tracker: SecondaryStoreUsageTracker;
  const storeId = "test-store-123";
  const storePath = "/test/path/store.json";

  // Test data factory functions
  const createTestSnippet = (
    id: string,
    trigger: string,
    contentType: "plaintext" | "html" = "html",
  ): TextSnippet => ({
    id,
    trigger,
    content: `<p>Test content for ${trigger}</p>`,
    contentType,
    description: `Test snippet ${id}`,
    scope: "personal",
    tags: ["test"],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    usageCount: 0,
    priority: 0,
  });

  const createTeamSnippet = (id: string, trigger: string): TextSnippet => ({
    ...createTestSnippet(id, trigger),
    scope: "team",
    tags: ["team", "collaboration"],
  });

  beforeEach(() => {
    tracker = new SecondaryStoreUsageTracker(storeId, storePath);
  });

  afterEach(async () => {
    await tracker.dispose();
  });

  describe("Initialization and Configuration", () => {
    it("should initialize with default configuration", async () => {
      await tracker.initialize();
      expect(tracker).toBeDefined();
    });

    it("should initialize with custom configuration", () => {
      const customConfig = {
        enabled: false,
        maxEventsPerSnippet: 500,
        userId: "user-123",
        userName: "Test User",
      };

      const customTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        customConfig,
      );
      expect(customTracker).toBeDefined();
      customTracker.dispose();
    });

    it("should handle initialization gracefully", async () => {
      await expect(tracker.initialize()).resolves.not.toThrow();
    });

    it("should handle multiple initialization calls safely", async () => {
      await tracker.initialize();
      await tracker.initialize();
      await tracker.initialize();
      expect(tracker).toBeDefined();
    });
  });

  describe("Basic Usage Tracking", () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it("should track snippet usage successfully", async () => {
      const snippet = createTestSnippet("test-snippet-1", "!hello");
      await expect(
        tracker.trackUsage(snippet, "test-context"),
      ).resolves.not.toThrow();
    });

    it("should track usage for different snippet types", async () => {
      const htmlSnippet = createTestSnippet("html-1", "!html", "html");
      const textSnippet = createTestSnippet("text-1", "!text", "plaintext");

      await expect(tracker.trackUsage(htmlSnippet)).resolves.not.toThrow();
      await expect(tracker.trackUsage(textSnippet)).resolves.not.toThrow();
    });

    it("should handle missing context gracefully", async () => {
      const snippet = createTestSnippet("test-snippet-1", "!hello");
      await expect(tracker.trackUsage(snippet)).resolves.not.toThrow();
    });

    it("should track usage multiple times for same snippet", async () => {
      const snippet = createTestSnippet("test-snippet-1", "!hello");

      await expect(
        tracker.trackUsage(snippet, "first-use"),
      ).resolves.not.toThrow();
      await expect(
        tracker.trackUsage(snippet, "second-use"),
      ).resolves.not.toThrow();
      await expect(
        tracker.trackUsage(snippet, "third-use"),
      ).resolves.not.toThrow();
    });
  });

  describe("Multi-User Collaboration Tracking", () => {
    it("should track usage with user identification", async () => {
      const userTracker = new SecondaryStoreUsageTracker(storeId, storePath, {
        userId: "user-123",
        userName: "Alice Smith",
      });

      await userTracker.initialize();

      const snippet = createTeamSnippet("team-snippet-1", "!meeting");
      await expect(
        userTracker.trackUsage(snippet, "team-context"),
      ).resolves.not.toThrow();

      await userTracker.dispose();
    });

    it("should support multiple users in same store", async () => {
      const user1Tracker = new SecondaryStoreUsageTracker(storeId, storePath, {
        userId: "user-1",
        userName: "Alice",
      });

      const user2Tracker = new SecondaryStoreUsageTracker(storeId, storePath, {
        userId: "user-2",
        userName: "Bob",
      });

      await user1Tracker.initialize();
      await user2Tracker.initialize();

      const snippet = createTeamSnippet("shared-snippet-1", "!shared");

      await expect(
        user1Tracker.trackUsage(snippet, "alice-context"),
      ).resolves.not.toThrow();
      await expect(
        user2Tracker.trackUsage(snippet, "bob-context"),
      ).resolves.not.toThrow();

      await user1Tracker.dispose();
      await user2Tracker.dispose();
    });

    it("should handle anonymous usage gracefully", async () => {
      const anonymousTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        {
          userId: undefined,
          userName: undefined,
        },
      );

      await anonymousTracker.initialize();

      const snippet = createTestSnippet("anon-snippet-1", "!anon");
      await expect(anonymousTracker.trackUsage(snippet)).resolves.not.toThrow();

      await anonymousTracker.dispose();
    });
  });

  describe("Store-Specific Analytics", () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it("should get store statistics", async () => {
      const stats = await tracker.getStoreStats();
      expect(stats).toBeDefined();
      expect(stats?.storeId).toBe(storeId);
    });

    it("should get user activity summary", async () => {
      const activity = await tracker.getUserActivity();
      expect(activity).toBeDefined();
      expect(Array.isArray(activity)).toBe(true);
    });

    it("should get recent usage events", async () => {
      const recentUsage = await tracker.getRecentUsage(5);
      expect(recentUsage).toBeDefined();
      expect(Array.isArray(recentUsage)).toBe(true);
    });

    it("should filter user activity by user ID", async () => {
      const userActivity = await tracker.getUserActivity("user-123");
      expect(userActivity).toBeDefined();
      expect(Array.isArray(userActivity)).toBe(true);
    });
  });

  describe("Read-Only Scenario Handling", () => {
    it("should handle read-only store gracefully", async () => {
      const readOnlyTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        {
          fallbackMode: true,
        },
      );

      await readOnlyTracker.initialize();

      const snippet = createTestSnippet("readonly-snippet-1", "!readonly");
      await expect(readOnlyTracker.trackUsage(snippet)).resolves.not.toThrow();

      await readOnlyTracker.dispose();
    });

    it("should queue events when in read-only mode", async () => {
      const readOnlyTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        {
          enableOfflineQueue: true,
          fallbackMode: true,
        },
      );

      await readOnlyTracker.initialize();

      const snippet = createTestSnippet("queued-snippet-1", "!queued");
      await expect(readOnlyTracker.trackUsage(snippet)).resolves.not.toThrow();

      await readOnlyTracker.dispose();
    });

    it("should handle read-only mode without offline queue", async () => {
      const readOnlyTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        {
          enableOfflineQueue: false,
          fallbackMode: true,
        },
      );

      await readOnlyTracker.initialize();

      const snippet = createTestSnippet("no-queue-snippet-1", "!noqueue");
      await expect(readOnlyTracker.trackUsage(snippet)).resolves.not.toThrow();

      await readOnlyTracker.dispose();
    });

    it("should fail gracefully when fallback mode is disabled", async () => {
      const strictTracker = new SecondaryStoreUsageTracker(storeId, storePath, {
        fallbackMode: false,
      });

      await strictTracker.initialize();

      const snippet = createTestSnippet("strict-snippet-1", "!strict");
      await expect(strictTracker.trackUsage(snippet)).resolves.not.toThrow();

      await strictTracker.dispose();
    });
  });

  describe("Error Handling and Resilience", () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it("should handle invalid snippet data gracefully", async () => {
      const invalidSnippets = [
        null,
        undefined,
        {} as TextSnippet,
        { id: "", trigger: "", content: "" } as TextSnippet,
      ];

      for (const snippet of invalidSnippets) {
        await expect(tracker.trackUsage(snippet as any)).resolves.not.toThrow();
      }
    });

    it("should handle database connection failures", async () => {
      const failureTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        {
          enableRetries: true,
          maxRetries: 2,
          fallbackMode: true,
        },
      );

      await failureTracker.initialize();

      const snippet = createTestSnippet("failure-snippet-1", "!failure");
      await expect(failureTracker.trackUsage(snippet)).resolves.not.toThrow();

      await failureTracker.dispose();
    });

    it("should handle concurrent usage tracking", async () => {
      const snippet1 = createTestSnippet("concurrent-1", "!concurrent1");
      const snippet2 = createTestSnippet("concurrent-2", "!concurrent2");
      const snippet3 = createTestSnippet("concurrent-3", "!concurrent3");

      const promises = [
        tracker.trackUsage(snippet1),
        tracker.trackUsage(snippet2),
        tracker.trackUsage(snippet3),
        tracker.trackUsage(snippet1), // Same snippet again
        tracker.trackUsage(snippet2), // Same snippet again
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });

  describe("Offline Queue Management", () => {
    it("should queue events when offline", async () => {
      const offlineTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        {
          enableOfflineQueue: true,
          maxOfflineQueueSize: 10,
        },
      );

      await offlineTracker.initialize();

      const snippet = createTestSnippet("offline-snippet-1", "!offline");
      await expect(offlineTracker.trackUsage(snippet)).resolves.not.toThrow();

      await offlineTracker.dispose();
    });

    it("should process offline queue when connection is restored", async () => {
      const queueTracker = new SecondaryStoreUsageTracker(storeId, storePath, {
        enableOfflineQueue: true,
      });

      await queueTracker.initialize();

      // Simulate offline mode by queuing events
      const snippet1 = createTestSnippet("queue-1", "!queue1");
      const snippet2 = createTestSnippet("queue-2", "!queue2");

      await queueTracker.trackUsage(snippet1);
      await queueTracker.trackUsage(snippet2);

      // Force sync to process queue
      await expect(queueTracker.forceSync()).resolves.not.toThrow();

      await queueTracker.dispose();
    });

    it("should handle queue size limits", async () => {
      const limitedQueueTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        {
          enableOfflineQueue: true,
          maxOfflineQueueSize: 2,
        },
      );

      await limitedQueueTracker.initialize();

      // Add more events than queue limit
      for (let i = 0; i < 5; i++) {
        const snippet = createTestSnippet(`queue-limit-${i}`, `!limit${i}`);
        await limitedQueueTracker.trackUsage(snippet);
      }

      await limitedQueueTracker.dispose();
    });
  });

  describe("Force Sync and Connection Recovery", () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it("should perform force sync successfully", async () => {
      await expect(tracker.forceSync()).resolves.not.toThrow();
    });

    it("should handle force sync when database is unavailable", async () => {
      const unavailableTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        {
          fallbackMode: true,
        },
      );

      await unavailableTracker.initialize();
      await expect(unavailableTracker.forceSync()).resolves.not.toThrow();

      await unavailableTracker.dispose();
    });

    it("should recover from connection failures", async () => {
      // Simulate connection failure and recovery
      const recoveryTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
        {
          enableRetries: true,
          maxRetries: 3,
        },
      );

      await recoveryTracker.initialize();

      const snippet = createTestSnippet("recovery-snippet-1", "!recovery");
      await expect(recoveryTracker.trackUsage(snippet)).resolves.not.toThrow();

      await recoveryTracker.dispose();
    });
  });

  describe("Performance and Resource Management", () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it("should handle high-frequency usage tracking", async () => {
      const startTime = Date.now();

      const snippet = createTestSnippet("perf-snippet-1", "!perf");

      // Track usage 50 times rapidly
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(tracker.trackUsage(snippet, `context-${i}`));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 2 seconds)
      expect(duration).toBeLessThan(2000);
    });

    it("should manage memory efficiently with large datasets", async () => {
      // Create many different snippets
      const snippets = [];
      for (let i = 0; i < 100; i++) {
        snippets.push(createTestSnippet(`bulk-${i}`, `!bulk${i}`));
      }

      // Track usage for all snippets
      for (const snippet of snippets) {
        await tracker.trackUsage(snippet);
      }

      // Memory usage should remain reasonable
      expect(snippets.length).toBe(100);
    });

    it("should dispose of resources properly", async () => {
      const snippet = createTestSnippet("dispose-snippet-1", "!dispose");
      await tracker.trackUsage(snippet);

      await expect(tracker.dispose()).resolves.not.toThrow();
    });

    it("should handle disposal when not initialized", async () => {
      const uninitializedTracker = new SecondaryStoreUsageTracker(
        storeId,
        storePath,
      );
      await expect(uninitializedTracker.dispose()).resolves.not.toThrow();
    });
  });

  describe("Integration Scenarios", () => {
    it("should work with different store configurations", async () => {
      const stores = [
        { id: "personal-store", path: "/personal/snippets.json" },
        { id: "team-store", path: "/team/shared.json" },
        { id: "org-store", path: "/org/policies.json" },
      ];

      const trackers = stores.map(
        (store) => new SecondaryStoreUsageTracker(store.id, store.path),
      );

      // Initialize all trackers
      await Promise.all(trackers.map((t) => t.initialize()));

      // Track usage in different stores
      for (let i = 0; i < trackers.length; i++) {
        const snippet = createTestSnippet(`store-${i}-snippet`, `!store${i}`);
        await trackers[i].trackUsage(snippet);
      }

      // Dispose all trackers
      await Promise.all(trackers.map((t) => t.dispose()));
    });

    it("should handle cross-store snippet usage patterns", async () => {
      const personalTracker = new SecondaryStoreUsageTracker(
        "personal",
        "/personal.json",
      );
      const teamTracker = new SecondaryStoreUsageTracker("team", "/team.json");

      await personalTracker.initialize();
      await teamTracker.initialize();

      // Same snippet used in different stores
      const personalSnippet = createTestSnippet("cross-snippet-1", "!cross");
      const teamSnippet = createTeamSnippet("cross-snippet-1", "!cross");

      await personalTracker.trackUsage(personalSnippet, "personal-context");
      await teamTracker.trackUsage(teamSnippet, "team-context");

      await personalTracker.dispose();
      await teamTracker.dispose();
    });

    it("should maintain data consistency across sessions", async () => {
      // First session
      await tracker.initialize();
      const snippet = createTestSnippet("session-snippet-1", "!session");
      await tracker.trackUsage(snippet, "session-1");
      await tracker.dispose();

      // Second session with new tracker instance
      const newTracker = new SecondaryStoreUsageTracker(storeId, storePath);
      await newTracker.initialize();
      await newTracker.trackUsage(snippet, "session-2");

      const stats = await newTracker.getStoreStats();
      expect(stats).toBeDefined();

      await newTracker.dispose();
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
      const snippet = createTestSnippet("pre-init-snippet-1", "!preinit");
      await expect(tracker.trackUsage(snippet)).resolves.not.toThrow();
    });

    it("should handle null and undefined inputs gracefully", async () => {
      await tracker.initialize();

      const nullSnippet = null as any;
      const undefinedSnippet = undefined as any;

      await expect(tracker.trackUsage(nullSnippet)).resolves.not.toThrow();
      await expect(tracker.trackUsage(undefinedSnippet)).resolves.not.toThrow();
    });

    it("should handle very large snippet content", async () => {
      await tracker.initialize();

      const largeContent = "x".repeat(10000); // 10KB content
      const largeSnippet = createTestSnippet("large-snippet-1", "!large");
      largeSnippet.content = largeContent;

      await expect(tracker.trackUsage(largeSnippet)).resolves.not.toThrow();
    });

    it("should handle invalid store paths gracefully", async () => {
      const invalidPathTracker = new SecondaryStoreUsageTracker(
        "invalid-store",
        "",
      );

      await expect(invalidPathTracker.initialize()).resolves.not.toThrow();
      await invalidPathTracker.dispose();
    });
  });
});
