/**
 * Google Drive Folder Service
 * Handles folder listing, creation, and selection operations
 */

import type { CloudCredentials } from "../../../shared/types.js";
import { GoogleDriveAuthService } from "./auth-service.js";

export class GoogleDriveFolderService {
  private static readonly API_BASE = "https://www.googleapis.com";
  private static readonly DRIVE_API = `${GoogleDriveFolderService.API_BASE}/drive/v3`;

  /**
   * Get list of available folders without selecting one
   */
  static async getFolders(
    credentials: CloudCredentials,
    parentId?: string,
  ): Promise<
    Array<{ id: string; name: string; parentId?: string; isFolder: boolean }>
  > {
    try {
      console.log(
        "📁 Fetching Google Drive folders for picker...",
        parentId ? `in parent: ${parentId}` : "root",
      );

      // Check if we have valid credentials
      const authHeaders = GoogleDriveAuthService.getAuthHeaders(credentials);
      console.log("🔑 Auth headers:", authHeaders);

      // Build query for folders in specific parent or root
      let query = "mimeType='application/vnd.google-apps.folder'";
      if (parentId) {
        query += ` and '${parentId}' in parents`;
      } else {
        query += " and 'root' in parents";
      }

      // Get list of folders from Google Drive
      const response = await fetch(
        `${this.DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,parents)&orderBy=name`,
        { headers: authHeaders },
      );

      console.log(
        "📁 Folders API response status:",
        response.status,
        response.statusText,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("📁 Folders API error response:", errorText);
        throw new Error(`Failed to fetch folders: ${response.statusText}`);
      }

      const data = await response.json();
      const folders = data.files || [];

      console.log("📁 Found folders:", folders.length);

      // Transform to expected format
      return folders.map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parents?.[0],
        isFolder: true,
      }));
    } catch (error) {
      console.error("Failed to get Google Drive folders:", error);
      throw error;
    }
  }

  /**
   * Create a new folder in Google Drive
   */
  static async createFolder(
    credentials: CloudCredentials,
    name: string,
    parentId?: string,
  ): Promise<{ id: string; name: string }> {
    const metadata: any = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    };

    // Add parent folder if specified
    if (parentId && parentId !== "root") {
      metadata.parents = [parentId];
    }

    const response = await fetch(
      `${this.DRIVE_API}/files?fields=id,name`,
      {
        method: "POST",
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
        body: JSON.stringify(metadata),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Select folder for snippet storage (legacy method)
   */
  static async selectFolder(
    credentials: CloudCredentials,
  ): Promise<{ folderId: string; folderName: string }> {
    try {
      console.log("📁 Fetching Google Drive folders...");

      // Get list of folders from Google Drive
      const response = await fetch(
        `${this.DRIVE_API}/files?q=mimeType='application/vnd.google-apps.folder'&fields=files(id,name)&orderBy=name`,
        { headers: GoogleDriveAuthService.getAuthHeaders(credentials) },
      );

      console.log(
        "📁 Folders API response status:",
        response.status,
        response.statusText,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("📁 Folders API error response:", errorText);
        throw new Error(`Failed to fetch folders: ${response.statusText}`);
      }

      const data = await response.json();
      const folders = data.files || [];
      console.log("📁 Found folders:", folders.length);

      if (folders.length === 0) {
        // Create a default folder
        const defaultFolder = await this.createFolder(
          credentials,
          "PuffPuffPaste Snippets",
        );
        return { folderId: defaultFolder.id, folderName: defaultFolder.name };
      }

      // For now, return the first folder found
      // TODO: Implement proper folder selection UI
      const selectedFolder = folders[0];
      console.log("📁 Selected folder:", selectedFolder);
      console.log(
        "📁 Returning folder ID:",
        selectedFolder.id,
        "name:",
        selectedFolder.name,
      );
      return { folderId: selectedFolder.id, folderName: selectedFolder.name };
    } catch (error) {
      console.error("Failed to select Google Drive folder:", error);
      throw error;
    }
  }

  /**
   * Get folder information by ID
   */
  static async getFolderInfo(
    credentials: CloudCredentials,
    folderId: string,
  ): Promise<{ id: string; name: string; parentId?: string }> {
    const response = await fetch(
      `${this.DRIVE_API}/files/${folderId}?fields=id,name,parents`,
      {
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get folder info: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      parentId: data.parents?.[0],
    };
  }

  /**
   * List all folders (flat list)
   */
  static async listAllFolders(
    credentials: CloudCredentials,
  ): Promise<Array<{ id: string; name: string; parentId?: string }>> {
    const response = await fetch(
      `${this.DRIVE_API}/files?q=mimeType='application/vnd.google-apps.folder'&fields=files(id,name,parents)&orderBy=name`,
      {
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to list folders: ${response.statusText}`);
    }

    const data = await response.json();
    const folders = data.files || [];

    return folders.map((folder: any) => ({
      id: folder.id,
      name: folder.name,
      parentId: folder.parents?.[0],
    }));
  }
}