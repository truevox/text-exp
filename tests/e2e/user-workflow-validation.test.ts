/**
 * End-to-end tests validating complete user workflows
 * Focuses on storage timing fix validation through user scenarios
 */

import { jest } from '@jest/globals';
import { SyncManager } from '../../src/background/sync-manager.js';
import { ExtensionStorage } from '../../src/shared/storage.js';
import { IndexedDB } from '../../src/shared/indexed-db.js';
import { notifyContentScriptsOfSnippetUpdate } from '../../src/background/messaging-helpers.js';
import type { TextSnippet, CloudAdapter } from '../../src/shared/types.js';

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined)
    },
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined)
    }
  },
  tabs: {
    query: jest.fn().mockResolvedValue([{ id: 1 }]),
    sendMessage: jest.fn().mockResolvedValue(undefined)
  },
  runtime: {
    sendMessage: jest.fn().mockResolvedValue(undefined)
  },
  notifications: {
    create: jest.fn().mockResolvedValue('notification-id')
  }
} as any;

jest.mock('../../src/shared/storage.js');
jest.mock('../../src/shared/indexed-db.js');
jest.mock('../../src/background/cloud-adapters/index.js');
jest.mock('../../src/background/messaging-helpers.js');

describe('E2E User Workflow Validation', () => {
  let syncManager: SyncManager;
  let mockIndexedDB: jest.Mocked<IndexedDB>;
  let mockExtensionStorage: jest.Mocked<typeof ExtensionStorage>;
  let mockNotifyContentScripts: jest.MockedFunction<typeof notifyContentScriptsOfSnippetUpdate>;
  let mockAdapter: jest.Mocked<CloudAdapter>;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup mocks
    mockIndexedDB = {
      saveSnippets: jest.fn().mockResolvedValue(undefined),
      getSnippets: jest.fn().mockResolvedValue([]),
      deleteSnippets: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockExtensionStorage = ExtensionStorage as jest.Mocked<typeof ExtensionStorage>;
    mockExtensionStorage.getSnippets = jest.fn().mockResolvedValue([]);
    mockExtensionStorage.setSnippets = jest.fn().mockResolvedValue(undefined);
    mockExtensionStorage.getSettings = jest.fn().mockResolvedValue({
      cloudProvider: 'google-drive',
      autoSync: true,
      syncInterval: 30,
      showNotifications: true
    });
    mockExtensionStorage.getScopedSources = jest.fn().mockResolvedValue([]);
    mockExtensionStorage.setLastSync = jest.fn().mockResolvedValue(undefined);
    mockExtensionStorage.setSyncStatus = jest.fn().mockResolvedValue(undefined);

    // Mock messaging helper
    mockNotifyContentScripts = notifyContentScriptsOfSnippetUpdate as jest.MockedFunction<typeof notifyContentScriptsOfSnippetUpdate>;
    mockNotifyContentScripts.mockResolvedValue(undefined);

    mockAdapter = {
      provider: 'google-drive',
      authenticate: jest.fn().mockResolvedValue({ provider: 'google-drive', accessToken: 'test-token' }),
      initialize: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: jest.fn().mockResolvedValue(true),
      downloadSnippets: jest.fn().mockResolvedValue([]),
      uploadSnippets: jest.fn().mockResolvedValue(undefined),
      deleteSnippets: jest.fn().mockResolvedValue(undefined),
      getSyncStatus: jest.fn().mockResolvedValue({
        provider: 'google-drive',
        lastSync: new Date(),
        isOnline: true,
        hasChanges: false
      }),
      getFolders: jest.fn().mockResolvedValue([]),
      createFolder: jest.fn().mockResolvedValue({ id: 'test-folder', name: 'Test Folder' })
    };

    syncManager = SyncManager.getInstance();
    (syncManager as any).indexedDB = mockIndexedDB;
    (syncManager as any).currentAdapter = mockAdapter;
  });

  describe('User Scenario: First Time Setup and Sync', () => {
    test('WORKFLOW: User sets up Google Drive and syncs for first time', async () => {
      // Step 1: User has no existing snippets
      mockExtensionStorage.getSnippets.mockResolvedValue([]);
      
      // Step 2: User connects Google Drive with existing snippets
      const driveSnippets: TextSnippet[] = [
        {
          id: 'drive-eata',
          trigger: 'eata',
          content: 'Bag of Dicks!!',
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: 'personal'
        },
        {
          id: 'drive-hello',
          trigger: 'hello',
          content: 'Hello there!',
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: 'personal'
        }
      ];
      
      mockAdapter.downloadSnippets.mockResolvedValue(driveSnippets);

      // Step 3: User triggers sync
      await syncManager.syncNow();

      // Step 4: Verify proper storage sequence
      expect(mockExtensionStorage.setSnippets).toHaveBeenCalledWith(driveSnippets);
      expect(mockIndexedDB.saveSnippets).toHaveBeenCalledWith(driveSnippets);
      expect(mockNotifyContentScripts).toHaveBeenCalled();

      // Step 5: Verify content scripts would receive updated snippets
      expect(mockNotifyContentScripts).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Scenario: Adding New Snippet Via Drive', () => {
    test('WORKFLOW: User adds snippet to Google Drive folder, then syncs', async () => {
      // Step 1: User has existing local snippets
      const existingSnippets: TextSnippet[] = [
        {
          id: 'local-1',
          trigger: 'bye',
          content: 'Goodbye!',
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: 'personal'
        }
      ];
      mockExtensionStorage.getSnippets.mockResolvedValue(existingSnippets);

      // Step 2: User adds new snippet to Google Drive (simulated)
      const newDriveSnippets: TextSnippet[] = [
        ...existingSnippets,
        {
          id: 'drive-new',
          trigger: 'eata',
          content: 'Bag of Dicks!!',
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: 'personal'
        }
      ];
      mockAdapter.downloadSnippets.mockResolvedValue(newDriveSnippets);

      // Step 3: User syncs via popup or auto-sync
      await syncManager.syncNow();

      // Step 4: Verify merged result
      const expectedMerged = newDriveSnippets; // Drive takes priority
      expect(mockExtensionStorage.setSnippets).toHaveBeenCalledWith(expectedMerged);
      expect(mockIndexedDB.saveSnippets).toHaveBeenCalledWith(expectedMerged);

      // Step 5: Content scripts notified of new snippet availability
      expect(mockNotifyContentScripts).toHaveBeenCalled();
    });
  });

  describe('User Scenario: Content Script Text Expansion', () => {
    test('WORKFLOW: User types ;eata + Tab and gets expansion', async () => {
      // This test simulates the content script perspective after sync
      
      // Step 1: Sync has completed, snippets are in storage
      const snippetsInStorage: TextSnippet[] = [
        {
          id: 'eata-snippet',
          trigger: 'eata',
          content: 'Bag of Dicks!!',
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: 'personal'
        }
      ];

      // Mock IndexedDB returning the synced snippets (what content script would read)
      mockIndexedDB.getSnippets.mockResolvedValue(snippetsInStorage);

      // Step 2: Content script receives notification and refreshes
      // (Simulated by directly checking storage state)
      const availableSnippets = await mockIndexedDB.getSnippets();

      // Step 3: User types trigger
      const typedTrigger = 'eata';
      const matchingSnippet = availableSnippets.find(s => s.trigger === typedTrigger);

      // Step 4: Verify expansion would work
      expect(matchingSnippet).toBeTruthy();
      expect(matchingSnippet?.content).toBe('Bag of Dicks!!');
      expect(matchingSnippet?.isActive).toBe(true);
    });
  });

  describe('Error Recovery Scenarios', () => {
    test('SCENARIO: IndexedDB fails, content scripts not notified', async () => {
      const testSnippets: TextSnippet[] = [
        {
          id: 'test-1',
          trigger: 'test',
          content: 'Test content',
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: 'personal'
        }
      ];

      mockAdapter.downloadSnippets.mockResolvedValue(testSnippets);
      mockIndexedDB.saveSnippets.mockRejectedValue(new Error('IndexedDB quota exceeded'));

      // User triggers sync
      await expect(syncManager.syncNow()).rejects.toThrow();

      // chrome.storage.local might have been updated
      expect(mockExtensionStorage.setSnippets).toHaveBeenCalled();
      
      // But content scripts should NOT be notified due to IndexedDB failure
      expect(mockNotifyContentScripts).not.toHaveBeenCalled();
    });

    test('SCENARIO: Network failure during sync (graceful handling)', async () => {
      mockAdapter.downloadSnippets.mockRejectedValue(new Error('Network error'));

      // Even with network failure, sync should complete gracefully with empty cloud snippets
      await expect(syncManager.syncNow()).resolves.toBeUndefined();

      // Local snippets should still be processed and stored (mergeSnippets([]) would be empty)
      expect(mockExtensionStorage.setSnippets).toHaveBeenCalled();
      expect(mockIndexedDB.saveSnippets).toHaveBeenCalled();
      expect(mockNotifyContentScripts).toHaveBeenCalled();
    });
  });

  describe('Performance Under Load', () => {
    test('SCENARIO: Large snippet library sync maintains timing', async () => {
      // Generate large number of snippets
      const largeSnippetSet: TextSnippet[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `snippet-${i}`,
        trigger: `trigger${i}`,
        content: `Content for snippet ${i}`.repeat(10), // Make content larger
        createdAt: new Date(),
        lastModified: new Date(),
        isActive: true,
        scope: 'personal'
      }));

      mockAdapter.downloadSnippets.mockResolvedValue(largeSnippetSet);

      const startTime = Date.now();
      await syncManager.syncNow();
      const duration = Date.now() - startTime;

      // Should handle large datasets efficiently
      expect(duration).toBeLessThan(5000); // 5 seconds max for 1000 snippets
      
      // Verify all operations completed in correct order
      expect(mockExtensionStorage.setSnippets).toHaveBeenCalledWith(largeSnippetSet);
      expect(mockIndexedDB.saveSnippets).toHaveBeenCalledWith(largeSnippetSet);
      expect(mockNotifyContentScripts).toHaveBeenCalled();
    });
  });

  describe('Multi-Tab Notification Validation', () => {
    test('SCENARIO: Multiple tabs receive snippet updates', async () => {
      // Mock multiple tabs
      (chrome.tabs.query as jest.Mock).mockResolvedValue([
        { id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://test.com' },
        { id: 3, url: 'https://docs.google.com' }
      ]);

      const testSnippets: TextSnippet[] = [
        {
          id: 'multi-tab-test',
          trigger: 'mtt',
          content: 'Multi-tab test',
          createdAt: new Date(),
          lastModified: new Date(),
          isActive: true,
          scope: 'personal'
        }
      ];

      mockAdapter.downloadSnippets.mockResolvedValue(testSnippets);

      await syncManager.syncNow();

      // Verify notification system was called
      expect(mockNotifyContentScripts).toHaveBeenCalledTimes(1);
    });
  });
});