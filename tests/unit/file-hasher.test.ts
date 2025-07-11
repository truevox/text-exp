/**
 * Unit tests for FileHasher utility
 * Tests file hashing functionality for preventing name collisions
 */

import { FileHasher } from "../../src/utils/file-hasher.js";

describe("FileHasher Utility", () => {
  let fileHasher: FileHasher;

  beforeEach(() => {
    fileHasher = new FileHasher();
  });

  describe("Hash Generation", () => {
    test("should generate consistent hash for same input", () => {
      const fileName = "test-snippets.json";
      const folderId = "folder-123";

      const hash1 = fileHasher.generateHash(fileName, folderId);
      const hash2 = fileHasher.generateHash(fileName, folderId);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeDefined();
      expect(hash1.length).toBeGreaterThan(0);
    });

    test("should generate different hashes for different inputs", () => {
      const fileName = "test-snippets.json";

      const hash1 = fileHasher.generateHash(fileName, "folder-123");
      const hash2 = fileHasher.generateHash(fileName, "folder-456");

      expect(hash1).not.toBe(hash2);
    });

    test("should generate different hashes for different file names", () => {
      const folderId = "folder-123";

      const hash1 = fileHasher.generateHash("test1.json", folderId);
      const hash2 = fileHasher.generateHash("test2.json", folderId);

      expect(hash1).not.toBe(hash2);
    });

    test("should generate hash with specified length", () => {
      const fileName = "test-snippets.json";
      const folderId = "folder-123";
      const length = 8;

      const hash = fileHasher.generateHash(fileName, folderId, length);

      expect(hash.length).toBe(length);
    });

    test("should handle empty or undefined inputs", () => {
      expect(() => fileHasher.generateHash("", "folder-123")).not.toThrow();
      expect(() => fileHasher.generateHash("test.json", "")).not.toThrow();

      const hash1 = fileHasher.generateHash("", "folder-123");
      const hash2 = fileHasher.generateHash("test.json", "");

      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
    });
  });

  describe("File Name Prefixing", () => {
    test("should create prefixed file name", () => {
      const originalName = "snippets.json";
      const hash = "abc123";

      const prefixedName = fileHasher.createPrefixedFileName(
        originalName,
        hash,
      );

      expect(prefixedName).toBe("abc123_snippets.json");
    });

    test("should handle files without extensions", () => {
      const originalName = "README";
      const hash = "def456";

      const prefixedName = fileHasher.createPrefixedFileName(
        originalName,
        hash,
      );

      expect(prefixedName).toBe("def456_README");
    });

    test("should handle files with multiple dots", () => {
      const originalName = "config.backup.json";
      const hash = "ghi789";

      const prefixedName = fileHasher.createPrefixedFileName(
        originalName,
        hash,
      );

      expect(prefixedName).toBe("ghi789_config.backup.json");
    });

    test("should handle empty file name", () => {
      const originalName = "";
      const hash = "jkl012";

      const prefixedName = fileHasher.createPrefixedFileName(
        originalName,
        hash,
      );

      expect(prefixedName).toBe("jkl012_");
    });
  });

  describe("Hash Mapping", () => {
    test("should store and retrieve hash mappings", () => {
      const fileName = "test.json";
      const folderId = "folder-123";
      const hash = fileHasher.generateHash(fileName, folderId);

      fileHasher.storeHashMapping(hash, fileName, folderId);

      const mapping = fileHasher.getHashMapping(hash);

      expect(mapping).toBeDefined();
      expect(mapping?.fileName).toBe(fileName);
      expect(mapping?.folderId).toBe(folderId);
    });

    test("should return undefined for non-existent hash", () => {
      const mapping = fileHasher.getHashMapping("nonexistent");

      expect(mapping).toBeUndefined();
    });

    test("should update existing mapping", () => {
      const hash = "test123";
      const fileName1 = "file1.json";
      const fileName2 = "file2.json";
      const folderId = "folder-123";

      fileHasher.storeHashMapping(hash, fileName1, folderId);
      fileHasher.storeHashMapping(hash, fileName2, folderId);

      const mapping = fileHasher.getHashMapping(hash);

      expect(mapping?.fileName).toBe(fileName2);
    });
  });

  describe("Collision Detection", () => {
    test("should detect potential collisions", () => {
      const fileName = "test.json";
      const folderId1 = "folder-123";
      const folderId2 = "folder-456";

      const hash1 = fileHasher.generateHash(fileName, folderId1);
      const hash2 = fileHasher.generateHash(fileName, folderId2);

      fileHasher.storeHashMapping(hash1, fileName, folderId1);
      fileHasher.storeHashMapping(hash2, fileName, folderId2);

      const collisions = fileHasher.detectCollisions(fileName);

      expect(collisions.length).toBe(2);
      expect(collisions).toContain(hash1);
      expect(collisions).toContain(hash2);
    });

    test("should return empty array when no collisions", () => {
      const fileName = "unique.json";
      const folderId = "folder-123";

      const hash = fileHasher.generateHash(fileName, folderId);
      fileHasher.storeHashMapping(hash, fileName, folderId);

      const collisions = fileHasher.detectCollisions("different.json");

      expect(collisions).toHaveLength(0);
    });
  });

  describe("Utility Methods", () => {
    test("should extract original file name from prefixed name", () => {
      const prefixedName = "abc123_snippets.json";
      const originalName = fileHasher.extractOriginalFileName(prefixedName);

      expect(originalName).toBe("snippets.json");
    });

    test("should handle prefixed name without underscore", () => {
      const prefixedName = "abc123";
      const originalName = fileHasher.extractOriginalFileName(prefixedName);

      expect(originalName).toBe("abc123");
    });

    test("should extract hash from prefixed name", () => {
      const prefixedName = "abc123_snippets.json";
      const hash = fileHasher.extractHashFromFileName(prefixedName);

      expect(hash).toBe("abc123");
    });

    test("should handle non-prefixed file name", () => {
      const fileName = "snippets.json";
      const hash = fileHasher.extractHashFromFileName(fileName);

      expect(hash).toBe("");
    });
  });

  describe("Cleanup Operations", () => {
    test("should clear all hash mappings", () => {
      const fileName = "test.json";
      const folderId = "folder-123";
      const hash = fileHasher.generateHash(fileName, folderId);

      fileHasher.storeHashMapping(hash, fileName, folderId);

      expect(fileHasher.getHashMapping(hash)).toBeDefined();

      fileHasher.clearHashMappings();

      expect(fileHasher.getHashMapping(hash)).toBeUndefined();
    });

    test("should get all hash mappings", () => {
      const mappings = [
        { fileName: "file1.json", folderId: "folder-123" },
        { fileName: "file2.json", folderId: "folder-456" },
      ];

      const hashes = mappings.map((m) => {
        const hash = fileHasher.generateHash(m.fileName, m.folderId);
        fileHasher.storeHashMapping(hash, m.fileName, m.folderId);
        return hash;
      });

      const allMappings = fileHasher.getAllHashMappings();

      expect(allMappings.size).toBe(2);
      expect(allMappings.has(hashes[0])).toBe(true);
      expect(allMappings.has(hashes[1])).toBe(true);
    });
  });
});
