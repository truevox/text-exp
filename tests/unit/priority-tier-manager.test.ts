/**
 * Tests for Enhanced Priority Tier Manager - Phase 2
 * Comprehensive test suite for tier-based storage management
 */

import {
  PriorityTierManager,
  TIER_CONFIGS,
} from "../../src/storage/priority-tier-manager.js";
import type {
  PriorityTier,
  TierStorageSchema,
  EnhancedSnippet,
} from "../../src/types/snippet-formats.js";

describe("Enhanced PriorityTierManager - Phase 2", () => {
  let tierManager: PriorityTierManager;
  const mockSnippet: EnhancedSnippet = {
    id: "test-snippet-1",
    trigger: "test",
    content: "Test content",
    contentType: "plaintext",
    snipDependencies: [],
    description: "Test snippet",
    scope: "personal",
    variables: [],
    images: [],
    tags: ["test"],
    createdAt: "2025-01-01T00:00:00.000Z",
    createdBy: "test-user",
    updatedAt: "2025-01-01T00:00:00.000Z",
    updatedBy: "test-user",
  };

  beforeEach(async () => {
    tierManager = new PriorityTierManager();
    await tierManager.initialize();
  });

  afterEach(async () => {
    await tierManager.reset();
  });

  // ========================================================================
  // INITIALIZATION TESTS
  // ========================================================================

  describe("Initialization and Configuration", () => {
    test("should initialize with default configuration", async () => {
      const manager = new PriorityTierManager();
      await manager.initialize();

      const stats = await manager.getTierStats();
      expect(Object.keys(stats)).toEqual([
        "priority-0",
        "personal",
        "department",
        "team",
        "org",
      ]);
      expect(stats.personal.snippetsCount).toBe(0);
      expect(stats.team.snippetsCount).toBe(0);
      expect(stats.org.snippetsCount).toBe(0);
    });

    test("should initialize with custom configuration", async () => {
      const customConfig = {
        basePath: "./custom-stores",
        enableCaching: false,
        enableBackups: false,
        maxBackups: 3,
      };

      const manager = new PriorityTierManager(customConfig);
      await manager.initialize();

      const stats = await manager.getTierStats();
      expect(Object.keys(stats)).toEqual([
        "priority-0",
        "personal",
        "department",
        "team",
        "org",
      ]);
    });

    test("should validate tier configuration constants", () => {
      expect(TIER_CONFIGS["priority-0"].priority).toBe(5);
      expect(TIER_CONFIGS.personal.priority).toBe(4);
      expect(TIER_CONFIGS.department.priority).toBe(3);
      expect(TIER_CONFIGS.team.priority).toBe(2);
      expect(TIER_CONFIGS.org.priority).toBe(1);

      expect(TIER_CONFIGS.personal.fileName).toBe("personal.json");
      expect(TIER_CONFIGS.team.fileName).toBe("team.json");
      expect(TIER_CONFIGS.org.fileName).toBe("org.json");
    });
  });

  // ========================================================================
  // TIER LOADING TESTS
  // ========================================================================

  describe("Enhanced Tier Loading", () => {
    test("should load empty tier when no data exists", async () => {
      const result = await tierManager.loadTier("personal");

      expect(result.success).toBe(true);
      expect(result.tier).toBe("personal");
      expect(result.snippetsCount).toBe(0);
      expect(result.metadata?.operation).toBe("load");
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
    });

    test("should handle load errors gracefully", async () => {
      // Create a manager that will fail on load
      const mockManager = new PriorityTierManager();
      // Override the protected method to simulate error
      jest
        .spyOn(mockManager as any, "loadTierFromStorage")
        .mockRejectedValue(new Error("Storage error"));

      const result = await mockManager.loadTier("personal");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Storage error");
      expect(result.tier).toBe("personal");
      expect(result.snippetsCount).toBe(0);
    });

    test("should use cache when enabled", async () => {
      const manager = new PriorityTierManager({ enableCaching: true });
      await manager.initialize();

      // First load - should cache
      const firstResult = await manager.loadTier("personal");
      expect(firstResult.metadata?.fromCache).toBe(false);

      // Second load - should use cache
      const secondResult = await manager.loadTier("personal", {
        useCache: true,
      });
      expect(secondResult.metadata?.fromCache).toBe(true);
    });

    test("should bypass cache when requested", async () => {
      const manager = new PriorityTierManager({ enableCaching: true });
      await manager.initialize();

      // Load and cache
      await manager.loadTier("personal");

      // Load with cache disabled
      const result = await manager.loadTier("personal", { useCache: false });
      expect(result.metadata?.fromCache).toBe(false);
    });

    test("should validate schema when enabled", async () => {
      const mockManager = new PriorityTierManager();

      // Mock load to return invalid schema
      jest.spyOn(mockManager as any, "loadTierFromStorage").mockResolvedValue({
        schema: "invalid-schema",
        tier: "personal",
        snippets: [],
        metadata: {},
      });

      const result = await mockManager.loadTier("personal", {
        validateSchema: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid tier schema");
    });

    test("should support custom validation", async () => {
      const customValidation = jest.fn().mockReturnValue(false);

      const result = await tierManager.loadTier("personal", {
        customValidation,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Custom validation failed");
      expect(customValidation).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // TIER SAVING TESTS
  // ========================================================================

  describe("Enhanced Tier Saving", () => {
    let mockTierData: TierStorageSchema;

    beforeEach(() => {
      mockTierData = {
        schema: "priority-tier-v1",
        tier: "personal",
        snippets: [mockSnippet],
        metadata: {
          version: "1.0.0",
          created: "2025-01-01T00:00:00.000Z",
          modified: "2025-01-01T00:00:00.000Z",
          owner: "test-user",
          description: "Test tier",
        },
      };
    });

    test("should save tier data successfully", async () => {
      const result = await tierManager.saveTier("personal", mockTierData);

      expect(result.success).toBe(true);
      expect(result.tier).toBe("personal");
      expect(result.snippetsCount).toBe(1);
      expect(result.metadata?.operation).toBe("save");
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
    });

    test("should validate before save when enabled", async () => {
      const invalidTierData = {
        ...mockTierData,
        schema: "invalid-schema",
      } as unknown as TierStorageSchema;

      const result = await tierManager.saveTier("personal", invalidTierData, {
        validateBeforeSave: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid tier schema");
    });

    test("should update timestamp when requested", async () => {
      const originalModified = mockTierData.metadata.modified;

      // Add small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await tierManager.saveTier("personal", mockTierData, {
        updateTimestamp: true,
      });

      expect(mockTierData.metadata.modified).not.toBe(originalModified);
    });

    test("should handle serialization errors", async () => {
      // Create a manager with mocked JSON serializer that fails
      const mockManager = new PriorityTierManager();
      await mockManager.initialize();

      // Mock JsonSerializer to throw error
      const { JsonSerializer } = await import(
        "../../src/storage/json-serializer.js"
      );
      const serializeSpy = jest
        .spyOn(JsonSerializer, "serializeToString")
        .mockImplementation(() => {
          throw new Error("Serialization failed");
        });

      const result = await mockManager.saveTier("personal", mockTierData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Serialization failed");

      // Restore original implementation
      serializeSpy.mockRestore();
    });

    test("should handle backup creation", async () => {
      const manager = new PriorityTierManager({ enableBackups: true });
      await manager.initialize();

      const result = await manager.saveTier("personal", mockTierData, {
        createBackup: true,
      });

      expect(result.success).toBe(true);
      // Backup metadata should be set (though backup might not actually be created due to no existing file)
      expect(result.metadata?.backupCreated).toBeDefined();
    });

    test("should continue save even if backup fails", async () => {
      const manager = new PriorityTierManager({ enableBackups: true });
      await manager.initialize();

      // Mock backup creation to fail
      jest
        .spyOn(manager as any, "createTierBackup")
        .mockRejectedValue(new Error("Backup failed"));

      const result = await manager.saveTier("personal", mockTierData);

      expect(result.success).toBe(true); // Save should still succeed
    });
  });

  // ========================================================================
  // UPSERT OPERATIONS TESTS
  // ========================================================================

  describe("Enhanced Upsert Operations", () => {
    test("should upsert snippet to correct tier", async () => {
      const result = await tierManager.upsertSnippet(mockSnippet, "personal");

      expect(result.success).toBe(true);
      expect(result.tier).toBe("personal");
      expect(result.snippetsCount).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.operation).toBe("upsert");
    });

    test("should determine tier from snippet scope", async () => {
      const teamSnippet: EnhancedSnippet = {
        ...mockSnippet,
        id: "team-snippet",
        scope: "team",
      };

      const result = await tierManager.upsertSnippet(teamSnippet);

      expect(result.success).toBe(true);
      expect(result.tier).toBe("team");
    });

    test("should handle merge conflicts", async () => {
      // First upsert
      await tierManager.upsertSnippet(mockSnippet, "personal");

      // Create conflicting snippet
      const conflictingSnippet: EnhancedSnippet = {
        ...mockSnippet,
        content: "Modified content",
        updatedAt: "2025-01-02T00:00:00.000Z",
      };

      // Second upsert should handle merge
      const result = await tierManager.upsertSnippet(
        conflictingSnippet,
        "personal",
      );

      expect(result.success).toBe(true);
      expect(result.tier).toBe("personal");
    });

    test("should handle upsert to non-existent tier load failure", async () => {
      const mockManager = new PriorityTierManager();

      // Mock load to fail
      jest.spyOn(mockManager, "loadTier").mockResolvedValue({
        success: false,
        tier: "personal",
        snippetsCount: 0,
        error: "Load failed",
      });

      const result = await mockManager.upsertSnippet(mockSnippet, "personal");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to load tier for upsert");
    });

    test("should default to personal tier for unknown scope", async () => {
      const unknownScopeSnippet: EnhancedSnippet = {
        ...mockSnippet,
        scope: "unknown" as any,
      };

      const result = await tierManager.upsertSnippet(unknownScopeSnippet);

      expect(result.success).toBe(true);
      expect(result.tier).toBe("personal");
    });
  });

  // ========================================================================
  // LEGACY METHOD COMPATIBILITY TESTS
  // ========================================================================

  describe("Legacy Method Compatibility", () => {
    test("should maintain backward compatibility for getTierSnippets", async () => {
      // Add snippet using legacy method
      const addResult = await tierManager.addSnippetToTier(
        "personal",
        mockSnippet,
      );
      expect(addResult.success).toBe(true);

      // Get snippets using legacy method
      const snippets = await tierManager.getTierSnippets("personal");
      expect(snippets).toHaveLength(1);
      expect(snippets[0].id).toBe(mockSnippet.id);
    });

    test("should maintain backward compatibility for updateSnippetInTier", async () => {
      // Add snippet first
      await tierManager.addSnippetToTier("personal", mockSnippet);

      // Update using legacy method
      const updateResult = await tierManager.updateSnippetInTier(
        "personal",
        mockSnippet.id,
        { content: "Updated content" },
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.tier).toBe("personal");

      // Verify update
      const snippets = await tierManager.getTierSnippets("personal");
      expect(snippets[0].content).toBe("Updated content");
    });

    test("should maintain backward compatibility for removeSnippetFromTier", async () => {
      // Add snippet first
      await tierManager.addSnippetToTier("personal", mockSnippet);

      // Remove using legacy method
      const removeResult = await tierManager.removeSnippetFromTier(
        "personal",
        mockSnippet.id,
      );

      expect(removeResult.success).toBe(true);
      expect(removeResult.tier).toBe("personal");

      // Verify removal
      const snippets = await tierManager.getTierSnippets("personal");
      expect(snippets).toHaveLength(0);
    });

    test("should maintain backward compatibility for getAllSnippetsOrderedByPriority", async () => {
      // Add snippets to different tiers
      await tierManager.addSnippetToTier("personal", mockSnippet);
      await tierManager.addSnippetToTier("team", {
        ...mockSnippet,
        id: "team-snippet",
        scope: "team",
      });

      const allSnippets = await tierManager.getAllSnippetsOrderedByPriority();
      expect(allSnippets).toHaveLength(2);

      // Personal tier (priority 1) should come first
      expect(allSnippets[0].scope).toBe("personal");
      expect(allSnippets[1].scope).toBe("team");
    });

    test("should maintain backward compatibility for findSnippetByTrigger", async () => {
      await tierManager.addSnippetToTier("personal", mockSnippet);

      const foundSnippet = await tierManager.findSnippetByTrigger("test");
      expect(foundSnippet).not.toBeNull();
      expect(foundSnippet?.id).toBe(mockSnippet.id);

      const notFound = await tierManager.findSnippetByTrigger("nonexistent");
      expect(notFound).toBeNull();
    });
  });

  // ========================================================================
  // CACHING TESTS
  // ========================================================================

  describe("Enhanced Caching System", () => {
    test("should cache tier data when enabled", async () => {
      const manager = new PriorityTierManager({
        enableCaching: true,
        cacheTtl: 1000, // 1 second
      });
      await manager.initialize();

      // Load tier to populate cache
      const firstLoad = await manager.loadTier("personal");
      expect(firstLoad.metadata?.fromCache).toBe(false);

      // Second load should use cache
      const secondLoad = await manager.loadTier("personal");
      expect(secondLoad.metadata?.fromCache).toBe(true);
    });

    test("should respect cache TTL", async () => {
      const manager = new PriorityTierManager({
        enableCaching: true,
        cacheTtl: 50, // 50ms
      });
      await manager.initialize();

      // Load tier to populate cache
      await manager.loadTier("personal");

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Load again - should not use expired cache
      const result = await manager.loadTier("personal");
      expect(result.metadata?.fromCache).toBe(false);
    });

    test("should clear cache on reset", async () => {
      const manager = new PriorityTierManager({ enableCaching: true });
      await manager.initialize();

      // Load tier to populate cache
      await manager.loadTier("personal");

      // Reset should clear cache
      await manager.reset();

      // Load again - should not use cache
      const result = await manager.loadTier("personal");
      expect(result.metadata?.fromCache).toBe(false);
    });

    test("should not cache when disabled", async () => {
      const manager = new PriorityTierManager({ enableCaching: false });
      await manager.initialize();

      // Multiple loads should never use cache
      const firstLoad = await manager.loadTier("personal");
      expect(firstLoad.metadata?.fromCache).toBe(false);

      const secondLoad = await manager.loadTier("personal");
      expect(secondLoad.metadata?.fromCache).toBe(false);
    });
  });

  // ========================================================================
  // ERROR HANDLING TESTS
  // ========================================================================

  describe("Enhanced Error Handling", () => {
    test("should handle invalid tier names gracefully", async () => {
      expect(async () => {
        await tierManager.getTierSnippets("invalid" as PriorityTier);
      }).rejects.toThrow("Tier invalid not found");
    });

    test("should handle manager not initialized", async () => {
      const manager = new PriorityTierManager();
      // Don't initialize

      expect(async () => {
        await manager.getTierSnippets("personal");
      }).rejects.toThrow("PriorityTierManager not initialized");
    });

    test("should handle serialization errors gracefully", async () => {
      const mockTierData: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal",
        snippets: [mockSnippet],
        metadata: {
          version: "1.0.0",
          created: "2025-01-01T00:00:00.000Z",
          modified: "2025-01-01T00:00:00.000Z",
          owner: "test-user",
          description: "Test tier",
        },
      };

      // Create circular reference to cause serialization error
      (mockTierData as any).circular = mockTierData;

      const result = await tierManager.saveTier("personal", mockTierData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Serialization failed");
    });

    test("should provide detailed error information", async () => {
      const mockManager = new PriorityTierManager();

      // Mock storage operation to fail
      jest
        .spyOn(mockManager as any, "saveTierToStorage")
        .mockRejectedValue(new Error("Storage unavailable"));

      const mockTierData: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal",
        snippets: [],
        metadata: {
          version: "1.0.0",
          created: "2025-01-01T00:00:00.000Z",
          modified: "2025-01-01T00:00:00.000Z",
          owner: "test-user",
          description: "Test tier",
        },
      };

      const result = await mockManager.saveTier("personal", mockTierData);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Storage unavailable");
      expect(result.tier).toBe("personal");
      expect(result.metadata?.operation).toBe("save");
    });
  });

  // ========================================================================
  // PERFORMANCE TESTS
  // ========================================================================

  describe("Performance and Optimization", () => {
    test("should complete operations within reasonable time", async () => {
      const startTime = Date.now();

      await tierManager.loadTier("personal");
      await tierManager.upsertSnippet(mockSnippet, "personal");

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    test("should handle multiple concurrent operations", async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        tierManager.upsertSnippet(
          {
            ...mockSnippet,
            id: `snippet-${i}`,
            trigger: `trigger-${i}`,
          },
          "personal",
        ),
      );

      const results = await Promise.all(operations);

      // All operations should succeed
      expect(results.every((r) => r.success)).toBe(true);
    });

    test("should provide performance metadata", async () => {
      const result = await tierManager.loadTier("personal");

      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.operation).toBe("load");
      expect(result.metadata?.fromCache).toBeDefined();
    });
  });
});
