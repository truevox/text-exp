/**
 * Google Drive CloudAdapter implementation
 * Handles synchronization with Google Drive storage
 */

import { BaseCloudAdapter } from "./base-adapter.js";
import type { CloudCredentials, TextSnippet } from "../../shared/types.js";
import type {
  TierStorageSchema,
  PriorityTier,
} from "../../types/snippet-formats.js";
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

  // === NEW TIER-BASED METHODS FOR PRIORITY-TIER ARCHITECTURE ===

  /**
   * Upload tier schema to Google Drive (works with drive.file scope)
   */
  async uploadTierSchema(
    schema: TierStorageSchema,
    fileId?: string,
  ): Promise<string> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    const fileName = `${schema.tier}.json`;
    const content = JSON.stringify(schema, null, 2);

    console.log(
      `📤 Uploading ${fileName} to Google Drive (${content.length} bytes)`,
    );

    return GoogleDriveUtils.retryOperation(async () => {
      // Use the file service to upload tier JSON file
      const uploadedFileId = await GoogleDriveFileService.uploadJsonFile(
        this.credentials!,
        fileName,
        content,
        fileId,
      );

      console.log(
        `✅ Successfully uploaded ${fileName} with ID: ${uploadedFileId}`,
      );
      return uploadedFileId;
    });
  }

  /**
   * Download tier schema from Google Drive (works with drive.file scope)
   */
  async downloadTierSchema(
    tier: PriorityTier,
    fileId?: string,
  ): Promise<TierStorageSchema | null> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    const fileName = `${tier}.json`;
    console.log(`📥 Downloading ${fileName} from Google Drive`);

    return GoogleDriveUtils.retryOperation(async () => {
      try {
        let targetFileId = fileId;

        // If no specific file ID provided, search for the tier file
        if (!targetFileId) {
          const files = await this.searchTierFiles();
          const tierFile = files.find((f) => f.name === fileName);
          if (!tierFile) {
            console.log(`📭 No ${fileName} found on Google Drive`);
            return null;
          }
          targetFileId = tierFile.id;
        }

        // Download the file content
        const content = await GoogleDriveFileService.downloadFileContent(
          this.credentials!,
          targetFileId,
        );

        // Parse and validate the schema
        const schema = JSON.parse(content) as TierStorageSchema;

        if (schema.tier !== tier) {
          throw new Error(
            `Schema tier mismatch: expected ${tier}, got ${schema.tier}`,
          );
        }

        console.log(
          `✅ Successfully downloaded ${fileName} with ${schema.snippets.length} snippets`,
        );
        return schema;
      } catch (error) {
        console.error(`❌ Failed to download ${fileName}:`, error);
        return null;
      }
    });
  }

  /**
   * Search for tier files in Google Drive (works with drive.file scope)
   */
  async searchTierFiles(): Promise<
    Array<{ id: string; name: string; modifiedTime?: string }>
  > {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    console.log("🔍 Searching for tier files on Google Drive");

    return GoogleDriveUtils.retryOperation(async () => {
      // Search for JSON files that match tier naming pattern
      const query =
        "name contains '.json' and (name contains 'personal' or name contains 'team' or name contains 'org')";

      const files = await GoogleDriveFileService.searchFiles(
        this.credentials!,
        query,
      );

      // Filter to only tier files
      const tierFiles = files.filter(
        (file) =>
          file.name === "personal.json" ||
          file.name === "team.json" ||
          file.name === "org.json",
      );

      console.log(
        `📋 Found ${tierFiles.length} tier files:`,
        tierFiles.map((f) => f.name),
      );
      return tierFiles;
    });
  }

  /**
   * Delete tier file from Google Drive (works with drive.file scope)
   */
  async deleteTierFile(tier: PriorityTier, fileId?: string): Promise<boolean> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    const fileName = `${tier}.json`;
    console.log(`🗑️ Deleting ${fileName} from Google Drive`);

    return GoogleDriveUtils.retryOperation(async () => {
      try {
        let targetFileId = fileId;

        // If no specific file ID provided, search for the tier file
        if (!targetFileId) {
          const files = await this.searchTierFiles();
          const tierFile = files.find((f) => f.name === fileName);
          if (!tierFile) {
            console.log(`📭 No ${fileName} found to delete`);
            return false;
          }
          targetFileId = tierFile.id;
        }

        // Delete the file
        await GoogleDriveFileService.deleteFile(
          this.credentials!,
          targetFileId,
        );
        console.log(`✅ Successfully deleted ${fileName}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to delete ${fileName}:`, error);
        return false;
      }
    });
  }

  /**
   * Store user preferences in appdata (works with drive.appdata scope)
   */
  async storeUserPreferences(preferences: any): Promise<void> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    console.log("💾 Storing user preferences in Drive appdata");

    await GoogleDriveUtils.retryOperation(async () => {
      const content = JSON.stringify(preferences, null, 2);

      // Upload to appdata folder (private application data)
      await GoogleDriveFileService.uploadToAppData(
        this.credentials!,
        "puffpuffpaste-preferences.json",
        content,
      );

      console.log("✅ User preferences stored successfully");
    });
  }

  /**
   * Retrieve user preferences from appdata (works with drive.appdata scope)
   */
  async getUserPreferences(): Promise<any | null> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    console.log("📥 Retrieving user preferences from Drive appdata");

    return GoogleDriveUtils.retryOperation(async () => {
      try {
        const content = await GoogleDriveFileService.downloadFromAppData(
          this.credentials!,
          "puffpuffpaste-preferences.json",
        );

        const preferences = JSON.parse(content);
        console.log("✅ User preferences retrieved successfully");
        return preferences;
      } catch (error) {
        console.log("📭 No user preferences found in appdata");
        return null;
      }
    });
  }
}
