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
  GoogleDriveUtils,
} from "./google-drive/index.js";
import { GoogleDriveAppDataManager } from "./google-drive-appdata-manager.js";
import { GoogleDriveFilePickerService } from "./google-drive/file-picker-service.js";

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
   * Create a new snippet store file (replaces folder-based storage)
   * Works with drive.file scope
   */
  async createSnippetStoreFile(
    tierName: string,
    description?: string,
  ): Promise<{ fileId: string; fileName: string }> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    console.log(`📝 Creating snippet store file for tier: ${tierName}`);

    const result =
      await GoogleDriveFilePickerService.createStructuredSnippetStore(
        this.credentials,
        tierName,
        description,
      );

    return {
      fileId: result.fileId,
      fileName: result.fileName,
    };
  }

  /**
   * Validate that a file can be used as a snippet store
   * Works with drive.file scope
   */
  async validateSnippetStoreFile(
    fileId: string,
  ): Promise<{ isValid: boolean; reason?: string; canWrite: boolean }> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveFilePickerService.validateSnippetStoreFile(
      this.credentials,
      fileId,
    );
  }

  /**
   * Test access to a specific file
   * Works with drive.file scope
   */
  async testFileAccess(
    fileId: string,
  ): Promise<{ canRead: boolean; canWrite: boolean; error?: string }> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveFilePickerService.testFileAccess(
      this.credentials,
      fileId,
    );
  }

  /**
   * Get file information for a specific file
   * Works with drive.file scope
   */
  async getFileInfo(fileId: string): Promise<{
    id: string;
    name: string;
    mimeType?: string;
    permissions: string[];
  }> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    return GoogleDriveFilePickerService.getFileInfo(this.credentials, fileId);
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
   * Discover and retrieve Priority #0 snippet store from appdata
   * This store is automatically discovered without user selection
   */
  async discoverAppDataStore(): Promise<{
    hasStore: boolean;
    snippets: TextSnippet[];
    storeInfo?: {
      name: string;
      tier: PriorityTier;
      lastModified: string;
    };
  }> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    try {
      const priorityStore =
        await GoogleDriveAppDataManager.getPriorityZeroSnippets(
          this.credentials,
        );

      if (!priorityStore) {
        return {
          hasStore: false,
          snippets: [],
        };
      }

      return {
        hasStore: true,
        snippets: priorityStore.snippets.map((snippet) => ({
          id: snippet.id,
          trigger: snippet.trigger,
          content: snippet.content || "",
          contentType: snippet.contentType,
          description: snippet.description,
          scope: snippet.scope,
          variables:
            snippet.variables?.map((v) => ({
              name: v.name,
              placeholder: v.prompt || v.name,
              defaultValue: v.defaultValue,
              required: false,
              type: "text" as const,
            })) || [],
          tags: snippet.tags || [],
          createdAt: new Date(snippet.createdAt),
          updatedAt: new Date(snippet.updatedAt),
        })),
        storeInfo: {
          name: "Priority #0 Store",
          tier: priorityStore.tier,
          lastModified: priorityStore.metadata.modified,
        },
      };
    } catch (error) {
      console.error("❌ Failed to discover appdata store:", error);
      return {
        hasStore: false,
        snippets: [],
      };
    }
  }

  /**
   * REMOVED: listFiles method violates OAuth compliance
   * Extension should only access files explicitly granted through drive.file and drive.appdata scopes
   */

  /**
   * REMOVED: downloadFileContent method was part of file discovery system
   * OAuth-compliant file access should only be through explicitly selected files
   */

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
   * Create default snippet store files for all tiers
   * Works with drive.file scope
   */
  async createDefaultSnippetStores(): Promise<
    Array<{ fileId: string; fileName: string; tier: string }>
  > {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    console.log("📝 Creating default snippet store files");

    const results =
      await GoogleDriveFilePickerService.createDefaultSnippetStores(
        this.credentials,
      );

    return results.map((result) => ({
      fileId: result.fileId,
      fileName: result.fileName,
      tier: result.fileName.replace(".json", ""),
    }));
  }

  /**
   * Get file picker instructions for users
   */
  getFilePickerInstructions(): string {
    return GoogleDriveFilePickerService.getFilePickerInstructions();
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
        "🐛 [DEBUG] Step 3: OAuth compliance check - skipping file listing...",
      );
      // REMOVED: File listing violates OAuth scope restrictions

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
   * Store user configuration in appdata (works with drive.appdata scope)
   */
  async storeUserConfiguration(configuration: any): Promise<void> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    console.log("💾 Storing user configuration in Drive appdata");

    await GoogleDriveUtils.retryOperation(async () => {
      await GoogleDriveAppDataManager.storeUserConfiguration(
        this.credentials!,
        configuration,
      );
      console.log("✅ User configuration stored successfully");
    });
  }

  /**
   * Retrieve user configuration from appdata (works with drive.appdata scope)
   */
  async getUserConfiguration(): Promise<any | null> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    console.log("📥 Retrieving user configuration from Drive appdata");

    return GoogleDriveUtils.retryOperation(async () => {
      const config = await GoogleDriveAppDataManager.getUserConfiguration(
        this.credentials!,
      );
      if (config) {
        console.log("✅ User configuration retrieved successfully");
      } else {
        console.log("📭 No user configuration found in appdata");
      }
      return config;
    });
  }

  /**
   * Store Priority #0 snippet store in appdata (works with drive.appdata scope)
   */
  async storePriorityZeroSnippets(
    snippetStore: TierStorageSchema,
  ): Promise<void> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    console.log("💾 Storing Priority #0 snippets in Drive appdata");

    await GoogleDriveUtils.retryOperation(async () => {
      await GoogleDriveAppDataManager.storePriorityZeroSnippets(
        this.credentials!,
        snippetStore,
      );
      console.log("✅ Priority #0 snippets stored successfully");
    });
  }

  /**
   * Retrieve Priority #0 snippet store from appdata (works with drive.appdata scope)
   */
  async getPriorityZeroSnippets(): Promise<TierStorageSchema | null> {
    if (!this.credentials) {
      throw new Error("Not authenticated");
    }

    console.log("📥 Retrieving Priority #0 snippets from Drive appdata");

    return GoogleDriveUtils.retryOperation(async () => {
      const snippets = await GoogleDriveAppDataManager.getPriorityZeroSnippets(
        this.credentials!,
      );
      if (snippets) {
        console.log("✅ Priority #0 snippets retrieved successfully");
      } else {
        console.log("📭 No Priority #0 snippets found in appdata");
      }
      return snippets;
    });
  }

  /**
   * Legacy method: Store user preferences (for backwards compatibility)
   * @deprecated Use storeUserConfiguration instead
   */
  async storeUserPreferences(preferences: any): Promise<void> {
    console.warn(
      "⚠️ storeUserPreferences is deprecated, use storeUserConfiguration",
    );
    await this.storeUserConfiguration(preferences);
  }

  /**
   * Legacy method: Get user preferences (for backwards compatibility)
   * @deprecated Use getUserConfiguration instead
   */
  async getUserPreferences(): Promise<any | null> {
    console.warn(
      "⚠️ getUserPreferences is deprecated, use getUserConfiguration",
    );
    return await this.getUserConfiguration();
  }
}
