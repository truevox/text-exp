/**
 * Unit tests for ExpansionDeduplicator
 * Tests duplicate snippet deduplication logic with priority-based sorting
 */

// Jest is used for testing in this project
import { ExpansionDeduplicator } from "../../src/content/expansion-deduplicator.js";
import type { TextSnippet } from "../../src/shared/types.js";
import type { EnhancedSnippet } from "../../src/types/snippet-formats.js";
import type {
  StoreInfo,
  SnippetWithStore,
  DeduplicationOptions,
} from "../../src/content/expansion-deduplicator.js";

describe("ExpansionDeduplicator", () => {
  let deduplicator: ExpansionDeduplicator;
  let mockStores: StoreInfo[];
  let mockTextSnippets: TextSnippet[];
  let mockEnhancedSnippets: EnhancedSnippet[];

  beforeEach(() => {
    deduplicator = new ExpansionDeduplicator();

    // Create mock stores with different priorities
    mockStores = [
      {
        storeId: "appdata-store",
        storeName: "Personal",
        displayName: "Personal Snippets",
        tierName: "personal",
        priority: 0, // Highest priority
        isReadOnly: false,
      },
      {
        storeId: "team-store",
        storeName: "Team",
        displayName: "Team Snippets",
        tierName: "team",
        priority: 1,
        isReadOnly: false,
      },
      {
        storeId: "org-store",
        storeName: "Organization",
        displayName: "Organization Snippets",
        tierName: "org",
        priority: 2,
        isReadOnly: true,
      },
    ];

    // Register stores
    deduplicator.registerStores(mockStores);

    // Create mock TextSnippets
    mockTextSnippets = [
      {
        id: "snippet-1",
        trigger: ";hello",
        content: "Hello World!",
        contentType: "plaintext",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
        usageCount: 5,
        lastUsed: new Date("2023-01-10"),
      },
      {
        id: "snippet-1", // Duplicate ID
        trigger: ";hello",
        content: "Hello Team!",
        contentType: "plaintext",
        createdAt: new Date("2023-01-02"),
        updatedAt: new Date("2023-01-02"),
        usageCount: 3,
        lastUsed: new Date("2023-01-08"),
      },
      {
        id: "snippet-2",
        trigger: ";goodbye",
        content: "Goodbye World!",
        contentType: "plaintext",
        createdAt: new Date("2023-01-03"),
        updatedAt: new Date("2023-01-03"),
        usageCount: 2,
        lastUsed: new Date("2023-01-05"),
      },
    ];

    // Create mock EnhancedSnippets
    mockEnhancedSnippets = [
      {
        id: "enhanced-1",
        trigger: ";greet",
        content: "<p>Hello <strong>{{name}}</strong>!</p>",
        contentType: "html",
        snipDependencies: [],
        description: "Greeting with name",
        scope: "personal",
        variables: [{ name: "name", prompt: "Enter name" }],
        images: [],
        tags: ["greeting"],
        createdAt: "2023-01-01T00:00:00Z",
        createdBy: "user1",
        updatedAt: "2023-01-01T00:00:00Z",
        updatedBy: "user1",
      },
      {
        id: "enhanced-1", // Duplicate ID
        trigger: ";greet",
        content: "<p>Hi <em>{{name}}</em>!</p>",
        contentType: "html",
        snipDependencies: [],
        description: "Alternative greeting",
        scope: "team",
        variables: [{ name: "name", prompt: "Enter name" }],
        images: [],
        tags: ["greeting", "informal"],
        createdAt: "2023-01-02T00:00:00Z",
        createdBy: "user2",
        updatedAt: "2023-01-02T00:00:00Z",
        updatedBy: "user2",
      },
    ];
  });

  describe("Store Registration", () => {
    it("should register individual stores", () => {
      const newDeduplicator = new ExpansionDeduplicator();
      const store = mockStores[0];

      newDeduplicator.registerStore(store);
      expect(newDeduplicator.getStoreInfo(store.storeId)).toEqual(store);
    });

    it("should register multiple stores", () => {
      const newDeduplicator = new ExpansionDeduplicator();

      newDeduplicator.registerStores(mockStores);

      mockStores.forEach((store) => {
        expect(newDeduplicator.getStoreInfo(store.storeId)).toEqual(store);
      });
    });

    it("should clear all stores", () => {
      deduplicator.clearStores();

      mockStores.forEach((store) => {
        expect(deduplicator.getStoreInfo(store.storeId)).toBeUndefined();
      });
    });

    it("should return undefined for unregistered store", () => {
      expect(deduplicator.getStoreInfo("nonexistent")).toBeUndefined();
    });
  });

  describe("Deduplication by ID", () => {
    it("should deduplicate snippets by ID with store priority", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: mockTextSnippets[0], storeInfo: mockStores[0] }, // Priority 0
        { snippet: mockTextSnippets[1], storeInfo: mockStores[1] }, // Priority 1, same ID
        { snippet: mockTextSnippets[2], storeInfo: mockStores[0] }, // Priority 0, different ID
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores);

      expect(results).toHaveLength(2);

      // Sort results to ensure consistent order for testing
      results.sort((a, b) => a.id.localeCompare(b.id));

      // First result should be snippet-1 with priority 0 (appdata-store)
      expect(results[0].id).toBe("snippet-1");
      expect(results[0].primarySnippet.storeInfo.storeId).toBe("appdata-store");
      expect(results[0].duplicateCount).toBe(1);
      expect(results[0].duplicates[0].storeInfo.storeId).toBe("team-store");

      // Second result should be snippet-2
      expect(results[1].id).toBe("snippet-2");
      expect(results[1].duplicateCount).toBe(0);
    });

    it("should handle mixed TextSnippet and EnhancedSnippet types", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: mockTextSnippets[0], storeInfo: mockStores[0] },
        { snippet: mockEnhancedSnippets[0], storeInfo: mockStores[1] },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("snippet-1");
      expect(results[1].id).toBe("enhanced-1");
    });

    it("should sort results by store priority then alphabetically", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        {
          snippet: {
            ...mockTextSnippets[0],
            id: "z-snippet",
            trigger: ";zebra",
          },
          storeInfo: mockStores[1],
        },
        {
          snippet: {
            ...mockTextSnippets[1],
            id: "a-snippet",
            trigger: ";apple",
          },
          storeInfo: mockStores[1],
        },
        {
          snippet: {
            ...mockTextSnippets[2],
            id: "b-snippet",
            trigger: ";banana",
          },
          storeInfo: mockStores[0],
        },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores);

      expect(results).toHaveLength(3);
      // Store priority 0 comes first
      expect(results[0].trigger).toBe(";banana");
      expect(results[0].primarySnippet.storeInfo.priority).toBe(0);

      // Store priority 1 comes next, alphabetically sorted
      expect(results[1].trigger).toBe(";apple");
      expect(results[1].primarySnippet.storeInfo.priority).toBe(1);
      expect(results[2].trigger).toBe(";zebra");
      expect(results[2].primarySnippet.storeInfo.priority).toBe(1);
    });

    it("should respect maxResults option", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: mockTextSnippets[0], storeInfo: mockStores[0] },
        { snippet: mockTextSnippets[2], storeInfo: mockStores[0] },
        { snippet: mockEnhancedSnippets[0], storeInfo: mockStores[1] },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        maxResults: 2,
      });

      expect(results).toHaveLength(2);
    });

    it("should filter by store IDs", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: mockTextSnippets[0], storeInfo: mockStores[0] },
        { snippet: mockTextSnippets[1], storeInfo: mockStores[1] },
        {
          snippet: { ...mockTextSnippets[2], id: "snippet-3" },
          storeInfo: mockStores[2],
        },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        includeStoreIds: ["appdata-store", "team-store"],
      });

      expect(results).toHaveLength(1); // Only snippet-1 remains (snippets[0] and [1] have same ID)
      expect(
        results.every((r) =>
          ["appdata-store", "team-store"].includes(
            r.primarySnippet.storeInfo.storeId,
          ),
        ),
      ).toBe(true);
    });

    it("should exclude store IDs", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: mockTextSnippets[0], storeInfo: mockStores[0] },
        { snippet: mockTextSnippets[1], storeInfo: mockStores[1] },
        {
          snippet: { ...mockTextSnippets[2], id: "snippet-3" },
          storeInfo: mockStores[2],
        },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        excludeStoreIds: ["org-store"],
      });

      expect(results).toHaveLength(1); // Only snippet-1 remains (snippets[0] and [1] have same ID)
      expect(
        results.every(
          (r) => r.primarySnippet.storeInfo.storeId !== "org-store",
        ),
      ).toBe(true);
    });

    it("should filter by content types", () => {
      const textSnippet = {
        ...mockTextSnippets[0],
        contentType: "plaintext" as const,
      };
      const htmlSnippet = {
        ...mockEnhancedSnippets[0],
        contentType: "html" as const,
      };

      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: textSnippet, storeInfo: mockStores[0] },
        { snippet: htmlSnippet, storeInfo: mockStores[1] },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        contentTypes: ["html"],
      });

      expect(results).toHaveLength(1);
      expect(results[0].primarySnippet.snippet.id).toBe("enhanced-1");
    });

    it("should include usage metrics when requested", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: mockTextSnippets[0], storeInfo: mockStores[0] },
        { snippet: mockTextSnippets[1], storeInfo: mockStores[1] },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        includeUsageMetrics: true,
      });

      expect(results[0].usageMetrics).toBeDefined();
      expect(results[0].usageMetrics!.totalUsageCount).toBe(8); // 5 + 3
      expect(results[0].usageMetrics!.averageUsage).toBe(4); // (5 + 3) / 2
    });
  });

  describe("Deduplication by Trigger", () => {
    it("should deduplicate snippets by trigger with store priority", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: mockTextSnippets[0], storeInfo: mockStores[1] }, // Priority 1
        { snippet: mockTextSnippets[1], storeInfo: mockStores[0] }, // Priority 0, same trigger
        { snippet: mockTextSnippets[2], storeInfo: mockStores[0] }, // Priority 0, different trigger
      ];

      const results = deduplicator.deduplicateByTrigger(snippetsWithStores);

      expect(results).toHaveLength(2);

      // First result should be ;goodbye (priority 0)
      expect(results[0].trigger).toBe(";goodbye");
      expect(results[0].primarySnippet.storeInfo.priority).toBe(0);

      // Second result should be ;hello with priority 0 (appdata-store)
      expect(results[1].trigger).toBe(";hello");
      expect(results[1].primarySnippet.storeInfo.storeId).toBe("appdata-store");
      expect(results[1].duplicateCount).toBe(1);
    });

    it("should handle different IDs with same trigger", () => {
      const snippet1 = { ...mockTextSnippets[0], id: "unique-1" };
      const snippet2 = { ...mockTextSnippets[0], id: "unique-2" }; // Same trigger, different ID

      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: snippet1, storeInfo: mockStores[0] },
        { snippet: snippet2, storeInfo: mockStores[1] },
      ];

      const results = deduplicator.deduplicateByTrigger(snippetsWithStores);

      expect(results).toHaveLength(1);
      expect(results[0].trigger).toBe(";hello");
      expect(results[0].duplicateCount).toBe(1);
      expect(results[0].primarySnippet.snippet.id).toBe("unique-1"); // Priority 0 wins
    });

    it("should sort by trigger alphabetically within same priority", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        {
          snippet: { ...mockTextSnippets[0], trigger: ";zebra" },
          storeInfo: mockStores[1],
        },
        {
          snippet: { ...mockTextSnippets[1], trigger: ";apple" },
          storeInfo: mockStores[1],
        },
        {
          snippet: { ...mockTextSnippets[2], trigger: ";banana" },
          storeInfo: mockStores[0],
        },
      ];

      const results = deduplicator.deduplicateByTrigger(snippetsWithStores);

      expect(results).toHaveLength(3);
      expect(results[0].trigger).toBe(";banana"); // Priority 0
      expect(results[1].trigger).toBe(";apple"); // Priority 1, alphabetically first
      expect(results[2].trigger).toBe(";zebra"); // Priority 1, alphabetically second
    });
  });

  describe("Priority Methods", () => {
    it("should support usage-first priority method", () => {
      const highUsageSnippet = { ...mockTextSnippets[0], usageCount: 10 };
      const lowUsageSnippet = { ...mockTextSnippets[1], usageCount: 2 };

      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: lowUsageSnippet, storeInfo: mockStores[0] }, // Priority 0, low usage
        { snippet: highUsageSnippet, storeInfo: mockStores[1] }, // Priority 1, high usage
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        priorityMethod: "usage-first",
      });

      expect(results[0].primarySnippet.snippet.id).toBe("snippet-1");
      expect(results[0].primarySnippet.storeInfo.storeId).toBe("team-store"); // Higher usage wins
    });

    it("should fallback to store priority when usage is tied", () => {
      const snippet1 = { ...mockTextSnippets[0], usageCount: 5 };
      const snippet2 = { ...mockTextSnippets[1], usageCount: 5 }; // Same usage

      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: snippet1, storeInfo: mockStores[1] }, // Priority 1
        { snippet: snippet2, storeInfo: mockStores[0] }, // Priority 0
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        priorityMethod: "usage-first",
      });

      expect(results[0].primarySnippet.storeInfo.storeId).toBe("appdata-store"); // Store priority wins
    });
  });

  describe("Options and Filtering", () => {
    it("should disable alphabetical fallback when requested", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        {
          snippet: {
            ...mockTextSnippets[0],
            id: "zebra-id",
            trigger: ";zebra",
          },
          storeInfo: mockStores[1],
        },
        {
          snippet: {
            ...mockTextSnippets[1],
            id: "apple-id",
            trigger: ";apple",
          },
          storeInfo: mockStores[1],
        },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        enableAlphabeticalFallback: false,
      });

      expect(results).toHaveLength(2);
      // Without alphabetical sorting, the order should not be alphabetical
      // We just test that both results are present
      const triggers = results.map((r) => r.trigger);
      expect(triggers).toContain(";zebra");
      expect(triggers).toContain(";apple");
    });

    it("should handle empty input gracefully", () => {
      const results = deduplicator.deduplicateById([]);
      expect(results).toHaveLength(0);
    });

    it("should handle snippets without usage data", () => {
      const snippetWithoutUsage = { ...mockTextSnippets[0] };
      delete (snippetWithoutUsage as any).usageCount;
      delete (snippetWithoutUsage as any).lastUsed;

      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: snippetWithoutUsage, storeInfo: mockStores[0] },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        includeUsageMetrics: true,
      });

      expect(results[0].usageMetrics!.totalUsageCount).toBe(0);
      expect(results[0].usageMetrics!.averageUsage).toBe(0);
    });
  });

  describe("Statistics", () => {
    it("should track deduplication statistics", () => {
      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: mockTextSnippets[0], storeInfo: mockStores[0] },
        { snippet: mockTextSnippets[1], storeInfo: mockStores[1] },
        { snippet: mockTextSnippets[2], storeInfo: mockStores[0] },
      ];

      deduplicator.deduplicateById(snippetsWithStores);
      const stats = deduplicator.getLastStats();

      expect(stats).toBeDefined();
      expect(stats!.totalSnippets).toBe(3);
      expect(stats!.uniqueSnippets).toBe(2);
      expect(stats!.duplicatesRemoved).toBe(1);
      expect(stats!.storesProcessed).toBe(2);
      expect(stats!.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should return null stats before any deduplication", () => {
      const newDeduplicator = new ExpansionDeduplicator();
      expect(newDeduplicator.getLastStats()).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle snippets with undefined content types", () => {
      const snippetWithoutContentType = { ...mockTextSnippets[0] };
      delete (snippetWithoutContentType as any).contentType;

      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: snippetWithoutContentType, storeInfo: mockStores[0] },
      ];

      const results = deduplicator.deduplicateById(snippetsWithStores, {
        contentTypes: ["plaintext"],
      });

      expect(results).toHaveLength(1); // Should match 'plaintext' default
    });

    it("should handle large numbers of snippets efficiently", () => {
      const largeSnippetSet: SnippetWithStore[] = [];

      // Create 1000 snippets
      for (let i = 0; i < 1000; i++) {
        largeSnippetSet.push({
          snippet: {
            ...mockTextSnippets[0],
            id: `snippet-${i}`,
            trigger: `;test${i}`,
          },
          storeInfo: mockStores[i % 3],
        });
      }

      const startTime = Date.now();
      const results = deduplicator.deduplicateById(largeSnippetSet);
      const endTime = Date.now();

      expect(results).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it("should handle circular references in snippet data safely", () => {
      const circularSnippet = { ...mockTextSnippets[0] };
      // Create a circular reference (this shouldn't break the deduplication)
      (circularSnippet as any).self = circularSnippet;

      const snippetsWithStores: SnippetWithStore[] = [
        { snippet: circularSnippet, storeInfo: mockStores[0] },
      ];

      expect(() => {
        deduplicator.deduplicateById(snippetsWithStores);
      }).not.toThrow();
    });
  });
});
