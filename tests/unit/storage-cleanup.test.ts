/**
 * Unit tests for StorageCleanup class
 * Tests cleanup operations and storage validation
 */

import { StorageCleanup } from '../../src/utils/storage-cleanup';
import { ExtensionStorage } from '../../src/shared/storage';
import type { ExtensionSettings, ScopedSource } from '../../src/shared/types';

// Mock ExtensionStorage
jest.mock('../../src/shared/storage', () => ({
  ExtensionStorage: {
    getSettings: jest.fn(),
    setSettings: jest.fn(),
    getScopedSources: jest.fn(),
    setScopedSources: jest.fn(),
    getSnippets: jest.fn(),
    setSnippets: jest.fn()
  }
}));

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      remove: jest.fn(),
      get: jest.fn()
    }
  }
} as any;

describe('StorageCleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('clearInvalidSources', () => {
    it('should remove local-filesystem sources from configured sources', async () => {
      const mockSettings = {
        configuredSources: [
          {
            provider: 'google-drive',
            scope: 'personal',
            displayName: 'Personal Drive',
            folderId: 'folder123'
          },
          {
            provider: 'local-filesystem',
            scope: 'department',
            displayName: 'Local Folder',
            path: '/path/to/folder'
          },
          {
            provider: 'dropbox',
            scope: 'org',
            displayName: 'Org Dropbox',
            folderId: 'dropbox456'
          }
        ]
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.setSettings as jest.Mock).mockResolvedValue(undefined);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([]);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.clearInvalidSources();

      expect(result.cleaned).toBe(1);
      expect(result.errors).toHaveLength(0);
      
      // Should update settings with only valid sources
      expect(ExtensionStorage.setSettings).toHaveBeenCalledWith({
        configuredSources: [
          mockSettings.configuredSources[0], // google-drive
          mockSettings.configuredSources[2]  // dropbox
        ]
      });
    });

    it('should remove local-filesystem sources from scoped sources', async () => {
      const mockSettings = { configuredSources: [] } as ExtensionSettings;
      const mockScopedSources: ScopedSource[] = [
        {
          provider: 'google-drive',
          scope: 'personal',
          displayName: 'Drive Personal',
          snippets: []
        },
        {
          provider: 'local-filesystem',
          scope: 'department',
          displayName: 'Local Dept',
          snippets: []
        }
      ];

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue(mockScopedSources);
      (ExtensionStorage.setScopedSources as jest.Mock).mockResolvedValue(undefined);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.clearInvalidSources();

      expect(result.cleaned).toBe(1);
      
      // Should update scoped sources with only valid ones
      expect(ExtensionStorage.setScopedSources).toHaveBeenCalledWith([
        mockScopedSources[0] // Only google-drive
      ]);
    });

    it('should clean orphaned storage keys', async () => {
      const mockSettings = { configuredSources: [] } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([]);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.clearInvalidSources();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith([
        'localFilesystemHandles',
        'localFilesystemPermissions',
        'localSources',
        'directoryHandles',
        'fileSystemHandles'
      ]);
    });

    it('should handle no invalid sources gracefully', async () => {
      const mockSettings = {
        configuredSources: [
          {
            provider: 'google-drive',
            scope: 'personal',
            displayName: 'Personal Drive',
            folderId: 'folder123'
          }
        ]
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([]);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.clearInvalidSources();

      expect(result.cleaned).toBe(0);
      expect(result.errors).toHaveLength(0);
      
      // Should not update settings if no changes needed
      expect(ExtensionStorage.setSettings).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      const error = new Error('Storage access denied');
      (ExtensionStorage.getSettings as jest.Mock).mockRejectedValue(error);

      const result = await StorageCleanup.clearInvalidSources();

      expect(result.cleaned).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to clean storage: Storage access denied');
    });

    it('should handle chrome.storage.local.remove errors silently', async () => {
      const mockSettings = { configuredSources: [] } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([]);
      (chrome.storage.local.remove as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      const result = await StorageCleanup.clearInvalidSources();

      expect(result.errors).toHaveLength(0);
    });

    it('should count cleaned sources correctly across multiple arrays', async () => {
      const mockSettings = {
        configuredSources: [
          {
            provider: 'local-filesystem',
            scope: 'personal',
            displayName: 'Local Personal',
            path: '/personal'
          },
          {
            provider: 'local-filesystem',
            scope: 'department',
            displayName: 'Local Dept',
            path: '/dept'
          }
        ]
      } as ExtensionSettings;

      const mockScopedSources: ScopedSource[] = [
        {
          provider: 'local-filesystem',
          scope: 'org',
          displayName: 'Local Org',
          snippets: []
        }
      ];

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue(mockScopedSources);
      (ExtensionStorage.setSettings as jest.Mock).mockResolvedValue(undefined);
      (ExtensionStorage.setScopedSources as jest.Mock).mockResolvedValue(undefined);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.clearInvalidSources();

      expect(result.cleaned).toBe(3); // 2 from configured + 1 from scoped
    });
  });

  describe('validateAndCleanSources', () => {
    it('should remove sources with unsupported providers', async () => {
      const mockSettings = {
        configuredSources: [
          {
            provider: 'google-drive',
            scope: 'personal',
            displayName: 'Valid Drive'
          },
          {
            provider: 'unknown-provider',
            scope: 'department',
            displayName: 'Invalid Provider'
          },
          {
            provider: 'local-filesystem',
            scope: 'org',
            displayName: 'Deprecated Provider'
          }
        ]
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.setSettings as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.validateAndCleanSources();

      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(2);
      expect(result.errors).toHaveLength(0);

      expect(ExtensionStorage.setSettings).toHaveBeenCalledWith({
        configuredSources: [mockSettings.configuredSources[0]] // Only google-drive
      });
    });

    it('should remove sources with missing required fields', async () => {
      const mockSettings = {
        configuredSources: [
          {
            provider: 'google-drive',
            scope: 'personal',
            displayName: 'Complete Source'
          },
          {
            provider: 'dropbox',
            // Missing scope
            displayName: 'Missing Scope'
          },
          {
            provider: 'onedrive',
            scope: 'department'
            // Missing displayName
          }
        ]
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.setSettings as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.validateAndCleanSources();

      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(2);

      expect(ExtensionStorage.setSettings).toHaveBeenCalledWith({
        configuredSources: [mockSettings.configuredSources[0]]
      });
    });

    it('should handle missing configuredSources gracefully', async () => {
      const mockSettings = {} as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);

      const result = await StorageCleanup.validateAndCleanSources();

      expect(result.valid).toBe(0);
      expect(result.invalid).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(ExtensionStorage.setSettings).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      (ExtensionStorage.getSettings as jest.Mock).mockRejectedValue(error);

      const result = await StorageCleanup.validateAndCleanSources();

      expect(result.valid).toBe(0);
      expect(result.invalid).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to validate sources: Validation failed');
    });

    it('should validate all supported providers', async () => {
      const mockSettings = {
        configuredSources: [
          { provider: 'google-drive', scope: 'personal', displayName: 'Drive' },
          { provider: 'dropbox', scope: 'department', displayName: 'Dropbox' },
          { provider: 'onedrive', scope: 'org', displayName: 'OneDrive' },
          { provider: 'local', scope: 'personal', displayName: 'Local' }
        ]
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);

      const result = await StorageCleanup.validateAndCleanSources();

      expect(result.valid).toBe(4);
      expect(result.invalid).toBe(0);
      expect(ExtensionStorage.setSettings).not.toHaveBeenCalled();
    });
  });

  describe('getCleanupStatus', () => {
    it('should identify cleanup needs correctly', async () => {
      const mockSettings = {
        configuredSources: [
          {
            provider: 'google-drive',
            scope: 'personal',
            displayName: 'Valid Source'
          },
          {
            provider: 'local-filesystem',
            scope: 'department',
            displayName: 'Invalid Source'
          }
        ]
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        localFilesystemHandles: {},
        localSources: []
      });

      const result = await StorageCleanup.getCleanupStatus();

      expect(result.needsCleanup).toBe(true);
      expect(result.invalidSources).toBe(1);
      expect(result.recommendations).toContain('Remove 1 local filesystem sources');
      expect(result.recommendations).toContain('Clean 2 orphaned storage keys');
    });

    it('should report no cleanup needed when sources are clean', async () => {
      const mockSettings = {
        configuredSources: [
          {
            provider: 'google-drive',
            scope: 'personal',
            displayName: 'Valid Source'
          }
        ]
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({});

      const result = await StorageCleanup.getCleanupStatus();

      expect(result.needsCleanup).toBe(false);
      expect(result.invalidSources).toBe(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should handle storage errors gracefully', async () => {
      (ExtensionStorage.getSettings as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await StorageCleanup.getCleanupStatus();

      expect(result.needsCleanup).toBe(false);
      expect(result.invalidSources).toBe(0);
      expect(result.recommendations).toEqual(['Error checking cleanup status']);
    });

    it('should count orphaned keys correctly', async () => {
      const mockSettings = { configuredSources: [] } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        localFilesystemHandles: { folder1: 'handle1' },
        localFilesystemPermissions: { folder1: true },
        localSources: [{ id: 'source1' }]
      });

      const result = await StorageCleanup.getCleanupStatus();

      expect(result.recommendations).toContain('Clean 3 orphaned storage keys');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined settings gracefully', async () => {
      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(null);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([]);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.clearInvalidSources();

      expect(result.cleaned).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty arrays correctly', async () => {
      const mockSettings = { configuredSources: [] } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([]);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.clearInvalidSources();

      expect(result.cleaned).toBe(0);
      expect(ExtensionStorage.setSettings).not.toHaveBeenCalled();
      expect(ExtensionStorage.setScopedSources).not.toHaveBeenCalled();
    });

    it('should handle mixed valid and invalid sources', async () => {
      const mockSettings = {
        configuredSources: [
          { provider: 'google-drive', scope: 'personal', displayName: 'Valid' },
          { provider: 'local-filesystem', scope: 'dept', displayName: 'Invalid1' },
          { provider: 'dropbox', scope: 'org', displayName: 'Valid2' },
          { provider: 'local-filesystem', scope: 'team', displayName: 'Invalid2' }
        ]
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.setSettings as jest.Mock).mockResolvedValue(undefined);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([]);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await StorageCleanup.clearInvalidSources();

      expect(result.cleaned).toBe(2);
      
      const expectedValidSources = [
        mockSettings.configuredSources[0], // google-drive
        mockSettings.configuredSources[2]  // dropbox
      ];
      
      expect(ExtensionStorage.setSettings).toHaveBeenCalledWith({
        configuredSources: expectedValidSources
      });
    });

    it('should handle concurrent cleanup operations safely', async () => {
      const mockSettings = {
        configuredSources: [
          { provider: 'local-filesystem', scope: 'personal', displayName: 'Local' }
        ]
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.setSettings as jest.Mock).mockResolvedValue(undefined);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([]);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      // Run multiple cleanup operations concurrently
      const promises = [
        StorageCleanup.clearInvalidSources(),
        StorageCleanup.clearInvalidSources(),
        StorageCleanup.clearInvalidSources()
      ];

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(result => {
        expect(result.cleaned).toBeGreaterThanOrEqual(0);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should provide detailed error information', async () => {
      const specificError = new Error('Specific storage failure with details');
      (ExtensionStorage.getSettings as jest.Mock).mockRejectedValue(specificError);

      const result = await StorageCleanup.clearInvalidSources();

      expect(result.errors[0]).toContain('Specific storage failure with details');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large number of sources efficiently', async () => {
      // Create 1000 sources with mix of valid and invalid
      const largeSources = Array.from({ length: 1000 }, (_, i) => ({
        provider: i % 3 === 0 ? 'local-filesystem' : 'google-drive',
        scope: 'personal',
        displayName: `Source ${i}`
      }));

      const mockSettings = { configuredSources: largeSources } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      (ExtensionStorage.setSettings as jest.Mock).mockResolvedValue(undefined);
      (ExtensionStorage.getScopedSources as jest.Mock).mockResolvedValue([]);
      (chrome.storage.local.remove as jest.Mock).mockResolvedValue(undefined);

      const start = Date.now();
      const result = await StorageCleanup.clearInvalidSources();
      const duration = Date.now() - start;

      expect(result.cleaned).toBeGreaterThan(300); // Approximately 1/3 of sources
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle cleanup status check efficiently', async () => {
      const largeSettings = {
        configuredSources: Array.from({ length: 100 }, (_, i) => ({
          provider: 'google-drive',
          scope: 'personal',
          displayName: `Source ${i}`
        }))
      } as ExtensionSettings;

      (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(largeSettings);
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({});

      const start = Date.now();
      const result = await StorageCleanup.getCleanupStatus();
      const duration = Date.now() - start;

      expect(result.needsCleanup).toBe(false);
      expect(duration).toBeLessThan(500); // Should be fast
    });
  });
});