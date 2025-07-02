/**
 * Unit tests for CloudAdapter implementations
 */

import { GoogleDriveAdapter } from '../../src/background/cloud-adapters/google-drive-adapter.js';
import { DropboxAdapter } from '../../src/background/cloud-adapters/dropbox-adapter.js';
import { OneDriveAdapter } from '../../src/background/cloud-adapters/onedrive-adapter.js';
import { getCloudAdapterFactory } from '../../src/background/cloud-adapters/index.js';
import type { TextSnippet, CloudCredentials } from '../../src/shared/types.js';

describe('CloudAdapters', () => {
  const mockSnippet: TextSnippet = {
    id: 'test-1',
    trigger: ';test',
    content: 'Test content',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  };

  const mockCredentials: CloudCredentials = {
    provider: 'google-drive',
    accessToken: 'mock-token',
    expiresAt: new Date(Date.now() + 3600000)
  };

  describe('CloudAdapterFactory', () => {
    it('should create Google Drive adapter', () => {
      const factory = getCloudAdapterFactory();
      const adapter = factory.createAdapter('google-drive');
      expect(adapter).toBeInstanceOf(GoogleDriveAdapter);
    });

    it('should create Dropbox adapter', () => {
      const factory = getCloudAdapterFactory();
      const adapter = factory.createAdapter('dropbox');
      expect(adapter).toBeInstanceOf(DropboxAdapter);
    });

    it('should create OneDrive adapter', () => {
      const factory = getCloudAdapterFactory();
      const adapter = factory.createAdapter('onedrive');
      expect(adapter).toBeInstanceOf(OneDriveAdapter);
    });

    it('should throw error for unsupported provider', () => {
      const factory = getCloudAdapterFactory();
      expect(() => {
        factory.createAdapter('unsupported' as any);
      }).toThrow('Unsupported cloud provider');
    });

    it('should return supported providers list', () => {
      const factory = getCloudAdapterFactory();
      const providers = factory.getSupportedProviders();
      expect(providers).toContain('google-drive');
      expect(providers).toContain('dropbox');
      expect(providers).toContain('onedrive');
      expect(providers).toContain('local');
    });
  });

  describe('GoogleDriveAdapter', () => {
    let adapter: GoogleDriveAdapter;

    beforeEach(() => {
      adapter = new GoogleDriveAdapter();
    });

    it('should have correct provider name', () => {
      expect(adapter.provider).toBe('google-drive');
    });

    it('should initialize with credentials', async () => {
      // Mock the validateCredentials method
      jest.spyOn(adapter as any, 'validateCredentials').mockResolvedValue(true);
      
      await expect(adapter.initialize(mockCredentials)).resolves.not.toThrow();
    });

    it('should reject invalid credentials', async () => {
      // Mock the validateCredentials method to return false
      jest.spyOn(adapter as any, 'validateCredentials').mockResolvedValue(false);
      
      await expect(adapter.initialize(mockCredentials)).rejects.toThrow();
    });
  });

  describe('BaseCloudAdapter', () => {
    let adapter: GoogleDriveAdapter;

    beforeEach(() => {
      adapter = new GoogleDriveAdapter();
    });

    describe('mergeSnippets', () => {
      it('should merge snippets correctly', () => {
        const localSnippets: TextSnippet[] = [
          {
            id: '1',
            trigger: ';local',
            content: 'Local content',
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-02'), // Newer
          }
        ];

        const remoteSnippets: TextSnippet[] = [
          {
            id: '1',
            trigger: ';remote',
            content: 'Remote content',
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-01'), // Older
          },
          {
            id: '2',
            trigger: ';remote-only',
            content: 'Remote only',
            createdAt: new Date('2023-01-01'),
            updatedAt: new Date('2023-01-01'),
          }
        ];

        const merged = (adapter as any).mergeSnippets(localSnippets, remoteSnippets);
        
        expect(merged).toHaveLength(2);
        expect(merged.find((s: TextSnippet) => s.id === '1')?.content).toBe('Local content'); // Local wins
        expect(merged.find((s: TextSnippet) => s.id === '2')?.content).toBe('Remote only'); // Remote only
      });

      it('should handle empty arrays', () => {
        const merged = (adapter as any).mergeSnippets([], []);
        expect(merged).toHaveLength(0);
      });
    });

    describe('validateSnippet', () => {
      it('should validate correct snippet', () => {
        const isValid = (adapter as any).validateSnippet(mockSnippet);
        expect(isValid).toBe(true);
      });

      it('should reject invalid snippet', () => {
        const invalidSnippet = {
          id: 'test',
          trigger: ';test',
          // Missing required fields
        };
        
        const isValid = (adapter as any).validateSnippet(invalidSnippet);
        expect(isValid).toBe(false);
      });
    });
  });
});