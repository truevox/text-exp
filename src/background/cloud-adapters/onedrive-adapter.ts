/**
 * OneDrive CloudAdapter implementation
 * Handles synchronization with Microsoft OneDrive storage
 */

import { BaseCloudAdapter } from "./base-adapter.js";
import type { CloudCredentials, TextSnippet } from "../../shared/types.js";
import { SYNC_CONFIG, CLOUD_PROVIDERS } from "../../shared/constants.js";

/**
 * OneDrive adapter for cloud synchronization
 */
export class OneDriveAdapter extends BaseCloudAdapter {
  readonly provider = "onedrive" as const;

  private static readonly API_BASE = "https://graph.microsoft.com/v1.0";
  private static readonly AUTH_BASE =
    "https://login.microsoftonline.com/common/oauth2/v2.0";

  private fileId: string | null = null;

  /**
   * Authenticate with OneDrive
   */
  async authenticate(): Promise<CloudCredentials> {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: this.buildAuthUrl(),
          interactive: true,
        },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!redirectUrl) {
            reject(new Error("Authentication cancelled"));
            return;
          }

          try {
            const credentials = this.parseAuthResponse(redirectUrl);
            resolve(credentials);
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  }

  /**
   * Upload snippets to OneDrive
   */
  async uploadSnippets(snippets: TextSnippet[]): Promise<void> {
    const sanitizedSnippets = this.sanitizeSnippets(snippets);
    const data = JSON.stringify(sanitizedSnippets, null, 2);

    await this.retryOperation(async () => {
      if (this.fileId) {
        // Update existing file
        await this.updateFile(this.fileId, data);
      } else {
        // Create new file
        this.fileId = await this.createFile(data);
      }
    });
  }

  /**
   * Download snippets from OneDrive
   */
  async downloadSnippets(): Promise<TextSnippet[]> {
    return this.retryOperation(async () => {
      // Find the snippets file
      if (!this.fileId) {
        this.fileId = await this.findSnippetsFile();
      }

      if (!this.fileId) {
        return []; // No file exists yet
      }

      // Download file content
      const content = await this.downloadFile(this.fileId);

      try {
        const snippets = JSON.parse(content) as TextSnippet[];
        return snippets.map((snippet) => ({
          ...snippet,
          createdAt: new Date(snippet.createdAt),
          updatedAt: new Date(snippet.updatedAt),
        }));
      } catch (error) {
        console.error("Failed to parse snippets file:", error);
        return [];
      }
    });
  }

  /**
   * Delete snippets from OneDrive
   */
  async deleteSnippets(snippetIds: string[]): Promise<void> {
    // For OneDrive, we re-upload the file without the deleted snippets
    const currentSnippets = await this.downloadSnippets();
    const filteredSnippets = currentSnippets.filter(
      (snippet) => !snippetIds.includes(snippet.id),
    );

    await this.uploadSnippets(filteredSnippets);
  }

  /**
   * Validate stored credentials
   */
  protected async validateCredentials(): Promise<boolean> {
    if (!this.credentials?.accessToken) {
      return false;
    }

    try {
      const response = await fetch(`${OneDriveAdapter.API_BASE}/me`, {
        headers: this.getAuthHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check network connectivity to OneDrive
   */
  protected async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${OneDriveAdapter.API_BASE}/me/drive`, {
        headers: this.getAuthHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get the last sync timestamp
   */
  protected async getLastSyncTime(): Promise<Date | null> {
    // This would typically be stored in extension storage
    return null;
  }

  /**
   * Check if there are local changes to sync
   */
  protected async hasLocalChanges(): Promise<boolean> {
    // This would compare local storage timestamp with last sync
    return true;
  }

  /**
   * Build Microsoft OAuth URL
   */
  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.ONEDRIVE_CLIENT_ID || "",
      response_type: "token",
      scope: CLOUD_PROVIDERS.onedrive.scopes.join(" "),
      redirect_uri: chrome.identity.getRedirectURL(),
    });

    return `${OneDriveAdapter.AUTH_BASE}/authorize?${params.toString()}`;
  }

  /**
   * Parse authentication response
   */
  private parseAuthResponse(redirectUrl: string): CloudCredentials {
    const url = new URL(redirectUrl);
    const fragment = url.hash.substring(1);
    const params = new URLSearchParams(fragment);

    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");

    if (!accessToken) {
      throw new Error("No access token received");
    }

    return {
      provider: this.provider,
      accessToken,
      expiresAt: expiresIn
        ? new Date(Date.now() + parseInt(expiresIn) * 1000)
        : undefined,
    };
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.credentials?.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Find the snippets file in OneDrive
   */
  private async findSnippetsFile(): Promise<string | null> {
    const encodedFileName = encodeURIComponent(SYNC_CONFIG.FILE_NAME);
    const response = await fetch(
      `${OneDriveAdapter.API_BASE}/me/drive/root:/${encodedFileName}`,
      { headers: this.getAuthHeaders() },
    );

    if (response.status === 404) {
      return null; // File not found
    }

    if (!response.ok) {
      throw new Error(`Failed to find file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Create a new file in OneDrive
   */
  private async createFile(content: string): Promise<string> {
    const encodedFileName = encodeURIComponent(SYNC_CONFIG.FILE_NAME);
    const response = await fetch(
      `${OneDriveAdapter.API_BASE}/me/drive/root:/${encodedFileName}:/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.credentials?.accessToken}`,
          "Content-Type": "application/json",
        },
        body: content,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to create file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Update an existing file in OneDrive
   */
  private async updateFile(fileId: string, content: string): Promise<void> {
    const response = await fetch(
      `${OneDriveAdapter.API_BASE}/me/drive/items/${fileId}/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.credentials?.accessToken}`,
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
   * Download file content from OneDrive
   */
  private async downloadFile(fileId: string): Promise<string> {
    const response = await fetch(
      `${OneDriveAdapter.API_BASE}/me/drive/items/${fileId}/content`,
      { headers: this.getAuthHeaders() },
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Get file metadata from OneDrive
   */
  private async getFileMetadata(fileId: string): Promise<any> {
    const response = await fetch(
      `${OneDriveAdapter.API_BASE}/me/drive/items/${fileId}`,
      { headers: this.getAuthHeaders() },
    );

    if (!response.ok) {
      throw new Error(`Failed to get file metadata: ${response.statusText}`);
    }

    return response.json();
  }
}
