import { MergeHelper } from "../../src/storage/merge-helper";
import type {
  EnhancedSnippet,
  TierStorageSchema,
} from "../../src/storage/merge-helper";

/**
 * Comprehensive Test Suite for Enhanced MergeHelper - Phase 2
 * Tests upsert operations, conflict resolution, priority-based merging, and advanced features
 */

describe("MergeHelper - Phase 2 Enhanced Features", () => {
  // Test data
  const mockPersonalSnippet: EnhancedSnippet = {
    id: "test-snippet-1",
    trigger: "!test",
    content: "<p>Test content</p>",
    contentType: "html",
    scope: "personal",
    description: "Test snippet",
    snipDependencies: [],
    variables: [{ name: "user", prompt: "User name" }],
    images: [],
    tags: ["test"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    createdBy: "test-user",
    updatedBy: "test-user",
  };

  const mockTeamSnippet: EnhancedSnippet = {
    id: "test-snippet-2",
    trigger: "!team",
    content: "<p>Team content</p>",
    contentType: "html",
    scope: "team",
    description: "Team snippet",
    snipDependencies: [],
    variables: [],
    images: [],
    tags: ["team"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    createdBy: "team-user",
    updatedBy: "team-user",
  };

  const mockPersonalSchema: TierStorageSchema = {
    schema: "priority-tier-v1",
    tier: "personal",
    metadata: {
      version: "1.0.0",
      created: "2024-01-01T00:00:00.000Z",
      modified: "2024-01-01T00:00:00.000Z",
      owner: "test-user",
    },
    snippets: [],
  };

  const mockTeamSchema: TierStorageSchema = {
    schema: "priority-tier-v1",
    tier: "team",
    metadata: {
      version: "1.0.0",
      created: "2024-01-01T00:00:00.000Z",
      modified: "2024-01-01T00:00:00.000Z",
      owner: "team-admin",
    },
    snippets: [],
  };

  const mockOrgSchema: TierStorageSchema = {
    schema: "priority-tier-v1",
    tier: "org",
    metadata: {
      version: "1.0.0",
      created: "2024-01-01T00:00:00.000Z",
      modified: "2024-01-01T00:00:00.000Z",
      owner: "org-admin",
    },
    snippets: [],
  };

  beforeEach(() => {
    // Reset schemas for each test
    mockPersonalSchema.snippets = [];
    mockTeamSchema.snippets = [];
    mockOrgSchema.snippets = [];
  });

  describe("Enhanced Upsert Operations", () => {
    it("should insert new snippet with default options", async () => {
      const result = await MergeHelper.upsertSnippetAdvanced(
        mockPersonalSnippet,
        mockPersonalSchema,
      );

      expect(result.success).toBe(true);
      expect(result.mergedSnippets).toHaveLength(1);
      expect(result.mergedSnippets[0]).toEqual(mockPersonalSnippet);
      expect(result.stats.added).toBe(1);
      expect(result.stats.conflicts).toBe(0);
      expect(result.metadata?.operation).toBe("upsert");
      expect(result.metadata?.strategy).toBe("priority-based");
      expect(mockPersonalSchema.snippets).toHaveLength(1);
    });

    it("should update existing snippet", async () => {
      // Pre-populate schema with existing snippet
      mockPersonalSchema.snippets.push({ ...mockPersonalSnippet });

      const updatedSnippet = {
        ...mockPersonalSnippet,
        content: "<p>Updated content</p>",
        updatedAt: "2024-01-02T00:00:00.000Z",
      };

      const result = await MergeHelper.upsertSnippetAdvanced(
        updatedSnippet,
        mockPersonalSchema,
      );

      expect(result.success).toBe(true);
      expect(result.mergedSnippets).toHaveLength(1);
      expect(result.mergedSnippets[0].content).toBe("<p>Updated content</p>");
      expect(result.stats.updated).toBe(1);
      expect(result.stats.fieldsMerged).toBeGreaterThan(0);
      expect(mockPersonalSchema.snippets).toHaveLength(1);
      expect(mockPersonalSchema.snippets[0].content).toBe(
        "<p>Updated content</p>",
      );
    });

    it("should handle scope mismatch with priority-based resolution", async () => {
      const result = await MergeHelper.upsertSnippetAdvanced(
        mockTeamSnippet, // team scope
        mockPersonalSchema, // personal tier
        { strategy: "priority-based" },
      );

      expect(result.success).toBe(true);
      expect(result.mergedSnippets[0].scope).toBe("personal");
      expect(
        result.warnings?.some((w) => w.includes("Adjusted snippet scope")),
      ).toBe(true);
      expect(result.stats.fieldsMerged).toBe(1);
    });

    it("should reject scope mismatch with manual resolution", async () => {
      const result = await MergeHelper.upsertSnippetAdvanced(
        mockTeamSnippet,
        mockPersonalSchema,
        { strategy: "manual" },
      );

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe("field-conflict");
      expect(result.conflicts[0].field).toBe("scope");
      expect(result.error).toContain("does not match tier");
    });

    it("should detect and handle trigger conflicts", async () => {
      // Pre-populate with snippet that has same trigger
      const existingSnippet = {
        ...mockPersonalSnippet,
        id: "different-id",
        trigger: "!test",
      };
      mockPersonalSchema.snippets.push(existingSnippet);

      const newSnippet = {
        ...mockPersonalSnippet,
        id: "new-id",
      };

      const result = await MergeHelper.upsertSnippetAdvanced(
        newSnippet,
        mockPersonalSchema,
        { allowTriggerDuplicates: false },
      );

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe("duplicate-trigger");
      expect(result.error).toContain("Duplicate trigger");
    });

    it("should allow trigger duplicates when configured", async () => {
      const existingSnippet = {
        ...mockPersonalSnippet,
        id: "different-id",
      };
      mockPersonalSchema.snippets.push(existingSnippet);

      const newSnippet = {
        ...mockPersonalSnippet,
        id: "new-id",
      };

      const result = await MergeHelper.upsertSnippetAdvanced(
        newSnippet,
        mockPersonalSchema,
        { allowTriggerDuplicates: true },
      );

      expect(result.success).toBe(true);
      expect(mockPersonalSchema.snippets).toHaveLength(2);
    });
  });

  describe("Advanced Conflict Resolution", () => {
    const originalSnippet: EnhancedSnippet = {
      id: "conflict-test",
      trigger: "!conflict",
      content: "<p>Original content</p>",
      contentType: "html",
      scope: "personal",
      description: "Original description",
      snipDependencies: [],
      variables: [{ name: "var1", prompt: "Variable 1" }],
      images: [],
      tags: ["original"],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T10:00:00.000Z",
      createdBy: "user1",
      updatedBy: "user1",
    };

    const updatedSnippet: EnhancedSnippet = {
      id: "conflict-test",
      trigger: "!conflict",
      content: "<p>Updated content</p>",
      contentType: "html",
      scope: "personal",
      description: "Updated description",
      snipDependencies: [],
      variables: [
        { name: "var1", prompt: "Variable 1 Updated" },
        { name: "var2", prompt: "Variable 2" },
      ],
      images: [],
      tags: ["updated", "new"],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T12:00:00.000Z",
      createdBy: "user1",
      updatedBy: "user2",
    };

    it("should resolve conflicts using newest-wins strategy", async () => {
      mockPersonalSchema.snippets.push({ ...originalSnippet });

      const result = await MergeHelper.upsertSnippetAdvanced(
        updatedSnippet,
        mockPersonalSchema,
        { strategy: "newest-wins" },
      );

      expect(result.success).toBe(true);
      expect(result.mergedSnippets[0].content).toBe("<p>Updated content</p>");
      expect(result.mergedSnippets[0].description).toBe("Updated description");
      expect(result.warnings?.some((w) => w.includes("newer timestamp"))).toBe(
        true,
      );
    });

    it("should resolve conflicts using priority-based strategy", async () => {
      mockPersonalSchema.snippets.push({ ...originalSnippet });

      const result = await MergeHelper.upsertSnippetAdvanced(
        updatedSnippet,
        mockPersonalSchema,
        { strategy: "priority-based" },
      );

      expect(result.success).toBe(true);
      expect(result.stats.conflictsResolved).toBeGreaterThan(0);
    });

    it("should merge arrays when using merge-content strategy", async () => {
      mockPersonalSchema.snippets.push({ ...originalSnippet });

      const result = await MergeHelper.upsertSnippetAdvanced(
        updatedSnippet,
        mockPersonalSchema,
        { strategy: "merge-content" },
      );

      expect(result.success).toBe(true);
      const mergedSnippet = result.mergedSnippets[0];

      // Should merge tags
      expect(mergedSnippet.tags).toEqual(
        expect.arrayContaining(["original", "updated", "new"]),
      );

      // Should merge variables (by name)
      expect(mergedSnippet.variables).toHaveLength(2);
      expect(
        mergedSnippet.variables.find((v) => v.name === "var1")?.prompt,
      ).toBe("Variable 1 Updated");
      expect(
        mergedSnippet.variables.find((v) => v.name === "var2")?.prompt,
      ).toBe("Variable 2");
    });

    it("should handle timestamp-based resolution with tolerance", async () => {
      mockPersonalSchema.snippets.push({ ...originalSnippet });

      // Create snippet with very close timestamp
      const closeTimestampSnippet = {
        ...updatedSnippet,
        updatedAt: "2024-01-01T10:00:02.000Z", // 2 seconds difference
      };

      const result = await MergeHelper.upsertSnippetAdvanced(
        closeTimestampSnippet,
        mockPersonalSchema,
        {
          strategy: "timestamp-based",
          timestampToleranceMs: 5000, // 5 second tolerance
        },
      );

      expect(result.success).toBe(true);
      expect(result.warnings?.some((w) => w.includes("within tolerance"))).toBe(
        true,
      );
    });

    it("should preserve specific fields when configured", async () => {
      mockPersonalSchema.snippets.push({ ...originalSnippet });

      const result = await MergeHelper.upsertSnippetAdvanced(
        updatedSnippet,
        mockPersonalSchema,
        {
          strategy: "overwrite",
          preserveFields: ["id", "createdAt", "createdBy", "description"],
        },
      );

      expect(result.success).toBe(true);
      const mergedSnippet = result.mergedSnippets[0];

      // Should preserve original description
      expect(mergedSnippet.description).toBe("Original description");
      expect(mergedSnippet.createdBy).toBe("user1");

      // Should update content
      expect(mergedSnippet.content).toBe("<p>Updated content</p>");
    });

    it("should force update specific fields when configured", async () => {
      mockPersonalSchema.snippets.push({ ...originalSnippet });

      const result = await MergeHelper.upsertSnippetAdvanced(
        updatedSnippet,
        mockPersonalSchema,
        {
          strategy: "local-wins", // Would normally keep local values
          forceUpdateFields: ["content", "description"],
        },
      );

      expect(result.success).toBe(true);
      const mergedSnippet = result.mergedSnippets[0];

      // Should force update despite local-wins strategy
      expect(mergedSnippet.content).toBe("<p>Updated content</p>");
      expect(mergedSnippet.description).toBe("Updated description");
    });
  });

  describe("Validation and Error Handling", () => {
    it("should validate merged results when configured", async () => {
      const invalidSnippet = {
        ...mockPersonalSnippet,
        contentType: "invalid-type" as any,
      };

      const result = await MergeHelper.upsertSnippetAdvanced(
        invalidSnippet,
        mockPersonalSchema,
        { validateResult: true },
      );

      expect(result.success).toBe(true); // Should succeed but with warnings
      expect(
        result.warnings?.some((w) => w.includes("Unknown content type")),
      ).toBe(true);
    });

    it("should handle invalid timestamps gracefully", async () => {
      const invalidTimestampSnippet = {
        ...mockPersonalSnippet,
        updatedAt: "invalid-timestamp",
      };

      mockPersonalSchema.snippets.push({ ...mockPersonalSnippet });

      const result = await MergeHelper.upsertSnippetAdvanced(
        invalidTimestampSnippet,
        mockPersonalSchema,
        { strategy: "timestamp-based" },
      );

      expect(result.success).toBe(true);
      expect(
        result.warnings?.some(
          (w) =>
            w.includes("Invalid") ||
            w.includes("timestamp") ||
            w.includes("updatedAt"),
        ),
      ).toBe(true);
    });

    it("should handle missing required fields", async () => {
      const incompleteSnippet = {
        id: "incomplete",
        // Missing required fields like trigger, content, contentType
      } as any;

      const result = await MergeHelper.upsertSnippetAdvanced(
        incompleteSnippet,
        mockPersonalSchema,
        { validateResult: true },
      );

      // Since scope gets added automatically, this will succeed but should have validation warnings
      // In a real scenario, this would be caught earlier in the input validation
      expect(result.success).toBe(true);
      expect(result.warnings?.length).toBeGreaterThan(0);
    });
  });

  describe("Bulk Operations", () => {
    it("should perform bulk upsert successfully", async () => {
      const snippets = [
        mockPersonalSnippet,
        { ...mockPersonalSnippet, id: "test-2", trigger: "!test2" },
        { ...mockPersonalSnippet, id: "test-3", trigger: "!test3" },
      ];

      const result = await MergeHelper.bulkUpsertAdvanced(
        snippets,
        mockPersonalSchema,
      );

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.metadata.operation).toBe("bulk-upsert");
      expect(mockPersonalSchema.snippets).toHaveLength(3);
    });

    it("should handle mixed success/failure in bulk operations", async () => {
      // Pre-populate with conflicting trigger
      mockPersonalSchema.snippets.push({
        ...mockPersonalSnippet,
        id: "existing",
        trigger: "!conflict",
      });

      const snippets = [
        mockPersonalSnippet, // Should succeed
        { ...mockPersonalSnippet, id: "conflict", trigger: "!conflict" }, // Should fail
        { ...mockPersonalSnippet, id: "test-3", trigger: "!test3" }, // Should succeed
      ];

      const result = await MergeHelper.bulkUpsertAdvanced(
        snippets,
        mockPersonalSchema,
        { allowTriggerDuplicates: false },
      );

      expect(result.success).toBe(false); // Overall failure due to conflicts
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.summary.conflicts).toBeGreaterThan(0);
    });

    it("should track performance metrics in bulk operations", async () => {
      // First add some existing snippets to create merge scenarios
      const existingSnippets = Array.from({ length: 5 }, (_, i) => ({
        ...mockPersonalSnippet,
        id: `bulk-${i}`,
        trigger: `!bulk${i}`,
        content: "<p>Original content</p>",
      }));
      mockPersonalSchema.snippets.push(...existingSnippets);

      // Now create updated versions that will merge
      const snippets = Array.from({ length: 10 }, (_, i) => ({
        ...mockPersonalSnippet,
        id: `bulk-${i}`,
        trigger: `!bulk${i}`,
        content: `<p>Updated content ${i}</p>`,
      }));

      const result = await MergeHelper.bulkUpsertAdvanced(
        snippets,
        mockPersonalSchema,
        { performanceTracking: true },
      );

      expect(result.success).toBe(true);
      expect(result.metadata.duration).toBeGreaterThan(0);
      expect(result.summary.totalFieldsMerged).toBeGreaterThan(0);
    });
  });

  describe("Legacy Compatibility", () => {
    it("should maintain compatibility with existing merge method", () => {
      const localSnippets = [mockPersonalSnippet];
      const remoteSnippets = [
        { ...mockPersonalSnippet, content: "<p>Updated content</p>" },
      ];

      const result = MergeHelper.merge(localSnippets, remoteSnippets, {
        strategy: "newest-wins",
      });

      expect(result.success).toBe(true);
      expect(result.mergedSnippets).toHaveLength(1);
      expect(result.stats.updated).toBe(1);
    });

    it("should maintain compatibility with upsertSnippet method", () => {
      const snippets = [mockPersonalSnippet];
      const newSnippet = {
        ...mockPersonalSnippet,
        id: "new-snippet",
        trigger: "!new",
      };

      const result = MergeHelper.upsertSnippet(snippets, newSnippet, {
        strategy: "local-wins",
      });

      expect(result.success).toBe(true);
      expect(result.mergedSnippets).toHaveLength(2);
      expect(result.stats.added).toBe(1);
    });
  });

  describe("Performance and Metadata", () => {
    it("should track operation timing", async () => {
      const result = await MergeHelper.upsertSnippetAdvanced(
        mockPersonalSnippet,
        mockPersonalSchema,
      );

      expect(result.metadata?.startTime).toBeDefined();
      expect(result.metadata?.duration).toBeGreaterThan(0);
      expect(typeof result.metadata?.duration).toBe("number");
    });

    it("should provide detailed operation metadata", async () => {
      mockPersonalSchema.snippets.push({ ...mockPersonalSnippet });

      const updatedSnippet = {
        ...mockPersonalSnippet,
        content: "<p>Updated</p>",
      };

      const result = await MergeHelper.upsertSnippetAdvanced(
        updatedSnippet,
        mockPersonalSchema,
        { createBackup: true },
      );

      expect(result.metadata?.operation).toBe("merge");
      expect(result.metadata?.sourceTier).toBe("personal");
      expect(result.metadata?.targetTier).toBe("personal");
      expect(result.metadata?.strategy).toBeDefined();
      expect(result.stats.backupCreated).toBe(true);
    });

    it("should handle backup creation", async () => {
      const result = await MergeHelper.upsertSnippetAdvanced(
        mockPersonalSnippet,
        mockPersonalSchema,
        { createBackup: true },
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.backupPath).toContain("backup-personal-");
      expect(result.stats.backupCreated).toBe(true);
    });
  });

  describe("Priority-Based Tier Resolution", () => {
    it("should favor personal tier over team tier", async () => {
      const personalSnippet = {
        ...mockPersonalSnippet,
        content: "<p>Personal content</p>",
      };
      const teamSnippet = {
        ...mockPersonalSnippet,
        scope: "team" as const,
        content: "<p>Team content</p>",
      };

      // Add team snippet to team schema first
      const teamSchema: TierStorageSchema = {
        ...mockTeamSchema,
        snippets: [teamSnippet as any],
      };

      // Then try to upsert personal snippet into team schema
      // This should favor personal content due to higher priority
      const result = await MergeHelper.upsertSnippetAdvanced(
        personalSnippet,
        teamSchema,
        { strategy: "priority-based" },
      );

      expect(result.success).toBe(true);
      expect(result.mergedSnippets[0].content).toBe("<p>Personal content</p>");
      expect(
        result.warnings?.some(
          (w) =>
            w.includes("personal priority > team priority") ||
            (w.includes("personal") && w.includes("team")),
        ),
      ).toBe(true);
    });

    it("should favor team tier over org tier", async () => {
      const teamSnippet = {
        ...mockPersonalSnippet,
        scope: "team" as const,
        content: "<p>Team content</p>",
      };
      const orgSnippet = {
        ...mockPersonalSnippet,
        scope: "org" as const,
        content: "<p>Org content</p>",
      };

      // Add org snippet to org schema first
      const orgSchema: TierStorageSchema = {
        ...mockOrgSchema,
        snippets: [orgSnippet as any],
      };

      // Then try to upsert team snippet into org schema
      // This should favor team content due to higher priority
      const result = await MergeHelper.upsertSnippetAdvanced(
        teamSnippet,
        orgSchema,
        { strategy: "priority-based" },
      );

      expect(result.success).toBe(true);
      expect(result.mergedSnippets[0].content).toBe("<p>Team content</p>");
      expect(
        result.warnings?.some(
          (w) =>
            w.includes("team priority > org priority") ||
            (w.includes("team") && w.includes("org")),
        ),
      ).toBe(true);
    });
  });

  describe("Array Merging", () => {
    it("should merge tags without duplicates", async () => {
      const originalSnippet = {
        ...mockPersonalSnippet,
        tags: ["tag1", "tag2"],
      };

      const updatedSnippet = {
        ...mockPersonalSnippet,
        tags: ["tag2", "tag3", "tag4"],
      };

      mockPersonalSchema.snippets.push(originalSnippet);

      const result = await MergeHelper.upsertSnippetAdvanced(
        updatedSnippet,
        mockPersonalSchema,
        { strategy: "merge-content" },
      );

      expect(result.success).toBe(true);
      const mergedTags = result.mergedSnippets[0].tags;
      expect(mergedTags).toHaveLength(4);
      expect(mergedTags).toEqual(
        expect.arrayContaining(["tag1", "tag2", "tag3", "tag4"]),
      );
    });

    it("should merge variables by name", async () => {
      const originalSnippet = {
        ...mockPersonalSnippet,
        variables: [
          { name: "var1", prompt: "Original prompt 1" },
          { name: "var2", prompt: "Original prompt 2" },
        ],
      };

      const updatedSnippet = {
        ...mockPersonalSnippet,
        variables: [
          { name: "var1", prompt: "Updated prompt 1" },
          { name: "var3", prompt: "New prompt 3" },
        ],
      };

      mockPersonalSchema.snippets.push(originalSnippet);

      const result = await MergeHelper.upsertSnippetAdvanced(
        updatedSnippet,
        mockPersonalSchema,
        { strategy: "merge-content" },
      );

      expect(result.success).toBe(true);
      const mergedVars = result.mergedSnippets[0].variables;
      expect(mergedVars).toHaveLength(3);

      const var1 = mergedVars.find((v) => v.name === "var1");
      expect(var1?.prompt).toBe("Updated prompt 1"); // Should use newer version

      const var2 = mergedVars.find((v) => v.name === "var2");
      expect(var2?.prompt).toBe("Original prompt 2"); // Should keep original

      const var3 = mergedVars.find((v) => v.name === "var3");
      expect(var3?.prompt).toBe("New prompt 3"); // Should add new
    });
  });
});
