/**
 * Google Drive Appdata Manager
 * Handles storage in Google Drive's appdata folder with drive.appdata scope
 *
 * RESTRICTED USAGE:
 * - User configuration/preferences
 * - Priority #0 (highest priority) snippet store ONLY
 */

import type { CloudCredentials } from "../../shared/types.js";
import type { TierStorageSchema } from "../../types/snippet-formats.js";
import { GoogleDriveAuthService } from "./google-drive/auth-service.js";

export interface AppDataFile {
  name: string;
  content: string;
  lastModified: string;
}

export interface UserConfiguration {
  version: string;
  settings: {
    triggerDelay: number;
    caseSensitive: boolean;
    enableSharedSnippets: boolean;
    autoSync: boolean;
    syncInterval: number;
    showNotifications: boolean;
  };
  preferredStores: {
    personalDefault: string;
    teamDefault: string;
    orgDefault: string;
  };
  driveFiles: {
    selectedFiles: string[];
    permissions: Record<string, "read" | "write">;
  };
  lastSync: string;
  created: string;
  modified: string;
}

/**
 * Manager for Google Drive appdata operations with restricted scope
 */
export class GoogleDriveAppDataManager {
  private static readonly API_BASE = "https://www.googleapis.com";
  private static readonly DRIVE_API = `${GoogleDriveAppDataManager.API_BASE}/drive/v3`;
  private static readonly UPLOAD_API = `${GoogleDriveAppDataManager.API_BASE}/upload/drive/v3`;

  // Allowed appdata files
  private static readonly ALLOWED_FILES = {
    USER_CONFIG: "puffpuffpaste-config.json",
    PRIORITY_ZERO_STORE: "priority-0-snippets.json",
    // Legacy support
    USER_PREFERENCES: "puffpuffpaste-preferences.json",
  };

  /**
   * Upload file to Google Drive appdata folder
   */
  static async uploadToAppData(
    credentials: CloudCredentials,
    fileName: string,
    content: string,
  ): Promise<void> {
    this.validateFileName(fileName);

    console.log(`📤 Uploading ${fileName} to Drive appdata`);

    try {
      // Check if file already exists in appdata
      const existingFileId = await this.findFileInAppData(
        credentials,
        fileName,
      );

      if (existingFileId) {
        // Update existing file
        await this.updateAppDataFile(credentials, existingFileId, content);
        console.log(`✅ Updated ${fileName} in appdata`);
      } else {
        // Create new file
        await this.createAppDataFile(credentials, fileName, content);
        console.log(`✅ Created ${fileName} in appdata`);
      }
    } catch (error) {
      console.error(`❌ Failed to upload ${fileName} to appdata:`, error);
      throw new Error(
        `Failed to upload ${fileName} to appdata: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Download file from Google Drive appdata folder
   */
  static async downloadFromAppData(
    credentials: CloudCredentials,
    fileName: string,
  ): Promise<string> {
    this.validateFileName(fileName);

    console.log(`📥 Downloading ${fileName} from Drive appdata`);

    try {
      const fileId = await this.findFileInAppData(credentials, fileName);

      if (!fileId) {
        throw new Error(`File ${fileName} not found in appdata`);
      }

      const content = await this.getAppDataFileContent(credentials, fileId);
      console.log(
        `✅ Downloaded ${fileName} from appdata (${content.length} bytes)`,
      );
      return content;
    } catch (error) {
      console.error(`❌ Failed to download ${fileName} from appdata:`, error);
      throw error;
    }
  }

  /**
   * List files in appdata folder
   */
  static async listAppDataFiles(
    credentials: CloudCredentials,
  ): Promise<AppDataFile[]> {
    console.log("📋 Listing appdata files");

    try {
      const url = `${this.DRIVE_API}/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)`;

      const response = await fetch(url, {
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      });

      if (!response.ok) {
        throw new Error(`Failed to list appdata files: ${response.statusText}`);
      }

      const data = await response.json();
      const files: AppDataFile[] = [];

      for (const file of data.files || []) {
        try {
          const content = await this.getAppDataFileContent(
            credentials,
            file.id,
          );
          files.push({
            name: file.name,
            content,
            lastModified: file.modifiedTime,
          });
        } catch (error) {
          console.warn(`⚠️ Could not read content of ${file.name}:`, error);
        }
      }

      console.log(`✅ Found ${files.length} appdata files`);
      return files;
    } catch (error) {
      console.error("❌ Failed to list appdata files:", error);
      throw error;
    }
  }

  /**
   * Store user configuration in appdata
   */
  static async storeUserConfiguration(
    credentials: CloudCredentials,
    config: UserConfiguration,
  ): Promise<void> {
    const content = JSON.stringify(config, null, 2);
    await this.uploadToAppData(
      credentials,
      this.ALLOWED_FILES.USER_CONFIG,
      content,
    );
  }

  /**
   * Retrieve user configuration from appdata
   */
  static async getUserConfiguration(
    credentials: CloudCredentials,
  ): Promise<UserConfiguration | null> {
    try {
      const content = await this.downloadFromAppData(
        credentials,
        this.ALLOWED_FILES.USER_CONFIG,
      );
      return JSON.parse(content) as UserConfiguration;
    } catch (error) {
      console.log("📭 No user configuration found in appdata");
      return null;
    }
  }

  /**
   * Store Priority #0 snippet store in appdata
   */
  static async storePriorityZeroSnippets(
    credentials: CloudCredentials,
    snippetStore: TierStorageSchema,
  ): Promise<void> {
    const content = JSON.stringify(snippetStore, null, 2);
    await this.uploadToAppData(
      credentials,
      this.ALLOWED_FILES.PRIORITY_ZERO_STORE,
      content,
    );
  }

  /**
   * Retrieve Priority #0 snippet store from appdata
   */
  static async getPriorityZeroSnippets(
    credentials: CloudCredentials,
  ): Promise<TierStorageSchema | null> {
    try {
      const content = await this.downloadFromAppData(
        credentials,
        this.ALLOWED_FILES.PRIORITY_ZERO_STORE,
      );
      return JSON.parse(content) as TierStorageSchema;
    } catch (error) {
      console.log("📭 No Priority #0 snippets found in appdata");
      return null;
    }
  }

  /**
   * Migrate legacy preferences to new configuration format
   */
  static async migrateLegacyPreferences(
    credentials: CloudCredentials,
  ): Promise<void> {
    try {
      const legacyContent = await this.downloadFromAppData(
        credentials,
        this.ALLOWED_FILES.USER_PREFERENCES,
      );
      const legacyPrefs = JSON.parse(legacyContent);

      console.log(
        "🔄 Migrating legacy preferences to new configuration format",
      );

      const newConfig: UserConfiguration = {
        version: "1.0.0",
        settings: {
          triggerDelay: legacyPrefs.triggerDelay || 100,
          caseSensitive: legacyPrefs.caseSensitive || false,
          enableSharedSnippets: legacyPrefs.enableSharedSnippets || true,
          autoSync: legacyPrefs.autoSync || true,
          syncInterval: legacyPrefs.syncInterval || 300,
          showNotifications: legacyPrefs.showNotifications !== false,
        },
        preferredStores: {
          personalDefault: "personal.json",
          teamDefault: "team.json",
          orgDefault: "org.json",
        },
        driveFiles: {
          selectedFiles: [],
          permissions: {},
        },
        lastSync: new Date().toISOString(),
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };

      await this.storeUserConfiguration(credentials, newConfig);
      console.log("✅ Legacy preferences migrated successfully");
    } catch (error) {
      console.log("ℹ️ No legacy preferences to migrate");
    }
  }

  /**
   * Validate that filename is allowed in appdata
   */
  private static validateFileName(fileName: string): void {
    const allowedFiles = Object.values(this.ALLOWED_FILES);
    if (!allowedFiles.includes(fileName)) {
      throw new Error(
        `File ${fileName} is not allowed in appdata. Allowed files: ${allowedFiles.join(", ")}`,
      );
    }
  }

  /**
   * Find file in appdata folder by name
   */
  private static async findFileInAppData(
    credentials: CloudCredentials,
    fileName: string,
  ): Promise<string | null> {
    const query = `name='${fileName}'`;
    const url = `${this.DRIVE_API}/files?spaces=appDataFolder&q=${encodeURIComponent(query)}&fields=files(id)`;

    console.log(`🔍 Searching appdata for file: ${fileName}`);
    console.log(`🔍 Request URL: ${url}`);

    const response = await fetch(url, {
      headers: GoogleDriveAuthService.getAuthHeaders(credentials),
    });

    console.log(
      `🔍 Response status: ${response.status} ${response.statusText}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ Failed to search appdata: ${response.status} ${response.statusText}`,
      );
      console.error(`❌ Error response body: ${errorText}`);
      throw new Error(
        `Failed to search appdata: ${response.statusText} - ${errorText}`,
      );
    }

    const data = await response.json();
    const files = data.files || [];

    console.log(`✅ Found ${files.length} files matching query`);
    return files.length > 0 ? files[0].id : null;
  }

  /**
   * Create new file in appdata folder
   */
  private static async createAppDataFile(
    credentials: CloudCredentials,
    fileName: string,
    content: string,
  ): Promise<void> {
    const metadata = {
      name: fileName,
      parents: ["appDataFolder"],
    };

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    form.append("media", new Blob([content], { type: "application/json" }));

    const response = await fetch(
      `${this.UPLOAD_API}/files?uploadType=multipart`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        body: form,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create appdata file: ${response.statusText} - ${errorText}`,
      );
    }
  }

  /**
   * Update existing file in appdata folder
   */
  private static async updateAppDataFile(
    credentials: CloudCredentials,
    fileId: string,
    content: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.UPLOAD_API}/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: content,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update appdata file: ${response.statusText} - ${errorText}`,
      );
    }
  }

  /**
   * Get file content from appdata folder
   */
  private static async getAppDataFileContent(
    credentials: CloudCredentials,
    fileId: string,
  ): Promise<string> {
    const response = await fetch(
      `${this.DRIVE_API}/files/${fileId}?alt=media`,
      {
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to download appdata file content: ${response.statusText}`,
      );
    }

    return await response.text();
  }

  /**
   * Delete file from appdata folder
   */
  static async deleteFromAppData(
    credentials: CloudCredentials,
    fileName: string,
  ): Promise<void> {
    this.validateFileName(fileName);

    console.log(`🗑️ Deleting ${fileName} from Drive appdata`);

    try {
      const fileId = await this.findFileInAppData(credentials, fileName);

      if (!fileId) {
        console.log(
          `ℹ️ File ${fileName} not found in appdata, nothing to delete`,
        );
        return;
      }

      const response = await fetch(`${this.DRIVE_API}/files/${fileId}`, {
        method: "DELETE",
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to delete appdata file: ${response.statusText}`,
        );
      }

      console.log(`✅ Deleted ${fileName} from appdata`);
    } catch (error) {
      console.error(`❌ Failed to delete ${fileName} from appdata:`, error);
      throw error;
    }
  }

  /**
   * Create default user configuration
   */
  static createDefaultUserConfiguration(): UserConfiguration {
    return {
      version: "1.0.0",
      settings: {
        triggerDelay: 100,
        caseSensitive: false,
        enableSharedSnippets: true,
        autoSync: true,
        syncInterval: 300,
        showNotifications: true,
      },
      preferredStores: {
        personalDefault: "personal.json",
        teamDefault: "team.json",
        orgDefault: "org.json",
      },
      driveFiles: {
        selectedFiles: [],
        permissions: {},
      },
      lastSync: new Date().toISOString(),
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    };
  }
}
