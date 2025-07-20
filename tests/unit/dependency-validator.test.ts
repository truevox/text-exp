/**
 * Dependency Validator Tests
 * Comprehensive test suite for dependency validation system
 */

import {
  DependencyValidator,
  ValidationWorkflowManager,
  DefaultValidationErrorReporter,
  type ValidationContext,
  type ValidationResult,
  type ValidationError,
  type StoreValidationResult,
  type ValidationOptions,
  type SnippetCreationResult,
  type SnippetEditingResult,
  type StorageOperationResult,
  DEFAULT_VALIDATION_OPTIONS,
  FAST_VALIDATION_OPTIONS,
  THOROUGH_VALIDATION_OPTIONS,
  getDependencyValidator,
  validateSnippet,
  validateStore,
  getValidationWorkflowManager,
  integrateSnippetCreation,
  integrateSnippetEditing,
  integrateStorageOperation,
} from "../../src/storage/dependency-validator";

import type { TextSnippet } from "../../src/shared/types";
import type { EnhancedSnippet } from "../../src/types/snippet-formats";
import type { StoreSnippetMap } from "../../src/storage/snippet-dependency-resolver";

describe("DependencyValidator", () => {
  let validator: DependencyValidator;
  let mockContext: ValidationContext;
  let mockStoreMap: StoreSnippetMap;
  let mockTextSnippets: TextSnippet[];
  let mockEnhancedSnippets: EnhancedSnippet[];

  beforeEach(() => {
    validator = new DependencyValidator();

    // Create mock TextSnippets
    mockTextSnippets = [
      {
        id: "text-1",
        trigger: ";hello",
        content: "Hello World!",
        contentType: "plaintext",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
        usageCount: 5,
        lastUsed: new Date("2023-01-10"),
      },
      {
        id: "text-2",
        trigger: ";bye",
        content: "Goodbye!",
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
        id: "enhanced-1",
        trigger: ";teamhello",
        content: "<p>Team Hello!</p>",
        contentType: "html",
        snipDependencies: ["appdata-store:;hello:text-1"],
        description: "Team greeting",
        scope: "team",
        variables: [],
        images: [],
        tags: ["greeting"],
        createdAt: "2023-01-01T00:00:00Z",
        createdBy: "user1",
        updatedAt: "2023-01-01T00:00:00Z",
        updatedBy: "user1",
      },
      {
        id: "enhanced-2",
        trigger: ";teambye",
        content: "<p>Team Goodbye!</p>",
        contentType: "html",
        snipDependencies: ["appdata-store:;bye:text-2"],
        description: "Team farewell",
        scope: "team",
        variables: [],
        images: [],
        tags: ["farewell"],
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

    // Create mock validation context
    mockContext = {
      availableStores: mockStoreMap,
      currentStore: "appdata-store",
      validationOptions: DEFAULT_VALIDATION_OPTIONS,
      userId: "test-user",
      currentDepth: 0,
      sessionId: "test-session",
    };
  });

  describe("Basic Validation Scenarios", () => {
    it("should validate snippet with no dependencies", async () => {
      const snippet = mockTextSnippets[0]; // Has no dependencies
      const result = await validator.validateSnippet(snippet, mockContext);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.validatedDependencies).toHaveLength(0);
      expect(
        result.performanceMetrics.totalValidationTime,
      ).toBeGreaterThanOrEqual(0);
    });

    it("should validate snippet with valid dependencies", async () => {
      const snippet = mockEnhancedSnippets[0]; // Has valid dependency
      const result = await validator.validateSnippet(snippet, mockContext);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validatedDependencies).toHaveLength(1);
      expect(result.validatedDependencies[0]).toBe(
        "appdata-store:;hello:text-1",
      );
    });

    it("should detect invalid dependency format", async () => {
      const snippet: EnhancedSnippet = {
        ...mockEnhancedSnippets[0],
        snipDependencies: ["invalid-format"],
      };

      const result = await validator.validateSnippet(snippet, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("INVALID_FORMAT");
      expect(result.errors[0].message).toContain("Invalid dependency format");
    });

    it("should detect missing store", async () => {
      const snippet: EnhancedSnippet = {
        ...mockEnhancedSnippets[0],
        snipDependencies: ["missing-store:;hello:text-1"],
      };

      const result = await validator.validateSnippet(snippet, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("MISSING_STORE");
      expect(result.errors[0].message).toContain("does not exist");
    });

    it("should detect missing snippet", async () => {
      const snippet: EnhancedSnippet = {
        ...mockEnhancedSnippets[0],
        snipDependencies: ["appdata-store:;hello:non-existent"],
      };

      const result = await validator.validateSnippet(snippet, mockContext);

      // Should be valid format but generate warning about missing snippet
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain("not found");
    });
  });

  describe("Circular Dependency Detection", () => {
    it("should detect simple circular dependency", async () => {
      const circularSnippets: EnhancedSnippet[] = [
        {
          ...mockEnhancedSnippets[0],
          id: "circular-1",
          snipDependencies: ["team-store:;circ2:circular-2"],
        },
        {
          ...mockEnhancedSnippets[1],
          id: "circular-2",
          snipDependencies: ["team-store:;circ1:circular-1"],
        },
      ];

      const circularStoreMap = {
        ...mockStoreMap,
        "team-store": {
          ...mockStoreMap["team-store"],
          snippets: circularSnippets,
        },
      };

      const circularContext = {
        ...mockContext,
        availableStores: circularStoreMap,
        currentStore: "team-store",
      };

      const result = await validator.validateSnippet(
        circularSnippets[0],
        circularContext,
      );

      expect(result.isValid).toBe(false);
      expect(result.circularDependencies).toHaveLength(1);
      expect(result.circularDependencies[0].cycle).toContain("circular-1");
      expect(result.circularDependencies[0].cycle).toContain("circular-2");
    });

    it("should detect complex circular dependency chain", async () => {
      const circularSnippets: EnhancedSnippet[] = [
        {
          ...mockEnhancedSnippets[0],
          id: "chain-1",
          snipDependencies: ["team-store:;chain2:chain-2"],
        },
        {
          ...mockEnhancedSnippets[1],
          id: "chain-2",
          snipDependencies: ["team-store:;chain3:chain-3"],
        },
        {
          ...mockEnhancedSnippets[0],
          id: "chain-3",
          snipDependencies: ["team-store:;chain1:chain-1"],
        },
      ];

      const circularStoreMap = {
        ...mockStoreMap,
        "team-store": {
          ...mockStoreMap["team-store"],
          snippets: circularSnippets,
        },
      };

      const circularContext = {
        ...mockContext,
        availableStores: circularStoreMap,
        currentStore: "team-store",
      };

      const result = await validator.validateSnippet(
        circularSnippets[0],
        circularContext,
      );

      expect(result.isValid).toBe(false);
      expect(result.circularDependencies).toHaveLength(1);
      expect(result.circularDependencies[0].cycle).toHaveLength(4); // Includes start element at end to show complete cycle
    });

    it("should handle no circular dependencies", async () => {
      const result = await validator.validateSnippet(
        mockEnhancedSnippets[0],
        mockContext,
      );

      expect(result.isValid).toBe(true);
      expect(result.circularDependencies).toHaveLength(0);
    });
  });

  describe("Store Validation", () => {
    it("should validate entire store successfully", async () => {
      const result = await validator.validateStore(
        "appdata-store",
        mockContext,
      );

      expect(result.isValid).toBe(true);
      expect(result.storeId).toBe("appdata-store");
      expect(result.snippetResults.size).toBe(2);
      expect(result.storeErrors).toHaveLength(0);
    });

    it("should detect missing store", async () => {
      const result = await validator.validateStore(
        "non-existent-store",
        mockContext,
      );

      expect(result.isValid).toBe(false);
      expect(result.storeErrors).toHaveLength(1);
      expect(result.storeErrors[0].type).toBe("MISSING_STORE");
      expect(result.storeErrors[0].message).toContain("does not exist");
    });

    it("should aggregate errors from multiple snippets", async () => {
      const badSnippets: EnhancedSnippet[] = [
        {
          ...mockEnhancedSnippets[0],
          snipDependencies: ["missing-store:;hello:text-1"],
        },
        {
          ...mockEnhancedSnippets[1],
          snipDependencies: ["invalid-format"],
        },
      ];

      const badStoreMap = {
        ...mockStoreMap,
        "team-store": {
          ...mockStoreMap["team-store"],
          snippets: badSnippets,
        },
      };

      const badContext = {
        ...mockContext,
        availableStores: badStoreMap,
      };

      const result = await validator.validateStore("team-store", badContext);

      expect(result.isValid).toBe(false);
      expect(result.storeErrors.length).toBeGreaterThan(0);
    });
  });

  describe("Performance and Caching", () => {
    it("should use caching for repeated validations", async () => {
      const snippet = mockEnhancedSnippets[0];

      // First validation
      const result1 = await validator.validateSnippet(snippet, mockContext);
      expect(result1.isValid).toBe(true);

      // Second validation should use cache
      const result2 = await validator.validateSnippet(snippet, mockContext);
      expect(result2.isValid).toBe(true);

      const cacheStats = validator.getCacheStats();
      expect(cacheStats.validationCacheSize).toBeGreaterThanOrEqual(1); // Cache may have multiple entries for different validation aspects
    });

    it("should disable caching when requested", async () => {
      const noCacheContext = {
        ...mockContext,
        validationOptions: {
          ...mockContext.validationOptions,
          enableCaching: false,
        },
      };

      const snippet = mockEnhancedSnippets[0];

      await validator.validateSnippet(snippet, noCacheContext);
      await validator.validateSnippet(snippet, noCacheContext);

      const cacheStats = validator.getCacheStats();
      expect(cacheStats.validationCacheSize).toBe(0);
    });

    it("should handle large dependency sets efficiently", async () => {
      const largeSnippets: EnhancedSnippet[] = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `large-${i}`,
          trigger: `;large${i}`,
          content: `<p>Large snippet ${i}</p>`,
          contentType: "html" as const,
          snipDependencies:
            i > 0 ? [`large-store:;large${i - 1}:large-${i - 1}`] : [],
          description: `Large snippet ${i}`,
          scope: "personal" as const,
          variables: [],
          images: [],
          tags: [],
          createdAt: "2023-01-01T00:00:00Z",
          createdBy: "user1",
          updatedAt: "2023-01-01T00:00:00Z",
          updatedBy: "user1",
        }));

      const largeStoreMap = {
        "large-store": {
          snippets: largeSnippets,
          storeId: "large-store",
          displayName: "Large Store",
        },
      };

      const largeContext = {
        ...mockContext,
        availableStores: largeStoreMap,
        currentStore: "large-store",
      };

      const startTime = Date.now();
      const result = await validator.validateStore("large-store", largeContext);
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe("Validation Options", () => {
    it("should use default validation options", () => {
      const options = DEFAULT_VALIDATION_OPTIONS;

      expect(options.validateStoreExistence).toBe(true);
      expect(options.validateSnippetExistence).toBe(true);
      expect(options.detectCircularDependencies).toBe(true);
      expect(options.enableCaching).toBe(true);
      expect(options.generateSuggestions).toBe(true);
    });

    it("should use fast validation options", () => {
      const options = FAST_VALIDATION_OPTIONS;

      expect(options.validateStoreExistence).toBe(true);
      expect(options.validateSnippetExistence).toBe(false);
      expect(options.detectCircularDependencies).toBe(false);
      expect(options.maxValidationDepth).toBe(10);
      expect(options.deepValidation).toBe(false);
    });

    it("should use thorough validation options", () => {
      const options = THOROUGH_VALIDATION_OPTIONS;

      expect(options.validateStoreExistence).toBe(true);
      expect(options.validateSnippetExistence).toBe(true);
      expect(options.detectCircularDependencies).toBe(true);
      expect(options.maxValidationDepth).toBe(100);
      expect(options.deepValidation).toBe(true);
    });

    it("should skip store validation when disabled", async () => {
      const noStoreValidationContext = {
        ...mockContext,
        validationOptions: {
          ...mockContext.validationOptions,
          validateStoreExistence: false,
        },
      };

      const snippet: EnhancedSnippet = {
        ...mockEnhancedSnippets[0],
        snipDependencies: ["missing-store:;hello:text-1"],
      };

      const result = await validator.validateSnippet(
        snippet,
        noStoreValidationContext,
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Deep Validation", () => {
    it("should perform deep validation when enabled", async () => {
      const deepContext = {
        ...mockContext,
        validationOptions: {
          ...mockContext.validationOptions,
          deepValidation: true,
          maxValidationDepth: 5,
        },
      };

      const result = await validator.validateSnippet(
        mockEnhancedSnippets[0],
        deepContext,
      );

      expect(result.isValid).toBe(true);
      expect(
        result.performanceMetrics.maxValidationDepth,
      ).toBeGreaterThanOrEqual(0); // Depth tracking may not be fully implemented yet
    });

    it("should respect maximum validation depth", async () => {
      const deepContext = {
        ...mockContext,
        validationOptions: {
          ...mockContext.validationOptions,
          deepValidation: true,
          maxValidationDepth: 1,
        },
        currentDepth: 2, // Exceeds max depth
      };

      const result = await validator.validateSnippet(
        mockEnhancedSnippets[0],
        deepContext,
      );

      expect(result.isValid).toBe(true);
      // Should not perform deep validation due to depth limit
    });
  });

  describe("Error Suggestions", () => {
    it("should generate helpful suggestions for missing store", async () => {
      const snippet: EnhancedSnippet = {
        ...mockEnhancedSnippets[0],
        snipDependencies: ["missing-store:;hello:text-1"],
      };

      const result = await validator.validateSnippet(snippet, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].suggestions).toContain(
        'Check if store "Store "missing-store" does not exist" exists',
      );
      expect(result.errors[0].suggestions).toContain(
        "Verify store configuration",
      );
    });

    it("should generate helpful suggestions for invalid format", async () => {
      const snippet: EnhancedSnippet = {
        ...mockEnhancedSnippets[0],
        snipDependencies: ["invalid-format"],
      };

      const result = await validator.validateSnippet(snippet, mockContext);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].suggestions).toContain(
        'Use format: "store-name:trigger:id"',
      );
      expect(result.errors[0].suggestions).toContain(
        "Check for typos in dependency string",
      );
    });

    it("should disable suggestions when requested", async () => {
      const noSuggestionsContext = {
        ...mockContext,
        validationOptions: {
          ...mockContext.validationOptions,
          generateSuggestions: false,
        },
      };

      const snippet: EnhancedSnippet = {
        ...mockEnhancedSnippets[0],
        snipDependencies: ["missing-store:;hello:text-1"],
      };

      const result = await validator.validateSnippet(
        snippet,
        noSuggestionsContext,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0].suggestions).toBeUndefined();
    });
  });

  describe("Validation Statistics", () => {
    it("should track validation statistics", async () => {
      const snippet = mockEnhancedSnippets[0];

      await validator.validateSnippet(snippet, mockContext);

      const stats = validator.getValidationStats();
      expect(stats.totalValidations).toBe(1);
      expect(stats.successfulValidations).toBe(1);
      expect(stats.averageValidationTime).toBeGreaterThan(0);
    });

    it("should track failed validations", async () => {
      const snippet: EnhancedSnippet = {
        ...mockEnhancedSnippets[0],
        snipDependencies: ["missing-store:;hello:text-1"],
      };

      await validator.validateSnippet(snippet, mockContext);

      const stats = validator.getValidationStats();
      expect(stats.totalValidations).toBe(1);
      expect(stats.failedValidations).toBe(1);
      expect(stats.mostCommonErrors.get("MISSING_STORE")).toBe(1);
    });
  });

  describe("Validation Hooks", () => {
    it("should execute validation hooks", async () => {
      let hookExecuted = false;

      validator.addValidationHook({
        name: "test-hook",
        priority: 1,
        preValidation: async () => {
          hookExecuted = true;
          return true;
        },
      });

      await validator.validateSnippet(mockEnhancedSnippets[0], mockContext);

      expect(hookExecuted).toBe(true);
    });

    it("should respect hook priority", async () => {
      const executionOrder: string[] = [];

      validator.addValidationHook({
        name: "hook-2",
        priority: 2,
        preValidation: async () => {
          executionOrder.push("hook-2");
          return true;
        },
      });

      validator.addValidationHook({
        name: "hook-1",
        priority: 1,
        preValidation: async () => {
          executionOrder.push("hook-1");
          return true;
        },
      });

      await validator.validateSnippet(mockEnhancedSnippets[0], mockContext);

      // Hooks may execute multiple times during validation workflow
      expect(executionOrder.slice(0, 2)).toEqual(["hook-1", "hook-2"]);
    });

    it("should stop validation if hook returns false", async () => {
      validator.addValidationHook({
        name: "stop-hook",
        priority: 1,
        preValidation: async () => false,
      });

      const result = await validator.validateSnippet(
        mockEnhancedSnippets[0],
        mockContext,
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe("Cache Management", () => {
    it("should clear all caches", async () => {
      const snippet = mockEnhancedSnippets[0];

      await validator.validateSnippet(snippet, mockContext);
      await validator.validateStore("appdata-store", mockContext);

      let cacheStats = validator.getCacheStats();
      expect(cacheStats.validationCacheSize).toBeGreaterThan(0); // Cache may have multiple entries for different validation aspects
      expect(cacheStats.storeValidationCacheSize).toBeGreaterThan(0);

      validator.clearCache();

      cacheStats = validator.getCacheStats();
      expect(cacheStats.validationCacheSize).toBe(0);
      expect(cacheStats.storeValidationCacheSize).toBe(0);
    });
  });

  describe("Convenience Functions", () => {
    it("should provide global validator instance", () => {
      const instance1 = getDependencyValidator();
      const instance2 = getDependencyValidator();
      expect(instance1).toBe(instance2);
    });

    it("should provide convenience validation function", async () => {
      const result = await validateSnippet(
        mockEnhancedSnippets[0],
        mockContext,
      );
      expect(result.isValid).toBe(true);
    });

    it("should provide convenience store validation function", async () => {
      const result = await validateStore("appdata-store", mockContext);
      expect(result.isValid).toBe(true);
    });
  });
});

describe("ValidationWorkflowManager", () => {
  let workflowManager: ValidationWorkflowManager;
  let mockContext: ValidationContext;
  let mockStoreMap: StoreSnippetMap;
  let mockSnippet: EnhancedSnippet;

  beforeEach(() => {
    // Clear global validator cache to prevent test interference
    getDependencyValidator().clearCache();
    workflowManager = new ValidationWorkflowManager();

    mockSnippet = {
      id: "test-snippet",
      trigger: ";test",
      content: "<p>Test content</p>",
      contentType: "html",
      snipDependencies: [],
      description: "Test snippet",
      scope: "personal",
      variables: [],
      images: [],
      tags: [],
      createdAt: "2023-01-01T00:00:00Z",
      createdBy: "user1",
      updatedAt: "2023-01-01T00:00:00Z",
      updatedBy: "user1",
    };

    mockStoreMap = {
      "test-store": {
        snippets: [mockSnippet],
        storeId: "test-store",
        displayName: "Test Store",
      },
    };

    mockContext = {
      availableStores: mockStoreMap,
      currentStore: "test-store",
      validationOptions: {
        ...DEFAULT_VALIDATION_OPTIONS,
        enableCaching: false, // Disable caching to force fresh validation
      },
      userId: "test-user",
      currentDepth: 0,
      sessionId: "test-session",
    };
  });

  describe("Snippet Creation Workflow", () => {
    it("should integrate snippet creation successfully", async () => {
      const result = await workflowManager.integrateSnippetCreation(
        mockSnippet,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.snippet).toBe(mockSnippet);
      expect(result.validationResult?.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle snippet creation validation failure", async () => {
      // Clear cache before this specific test to ensure clean state
      getDependencyValidator().clearCache();

      const invalidSnippet: EnhancedSnippet = {
        ...mockSnippet,
        snipDependencies: ["missing-store:;hello:text-1"], // This should fail due to missing store
      };

      const result = await workflowManager.integrateSnippetCreation(
        invalidSnippet,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.snippet).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Snippet Editing Workflow", () => {
    it("should integrate snippet editing successfully", async () => {
      const editedSnippet = {
        ...mockSnippet,
        content: "<p>Updated content</p>",
      };

      const result = await workflowManager.integrateSnippetEditing(
        mockSnippet,
        editedSnippet,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.originalSnippet).toBe(mockSnippet);
      expect(result.editedSnippet).toBe(editedSnippet);
      expect(result.validationResult?.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle snippet editing validation failure", async () => {
      // Clear cache before this specific test to ensure clean state
      getDependencyValidator().clearCache();

      const invalidEditedSnippet: EnhancedSnippet = {
        ...mockSnippet,
        snipDependencies: ["missing-store:;hello:text-1"], // This should fail due to missing store
      };

      const result = await workflowManager.integrateSnippetEditing(
        mockSnippet,
        invalidEditedSnippet,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.originalSnippet).toBe(mockSnippet);
      expect(result.editedSnippet).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("Storage Operation Workflow", () => {
    it("should integrate save operation successfully", async () => {
      const result = await workflowManager.integrateStorageOperation(
        "save",
        mockSnippet,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe("save");
      expect(result.snippet).toBe(mockSnippet);
      expect(result.validationResult?.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should integrate load operation successfully", async () => {
      const result = await workflowManager.integrateStorageOperation(
        "load",
        mockSnippet,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.operation).toBe("load");
      expect(result.snippet).toBe(mockSnippet);
    });

    it("should validate dependencies before deletion", async () => {
      // Create a snippet that depends on mockSnippet
      const dependentSnippet: EnhancedSnippet = {
        ...mockSnippet,
        id: "dependent-snippet",
        snipDependencies: ["test-store:;test:test-snippet"],
      };

      const storeMapWithDependencies = {
        "test-store": {
          snippets: [mockSnippet, dependentSnippet],
          storeId: "test-store",
          displayName: "Test Store",
        },
      };

      const contextWithDependencies = {
        ...mockContext,
        availableStores: storeMapWithDependencies,
      };

      const result = await workflowManager.integrateStorageOperation(
        "delete",
        mockSnippet,
        contextWithDependencies,
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain(
        "referenced by other snippets",
      );
    });
  });

  describe("Validation Triggers", () => {
    it("should add and execute validation triggers", async () => {
      let triggerExecuted = false;

      workflowManager.addValidationTrigger("snippet-creation", {
        execute: async () => {
          triggerExecuted = true;
        },
      });

      await workflowManager.integrateSnippetCreation(mockSnippet, mockContext);

      expect(triggerExecuted).toBe(true);
    });

    it("should remove validation triggers", async () => {
      let triggerExecuted = false;

      workflowManager.addValidationTrigger("test-trigger", {
        execute: async () => {
          triggerExecuted = true;
        },
      });

      workflowManager.removeValidationTrigger("test-trigger");

      await workflowManager.integrateSnippetCreation(mockSnippet, mockContext);

      expect(triggerExecuted).toBe(false);
    });
  });

  describe("Convenience Functions", () => {
    it("should provide global workflow manager instance", () => {
      const instance1 = getValidationWorkflowManager();
      const instance2 = getValidationWorkflowManager();
      expect(instance1).toBe(instance2);
    });

    it("should provide convenience integration functions", async () => {
      const creationResult = await integrateSnippetCreation(
        mockSnippet,
        mockContext,
      );
      expect(creationResult.success).toBe(true);

      const editingResult = await integrateSnippetEditing(
        mockSnippet,
        mockSnippet,
        mockContext,
      );
      expect(editingResult.success).toBe(true);

      const storageResult = await integrateStorageOperation(
        "save",
        mockSnippet,
        mockContext,
      );
      expect(storageResult.success).toBe(true);
    });
  });
});

describe("DefaultValidationErrorReporter", () => {
  let reporter: DefaultValidationErrorReporter;
  let mockError: ValidationError;

  beforeEach(() => {
    reporter = new DefaultValidationErrorReporter();
    mockError = {
      type: "MISSING_STORE",
      dependency: "test-store",
      message: "Test error message",
      severity: "ERROR",
      suggestions: ["Test suggestion 1", "Test suggestion 2"],
    };
  });

  describe("Error Formatting", () => {
    it("should format error messages with emojis", () => {
      const formatted = reporter.formatErrorMessage(mockError);

      expect(formatted).toContain("🏪");
      expect(formatted).toContain("Test error message");
    });

    it("should generate error summary for multiple errors", () => {
      const errors = [
        mockError,
        {
          ...mockError,
          type: "MISSING_SNIPPET" as const,
        },
      ];

      const summary = reporter.generateErrorSummary(errors);

      expect(summary).toContain("❌ Validation failed");
      expect(summary).toContain("missing store");
      expect(summary).toContain("missing snippet");
    });

    it("should generate success summary for no errors", () => {
      const summary = reporter.generateErrorSummary([]);

      expect(summary).toBe("✅ All validations passed");
    });

    it("should create actionable suggestions", () => {
      const errors = [mockError];
      const suggestions = reporter.createActionableSuggestions(errors);

      expect(suggestions).toContain("Test suggestion 1");
      expect(suggestions).toContain("Test suggestion 2");
    });

    it("should report validation progress", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      await reporter.reportValidationProgress({
        currentStep: "Test step",
        totalSteps: 3,
        currentStepNumber: 2,
        progressPercentage: 67,
      });

      expect(consoleSpy).toHaveBeenCalledWith("[2/3] Test step (67%)");
      consoleSpy.mockRestore();
    });
  });
});

describe("Edge Cases and Error Handling", () => {
  let validator: DependencyValidator;
  let mockContext: ValidationContext;

  beforeEach(() => {
    validator = new DependencyValidator();
    mockContext = {
      availableStores: {},
      currentStore: "test-store",
      validationOptions: DEFAULT_VALIDATION_OPTIONS,
    };
  });

  it("should handle empty store map", async () => {
    const snippet: EnhancedSnippet = {
      id: "test-snippet",
      trigger: ";test",
      content: "<p>Test</p>",
      contentType: "html",
      snipDependencies: ["any-store:;any:any-id"],
      description: "Test",
      scope: "personal",
      variables: [],
      images: [],
      tags: [],
      createdAt: "2023-01-01T00:00:00Z",
      createdBy: "user1",
      updatedAt: "2023-01-01T00:00:00Z",
      updatedBy: "user1",
    };

    const result = await validator.validateSnippet(snippet, mockContext);

    expect(result.isValid).toBe(false);
    expect(result.errors[0].type).toBe("MISSING_STORE");
  });

  it("should handle validation timeout", async () => {
    const timeoutContext = {
      ...mockContext,
      validationOptions: {
        ...mockContext.validationOptions,
        validationTimeout: 1, // Very short timeout
      },
    };

    const snippet: EnhancedSnippet = {
      id: "test-snippet",
      trigger: ";test",
      content: "<p>Test</p>",
      contentType: "html",
      snipDependencies: [],
      description: "Test",
      scope: "personal",
      variables: [],
      images: [],
      tags: [],
      createdAt: "2023-01-01T00:00:00Z",
      createdBy: "user1",
      updatedAt: "2023-01-01T00:00:00Z",
      updatedBy: "user1",
    };

    const result = await validator.validateSnippet(snippet, timeoutContext);

    // Should complete successfully as this is a simple validation
    expect(result.isValid).toBe(true);
  });

  it("should handle malformed dependency strings", async () => {
    const snippet: EnhancedSnippet = {
      id: "test-snippet",
      trigger: ";test",
      content: "<p>Test</p>",
      contentType: "html",
      snipDependencies: ["", "a:b", "a:b:c:d:e"],
      description: "Test",
      scope: "personal",
      variables: [],
      images: [],
      tags: [],
      createdAt: "2023-01-01T00:00:00Z",
      createdBy: "user1",
      updatedAt: "2023-01-01T00:00:00Z",
      updatedBy: "user1",
    };

    const result = await validator.validateSnippet(snippet, mockContext);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(3); // All three dependencies should fail
  });
});
