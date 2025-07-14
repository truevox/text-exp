/**
 * Google Drive CloudAdapter implementation
 * Handles synchronization with Google Drive storage
 */

import { BaseCloudAdapter } from "./base-adapter.js";
import type { CloudCredentials, TextSnippet } from "../../shared/types.js";
import { SYNC_CONFIG } from "../../shared/constants.js";
import {
  GoogleDriveAuthService,
  GoogleDriveFileService,
  GoogleDriveFolderService,
  GoogleDriveUtils,
} from "./google-drive/index.js";

/**
 * Google Drive adapter for cloud synchronization
 */
export class GoogleDriveAdapter extends BaseCloudAdapter {
  readonly provider = "google-drive" as const;

  private fileId: string | null = null;

  /**
   * Authenticate with Google Drive using Chrome Identity API
   */
  async authenticate(): Promise<CloudCredentials> {
    return GoogleDriveAuthService.authenticate();
  }

  /**
   * Upload snippets to Google Drive
   */
  async uploadSnippets(snippets: TextSnippet[]): Promise<void> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    await GoogleDriveUtils.retryOperation(async () => {
      this.fileId = await GoogleDriveFileService.uploadSnippets(
        this.credentials!,
        snippets,
        this.fileId || undefined,
      );
    });
  }

  /**
   * Download snippets from Google Drive
   */
  async downloadSnippets(folderId?: string): Promise<TextSnippet[]> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveUtils.retryOperation(async () => {
      const result = await GoogleDriveFileService.downloadSnippets(
        this.credentials!,
        folderId,
      );

      // Cache the file ID for future operations
      if (result.fileId) {
        this.fileId = result.fileId;
      }

      return result.snippets;
    });
  }

  /**
   * Delete snippets from Google Drive
   */
  async deleteSnippets(snippetIds: string[]): Promise<void> {
    // For Google Drive, we re-upload the file without the deleted snippets
    const currentSnippets = await this.downloadSnippets();
    const filteredSnippets = currentSnippets.filter(
      (snippet) => !snippetIds.includes(snippet.id),
    );

    await this.uploadSnippets(filteredSnippets);
  }

  /**
   * Get list of available folders without selecting one
   */
  async getFolders(
    parentId?: string,
  ): Promise<
    Array<{ id: string; name: string; parentId?: string; isFolder: boolean }>
  > {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveFolderService.getFolders(this.credentials, parentId);
  }

  /**
   * Select a folder for storing snippets
   */
  async selectFolder(): Promise<{ folderId: string; folderName: string }> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveFolderService.selectFolder(this.credentials);
  }

  /**
   * Validate stored credentials
   */
  protected async validateCredentials(): Promise<boolean> {
    if (!this.credentials) {
      return false;
    }

    const result = await GoogleDriveAuthService.validateCredentials(
      this.credentials,
    );
    return result.isValid;
  }

  /**
   * Check network connectivity to Google Drive
   */
  protected async checkConnectivity(): Promise<boolean> {
    if (!this.credentials) {
      return false;
    }

    return GoogleDriveUtils.checkConnectivity(this.credentials);
  }

  /**
   * Get the last sync timestamp
   */
  protected async getLastSyncTime(): Promise<Date | null> {
    // This would typically be stored in extension storage
    // For now, return null and let the storage utility handle it
    return null;
  }

  /**
   * Check if there are local changes to sync
   */
  protected async hasLocalChanges(): Promise<boolean> {
    // This would compare local storage timestamp with last sync
    // For now, assume there are always changes to sync
    return true;
  }

  /**
   * List all files in a folder with their metadata
   */
  async listFiles(folderId?: string): Promise<
    Array<{
      id: string;
      name: string;
      mimeType?: string;
      modifiedTime?: string;
    }>
  > {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveFileService.listFiles(this.credentials, folderId);
  }

  /**
   * Download raw file content by ID
   */
  async downloadFileContent(fileId: string): Promise<string> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveFileService.downloadFileContent(this.credentials, fileId);
  }

  /**
   * Check if the adapter is authenticated (has valid credentials)
   */
  override async isAuthenticated(): Promise<boolean> {
    if (!this.credentials?.accessToken) {
      return false;
    }

    // Check if token is expired
    if (this.credentials.expiresAt && this.credentials.expiresAt < new Date()) {
      console.log("🔐 Google Drive token expired");
      return false;
    }

    return GoogleDriveUtils.checkConnectivity(this.credentials);
  }

  /**
   * Create a new folder in Google Drive
   */
  async createFolder(
    name: string,
    parentId?: string,
  ): Promise<{ id: string; name: string }> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveFolderService.createFolder(
      this.credentials,
      name,
      parentId,
    );
  }

  /**
   * Clear cached tokens and force re-authentication (DEBUG)
   */
  async clearTokenAndReAuthenticate(): Promise<void> {
    console.log("🔄 [DEBUG] Clearing tokens and re-authenticating...");
    try {
      const newCredentials =
        await GoogleDriveAuthService.clearTokenAndReAuthenticate();
      this.credentials = newCredentials;
      console.log(
        "✅ [DEBUG] Successfully re-authenticated with new credentials",
      );
    } catch (error) {
      console.error("❌ [DEBUG] Failed to re-authenticate:", error);
      throw error;
    }
  }

  /**
   * Test direct API access (DEBUG)
   */
  async testDirectApiAccess(folderId?: string): Promise<{
    success: boolean;
    details: string;
    files?: Array<{ id: string; name: string; mimeType?: string }>;
  }> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveFileService.testDirectApiAccess(
      this.credentials,
      folderId,
    );
  }

  /**
   * Debug complete authentication and file access flow
   */
  async debugCompleteFlow(folderId?: string): Promise<{
    authSuccess: boolean;
    apiTestResult: any;
    fileListResult: any;
    error?: string;
  }> {
    console.log("🐛 [DEBUG] Starting complete debug flow...");

    try {
      // Step 1: Clear tokens and re-authenticate
      console.log(
        "🐛 [DEBUG] Step 1: Clearing tokens and re-authenticating...",
      );
      await this.clearTokenAndReAuthenticate();

      // Step 2: Test direct API access
      console.log("🐛 [DEBUG] Step 2: Testing direct API access...");
      const apiTestResult = await this.testDirectApiAccess(folderId);

      // Step 3: Test file listing through normal flow
      console.log(
        "🐛 [DEBUG] Step 3: Testing file listing through normal flow...",
      );
      const fileListResult = await this.listFiles(folderId);

      return {
        authSuccess: true,
        apiTestResult,
        fileListResult,
      };
    } catch (error) {
      console.error("❌ [DEBUG] Complete debug flow failed:", error);
      return {
        authSuccess: false,
        apiTestResult: null,
        fileListResult: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
