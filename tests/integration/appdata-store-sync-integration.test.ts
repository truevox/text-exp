/**
 * Integration tests for appdata store sync integration
 */

import { SyncManager } from "../../src/background/sync-manager";
import { GoogleDriveAdapter } from "../../src/background/cloud-adapters/google-drive-adapter";
import { ExtensionStorage } from "../../src/shared/storage";
import type { SyncedSource } from "../../src/shared/types";
import type { TierStorageSchema } from "../../src/types/snippet-formats";

// Mock dependencies
jest.mock("../../src/shared/storage");
jest.mock("../../src/shared/indexed-db");
jest.mock("../../src/background/services/auth-service");
jest.mock("../../src/background/services/sync-state");
jest.mock("../../src/background/services/notification-service");
jest.mock("../../src/background/multi-format-sync-service");

// Mock IndexedDB for Node.js test environment
const mockIndexedDB = {
  open: jest.fn().mockReturnValue({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: null,
  }),
};
(global as any).indexedDB = mockIndexedDB;

describe("Appdata Store Sync Integration", () => {
  let syncManager: SyncManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock ExtensionStorage
    (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue({
      cloudProvider: "google-drive",
      autoSync: true,
      syncInterval: 5,
    });

    (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([
      {
        name: "personal",
        provider: "google-drive",
        folderId: "personal-folder-id",
        displayName: "Personal Snippets",
      },
    ]);

    (ExtensionStorage.getSnippets as jest.Mock).mockResolvedValue([]);
    (ExtensionStorage.getSyncStatus as jest.Mock).mockResolvedValue({
      provider: "google-drive",
      lastSync: null,
      isOnline: true,
      hasChanges: false,
    });

    syncManager = SyncManager.getInstance();
  });

  describe("Priority #0 Store Discovery in Sync Flow", () => {
    it("should include appdata store in sync sources when available", async () => {
      const mockSnippet = {
        id: "priority-snippet-1",
        trigger: "hp",
        content: "High Priority Snippet",
        contentType: "plaintext" as const,
        snipDependencies: [],
        description: "Test snippet",
        scope: "personal" as const,
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        lastUsed: new Date().toISOString(),
        variables: [],
        images: [],
        tags: [],
        createdBy: "test-user",
        updatedBy: "test-user",
      };

      const mockPriorityStore: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal" as any, // Using any to bypass type restriction for test
        snippets: [mockSnippet],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "test-user",
          description: "Test priority store",
        },
      };

      // Mock the adapter's discoverAppDataStore method
      const mockAdapter = {
        provider: "google-drive",
        discoverAppDataStore: jest.fn().mockResolvedValue({
          hasStore: true,
          snippets: mockPriorityStore.snippets,
          storeInfo: {
            name: "Priority #0 Store",
            tier: "priority-0" as any,
            lastModified: new Date().toISOString(),
          },
        }),
        initialize: jest.fn(),
        isAuthenticated: jest.fn().mockResolvedValue(true),
      };

      // Mock the adapter factory
      const mockFactory = {
        createAdapter: jest.fn().mockReturnValue(mockAdapter),
      };

      // Mock the getCloudAdapterFactory function
      const getCloudAdapterFactoryModule = require("../../src/background/cloud-adapters/index.js");
      jest
        .spyOn(getCloudAdapterFactoryModule, "getCloudAdapterFactory")
        .mockReturnValue(mockFactory);

      // Mock AuthenticationService.initializeWithStoredCredentials
      const AuthenticationService = require("../../src/background/services/auth-service");
      jest
        .spyOn(
          AuthenticationService.AuthenticationService,
          "initializeWithStoredCredentials",
        )
        .mockResolvedValue(true);

      // Mock the sync method to capture the sources
      let capturedSources: SyncedSource[] = [];
      const multiScopeSyncManager = (syncManager as any).multiScopeSyncManager;
      const originalSyncAndMerge = multiScopeSyncManager.syncAndMerge;

      // Override the method directly on the instance
      multiScopeSyncManager.syncAndMerge = jest
        .fn()
        .mockImplementation((sources) => {
          capturedSources = sources;
          return Promise.resolve([]);
        });

      // Initialize and perform sync
      await syncManager.initialize();
      await syncManager.setCloudProvider("google-drive");
      await syncManager.syncNow(); // This is what actually triggers the sync!

      // Restore original method
      multiScopeSyncManager.syncAndMerge = originalSyncAndMerge;

      // Verify that priority-0 source was included
      expect(capturedSources).toHaveLength(2);
      expect(capturedSources[0].name).toBe("priority-0");
      expect(capturedSources[0].displayName).toBe("Priority #0 Store");
      expect(capturedSources[0].folderId).toBe("appdata-priority-0");
      expect(capturedSources[1].name).toBe("personal");
    });

    it("should not include appdata store when none exists", async () => {
      // Mock the adapter's discoverAppDataStore method to return no store
      const mockAdapter = {
        provider: "google-drive",
        discoverAppDataStore: jest.fn().mockResolvedValue({
          hasStore: false,
          snippets: [],
        }),
        initialize: jest.fn(),
        isAuthenticated: jest.fn().mockResolvedValue(true),
      };

      // Mock the adapter factory
      const mockFactory = {
        createAdapter: jest.fn().mockReturnValue(mockAdapter),
      };

      // Mock the getCloudAdapterFactory function
      const getCloudAdapterFactoryModule = require("../../src/background/cloud-adapters/index.js");
      jest
        .spyOn(getCloudAdapterFactoryModule, "getCloudAdapterFactory")
        .mockReturnValue(mockFactory);

      // Mock AuthenticationService.initializeWithStoredCredentials
      const AuthenticationService = require("../../src/background/services/auth-service");
      jest
        .spyOn(
          AuthenticationService.AuthenticationService,
          "initializeWithStoredCredentials",
        )
        .mockResolvedValue(true);

      // Mock the sync method to capture the sources
      let capturedSources: SyncedSource[] = [];
      const multiScopeSyncManager = (syncManager as any).multiScopeSyncManager;
      const originalSyncAndMerge = multiScopeSyncManager.syncAndMerge;

      // Override the method directly on the instance
      multiScopeSyncManager.syncAndMerge = jest
        .fn()
        .mockImplementation((sources) => {
          capturedSources = sources;
          return Promise.resolve([]);
        });

      // Initialize and perform sync
      await syncManager.initialize();
      await syncManager.setCloudProvider("google-drive");
      await syncManager.syncNow(); // This is what actually triggers the sync!

      // Restore original method
      multiScopeSyncManager.syncAndMerge = originalSyncAndMerge;

      // Verify that only personal source was included
      expect(capturedSources).toHaveLength(1);
      expect(capturedSources[0].name).toBe("personal");
    });

    it("should handle appdata store discovery errors gracefully", async () => {
      // Mock the adapter's discoverAppDataStore method to throw an error
      const mockAdapter = {
        provider: "google-drive",
        discoverAppDataStore: jest
          .fn()
          .mockRejectedValue(new Error("Network error")),
        initialize: jest.fn(),
        isAuthenticated: jest.fn().mockResolvedValue(true),
      };

      // Mock the adapter factory
      const mockFactory = {
        createAdapter: jest.fn().mockReturnValue(mockAdapter),
      };

      // Mock the getCloudAdapterFactory function
      const getCloudAdapterFactoryModule = require("../../src/background/cloud-adapters/index.js");
      jest
        .spyOn(getCloudAdapterFactoryModule, "getCloudAdapterFactory")
        .mockReturnValue(mockFactory);

      // Mock AuthenticationService.initializeWithStoredCredentials
      const AuthenticationService = require("../../src/background/services/auth-service");
      jest
        .spyOn(
          AuthenticationService.AuthenticationService,
          "initializeWithStoredCredentials",
        )
        .mockResolvedValue(true);

      // Mock the sync method to capture the sources
      let capturedSources: SyncedSource[] = [];
      const originalSyncAndMerge = multiScopeSyncManager.syncAndMerge;

      // Override the method directly on the instance
      multiScopeSyncManager.syncAndMerge = jest
        .fn()
        .mockImplementation((sources) => {
          capturedSources = sources;
          return Promise.resolve([]);
        });

      // Initialize and perform sync
      await syncManager.initialize();
      await syncManager.setCloudProvider("google-drive");
      await syncManager.syncNow(); // This is what actually triggers the sync!

      // Restore original method
      multiScopeSyncManager.syncAndMerge = originalSyncAndMerge;

      // Verify that sync continues with just personal source
      expect(capturedSources).toHaveLength(1);
      expect(capturedSources[0].name).toBe("personal");
    });
  });

  describe("Multi-Scope Priority Handling", () => {
    it("should prioritize appdata store snippets over personal snippets", async () => {
      const prioritySnippet = {
        id: "priority-snippet-1",
        trigger: "test",
        content: "Priority content",
        contentType: "plaintext" as const,
        snipDependencies: [],
        description: "Priority snippet",
        scope: "personal" as const,
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        lastUsed: new Date().toISOString(),
        variables: [],
        images: [],
        tags: [],
        createdBy: "test-user",
        updatedBy: "test-user",
      };

      const personalSnippet = {
        id: "personal-snippet-1",
        trigger: "test", // Same trigger as priority snippet
        content: "Personal content",
        contentType: "plaintext" as const,
        snipDependencies: [],
        description: "Personal snippet",
        scope: "personal" as const,
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        lastUsed: new Date().toISOString(),
        variables: [],
        images: [],
        tags: [],
        createdBy: "test-user",
        updatedBy: "test-user",
      };

      // Create sources with the same trigger
      const sources: SyncedSource[] = [
        {
          name: "priority-0",
          adapter: new GoogleDriveAdapter(),
          folderId: "appdata-priority-0",
          displayName: "Priority #0 Store",
        },
        {
          name: "personal",
          adapter: new GoogleDriveAdapter(),
          folderId: "personal-folder-id",
          displayName: "Personal Snippets",
        },
      ];

      // Mock the fetchFromSource to return different snippets for each source
      const originalFetchFromSource = multiScopeSyncManager["fetchFromSource"];
      multiScopeSyncManager["fetchFromSource"] = jest
        .fn()
        .mockImplementation((source) => {
          if (source.name === "priority-0") {
            return Promise.resolve({ source, snippets: [prioritySnippet] });
          } else {
            return Promise.resolve({ source, snippets: [personalSnippet] });
          }
        });

      const mergedSnippets = await multiScopeSyncManager.syncAndMerge(sources);

      // Verify that the priority snippet wins
      expect(mergedSnippets).toHaveLength(1);
      expect(mergedSnippets[0].content).toBe("Priority content");
      expect(mergedSnippets[0].scope).toBe("priority-0");

      // Restore original method
      multiScopeSyncManager["fetchFromSource"] = originalFetchFromSource;
    });
  });
});
