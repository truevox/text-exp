/**
 * Tests for ExpansionDependencyManager
 * Comprehensive tests for recursive resolution and error handling
 */

import {
  ExpansionDependencyManager,
  DEFAULT_RESOLUTION_CONTEXT,
  DEFAULT_PERFORMANCE_SETTINGS,
  DEFAULT_ERROR_HANDLING,
} from "../../src/content/expansion-dependency-manager";
import type { DependencyResolutionContext } from "../../src/content/expansion-dependency-manager";
import type { TextSnippet } from "../../src/shared/types";
import type { EnhancedSnippet } from "../../src/types/snippet-formats";
import type { StoreSnippetMap } from "../../src/storage/snippet-dependency-resolver";

// Mock the usage tracking function
jest.mock("../../src/content/expansion-usage-logger", () => ({
  logExpansionUsage: jest.fn().mockResolvedValue({
    globalTrackingSuccess: true,
    perStoreTrackingSuccess: true,
    errors: [],
  }),
}));

describe("ExpansionDependencyManager", () => {
  let manager: ExpansionDependencyManager;
  let mockContext: DependencyResolutionContext;
  let mockStoreMap: StoreSnippetMap;

  // Test data
  const createSnippet = (
    id: string,
    trigger: string,
    content: string,
  ): TextSnippet =>
    ({
      id,
      trigger,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      variables: [],
      tags: [],
    }) as TextSnippet;

  const createEnhancedSnippet = (
    id: string,
    trigger: string,
    content: string,
    dependencies: string[] = [],
  ): EnhancedSnippet => ({
    id,
    trigger,
    content,
    contentType: "plaintext" as const,
    snipDependencies: dependencies,
    description: `Test snippet ${id}`,
    scope: "personal" as const,
    variables: [],
    images: [],
    tags: [],
    createdAt: new Date().toISOString(),
    createdBy: "test-user",
    updatedAt: new Date().toISOString(),
    updatedBy: "test-user",
  });

  beforeEach(() => {
    manager = new ExpansionDependencyManager();

    // Create test snippets
    const snippetA = createEnhancedSnippet("a", ";a", "Content A");
    const snippetB = createEnhancedSnippet(
      "b",
      ";b",
      "Content B with ;a dependency",
      [";a"],
    );
    const snippetC = createEnhancedSnippet(
      "c",
      ";c",
      "Content C with ;b dependency",
      [";b"],
    );
    const snippetD = createEnhancedSnippet(
      "d",
      ";d",
      "Content D with ;c dependency",
      [";c"],
    );

    mockStoreMap = {
      local: {
        snippets: [snippetA, snippetB, snippetC, snippetD],
        storeId: "local-storage",
        displayName: "Local Storage",
      },
    };

    mockContext = {
      ...DEFAULT_RESOLUTION_CONTEXT,
      rootSnippet: snippetA,
      availableStores: mockStoreMap,
      sessionId: "test-session",
      userId: "test-user",
    };
  });

  describe("Basic Functionality", () => {
    it("should initialize correctly", () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(ExpansionDependencyManager);
    });

    it("should expand snippet without dependencies", async () => {
      const snippet = createSnippet("simple", ";simple", "Simple content");

      const result = await manager.expandWithDependencies(snippet, mockContext);

      expect(result.success).toBe(true);
      expect(result.expandedContent).toBe("Simple content");
      expect(result.resolvedDependencies).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle snippet with basic variables", async () => {
      const snippet = createSnippet("vars", ";vars", "Hello {{name}}!");
      snippet.variables = [
        { name: "name", placeholder: "Enter name", defaultValue: "World" },
      ];

      const result = await manager.expandWithDependencies(snippet, mockContext);

      expect(result.success).toBe(true);
      expect(result.expandedContent).toBe("Hello World!"); // Uses default value
      expect(result.resolvedDependencies).toHaveLength(0);
    });
  });

  describe("Simple Dependency Resolution", () => {
    it("should resolve single dependency (A→B)", async () => {
      const snippetB = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";b",
      ) as EnhancedSnippet;

      const result = await manager.expandWithDependencies(snippetB, {
        ...mockContext,
        rootSnippet: snippetB,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedDependencies).toHaveLength(1);
      expect(result.resolvedDependencies[0].originalDependency).toBe(";a");
      expect(result.expandedContent).toContain("Content A");
    });

    it("should resolve dependency chain (A→B→C)", async () => {
      const snippetC = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";c",
      ) as EnhancedSnippet;

      const result = await manager.expandWithDependencies(snippetC, {
        ...mockContext,
        rootSnippet: snippetC,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedDependencies.length).toBeGreaterThanOrEqual(2);
      expect(
        result.resolvedDependencies.some((d) => d.originalDependency === ";b"),
      ).toBe(true);
      expect(
        result.resolvedDependencies.some((d) => d.originalDependency === ";a"),
      ).toBe(true);
    });

    it("should resolve long dependency chain (A→B→C→D)", async () => {
      const snippetD = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";d",
      ) as EnhancedSnippet;

      const result = await manager.expandWithDependencies(snippetD, {
        ...mockContext,
        rootSnippet: snippetD,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedDependencies.length).toBeGreaterThanOrEqual(3);
      expect(
        result.resolvedDependencies.some((d) => d.originalDependency === ";c"),
      ).toBe(true);
      expect(
        result.resolvedDependencies.some((d) => d.originalDependency === ";b"),
      ).toBe(true);
      expect(
        result.resolvedDependencies.some((d) => d.originalDependency === ";a"),
      ).toBe(true);
    });
  });

  describe("Multi-Store Resolution", () => {
    beforeEach(() => {
      // Add a second store with additional snippets
      const teamSnippet = createEnhancedSnippet(
        "team1",
        ";team",
        "Team content with ;a",
        [";a"],
      );

      mockStoreMap.team = {
        snippets: [teamSnippet],
        storeId: "team-storage",
        displayName: "Team Storage",
      };
    });

    it("should resolve dependencies across multiple stores", async () => {
      const teamSnippet = mockStoreMap.team.snippets[0];

      const result = await manager.expandWithDependencies(teamSnippet, {
        ...mockContext,
        rootSnippet: teamSnippet,
        availableStores: mockStoreMap,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedDependencies).toHaveLength(1);
      expect(result.resolvedDependencies[0].originalDependency).toBe(";a");
      expect(result.resolvedDependencies[0].metadata.sourceStore).toBe(
        "local-storage",
      );
    });

    it("should track which store each dependency came from", async () => {
      const teamSnippet = mockStoreMap.team.snippets[0];

      const result = await manager.expandWithDependencies(teamSnippet, {
        ...mockContext,
        rootSnippet: teamSnippet,
        availableStores: mockStoreMap,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedDependencies[0].metadata.sourceStore).toBe(
        "local-storage",
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle missing dependencies gracefully", async () => {
      const snippetWithMissing = createEnhancedSnippet(
        "missing",
        ";missing",
        "Content with ;nonexistent",
        [";nonexistent"],
      );

      const result = await manager.expandWithDependencies(snippetWithMissing, {
        ...mockContext,
        rootSnippet: snippetWithMissing,
        errorHandling: {
          ...DEFAULT_ERROR_HANDLING,
          missingDependencyStrategy: "WARN",
        },
      });

      expect(result.success).toBe(true); // Should continue despite missing dependency
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.message.includes("nonexistent"))).toBe(
        true,
      );
    });

    it("should detect circular dependencies", async () => {
      // Create circular dependency: E→F→E
      const snippetE = createEnhancedSnippet("e", ";e", "Content E with ;f", [
        ";f",
      ]);
      const snippetF = createEnhancedSnippet("f", ";f", "Content F with ;e", [
        ";e",
      ]);

      const circularStoreMap: StoreSnippetMap = {
        local: {
          snippets: [snippetE, snippetF],
          storeId: "local-storage",
          displayName: "Local Storage",
        },
      };

      const result = await manager.expandWithDependencies(snippetE, {
        ...mockContext,
        rootSnippet: snippetE,
        availableStores: circularStoreMap,
        errorHandling: {
          ...DEFAULT_ERROR_HANDLING,
          circularDependencyStrategy: "FAIL",
        },
      });

      expect(result.success).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.message.includes("circular") || e.message.includes("Circular"),
        ),
      ).toBe(true);
    });

    it("should respect maximum recursion depth", async () => {
      const snippetD = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";d",
      ) as EnhancedSnippet;

      const result = await manager.expandWithDependencies(snippetD, {
        ...mockContext,
        rootSnippet: snippetD,
        maxDepth: 2, // Very shallow depth
      });

      // Should still succeed but might not resolve all dependencies
      expect(result.success).toBe(true);
      expect(result.resolvedDependencies.length).toBeLessThanOrEqual(2);
    });

    it("should handle malformed snippet data", async () => {
      const malformedSnippet = {
        id: "malformed",
        trigger: ";malformed",
        content: null as any, // Malformed content
        snipDependencies: ["invalid"],
      } as EnhancedSnippet;

      const result = await manager.expandWithDependencies(
        malformedSnippet,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Performance and Caching", () => {
    it("should cache resolved dependencies", async () => {
      const snippetB = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";b",
      ) as EnhancedSnippet;

      // First resolution
      const startTime1 = Date.now();
      const result1 = await manager.expandWithDependencies(
        snippetB,
        mockContext,
      );
      const duration1 = Date.now() - startTime1;

      // Second resolution (should be faster due to caching)
      const startTime2 = Date.now();
      const result2 = await manager.expandWithDependencies(
        snippetB,
        mockContext,
      );
      const duration2 = Date.now() - startTime2;

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.expandedContent).toBe(result2.expandedContent);

      // Second call should be faster (though this might be flaky in CI)
      if (duration1 > 10) {
        // Only check if first call took meaningful time
        expect(duration2).toBeLessThanOrEqual(duration1);
      }
    });

    it("should respect performance timeout settings", async () => {
      const snippetD = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";d",
      ) as EnhancedSnippet;

      const result = await manager.expandWithDependencies(snippetD, {
        ...mockContext,
        rootSnippet: snippetD,
        performanceSettings: {
          ...DEFAULT_PERFORMANCE_SETTINGS,
          resolutionTimeout: 1, // Very short timeout
        },
      });

      // Should still try to complete but might warn about timing
      expect(result.success).toBe(true);
      expect(result.performanceMetrics?.totalExpansionTime).toBeDefined();
    });

    it("should limit concurrent resolutions", async () => {
      const snippetD = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";d",
      ) as EnhancedSnippet;

      const promises = Array.from({ length: 10 }, () =>
        manager.expandWithDependencies(snippetD, {
          ...mockContext,
          rootSnippet: snippetD,
          performanceSettings: {
            ...DEFAULT_PERFORMANCE_SETTINGS,
            maxParallelResolutions: 2,
          },
        }),
      );

      const results = await Promise.all(promises);

      // All should succeed despite concurrency limits
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe("Complex Dependency Graphs", () => {
    beforeEach(() => {
      // Create a more complex dependency graph
      // A ← B ← D
      //   ← C ←
      const snippetA = createEnhancedSnippet("a", ";a", "Base content A");
      const snippetB = createEnhancedSnippet("b", ";b", "Content B needs ;a", [
        ";a",
      ]);
      const snippetC = createEnhancedSnippet("c", ";c", "Content C needs ;a", [
        ";a",
      ]);
      const snippetD = createEnhancedSnippet(
        "d",
        ";d",
        "Content D needs ;b and ;c",
        [";b", ";c"],
      );

      mockStoreMap.local.snippets = [snippetA, snippetB, snippetC, snippetD];
    });

    it("should resolve multiple dependencies to same snippet", async () => {
      const snippetD = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";d",
      ) as EnhancedSnippet;

      const result = await manager.expandWithDependencies(snippetD, {
        ...mockContext,
        rootSnippet: snippetD,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedDependencies.length).toBeGreaterThanOrEqual(3);

      // Should have resolved A, B, and C
      const dependencies = result.resolvedDependencies.map(
        (d) => d.originalDependency,
      );
      expect(dependencies).toContain(";a");
      expect(dependencies).toContain(";b");
      expect(dependencies).toContain(";c");

      // A should appear only once despite being needed by both B and C
      const aCount = dependencies.filter((d) => d === ";a").length;
      expect(aCount).toBe(1);
    });

    it("should handle deep nested dependencies", async () => {
      // Create a deep chain: A→B→C→D→E→F
      const deepSnippets = Array.from({ length: 6 }, (_, i) => {
        const letter = String.fromCharCode(97 + i); // a, b, c, d, e, f
        const deps = i > 0 ? [`;${String.fromCharCode(97 + i - 1)}`] : [];
        return createEnhancedSnippet(
          letter,
          `;${letter}`,
          `Content ${letter.toUpperCase()}`,
          deps,
        );
      });

      mockStoreMap.local.snippets = deepSnippets;

      const deepestSnippet = deepSnippets[5]; // F snippet
      const result = await manager.expandWithDependencies(deepestSnippet, {
        ...mockContext,
        rootSnippet: deepestSnippet,
        maxDepth: 10,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedDependencies.length).toBe(5); // A through E
    });
  });

  describe("Integration with Variable Resolution", () => {
    it("should handle dependencies with variables", async () => {
      const snippetWithVars = createEnhancedSnippet(
        "vars",
        ";vars",
        "Hello {{name}} from ;a",
      );
      snippetWithVars.variables = [{ name: "name", prompt: "Enter name" }];
      snippetWithVars.snipDependencies = [";a"];

      mockStoreMap.local.snippets.push(snippetWithVars);

      const result = await manager.expandWithDependencies(snippetWithVars, {
        ...mockContext,
        rootSnippet: snippetWithVars,
      });

      expect(result.success).toBe(true);
      expect(result.resolvedDependencies).toHaveLength(1);
      expect(result.expandedContent).toContain("Hello");
      expect(result.expandedContent).toContain("Content A");
    });

    it("should resolve variables in dependency content", async () => {
      const depWithVars = createEnhancedSnippet(
        "depvar",
        ";depvar",
        "Dependency with {{value}}",
      );
      depWithVars.variables = [{ name: "value", prompt: "Enter value" }];

      const mainSnippet = createEnhancedSnippet(
        "main",
        ";main",
        "Main content with ;depvar",
        [";depvar"],
      );

      mockStoreMap.local.snippets = [depWithVars, mainSnippet];

      const result = await manager.expandWithDependencies(mainSnippet, {
        ...mockContext,
        rootSnippet: mainSnippet,
      });

      expect(result.success).toBe(true);
      expect(result.expandedContent).toContain("Dependency with");
    });
  });

  describe("Metadata and Reporting", () => {
    it("should provide detailed resolution metadata", async () => {
      const snippetC = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";c",
      ) as EnhancedSnippet;

      const result = await manager.expandWithDependencies(snippetC, {
        ...mockContext,
        rootSnippet: snippetC,
      });

      expect(result.success).toBe(true);
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics?.totalExpansionTime).toBeGreaterThan(0);
      expect(
        result.performanceMetrics?.dependenciesResolved,
      ).toBeGreaterThanOrEqual(0);
    });

    it("should track resolution statistics", async () => {
      const snippetD = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";d",
      ) as EnhancedSnippet;

      const result = await manager.expandWithDependencies(snippetD, {
        ...mockContext,
        rootSnippet: snippetD,
      });

      expect(result.success).toBe(true);
      expect(result.performanceMetrics?.maxDependencyDepth).toBeGreaterThan(0);
      expect(result.performanceMetrics?.dependenciesResolved).toBeGreaterThan(
        0,
      );
    });
  });

  describe("Usage Tracking Integration", () => {
    let logExpansionUsageMock: jest.Mock;

    beforeEach(() => {
      // Get the mock function
      logExpansionUsageMock =
        require("../../src/content/expansion-usage-logger").logExpansionUsage;
      logExpansionUsageMock.mockClear();
    });

    it("should track successful dependency expansion", async () => {
      const snippetB = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";b",
      ) as EnhancedSnippet;

      const result = await manager.expandWithDependencies(snippetB, {
        ...mockContext,
        rootSnippet: snippetB,
      });

      expect(result.success).toBe(true);
      expect(logExpansionUsageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: snippetB.id,
          trigger: snippetB.trigger,
          content: snippetB.content,
        }),
        true, // success
        undefined, // no error
        expect.objectContaining({
          targetElement: "dependency-resolved",
          dependencyChain: expect.any(String),
        }),
      );
    });

    it("should track expansion attempt regardless of outcome", async () => {
      // Test with a simple snippet to ensure tracking is called
      const snippet = createSnippet("test", ";test", "Test content");

      const result = await manager.expandWithDependencies(snippet, {
        ...mockContext,
        rootSnippet: snippet,
      });

      // Verify that usage tracking was called
      expect(logExpansionUsageMock).toHaveBeenCalled();
      expect(logExpansionUsageMock).toHaveBeenCalledTimes(1);

      // Check the first argument (snippet) has the correct structure
      const firstCall = logExpansionUsageMock.mock.calls[0];
      expect(firstCall[0]).toEqual(
        expect.objectContaining({
          id: snippet.id,
          trigger: snippet.trigger,
        }),
      );
    });

    it("should include dependency chain metadata when available", async () => {
      const snippet = createSnippet("meta", ";meta", "Meta content");

      const result = await manager.expandWithDependencies(snippet, {
        ...mockContext,
        rootSnippet: snippet,
      });

      // Verify that usage tracking was called with metadata
      expect(logExpansionUsageMock).toHaveBeenCalled();

      // Check the metadata parameter (4th argument)
      const firstCall = logExpansionUsageMock.mock.calls[0];
      expect(firstCall[3]).toEqual(
        expect.objectContaining({
          targetElement: "dependency-resolved",
          dependencyChain: expect.any(String),
        }),
      );
    });

    it("should handle usage tracking errors gracefully", async () => {
      // Make the usage tracking fail
      logExpansionUsageMock.mockRejectedValue(new Error("Tracking failed"));

      const snippetA = mockStoreMap.local.snippets.find(
        (s) => s.trigger === ";a",
      ) as EnhancedSnippet;

      // Should not throw even if tracking fails
      const result = await manager.expandWithDependencies(snippetA, {
        ...mockContext,
        rootSnippet: snippetA,
      });

      // Expansion should still succeed despite tracking failure
      expect(result.success).toBe(true);
      expect(logExpansionUsageMock).toHaveBeenCalled();
    });
  });
});
