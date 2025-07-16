/**
 * Google Drive File Picker Service
 * Handles file selection and creation with drive.file scope restrictions
 *
 * SCOPE COMPLIANCE:
 * - Only works with drive.file scope (no full drive access)
 * - Can only access files user explicitly selects or we create
 * - Cannot browse folders or list all files
 */

import type { CloudCredentials } from "../../../shared/types.js";
import { GoogleDriveAuthService } from "./auth-service.js";

export interface DriveFileSelection {
  fileId: string;
  fileName: string;
  isNewFile: boolean;
  permissions: "read" | "write";
}

export interface CreateFileOptions {
  name: string;
  content?: string;
  mimeType?: string;
  parentId?: string;
}

/**
 * Service for file picker operations within drive.file scope
 */
export class GoogleDriveFilePickerService {
  private static readonly API_BASE = "https://www.googleapis.com";
  private static readonly DRIVE_API = `${GoogleDriveFilePickerService.API_BASE}/drive/v3`;
  private static readonly UPLOAD_API = `${GoogleDriveFilePickerService.API_BASE}/upload/drive/v3`;

  /**
   * Create a new JSON file for snippet storage
   * This works with drive.file scope because we're creating the file
   */
  static async createSnippetStoreFile(
    credentials: CloudCredentials,
    options: CreateFileOptions,
  ): Promise<DriveFileSelection> {
    console.log(`📝 Creating new snippet store file: ${options.name}`);

    try {
      const metadata = {
        name: options.name,
        mimeType: options.mimeType || "application/json",
        ...(options.parentId && { parents: [options.parentId] }),
      };

      const content =
        options.content ||
        JSON.stringify(
          {
            tier: options.name.replace(".json", ""),
            version: "1.0.0",
            snippets: [],
            lastModified: new Date().toISOString(),
            created: new Date().toISOString(),
          },
          null,
          2,
        );

      // Create file with content
      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" }),
      );
      form.append("media", new Blob([content], { type: "application/json" }));

      const response = await fetch(
        `${this.UPLOAD_API}/files?uploadType=multipart&fields=id,name`,
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
          `Failed to create file: ${response.statusText} - ${errorText}`,
        );
      }

      const data = await response.json();

      console.log(`✅ Created snippet store file: ${data.name} (${data.id})`);

      return {
        fileId: data.id,
        fileName: data.name,
        isNewFile: true,
        permissions: "write",
      };
    } catch (error) {
      console.error(`❌ Failed to create snippet store file:`, error);
      throw error;
    }
  }

  /**
   * Get file information for a specific file ID
   * This works with drive.file scope for files we have access to
   */
  static async getFileInfo(
    credentials: CloudCredentials,
    fileId: string,
  ): Promise<{
    id: string;
    name: string;
    mimeType?: string;
    permissions: string[];
  }> {
    console.log(`📋 Getting file info for: ${fileId}`);

    try {
      const response = await fetch(
        `${this.DRIVE_API}/files/${fileId}?fields=id,name,mimeType,permissions`,
        {
          headers: GoogleDriveAuthService.getAuthHeaders(credentials),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }

      const data = await response.json();

      // Determine permissions based on what we can do with the file
      const permissions: string[] = [];
      if (data.permissions) {
        permissions.push(...data.permissions.map((p: any) => p.role));
      }

      console.log(`✅ Got file info: ${data.name} (${data.id})`);

      return {
        id: data.id,
        name: data.name,
        mimeType: data.mimeType,
        permissions,
      };
    } catch (error) {
      console.error(`❌ Failed to get file info:`, error);
      throw error;
    }
  }

  /**
   * Check if we can write to a specific file
   * This works with drive.file scope for files we have access to
   */
  static async canWriteToFile(
    credentials: CloudCredentials,
    fileId: string,
  ): Promise<boolean> {
    try {
      const fileInfo = await this.getFileInfo(credentials, fileId);
      return (
        fileInfo.permissions.includes("owner") ||
        fileInfo.permissions.includes("writer")
      );
    } catch (error) {
      console.warn(
        `⚠️ Cannot determine write permissions for file ${fileId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Validate that a file is suitable for snippet storage
   */
  static async validateSnippetStoreFile(
    credentials: CloudCredentials,
    fileId: string,
  ): Promise<{ isValid: boolean; reason?: string; canWrite: boolean }> {
    try {
      const fileInfo = await this.getFileInfo(credentials, fileId);

      // Check if it's a JSON file
      if (
        fileInfo.mimeType !== "application/json" &&
        !fileInfo.name.endsWith(".json")
      ) {
        return {
          isValid: false,
          reason: "File must be a JSON file",
          canWrite: false,
        };
      }

      // Check if we can write to it
      const canWrite = await this.canWriteToFile(credentials, fileId);

      return {
        isValid: true,
        canWrite,
      };
    } catch (error) {
      console.error(`❌ Failed to validate snippet store file:`, error);
      return {
        isValid: false,
        reason: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        canWrite: false,
      };
    }
  }

  /**
   * Create a default set of snippet store files
   */
  static async createDefaultSnippetStores(
    credentials: CloudCredentials,
  ): Promise<DriveFileSelection[]> {
    console.log("📝 Creating default snippet store files");

    const defaultStores = [
      { name: "personal.json", tier: "personal" },
      { name: "team.json", tier: "team" },
      { name: "org.json", tier: "org" },
    ];

    const createdFiles: DriveFileSelection[] = [];

    for (const store of defaultStores) {
      try {
        const file = await this.createSnippetStoreFile(credentials, {
          name: store.name,
          content: JSON.stringify(
            {
              tier: store.tier,
              version: "1.0.0",
              snippets: [],
              lastModified: new Date().toISOString(),
              created: new Date().toISOString(),
              description: `${store.tier.charAt(0).toUpperCase() + store.tier.slice(1)} snippet store`,
            },
            null,
            2,
          ),
        });

        createdFiles.push(file);
        console.log(`✅ Created default store: ${store.name}`);
      } catch (error) {
        console.error(
          `❌ Failed to create default store ${store.name}:`,
          error,
        );
        // Continue creating other stores even if one fails
      }
    }

    console.log(`✅ Created ${createdFiles.length} default snippet stores`);
    return createdFiles;
  }

  /**
   * Test if we can access a file with current permissions
   */
  static async testFileAccess(
    credentials: CloudCredentials,
    fileId: string,
  ): Promise<{ canRead: boolean; canWrite: boolean; error?: string }> {
    try {
      // Try to read the file
      const readResponse = await fetch(
        `${this.DRIVE_API}/files/${fileId}?alt=media`,
        {
          headers: GoogleDriveAuthService.getAuthHeaders(credentials),
        },
      );

      const canRead = readResponse.ok;

      // Try to get file metadata (this also tests read access)
      const metadataResponse = await fetch(
        `${this.DRIVE_API}/files/${fileId}?fields=id,name,mimeType`,
        {
          headers: GoogleDriveAuthService.getAuthHeaders(credentials),
        },
      );

      const canWrite = await this.canWriteToFile(credentials, fileId);

      return {
        canRead: canRead && metadataResponse.ok,
        canWrite,
        error: !canRead
          ? `Cannot read file: ${readResponse.statusText}`
          : undefined,
      };
    } catch (error) {
      return {
        canRead: false,
        canWrite: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get human-readable file picker instructions
   */
  static getFilePickerInstructions(): string {
    return `
To select snippet stores:
1. Choose existing JSON files from your Drive, or
2. Create new JSON files for your snippets
3. We can only access files you specifically select or create
4. Files must be JSON format (.json extension)
5. You can select multiple files for different snippet tiers

We respect your privacy - we can only access files you explicitly give us permission to use.
    `.trim();
  }

  /**
   * Create a snippet store file with proper structure
   */
  static async createStructuredSnippetStore(
    credentials: CloudCredentials,
    tierName: string,
    description?: string,
  ): Promise<DriveFileSelection> {
    const fileName = `${tierName}.json`;

    const storeContent = {
      tier: tierName,
      version: "1.0.0",
      description: description || `${tierName} snippet store`,
      snippets: [],
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        totalSnippets: 0,
        lastUsed: null,
      },
      settings: {
        allowDuplicates: false,
        sortOrder: "priority",
        defaultPriority: 1,
      },
    };

    return await this.createSnippetStoreFile(credentials, {
      name: fileName,
      content: JSON.stringify(storeContent, null, 2),
    });
  }
}
