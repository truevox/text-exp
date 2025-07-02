/**
 * Google Drive API Client
 * Handles file operations for snippet synchronization
 */

import { AuthManager } from './auth-manager.js';
import { SYNC_CONFIG } from '../shared/constants.js';
import type { TextSnippet } from '../shared/types.js';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string;
}

export interface SyncResult {
  success: boolean;
  snippets?: TextSnippet[];
  error?: string;
  lastModified?: string;
}

/**
 * Google Drive API client for snippet synchronization
 */
export class DriveClient {
  private static readonly MIME_TYPE = 'application/json';
  private static readonly FOLDER_NAME = 'Text Expander Snippets';
  private static readonly FILE_NAME = SYNC_CONFIG.FILE_NAME;
  
  /**
   * Upload snippets to Google Drive
   */
  static async uploadSnippets(snippets: TextSnippet[]): Promise<SyncResult> {
    try {
      console.log('📤 Uploading snippets to Google Drive...');
      
      const accessToken = await AuthManager.ensureValidToken();
      if (!accessToken) {
        return { success: false, error: 'Not authenticated with Google Drive' };
      }
      
      // Prepare snippet data
      const snippetData = {
        snippets,
        lastModified: new Date().toISOString(),
        version: '1.0',
        source: 'collaborative-text-expander'
      };
      
      // Check if file already exists
      const existingFile = await this.findSnippetFile(accessToken);
      
      let result: Response;
      if (existingFile) {
        // Update existing file
        result = await this.updateFile(accessToken, existingFile.id, snippetData);
      } else {
        // Create new file
        result = await this.createFile(accessToken, snippetData);
      }
      
      if (!result.ok) {
        const errorData = await result.json();
        throw new Error(`Drive API error: ${errorData.error?.message || result.statusText}`);
      }
      
      const fileData = await result.json();
      
      console.log(`✅ Snippets uploaded successfully (${snippets.length} snippets)`);
      return { 
        success: true, 
        snippets,
        lastModified: fileData.modifiedTime 
      };
      
    } catch (error) {
      console.error('❌ Failed to upload snippets:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }
  
  /**
   * Download snippets from Google Drive
   */
  static async downloadSnippets(): Promise<SyncResult> {
    try {
      console.log('📥 Downloading snippets from Google Drive...');
      
      const accessToken = await AuthManager.ensureValidToken();
      if (!accessToken) {
        return { success: false, error: 'Not authenticated with Google Drive' };
      }
      
      // Find the snippet file
      const snippetFile = await this.findSnippetFile(accessToken);
      if (!snippetFile) {
        console.log('📝 No snippet file found, starting with empty collection');
        return { success: true, snippets: [] };
      }
      
      // Download file content
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${snippetFile.id}?alt=media`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      const fileContent = await response.text();
      const data = JSON.parse(fileContent);
      
      // Validate file structure
      if (!data.snippets || !Array.isArray(data.snippets)) {
        throw new Error('Invalid snippet file format');
      }
      
      console.log(`✅ Downloaded ${data.snippets.length} snippets from Google Drive`);
      return { 
        success: true, 
        snippets: data.snippets,
        lastModified: data.lastModified || snippetFile.modifiedTime
      };
      
    } catch (error) {
      console.error('❌ Failed to download snippets:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Download failed' 
      };
    }
  }
  
  /**
   * Find the snippet file in Google Drive
   */
  private static async findSnippetFile(accessToken: string): Promise<DriveFile | null> {
    try {
      const query = `name='${this.FILE_NAME}' and mimeType='${this.MIME_TYPE}' and trashed=false`;
      
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size)`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Drive API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        return data.files[0] as DriveFile;
      }
      
      return null;
      
    } catch (error) {
      console.error('Error finding snippet file:', error);
      return null;
    }
  }
  
  /**
   * Create a new snippet file
   */
  private static async createFile(accessToken: string, snippetData: any): Promise<Response> {
    const metadata = {
      name: this.FILE_NAME,
      mimeType: this.MIME_TYPE,
      description: 'Collaborative Text Expander snippets backup'
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(snippetData, null, 2)], { type: this.MIME_TYPE }));
    
    return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: form
    });
  }
  
  /**
   * Update an existing snippet file
   */
  private static async updateFile(accessToken: string, fileId: string, snippetData: any): Promise<Response> {
    const form = new FormData();
    form.append('file', new Blob([JSON.stringify(snippetData, null, 2)], { type: this.MIME_TYPE }));
    
    return fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: form
    });
  }
  
  /**
   * Get file metadata including last modified time
   */
  static async getFileMetadata(): Promise<{ lastModified?: string; size?: number } | null> {
    try {
      const accessToken = await AuthManager.ensureValidToken();
      if (!accessToken) {
        return null;
      }
      
      const snippetFile = await this.findSnippetFile(accessToken);
      if (!snippetFile) {
        return null;
      }
      
      return {
        lastModified: snippetFile.modifiedTime,
        size: parseInt(snippetFile.size)
      };
      
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }
  
  /**
   * Check if cloud file is newer than local data
   */
  static async isCloudNewer(localLastModified: string): Promise<boolean> {
    try {
      const metadata = await this.getFileMetadata();
      if (!metadata?.lastModified) {
        return false;
      }
      
      const cloudTime = new Date(metadata.lastModified).getTime();
      const localTime = new Date(localLastModified).getTime();
      
      return cloudTime > localTime;
      
    } catch (error) {
      console.error('Error comparing timestamps:', error);
      return false;
    }
  }
  
  /**
   * Test Drive API connection
   */
  static async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await AuthManager.ensureValidToken();
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' };
      }
      
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user,storageQuota', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        return { success: false, error: `API test failed: ${response.statusText}` };
      }
      
      const data = await response.json();
      console.log('✅ Drive API connection successful:', data.user?.emailAddress);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Drive API connection test failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed' 
      };
    }
  }
  
  /**
   * Delete the snippet file from Google Drive
   */
  static async deleteSnippetFile(): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await AuthManager.ensureValidToken();
      if (!accessToken) {
        return { success: false, error: 'Not authenticated' };
      }
      
      const snippetFile = await this.findSnippetFile(accessToken);
      if (!snippetFile) {
        return { success: true }; // File doesn't exist, consider it deleted
      }
      
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${snippetFile.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }
      
      console.log('✅ Snippet file deleted from Google Drive');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Failed to delete snippet file:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Delete failed' 
      };
    }
  }
}