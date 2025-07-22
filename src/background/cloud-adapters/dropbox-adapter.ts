/*
 * ⚠️  NOT CURRENTLY SUPPORTED ⚠️
 *
 * This Dropbox adapter is NOT currently supported or tested.
 * Google Drive is the ONLY supported cloud provider for the near future.
 *
 * This code is preserved for potential future development but should
 * not be used in production. Any integration attempts will likely fail.
 */

/**
 * Dropbox CloudAdapter implementation
 * Handles synchronization with Dropbox storage
 */

import { BaseCloudAdapter } from "./base-adapter.js";
import type { CloudCredentials, TextSnippet } from "../../shared/types.js";
import { SYNC_CONFIG, CLOUD_PROVIDERS } from "../../shared/constants.js";

/**
 * Dropbox adapter for cloud synchronization
 */
export class DropboxAdapter extends BaseCloudAdapter {
  readonly provider = "dropbox" as const;

  private static readonly API_BASE = "https://api.dropboxapi.com/2";
  private static readonly CONTENT_API = "https://content.dropboxapi.com/2";

  /**
   * Authenticate with Dropbox
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
   * Upload snippets to Dropbox
   */
  async uploadSnippets(snippets: TextSnippet[]): Promise<void> {
    const sanitizedSnippets = this.sanitizeSnippets(snippets);
    const data = JSON.stringify(sanitizedSnippets, null, 2);

    await this.retryOperation(async () => {
      const response = await fetch(
        `${DropboxAdapter.CONTENT_API}/files/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.credentials?.accessToken}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
              path: `/${SYNC_CONFIG.FILE_NAME}`,
              mode: "overwrite",
              autorename: false,
            }),
          },
          body: data,
        },
      );

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          await this.handleRateLimit(
            retryAfter ? parseInt(retryAfter) : undefined,
          );
          throw new Error("Rate limited");
        }
        throw new Error(`Upload failed: ${response.statusText}`);
      }
    });
  }

  /**
   * Download snippets from Dropbox
   */
  async downloadSnippets(): Promise<TextSnippet[]> {
    return this.retryOperation(async () => {
      const response = await fetch(
        `${DropboxAdapter.CONTENT_API}/files/download`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.credentials?.accessToken}`,
            "Dropbox-API-Arg": JSON.stringify({
              path: `/${SYNC_CONFIG.FILE_NAME}`,
            }),
          },
        },
      );

      if (!response.ok) {
        if (response.status === 409) {
          // File not found - return empty array
          return [];
        }
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const content = await response.text();

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
   * Delete snippets from Dropbox
   */
  async deleteSnippets(snippetIds: string[]): Promise<void> {
    // For Dropbox, we re-upload the file without the deleted snippets
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
      const response = await fetch(
        `${DropboxAdapter.API_BASE}/users/get_current_account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.credentials.accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check network connectivity to Dropbox
   */
  protected async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(
        `${DropboxAdapter.API_BASE}/users/get_current_account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.credentials?.accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
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
   * Build Dropbox OAuth URL
   */
  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.DROPBOX_CLIENT_ID || "",
      response_type: "token",
      redirect_uri: chrome.identity.getRedirectURL(),
    });

    return `${CLOUD_PROVIDERS.dropbox.authUrl}?${params.toString()}`;
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
   * Get file metadata from Dropbox
   */
  private async getFileMetadata(): Promise<any> {
    const response = await fetch(
      `${DropboxAdapter.API_BASE}/files/get_metadata`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.credentials?.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: `/${SYNC_CONFIG.FILE_NAME}`,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 409) {
        return null; // File not found
      }
      throw new Error(`Failed to get file metadata: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if file exists in Dropbox
   */
  private async fileExists(): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata();
      return metadata !== null;
    } catch {
      return false;
    }
  }
}
