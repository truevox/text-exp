/**
 * Store Permissions Manager Tests
 * Tests for read-only vs read-write store permissions
 */

import {
  StorePermissionsManager,
  type StorePermissionInfo,
  type CopyToWritableOptions,
  type PermissionCheckResult,
  getStorePermissionsManager,
  initializeStorePermissions,
  checkStorePermission,
  copySnippetToWritable,
} from "../../src/storage/store-permissions-manager";
import type { TextSnippet } from "../../src/shared/types";
import type { EnhancedSnippet } from "../../src/types/snippet-formats";

describe("StorePermissionsManager", () => {
  let manager: StorePermissionsManager;
  let mockStores: StorePermissionInfo[];
  let mockSnippet: TextSnippet;
  let mockEnhancedSnippet: EnhancedSnippet;

  beforeEach(() => {
    manager = new StorePermissionsManager();

    // Mock stores
    mockStores = [
      {
        storeId: "personal-rw",
        storeName: "personal.json",
        displayName: "Personal Store",
        tierName: "personal",
        permission: "read-write",
        isDriveFile: true,
        fileId: "drive_file_1",
        reason: undefined,
      },
      {
        storeId: "team-ro",
        storeName: "team.json",
        displayName: "Team Store (Read-Only)",
        tierName: "team",
        permission: "read-only",
        isDriveFile: true,
        fileId: "drive_file_2",
        reason: "Shared team store - editing disabled",
      },
      {
        storeId: "org-ro",
        storeName: "org.json",
        displayName: "Organization Store",
        tierName: "org",
        permission: "read-only",
        isDriveFile: false,
        reason: "Company policy - read-only access",
      },
      {
        storeId: "backup-rw",
        storeName: "backup.json",
        displayName: "Backup Store",
        tierName: "personal",
        permission: "read-write",
        isDriveFile: false,
      },
    ];

    // Mock snippets
    mockSnippet = {
      id: "test-snippet",
      trigger: ";hello",
      content: "Hello, World!",
      description: "Test snippet",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockEnhancedSnippet = {
      id: "enhanced-snippet",
      trigger: ";enhanced",
      content: "<p>Enhanced content</p>",
      contentType: "html",
      snipDependencies: ["personal-rw:;greeting:abc123"],
      description: "Enhanced test snippet",
      scope: "personal",
      variables: [{ name: "name", prompt: "Enter name" }],
      images: ["image1.jpg"],
      tags: ["test", "enhanced"],
      createdAt: "2023-01-01T00:00:00Z",
      createdBy: "testuser",
      updatedAt: "2023-01-01T00:00:00Z",
      updatedBy: "testuser",
    };

    // Register mock stores
    mockStores.forEach((store) => manager.registerStore(store));
  });

  describe("Store Registration", () => {
    test("should register stores correctly", () => {
      const newStore: StorePermissionInfo = {
        storeId: "new-store",
        storeName: "new.json",
        displayName: "New Store",
        tierName: "personal",
        permission: "read-write",
        isDriveFile: true,
      };

      manager.registerStore(newStore);

      expect(manager.hasStore("new-store")).toBe(true);
      expect(manager.getStoreInfo("new-store")).toMatchObject(newStore);
    });

    test("should update store permissions", () => {
      manager.updateStorePermissions(
        "personal-rw",
        "read-only",
        "Temporarily disabled",
      );

      const store = manager.getStoreInfo("personal-rw");
      expect(store?.permission).toBe("read-only");
      expect(store?.reason).toBe("Temporarily disabled");
    });

    test("should unregister stores", () => {
      expect(manager.hasStore("personal-rw")).toBe(true);

      manager.unregisterStore("personal-rw");

      expect(manager.hasStore("personal-rw")).toBe(false);
      expect(manager.getStoreInfo("personal-rw")).toBeNull();
    });
  });

  describe("Permission Checking", () => {
    test("should allow read operations on all stores", () => {
      mockStores.forEach((store) => {
        const result = manager.checkPermission(store.storeId, "read");
        expect(result.allowed).toBe(true);
      });
    });

    test("should allow write operations only on read-write stores", () => {
      const readWriteResult = manager.checkPermission("personal-rw", "write");
      expect(readWriteResult.allowed).toBe(true);

      const readOnlyResult = manager.checkPermission("team-ro", "write");
      expect(readOnlyResult.allowed).toBe(false);
      expect(readOnlyResult.suggestedAction).toBe("copy-to-writable");
      expect(readOnlyResult.alternativeStores).toBeDefined();
    });

    test("should allow delete operations only on read-write stores", () => {
      const readWriteResult = manager.checkPermission("personal-rw", "delete");
      expect(readWriteResult.allowed).toBe(true);

      const readOnlyResult = manager.checkPermission("team-ro", "delete");
      expect(readOnlyResult.allowed).toBe(false);
      expect(readOnlyResult.suggestedAction).toBe("copy-to-writable");
    });

    test("should allow copy operations on all stores by default", () => {
      mockStores.forEach((store) => {
        const result = manager.checkPermission(store.storeId, "copy");
        expect(result.allowed).toBe(true);
      });
    });

    test("should handle unknown store", () => {
      const result = manager.checkPermission("unknown-store", "read");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Store not found or not registered");
    });

    test("should handle unknown operation", () => {
      const result = manager.checkPermission("personal-rw", "unknown" as any);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Unknown operation: unknown");
    });
  });

  describe("Store Filtering", () => {
    test("should get writable stores", () => {
      const writableStores = manager.getWritableStores();
      expect(writableStores).toHaveLength(2);
      expect(writableStores.map((s) => s.storeId)).toEqual([
        "personal-rw",
        "backup-rw",
      ]);
    });

    test("should get writable stores for specific tier", () => {
      const personalWritableStores = manager.getWritableStores("personal");
      expect(personalWritableStores).toHaveLength(2);
      expect(personalWritableStores.map((s) => s.storeId)).toEqual([
        "personal-rw",
        "backup-rw",
      ]);

      const teamWritableStores = manager.getWritableStores("team");
      expect(teamWritableStores).toHaveLength(0);
    });

    test("should get read-only stores", () => {
      const readOnlyStores = manager.getReadOnlyStores();
      expect(readOnlyStores).toHaveLength(2);
      expect(readOnlyStores.map((s) => s.storeId)).toEqual([
        "team-ro",
        "org-ro",
      ]);
    });

    test("should find writable stores for copy", () => {
      const writableStores = manager.findWritableStoresForCopy(
        "team-ro",
        "team",
      );
      expect(writableStores).toHaveLength(0); // No writable team stores

      const allWritableStores = manager.findWritableStoresForCopy("team-ro");
      expect(allWritableStores).toHaveLength(2); // Expands to all writable stores
      expect(allWritableStores.map((s) => s.storeId)).toEqual([
        "personal-rw",
        "backup-rw",
      ]);
    });
  });

  describe("Copy to Writable", () => {
    test("should copy snippet from read-only to writable store", async () => {
      const options: CopyToWritableOptions = {
        sourceStoreId: "team-ro",
        targetStoreId: "personal-rw",
        snippet: mockSnippet,
      };

      const result = await manager.copyToWritable(options);

      expect(result.success).toBe(true);
      expect(result.newSnippetId).toBeDefined();
      expect(result.newSnippetId).not.toBe(mockSnippet.id);
      expect(result.copiedSnippet).toBeDefined();
      expect(result.copiedSnippet?.trigger).toBe(mockSnippet.trigger);
      expect(result.copiedSnippet?.content).toBe(mockSnippet.content);
    });

    test("should preserve metadata when requested", async () => {
      const options: CopyToWritableOptions = {
        sourceStoreId: "team-ro",
        targetStoreId: "personal-rw",
        snippet: mockSnippet,
        preserveMetadata: true,
      };

      const result = await manager.copyToWritable(options);

      expect(result.success).toBe(true);
      expect(result.copiedSnippet?.description).toContain(
        mockSnippet.description,
      );
    });

    test("should update dependencies when copying enhanced snippet", async () => {
      const options: CopyToWritableOptions = {
        sourceStoreId: "team-ro",
        targetStoreId: "personal-rw",
        snippet: mockEnhancedSnippet,
        updateDependencies: true,
      };

      const result = await manager.copyToWritable(options);

      expect(result.success).toBe(true);
      expect(result.copiedSnippet).toBeDefined();

      const copied = result.copiedSnippet as EnhancedSnippet;
      expect(copied.snipDependencies).toEqual(["personal-rw:;greeting:abc123"]);
    });

    test("should fail to copy from non-existent source store", async () => {
      const options: CopyToWritableOptions = {
        sourceStoreId: "non-existent",
        targetStoreId: "personal-rw",
        snippet: mockSnippet,
      };

      const result = await manager.copyToWritable(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Cannot copy from source store: Store not found or not registered",
      );
    });

    test("should fail to copy to read-only target store", async () => {
      const options: CopyToWritableOptions = {
        sourceStoreId: "personal-rw",
        targetStoreId: "team-ro",
        snippet: mockSnippet,
      };

      const result = await manager.copyToWritable(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Cannot write to target store: Shared team store - editing disabled",
      );
    });

    test("should generate warnings for complex snippets", async () => {
      const options: CopyToWritableOptions = {
        sourceStoreId: "team-ro",
        targetStoreId: "personal-rw",
        snippet: mockEnhancedSnippet,
      };

      const result = await manager.copyToWritable(options);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });

    test("should add copy metadata to description", async () => {
      const options: CopyToWritableOptions = {
        sourceStoreId: "team-ro",
        targetStoreId: "personal-rw",
        snippet: mockSnippet,
      };

      const result = await manager.copyToWritable(options);

      expect(result.success).toBe(true);
      expect(result.copiedSnippet?.description).toContain(
        "[Copied from Team Store (Read-Only)]",
      );
    });
  });

  describe("Validation", () => {
    test("should validate store permissions", () => {
      const result = manager.validateStorePermissions([
        "personal-rw",
        "team-ro",
      ]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.readOnlyStores).toHaveLength(1);
      expect(result.writableStores).toHaveLength(1);
    });

    test("should fail validation with only read-only stores", () => {
      const result = manager.validateStorePermissions(["team-ro", "org-ro"]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "At least one writable store is required for editing operations",
      );
      expect(result.readOnlyStores).toHaveLength(2);
      expect(result.writableStores).toHaveLength(0);
    });

    test("should fail validation with unknown stores", () => {
      const result = manager.validateStorePermissions(["unknown-store"]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Store not found: unknown-store");
    });

    test("should generate warnings for non-copyable stores", () => {
      // Update a store to not allow copying
      const store = manager.getStoreInfo("team-ro");
      if (store) {
        store.canCopyTo = false;
        manager.registerStore(store);
      }

      const result = manager.validateStorePermissions(["team-ro"]);

      expect(result.warnings).toContain(
        "Read-only store Team Store (Read-Only) does not allow copying",
      );
    });
  });

  describe("Utility Methods", () => {
    test("should get all stores", () => {
      const allStores = manager.getAllStores();
      expect(allStores).toHaveLength(mockStores.length);
    });

    test("should check if store exists", () => {
      expect(manager.hasStore("personal-rw")).toBe(true);
      expect(manager.hasStore("non-existent")).toBe(false);
    });

    test("should get store info", () => {
      const store = manager.getStoreInfo("personal-rw");
      expect(store).toBeDefined();
      expect(store?.storeId).toBe("personal-rw");

      const nonExistent = manager.getStoreInfo("non-existent");
      expect(nonExistent).toBeNull();
    });
  });

  describe("Caching", () => {
    test("should cache permission results", () => {
      const spy = jest.spyOn(manager as any, "evaluatePermission");

      // First call should evaluate
      manager.checkPermission("personal-rw", "read");
      expect(spy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      manager.checkPermission("personal-rw", "read");
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });

    test("should clear cache when store permissions are updated", () => {
      const spy = jest.spyOn(manager as any, "evaluatePermission");

      // First call
      manager.checkPermission("personal-rw", "write");
      expect(spy).toHaveBeenCalledTimes(1);

      // Update permissions (should clear cache)
      manager.updateStorePermissions("personal-rw", "read-only");

      // Next call should re-evaluate
      manager.checkPermission("personal-rw", "write");
      expect(spy).toHaveBeenCalledTimes(2);

      spy.mockRestore();
    });

    test("should clear all caches", () => {
      // Make some cached calls
      manager.checkPermission("personal-rw", "read");
      manager.checkPermission("team-ro", "write");

      const stats = manager.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      manager.clearCache();

      const clearedStats = manager.getCacheStats();
      expect(clearedStats.size).toBe(0);
    });

    test("should get cache statistics", () => {
      const stats = manager.getCacheStats();
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("stores");
      expect(stats.stores).toBe(mockStores.length);
    });
  });

  describe("Permissions Refresh", () => {
    test("should refresh all permissions", async () => {
      const spy = jest.spyOn(manager as any, "checkDriveFilePermission");
      spy.mockResolvedValue("read-only");

      await manager.refreshAllPermissions();

      // Should call checkDriveFilePermission for each Drive store
      const driveStores = mockStores.filter((s) => s.isDriveFile);
      expect(spy).toHaveBeenCalledTimes(driveStores.length);

      spy.mockRestore();
    });

    test("should handle refresh errors gracefully", async () => {
      const spy = jest.spyOn(manager as any, "checkDriveFilePermission");
      spy.mockRejectedValue(new Error("Network error"));

      // Should not throw
      await expect(manager.refreshAllPermissions()).resolves.not.toThrow();

      spy.mockRestore();
    });
  });
});

describe("Global Manager Functions", () => {
  beforeEach(() => {
    // Reset global state
    (global as any).globalPermissionsManager = null;
  });

  test("should get global permissions manager", () => {
    const manager1 = getStorePermissionsManager();
    const manager2 = getStorePermissionsManager();

    expect(manager1).toBe(manager2); // Should be same instance
  });

  test("should initialize store permissions", () => {
    const stores: StorePermissionInfo[] = [
      {
        storeId: "test-store",
        storeName: "test.json",
        displayName: "Test Store",
        tierName: "personal",
        permission: "read-write",
        isDriveFile: false,
      },
    ];

    initializeStorePermissions(stores);

    const manager = getStorePermissionsManager();
    expect(manager.hasStore("test-store")).toBe(true);
  });

  test("should check store permission with utility function", () => {
    const stores: StorePermissionInfo[] = [
      {
        storeId: "test-store",
        storeName: "test.json",
        displayName: "Test Store",
        tierName: "personal",
        permission: "read-write",
        isDriveFile: false,
      },
    ];

    initializeStorePermissions(stores);

    const result = checkStorePermission("test-store", "write");
    expect(result.allowed).toBe(true);
  });

  test("should copy snippet to writable with utility function", async () => {
    const stores: StorePermissionInfo[] = [
      {
        storeId: "source-store",
        storeName: "source.json",
        displayName: "Source Store",
        tierName: "personal",
        permission: "read-only",
        isDriveFile: false,
      },
      {
        storeId: "target-store",
        storeName: "target.json",
        displayName: "Target Store",
        tierName: "personal",
        permission: "read-write",
        isDriveFile: false,
      },
    ];

    initializeStorePermissions(stores);

    const snippet: TextSnippet = {
      id: "test-snippet",
      trigger: ";test",
      content: "Test content",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await copySnippetToWritable(
      snippet,
      "source-store",
      "target-store",
    );
    expect(result.success).toBe(true);
    expect(result.copiedSnippet).toBeDefined();
  });
});

describe("Permission Edge Cases", () => {
  let manager: StorePermissionsManager;

  beforeEach(() => {
    manager = new StorePermissionsManager();
  });

  test("should handle store with no copy permission", () => {
    const store: StorePermissionInfo = {
      storeId: "no-copy-store",
      storeName: "no-copy.json",
      displayName: "No Copy Store",
      tierName: "personal",
      permission: "read-only",
      isDriveFile: false,
      canCopyTo: false,
    };

    manager.registerStore(store);

    const result = manager.checkPermission("no-copy-store", "copy");
    expect(result.allowed).toBe(false);
    expect(result.suggestedAction).toBe("view-only");
  });

  test("should handle complex dependency updates", async () => {
    const store1: StorePermissionInfo = {
      storeId: "store1",
      storeName: "store1.json",
      displayName: "Store 1",
      tierName: "personal",
      permission: "read-only",
      isDriveFile: false,
    };

    const store2: StorePermissionInfo = {
      storeId: "store2",
      storeName: "store2.json",
      displayName: "Store 2",
      tierName: "personal",
      permission: "read-write",
      isDriveFile: false,
    };

    manager.registerStore(store1);
    manager.registerStore(store2);

    const snippetWithDeps: EnhancedSnippet = {
      id: "dep-snippet",
      trigger: ";deps",
      content: "Content with dependencies",
      contentType: "html",
      snipDependencies: [
        "store1:;dep1:id1",
        "other-store:;dep2:id2",
        "store1:;dep3:id3",
      ],
      description: "Snippet with dependencies",
      scope: "personal",
      variables: [],
      images: [],
      tags: [],
      createdAt: "2023-01-01T00:00:00Z",
      createdBy: "user",
      updatedAt: "2023-01-01T00:00:00Z",
      updatedBy: "user",
    };

    const result = await manager.copyToWritable({
      sourceStoreId: "store1",
      targetStoreId: "store2",
      snippet: snippetWithDeps,
      updateDependencies: true,
    });

    expect(result.success).toBe(true);
    const copied = result.copiedSnippet as EnhancedSnippet;
    expect(copied.snipDependencies).toEqual([
      "store2:;dep1:id1",
      "other-store:;dep2:id2",
      "store2:;dep3:id3",
    ]);
  });

  test("should handle malformed dependencies gracefully", async () => {
    const store1: StorePermissionInfo = {
      storeId: "store1",
      storeName: "store1.json",
      displayName: "Store 1",
      tierName: "personal",
      permission: "read-only",
      isDriveFile: false,
    };

    const store2: StorePermissionInfo = {
      storeId: "store2",
      storeName: "store2.json",
      displayName: "Store 2",
      tierName: "personal",
      permission: "read-write",
      isDriveFile: false,
    };

    manager.registerStore(store1);
    manager.registerStore(store2);

    const snippetWithBadDeps: EnhancedSnippet = {
      id: "bad-dep-snippet",
      trigger: ";baddeps",
      content: "Content with bad dependencies",
      contentType: "html",
      snipDependencies: ["valid:;dep1:id1", "invalid-format", "only-two:parts"],
      description: "Snippet with malformed dependencies",
      scope: "personal",
      variables: [],
      images: [],
      tags: [],
      createdAt: "2023-01-01T00:00:00Z",
      createdBy: "user",
      updatedAt: "2023-01-01T00:00:00Z",
      updatedBy: "user",
    };

    const result = await manager.copyToWritable({
      sourceStoreId: "store1",
      targetStoreId: "store2",
      snippet: snippetWithBadDeps,
      updateDependencies: true,
    });

    expect(result.success).toBe(true);
    const copied = result.copiedSnippet as EnhancedSnippet;
    expect(copied.snipDependencies).toEqual([
      "valid:;dep1:id1",
      "invalid-format",
      "only-two:parts",
    ]);
  });
});
