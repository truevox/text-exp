/**
 * Google Drive CloudAdapter implementation
 * Handles synchronization with Google Drive storage
 */

import { BaseCloudAdapter } from './base-adapter.js';
import type { CloudCredentials, TextSnippet } from '../../shared/types.js';
import { SYNC_CONFIG, CLOUD_PROVIDERS } from '../../shared/constants.js';

/**
 * Google Drive adapter for cloud synchronization
 */
export class GoogleDriveAdapter extends BaseCloudAdapter {
  readonly provider = 'google-drive' as const;
  
  private static readonly API_BASE = 'https://www.googleapis.com';
  private static readonly DRIVE_API = `${GoogleDriveAdapter.API_BASE}/drive/v3`;
  private static readonly UPLOAD_API = `${GoogleDriveAdapter.API_BASE}/upload/drive/v3`;
  
  private fileId: string | null = null;

  /**
   * Authenticate with Google Drive
   */
  async authenticate(): Promise<CloudCredentials> {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: this.buildAuthUrl(),
        interactive: true
      }, (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!redirectUrl) {
          reject(new Error('Authentication cancelled'));
          return;
        }
        
        try {
          const credentials = this.parseAuthResponse(redirectUrl);
          resolve(credentials);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Upload snippets to Google Drive
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
   * Download snippets from Google Drive
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
        return snippets.map(snippet => ({
          ...snippet,
          createdAt: new Date(snippet.createdAt),
          updatedAt: new Date(snippet.updatedAt)
        }));
      } catch (error) {
        console.error('Failed to parse snippets file:', error);
        return [];
      }
    });
  }

  /**
   * Delete snippets from Google Drive
   */
  async deleteSnippets(snippetIds: string[]): Promise<void> {
    // For Google Drive, we re-upload the file without the deleted snippets
    const currentSnippets = await this.downloadSnippets();
    const filteredSnippets = currentSnippets.filter(
      snippet => !snippetIds.includes(snippet.id)
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
      const response = await fetch(`${GoogleDriveAdapter.API_BASE}/oauth2/v1/tokeninfo?access_token=${this.credentials.accessToken}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check network connectivity to Google Drive
   */
  protected async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${GoogleDriveAdapter.DRIVE_API}/about?fields=user`, {
        headers: this.getAuthHeaders()
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
   * Build Google OAuth URL
   */
  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      response_type: 'token',
      scope: CLOUD_PROVIDERS['google-drive'].scopes.join(' '),
      redirect_uri: chrome.identity.getRedirectURL()
    });
    
    return `${CLOUD_PROVIDERS['google-drive'].authUrl}?${params.toString()}`;
  }

  /**
   * Parse authentication response
   */
  private parseAuthResponse(redirectUrl: string): CloudCredentials {
    const url = new URL(redirectUrl);
    const fragment = url.hash.substring(1);
    const params = new URLSearchParams(fragment);
    
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    
    if (!accessToken) {
      throw new Error('No access token received');
    }
    
    return {
      provider: this.provider,
      accessToken,
      expiresAt: expiresIn ? new Date(Date.now() + parseInt(expiresIn) * 1000) : undefined
    };
  }

  /**
   * Get authorization headers
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.credentials?.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Find the snippets file in Google Drive
   */
  private async findSnippetsFile(): Promise<string | null> {
    const response = await fetch(
      `${GoogleDriveAdapter.DRIVE_API}/files?q=name='${SYNC_CONFIG.FILE_NAME}'&fields=files(id,name)`,
      { headers: this.getAuthHeaders() }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.statusText}`);
    }
    
    const data = await response.json();
    const files = data.files || [];
    
    return files.length > 0 ? files[0].id : null;
  }

  /**
   * Create a new file in Google Drive
   */
  private async createFile(content: string): Promise<string> {
    const metadata = {
      name: SYNC_CONFIG.FILE_NAME,
      parents: ['appDataFolder'] // Store in app-specific folder
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'application/json' }));
    
    const response = await fetch(
      `${GoogleDriveAdapter.UPLOAD_API}/files?uploadType=multipart&fields=id`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials?.accessToken}`
        },
        body: form
      }
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
  private async updateFile(fileId: string, content: string): Promise<void> {
    const response = await fetch(
      `${GoogleDriveAdapter.UPLOAD_API}/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.credentials?.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: content
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to update file: ${response.statusText}`);
    }
  }

  /**
   * Download file content from Google Drive
   */
  private async downloadFile(fileId: string): Promise<string> {
    const response = await fetch(
      `${GoogleDriveAdapter.DRIVE_API}/files/${fileId}?alt=media`,
      { headers: this.getAuthHeaders() }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    return response.text();
  }
}