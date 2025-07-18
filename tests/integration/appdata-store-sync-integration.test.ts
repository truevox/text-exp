/**
 * Integration tests for appdata store sync integration
 */

import { SyncManager } from "../../src/background/sync-manager";
import { MultiScopeSyncManager } from "../../src/background/multi-scope-sync-manager";
import { GoogleDriveAdapter } from "../../src/background/cloud-adapters/google-drive-adapter";
import { ExtensionStorage } from "../../src/shared/storage";
import type { CloudCredentials, SyncedSource } from "../../src/shared/types";
import type { TierStorageSchema } from "../../src/types/snippet-formats";

// Mock dependencies
jest.mock("../../src/shared/storage");
jest.mock("../../src/background/services/auth-service");
jest.mock("../../src/background/services/sync-state");
jest.mock("../../src/background/services/notification-service");
jest.mock("../../src/background/multi-format-sync-service");

describe("Appdata Store Sync Integration", () => {
  let syncManager: SyncManager;
  let multiScopeSyncManager: MultiScopeSyncManager;
  let mockCredentials: CloudCredentials;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCredentials = {
      provider: "google-drive",
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
      expiresAt: new Date(Date.now() + 3600000),
    };

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
    multiScopeSyncManager = new MultiScopeSyncManager();
  });

  describe("Priority #0 Store Discovery in Sync Flow", () => {
    it("should include appdata store in sync sources when available", async () => {
      const mockPriorityStore: TierStorageSchema = {
        tier: "priority-0",
        version: "1.0.0",
        snippets: [
          {
            id: "priority-snippet-1",
            trigger: "hp",
            content: "High Priority Snippet",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        lastModified: new Date().toISOString(),
      };

      // Mock the adapter's discoverAppDataStore method
      const mockAdapter = {
        provider: "google-drive",
        discoverAppDataStore: jest.fn().mockResolvedValue({
          hasStore: true,
          snippets: mockPriorityStore.snippets,
          storeInfo: {
            name: "Priority #0 Store",
            tier: "priority-0",
            lastModified: mockPriorityStore.lastModified,
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
      jest.doMock("../../src/background/cloud-adapters/index.js", () => ({
        getCloudAdapterFactory: () => mockFactory,
      }));

      // Mock the sync method to capture the sources
      let capturedSources: SyncedSource[] = [];
      const mockSyncAndMerge = jest.fn().mockImplementation((sources) => {
        capturedSources = sources;
        return Promise.resolve([]);
      });

      jest
        .spyOn(multiScopeSyncManager, "syncAndMerge")
        .mockImplementation(mockSyncAndMerge);

      // Initialize and perform sync
      await syncManager.initialize();
      await syncManager.setCloudProvider("google-drive");

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
      jest.doMock("../../src/background/cloud-adapters/index.js", () => ({
        getCloudAdapterFactory: () => mockFactory,
      }));

      // Mock the sync method to capture the sources
      let capturedSources: SyncedSource[] = [];
      const mockSyncAndMerge = jest.fn().mockImplementation((sources) => {
        capturedSources = sources;
        return Promise.resolve([]);
      });

      jest
        .spyOn(multiScopeSyncManager, "syncAndMerge")
        .mockImplementation(mockSyncAndMerge);

      // Initialize and perform sync
      await syncManager.initialize();
      await syncManager.setCloudProvider("google-drive");

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
      jest.doMock("../../src/background/cloud-adapters/index.js", () => ({
        getCloudAdapterFactory: () => mockFactory,
      }));

      // Mock the sync method to capture the sources
      let capturedSources: SyncedSource[] = [];
      const mockSyncAndMerge = jest.fn().mockImplementation((sources) => {
        capturedSources = sources;
        return Promise.resolve([]);
      });

      jest
        .spyOn(multiScopeSyncManager, "syncAndMerge")
        .mockImplementation(mockSyncAndMerge);

      // Initialize and perform sync
      await syncManager.initialize();
      await syncManager.setCloudProvider("google-drive");

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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const personalSnippet = {
        id: "personal-snippet-1",
        trigger: "test", // Same trigger as priority snippet
        content: "Personal content",
        createdAt: new Date(),
        updatedAt: new Date(),
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
