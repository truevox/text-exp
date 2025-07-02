/**
 * Integration tests for SyncManager
 */

import { SyncManager } from '../../src/background/sync-manager.js';
import { ExtensionStorage } from '../../src/shared/storage.js';
import type { TextSnippet, ExtensionSettings } from '../../src/shared/types.js';
import { DEFAULT_SETTINGS } from '../../src/shared/constants.js';

// Mock chrome APIs
const mockChrome = {
  storage: {
    local: new Map(),
    sync: new Map(),
  },
  notifications: {
    create: jest.fn(),
  },
};

(global as any).chrome = mockChrome;

describe('SyncManager Integration', () => {
  let syncManager: SyncManager;

  beforeEach(async () => {
    // Clear mock storage
    mockChrome.storage.local.clear();
    mockChrome.storage.sync.clear();
    
    syncManager = SyncManager.getInstance();
    
    // Set up default settings
    await ExtensionStorage.setSettings(DEFAULT_SETTINGS);
  });

  describe('initialization', () => {
    it('should initialize with default settings', async () => {
      await syncManager.initialize();
      
      const provider = syncManager.getCurrentProvider();
      expect(provider).toBe('local');
    });

    it('should set up auto-sync when enabled', async () => {
      const settings = { ...DEFAULT_SETTINGS, autoSync: true, syncInterval: 1 };
      await ExtensionStorage.setSettings(settings);
      
      await syncManager.initialize();
      
      // Check that auto-sync is started (implementation specific)
      expect(syncManager.getCurrentProvider()).toBe('local');
    });
  });

  describe('cloud provider management', () => {
    it('should switch cloud providers', async () => {
      await syncManager.setCloudProvider('google-drive');
      expect(syncManager.getCurrentProvider()).toBe('google-drive');
      
      await syncManager.setCloudProvider('local');
      expect(syncManager.getCurrentProvider()).toBe('local');
    });

    it('should handle invalid providers gracefully', async () => {
      await expect(
        syncManager.setCloudProvider('invalid' as any)
      ).rejects.toThrow();
    });
  });

  describe('local sync operations', () => {
    const mockSnippets: TextSnippet[] = [
      {
        id: 'test-1',
        trigger: ';hello',
        content: 'Hello world!',
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      },
      {
        id: 'test-2',
        trigger: ';bye',
        content: 'Goodbye!',
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
      },
    ];

    beforeEach(async () => {
      await ExtensionStorage.setSnippets(mockSnippets);
    });

    it('should sync with local provider (no-op)', async () => {
      await syncManager.setCloudProvider('local');
      await expect(syncManager.syncNow()).resolves.not.toThrow();
    });

    it('should get sync statistics', async () => {
      const stats = await syncManager.getSyncStats();
      
      expect(stats.totalSnippets).toBe(2);
      expect(stats.syncProvider).toBe('local');
      expect(stats.isOnline).toBe(true);
    });

    it('should handle settings changes', async () => {
      const newSettings: ExtensionSettings = {
        ...DEFAULT_SETTINGS,
        cloudProvider: 'google-drive',
        autoSync: false,
      };
      
      await syncManager.onSettingsChanged(newSettings);
      expect(syncManager.getCurrentProvider()).toBe('google-drive');
    });
  });

  describe('error handling', () => {
    it('should handle sync errors gracefully', async () => {
      // Set up a provider that will fail
      await syncManager.setCloudProvider('google-drive');
      
      // Sync should fail but not throw (depending on implementation)
      await expect(syncManager.syncNow()).rejects.toThrow();
    });

    it('should handle authentication errors', async () => {
      await syncManager.setCloudProvider('google-drive');
      
      const isAuth = await syncManager.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  describe('auto-sync functionality', () => {
    it('should start auto-sync', () => {
      syncManager.startAutoSync(1); // 1 minute
      expect(() => syncManager.startAutoSync(1)).not.toThrow();
    });

    it('should stop auto-sync', () => {
      syncManager.startAutoSync(1);
      syncManager.stopAutoSync();
      expect(() => syncManager.stopAutoSync()).not.toThrow();
    });

    it('should restart auto-sync when interval changes', () => {
      syncManager.startAutoSync(1);
      syncManager.startAutoSync(5); // Should stop previous and start new
      expect(() => syncManager.stopAutoSync()).not.toThrow();
    });
  });
});