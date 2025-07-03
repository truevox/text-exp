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
      const authUrl = this.buildAuthUrl();
      console.log('🔐 Google Drive auth URL:', authUrl);
      
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error('🚫 OAuth error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!redirectUrl) {
          console.error('🚫 No redirect URL received');
          reject(new Error('Authentication cancelled'));
          return;
        }
        
        console.log('✅ OAuth redirect URL received:', redirectUrl);
        
        try {
          const credentials = this.parseAuthResponse(redirectUrl);
          console.log('✅ OAuth credentials parsed successfully');
          resolve(credentials);
        } catch (error) {
          console.error('🚫 Failed to parse OAuth response:', error);
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
  async downloadSnippets(folderId?: string): Promise<TextSnippet[]> {
    return this.retryOperation(async () => {
      // Find the snippets file (optionally in a specific folder)
      if (!this.fileId) {
        this.fileId = await this.findSnippetsFile(folderId);
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
   * Select a folder for storing snippets
   */
  async selectFolder(): Promise<{ folderId: string; folderName: string }> {
    try {
      console.log('📁 Fetching Google Drive folders...');
      
      // Check if we have valid credentials
      const authHeaders = this.getAuthHeaders();
      console.log('🔑 Auth headers:', authHeaders);
      
      // Get list of folders from Google Drive
      const response = await fetch(
        `${GoogleDriveAdapter.DRIVE_API}/files?q=mimeType='application/vnd.google-apps.folder'&fields=files(id,name)&orderBy=name`,
        { headers: authHeaders }
      );
      
      console.log('📁 Folders API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📁 Folders API error response:', errorText);
        throw new Error(`Failed to fetch folders: ${response.statusText}`);
      }
      
      const data = await response.json();
      const folders = data.files || [];
      console.log('📁 Found folders:', folders.length);
      
      if (folders.length === 0) {
        // Create a default folder
        const defaultFolder = await this.createFolder('PuffPuffPaste Snippets');
        return { folderId: defaultFolder.id, folderName: defaultFolder.name };
      }
      
      // For now, return the first folder found
      // TODO: Implement proper folder selection UI
      const selectedFolder = folders[0];
      return { folderId: selectedFolder.id, folderName: selectedFolder.name };
      
    } catch (error) {
      console.error('Failed to select Google Drive folder:', error);
      throw error;
    }
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
    // Get client ID from manifest.json oauth2 configuration
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id || '';
    const redirectUri = chrome.identity.getRedirectURL();
    
    console.log('🔧 OAuth configuration:', {
      clientId,
      redirectUri,
      authUrl: CLOUD_PROVIDERS['google-drive'].authUrl,
      scopes: CLOUD_PROVIDERS['google-drive'].scopes
    });
    
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'token',
      scope: CLOUD_PROVIDERS['google-drive'].scopes.join(' '),
      redirect_uri: redirectUri
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
  private async findSnippetsFile(folderId?: string): Promise<string | null> {
    let query = `name='${SYNC_CONFIG.FILE_NAME}'`;
    if (folderId) {
      query += ` and '${folderId}' in parents`;
    }
    
    const response = await fetch(
      `${GoogleDriveAdapter.DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
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

  /**
   * Create a new folder in Google Drive
   */
  private async createFolder(name: string): Promise<{ id: string; name: string }> {
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    const response = await fetch(
      `${GoogleDriveAdapter.DRIVE_API}/files?fields=id,name`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(metadata)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }
    
    return response.json();
  }
}