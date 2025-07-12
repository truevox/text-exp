/**
 * Google Drive File Service
 * Handles file upload, download, and management operations
 */

import type { CloudCredentials, TextSnippet } from "../../../shared/types.js";
import { SYNC_CONFIG } from "../../../shared/constants.js";
import { GoogleDriveAuthService } from "./auth-service.js";

export class GoogleDriveFileService {
  private static readonly API_BASE = "https://www.googleapis.com";
  private static readonly DRIVE_API = `${GoogleDriveFileService.API_BASE}/drive/v3`;
  private static readonly UPLOAD_API = `${GoogleDriveFileService.API_BASE}/upload/drive/v3`;

  /**
   * Find the snippets file in Google Drive
   */
  static async findSnippetsFile(
    credentials: CloudCredentials,
    folderId?: string,
  ): Promise<string | null> {
    let query = `name='${SYNC_CONFIG.FILE_NAME}'`;
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }

    console.log("🔍 Searching for snippets file:", { query, folderId });

    const url = `${this.DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
    console.log("🔍 Search URL:", url);

    const response = await fetch(url, {
      headers: GoogleDriveAuthService.getAuthHeaders(credentials),
    });

    console.log(
      "🔍 Search response status:",
      response.status,
      response.statusText,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🔍 Search error response:", errorText);
      throw new Error(`Failed to search files: ${response.statusText}`);
    }

    const data = await response.json();
    const files = data.files || [];

    console.log("🔍 Found files:", files);

    return files.length > 0 ? files[0].id : null;
  }

  /**
   * Create a new file in Google Drive
   */
  static async createFile(
    credentials: CloudCredentials,
    content: string,
    folderId?: string,
  ): Promise<string> {
    const metadata: any = {
      name: SYNC_CONFIG.FILE_NAME,
    };

    // Add parent folder if specified
    if (folderId) {
      metadata.parents = [folderId];
    }

    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" }),
    );
    form.append("file", new Blob([content], { type: "application/json" }));

    const response = await fetch(
      `${this.UPLOAD_API}/files?uploadType=multipart&fields=id`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        body: form,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Update an existing file in Google Drive
   */
  static async updateFile(
    credentials: CloudCredentials,
    fileId: string,
    content: string,
  ): Promise<void> {
    const response = await fetch(
      `${this.UPLOAD_API}/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          ...GoogleDriveAuthService.getAuthHeaders(credentials),
          "Content-Type": "application/json",
        },
        body: content,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to update file: ${response.statusText}`);
    }
  }

  /**
   * Download file content from Google Drive
   */
  static async downloadFile(
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
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * List all files in a folder with their metadata
   */
  static async listFiles(
    credentials: CloudCredentials,
    folderId?: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      mimeType?: string;
      modifiedTime?: string;
    }>
  > {
    const targetFolderId = folderId || "root";
    console.log(
      `📁 [ENHANCED] Listing files in Google Drive folder: ${targetFolderId}`,
    );

    // Enhanced logging for debugging
    const query = `parents in '${targetFolderId}' and mimeType!='application/vnd.google-apps.folder'`;
    const fields = `files(id,name,mimeType,modifiedTime)`;
    const orderBy = `name`;

    const url = `${this.DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=${orderBy}`;

    console.log(`🔍 [DEBUG] API Request Details:`);
    console.log(`  - URL: ${url}`);
    console.log(`  - Query: ${query}`);
    console.log(`  - Fields: ${fields}`);
    console.log(`  - Target Folder ID: ${targetFolderId}`);
    console.log(
      `  - Token starts with: ${credentials.accessToken.substring(0, 20)}...`,
    );

    const headers = GoogleDriveAuthService.getAuthHeaders(credentials);
    console.log(`  - Headers:`, Object.keys(headers));

    const response = await fetch(url, { headers });

    console.log(`🔍 [DEBUG] API Response Details:`);
    console.log(`  - Status: ${response.status} ${response.statusText}`);
    console.log(
      `  - Headers:`,
      response.headers?.entries
        ? Object.fromEntries(response.headers.entries())
        : "Headers not available",
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [ERROR] API Error Response:`, errorText);

      // Try to parse error for more details
      try {
        const errorData = JSON.parse(errorText);
        console.error(`❌ [ERROR] Parsed error:`, errorData);
      } catch (parseError) {
        console.error(`❌ [ERROR] Could not parse error response:`, parseError);
      }

      throw new Error(
        `Failed to list files: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const files = data.files || [];

    console.log(
      `📁 [ENHANCED] Found ${files.length} files in folder ${targetFolderId}:`,
    );
    if (files.length > 0) {
      console.log(
        `📋 [ENHANCED] File details:`,
        files.map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modifiedTime: f.modifiedTime,
        })),
      );
    } else {
      console.warn(
        `⚠️ [ENHANCED] No files found! This might indicate a permissions issue.`,
      );
      console.log(`🔍 [ENHANCED] Raw API response:`, data);
    }

    return files;
  }

  /**
   * Download file content by file ID
   */
  static async downloadFileContent(
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
        `Failed to download file content: ${response.statusText}`,
      );
    }

    return response.text();
  }

  /**
   * Upload snippets as JSON file
   */
  static async uploadSnippets(
    credentials: CloudCredentials,
    snippets: TextSnippet[],
    fileId?: string,
    folderId?: string,
  ): Promise<string> {
    // Sanitize snippets by removing any sensitive data
    const sanitizedSnippets = snippets.map((snippet) => ({
      ...snippet,
      // Remove any potential sensitive fields
      password: undefined,
      secret: undefined,
    }));

    const data = JSON.stringify(sanitizedSnippets, null, 2);

    if (fileId) {
      // Update existing file
      await this.updateFile(credentials, fileId, data);
      return fileId;
    } else {
      // Create new file
      return await this.createFile(credentials, data, folderId);
    }
  }

  /**
   * Direct API test function to verify Google Drive access
   */
  static async testDirectApiAccess(
    credentials: CloudCredentials,
    folderId?: string,
  ): Promise<{
    success: boolean;
    details: string;
    files?: Array<{ id: string; name: string; mimeType?: string }>;
  }> {
    console.log(
      `🧪 [TEST] Testing direct Google Drive API access for folder: ${folderId || "root"}`,
    );

    try {
      // Test 1: Basic API connectivity
      console.log(`🧪 [TEST] Step 1: Testing basic API connectivity...`);
      const aboutResponse = await fetch(`${this.DRIVE_API}/about?fields=user`, {
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      });

      if (!aboutResponse.ok) {
        return {
          success: false,
          details: `Basic API test failed: ${aboutResponse.status} ${aboutResponse.statusText}`,
        };
      }

      const aboutData = await aboutResponse.json();
      console.log(`✅ [TEST] Basic API test passed. User:`, aboutData.user);

      // Test 2: List files without mimeType filter
      console.log(
        `🧪 [TEST] Step 2: Testing file listing without mimeType filter...`,
      );
      const simpleQuery = folderId
        ? `parents in '${folderId}'`
        : `parents in 'root'`;
      const simpleUrl = `${this.DRIVE_API}/files?q=${encodeURIComponent(simpleQuery)}&fields=files(id,name,mimeType)`;

      const simpleResponse = await fetch(simpleUrl, {
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      });

      if (!simpleResponse.ok) {
        return {
          success: false,
          details: `Simple file listing failed: ${simpleResponse.status} ${simpleResponse.statusText}`,
        };
      }

      const simpleData = await simpleResponse.json();
      const allFiles = simpleData.files || [];
      console.log(
        `✅ [TEST] Simple file listing passed. Found ${allFiles.length} files:`,
        allFiles,
      );

      // Test 3: List files with mimeType filter (original query)
      console.log(
        `🧪 [TEST] Step 3: Testing file listing with mimeType filter...`,
      );
      const filteredQuery = folderId
        ? `parents in '${folderId}' and mimeType!='application/vnd.google-apps.folder'`
        : `parents in 'root' and mimeType!='application/vnd.google-apps.folder'`;
      const filteredUrl = `${this.DRIVE_API}/files?q=${encodeURIComponent(filteredQuery)}&fields=files(id,name,mimeType)`;

      const filteredResponse = await fetch(filteredUrl, {
        headers: GoogleDriveAuthService.getAuthHeaders(credentials),
      });

      if (!filteredResponse.ok) {
        return {
          success: false,
          details: `Filtered file listing failed: ${filteredResponse.status} ${filteredResponse.statusText}`,
        };
      }

      const filteredData = await filteredResponse.json();
      const filteredFiles = filteredData.files || [];
      console.log(
        `✅ [TEST] Filtered file listing passed. Found ${filteredFiles.length} files:`,
        filteredFiles,
      );

      // Test 4: Analyze JSON files specifically
      const jsonFiles = allFiles.filter((f: any) =>
        f.name.toLowerCase().endsWith(".json"),
      );
      console.log(
        `🧪 [TEST] Step 4: Found ${jsonFiles.length} JSON files:`,
        jsonFiles,
      );

      return {
        success: true,
        details: `Direct API test successful. Found ${allFiles.length} total files, ${filteredFiles.length} filtered files, ${jsonFiles.length} JSON files`,
        files: allFiles,
      };
    } catch (error) {
      console.error(`❌ [TEST] Direct API test failed:`, error);
      return {
        success: false,
        details: `Direct API test failed with error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Download and parse snippets from JSON file
   */
  static async downloadSnippets(
    credentials: CloudCredentials,
    folderId?: string,
  ): Promise<{ snippets: TextSnippet[]; fileId: string | null }> {
    console.log(
      `📥 GoogleDriveFileService.downloadSnippets called with folderId: ${folderId}`,
    );

    // Find the snippets file (optionally in a specific folder)
    const fileId = await this.findSnippetsFile(credentials, folderId);
    console.log(`🔍 Found fileId: ${fileId}`);

    if (!fileId) {
      console.log("⚠️ No snippets file found, returning empty array");
      return { snippets: [], fileId: null };
    }

    // Download file content
    console.log(`📋 Downloading file content for fileId: ${fileId}`);
    const content = await this.downloadFile(credentials, fileId);
    console.log(`📋 Downloaded content length: ${content.length}`);

    try {
      const snippets = JSON.parse(content) as TextSnippet[];
      console.log(
        `✅ Successfully parsed ${snippets.length} snippets from Google Drive`,
      );
      console.log(
        `📋 Parsed snippets:`,
        snippets.map((s) => ({
          trigger: s.trigger,
          content: s.content.substring(0, 50) + "...",
        })),
      );

      // CRITICAL: Check specifically for ;pony snippet
      const ponySnippet = snippets.find((s) => s.trigger === ";pony");
      if (ponySnippet) {
        console.log(
          `✅ [PONY-DEBUG] ;pony snippet found in Google Drive download:`,
          {
            trigger: ponySnippet.trigger,
            content: ponySnippet.content,
            id: ponySnippet.id,
          },
        );
      } else {
        console.warn(
          `❌ [PONY-DEBUG] ;pony snippet NOT found in Google Drive download`,
        );
        console.warn(
          `🔍 [PONY-DEBUG] Available triggers from Google Drive:`,
          snippets.map((s) => s.trigger),
        );
      }

      // Ensure date fields are properly parsed
      const processedSnippets = snippets.map((snippet) => ({
        ...snippet,
        createdAt: new Date(snippet.createdAt),
        updatedAt: new Date(snippet.updatedAt),
      }));

      return { snippets: processedSnippets, fileId };
    } catch (error) {
      console.error("Failed to parse snippets file:", error);
      console.error("File content:", content);
      return { snippets: [], fileId };
    }
  }
}
