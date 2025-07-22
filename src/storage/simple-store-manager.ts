/**
 * Simple Store Manager for PuffPuffPaste
 * Manages Google Drive folders as simple priority-ordered snippet stores
 *
 * NO SCOPES, NO TIERS - just stores with numeric priorities
 * Priority is ONLY used for hover-snippet disambiguation ordering
 */

import type {
  SimpleStore,
  SimpleSnippet,
  SimpleStoreSchema,
  StorePriority,
} from "../types/snippet-formats.js";

import { JsonSerializer } from "./json-serializer.js";

/**
 * Configuration for the simple store manager
 */
export interface SimpleStoreManagerConfig {
  /** Whether to enable caching */
  enableCaching: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  /** Default store name */
  defaultStoreName: string;
}

const DEFAULT_CONFIG: SimpleStoreManagerConfig = {
  enableCaching: true,
  cacheTtl: 5 * 60 * 1000, // 5 minutes
  defaultStoreName: "Default Store",
};

/**
 * Result of store operations
 */
export interface StoreOperationResult {
  success: boolean;
  error?: string;
  storeId?: string;
  snippetCount?: number;
}

/**
 * Simple Store Manager - no scopes, no tiers, just priority-ordered stores
 */
export class SimpleStoreManager {
  private stores: Map<string, SimpleStore> = new Map();
  private snippets: Map<string, SimpleSnippet[]> = new Map(); // storeId -> snippets
  private initialized: boolean = false;
  private jsonSerializer: JsonSerializer;
  private config: SimpleStoreManagerConfig;

  constructor(config: Partial<SimpleStoreManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.jsonSerializer = new JsonSerializer();
  }

  /**
   * Initialize the store manager
   */
  async initialize(): Promise<void> {
    console.log("🏗️ Initializing SimpleStoreManager...");

    this.stores.clear();
    this.snippets.clear();

    // TODO: Load stores from storage/sync
    // For now, create a default store
    const defaultStore: SimpleStore = {
      id: "default",
      name: this.config.defaultStoreName,
      priority: 0, // Always highest priority
      googleDriveFolderId: "/drive.appdata",
      isDefault: true,
      readOnly: false,
      lastSync: new Date().toISOString(),
      snippetCount: 0,
    };

    this.stores.set(defaultStore.id, defaultStore);
    this.snippets.set(defaultStore.id, []);

    this.initialized = true;
    console.log("🎉 SimpleStoreManager initialized successfully");
  }

  /**
   * Get all stores ordered by priority (0 = highest)
   */
  getStores(): SimpleStore[] {
    this.ensureInitialized();
    return Array.from(this.stores.values()).sort(
      (a, b) => a.priority - b.priority,
    );
  }

  /**
   * Get a specific store by ID
   */
  getStore(storeId: string): SimpleStore | undefined {
    this.ensureInitialized();
    return this.stores.get(storeId);
  }

  /**
   * Add a new store (gets next available priority number)
   */
  async addStore(
    name: string,
    googleDriveFolderId: string,
    readOnly: boolean = false,
  ): Promise<StoreOperationResult> {
    this.ensureInitialized();

    try {
      // Find the next priority number
      const existingPriorities = Array.from(this.stores.values()).map(
        (store) => store.priority,
      );
      const nextPriority = Math.max(...existingPriorities) + 1;

      const newStore: SimpleStore = {
        id: `store-${Date.now()}`, // Simple ID generation
        name,
        priority: nextPriority,
        googleDriveFolderId,
        isDefault: false,
        readOnly,
        lastSync: new Date().toISOString(),
        snippetCount: 0,
      };

      this.stores.set(newStore.id, newStore);
      this.snippets.set(newStore.id, []);

      console.log(`✅ Added new store: ${name} (Priority ${nextPriority})`);

      return {
        success: true,
        storeId: newStore.id,
        snippetCount: 0,
      };
    } catch (error) {
      console.error("❌ Failed to add store:", error);
      return {
        success: false,
        error: `Failed to add store: ${error}`,
      };
    }
  }

  /**
   * Remove a store (cannot remove default store)
   */
  async removeStore(storeId: string): Promise<StoreOperationResult> {
    this.ensureInitialized();

    const store = this.stores.get(storeId);
    if (!store) {
      return {
        success: false,
        error: `Store ${storeId} not found`,
      };
    }

    if (store.isDefault) {
      return {
        success: false,
        error: "Cannot remove default store",
      };
    }

    this.stores.delete(storeId);
    this.snippets.delete(storeId);

    console.log(`🗑️ Removed store: ${store.name}`);

    return { success: true };
  }

  /**
   * Reorder stores by setting new priorities
   * priorities array should be ordered from highest to lowest priority
   */
  async reorderStores(storeIds: string[]): Promise<StoreOperationResult> {
    this.ensureInitialized();

    try {
      // Assign new priorities: 0, 1, 2, 3...
      storeIds.forEach((storeId, index) => {
        const store = this.stores.get(storeId);
        if (store) {
          store.priority = index;
        }
      });

      console.log("🔄 Reordered stores by priority");

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to reorder stores: ${error}`,
      };
    }
  }

  /**
   * Get all snippets from a specific store
   */
  getSnippetsFromStore(storeId: string): SimpleSnippet[] {
    this.ensureInitialized();

    if (!this.stores.has(storeId)) {
      throw new Error(`Store ${storeId} not found`);
    }

    return this.snippets.get(storeId) || [];
  }

  /**
   * Legacy method name for backward compatibility during migration
   */
  async getTierSnippets(storeId: string): Promise<SimpleSnippet[]> {
    this.ensureInitialized();

    if (!this.stores.has(storeId)) {
      throw new Error(`Tier ${storeId} not found`); // Legacy error message for test compatibility
    }

    return this.snippets.get(storeId) || [];
  }

  /**
   * Get all snippets from all stores, ordered by store priority for disambiguation
   * This is used for hover-snippet disambiguation only
   */
  getAllSnippetsOrderedByStorePriority(): SimpleSnippet[] {
    this.ensureInitialized();

    const allSnippets: SimpleSnippet[] = [];
    const orderedStores = this.getStores(); // Already sorted by priority

    for (const store of orderedStores) {
      const storeSnippets = this.snippets.get(store.id) || [];
      allSnippets.push(...storeSnippets);
    }

    return allSnippets;
  }

  /**
   * Add a snippet to a specific store
   */
  async addSnippetToStore(
    storeId: string,
    snippet: SimpleSnippet,
  ): Promise<StoreOperationResult> {
    this.ensureInitialized();

    const store = this.stores.get(storeId);
    if (!store) {
      return {
        success: false,
        error: `Store ${storeId} not found`,
      };
    }

    if (store.readOnly) {
      return {
        success: false,
        error: `Store ${store.name} is read-only`,
      };
    }

    const storeSnippets = this.snippets.get(storeId) || [];

    // Check for duplicate trigger
    const existingSnippet = storeSnippets.find(
      (s) => s.trigger === snippet.trigger,
    );
    if (existingSnippet) {
      return {
        success: false,
        error: `Snippet with trigger "${snippet.trigger}" already exists in store`,
      };
    }

    snippet.storeId = storeId;
    storeSnippets.push(snippet);
    this.snippets.set(storeId, storeSnippets);

    // Update store snippet count
    store.snippetCount = storeSnippets.length;

    return {
      success: true,
      snippetCount: storeSnippets.length,
    };
  }

  /**
   * Reset all stores and snippets
   */
  async reset(): Promise<void> {
    this.stores.clear();
    this.snippets.clear();
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      // Legacy error message for test compatibility
      throw new Error("PriorityTierManager not initialized");
    }
  }
}

// Export alias for backward compatibility during migration
export const PriorityTierManager = SimpleStoreManager;
export const NumericPriorityManager = SimpleStoreManager;
