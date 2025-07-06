/**
 * Integration tests for storage timing validation
 * Tests the critical storage timing fix from v0.10.4
 */

// @ts-nocheck - Disable strict type checking for Jest mocking issues
import { jest } from "@jest/globals";
import { SyncManager } from "../../src/background/sync-manager.js";
import { ExtensionStorage } from "../../src/shared/storage.js";
import { IndexedDB } from "../../src/shared/indexed-db.js";
import { notifyContentScriptsOfSnippetUpdate } from "../../src/background/messaging-helpers.js";
import type { TextSnippet, CloudAdapter } from "../../src/shared/types.js";

// Mock dependencies
jest.mock("../../src/shared/storage.js");
jest.mock("../../src/shared/indexed-db.js");
jest.mock("../../src/background/messaging-helpers.js");
jest.mock("../../src/background/cloud-adapters/index.js");

describe("Storage Timing Validation - Critical Fix Tests", () => {
  let syncManager: SyncManager;
  let mockIndexedDB: jest.Mocked<IndexedDB>;
  let mockExtensionStorage: jest.Mocked<typeof ExtensionStorage>;
  let mockNotifyContentScripts: jest.MockedFunction<
    typeof notifyContentScriptsOfSnippetUpdate
  >;
  let mockAdapter: jest.Mocked<CloudAdapter>;

  const testSnippets: TextSnippet[] = [
    {
      id: "test-eata",
      trigger: "eata",
      content: "Bag of Dicks!!",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastModified: new Date(),
      isActive: true,
      scope: "personal" as const,
    },
  ];

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock IndexedDB
    mockIndexedDB = {
      saveSnippets: jest.fn().mockResolvedValue(undefined),
      getSnippets: jest.fn().mockResolvedValue(testSnippets),
      deleteSnippets: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Mock ExtensionStorage
    mockExtensionStorage = ExtensionStorage as jest.Mocked<
      typeof ExtensionStorage
    >;
    mockExtensionStorage.getSnippets = jest.fn().mockResolvedValue([]);
    mockExtensionStorage.setSnippets = jest.fn().mockResolvedValue(undefined);
    mockExtensionStorage.getSettings = jest.fn().mockResolvedValue({
      cloudProvider: "google-drive",
      autoSync: true,
      syncInterval: 30,
      showNotifications: true,
    });
    mockExtensionStorage.getScopedSources = jest.fn().mockResolvedValue([]);
    mockExtensionStorage.setLastSync = jest.fn().mockResolvedValue(undefined);
    mockExtensionStorage.setSyncStatus = jest.fn().mockResolvedValue(undefined);

    // Mock messaging helper
    mockNotifyContentScripts =
      notifyContentScriptsOfSnippetUpdate as jest.MockedFunction<
        typeof notifyContentScriptsOfSnippetUpdate
      >;
    mockNotifyContentScripts.mockResolvedValue(undefined);

    // Mock cloud adapter
    mockAdapter = {
      provider: "google-drive",
      authenticate: jest.fn().mockResolvedValue({
        provider: "google-drive",
        accessToken: "test-token",
      }),
      initialize: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: jest.fn().mockResolvedValue(true),
      downloadSnippets: jest.fn().mockResolvedValue(testSnippets),
      uploadSnippets: jest.fn().mockResolvedValue(undefined),
      deleteSnippets: jest.fn().mockResolvedValue(undefined),
      getSyncStatus: jest.fn().mockResolvedValue({
        provider: "google-drive",
        lastSync: new Date(),
        isOnline: true,
        hasChanges: false,
      }),
      getFolders: jest.fn().mockResolvedValue([]),
      createFolder: jest
        .fn()
        .mockResolvedValue({ id: "test-folder", name: "Test Folder" }),
    };

    // Get fresh singleton instance
    syncManager = SyncManager.getInstance();

    // Replace private IndexedDB instance
    (syncManager as any).indexedDB = mockIndexedDB;
    (syncManager as any).currentAdapter = mockAdapter;
  });

  describe("Critical Storage Timing Fix - syncNow()", () => {
    test("CRITICAL: IndexedDB update completes BEFORE content script notification", async () => {
      // Track call order to verify timing fix
      const callOrder: string[] = [];

      // Mock with call tracking
      mockExtensionStorage.setSnippets.mockImplementation(async () => {
        callOrder.push("chrome.storage.local.setSnippets");
      });

      mockIndexedDB.saveSnippets.mockImplementation(async () => {
        callOrder.push("indexedDB.saveSnippets");
      });

      mockNotifyContentScripts.mockImplementation(async () => {
        callOrder.push("notifyContentScripts");
      });

      // Perform sync
      await syncManager.syncNow();

      // CRITICAL: Verify the exact order that fixes the race condition
      expect(callOrder).toEqual([
        "chrome.storage.local.setSnippets",
        "indexedDB.saveSnippets",
        "notifyContentScripts",
      ]);
    });

    test("CRITICAL: IndexedDB saveSnippets is awaited before notification", async () => {
      let indexedDBCompleted = false;
      let notificationSent = false;

      // Mock IndexedDB with timing simulation
      mockIndexedDB.saveSnippets.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async delay
        indexedDBCompleted = true;
      });

      // Mock notification to check state when called
      mockNotifyContentScripts.mockImplementation(async () => {
        notificationSent = true;
        // CRITICAL: IndexedDB must be completed when notification is sent
        expect(indexedDBCompleted).toBe(true);
      });

      await syncManager.syncNow();

      expect(indexedDBCompleted).toBe(true);
      expect(notificationSent).toBe(true);
      expect(mockIndexedDB.saveSnippets).toHaveBeenCalledWith(testSnippets);
      expect(mockNotifyContentScripts).toHaveBeenCalled();
    });

    test("RACE CONDITION PREVENTION: Content scripts get latest data", async () => {
      // Simulate the exact scenario from manual testing
      const cloudSnippets = [
        {
          id: "eata-from-drive",
          trigger: "eata",
          content: "Bag of Dicks!!",
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: "personal",
        },
      ];

      const localSnippets = [
        {
          id: "local-1",
          trigger: "hello",
          content: "Hello World!",
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: "personal",
        },
      ];

      mockExtensionStorage.getSnippets.mockResolvedValue(localSnippets);
      mockAdapter.downloadSnippets.mockResolvedValue(cloudSnippets);

      // Track final merged snippets passed to IndexedDB
      let finalSnippets: TextSnippet[] = [];
      mockIndexedDB.saveSnippets.mockImplementation(async (snippets) => {
        finalSnippets = snippets;
      });

      await syncManager.syncNow();

      // Verify merged snippets include both local and cloud
      expect(finalSnippets).toHaveLength(2);
      expect(finalSnippets.find((s) => s.trigger === "eata")).toBeTruthy();
      expect(finalSnippets.find((s) => s.trigger === "hello")).toBeTruthy();

      // Verify IndexedDB received the complete merged data
      expect(mockIndexedDB.saveSnippets).toHaveBeenCalledWith(finalSnippets);
    });

    test("ERROR HANDLING: IndexedDB failure prevents content script notification", async () => {
      // Simulate IndexedDB failure
      mockIndexedDB.saveSnippets.mockRejectedValue(
        new Error("IndexedDB write failed"),
      );

      await expect(syncManager.syncNow()).rejects.toThrow();

      // CRITICAL: Content scripts should NOT be notified if IndexedDB fails
      expect(mockNotifyContentScripts).not.toHaveBeenCalled();
    });

    test("CONSISTENCY CHECK: chrome.storage.local and IndexedDB receive same data", async () => {
      let chromeStorageData: TextSnippet[] = [];
      let indexedDBData: TextSnippet[] = [];

      mockExtensionStorage.setSnippets.mockImplementation(async (snippets) => {
        chromeStorageData = snippets;
      });

      mockIndexedDB.saveSnippets.mockImplementation(async (snippets) => {
        indexedDBData = snippets;
      });

      await syncManager.syncNow();

      // Both storage layers must have identical data
      expect(chromeStorageData).toEqual(indexedDBData);
      expect(chromeStorageData).toEqual(testSnippets);
    });
  });

  describe("Multi-Scope Sync Timing", () => {
    test("Complex merge operations maintain storage timing", async () => {
      const personalSnippets = [
        {
          id: "1",
          trigger: "personal1",
          content: "Personal content",
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: "personal",
        },
      ];

      const departmentSnippets = [
        {
          id: "2",
          trigger: "dept1",
          content: "Department content",
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: "department",
        },
      ];

      // Mock multi-scope sync
      mockAdapter.downloadSnippets
        .mockResolvedValueOnce(personalSnippets)
        .mockResolvedValueOnce(departmentSnippets);

      const callOrder: string[] = [];

      mockExtensionStorage.setSnippets.mockImplementation(async () => {
        callOrder.push("storage-update");
      });

      mockIndexedDB.saveSnippets.mockImplementation(async () => {
        callOrder.push("indexedDB-update");
      });

      mockNotifyContentScripts.mockImplementation(async () => {
        callOrder.push("notify-scripts");
      });

      await syncManager.syncNow();

      // Verify order maintained even with complex merging
      expect(callOrder).toEqual([
        "storage-update",
        "indexedDB-update",
        "notify-scripts",
      ]);
    });
  });

  describe("Performance and Timing Validation", () => {
    test("Storage operations complete within reasonable time bounds", async () => {
      const startTime = Date.now();

      // Add realistic delays
      mockExtensionStorage.setSnippets.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      mockIndexedDB.saveSnippets.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await syncManager.syncNow();

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (allowing for sequential operations)
      expect(duration).toBeLessThan(1000); // 1 second max
      expect(duration).toBeGreaterThan(150); // Must include both delays
    });

    test("Concurrent sync attempts are properly handled", async () => {
      // First sync should proceed
      const firstSync = syncManager.syncNow();

      // Second sync should fail immediately due to lock
      await expect(syncManager.syncNow()).rejects.toThrow(
        "Sync already in progress",
      );

      // First sync should complete successfully
      await expect(firstSync).resolves.toBeUndefined();
    });
  });
});
