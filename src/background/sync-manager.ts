/**
 * Sync Manager for Collaborative Text Expander
 * Orchestrates synchronization between local storage and cloud providers
 */

import { ExtensionStorage } from "../shared/storage.js";
import { IndexedDB } from "../shared/indexed-db.js";
import { getCloudAdapterFactory } from "./cloud-adapters/index.js";
import { MultiScopeSyncManager } from "./multi-scope-sync-manager.js";
import { notifyContentScriptsOfSnippetUpdate } from "./messaging-helpers.js";
import { AuthenticationService } from "./services/auth-service.js";
import { SyncStateManager } from "./services/sync-state.js";
import { NotificationService } from "./services/notification-service.js";
import type {
  CloudAdapter,
  CloudProvider,
  TextSnippet,
  SyncStatus,
  CloudCredentials,
  ExtensionSettings,
  SyncedSource,
  SnippetScope,
} from "../shared/types.js";
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from "../shared/constants.js";

/**
 * Manages synchronization between local and cloud storage
 */
export class SyncManager {
  private static instance: SyncManager;
  private currentAdapter: CloudAdapter | null = null; // Primary adapter, e.g., for personal snippets
  private multiScopeSyncManager: MultiScopeSyncManager;
  private indexedDB: IndexedDB;
  private syncState: SyncStateManager;

  private constructor() {
    this.multiScopeSyncManager = new MultiScopeSyncManager();
    this.indexedDB = new IndexedDB();
    this.syncState = new SyncStateManager();
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

    // Start auto-sync for cloud providers
    if (settings.autoSync && settings.cloudProvider !== "local") {
      this.syncState.startAutoSync(settings.syncInterval, () => this.syncNow());
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
      const initialized =
        await AuthenticationService.initializeWithStoredCredentials(
          this.currentAdapter,
          provider,
        );

      if (!initialized) {
        console.log(`📝 No stored credentials found for ${provider} provider`);
      }
    } catch (error) {
      console.error("Failed to set cloud provider:", error);
      throw error;
    }
  }

  /**
   * Authenticate with the current cloud provider
   */
  async authenticate(): Promise<CloudCredentials> {
    return AuthenticationService.authenticate(this.currentAdapter!);
  }

  /**
   * Check if currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return AuthenticationService.isAuthenticated(this.currentAdapter);
  }

  /**
   * Disconnect from cloud provider
   */
  async disconnect(): Promise<void> {
    await AuthenticationService.disconnect();
  }

  /**
   * Select a folder for a given scope
   */
  async selectFolder(
    provider: CloudProvider,
    scope: SnippetScope,
  ): Promise<{ folderId: string; folderName: string }> {
    if (!this.currentAdapter || this.currentAdapter.provider !== provider) {
      // Ensure the correct adapter is set before selecting a folder
      await this.setCloudProvider(provider);
    }

    if (!this.currentAdapter) {
      throw new Error("No cloud provider configured or initialized.");
    }

    if (!this.currentAdapter.selectFolder) {
      throw new Error(
        `Folder selection not supported for ${provider} provider.`,
      );
    }

    // Check if we need to authenticate first for cloud providers
    if (provider !== "local") {
      const isAuthenticated = await this.currentAdapter.isAuthenticated();
      if (!isAuthenticated) {
        console.log(
          `🔐 Not authenticated with ${provider}, authenticating first...`,
        );
        const credentials = await this.authenticate();
        await this.currentAdapter.initialize(credentials);
      }
    }

    try {
      const folderHandle = await this.currentAdapter.selectFolder();
      // For local-filesystem, folderHandle is FileSystemDirectoryHandle
      // For cloud providers, it would be an object with id and name
      if (provider === "local-filesystem") {
        // Store the handle for future use
        // The selectFolder method of LocalFilesystemAdapter now returns serializable data
        await ExtensionStorage.setScopedSources([
          {
            name: scope,
            adapter: this.currentAdapter,
            folderId: folderHandle.folderId,
            displayName: folderHandle.folderName,
            handleId: (folderHandle as any).handleId,
            handleName: (folderHandle as any).handleName,
          },
        ]);
        return {
          folderId: folderHandle.folderId,
          folderName: folderHandle.folderName,
        };
      } else {
        // For cloud providers (Google Drive, Dropbox, etc.), save the selected folder
        await ExtensionStorage.setScopedSources([
          {
            name: scope,
            adapter: this.currentAdapter,
            folderId: folderHandle.folderId,
            displayName: folderHandle.folderName,
          },
        ]);
        return folderHandle;
      }
    } catch (error) {
      console.error(
        `Failed to select folder for ${provider} (${scope}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Perform manual sync
   */
  async syncNow(): Promise<void> {
    console.log("🔄 [SYNC-MANAGER] syncNow() called");

    if (this.syncState.isSyncInProgress()) {
      console.warn("⚠️ [SYNC-MANAGER] Sync already in progress, skipping");
      throw new Error("Sync already in progress");
    }

    if (!this.currentAdapter) {
      console.error("❌ [SYNC-MANAGER] No cloud adapter configured");
      throw new Error("No cloud provider configured");
    }

    console.log(
      `🔧 [SYNC-MANAGER] Using cloud provider: ${this.currentAdapter.provider}`,
    );

    if (this.currentAdapter.provider === "local") {
      console.log("🏠 [SYNC-MANAGER] Local provider - no cloud sync needed");
      return;
    }

    this.syncState.setSyncInProgress(true);
    let finalSyncStatus: SyncStatus = {
      provider: this.currentAdapter?.provider || "local",
      lastSync: null,
      isOnline: false,
      hasChanges: false,
    }; // Declare here to be accessible in finally

    try {
      // Get scoped sources from storage
      const scopedSources = await ExtensionStorage.getScopedSources();
      console.log("📁 Loaded scoped sources:", scopedSources);

      const sources: SyncedSource[] = [];
      if (this.currentAdapter) {
        // If we have stored scoped sources, use them
        const personalSource = scopedSources.find(
          (source) => source.name === "personal",
        );
        if (personalSource) {
          console.log(
            "📁 Using stored personal folder:",
            personalSource.folderId,
            personalSource.displayName,
          );
          sources.push({
            name: "personal",
            adapter: this.currentAdapter,
            folderId: personalSource.folderId,
            displayName: personalSource.displayName,
          });
        } else {
          console.log("⚠️ No stored personal folder found, using default");
          // Fall back to default if no scoped sources configured
          sources.push({
            name: "personal",
            adapter: this.currentAdapter,
            folderId: "", // Let the adapter handle this
            displayName: "My Personal Snippets",
          });
        }
      }

      // Check for appdata-based Priority #0 store (automatic discovery)
      if (this.currentAdapter && this.currentAdapter.provider === "google-drive") {
        try {
          const appdataStore = await (this.currentAdapter as any).discoverAppDataStore();
          if (appdataStore.hasStore) {
            console.log("✨ Discovered Priority #0 store in appdata");
            sources.unshift({
              name: "priority-0" as SnippetScope,
              adapter: this.currentAdapter,
              folderId: "appdata-priority-0",
              displayName: "Priority #0 Store",
            });
          } else {
            console.log("📭 No Priority #0 store found in appdata");
          }
        } catch (error) {
          console.error("❌ Failed to discover appdata store:", error);
        }
      }

      // TODO: Add department and org sources based on user settings

      console.log(
        `🔄 Starting syncAndMerge with ${sources.length} sources:`,
        sources.map((s) => ({ name: s.displayName, folderId: s.folderId })),
      );
      const cloudSnippets =
        await this.multiScopeSyncManager.syncAndMerge(sources);
      console.log(
        `🔄 Sync completed, downloaded ${cloudSnippets.length} cloud snippets:`,
        cloudSnippets.map((s) => ({
          trigger: s.trigger,
          content: s.content.substring(0, 50) + "...",
        })),
      );

      // Get existing local snippets
      const existingSnippets = await ExtensionStorage.getSnippets();
      console.log(
        `📚 Found ${existingSnippets.length} existing local snippets`,
      );

      // Merge cloud snippets with existing local snippets (cloud takes priority)
      const mergedSnippets = this.mergeSnippets(
        existingSnippets,
        cloudSnippets,
      );
      console.log(`🔗 Merged result: ${mergedSnippets.length} total snippets`);

      // ATOMIC STORAGE UPDATE: Update both storage systems simultaneously
      console.log(
        `🔄 [STORAGE-UPDATE] Performing atomic update of both storage systems...`,
      );

      // DEBUG: Log detailed snippet data being stored
      console.log(
        `🔍 [STORAGE-DEBUG] Storing ${mergedSnippets.length} snippets to both storage systems:`,
      );
      mergedSnippets.forEach((snippet, index) => {
        console.log(
          `  📋 Snippet ${index + 1} (${(snippet as any).source || "unknown"}):`,
          {
            id: snippet.id,
            trigger: snippet.trigger,
            content:
              snippet.content?.substring(0, 50) +
              (snippet.content?.length > 50 ? "..." : ""),
            description: snippet.description,
            tags: snippet.tags,
            source: (snippet as any).source,
            hasRequiredFields: !!(
              snippet.id &&
              snippet.trigger &&
              snippet.content
            ),
          },
        );
      });

      // CRITICAL: Check if we have the pony snippet before storage
      const ponySnippet = mergedSnippets.find((s) => s.trigger === ";pony");
      if (ponySnippet) {
        console.log(
          `✅ [PONY-DEBUG] ;pony snippet found in merge results:`,
          ponySnippet,
        );
      } else {
        console.warn(
          `❌ [PONY-DEBUG] ;pony snippet MISSING from merge results!`,
        );
        console.warn(
          `🔍 [PONY-DEBUG] Available triggers:`,
          mergedSnippets.map((s) => s.trigger),
        );
        console.warn(
          `🔍 [PONY-DEBUG] Cloud snippets:`,
          cloudSnippets.map((s) => s.trigger),
        );
        console.warn(
          `🔍 [PONY-DEBUG] Existing snippets:`,
          existingSnippets.map((s) => s.trigger),
        );
      }

      // CRITICAL FIX: Update both storage systems atomically
      await Promise.all([
        ExtensionStorage.setSnippets(mergedSnippets),
        this.indexedDB.saveSnippets(mergedSnippets),
      ]);
      console.log("✅ Both storage systems updated atomically");

      // CRITICAL FIX: Add a small delay to ensure storage operations are fully settled
      // This prevents race conditions where content scripts load before storage is ready
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log("⏱️ Storage settling delay completed");

      // Notify content scripts that snippets have been updated (after storage is fully settled)
      await notifyContentScriptsOfSnippetUpdate();
      console.log("📢 Notified content scripts of snippet update");

      // Notify success
      await NotificationService.showSyncSuccess(mergedSnippets.length);

      // Update last sync time
      await ExtensionStorage.setLastSync(new Date());

      // Initialize final status as success
      finalSyncStatus = {
        provider: this.currentAdapter?.provider || "local",
        lastSync: new Date(),
        isOnline: true,
        hasChanges: false,
      };
    } catch (error) {
      console.error("Sync failed:", error);

      // Check if this is an authentication-related error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const isAuthError = this.isAuthenticationError(errorMessage);

      // If it's an auth error, try to clear stale credentials
      if (
        isAuthError &&
        this.currentAdapter &&
        this.currentAdapter.provider !== "local-filesystem"
      ) {
        console.log(
          "🔐 Authentication error detected, clearing stale credentials",
        );
        try {
          await this.disconnect();
        } catch (disconnectError) {
          console.error("Failed to clear stale credentials:", disconnectError);
        }
      }

      // Update final status to error
      finalSyncStatus = {
        provider: this.currentAdapter?.provider || "local",
        lastSync: await ExtensionStorage.getLastSync(), // Keep previous last sync time on failure
        isOnline: !isAuthError, // If auth error, mark as offline
        hasChanges: true,
        error: isAuthError
          ? "Authentication expired. Please reconnect to continue syncing."
          : errorMessage,
      };
      throw error;
    } finally {
      await ExtensionStorage.setSyncStatus(finalSyncStatus); // Set status once
      this.syncState.setSyncInProgress(false);
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
      console.error("Failed to get sync status:", error);
      return await ExtensionStorage.getSyncStatus();
    }
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(intervalMinutes: number): void {
    this.syncState.startAutoSync(intervalMinutes, () => this.syncNow());
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    this.syncState.stopAutoSync();
  }

  /**
   * Upload local snippets to cloud
   */
  async uploadSnippets(snippets?: TextSnippet[]): Promise<void> {
    if (!this.currentAdapter) {
      throw new Error("No cloud provider configured");
    }

    if (!(await this.isAuthenticated())) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    const snippetsToUpload = snippets || (await ExtensionStorage.getSnippets());
    await this.currentAdapter.uploadSnippets(snippetsToUpload);
  }

  /**
   * Download snippets from cloud
   */
  async downloadSnippets(): Promise<TextSnippet[]> {
    if (!this.currentAdapter) {
      throw new Error("No cloud provider configured");
    }

    if (!(await this.isAuthenticated())) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    return this.currentAdapter.downloadSnippets("");
  }

  /**
   * Delete snippets from cloud storage
   */
  async deleteSnippets(snippetIds: string[]): Promise<void> {
    if (!this.currentAdapter) {
      throw new Error("No cloud provider configured");
    }

    if (!(await this.isAuthenticated())) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    await this.currentAdapter.deleteSnippets(snippetIds);
  }

  /**
   * Force sync from cloud (overwrite local)
   */
  async forceDownload(): Promise<void> {
    if (!this.currentAdapter) {
      throw new Error("No cloud provider configured");
    }

    if (!(await this.isAuthenticated())) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    try {
      const cloudSnippets = await this.currentAdapter.downloadSnippets("");
      await ExtensionStorage.setSnippets(cloudSnippets);

      await NotificationService.showNotification(
        "Snippets downloaded from cloud",
      );
    } catch (error) {
      console.error("Force download failed:", error);
      throw error;
    }
  }

  /**
   * Force sync to cloud (overwrite remote)
   */
  async forceUpload(): Promise<void> {
    if (!this.currentAdapter) {
      throw new Error("No cloud provider configured");
    }

    if (!(await this.isAuthenticated())) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    try {
      const localSnippets = await ExtensionStorage.getSnippets();
      await this.currentAdapter.uploadSnippets(localSnippets);

      await NotificationService.showNotification("Snippets uploaded to cloud");
    } catch (error) {
      console.error("Force upload failed:", error);
      throw error;
    }
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
      syncProvider: this.currentAdapter?.provider || "local",
      isOnline: syncStatus?.isOnline || false,
    };
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.syncState.isSyncInProgress();
  }

  /**
   * Get current cloud provider
   */
  getCurrentProvider(): CloudProvider | null {
    return this.currentAdapter?.provider || null;
  }

  /**
   * Get available folders for current cloud provider
   */
  async getCloudFolders(
    parentId?: string,
  ): Promise<
    Array<{ id: string; name: string; parentId?: string; isFolder: boolean }>
  > {
    if (!this.currentAdapter) {
      throw new Error("No cloud provider configured");
    }

    if (!this.currentAdapter.getFolders) {
      throw new Error(
        `Folder listing not supported for ${this.currentAdapter.provider} provider.`,
      );
    }

    // Ensure authenticated
    if (!(await this.isAuthenticated())) {
      const credentials = await this.authenticate();
      await this.currentAdapter.initialize(credentials);
    }

    return await this.currentAdapter.getFolders(parentId);
  }

  /**
   * Create folder using current cloud provider
   */
  async createCloudFolder(
    folderName: string,
    parentId?: string,
  ): Promise<{ id: string; name: string }> {
    if (!this.currentAdapter) {
      throw new Error("No cloud provider configured");
    }

    if (!this.currentAdapter.createFolder) {
      throw new Error(
        `Folder creation not supported for ${this.currentAdapter.provider} provider.`,
      );
    }

    // Ensure authenticated
    if (!(await this.isAuthenticated())) {
      const credentials = await this.authenticate();
      await this.currentAdapter.initialize(credentials);
    }

    return await this.currentAdapter.createFolder(folderName, parentId);
  }

  /**
   * Check if an error message indicates an authentication problem
   */
  private isAuthenticationError(errorMessage: string): boolean {
    const authErrorPatterns = [
      /authentication.*failed/i,
      /not.*authenticated/i,
      /token.*expired/i,
      /invalid.*token/i,
      /access.*denied/i,
      /unauthorized/i,
      /credential.*invalid/i,
      /401/,
      /403.*forbidden/i,
    ];

    return authErrorPatterns.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * Merge existing local snippets with new cloud snippets
   * Cloud snippets take priority over local ones with the same trigger
   */
  private mergeSnippets(
    localSnippets: TextSnippet[],
    cloudSnippets: TextSnippet[],
  ): TextSnippet[] {
    const snippetMap = new Map<string, TextSnippet>();

    // First, add all local snippets
    for (const snippet of localSnippets) {
      snippetMap.set(snippet.trigger, snippet);
    }

    // Then, add cloud snippets (which will override local ones with same trigger)
    for (const snippet of cloudSnippets) {
      snippetMap.set(snippet.trigger, snippet);
    }

    const result = Array.from(snippetMap.values());
    console.log(
      `🔗 Merge details: ${localSnippets.length} local + ${cloudSnippets.length} cloud = ${result.length} total`,
    );

    return result;
  }
}
