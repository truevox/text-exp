/**
 * Unit tests for usage tracking functionality
 * Tests new fields in TextSnippet interface and usage tracking logic
 */

import { TextSnippet } from "../../src/shared/types.js";

describe("Usage Tracking Interface", () => {
  test("TextSnippet should have usage tracking fields", () => {
    // This test will initially fail until we add the new fields
    const snippet: TextSnippet = {
      id: "test-snippet-1",
      trigger: ";hello",
      content: "Hello World!",
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0,
      lastUsed: new Date(),
      priority: 1,
      sourceFolder: "personal-folder-id",
      fileHash: "abc123def456",
    };

    // Test that all usage tracking fields exist
    expect(snippet.usageCount).toBe(0);
    expect(snippet.lastUsed).toBeInstanceOf(Date);
    expect(snippet.priority).toBe(1);
    expect(snippet.sourceFolder).toBe("personal-folder-id");
    expect(snippet.fileHash).toBe("abc123def456");
  });

  test("TextSnippet should allow optional usage tracking fields", () => {
    // Test that usage tracking fields are optional
    const snippetWithoutUsage: TextSnippet = {
      id: "test-snippet-2",
      trigger: ";goodbye",
      content: "Goodbye World!",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Should compile without usage tracking fields
    expect(snippetWithoutUsage.id).toBe("test-snippet-2");
    expect(snippetWithoutUsage.usageCount).toBeUndefined();
    expect(snippetWithoutUsage.lastUsed).toBeUndefined();
    expect(snippetWithoutUsage.priority).toBeUndefined();
    expect(snippetWithoutUsage.sourceFolder).toBeUndefined();
    expect(snippetWithoutUsage.fileHash).toBeUndefined();
  });

  test("TextSnippet should support incrementing usage count", () => {
    const snippet: TextSnippet = {
      id: "test-snippet-3",
      trigger: ";test",
      content: "Test Content",
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 5,
      lastUsed: new Date("2023-01-01"),
      priority: 2,
      sourceFolder: "team-folder-id",
      fileHash: "xyz789abc123",
    };

    // Simulate usage tracking
    snippet.usageCount = (snippet.usageCount || 0) + 1;
    snippet.lastUsed = new Date();

    expect(snippet.usageCount).toBe(6);
    expect(snippet.lastUsed?.getTime()).toBeGreaterThan(new Date("2023-01-01").getTime());
  });
});