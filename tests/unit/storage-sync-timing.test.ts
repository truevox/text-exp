import { SyncManager } from "../../src/background/sync-manager";
import { ExtensionStorage } from "../../src/shared/storage";
import { IndexedDB } from "../../src/shared/indexed-db";
import { MultiScopeSyncManager } from "../../src/background/multi-scope-sync-manager";
import { notifyContentScriptsOfSnippetUpdate } from "../../src/background/messaging-helpers";
import { AuthenticationService } from "../../src/background/services/auth-service";
import { BaseCloudAdapter } from "../../src/background/cloud-adapters/base-adapter";

// Mock dependencies
jest.mock("../../src/shared/storage");
jest.mock("../../src/shared/indexed-db");
jest.mock("../../src/background/multi-scope-sync-manager");
jest.mock("../../src/background/messaging-helpers");
jest.mock("../../src/background/services/auth-service");
jest.mock("../../src/background/cloud-adapters/index");

describe("Storage Synchronization Timing", () => {
  let syncManager: SyncManager;
  let mockExtensionStorage: jest.Mocked<typeof ExtensionStorage>;
  let mockIndexedDB: jest.Mocked<IndexedDB>;
  let mockMultiScopeSyncManager: jest.Mocked<MultiScopeSyncManager>;
  let mockNotify: jest.MockedFunction<
    typeof notifyContentScriptsOfSnippetUpdate
  >;
  let mockCloudAdapter: jest.Mocked<BaseCloudAdapter>;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    mockExtensionStorage = ExtensionStorage as jest.Mocked<
      typeof ExtensionStorage
    >;
    mockIndexedDB = new IndexedDB() as jest.Mocked<IndexedDB>;
    mockMultiScopeSyncManager =
      new MultiScopeSyncManager() as jest.Mocked<MultiScopeSyncManager>;
    mockNotify = notifyContentScriptsOfSnippetUpdate as jest.MockedFunction<
      typeof notifyContentScriptsOfSnippetUpdate
    >;

    // Mock cloud adapter
    mockCloudAdapter = {
      provider: "google-drive",
      authenticate: jest.fn(),
      uploadSnippets: jest.fn(),
      downloadSnippets: jest.fn(),
      deleteSnippets: jest.fn(),
      isAuthenticated: jest.fn().mockResolvedValue(true),
    } as any;

    // Mock successful operations
    mockExtensionStorage.setSnippets.mockResolvedValue(undefined);
    mockExtensionStorage.getSnippets.mockResolvedValue([]);
    mockExtensionStorage.getScopedSources.mockResolvedValue([]);
    mockIndexedDB.saveSnippets.mockResolvedValue(undefined);
    mockMultiScopeSyncManager.syncAndMerge.mockResolvedValue([]);
    mockNotify.mockResolvedValue(undefined);

    // Mock getCloudAdapterFactory
    const { getCloudAdapterFactory } = await import(
      "../../src/background/cloud-adapters/index"
    );
    (getCloudAdapterFactory as jest.Mock).mockReturnValue({
      createAdapter: jest.fn().mockReturnValue(mockCloudAdapter),
    });

    // Mock AuthenticationService
    (
      AuthenticationService.initializeWithStoredCredentials as jest.Mock
    ).mockResolvedValue(true);

    syncManager = SyncManager.getInstance();
    (syncManager as any).indexedDB = mockIndexedDB;
    (syncManager as any).multiScopeSyncManager = mockMultiScopeSyncManager;

    // Set up cloud provider
    await syncManager.setCloudProvider("google-drive");
  });

  it("should update IndexedDB before notifying content scripts", async () => {
    // Setup: Mock successful sync data
    const mockSnippets = [
      {
        id: "test-1",
        trigger: "eata",
        content: "Bag of Dicks!!",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockExtensionStorage.getSnippets.mockResolvedValue([]);
    mockExtensionStorage.getScopedSources.mockResolvedValue([]);

    // Mock multiScopeSyncManager to return test data
    mockMultiScopeSyncManager.syncAndMerge.mockResolvedValue(mockSnippets);

    // Track call order
    const callOrder: string[] = [];

    mockExtensionStorage.setSnippets.mockImplementation(async () => {
      callOrder.push("chrome.storage.local");
    });

    mockIndexedDB.saveSnippets.mockImplementation(async () => {
      callOrder.push("IndexedDB");
    });

    mockNotify.mockImplementation(async () => {
      callOrder.push("notify-content-scripts");
    });

    // Execute sync
    await syncManager.syncNow();

    // Verify call order: chrome.storage.local → IndexedDB → notify
    expect(callOrder).toEqual([
      "chrome.storage.local",
      "IndexedDB",
      "notify-content-scripts",
    ]);

    // Verify all operations were called
    expect(mockExtensionStorage.setSnippets).toHaveBeenCalledWith(mockSnippets);
    expect(mockIndexedDB.saveSnippets).toHaveBeenCalledWith(mockSnippets);
    expect(mockNotify).toHaveBeenCalled();
  });

  it("should not notify content scripts if IndexedDB update fails", async () => {
    // Setup: IndexedDB fails
    mockExtensionStorage.setSnippets.mockResolvedValue(undefined);
    mockIndexedDB.saveSnippets.mockRejectedValue(new Error("IndexedDB failed"));

    const mockSnippets = [
      {
        id: "test-2",
        trigger: "eata",
        content: "Bag of Dicks!!",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockExtensionStorage.getSnippets.mockResolvedValue([]);
    mockExtensionStorage.getScopedSources.mockResolvedValue([]);

    // Mock multiScopeSyncManager to return test data
    mockMultiScopeSyncManager.syncAndMerge.mockResolvedValue(mockSnippets);

    // Execute sync and expect it to throw
    await expect(syncManager.syncNow()).rejects.toThrow("IndexedDB failed");

    // Verify chrome.storage.local was updated
    expect(mockExtensionStorage.setSnippets).toHaveBeenCalledWith(mockSnippets);

    // Verify IndexedDB was attempted
    expect(mockIndexedDB.saveSnippets).toHaveBeenCalledWith(mockSnippets);

    // Verify content scripts were NOT notified due to IndexedDB failure
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
