/**
 * Store Duplicate Validator Tests
 * Tests for preventing duplicate snippet IDs within single stores
 */

import {
  StoreDuplicateValidator,
  type StoreValidationResult,
  type DuplicateValidationResult,
  type ConflictResolution,
  getStoreDuplicateValidator,
  validateStoreForDuplicates,
  checkSnippetIdConflict,
  generateUniqueSnippetId,
} from "../../src/storage/store-duplicate-validator";
import type { TextSnippet } from "../../src/shared/types";
import type { EnhancedSnippet } from "../../src/types/snippet-formats";

describe("StoreDuplicateValidator", () => {
  let validator: StoreDuplicateValidator;
  let mockTextSnippets: TextSnippet[];
  let mockEnhancedSnippets: EnhancedSnippet[];

  beforeEach(() => {
    validator = new StoreDuplicateValidator();

    // Create mock TextSnippets
    mockTextSnippets = [
      {
        id: "unique-1",
        trigger: ";hello",
        content: "Hello World!",
        contentType: "plaintext",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
        usageCount: 5,
        lastUsed: new Date("2023-01-10"),
      },
      {
        id: "duplicate-id", // Duplicate with next
        trigger: ";goodbye",
        content: "Goodbye World!",
        contentType: "plaintext",
        createdAt: new Date("2023-01-02"),
        updatedAt: new Date("2023-01-02"),
        usageCount: 3,
        lastUsed: new Date("2023-01-08"),
      },
      {
        id: "duplicate-id", // Duplicate with previous
        trigger: ";farewell",
        content: "Farewell!",
        contentType: "plaintext",
        createdAt: new Date("2023-01-03"),
        updatedAt: new Date("2023-01-03"),
        usageCount: 1,
        lastUsed: new Date("2023-01-05"),
      },
      {
        id: "unique-2",
        trigger: ";greet",
        content: "Greetings!",
        contentType: "plaintext",
        createdAt: new Date("2023-01-04"),
        updatedAt: new Date("2023-01-04"),
        usageCount: 2,
        lastUsed: new Date("2023-01-06"),
      },
    ];

    // Create mock EnhancedSnippets
    mockEnhancedSnippets = [
      {
        id: "enhanced-1",
        trigger: ";signature",
        content: "<p>Best regards,<br>{{name}}</p>",
        contentType: "html",
        snipDependencies: [],
        description: "Email signature",
        scope: "personal",
        variables: [{ name: "name", prompt: "Enter your name" }],
        images: [],
        tags: ["signature", "email"],
        createdAt: "2023-01-01T00:00:00Z",
        createdBy: "user1",
        updatedAt: "2023-01-01T00:00:00Z",
        updatedBy: "user1",
      },
      {
        id: "enhanced-duplicate", // Duplicate with next
        trigger: ";footer",
        content: "<p>Company Footer</p>",
        contentType: "html",
        snipDependencies: [],
        description: "Footer template",
        scope: "team",
        variables: [],
        images: [],
        tags: ["footer"],
        createdAt: "2023-01-02T00:00:00Z",
        createdBy: "user2",
        updatedAt: "2023-01-02T00:00:00Z",
        updatedBy: "user2",
      },
      {
        id: "enhanced-duplicate", // Duplicate with previous
        trigger: ";footer2",
        content: "<p>Alternative Footer</p>",
        contentType: "html",
        snipDependencies: [],
        description: "Alternative footer",
        scope: "team",
        variables: [],
        images: [],
        tags: ["footer", "alternative"],
        createdAt: "2023-01-03T00:00:00Z",
        createdBy: "user3",
        updatedAt: "2023-01-03T00:00:00Z",
        updatedBy: "user3",
      },
    ];
  });

  describe("Store Validation", () => {
    it("should validate store with no duplicates", () => {
      const validSnippets = [mockTextSnippets[0], mockTextSnippets[3]];

      const result = validator.validateStore(
        "store-1",
        "Test Store",
        validSnippets,
      );

      expect(result.isValid).toBe(true);
      expect(result.totalSnippets).toBe(2);
      expect(result.validSnippets).toBe(2);
      expect(result.duplicateCount).toBe(0);
      expect(result.duplicateGroups).toHaveLength(0);
      expect(result.message).toContain("no duplicate IDs");
    });

    it("should detect duplicate IDs within store", () => {
      const result = validator.validateStore(
        "store-1",
        "Test Store",
        mockTextSnippets,
      );

      expect(result.isValid).toBe(false);
      expect(result.totalSnippets).toBe(4);
      expect(result.validSnippets).toBe(3); // 4 total - 1 duplicate
      expect(result.duplicateCount).toBe(1);
      expect(result.duplicateGroups).toHaveLength(1);

      const duplicateGroup = result.duplicateGroups[0];
      expect(duplicateGroup.id).toBe("duplicate-id");
      expect(duplicateGroup.count).toBe(2);
      expect(duplicateGroup.indices).toEqual([1, 2]);
      expect(duplicateGroup.snippets).toHaveLength(2);
    });

    it("should handle mixed TextSnippet and EnhancedSnippet types", () => {
      const mixedSnippets = [
        mockTextSnippets[0],
        mockEnhancedSnippets[0],
        mockTextSnippets[1],
        mockEnhancedSnippets[1],
      ];

      const result = validator.validateStore(
        "store-1",
        "Mixed Store",
        mixedSnippets,
      );

      expect(result.isValid).toBe(true);
      expect(result.totalSnippets).toBe(4);
      expect(result.duplicateCount).toBe(0);
    });

    it("should generate suggested alternative IDs", () => {
      const result = validator.validateStore(
        "store-1",
        "Test Store",
        mockTextSnippets,
        {
          suggestAlternatives: true,
          maxAlternatives: 3,
        },
      );

      expect(result.duplicateGroups[0].suggestedIds).toBeDefined();
      expect(result.duplicateGroups[0].suggestedIds).toHaveLength(3);
      expect(result.duplicateGroups[0].suggestedIds![0]).toBe("duplicate-id-1");
      expect(result.duplicateGroups[0].suggestedIds![1]).toBe("duplicate-id-2");
      expect(result.duplicateGroups[0].suggestedIds![2]).toBe("duplicate-id-3");
    });

    it("should handle empty store", () => {
      const result = validator.validateStore("empty-store", "Empty Store", []);

      expect(result.isValid).toBe(true);
      expect(result.totalSnippets).toBe(0);
      expect(result.validSnippets).toBe(0);
      expect(result.duplicateCount).toBe(0);
      expect(result.duplicateGroups).toHaveLength(0);
    });
  });

  describe("Multiple Store Validation", () => {
    it("should validate multiple stores simultaneously", () => {
      const stores = [
        {
          storeId: "store-1",
          storeName: "Store 1",
          snippets: [mockTextSnippets[0], mockTextSnippets[3]], // No duplicates
        },
        {
          storeId: "store-2",
          storeName: "Store 2",
          snippets: mockTextSnippets, // Has duplicates
        },
      ];

      const results = validator.validateMultipleStores(stores);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);

      const stats = validator.getLastStats();
      expect(stats).toBeDefined();
      expect(stats!.totalStoresValidated).toBe(2);
      expect(stats!.totalSnippetsValidated).toBe(6);
      expect(stats!.totalDuplicatesFound).toBe(1);
    });

    it("should calculate statistics correctly", () => {
      const stores = [
        {
          storeId: "store-1",
          storeName: "Store 1",
          snippets: mockTextSnippets,
        },
        {
          storeId: "store-2",
          storeName: "Store 2",
          snippets: mockEnhancedSnippets,
        },
      ];

      validator.validateMultipleStores(stores);
      const stats = validator.getLastStats();

      expect(stats!.totalStoresValidated).toBe(2);
      expect(stats!.totalSnippetsValidated).toBe(7);
      expect(stats!.totalDuplicatesFound).toBe(2); // 1 in each store
      expect(stats!.averageDuplicatesPerStore).toBe(1);
      expect(stats!.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("ID Conflict Checking", () => {
    it("should detect ID conflicts", () => {
      const result = validator.checkIdConflict(
        "duplicate-id",
        mockTextSnippets,
      );

      expect(result.isValid).toBe(false);
      expect(result.duplicateId).toBe("duplicate-id");
      expect(result.duplicateIndices).toEqual([1, 2]);
      expect(result.conflictingSnippets).toHaveLength(2);
      expect(result.message).toContain("conflicts with 2 existing snippets");
    });

    it("should allow non-conflicting IDs", () => {
      const result = validator.checkIdConflict(
        "new-unique-id",
        mockTextSnippets,
      );

      expect(result.isValid).toBe(true);
      expect(result.duplicateId).toBeUndefined();
      expect(result.duplicateIndices).toBeUndefined();
      expect(result.conflictingSnippets).toBeUndefined();
      expect(result.message).toContain("is available");
    });

    it("should exclude specific index from conflict check", () => {
      const result = validator.checkIdConflict(
        "duplicate-id",
        mockTextSnippets,
        1,
      );

      expect(result.isValid).toBe(false);
      expect(result.duplicateIndices).toEqual([2]); // Only index 2, not 1
    });
  });

  describe("Unique ID Generation", () => {
    it("should return base ID if available", () => {
      const uniqueId = validator.generateUniqueId(
        "available-id",
        mockTextSnippets,
      );
      expect(uniqueId).toBe("available-id");
    });

    it("should generate numbered variant for conflicting ID", () => {
      const uniqueId = validator.generateUniqueId(
        "duplicate-id",
        mockTextSnippets,
      );
      expect(uniqueId).toBe("duplicate-id-1");
    });

    it("should use custom ID generator if provided", () => {
      let counter = 0;
      const customGenerator = () => `custom-${++counter}`;

      const uniqueId = validator.generateUniqueId(
        "duplicate-id",
        mockTextSnippets,
        {
          idGenerator: customGenerator,
        },
      );

      expect(uniqueId).toBe("custom-1");
    });

    it("should handle when numbered variants are also taken", () => {
      const snippetsWithNumbered = [
        ...mockTextSnippets,
        { ...mockTextSnippets[0], id: "duplicate-id-1" },
        { ...mockTextSnippets[0], id: "duplicate-id-2" },
      ];

      const uniqueId = validator.generateUniqueId(
        "duplicate-id",
        snippetsWithNumbered,
      );
      expect(uniqueId).toBe("duplicate-id-3");
    });
  });

  describe("Conflict Resolution", () => {
    it("should resolve conflicts by keeping first occurrence", () => {
      const validationResult = validator.validateStore(
        "store-1",
        "Test Store",
        mockTextSnippets,
      );

      const resolvedSnippets = validator.resolveConflicts(
        mockTextSnippets,
        { action: "keep-first" },
        validationResult.duplicateGroups,
      );

      expect(resolvedSnippets).toHaveLength(3);
      expect(resolvedSnippets.map((s) => s.id)).toEqual([
        "unique-1",
        "duplicate-id",
        "unique-2",
      ]);
      expect(resolvedSnippets[1].trigger).toBe(";goodbye"); // First occurrence
    });

    it("should resolve conflicts by keeping last occurrence", () => {
      const validationResult = validator.validateStore(
        "store-1",
        "Test Store",
        mockTextSnippets,
      );

      const resolvedSnippets = validator.resolveConflicts(
        mockTextSnippets,
        { action: "keep-last" },
        validationResult.duplicateGroups,
      );

      expect(resolvedSnippets).toHaveLength(3);
      expect(resolvedSnippets.map((s) => s.id)).toEqual([
        "unique-1",
        "duplicate-id",
        "unique-2",
      ]);
      expect(resolvedSnippets[1].trigger).toBe(";farewell"); // Last occurrence
    });

    it("should resolve conflicts by keeping newest snippet", () => {
      const validationResult = validator.validateStore(
        "store-1",
        "Test Store",
        mockTextSnippets,
      );

      const resolvedSnippets = validator.resolveConflicts(
        mockTextSnippets,
        { action: "keep-newest" },
        validationResult.duplicateGroups,
      );

      expect(resolvedSnippets).toHaveLength(3);
      expect(resolvedSnippets[1].trigger).toBe(";farewell"); // Newest (Jan 3)
    });

    it("should resolve conflicts by keeping oldest snippet", () => {
      const validationResult = validator.validateStore(
        "store-1",
        "Test Store",
        mockTextSnippets,
      );

      const resolvedSnippets = validator.resolveConflicts(
        mockTextSnippets,
        { action: "keep-oldest" },
        validationResult.duplicateGroups,
      );

      expect(resolvedSnippets).toHaveLength(3);
      expect(resolvedSnippets[1].trigger).toBe(";goodbye"); // Oldest (Jan 2)
    });

    it("should resolve conflicts by renaming duplicates", () => {
      const validationResult = validator.validateStore(
        "store-1",
        "Test Store",
        mockTextSnippets,
      );

      const resolvedSnippets = validator.resolveConflicts(
        mockTextSnippets,
        { action: "rename" },
        validationResult.duplicateGroups,
      );

      expect(resolvedSnippets).toHaveLength(4);
      expect(resolvedSnippets[1].id).toBe("duplicate-id");
      expect(resolvedSnippets[2].id).toBe("duplicate-id-1");
      expect(resolvedSnippets[1].trigger).toBe(";goodbye");
      expect(resolvedSnippets[2].trigger).toBe(";farewell");
    });

    it("should resolve conflicts by merging snippets", () => {
      const validationResult = validator.validateStore(
        "store-1",
        "Test Store",
        mockTextSnippets,
      );

      const resolvedSnippets = validator.resolveConflicts(
        mockTextSnippets,
        { action: "merge", mergeStrategy: "content-priority" },
        validationResult.duplicateGroups,
      );

      expect(resolvedSnippets).toHaveLength(3);
      expect(resolvedSnippets[1].id).toBe("duplicate-id");
      expect(resolvedSnippets[1].content).toBe("Goodbye World!"); // Longer content
    });
  });

  describe("Validation History", () => {
    it("should track validation history", () => {
      validator.validateStore("store-1", "Test Store", mockTextSnippets);

      const history = validator.getValidationHistory("store-1");
      expect(history).toBeDefined();
      expect(history!.storeId).toBe("store-1");
      expect(history!.storeName).toBe("Test Store");
    });

    it("should return all validation history", () => {
      validator.validateStore("store-1", "Store 1", mockTextSnippets);
      validator.validateStore("store-2", "Store 2", mockEnhancedSnippets);

      const allHistory = validator.getAllValidationHistory();
      expect(allHistory.size).toBe(2);
      expect(allHistory.has("store-1")).toBe(true);
      expect(allHistory.has("store-2")).toBe(true);
    });

    it("should clear validation history", () => {
      validator.validateStore("store-1", "Store 1", mockTextSnippets);
      validator.validateStore("store-2", "Store 2", mockEnhancedSnippets);

      validator.clearValidationHistory("store-1");
      expect(validator.getValidationHistory("store-1")).toBeUndefined();
      expect(validator.getValidationHistory("store-2")).toBeDefined();

      validator.clearValidationHistory();
      expect(validator.getAllValidationHistory().size).toBe(0);
    });
  });

  describe("Convenience Functions", () => {
    it("should provide global validator instance", () => {
      const instance1 = getStoreDuplicateValidator();
      const instance2 = getStoreDuplicateValidator();
      expect(instance1).toBe(instance2); // Should be same instance
    });

    it("should provide convenience validation function", () => {
      const result = validateStoreForDuplicates(
        "store-1",
        "Test Store",
        mockTextSnippets,
      );
      expect(result.isValid).toBe(false);
      expect(result.duplicateCount).toBe(1);
    });

    it("should provide convenience conflict check function", () => {
      const result = checkSnippetIdConflict("duplicate-id", mockTextSnippets);
      expect(result.isValid).toBe(false);
      expect(result.duplicateId).toBe("duplicate-id");
    });

    it("should provide convenience unique ID generation function", () => {
      const uniqueId = generateUniqueSnippetId(
        "duplicate-id",
        mockTextSnippets,
      );
      expect(uniqueId).toBe("duplicate-id-1");
    });
  });

  describe("Edge Cases", () => {
    it("should handle snippets with missing dates", () => {
      const snippetsWithMissingDates = [
        { ...mockTextSnippets[0], id: "missing-dates-1" },
        { ...mockTextSnippets[1], id: "missing-dates-1" },
      ];

      // Remove date fields
      delete (snippetsWithMissingDates[0] as any).createdAt;
      delete (snippetsWithMissingDates[1] as any).updatedAt;

      const result = validator.validateStore(
        "store-1",
        "Test Store",
        snippetsWithMissingDates,
      );

      expect(result.isValid).toBe(false);
      expect(result.duplicateCount).toBe(1);

      // Should still be able to resolve conflicts
      const resolvedSnippets = validator.resolveConflicts(
        snippetsWithMissingDates,
        { action: "keep-newest" },
        result.duplicateGroups,
      );

      expect(resolvedSnippets).toHaveLength(1);
    });

    it("should handle large numbers of duplicates efficiently", () => {
      const manyDuplicates = Array(1000)
        .fill(null)
        .map((_, i) => ({
          ...mockTextSnippets[0],
          id: "duplicate-id",
          trigger: `;trigger${i}`,
        }));

      const startTime = Date.now();
      const result = validator.validateStore(
        "large-store",
        "Large Store",
        manyDuplicates,
      );
      const endTime = Date.now();

      expect(result.isValid).toBe(false);
      expect(result.duplicateCount).toBe(999);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it("should handle empty merge array gracefully", () => {
      expect(() => {
        (validator as any).mergeSnippets([]);
      }).toThrow("Cannot merge empty snippet array");
    });

    it("should handle single snippet merge", () => {
      const result = (validator as any).mergeSnippets([mockTextSnippets[0]]);
      expect(result).toEqual(mockTextSnippets[0]);
    });
  });
});
