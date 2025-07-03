/**
 * Sync Manager for Collaborative Text Expander
 * Orchestrates synchronization between local storage and cloud providers
 */

import { ExtensionStorage } from '../shared/storage.js';
import { IndexedDB } from '../shared/indexed-db.js';
import { getCloudAdapterFactory } from './cloud-adapters/index.js';
import { MultiScopeSyncManager } from './multi-scope-sync-manager.js';
import type { 
  CloudAdapter, 
  CloudProvider, 
  TextSnippet, 
  SyncStatus, 
  CloudCredentials,
  ExtensionSettings, 
  SyncedSource
} from '../shared/types.js';
import { DEFAULT_SETTINGS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../shared/constants.js';

/**
 * Manages synchronization between local and cloud storage
 */
export class SyncManager {
  private static instance: SyncManager;
  private currentAdapter: CloudAdapter | null = null; // Primary adapter, e.g., for personal snippets
  private multiScopeSyncManager: MultiScopeSyncManager;
  private indexedDB: IndexedDB;
  private syncInProgress = false;
  private syncInterval: number | null = null;

  private constructor() {
    this.multiScopeSyncManager = new MultiScopeSyncManager();
    this.indexedDB = new IndexedDB();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Initialize sync manager with current settings
   */
  async initialize(): Promise<void> {
    const settings = await ExtensionStorage.getSettings();
    await this.setCloudProvider(settings.cloudProvider);
    
    if (settings.autoSync) {
      this.startAutoSync(settings.syncInterval);
    }
  }

  /**
   * Set the active cloud provider
   */
  async setCloudProvider(provider: CloudProvider): Promise<void> {
    try {
      const factory = getCloudAdapterFactory();
      this.currentAdapter = factory.createAdapter(provider);
      
      // Try to initialize with stored credentials
      const credentials = await ExtensionStorage.getCloudCredentials();
      if (credentials && credentials.provider === provider) {
        await this.currentAdapter.initialize(credentials);
      }
    } catch (error) {
      console.error('Failed to set cloud provider:', error);
      throw error;
    }
  }

  /**
   * Authenticate with the current cloud provider
   */
  async authenticate(): Promise<CloudCredentials> {
    if (!this.currentAdapter) {
      throw new Error('No cloud provider configured');
    }

    try {
      const credentials = await this.currentAdapter.authenticate();
      await this.currentAdapter.initialize(credentials);
      await ExtensionStorage.setCloudCredentials(credentials);
      
      return credentials;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }
  }

  /**
   * Check if currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.currentAdapter) {
      // If no current adapter, consider it not authenticated for now.
      // In a multi-scope setup, we might check if any adapter is authenticated.
      return false;
    }
    
    return this.currentAdapter.isAuthenticated();
  }

  /**
   * Select a folder for a given scope
   */
  async selectFolder(provider: CloudProvider, scope: SnippetScope): Promise<{ folderId: string, folderName: string }> {
    if (!this.currentAdapter || this.currentAdapter.provider !== provider) {
      // Ensure the correct adapter is set before selecting a folder
      await this.setCloudProvider(provider);
    }

    if (!this.currentAdapter) {
      throw new Error('No cloud provider configured or initialized.');
    }

    if (!this.currentAdapter.selectFolder) {
      throw new Error(`Folder selection not supported for ${provider} provider.`);
    }

    try {
      const folderHandle = await this.currentAdapter.selectFolder();
      // For local-filesystem, folderHandle is FileSystemDirectoryHandle
      // For cloud providers, it would be an object with id and name
      if (provider === 'local-filesystem') {
        // Store the handle for future use
        // The selectFolder method of LocalFilesystemAdapter now returns serializable data
        await ExtensionStorage.setScopedSources([{
          name: scope,
          adapter: this.currentAdapter,
          folderId: folderHandle.folderId, 
          displayName: folderHandle.folderName,
          handleId: folderHandle.handleId,
          handleName: folderHandle.handleName,
        }]);
        return { folderId: folderHandle.folderId, folderName: folderHandle.folderName };
      } else {
        // Assuming cloud adapters return { id, name }
        return folderHandle; // This needs to be adjusted based on actual adapter return type
      }
    } catch (error) {
      console.error(`Failed to select folder for ${provider} (${scope}):`, error);
      throw error;
    }
  }

  /**
   * Perform manual sync
   */
  async syncNow(): Promise<void> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    let finalSyncStatus: SyncStatus; // Declare here to be accessible in finally

    try {
      // For now, hardcode sources. In the future, these will come from settings.
      const sources: SyncedSource[] = [];
      if (this.currentAdapter) {
        // Assuming currentAdapter is always the personal one for now
        sources.push({
          name: 'personal',
          adapter: this.currentAdapter,
          folderId: 'personal-folder-id', // Placeholder
          displayName: 'My Personal Snippets',
        });
      }

      // TODO: Add department and org sources based on user settings

      const mergedSnippets = await this.multiScopeSyncManager.syncAndMerge(sources);
      
      // Update local storage with merged results
      await ExtensionStorage.setSnippets(mergedSnippets);
      await this.indexedDB.saveSnippets(mergedSnippets); // Save to IndexedDB for offline access
      
      // Notify success
      await this.showNotification(SUCCESS_MESSAGES.SYNC_COMPLETED);
      
      // Update last sync time
      await ExtensionStorage.setLastSync(new Date());

      // Initialize final status as success
      finalSyncStatus = {
        provider: this.currentAdapter?.provider || 'local',
        lastSync: new Date(),
        isOnline: true,
        hasChanges: false
      };

    } catch (error) {
      console.error('Sync failed:', error);
      
      // Update final status to error
      finalSyncStatus = {
        provider: this.currentAdapter?.provider || 'local',
        lastSync: await ExtensionStorage.getLastSync(), // Keep previous last sync time on failure
        isOnline: false,
        hasChanges: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      throw error;
    } finally {
      await ExtensionStorage.setSyncStatus(finalSyncStatus); // Set status once
      this.syncInProgress = false;
    }
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus | null> {
    if (!this.currentAdapter) {
      return null;
    }
    
    try {
      return await this.currentAdapter.getSyncStatus();
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return await ExtensionStorage.getSyncStatus();
    }
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(intervalMinutes: number): void {
    this.stopAutoSync();
    
    const intervalMs = intervalMinutes * 60 * 1000;
    this.syncInterval = setInterval(() => {
      this.syncNow().catch(error => {
        console.error('Auto-sync failed:', error);
      });
    }, intervalMs);
    
    console.log(`Auto-sync started with ${intervalMinutes} minute interval`);
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
  }

  /**
   * Upload local snippets to cloud
   */
  async uploadSnippets(snippets?: TextSnippet[]): Promise<void> {
    if (!this.currentAdapter) {
      throw new Error('No cloud provider configured');
    }

    if (!await this.isAuthenticated()) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    const snippetsToUpload = snippets || await ExtensionStorage.getSnippets();
    await this.currentAdapter.uploadSnippets(snippetsToUpload);
  }

  /**
   * Download snippets from cloud
   */
  async downloadSnippets(): Promise<TextSnippet[]> {
    if (!this.currentAdapter) {
      throw new Error('No cloud provider configured');
    }

    if (!await this.isAuthenticated()) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    return this.currentAdapter.downloadSnippets();
  }

  /**
   * Delete snippets from cloud storage
   */
  async deleteSnippets(snippetIds: string[]): Promise<void> {
    if (!this.currentAdapter) {
      throw new Error('No cloud provider configured');
    }

    if (!await this.isAuthenticated()) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    await this.currentAdapter.deleteSnippets(snippetIds);
  }

  /**
   * Force sync from cloud (overwrite local)
   */
  async forceDownload(): Promise<void> {
    if (!this.currentAdapter) {
      throw new Error('No cloud provider configured');
    }

    if (!await this.isAuthenticated()) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    try {
      const cloudSnippets = await this.currentAdapter.downloadSnippets();
      await ExtensionStorage.setSnippets(cloudSnippets);
      
      await this.showNotification('Snippets downloaded from cloud');
    } catch (error) {
      console.error('Force download failed:', error);
      throw error;
    }
  }

  /**
   * Force sync to cloud (overwrite remote)
   */
  async forceUpload(): Promise<void> {
    if (!this.currentAdapter) {
      throw new Error('No cloud provider configured');
    }

    if (!await this.isAuthenticated()) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    try {
      const localSnippets = await ExtensionStorage.getSnippets();
      await this.currentAdapter.uploadSnippets(localSnippets);
      
      await this.showNotification('Snippets uploaded to cloud');
    } catch (error) {
      console.error('Force upload failed:', error);
      throw error;
    }
  }

  /**
   * Clear cloud credentials and reset sync
   */
  async disconnect(): Promise<void> {
    this.stopAutoSync();
    await ExtensionStorage.clearCloudCredentials();
    this.currentAdapter = null;
    
    // Reset to local storage
    await this.setCloudProvider('local');
  }

  /**
   * Handle settings changes
   */
  async onSettingsChanged(newSettings: ExtensionSettings): Promise<void> {
    // Update cloud provider if changed
    if (this.currentAdapter?.provider !== newSettings.cloudProvider) {
      await this.setCloudProvider(newSettings.cloudProvider);
    }
    
    // Update auto-sync settings
    if (newSettings.autoSync) {
      this.startAutoSync(newSettings.syncInterval);
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    totalSnippets: number;
    lastSync: Date | null;
    syncProvider: CloudProvider;
    isOnline: boolean;
  }> {
    const snippets = await ExtensionStorage.getSnippets();
    const lastSync = await ExtensionStorage.getLastSync();
    const syncStatus = await this.getSyncStatus();
    
    return {
      totalSnippets: snippets.length,
      lastSync,
      syncProvider: this.currentAdapter?.provider || 'local',
      isOnline: syncStatus?.isOnline || false
    };
  }

  /**
   * Show notification to user
   */
  private async showNotification(message: string): Promise<void> {
    try {
      const settings = await ExtensionStorage.getSettings();
      
      if (settings.showNotifications) {
        if (chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-48.png',
            title: 'Text Expander',
            message
          });
        } else {
          console.warn('chrome.notifications API not available.');
        }
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Get current cloud provider
   */
  getCurrentProvider(): CloudProvider | null {
    return this.currentAdapter?.provider || null;
  }
}