import { JsonSerializer } from "../../src/storage/json-serializer";
import type {
  TierStorageSchema,
  JsonSerializationOptions,
  JsonPerformanceConfig,
} from "../../src/storage/json-serializer";

/**
 * Comprehensive Test Suite for Enhanced JsonSerializer - Phase 2
 * Tests serialization, deserialization, validation, atomic operations, and performance
 */

describe("JsonSerializer - Phase 2 Enhanced Features", () => {
  // Test data
  const mockSchema: TierStorageSchema = {
    schema: "priority-tier-v1",
    tier: "personal",
    metadata: {
      version: "1.0.0",
      created: "2024-01-01T00:00:00.000Z",
      modified: "2024-01-01T00:00:00.000Z",
      owner: "test-user",
      description: "Test tier storage",
    },
    snippets: [
      {
        id: "test-snippet-1",
        trigger: "!test",
        content: "<p>Test content</p>",
        contentType: "html",
        scope: "personal",
        description: "Test snippet",
        snipDependencies: [],
        variables: [],
        images: [],
        tags: ["test"],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        createdBy: "test-user",
        updatedBy: "test-user",
      },
    ],
  };

  const invalidSchema = {
    // Missing required fields
    tier: "invalid-tier",
    snippets: "not-an-array",
  };

  beforeEach(() => {
    // Clear any active operations before each test
    JsonSerializer.clearActiveOperations();

    // Reset performance config to defaults
    JsonSerializer.configure({
      maxConcurrentOperations: 10,
      validationLevel: "basic",
      compressionThreshold: 10000,
    });
  });

  describe("Enhanced Serialization", () => {
    it("should serialize with default options successfully", async () => {
      const result = await JsonSerializer.serialize(mockSchema);

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe("string");
      expect(result.metadata?.operation).toBe("serialize");
      expect(result.metadata?.duration).toBeGreaterThan(0);
      expect(result.metadata?.fieldCount).toBe(4); // schema, tier, metadata, snippets
      expect(result.metadata?.snippetCount).toBe(1);
    });

    it("should serialize with custom options", async () => {
      const options: JsonSerializationOptions = {
        pretty: false,
        preserveOrder: true,
        validate: true,
        compress: false,
      };

      const result = await JsonSerializer.serialize(mockSchema, options);

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe("string");

      // Check that it's not prettified (no indentation)
      const data = result.data as string;
      expect(data).not.toContain("\n  ");
    });

    it("should handle validation errors during serialization", async () => {
      const options: JsonSerializationOptions = {
        validate: true,
      };

      // Configure strict validation
      JsonSerializer.configure({ validationLevel: "strict" });

      const result = await JsonSerializer.serialize(
        invalidSchema as any,
        options,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("schema");
      expect(result.metadata?.operation).toBe("serialize");
    });

    it("should respect max size limits", async () => {
      const options: JsonSerializationOptions = {
        maxSize: 10, // Very small limit
      };

      const result = await JsonSerializer.serialize(mockSchema, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain("exceeds maximum allowed");
    });

    it("should handle concurrent operation limits", async () => {
      // Set very low limit
      JsonSerializer.configure({ maxConcurrentOperations: 1 });

      // Start multiple operations simultaneously
      const promises = Array.from({ length: 3 }, () =>
        JsonSerializer.serialize(mockSchema),
      );

      const results = await Promise.all(promises);

      // At least one should succeed, others may fail due to limit
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes.length).toBeGreaterThan(0);
      if (failures.length > 0) {
        expect(failures[0].error).toContain(
          "Maximum concurrent operations exceeded",
        );
      }
    });
  });

  describe("Enhanced Deserialization", () => {
    let serializedData: string;

    beforeEach(async () => {
      const result = await JsonSerializer.serialize(mockSchema, {
        pretty: false,
      });
      if (result.success) {
        serializedData = result.data as string;
      }
    });

    it("should deserialize valid JSON successfully", async () => {
      const result = await JsonSerializer.deserialize(serializedData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.schema).toBe("priority-tier-v1");
      expect(result.data?.tier).toBe("personal");
      expect(result.data?.snippets).toHaveLength(1);
      expect(result.metadata?.operation).toBe("deserialize");
      expect(result.metadata?.originalSize).toBe(serializedData.length);
    });

    it("should handle invalid JSON", async () => {
      const result = await JsonSerializer.deserialize("invalid json{");

      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON parsing failed");
      expect(result.metadata?.operation).toBe("deserialize");
    });

    it("should validate deserialized data with basic validation", async () => {
      JsonSerializer.configure({ validationLevel: "basic" });

      const invalidJson = JSON.stringify({ schema: "invalid", tier: "bad" });
      const result = await JsonSerializer.deserialize(invalidJson, {
        validate: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should validate deserialized data with strict validation", async () => {
      JsonSerializer.configure({ validationLevel: "strict" });

      const schemaWithBadTimestamp = {
        ...mockSchema,
        metadata: {
          ...mockSchema.metadata,
          created: "invalid-timestamp",
        },
      };

      const serialized = JSON.stringify(schemaWithBadTimestamp);
      const result = await JsonSerializer.deserialize(serialized, {
        validate: true,
      });

      // Should succeed but with warnings
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("timestamp"))).toBe(true);
    });
  });

  describe("Field Order Preservation", () => {
    it("should preserve field order in schema", async () => {
      const result = await JsonSerializer.serialize(mockSchema, {
        preserveOrder: true,
      });

      expect(result.success).toBe(true);
      const serialized = result.data as string;
      const parsed = JSON.parse(serialized);

      // Check that schema comes first
      const keys = Object.keys(parsed);
      expect(keys[0]).toBe("schema");
      expect(keys[1]).toBe("tier");
      expect(keys[2]).toBe("metadata");
      expect(keys[3]).toBe("snippets");
    });

    it("should preserve field order in snippets", async () => {
      const result = await JsonSerializer.serialize(mockSchema, {
        preserveOrder: true,
      });

      expect(result.success).toBe(true);
      const serialized = result.data as string;
      const parsed = JSON.parse(serialized);

      const snippet = parsed.snippets[0];
      const snippetKeys = Object.keys(snippet);

      // Check that id comes first
      expect(snippetKeys[0]).toBe("id");
      expect(snippetKeys[1]).toBe("trigger");
      expect(snippetKeys[2]).toBe("content");
    });
  });

  describe("Performance Configuration", () => {
    it("should allow configuration updates", () => {
      const newConfig: Partial<JsonPerformanceConfig> = {
        maxConcurrentOperations: 5,
        validationLevel: "strict",
        compressionThreshold: 5000,
      };

      JsonSerializer.configure(newConfig);

      const stats = JsonSerializer.getPerformanceStats();
      expect(stats.config.maxConcurrentOperations).toBe(5);
      expect(stats.config.validationLevel).toBe("strict");
      expect(stats.config.compressionThreshold).toBe(5000);
    });

    it("should track active operations", async () => {
      // Start a long operation (simulated by the serialize method)
      const promise = JsonSerializer.serialize(mockSchema);

      // Check stats during operation
      const statsDuring = JsonSerializer.getPerformanceStats();
      expect(statsDuring.activeOperations).toBeGreaterThanOrEqual(0);

      await promise;

      // Check stats after operation
      const statsAfter = JsonSerializer.getPerformanceStats();
      expect(statsAfter.activeOperations).toBe(0);
    });
  });

  describe("Atomic Operations", () => {
    it("should perform atomic write successfully", async () => {
      const filePath = "/test/path/test.json";
      const options = {
        createBackup: true,
        maxRetries: 3,
        pretty: true,
      };

      const result = await JsonSerializer.atomicWrite(
        filePath,
        mockSchema,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.operation).toBe("atomic-write");
      expect(result.metadata?.filePath).toBe(filePath);
      expect(result.metadata?.backupPath).toBeDefined();
      expect(result.metadata?.tempPath).toBeDefined();
    });

    it("should handle atomic write with backup disabled", async () => {
      const filePath = "/test/path/test.json";
      const options = {
        createBackup: false,
        maxRetries: 1,
      };

      const result = await JsonSerializer.atomicWrite(
        filePath,
        mockSchema,
        options,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.backupPath).toBeUndefined();
    });

    it("should perform atomic read successfully", async () => {
      const filePath = "/test/path/test.json";
      const options = {
        validate: true,
      };

      const result = await JsonSerializer.atomicRead(filePath, options);

      expect(result.success).toBe(true);
      expect(result.metadata?.operation).toBe("atomic-read");
      expect(result.metadata?.filePath).toBe(filePath);
    });
  });

  describe("Utility Methods", () => {
    it("should deep clone objects correctly", () => {
      const clone = JsonSerializer.deepClone(mockSchema);

      expect(clone).toEqual(mockSchema);
      expect(clone).not.toBe(mockSchema);
      expect(clone.snippets).not.toBe(mockSchema.snippets);
      expect(clone.metadata).not.toBe(mockSchema.metadata);
    });

    it("should compare schemas for equality", async () => {
      const schema1 = { ...mockSchema };
      const schema2 = { ...mockSchema };
      const schema3 = { ...mockSchema, tier: "team" as const };

      const equal1 = await JsonSerializer.schemasEqual(schema1, schema2);
      const equal2 = await JsonSerializer.schemasEqual(schema1, schema3);

      expect(equal1).toBe(true);
      expect(equal2).toBe(false);
    });

    it("should calculate schema size correctly", async () => {
      const size = await JsonSerializer.calculateSize(mockSchema);

      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle serialization errors gracefully", async () => {
      // Create an object with circular reference
      const circularSchema: any = { ...mockSchema };
      circularSchema.circular = circularSchema;

      const result = await JsonSerializer.serialize(circularSchema);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata?.operation).toBe("serialize");
    });

    it("should handle invalid schema structures", async () => {
      const invalidSchema = {
        schema: null,
        tier: 123,
        snippets: "not-array",
        metadata: null,
      };

      const result = await JsonSerializer.serialize(invalidSchema as any, {
        validate: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("schema");
    });

    it("should provide meaningful error messages", async () => {
      JsonSerializer.configure({ validationLevel: "strict" });

      const schemaWithDuplicateIds = {
        ...mockSchema,
        snippets: [
          { ...mockSchema.snippets[0] },
          { ...mockSchema.snippets[0] }, // Duplicate ID
        ],
      };

      const result = await JsonSerializer.serialize(schemaWithDuplicateIds, {
        validate: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Duplicate snippet ID");
    });
  });

  describe("Performance Tracking", () => {
    it("should track serialization performance", async () => {
      const result = await JsonSerializer.serialize(mockSchema);

      expect(result.success).toBe(true);
      expect(result.metadata?.duration).toBeGreaterThan(0);
      expect(result.metadata?.startTime).toBeGreaterThan(0);
      expect(typeof result.metadata?.fieldCount).toBe("number");
      expect(typeof result.metadata?.snippetCount).toBe("number");
    });

    it("should track deserialization performance", async () => {
      const serialized = await JsonSerializer.serialize(mockSchema);
      expect(serialized.success).toBe(true);

      const result = await JsonSerializer.deserialize(
        serialized.data as string,
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.duration).toBeGreaterThan(0);
      expect(result.metadata?.originalSize).toBeGreaterThan(0);
    });
  });

  describe("Validation Levels", () => {
    it("should handle basic validation level", async () => {
      JsonSerializer.configure({ validationLevel: "basic" });

      const schemaWithWarnings = {
        ...mockSchema,
        schema: "unknown-version" as const, // Should generate warning in basic mode
      };

      const result = await JsonSerializer.serialize(schemaWithWarnings as any, {
        validate: true,
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(
        result.warnings?.some((w) => w.includes("Unknown schema version")),
      ).toBe(true);
    });

    it("should handle strict validation level", async () => {
      JsonSerializer.configure({ validationLevel: "strict" });

      const schemaWithBadData = {
        ...mockSchema,
        snippets: [
          {
            ...mockSchema.snippets[0],
            id: "invalid@id!", // Invalid characters
            trigger: "x".repeat(150), // Too long
          },
        ],
      };

      const result = await JsonSerializer.serialize(schemaWithBadData, {
        validate: true,
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(
        result.warnings?.some((w) => w.includes("invalid characters")),
      ).toBe(true);
      expect(result.warnings?.some((w) => w.includes("very long"))).toBe(true);
    });

    it("should skip validation when level is none", async () => {
      JsonSerializer.configure({ validationLevel: "none" });

      // Use a schema that will serialize but has validation issues
      const schemaWithInvalidTier = {
        schema: "priority-tier-v1",
        tier: "invalid-tier", // This would normally fail validation
        metadata: {
          version: "1.0.0",
          created: "2024-01-01T00:00:00.000Z",
          modified: "2024-01-01T00:00:00.000Z",
          owner: "test",
        },
        snippets: [],
      };

      const result = await JsonSerializer.serialize(
        schemaWithInvalidTier as any,
        { validate: true },
      );
      expect(result.success).toBe(true);
    });
  });

  describe("Integration with Phase 2 Components", () => {
    it("should work with realistic tier data", async () => {
      const personalTier: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal",
        metadata: {
          version: "1.0.0",
          created: "2024-01-15T10:30:00.000Z",
          modified: "2024-01-15T15:45:00.000Z",
          owner: "user123",
          description: "Personal snippets for daily work",
        },
        snippets: [
          {
            id: "email-sig",
            trigger: "!esig",
            content: "<p>Best regards,<br>John Doe<br>Software Engineer</p>",
            contentType: "html",
            scope: "personal",
            description: "Email signature",
            snipDependencies: [],
            variables: [],
            images: [],
            tags: ["email", "signature"],
            createdAt: "2024-01-15T10:30:00.000Z",
            updatedAt: "2024-01-15T10:30:00.000Z",
            createdBy: "user123",
            updatedBy: "user123",
          },
          {
            id: "meeting-agenda",
            trigger: "!agenda",
            content:
              "<h3>Meeting Agenda</h3><ul><li>Item 1</li><li>Item 2</li></ul>",
            contentType: "html",
            scope: "personal",
            description: "Meeting agenda template",
            snipDependencies: [],
            variables: [
              { name: "meeting_topic", prompt: "Topic of the meeting" },
              { name: "date", prompt: "Meeting date" },
            ],
            images: [],
            tags: ["meeting", "template"],
            createdAt: "2024-01-15T11:00:00.000Z",
            updatedAt: "2024-01-15T14:20:00.000Z",
            createdBy: "user123",
            updatedBy: "user123",
          },
        ],
      };

      const serializeResult = await JsonSerializer.serialize(personalTier, {
        pretty: true,
        preserveOrder: true,
        validate: true,
      });

      expect(serializeResult.success).toBe(true);
      expect(serializeResult.metadata?.snippetCount).toBe(2);

      const deserializeResult = await JsonSerializer.deserialize(
        serializeResult.data as string,
      );

      expect(deserializeResult.success).toBe(true);
      expect(deserializeResult.data?.snippets).toHaveLength(2);
      expect(deserializeResult.data?.tier).toBe("personal");
    });
  });
});
