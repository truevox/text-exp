/**
 * Local Filesystem Adapter (DISABLED)
 * Note: File System Access API is not available in service worker context
 * This is a stub implementation for compatibility
 */

import { BaseCloudAdapter } from './base-adapter.js';
import type { TextSnippet, CloudCredentials } from '../../shared/types.js';

export class LocalFilesystemAdapter extends BaseCloudAdapter {
  constructor() {
    super();
  }

  async connect(): Promise<boolean> {
    throw new Error('LocalFilesystemAdapter is not supported in service worker context');
  }

  async disconnect(): Promise<void> {
    throw new Error('LocalFilesystemAdapter is not supported in service worker context');
  }

  async isConnected(): Promise<boolean> {
    return false;
  }

  async downloadSnippets(folderId?: string): Promise<TextSnippet[]> {
    throw new Error('LocalFilesystemAdapter is not supported in service worker context');
  }

  async uploadSnippets(snippets: TextSnippet[], folderId?: string): Promise<void> {
    throw new Error('LocalFilesystemAdapter is not supported in service worker context');
  }

  async createFolder(name: string, parentId?: string): Promise<{ id: string; name: string }> {
    throw new Error('LocalFilesystemAdapter is not supported in service worker context');
  }

  async getFolders(parentId?: string): Promise<Array<{ id: string; name: string }>> {
    throw new Error('LocalFilesystemAdapter is not supported in service worker context');
  }

  async authenticate(): Promise<CloudCredentials> {
    throw new Error('LocalFilesystemAdapter is not supported in service worker context');
  }

  async refreshCredentials(credentials: CloudCredentials): Promise<CloudCredentials> {
    throw new Error('LocalFilesystemAdapter is not supported in service worker context');
  }

  async validateCredentials(credentials: CloudCredentials): Promise<boolean> {
    return false;
  }
}