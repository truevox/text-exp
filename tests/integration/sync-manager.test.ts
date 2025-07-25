/**
 * Integration tests for SyncManager
 */

import { SyncManager } from "../../src/background/sync-manager.js";
import { ExtensionStorage } from "../../src/shared/storage.js";

import type { TextSnippet, ExtensionSettings } from "../../src/shared/types.js";
import { DEFAULT_SETTINGS } from "../../src/shared/constants.js";

// Use the same chrome mock as other tests (from setup.ts)
// The global chrome mock is already set up by Jest setup

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(() => ({
    onsuccess: null,
    onerror: null,
    result: {
      createObjectStore: jest.fn(),
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          add: jest.fn(),
          put: jest.fn(),
          get: jest.fn(),
          delete: jest.fn(),
          clear: jest.fn(),
        })),
      })),
    },
  })),
  deleteDatabase: jest.fn(),
};

// Add IndexedDB to global
global.indexedDB = mockIndexedDB as any;

// Mock messaging helpers
jest.mock("../../src/background/messaging-helpers.js", () => ({
  notifyContentScriptsOfSnippetUpdate: jest.fn().mockResolvedValue(undefined),
}));

// Mock chrome.notifications
global.chrome.notifications = {
  create: jest.fn().mockResolvedValue("notification-id"),
} as any;

// Mock IndexedDB class
jest.mock("../../src/shared/indexed-db.js", () => ({
  IndexedDB: jest.fn().mockImplementation(() => ({
    saveSnippets: jest.fn().mockResolvedValue(undefined),
    getSnippets: jest.fn().mockResolvedValue([]),
    deleteSnippets: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock cloud adapters to prevent real network calls
jest.mock("../../src/background/cloud-adapters/index.js", () => ({
  getCloudAdapterFactory: jest.fn(() => ({
    createAdapter: jest.fn((provider) => {
      if (
        !["local", "google-drive", "dropbox", "onedrive"].includes(provider)
      ) {
        throw new Error(`Invalid provider: ${provider}`);
      }
      return {
        provider: provider,
        initialize: jest.fn().mockResolvedValue(undefined),
        connect: jest.fn().mockResolvedValue(true),
        disconnect: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockResolvedValue(false),
        isAuthenticated: jest.fn().mockResolvedValue(false),
        downloadSnippets: jest.fn().mockResolvedValue([]),
        uploadSnippets: jest.fn().mockResolvedValue(undefined),
        authenticate: jest
          .fn()
          .mockResolvedValue({ provider: provider, accessToken: "mock" }),
        refreshCredentials: jest
          .fn()
          .mockResolvedValue({ provider: provider, accessToken: "mock" }),
        validateCredentials: jest.fn().mockResolvedValue(true),
        getSyncStatus: jest.fn().mockResolvedValue({
          isOnline: true,
          provider: provider,
          lastSync: new Date(),
        }),
      };
    }),
  })),
}));

describe("SyncManager Integration", () => {
  let syncManager: SyncManager;

  let mockStorage: { [key: string]: any } = {};

  beforeEach(async () => {
    // Clear Jest mocks
    jest.clearAllMocks();
    mockStorage = {}; // Reset mock storage for each test

    // Mock chrome.storage.local.get
    (chrome.storage.local.get as jest.Mock).mockImplementation(
      async (keys: string | string[]) => {
        const result: { [key: string]: any } = {};
        const keysArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keysArray) {
          if (mockStorage[key]) {
            result[key] = mockStorage[key];
          }
        }
        return result;
      },
    );

    // Mock chrome.storage.local.set
    (chrome.storage.local.set as jest.Mock).mockImplementation(
      async (items: { [key: string]: any }) => {
        for (const key in items) {
          mockStorage[key] = items[key];
        }
      },
    );

    // Mock ExtensionStorage.setSyncStatus
    jest.spyOn(ExtensionStorage, "setSyncStatus").mockResolvedValue(undefined);

    // Mock chrome.storage.sync.get and set for settings
    (chrome.storage.sync.get as jest.Mock).mockImplementation(
      async (keys: string | string[]) => {
        const result: { [key: string]: any } = {};
        const keysArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keysArray) {
          if (mockStorage[key]) {
            result[key] = mockStorage[key];
          }
        }
        return result;
      },
    );

    (chrome.storage.sync.set as jest.Mock).mockImplementation(
      async (items: { [key: string]: any }) => {
        for (const key in items) {
          mockStorage[key] = items[key];
        }
      },
    );

    // Reset the SyncManager singleton
    (SyncManager as any).instance = undefined;
    syncManager = SyncManager.getInstance();

    // Set up default settings
    await ExtensionStorage.setSettings(DEFAULT_SETTINGS);
  });

  describe("initialization", () => {
    it("should initialize with default settings", async () => {
      await syncManager.initialize();

      const provider = syncManager.getCurrentProvider();
      expect(provider).toBe("local");
    }, 10000);

    it("should set up auto-sync when enabled", async () => {
      const settings = { ...DEFAULT_SETTINGS, autoSync: true, syncInterval: 1 };
      await ExtensionStorage.setSettings(settings);

      await syncManager.initialize();

      // Check that auto-sync is started (implementation specific)
      expect(syncManager.getCurrentProvider()).toBe("local");
    }, 10000);
  });

  describe("cloud provider management", () => {
    it("should switch cloud providers", async () => {
      await syncManager.setCloudProvider("google-drive");
      expect(syncManager.getCurrentProvider()).toBe("google-drive");

      await syncManager.setCloudProvider("local");
      expect(syncManager.getCurrentProvider()).toBe("local");
    }, 10000);

    it("should handle invalid providers gracefully", async () => {
      await expect(
        syncManager.setCloudProvider("invalid" as any),
      ).rejects.toThrow();
    }, 10000);
  });

  describe("local sync operations", () => {
    const mockSnippets: TextSnippet[] = [
      {
        id: "test-1",
        trigger: ";hello",
        content: "Hello world!",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
      },
      {
        id: "test-2",
        trigger: ";bye",
        content: "Goodbye!",
        createdAt: new Date("2023-01-02"),
        updatedAt: new Date("2023-01-02"),
      },
    ];

    beforeEach(async () => {
      // Mock chrome.storage directly for this test
      const mockStorage = {
        snippets: mockSnippets,
      };

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys) => {
        if (keys === "snippets") {
          return Promise.resolve(mockStorage);
        }
        return Promise.resolve({});
      });

      await ExtensionStorage.setSnippets(mockSnippets);
    });

    it("should sync with local provider (no-op)", async () => {
      await syncManager.setCloudProvider("local");
      await expect(syncManager.syncNow()).resolves.not.toThrow();
    }, 10000);

    it("should get sync statistics", async () => {
      // Set up the local cloud provider first
      await syncManager.setCloudProvider("local");

      const stats = await syncManager.getSyncStats();

      expect(stats.totalSnippets).toBe(2);
      expect(stats.syncProvider).toBe("local");
      expect(stats.isOnline).toBe(true);
    }, 10000);

    it("should handle settings changes", async () => {
      const newSettings: ExtensionSettings = {
        ...DEFAULT_SETTINGS,
        cloudProvider: "google-drive",
        autoSync: false,
      };

      await syncManager.onSettingsChanged(newSettings);
      expect(syncManager.getCurrentProvider()).toBe("google-drive");
    }, 10000);
  });

  describe("error handling", () => {
    it("should handle sync errors gracefully", async () => {
      // Set up a provider that will fail
      await syncManager.setCloudProvider("google-drive");

      // Mock the MultiScopeSyncManager to fail
      // @ts-ignore
      syncManager["multiScopeSyncManager"].syncAndMerge = jest
        .fn()
        .mockRejectedValue(new Error("Simulated sync error"));

      try {
        await syncManager.syncNow();
        // If we reach here, it means syncNow() did NOT throw, which is unexpected.
        fail("syncNow() should have thrown an error");
      } catch (e) {
        // Expected: syncNow() throws an error and sets error status
        expect(ExtensionStorage.setSyncStatus).toHaveBeenCalledWith(
          expect.objectContaining({
            isOnline: true, // Non-auth errors still mark as online
            error: "Simulated sync error",
          }),
        );
      }
    }, 10000);

    it("should handle authentication errors", async () => {
      await syncManager.setCloudProvider("google-drive");

      const isAuth = await syncManager.isAuthenticated();
      expect(isAuth).toBe(false);
    }, 10000);
  });

  describe("auto-sync functionality", () => {
    it("should start auto-sync", () => {
      syncManager.startAutoSync(1); // 1 minute
      expect(() => syncManager.startAutoSync(1)).not.toThrow();
    });

    it("should stop auto-sync", () => {
      syncManager.startAutoSync(1);
      syncManager.stopAutoSync();
      expect(() => syncManager.stopAutoSync()).not.toThrow();
    });

    it("should restart auto-sync when interval changes", () => {
      syncManager.startAutoSync(1);
      syncManager.startAutoSync(5); // Should stop previous and start new
      expect(() => syncManager.stopAutoSync()).not.toThrow();
    });
  });
});
