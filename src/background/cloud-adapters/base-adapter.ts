/**
 * Base CloudAdapter implementation
 * Provides common functionality for all cloud storage adapters
 */

import type {
  CloudAdapter,
  CloudProvider,
  CloudCredentials,
  TextSnippet,
  SyncStatus,
} from "../../shared/types.js";
import { SYNC_CONFIG, ERROR_MESSAGES } from "../../shared/constants.js";

/**
 * Abstract base class for cloud adapters
 */
export abstract class BaseCloudAdapter implements CloudAdapter {
  abstract readonly provider: CloudProvider;

  protected credentials: CloudCredentials | null = null;
  protected isInitialized = false;

  /**
   * Initialize the adapter with credentials
   */
  async initialize(credentials: CloudCredentials): Promise<void> {
    this.credentials = credentials;
    this.isInitialized = true;

    // Validate credentials
    if (!(await this.validateCredentials())) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }
  }

  /**
   * Check if the adapter is authenticated and ready
   */
  async isAuthenticated(): Promise<boolean> {
    if (!this.isInitialized || !this.credentials) {
      return false;
    }

    return this.validateCredentials();
  }

  /**
   * Authenticate with the cloud provider
   */
  abstract authenticate(): Promise<CloudCredentials>;

  /**
   * Upload snippets to cloud storage
   */
  abstract uploadSnippets(snippets: TextSnippet[]): Promise<void>;

  /**
   * Download snippets from cloud storage
   */
  abstract downloadSnippets(): Promise<TextSnippet[]>;

  /**
   * Delete snippets from cloud storage
   */
  abstract deleteSnippets(snippetIds: string[]): Promise<void>;

  /**
   * Sync local changes with remote storage
   */
  async syncSnippets(localSnippets: TextSnippet[]): Promise<TextSnippet[]> {
    if (!(await this.isAuthenticated())) {
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    try {
      // Download remote snippets
      const remoteSnippets = await this.downloadSnippets();

      // Merge local and remote snippets
      const mergedSnippets = this.mergeSnippets(localSnippets, remoteSnippets);

      // Upload merged snippets back to cloud
      await this.uploadSnippets(mergedSnippets);

      return mergedSnippets;
    } catch (error) {
      throw new Error(
        `${ERROR_MESSAGES.SYNC_FAILED}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const isOnline = await this.checkConnectivity();
    const isAuth = await this.isAuthenticated();

    console.log(
      `🔍 ${this.provider} getSyncStatus: connectivity=${isOnline}, auth=${isAuth}`,
    );

    return {
      provider: this.provider,
      lastSync: await this.getLastSyncTime(),
      isOnline: isOnline && isAuth,
      hasChanges: await this.hasLocalChanges(),
      error: isAuth ? undefined : ERROR_MESSAGES.AUTHENTICATION_FAILED,
    };
  }

  /**
   * Validate stored credentials
   */
  protected abstract validateCredentials(): Promise<boolean>;

  /**
   * Check network connectivity to the cloud provider
   */
  protected abstract checkConnectivity(): Promise<boolean>;

  /**
   * Get the last sync timestamp
   */
  protected abstract getLastSyncTime(): Promise<Date | null>;

  /**
   * Check if there are local changes to sync
   */
  protected abstract hasLocalChanges(): Promise<boolean>;

  /**
   * Merge local and remote snippets using conflict resolution
   */
  protected mergeSnippets(
    localSnippets: TextSnippet[],
    remoteSnippets: TextSnippet[],
  ): TextSnippet[] {
    const merged = new Map<string, TextSnippet>();

    // Add all remote snippets first
    remoteSnippets.forEach((snippet) => {
      merged.set(snippet.id, snippet);
    });

    // Merge local snippets, resolving conflicts by timestamp
    localSnippets.forEach((localSnippet) => {
      const remoteSnippet = merged.get(localSnippet.id);

      if (!remoteSnippet) {
        // Local snippet is new
        merged.set(localSnippet.id, localSnippet);
      } else {
        // Conflict resolution: use the most recently updated
        const localTime = new Date(localSnippet.updatedAt).getTime();
        const remoteTime = new Date(remoteSnippet.updatedAt).getTime();

        if (localTime > remoteTime) {
          merged.set(localSnippet.id, localSnippet);
        }
        // If remote is newer or equal, keep the remote version (already in map)
      }
    });

    return Array.from(merged.values());
  }

  /**
   * Retry mechanism for network operations
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = SYNC_CONFIG.MAX_RETRIES,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = SYNC_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Sleep utility for retry delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique ID for snippets
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate snippet data structure
   */
  protected validateSnippet(snippet: any): snippet is TextSnippet {
    return (
      typeof snippet === "object" &&
      typeof snippet.id === "string" &&
      typeof snippet.trigger === "string" &&
      typeof snippet.content === "string" &&
      snippet.createdAt instanceof Date &&
      snippet.updatedAt instanceof Date
    );
  }

  /**
   * Sanitize snippets data before upload
   */
  protected sanitizeSnippets(snippets: TextSnippet[]): TextSnippet[] {
    return snippets.filter(this.validateSnippet.bind(this));
  }

  /**
   * Handle API rate limiting
   */
  protected async handleRateLimit(retryAfter?: number): Promise<void> {
    const delay = retryAfter ? retryAfter * 1000 : 1000;
    await this.sleep(delay);
  }
}
