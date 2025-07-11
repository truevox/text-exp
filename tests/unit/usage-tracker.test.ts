/**
 * Unit tests for UsageTracker service
 * Tests usage tracking, priority-based sorting, and cyclic tabbing functionality
 */

import { UsageTracker } from "../../src/services/usage-tracker.js";
import { TextSnippet } from "../../src/shared/types.js";

describe("UsageTracker Service", () => {
  let usageTracker: UsageTracker;
  let mockSnippets: TextSnippet[];

  beforeEach(() => {
    usageTracker = new UsageTracker();
    mockSnippets = [
      {
        id: "snippet-1",
        trigger: ";hello",
        content: "Hello World!",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
        usageCount: 5,
        lastUsed: new Date("2023-01-15"),
        priority: 1, // High priority folder
        sourceFolder: "personal-folder",
        fileHash: "abc123",
      },
      {
        id: "snippet-2",
        trigger: ";hello",
        content: "Hello Team!",
        createdAt: new Date("2023-01-02"),
        updatedAt: new Date("2023-01-02"),
        usageCount: 10,
        lastUsed: new Date("2023-01-20"),
        priority: 2, // Medium priority folder
        sourceFolder: "team-folder",
        fileHash: "def456",
      },
      {
        id: "snippet-3",
        trigger: ";hello",
        content: "Hello Organization!",
        createdAt: new Date("2023-01-03"),
        updatedAt: new Date("2023-01-03"),
        usageCount: 15,
        lastUsed: new Date("2023-01-25"),
        priority: 3, // Low priority folder
        sourceFolder: "org-folder",
        fileHash: "ghi789",
      },
    ];
  });

  describe("Usage Tracking", () => {
    test("should track snippet usage and update timestamps", async () => {
      const snippet = mockSnippets[0];
      const initialUsageCount = snippet.usageCount || 0;
      const initialLastUsed = snippet.lastUsed;

      await usageTracker.trackUsage(snippet);

      expect(snippet.usageCount).toBe(initialUsageCount + 1);
      expect(snippet.lastUsed).toBeDefined();
      expect(snippet.lastUsed!.getTime()).toBeGreaterThan(initialLastUsed!.getTime());
    });

    test("should handle snippets without initial usage data", async () => {
      const snippet: TextSnippet = {
        id: "snippet-4",
        trigger: ";new",
        content: "New snippet",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await usageTracker.trackUsage(snippet);

      expect(snippet.usageCount).toBe(1);
      expect(snippet.lastUsed).toBeDefined();
    });

    test("should persist usage data to storage", async () => {
      const snippet = mockSnippets[0];
      const saveUsageDataSpy = jest.spyOn(usageTracker, 'saveUsageData');

      await usageTracker.trackUsage(snippet);

      expect(saveUsageDataSpy).toHaveBeenCalledWith(snippet);
    });
  });

  describe("Priority-Based Sorting", () => {
    test("should sort snippets by priority first, then usage count", () => {
      const sortedSnippets = usageTracker.sortByPriorityAndUsage(mockSnippets);

      // First snippet should be priority 1 (highest priority)
      expect(sortedSnippets[0].priority).toBe(1);
      expect(sortedSnippets[0].id).toBe("snippet-1");

      // Second snippet should be priority 2
      expect(sortedSnippets[1].priority).toBe(2);
      expect(sortedSnippets[1].id).toBe("snippet-2");

      // Third snippet should be priority 3 (lowest priority)
      expect(sortedSnippets[2].priority).toBe(3);
      expect(sortedSnippets[2].id).toBe("snippet-3");
    });

    test("should sort by usage count within same priority level", () => {
      const samePrioritySnippets: TextSnippet[] = [
        {
          id: "snippet-a",
          trigger: ";test",
          content: "Test A",
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 5,
          priority: 1,
        },
        {
          id: "snippet-b",
          trigger: ";test",
          content: "Test B",
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 10,
          priority: 1,
        },
        {
          id: "snippet-c",
          trigger: ";test",
          content: "Test C",
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 3,
          priority: 1,
        },
      ];

      const sortedSnippets = usageTracker.sortByPriorityAndUsage(samePrioritySnippets);

      // Should be sorted by usage count descending within same priority
      expect(sortedSnippets[0].usageCount).toBe(10);
      expect(sortedSnippets[1].usageCount).toBe(5);
      expect(sortedSnippets[2].usageCount).toBe(3);
    });
  });

  describe("Cyclic Tabbing", () => {
    test("should cycle through matching snippets in priority order", () => {
      const matchingSnippets = usageTracker.getMatchingSnippets(mockSnippets, ";hello");
      
      expect(matchingSnippets).toHaveLength(3);
      expect(matchingSnippets[0].id).toBe("snippet-1"); // Priority 1
      expect(matchingSnippets[1].id).toBe("snippet-2"); // Priority 2
      expect(matchingSnippets[2].id).toBe("snippet-3"); // Priority 3
    });

    test("should cycle to next snippet", () => {
      const matchingSnippets = usageTracker.getMatchingSnippets(mockSnippets, ";hello");
      
      let currentIndex = usageTracker.getCurrentCycleIndex();
      expect(currentIndex).toBe(0); // Start at first snippet

      const nextSnippet = usageTracker.cycleToNext(matchingSnippets);
      expect(nextSnippet.id).toBe("snippet-2"); // Should move to second snippet
      expect(usageTracker.getCurrentCycleIndex()).toBe(1);
    });

    test("should cycle back to first snippet after reaching end", () => {
      const matchingSnippets = usageTracker.getMatchingSnippets(mockSnippets, ";hello");
      
      // Cycle to last snippet
      usageTracker.cycleToNext(matchingSnippets);
      usageTracker.cycleToNext(matchingSnippets);
      expect(usageTracker.getCurrentCycleIndex()).toBe(2);

      // Cycle once more should return to first
      const firstSnippet = usageTracker.cycleToNext(matchingSnippets);
      expect(firstSnippet.id).toBe("snippet-1");
      expect(usageTracker.getCurrentCycleIndex()).toBe(0);
    });

    test("should reset cycle index for new trigger", () => {
      const helloSnippets = usageTracker.getMatchingSnippets(mockSnippets, ";hello");
      usageTracker.cycleToNext(helloSnippets);
      expect(usageTracker.getCurrentCycleIndex()).toBe(1);

      // Start new cycle with different trigger
      usageTracker.startNewCycle();
      expect(usageTracker.getCurrentCycleIndex()).toBe(0);
    });
  });

  describe("Usage Statistics", () => {
    test("should calculate usage statistics", () => {
      const stats = usageTracker.getUsageStatistics(mockSnippets);

      expect(stats.totalSnippets).toBe(3);
      expect(stats.totalUsage).toBe(30); // 5 + 10 + 15
      expect(stats.averageUsage).toBe(10);
      expect(stats.mostUsedSnippet?.id).toBe("snippet-3");
      expect(stats.leastUsedSnippet?.id).toBe("snippet-1");
    });

    test("should handle empty snippets array", () => {
      const stats = usageTracker.getUsageStatistics([]);

      expect(stats.totalSnippets).toBe(0);
      expect(stats.totalUsage).toBe(0);
      expect(stats.averageUsage).toBe(0);
      expect(stats.mostUsedSnippet).toBeNull();
      expect(stats.leastUsedSnippet).toBeNull();
    });
  });

  describe("Storage Integration", () => {
    test("should save usage data to storage", async () => {
      const snippet = mockSnippets[0];
      const mockSaveToStorage = jest.fn();
      jest.spyOn(usageTracker, 'saveUsageData').mockImplementation(mockSaveToStorage);

      await usageTracker.trackUsage(snippet);

      expect(mockSaveToStorage).toHaveBeenCalledWith(snippet);
    });
  });
});