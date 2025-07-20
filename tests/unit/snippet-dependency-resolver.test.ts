/**
 * Snippet Dependency Resolver Tests
 * Tests for unified cross-store snippet dependency format
 */

import {
  SnippetDependencyResolver,
  type ParsedDependency,
  type DependencyResolutionResult,
  type DependencyValidationResult,
  type StoreSnippetMap,
  type CircularDependencyResult,
  getSnippetDependencyResolver,
  parseDependency,
  formatDependency,
  validateDependencies,
  resolveDependencies,
} from "../../src/storage/snippet-dependency-resolver";
import type { TextSnippet } from "../../src/shared/types";
import type { EnhancedSnippet } from "../../src/types/snippet-formats";

describe("SnippetDependencyResolver", () => {
  let resolver: SnippetDependencyResolver;
  let mockStoreMap: StoreSnippetMap;
  let mockTextSnippets: TextSnippet[];
  let mockEnhancedSnippets: EnhancedSnippet[];

  beforeEach(() => {
    resolver = new SnippetDependencyResolver();

    // Create mock TextSnippets
    mockTextSnippets = [
      {
        id: "greeting-1",
        trigger: ";hello",
        content: "Hello {{name}}!",
        contentType: "plaintext",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
        usageCount: 5,
        lastUsed: new Date("2023-01-10"),
      },
      {
        id: "signature-1",
        trigger: ";sig",
        content: "Best regards,\n{{name}}",
        contentType: "plaintext",
        createdAt: new Date("2023-01-02"),
        updatedAt: new Date("2023-01-02"),
        usageCount: 3,
        lastUsed: new Date("2023-01-08"),
      },
    ];

    // Create mock EnhancedSnippets
    mockEnhancedSnippets = [
      {
        id: "team-greeting-1",
        trigger: ";teamhello",
        content: "<p>Hello <strong>{{name}}</strong>!</p>",
        contentType: "html",
        snipDependencies: ["appdata-store:;hello:greeting-1"],
        description: "Team greeting",
        scope: "team",
        variables: [{ name: "name", prompt: "Enter name" }],
        images: [],
        tags: ["greeting", "team"],
        createdAt: "2023-01-01T00:00:00Z",
        createdBy: "user1",
        updatedAt: "2023-01-01T00:00:00Z",
        updatedBy: "user1",
      },
      {
        id: "team-signature-1",
        trigger: ";teamsig",
        content: "<p>Best regards,<br>{{name}}</p>",
        contentType: "html",
        snipDependencies: ["appdata-store:;sig:signature-1"],
        description: "Team signature",
        scope: "team",
        variables: [{ name: "name", prompt: "Enter name" }],
        images: [],
        tags: ["signature", "team"],
        createdAt: "2023-01-02T00:00:00Z",
        createdBy: "user2",
        updatedAt: "2023-01-02T00:00:00Z",
        updatedBy: "user2",
      },
    ];

    // Create mock store map
    mockStoreMap = {
      "appdata-store": {
        snippets: mockTextSnippets,
        storeId: "appdata-store",
        displayName: "Personal Snippets",
      },
      "team-store": {
        snippets: mockEnhancedSnippets,
        storeId: "team-store",
        displayName: "Team Snippets",
      },
    };
  });

  describe("Dependency Parsing", () => {
    it("should parse valid dependency format", () => {
      const result = resolver.parseDependency(
        "appdata-store:;hello:greeting-1",
      );

      expect(result.isValid).toBe(true);
      expect(result.storeName).toBe("appdata-store");
      expect(result.trigger).toBe(";hello");
      expect(result.id).toBe("greeting-1");
      expect(result.original).toBe("appdata-store:;hello:greeting-1");
      expect(result.error).toBeUndefined();
    });

    it("should handle whitespace in components", () => {
      const result = resolver.parseDependency(
        " appdata-store : ;hello : greeting-1 ",
      );

      expect(result.isValid).toBe(true);
      expect(result.storeName).toBe("appdata-store");
      expect(result.trigger).toBe(";hello");
      expect(result.id).toBe("greeting-1");
    });

    it("should reject invalid dependency format", () => {
      const result = resolver.parseDependency("invalid-format");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid dependency format");
      expect(result.error).toContain('Expected "store-name:trigger:id"');
    });

    it("should reject empty store name", () => {
      const result = resolver.parseDependency(":;hello:greeting-1");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Store name cannot be empty");
    });

    it("should reject empty trigger", () => {
      const result = resolver.parseDependency("appdata-store::greeting-1");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Trigger cannot be empty");
    });

    it("should reject empty ID", () => {
      const result = resolver.parseDependency("appdata-store:;hello:");

      expect(result.isValid).toBe(false);
      expect(result.error).toBe("ID cannot be empty");
    });

    it("should handle complex store names and triggers", () => {
      const result = resolver.parseDependency(
        "my-team-store-2023:;complex-trigger-name:uuid-123-456",
      );

      expect(result.isValid).toBe(true);
      expect(result.storeName).toBe("my-team-store-2023");
      expect(result.trigger).toBe(";complex-trigger-name");
      expect(result.id).toBe("uuid-123-456");
    });
  });

  describe("Dependency Formatting", () => {
    it("should format dependency correctly", () => {
      const result = resolver.formatDependency(
        "appdata-store",
        ";hello",
        "greeting-1",
      );
      expect(result).toBe("appdata-store:;hello:greeting-1");
    });

    it("should trim whitespace in components", () => {
      const result = resolver.formatDependency(
        " appdata-store ",
        " ;hello ",
        " greeting-1 ",
      );
      expect(result).toBe("appdata-store:;hello:greeting-1");
    });

    it("should throw error for missing components", () => {
      expect(() =>
        resolver.formatDependency("", ";hello", "greeting-1"),
      ).toThrow();
      expect(() =>
        resolver.formatDependency("store", "", "greeting-1"),
      ).toThrow();
      expect(() => resolver.formatDependency("store", ";hello", "")).toThrow();
    });
  });

  describe("Dependency Validation", () => {
    it("should validate correct dependencies", () => {
      const dependencies = [
        "appdata-store:;hello:greeting-1",
        "team-store:;teamhello:team-greeting-1",
      ];

      const result = resolver.validateDependencies(dependencies, mockStoreMap);

      expect(result.isValid).toBe(true);
      expect(result.validDependencies).toHaveLength(2);
      expect(result.invalidDependencies).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid dependency format", () => {
      const dependencies = [
        "invalid-format",
        "appdata-store:;hello:greeting-1",
      ];

      const result = resolver.validateDependencies(dependencies, mockStoreMap);

      expect(result.isValid).toBe(false);
      expect(result.validDependencies).toHaveLength(1);
      expect(result.invalidDependencies).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Invalid dependency format");
    });

    it("should detect non-existent store", () => {
      const dependencies = ["non-existent-store:;hello:greeting-1"];

      const result = resolver.validateDependencies(dependencies, mockStoreMap);

      expect(result.isValid).toBe(false);
      expect(result.invalidDependencies).toHaveLength(1);
      expect(result.errors[0]).toContain(
        'Store "non-existent-store" does not exist',
      );
    });

    it("should warn about missing snippets", () => {
      const dependencies = ["appdata-store:;hello:non-existent-snippet"];

      const result = resolver.validateDependencies(dependencies, mockStoreMap, {
        generateWarnings: true,
      });

      expect(result.isValid).toBe(true); // Format is valid
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain(
        'Snippet with ID "non-existent-snippet" not found',
      );
    });

    it("should skip store validation when disabled", () => {
      const dependencies = ["non-existent-store:;hello:greeting-1"];

      const result = resolver.validateDependencies(dependencies, mockStoreMap, {
        validateStoreExistence: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.validDependencies).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it("should skip snippet validation when disabled", () => {
      const dependencies = ["appdata-store:;hello:non-existent-snippet"];

      const result = resolver.validateDependencies(dependencies, mockStoreMap, {
        validateSnippetExistence: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("Dependency Resolution", () => {
    it("should resolve existing dependency", () => {
      const result = resolver.resolveDependency(
        "appdata-store:;hello:greeting-1",
        mockStoreMap,
      );

      expect(result.resolved).toBe(true);
      expect(result.storeExists).toBe(true);
      expect(result.snippetExists).toBe(true);
      expect(result.snippet).toBeDefined();
      expect(result.snippet!.id).toBe("greeting-1");
      expect(result.error).toBeUndefined();
    });

    it("should handle non-existent store", () => {
      const result = resolver.resolveDependency(
        "non-existent-store:;hello:greeting-1",
        mockStoreMap,
      );

      expect(result.resolved).toBe(false);
      expect(result.storeExists).toBe(false);
      expect(result.snippetExists).toBeUndefined();
      expect(result.snippet).toBeUndefined();
      expect(result.error).toContain(
        'Store "non-existent-store" does not exist',
      );
    });

    it("should handle non-existent snippet", () => {
      const result = resolver.resolveDependency(
        "appdata-store:;hello:non-existent-snippet",
        mockStoreMap,
      );

      expect(result.resolved).toBe(false);
      expect(result.storeExists).toBe(true);
      expect(result.snippetExists).toBe(false);
      expect(result.snippet).toBeUndefined();
      expect(result.error).toContain(
        'Snippet with ID "non-existent-snippet" not found',
      );
    });

    it("should handle invalid dependency format", () => {
      const result = resolver.resolveDependency("invalid-format", mockStoreMap);

      expect(result.resolved).toBe(false);
      expect(result.dependency.isValid).toBe(false);
      expect(result.error).toContain("Invalid dependency format");
    });

    it("should resolve multiple dependencies", () => {
      const dependencies = [
        "appdata-store:;hello:greeting-1",
        "appdata-store:;sig:signature-1",
        "team-store:;teamhello:team-greeting-1",
      ];

      const results = resolver.resolveDependencies(dependencies, mockStoreMap);

      expect(results).toHaveLength(3);
      expect(results.filter((r) => r.resolved)).toHaveLength(3);
      expect(results.filter((r) => !r.resolved)).toHaveLength(0);

      const stats = resolver.getLastStats();
      expect(stats).toBeDefined();
      expect(stats!.totalDependencies).toBe(3);
      expect(stats!.resolvedDependencies).toBe(3);
      expect(stats!.storesReferenced).toBe(2);
    });

    it("should use caching for repeated resolutions", () => {
      const dependency = "appdata-store:;hello:greeting-1";

      // First resolution
      const result1 = resolver.resolveDependency(dependency, mockStoreMap);
      expect(result1.resolved).toBe(true);

      // Second resolution should use cache
      const result2 = resolver.resolveDependency(dependency, mockStoreMap);
      expect(result2.resolved).toBe(true);

      const cacheStats = resolver.getCacheStats();
      expect(cacheStats.resolutionCacheSize).toBe(1);
    });

    it("should disable caching when requested", () => {
      const dependency = "appdata-store:;hello:greeting-1";

      resolver.resolveDependency(dependency, mockStoreMap, {
        enableCaching: false,
      });
      resolver.resolveDependency(dependency, mockStoreMap, {
        enableCaching: false,
      });

      const cacheStats = resolver.getCacheStats();
      expect(cacheStats.resolutionCacheSize).toBe(0);
    });
  });

  describe("Circular Dependency Detection", () => {
    it("should detect simple circular dependency", () => {
      const circularSnippets: EnhancedSnippet[] = [
        {
          ...mockEnhancedSnippets[0],
          id: "snippet-a",
          snipDependencies: ["team-store:;b:snippet-b"],
        },
        {
          ...mockEnhancedSnippets[1],
          id: "snippet-b",
          snipDependencies: ["team-store:;a:snippet-a"],
        },
      ];

      const result = resolver.detectCircularDependencies(
        circularSnippets,
        mockStoreMap,
      );

      expect(result.hasCircularDependencies).toBe(true);
      expect(result.cycles).toHaveLength(1);
      expect(result.cycles[0]).toContain("snippet-a");
      expect(result.cycles[0]).toContain("snippet-b");
      expect(result.affectedSnippets).toContain("snippet-a");
      expect(result.affectedSnippets).toContain("snippet-b");
    });

    it("should detect complex circular dependency", () => {
      const circularSnippets: EnhancedSnippet[] = [
        {
          ...mockEnhancedSnippets[0],
          id: "snippet-a",
          snipDependencies: ["team-store:;b:snippet-b"],
        },
        {
          ...mockEnhancedSnippets[1],
          id: "snippet-b",
          snipDependencies: ["team-store:;c:snippet-c"],
        },
        {
          ...mockEnhancedSnippets[0],
          id: "snippet-c",
          snipDependencies: ["team-store:;a:snippet-a"],
        },
      ];

      const result = resolver.detectCircularDependencies(
        circularSnippets,
        mockStoreMap,
      );

      expect(result.hasCircularDependencies).toBe(true);
      expect(result.cycles).toHaveLength(1);
      expect(result.affectedSnippets).toContain("snippet-a");
      expect(result.affectedSnippets).toContain("snippet-b");
      expect(result.affectedSnippets).toContain("snippet-c");
    });

    it("should handle no circular dependencies", () => {
      const result = resolver.detectCircularDependencies(
        mockEnhancedSnippets,
        mockStoreMap,
      );

      expect(result.hasCircularDependencies).toBe(false);
      expect(result.cycles).toHaveLength(0);
      expect(result.affectedSnippets).toHaveLength(0);
    });

    it("should handle maximum depth limit", () => {
      const deepSnippets: EnhancedSnippet[] = Array(100)
        .fill(null)
        .map((_, i) => ({
          ...mockEnhancedSnippets[0],
          id: `snippet-${i}`,
          snipDependencies:
            i < 99 ? [`team-store:;${i + 1}:snippet-${i + 1}`] : [],
        }));

      const result = resolver.detectCircularDependencies(
        deepSnippets,
        mockStoreMap,
        {
          maxResolutionDepth: 50,
        },
      );

      expect(result.hasCircularDependencies).toBe(false);
    });
  });

  describe("Legacy Dependency Conversion", () => {
    it("should convert legacy trigger format", () => {
      const legacyDeps = [";hello", ";goodbye"];
      const result = resolver.convertToUnifiedFormat(
        legacyDeps,
        "appdata-store",
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatch(/^appdata-store:;hello:legacy-hello-\d+$/);
      expect(result[1]).toMatch(/^appdata-store:;goodbye:legacy-goodbye-\d+$/);
    });

    it("should convert legacy ID format", () => {
      const legacyDeps = ["greeting-1", "signature-1"];
      const result = resolver.convertToUnifiedFormat(
        legacyDeps,
        "appdata-store",
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toBe("appdata-store:;greeting-1:greeting-1");
      expect(result[1]).toBe("appdata-store:;signature-1:signature-1");
    });

    it("should use snippet lookup for trigger mapping", () => {
      const legacyDeps = [";hello"];
      const snippetLookup = new Map([[";hello", "greeting-1"]]);

      const result = resolver.convertToUnifiedFormat(
        legacyDeps,
        "appdata-store",
        snippetLookup,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("appdata-store:;hello:greeting-1");
    });

    it("should preserve already unified dependencies", () => {
      const mixedDeps = ["appdata-store:;hello:greeting-1", ";goodbye"];

      const result = resolver.convertToUnifiedFormat(
        mixedDeps,
        "appdata-store",
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toBe("appdata-store:;hello:greeting-1");
      expect(result[1]).toMatch(/^appdata-store:;goodbye:legacy-goodbye-\d+$/);
    });
  });

  describe("Snippet Dependency Management", () => {
    it("should extract dependencies from EnhancedSnippet", () => {
      const deps = resolver.extractDependencies(mockEnhancedSnippets[0]);
      expect(deps).toEqual(["appdata-store:;hello:greeting-1"]);
    });

    it("should extract dependencies from TextSnippet with dependencies", () => {
      const snippetWithDeps = {
        ...mockTextSnippets[0],
        dependencies: ["appdata-store:;sig:signature-1"],
      } as any;

      const deps = resolver.extractDependencies(snippetWithDeps);
      expect(deps).toEqual(["appdata-store:;sig:signature-1"]);
    });

    it("should return empty array for snippets without dependencies", () => {
      const deps = resolver.extractDependencies(mockTextSnippets[0]);
      expect(deps).toEqual([]);
    });

    it("should update snippet dependencies", () => {
      const newDeps = [
        "appdata-store:;hello:greeting-1",
        "team-store:;teamhello:team-greeting-1",
      ];
      const updatedSnippet = resolver.updateSnippetDependencies(
        mockEnhancedSnippets[0],
        newDeps,
      );

      expect((updatedSnippet as EnhancedSnippet).snipDependencies).toEqual(newDeps);
      expect(updatedSnippet.updatedAt).not.toBe(
        mockEnhancedSnippets[0].updatedAt,
      );
    });

    it("should add dependencies to TextSnippet", () => {
      const newDeps = ["appdata-store:;sig:signature-1"];
      const updatedSnippet = resolver.updateSnippetDependencies(
        mockTextSnippets[0],
        newDeps,
      );

      expect((updatedSnippet as any).snipDependencies).toEqual(newDeps);
      expect(updatedSnippet.updatedAt).not.toBe(mockTextSnippets[0].updatedAt);
    });
  });

  describe("Cache Management", () => {
    it("should clear all caches", () => {
      // Populate caches
      resolver.resolveDependency(
        "appdata-store:;hello:greeting-1",
        mockStoreMap,
      );
      resolver.validateDependencies(
        ["appdata-store:;hello:greeting-1"],
        mockStoreMap,
      );

      expect(resolver.getCacheStats().resolutionCacheSize).toBe(1);
      expect(resolver.getCacheStats().validationCacheSize).toBe(1);

      resolver.clearCache();

      expect(resolver.getCacheStats().resolutionCacheSize).toBe(0);
      expect(resolver.getCacheStats().validationCacheSize).toBe(0);
    });

    it("should provide cache statistics", () => {
      const stats = resolver.getCacheStats();
      expect(stats).toHaveProperty("resolutionCacheSize");
      expect(stats).toHaveProperty("validationCacheSize");
    });
  });

  describe("Statistics", () => {
    it("should track resolution statistics", () => {
      const dependencies = [
        "appdata-store:;hello:greeting-1",
        "appdata-store:;sig:signature-1",
        "non-existent-store:;hello:greeting-1",
      ];

      resolver.resolveDependencies(dependencies, mockStoreMap);
      const stats = resolver.getLastStats();

      expect(stats).toBeDefined();
      expect(stats!.totalDependencies).toBe(3);
      expect(stats!.resolvedDependencies).toBe(2);
      expect(stats!.unresolvedDependencies).toBe(1);
      expect(stats!.storesReferenced).toBe(2);
      expect(stats!.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should return null stats before any operations", () => {
      const newResolver = new SnippetDependencyResolver();
      expect(newResolver.getLastStats()).toBeNull();
    });
  });

  describe("Convenience Functions", () => {
    it("should provide global resolver instance", () => {
      const instance1 = getSnippetDependencyResolver();
      const instance2 = getSnippetDependencyResolver();
      expect(instance1).toBe(instance2);
    });

    it("should provide convenience parsing function", () => {
      const result = parseDependency("appdata-store:;hello:greeting-1");
      expect(result.isValid).toBe(true);
      expect(result.storeName).toBe("appdata-store");
    });

    it("should provide convenience formatting function", () => {
      const result = formatDependency("appdata-store", ";hello", "greeting-1");
      expect(result).toBe("appdata-store:;hello:greeting-1");
    });

    it("should provide convenience validation function", () => {
      const result = validateDependencies(
        ["appdata-store:;hello:greeting-1"],
        mockStoreMap,
      );
      expect(result.isValid).toBe(true);
    });

    it("should provide convenience resolution function", () => {
      const results = resolveDependencies(
        ["appdata-store:;hello:greeting-1"],
        mockStoreMap,
      );
      expect(results).toHaveLength(1);
      expect(results[0].resolved).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty dependency arrays", () => {
      const validationResult = resolver.validateDependencies([], mockStoreMap);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.validDependencies).toHaveLength(0);

      const resolutionResults = resolver.resolveDependencies([], mockStoreMap);
      expect(resolutionResults).toHaveLength(0);
    });

    it("should handle empty store map", () => {
      const result = resolver.resolveDependency(
        "appdata-store:;hello:greeting-1",
        {},
      );
      expect(result.resolved).toBe(false);
      expect(result.storeExists).toBe(false);
    });

    it("should handle malformed dependency strings", () => {
      const malformedDeps = ["", "a:b", "a:b:c:d:e"];

      malformedDeps.forEach((dep) => {
        const result = resolver.parseDependency(dep);
        expect(result.isValid).toBe(false);
      });
    });

    it("should handle special characters in components", () => {
      const result = resolver.parseDependency(
        "store-with-dashes:;trigger@with#special:id_with_underscores",
      );
      expect(result.isValid).toBe(true);
      expect(result.storeName).toBe("store-with-dashes");
      expect(result.trigger).toBe(";trigger@with#special");
      expect(result.id).toBe("id_with_underscores");
    });

    it("should handle very long dependency chains", () => {
      const longChain = Array(1000)
        .fill(null)
        .map((_, i) => `store-${i}:;trigger-${i}:id-${i}`);

      const validationResult = resolver.validateDependencies(
        longChain,
        {},
        {
          validateStoreExistence: false,
          validateSnippetExistence: false,
        },
      );

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.validDependencies).toHaveLength(1000);
    });
  });
});
