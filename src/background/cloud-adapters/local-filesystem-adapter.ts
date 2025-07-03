import { CloudAdapter, CloudCredentials, TextSnippet, SyncStatus, SyncedSource } from '../../shared/types';
import { BaseCloudAdapter } from './base-adapter';

export class LocalFilesystemAdapter extends BaseCloudAdapter implements CloudAdapter {
  provider: 'local-filesystem' = 'local-filesystem';
  private _directoryHandle: FileSystemDirectoryHandle | null = null;

  constructor() {
    super();
  }

  async initialize(credentials?: CloudCredentials): Promise<void> {
    // For local filesystem, initialization might involve restoring a handle
    // This method is primarily for setting up the adapter, not re-obtaining handles.
    // Handles are re-obtained by ScopedSourceManager and set via setDirectoryHandle.
    this.isInitialized = true;
  }

  setDirectoryHandle(handle: FileSystemDirectoryHandle): void {
    this._directoryHandle = handle;
  }

  private get directoryHandle(): FileSystemDirectoryHandle {
    if (!this._directoryHandle) {
      throw new Error('Local directory handle not set or permission not granted.');
    }
    return this._directoryHandle;
  }

  async authenticate(): Promise<CloudCredentials> {
    // Authentication for local filesystem is essentially selecting a folder
    throw new Error('Authentication not applicable for LocalFilesystemAdapter. Use selectFolder instead.');
  }

  async isAuthenticated(): Promise<boolean> {
    return !!this.directoryHandle;
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return {
      provider: this.provider,
      isOnline: true, // Local filesystem is always "online" in terms of connectivity
      hasChanges: false, // This will be determined by listChanges
      lastSync: null, // Will be updated by SyncManager
    };
  }

  async uploadSnippets(snippets: TextSnippet[]): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('Local directory not selected or permission not granted.');
    }
    try {
      const fileName = 'snippets.json'; // Standard file name for local snippets
      const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(snippets, null, 2));
      await writable.close();
      console.log('Snippets uploaded to local filesystem.');
    } catch (error) {
      console.error('Failed to upload snippets to local filesystem:', error);
      throw error;
    }
  }

  async downloadSnippets(): Promise<TextSnippet[]> {
    if (!this.directoryHandle) {
      throw new Error('Local directory not selected or permission not granted.');
    }
    try {
      const fileName = 'snippets.json';
      const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const content = await file.text();
      return JSON.parse(content);
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        console.warn('Snippets file not found in local directory. Returning empty array.');
        return [];
      }
      console.error('Failed to download snippets from local filesystem:', error);
      throw error;
    }
  }

  async deleteSnippets(snippetIds: string[]): Promise<void> {
    // For local filesystem, we'll re-write the entire file without the deleted snippets
    const existingSnippets = await this.downloadSnippets();
    const updatedSnippets = existingSnippets.filter(s => !snippetIds.includes(s.id));
    await this.uploadSnippets(updatedSnippets);
  }

  async selectFolder(): Promise<{ folderId: string, folderName: string, handleId?: string, handleName?: string }> {
    try {
      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      });
      this._directoryHandle = directoryHandle;
      return { folderId: directoryHandle.name, folderName: directoryHandle.name, handleId: (directoryHandle as any).id, handleName: directoryHandle.name };
    } catch (error) {
      console.error('Failed to select local folder:', error);
      throw error;
    }
  }

  async listFiles(): Promise<any[]> {
    if (!this.directoryHandle) {
      throw new Error('Local directory not selected.');
    }
    const files: any[] = [];
    for await (const entry of this.directoryHandle.values()) {
      files.push(entry);
    }
    return files;
  }

  async listChanges(lastSyncToken: string | null): Promise<{ changes: any[]; newSyncToken: string }> {
    if (!this.directoryHandle) {
      throw new Error('Local directory not selected.');
    }
    // For local filesystem, we'll use file modification time as a simple change indicator
    // A more robust solution would involve hashing file content or maintaining a local change log.
    try {
      const fileName = 'snippets.json';
      const fileHandle = await this.directoryHandle.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const lastModified = file.lastModified;

      // If lastSyncToken is provided and matches, assume no changes
      if (lastSyncToken && parseInt(lastSyncToken) === lastModified) {
        return { changes: [], newSyncToken: lastModified.toString() };
      }

      // Otherwise, consider the file changed
      return { changes: [{ type: 'file', name: fileName, lastModified }], newSyncToken: lastModified.toString() };
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        // If file doesn't exist, it's like a deletion or initial state
        return { changes: [{ type: 'file', name: 'snippets.json', deleted: true }], newSyncToken: Date.now().toString() };
      }
      console.error('Failed to list changes for local filesystem:', error);
      throw error;
    }
  }

  async downloadFile(fileId: string): Promise<string> {
    if (!this.directoryHandle) {
      throw new Error('Local directory not selected.');
    }
    try {
      const fileHandle = await this.directoryHandle.getFileHandle(fileId, { create: false });
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (error) {
      console.error('Failed to download file from local filesystem:', error);
      throw error;
    }
  }
}
