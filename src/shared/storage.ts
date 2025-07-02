/**
 * Chrome extension storage utilities
 * Handles local and sync storage operations with type safety
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';
import type { 
  TextSnippet, 
  ExtensionSettings, 
  SyncStatus, 
  CloudCredentials 
} from './types.js';

/**
 * Storage utility class for Chrome extension
 */
export class ExtensionStorage {
  /**
   * Get all snippets from storage
   */
  static async getSnippets(): Promise<TextSnippet[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SNIPPETS);
    return result[STORAGE_KEYS.SNIPPETS] || [];
  }

  /**
   * Save snippets to storage
   */
  static async setSnippets(snippets: TextSnippet[]): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SNIPPETS]: snippets
    });
  }

  /**
   * Add a new snippet
   */
  static async addSnippet(snippet: TextSnippet): Promise<void> {
    const snippets = await this.getSnippets();
    snippets.push(snippet);
    await this.setSnippets(snippets);
  }

  /**
   * Update an existing snippet
   */
  static async updateSnippet(id: string, updates: Partial<TextSnippet>): Promise<void> {
    const snippets = await this.getSnippets();
    const index = snippets.findIndex(s => s.id === id);
    
    if (index !== -1) {
      snippets[index] = { ...snippets[index], ...updates, updatedAt: new Date() };
      await this.setSnippets(snippets);
    }
  }

  /**
   * Delete a snippet
   */
  static async deleteSnippet(id: string): Promise<void> {
    const snippets = await this.getSnippets();
    const filtered = snippets.filter(s => s.id !== id);
    await this.setSnippets(filtered);
  }

  /**
   * Find snippet by trigger
   */
  static async findSnippetByTrigger(trigger: string): Promise<TextSnippet | null> {
    const snippets = await this.getSnippets();
    return snippets.find(s => s.trigger === trigger) || null;
  }

  /**
   * Get extension settings
   */
  static async getSettings(): Promise<ExtensionSettings> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  }

  /**
   * Save extension settings
   */
  static async setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const currentSettings = await this.getSettings();
    const newSettings = { ...currentSettings, ...settings };
    
    await chrome.storage.sync.set({
      [STORAGE_KEYS.SETTINGS]: newSettings
    });
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(): Promise<SyncStatus | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SYNC_STATUS);
    return result[STORAGE_KEYS.SYNC_STATUS] || null;
  }

  /**
   * Save sync status
   */
  static async setSyncStatus(status: SyncStatus): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SYNC_STATUS]: status
    });
  }

  /**
   * Get cloud credentials
   */
  static async getCloudCredentials(): Promise<CloudCredentials | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CLOUD_CREDENTIALS);
    return result[STORAGE_KEYS.CLOUD_CREDENTIALS] || null;
  }

  /**
   * Save cloud credentials
   */
  static async setCloudCredentials(credentials: CloudCredentials): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CLOUD_CREDENTIALS]: credentials
    });
  }

  /**
   * Clear cloud credentials
   */
  static async clearCloudCredentials(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.CLOUD_CREDENTIALS);
  }

  /**
   * Get last sync timestamp
   */
  static async getLastSync(): Promise<Date | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_SYNC);
    const timestamp = result[STORAGE_KEYS.LAST_SYNC];
    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Set last sync timestamp
   */
  static async setLastSync(date: Date): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LAST_SYNC]: date.toISOString()
    });
  }

  /**
   * Clear all extension data
   */
  static async clearAll(): Promise<void> {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageUsage(): Promise<{ local: number; sync: number }> {
    const localUsage = await chrome.storage.local.getBytesInUse();
    const syncUsage = await chrome.storage.sync.getBytesInUse();
    
    return {
      local: localUsage,
      sync: syncUsage
    };
  }

  /**
   * Export all data for backup
   */
  static async exportData(): Promise<string> {
    const snippets = await this.getSnippets();
    const settings = await this.getSettings();
    const syncStatus = await this.getSyncStatus();
    
    const exportData = {
      snippets,
      settings,
      syncStatus,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import data from backup
   */
  static async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.snippets) {
        await this.setSnippets(data.snippets);
      }
      
      if (data.settings) {
        await this.setSettings(data.settings);
      }
      
      if (data.syncStatus) {
        await this.setSyncStatus(data.syncStatus);
      }
    } catch (error) {
      throw new Error('Invalid backup data format');
    }
  }
}