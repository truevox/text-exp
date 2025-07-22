/**
 * Chrome extension storage utilities
 * Handles local and sync storage operations with type safety
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS } from "./constants.js";
import { IndexedDB } from "./indexed-db.js";
import type {
  TextSnippet,
  ExtensionSettings,
  SyncStatus,
  CloudCredentials,
} from "./types.js";

/**
 * Storage utility class for Chrome extension
 */
export class ExtensionStorage {
  /**
   * Get all snippets from storage with improved fallback logic
   */
  static async getSnippets(): Promise<TextSnippet[]> {
    const indexedDB = new IndexedDB();

    // Always try both storage systems and use the one with more data
    let indexedDBSnippets: TextSnippet[] = [];
    let chromeStorageSnippets: TextSnippet[] = [];

    // Try IndexedDB first
    try {
      indexedDBSnippets = await indexedDB.getSnippets();
      console.log(
        `🔍 [STORAGE-RETRIEVAL] IndexedDB returned ${indexedDBSnippets.length} snippets`,
      );
    } catch (error) {
      console.warn("Failed to load snippets from IndexedDB:", error);
    }

    // Always check chrome.storage.local as well
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SNIPPETS);
      chromeStorageSnippets = result?.[STORAGE_KEYS.SNIPPETS] || [];
      console.log(
        `🔍 [STORAGE-RETRIEVAL] Chrome.storage.local returned ${chromeStorageSnippets.length} snippets`,
      );
    } catch (error) {
      console.warn("Failed to load snippets from chrome.storage.local:", error);
    }

    // Use whichever source has more data (handles race conditions)
    let finalSnippets =
      indexedDBSnippets.length >= chromeStorageSnippets.length
        ? indexedDBSnippets
        : chromeStorageSnippets;

    // Fix corrupted snippets with "undefined" content
    const corruptedSnippets = finalSnippets.filter(
      (s) => s.content === "undefined" || !s.content,
    );
    if (corruptedSnippets.length > 0) {
      console.warn(
        `🚨 Found ${corruptedSnippets.length} corrupted snippets, attempting to fix...`,
      );

      // Create fixed versions by providing default content based on trigger
      finalSnippets = finalSnippets.map((snippet) => {
        if (snippet.content === "undefined" || !snippet.content) {
          let fixedContent = "";

          // Provide default content based on trigger
          if (snippet.trigger === ";hello") {
            fixedContent = "Hello! Welcome to PuffPuffPaste! 👋";
          } else if (snippet.trigger === ";email") {
            fixedContent = "${email}";
          } else if (snippet.trigger === ";signature") {
            fixedContent = "Best regards,<br>${name}<br>${title}";
          } else {
            fixedContent = `[Content for ${snippet.trigger}]`;
          }

          console.log(
            `🔧 Fixed snippet "${snippet.trigger}": "${fixedContent}"`,
          );

          return {
            ...snippet,
            content: fixedContent,
          };
        }
        return snippet;
      });

      // Save the fixed snippets back to storage
      try {
        await Promise.all([
          chrome.storage.local.set({
            [STORAGE_KEYS.SNIPPETS]: finalSnippets,
          }),
          indexedDB.saveSnippets(finalSnippets),
        ]);
        console.log(
          `✅ [CORRUPTION-FIX] Fixed ${corruptedSnippets.length} corrupted snippets`,
        );
      } catch (error) {
        console.error("Failed to save fixed snippets:", error);
      }
    }

    console.log(
      `✅ [STORAGE-RETRIEVAL] Using ${finalSnippets.length} snippets from ${
        indexedDBSnippets.length >= chromeStorageSnippets.length
          ? "IndexedDB"
          : "chrome.storage.local"
      }`,
    );

    if (finalSnippets.length > 0) {
      console.log(
        `📋 [STORAGE-RETRIEVAL] Final snippets:`,
        finalSnippets.map((s) => ({
          id: s.id,
          trigger: s.trigger,
          content: s.content
            ? s.content.substring(0, 30) + "..."
            : "(no content)",
          source: (s as any).source,
        })),
      );

      // Sync the storage systems if they're out of sync
      if (indexedDBSnippets.length !== chromeStorageSnippets.length) {
        console.log(
          `🔄 [STORAGE-SYNC] Storage systems out of sync, updating both`,
        );
        try {
          await Promise.all([
            chrome.storage.local.set({
              [STORAGE_KEYS.SNIPPETS]: finalSnippets,
            }),
            indexedDB.saveSnippets(finalSnippets),
          ]);
          console.log(`✅ [STORAGE-SYNC] Both storage systems synchronized`);
        } catch (error) {
          console.error("Failed to synchronize storage systems:", error);
        }
      }
    }

    return finalSnippets;
  }

  /**
   * Save snippets to storage
   */
  static async setSnippets(snippets: TextSnippet[]): Promise<void> {
    console.log("📦 Updating storage with snippets:", snippets.length, "total");
    console.log(
      "📋 Snippet list:",
      snippets.map((s) => ({
        trigger: s.trigger,
        content: s.content
          ? s.content.substring(0, 30) + "..."
          : "(no content)",
      })),
    );

    await chrome.storage.local.set({
      [STORAGE_KEYS.SNIPPETS]: snippets,
    });

    console.log("✅ Storage update completed");
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
  static async updateSnippet(
    id: string,
    updates: Partial<TextSnippet>,
  ): Promise<void> {
    const snippets = await this.getSnippets();
    const index = snippets.findIndex((s) => s.id === id);

    if (index !== -1) {
      snippets[index] = {
        ...snippets[index],
        ...updates,
        updatedAt: new Date(),
      };
      await this.setSnippets(snippets);
    }
  }

  /**
   * Delete a snippet
   */
  static async deleteSnippet(id: string): Promise<void> {
    const snippets = await this.getSnippets();
    const filtered = snippets.filter((s) => s.id !== id);
    await this.setSnippets(filtered);
  }

  /**
   * Find snippet by trigger
   */
  static async findSnippetByTrigger(
    trigger: string,
  ): Promise<TextSnippet | null> {
    console.log(
      `🔍 [SNIPPET-LOOKUP] Looking for snippet with trigger: "${trigger}"`,
    );
    const snippets = await this.getSnippets();
    console.log(
      `📋 [SNIPPET-LOOKUP] Searching through ${snippets.length} snippets:`,
    );
    snippets.forEach((snippet, index) => {
      console.log(
        `  📋 Snippet ${index + 1}: "${snippet.trigger}" (${(snippet as any).source || "unknown"})`,
      );
    });

    const foundSnippet = snippets.find((s) => s.trigger === trigger);

    if (foundSnippet) {
      console.log(`✅ [SNIPPET-LOOKUP] Found snippet for "${trigger}":`, {
        id: foundSnippet.id,
        trigger: foundSnippet.trigger,
        content: foundSnippet.content
          ? foundSnippet.content.substring(0, 50) + "..."
          : "(no content)",
        source: (foundSnippet as any).source,
      });
    } else {
      console.warn(
        `❌ [SNIPPET-LOOKUP] No snippet found for trigger "${trigger}"`,
      );
      console.warn(
        `🔍 [SNIPPET-LOOKUP] Available triggers:`,
        snippets.map((s) => s.trigger),
      );
    }

    return foundSnippet || null;
  }

  /**
   * Get extension settings
   */
  static async getSettings(): Promise<ExtensionSettings> {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    const storedSettings = result?.[STORAGE_KEYS.SETTINGS];
    return { ...DEFAULT_SETTINGS, ...(storedSettings || {}) };
  }

  /**
   * Save extension settings
   */
  static async setSettings(
    settings: Partial<ExtensionSettings>,
  ): Promise<void> {
    const currentSettings = await this.getSettings();
    const newSettings = { ...currentSettings, ...settings };

    await chrome.storage.sync.set({
      [STORAGE_KEYS.SETTINGS]: newSettings,
    });
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(): Promise<SyncStatus | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SYNC_STATUS);
    return result?.[STORAGE_KEYS.SYNC_STATUS] || null;
  }

  /**
   * Save sync status
   */
  static async setSyncStatus(status: SyncStatus): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SYNC_STATUS]: status,
    });
  }

  /**
   * Get cloud credentials
   */
  static async getCloudCredentials(): Promise<CloudCredentials | null> {
    const result = await chrome.storage.local.get(
      STORAGE_KEYS.CLOUD_CREDENTIALS,
    );
    return result?.[STORAGE_KEYS.CLOUD_CREDENTIALS] || null;
  }

  /**
   * Save cloud credentials
   */
  static async setCloudCredentials(
    credentials: CloudCredentials,
  ): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CLOUD_CREDENTIALS]: credentials,
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
    const timestamp = result?.[STORAGE_KEYS.LAST_SYNC];
    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Set last sync timestamp
   */
  static async setLastSync(date: Date): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LAST_SYNC]: date.toISOString(),
    });
  }

  /**
   * Clear all extension data
   */
  static async clearAll(): Promise<void> {
    // Clear chrome storage
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();

    // Clear IndexedDB as well
    const indexedDB = new IndexedDB();
    await indexedDB.clearAll();
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageUsage(): Promise<{ local: number; sync: number }> {
    const localUsage = await chrome.storage.local.getBytesInUse();
    const syncUsage = await chrome.storage.sync.getBytesInUse();

    return {
      local: localUsage,
      sync: syncUsage,
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
      version: "1.0",
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
      throw new Error("Invalid backup data format");
    }
  }

  /**
   * Get scoped sources
   */
  static async getScopedSources(): Promise<any[]> {
    const result = await chrome.storage.local.get("scopedSources");
    return result?.scopedSources || [];
  }

  /**
   * Save scoped sources
   */
  static async setScopedSources(sources: any[]): Promise<void> {
    await chrome.storage.local.set({
      scopedSources: sources,
    });
  }
}
