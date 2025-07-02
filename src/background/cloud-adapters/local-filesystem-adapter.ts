/**
 * Local Filesystem CloudAdapter implementation
 * Handles loading snippets from local file system using File System Access API
 */

import { BaseCloudAdapter } from './base-adapter.js';
import type { CloudCredentials, TextSnippet } from '../../shared/types.js';
import { SYNC_CONFIG } from '../../shared/constants.js';

/**
 * Local filesystem adapter for loading snippets from local files
 */
export class LocalFilesystemAdapter extends BaseCloudAdapter {
  readonly provider = 'local-filesystem' as const;
  
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private fileHandle: FileSystemFileHandle | null = null;

  /**
   * Authenticate with local filesystem (select folder)
   */
  async authenticate(): Promise<CloudCredentials> {
    try {
      // Check if File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        throw new Error('File System Access API not supported in this browser');
      }

      // Show directory picker
      this.directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      // Return mock credentials for local filesystem
      return {
        provider: this.provider,
        accessToken: 'local-filesystem',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Folder selection cancelled');
      }
      throw new Error(`Failed to select folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload snippets to local file system
   */
  async uploadSnippets(snippets: TextSnippet[]): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('No directory selected');
    }

    const sanitizedSnippets = this.sanitizeSnippets(snippets);
    const data = JSON.stringify(sanitizedSnippets, null, 2);

    try {
      // Get or create the snippets file
      this.fileHandle = await this.directoryHandle.getFileHandle(SYNC_CONFIG.FILE_NAME, {
        create: true
      });

      // Write to file
      const writable = await this.fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
    } catch (error) {
      throw new Error(`Failed to save snippets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download snippets from local file system
   */
  async downloadSnippets(): Promise<TextSnippet[]> {
    if (!this.directoryHandle) {
      throw new Error('No directory selected');
    }

    try {
      // Try to get the snippets file
      this.fileHandle = await this.directoryHandle.getFileHandle(SYNC_CONFIG.FILE_NAME);
      
      // Read file content
      const file = await this.fileHandle.getFile();
      const content = await file.text();

      if (!content.trim()) {
        return []; // Empty file
      }

      try {
        const snippets = JSON.parse(content) as TextSnippet[];
        return snippets.map(snippet => ({
          ...snippet,
          createdAt: new Date(snippet.createdAt),
          updatedAt: new Date(snippet.updatedAt)
        }));
      } catch (parseError) {
        console.error('Failed to parse snippets file:', parseError);
        return [];
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        // File doesn't exist yet, return empty array
        return [];
      }
      throw new Error(`Failed to load snippets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete snippets from local file system
   */
  async deleteSnippets(snippetIds: string[]): Promise<void> {
    // For local filesystem, we re-write the file without the deleted snippets
    const currentSnippets = await this.downloadSnippets();
    const filteredSnippets = currentSnippets.filter(
      snippet => !snippetIds.includes(snippet.id)
    );
    
    await this.uploadSnippets(filteredSnippets);
  }

  /**
   * Validate stored credentials (always valid for local filesystem)
   */
  protected async validateCredentials(): Promise<boolean> {
    return this.directoryHandle !== null;
  }

  /**
   * Check connectivity (always true for local filesystem)
   */
  protected async checkConnectivity(): Promise<boolean> {
    return true;
  }

  /**
   * Get the last sync timestamp
   */
  protected async getLastSyncTime(): Promise<Date | null> {
    if (!this.fileHandle) {
      return null;
    }

    try {
      const file = await this.fileHandle.getFile();
      return new Date(file.lastModified);
    } catch {
      return null;
    }
  }

  /**
   * Check if there are local changes to sync
   */
  protected async hasLocalChanges(): Promise<boolean> {
    // For local filesystem, assume there are always changes to check
    return true;
  }

  /**
   * Get selected folder name for display
   */
  async getSelectedFolderName(): Promise<string> {
    if (!this.directoryHandle) {
      return 'No folder selected';
    }
    return this.directoryHandle.name;
  }

  /**
   * List snippet files in the directory
   */
  async listSnippetFiles(): Promise<string[]> {
    if (!this.directoryHandle) {
      return [];
    }

    const files: string[] = [];
    
    try {
      for await (const [name, handle] of this.directoryHandle.entries()) {
        if (handle.kind === 'file' && name.endsWith('.json')) {
          files.push(name);
        }
      }
    } catch (error) {
      console.error('Failed to list files:', error);
    }

    return files;
  }

  /**
   * Load snippets from a specific file
   */
  async loadSnippetsFromFile(filename: string): Promise<TextSnippet[]> {
    if (!this.directoryHandle) {
      throw new Error('No directory selected');
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const content = await file.text();

      if (!content.trim()) {
        return [];
      }

      const snippets = JSON.parse(content) as TextSnippet[];
      return snippets.map(snippet => ({
        ...snippet,
        createdAt: new Date(snippet.createdAt),
        updatedAt: new Date(snippet.updatedAt)
      }));
    } catch (error) {
      throw new Error(`Failed to load snippets from ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new snippet file
   */
  async createSnippetFile(filename: string, snippets: TextSnippet[] = []): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('No directory selected');
    }

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(filename, {
        create: true
      });

      const data = JSON.stringify(snippets, null, 2);
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
    } catch (error) {
      throw new Error(`Failed to create snippet file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}