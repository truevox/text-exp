/**
 * Local Filesystem Adapter (DISABLED)
 * Note: File System Access API is not available in service worker context
 * This is a stub implementation for compatibility
 */

import { BaseCloudAdapter } from "./base-adapter.js";
import type { TextSnippet, CloudCredentials } from "../../shared/types.js";

export class LocalFilesystemAdapter extends BaseCloudAdapter {
  provider = "local-filesystem" as const;

  constructor() {
    super();
  }

  async connect(): Promise<boolean> {
    throw new Error(
      "LocalFilesystemAdapter is not supported in service worker context",
    );
  }

  async disconnect(): Promise<void> {
    throw new Error(
      "LocalFilesystemAdapter is not supported in service worker context",
    );
  }

  async isConnected(): Promise<boolean> {
    return false;
  }

  async downloadSnippets(_folderId?: string): Promise<TextSnippet[]> {
    throw new Error(
      "LocalFilesystemAdapter is not supported in service worker context",
    );
  }

  async uploadSnippets(
    _snippets: TextSnippet[],
    _folderId?: string,
  ): Promise<void> {
    throw new Error(
      "LocalFilesystemAdapter is not supported in service worker context",
    );
  }

  async createFolder(
    _name: string,
    _parentId?: string,
  ): Promise<{ id: string; name: string }> {
    throw new Error(
      "LocalFilesystemAdapter is not supported in service worker context",
    );
  }

  async getFolders(
    _parentId?: string,
  ): Promise<Array<{ id: string; name: string }>> {
    throw new Error(
      "LocalFilesystemAdapter is not supported in service worker context",
    );
  }

  async authenticate(): Promise<CloudCredentials> {
    throw new Error(
      "LocalFilesystemAdapter is not supported in service worker context",
    );
  }

  async refreshCredentials(
    _credentials: CloudCredentials,
  ): Promise<CloudCredentials> {
    throw new Error(
      "LocalFilesystemAdapter is not supported in service worker context",
    );
  }

  async validateCredentials(): Promise<boolean> {
    return false;
  }

  async deleteSnippets(): Promise<void> {
    throw new Error(
      "LocalFilesystemAdapter is not supported in service worker context",
    );
  }

  async checkConnectivity(): Promise<boolean> {
    return false; // Always return false since it's not supported
  }

  async getLastSyncTime(): Promise<Date | null> {
    return null;
  }

  async hasLocalChanges(): Promise<boolean> {
    return false;
  }
}
