import { SyncManager } from '../../src/background/sync-manager';
import { ExtensionStorage } from '../../src/shared/storage';
import { IndexedDB } from '../../src/shared/indexed-db';
import { notifyContentScriptsOfSnippetUpdate } from '../../src/background/messaging-helpers';

// Mock dependencies
jest.mock('../../src/shared/storage');
jest.mock('../../src/shared/indexed-db');
jest.mock('../../src/background/messaging-helpers');

describe('Storage Synchronization Timing', () => {
  let syncManager: SyncManager;
  let mockExtensionStorage: jest.Mocked<typeof ExtensionStorage>;
  let mockIndexedDB: jest.Mocked<IndexedDB>;
  let mockNotify: jest.MockedFunction<typeof notifyContentScriptsOfSnippetUpdate>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    mockExtensionStorage = ExtensionStorage as jest.Mocked<typeof ExtensionStorage>;
    mockIndexedDB = new IndexedDB() as jest.Mocked<IndexedDB>;
    mockNotify = notifyContentScriptsOfSnippetUpdate as jest.MockedFunction<typeof notifyContentScriptsOfSnippetUpdate>;

    // Mock successful operations
    mockExtensionStorage.setSnippets.mockResolvedValue(undefined);
    mockExtensionStorage.getSnippets.mockResolvedValue([]);
    mockExtensionStorage.getScopedSources.mockResolvedValue([]);
    mockIndexedDB.saveSnippets.mockResolvedValue(undefined);
    mockNotify.mockResolvedValue(undefined);

    syncManager = SyncManager.getInstance();
    (syncManager as any).indexedDB = mockIndexedDB;
  });

  it('should update IndexedDB before notifying content scripts', async () => {
    // Setup: Mock successful sync data
    const mockSnippets = [
      { 
        key: 'eata', 
        expansion: 'Bag of Dicks!!', 
        source: 'google-drive' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockExtensionStorage.getSnippets.mockResolvedValue([]);
    mockExtensionStorage.getScopedSources.mockResolvedValue([]);
    
    // Mock the cloud adapter to return test data
    const mockAdapter = {
      downloadSnippets: jest.fn().mockResolvedValue(mockSnippets),
      uploadSnippets: jest.fn(),
      isConnected: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    
    (syncManager as any).currentAdapter = mockAdapter;

    // Track call order
    const callOrder: string[] = [];
    
    mockExtensionStorage.setSnippets.mockImplementation(async () => {
      callOrder.push('chrome.storage.local');
    });
    
    mockIndexedDB.saveSnippets.mockImplementation(async () => {
      callOrder.push('IndexedDB');
    });
    
    mockNotify.mockImplementation(async () => {
      callOrder.push('notify-content-scripts');
    });

    // Execute sync
    await syncManager.syncNow();

    // Verify call order: chrome.storage.local → IndexedDB → notify
    expect(callOrder).toEqual([
      'chrome.storage.local',
      'IndexedDB', 
      'notify-content-scripts'
    ]);

    // Verify all operations were called
    expect(mockExtensionStorage.setSnippets).toHaveBeenCalledWith(mockSnippets);
    expect(mockIndexedDB.saveSnippets).toHaveBeenCalledWith(mockSnippets);
    expect(mockNotify).toHaveBeenCalled();
  });

  it('should not notify content scripts if IndexedDB update fails', async () => {
    // Setup: IndexedDB fails
    mockExtensionStorage.setSnippets.mockResolvedValue(undefined);
    mockIndexedDB.saveSnippets.mockRejectedValue(new Error('IndexedDB failed'));

    const mockSnippets = [
      { 
        key: 'eata', 
        expansion: 'Bag of Dicks!!', 
        source: 'google-drive' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockExtensionStorage.getSnippets.mockResolvedValue([]);
    mockExtensionStorage.getScopedSources.mockResolvedValue([]);
    
    const mockAdapter = {
      downloadSnippets: jest.fn().mockResolvedValue(mockSnippets),
      uploadSnippets: jest.fn(),
      isConnected: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
    };
    
    (syncManager as any).currentAdapter = mockAdapter;

    // Execute sync and expect it to throw
    await expect(syncManager.syncNow()).rejects.toThrow('IndexedDB failed');

    // Verify chrome.storage.local was updated
    expect(mockExtensionStorage.setSnippets).toHaveBeenCalledWith(mockSnippets);
    
    // Verify IndexedDB was attempted
    expect(mockIndexedDB.saveSnippets).toHaveBeenCalledWith(mockSnippets);
    
    // Verify content scripts were NOT notified due to IndexedDB failure
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
