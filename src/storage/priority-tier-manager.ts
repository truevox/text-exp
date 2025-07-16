/**
 * Priority Tier Manager for PuffPuffPaste
 * Manages tier-based snippet storage (personal.json, team.json, org.json)
 */

import type {
  PriorityTier,
  PriorityTierStore,
  EnhancedSnippet,
  TierStorageSchema,
  VariableDef,
} from "../types/snippet-formats.js";

/**
 * Configuration for priority tier files
 */
export interface TierConfig {
  fileName: string;
  displayName: string;
  priority: number; // 1 = highest priority
  defaultEnabled: boolean;
}

/**
 * Tier configuration mapping
 */
export const TIER_CONFIGS: Record<PriorityTier, TierConfig> = {
  personal: {
    fileName: "personal.json",
    displayName: "Personal Snippets",
    priority: 1,
    defaultEnabled: true,
  },
  team: {
    fileName: "team.json",
    displayName: "Team Snippets",
    priority: 2,
    defaultEnabled: false,
  },
  org: {
    fileName: "org.json",
    displayName: "Organization Snippets",
    priority: 3,
    defaultEnabled: false,
  },
};

/**
 * Result of tier operations
 */
export interface TierOperationResult {
  success: boolean;
  tier: PriorityTier;
  snippetsCount: number;
  error?: string;
  warnings?: string[];
}

/**
 * Manages priority-tier based snippet storage
 */
export class PriorityTierManager {
  private tierStores: Map<PriorityTier, PriorityTierStore> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize the tier manager with available tier files
   */
  async initialize(): Promise<void> {
    console.log("🏗️ Initializing PriorityTierManager...");

    // Clear existing stores
    this.tierStores.clear();

    // Initialize each tier
    for (const tier of Object.keys(TIER_CONFIGS) as PriorityTier[]) {
      try {
        const store = await this.createEmptyTierStore(tier);
        this.tierStores.set(tier, store);
        console.log(
          `✅ Initialized tier: ${tier} (${TIER_CONFIGS[tier].fileName})`,
        );
      } catch (error) {
        console.error(`❌ Failed to initialize tier ${tier}:`, error);
        throw new Error(`Failed to initialize tier ${tier}: ${error}`);
      }
    }

    this.initialized = true;
    console.log("🎉 PriorityTierManager initialized successfully");
  }

  /**
   * Load tier data from storage (implemented by subclasses)
   */
  protected async loadTierFromStorage(
    tier: PriorityTier,
  ): Promise<TierStorageSchema | null> {
    // This will be implemented by specific storage adapters (CloudAdapter, LocalStorage, etc.)
    // For now, return null to indicate no existing data
    return null;
  }

  /**
   * Save tier data to storage (implemented by subclasses)
   */
  protected async saveTierToStorage(
    tier: PriorityTier,
    schema: TierStorageSchema,
  ): Promise<void> {
    // This will be implemented by specific storage adapters
    console.log(
      `💾 Saving tier ${tier} with ${schema.snippets.length} snippets`,
    );
  }

  /**
   * Create an empty tier store
   */
  private async createEmptyTierStore(
    tier: PriorityTier,
  ): Promise<PriorityTierStore> {
    const config = TIER_CONFIGS[tier];
    const now = new Date().toISOString();

    return {
      tierName: tier,
      fileName: config.fileName,
      snippets: [],
      lastModified: now,
      version: "1.0.0",
      metadata: {
        totalSnippets: 0,
        averagePriority: config.priority,
        owner: "user",
        permissions: ["read", "write"],
      },
    };
  }

  /**
   * Get all snippets from a specific tier
   */
  async getTierSnippets(tier: PriorityTier): Promise<EnhancedSnippet[]> {
    this.ensureInitialized();

    const store = this.tierStores.get(tier);
    if (!store) {
      throw new Error(`Tier ${tier} not found`);
    }

    return [...store.snippets]; // Return copy to prevent mutation
  }

  /**
   * Add snippet to a specific tier
   */
  async addSnippetToTier(
    tier: PriorityTier,
    snippet: EnhancedSnippet,
  ): Promise<TierOperationResult> {
    this.ensureInitialized();

    try {
      const store = this.tierStores.get(tier);
      if (!store) {
        throw new Error(`Tier ${tier} not found`);
      }

      // Check for duplicate trigger within tier
      const existingIndex = store.snippets.findIndex(
        (s) => s.trigger === snippet.trigger,
      );
      if (existingIndex !== -1) {
        return {
          success: false,
          tier,
          snippetsCount: store.snippets.length,
          error: `Snippet with trigger "${snippet.trigger}" already exists in ${tier} tier`,
        };
      }

      // Ensure snippet has correct scope
      const enhancedSnippet: EnhancedSnippet = {
        ...snippet,
        scope: tier,
        updatedAt: new Date().toISOString(),
      };

      // Add to store (maintain descending priority order by inserting at correct position)
      const insertIndex = this.findInsertionIndex(
        store.snippets,
        enhancedSnippet,
      );
      store.snippets.splice(insertIndex, 0, enhancedSnippet);

      // Update metadata
      store.metadata.totalSnippets = store.snippets.length;
      store.lastModified = new Date().toISOString();

      // Save to storage
      await this.saveTierStore(tier, store);

      return {
        success: true,
        tier,
        snippetsCount: store.snippets.length,
      };
    } catch (error) {
      return {
        success: false,
        tier,
        snippetsCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update snippet in a specific tier
   */
  async updateSnippetInTier(
    tier: PriorityTier,
    snippetId: string,
    updates: Partial<EnhancedSnippet>,
  ): Promise<TierOperationResult> {
    this.ensureInitialized();

    try {
      const store = this.tierStores.get(tier);
      if (!store) {
        throw new Error(`Tier ${tier} not found`);
      }

      const snippetIndex = store.snippets.findIndex((s) => s.id === snippetId);
      if (snippetIndex === -1) {
        return {
          success: false,
          tier,
          snippetsCount: store.snippets.length,
          error: `Snippet with ID "${snippetId}" not found in ${tier} tier`,
        };
      }

      // Apply updates
      const currentSnippet = store.snippets[snippetIndex];
      const updatedSnippet: EnhancedSnippet = {
        ...currentSnippet,
        ...updates,
        id: snippetId, // Ensure ID cannot be changed
        scope: tier, // Ensure scope matches tier
        updatedAt: new Date().toISOString(),
      };

      // If trigger changed, check for duplicates
      if (updates.trigger && updates.trigger !== currentSnippet.trigger) {
        const duplicateIndex = store.snippets.findIndex(
          (s, i) => i !== snippetIndex && s.trigger === updates.trigger,
        );
        if (duplicateIndex !== -1) {
          return {
            success: false,
            tier,
            snippetsCount: store.snippets.length,
            error: `Snippet with trigger "${updates.trigger}" already exists in ${tier} tier`,
          };
        }
      }

      // Update snippet
      store.snippets[snippetIndex] = updatedSnippet;

      // Re-sort if priority might have changed
      store.snippets.sort((a, b) => this.comparePriority(a, b));

      // Update metadata
      store.lastModified = new Date().toISOString();

      // Save to storage
      await this.saveTierStore(tier, store);

      return {
        success: true,
        tier,
        snippetsCount: store.snippets.length,
      };
    } catch (error) {
      return {
        success: false,
        tier,
        snippetsCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Remove snippet from a specific tier
   */
  async removeSnippetFromTier(
    tier: PriorityTier,
    snippetId: string,
  ): Promise<TierOperationResult> {
    this.ensureInitialized();

    try {
      const store = this.tierStores.get(tier);
      if (!store) {
        throw new Error(`Tier ${tier} not found`);
      }

      const snippetIndex = store.snippets.findIndex((s) => s.id === snippetId);
      if (snippetIndex === -1) {
        return {
          success: false,
          tier,
          snippetsCount: store.snippets.length,
          error: `Snippet with ID "${snippetId}" not found in ${tier} tier`,
        };
      }

      // Remove snippet
      store.snippets.splice(snippetIndex, 1);

      // Update metadata
      store.metadata.totalSnippets = store.snippets.length;
      store.lastModified = new Date().toISOString();

      // Save to storage
      await this.saveTierStore(tier, store);

      return {
        success: true,
        tier,
        snippetsCount: store.snippets.length,
      };
    } catch (error) {
      return {
        success: false,
        tier,
        snippetsCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get all snippets across all tiers, ordered by priority
   */
  async getAllSnippetsOrderedByPriority(): Promise<EnhancedSnippet[]> {
    this.ensureInitialized();

    const allSnippets: EnhancedSnippet[] = [];

    // Collect snippets from all tiers in priority order
    for (const tier of ["personal", "team", "org"] as PriorityTier[]) {
      const tierSnippets = await this.getTierSnippets(tier);
      allSnippets.push(...tierSnippets);
    }

    return allSnippets;
  }

  /**
   * Find snippet by trigger across all tiers (returns highest priority match)
   */
  async findSnippetByTrigger(trigger: string): Promise<EnhancedSnippet | null> {
    const allSnippets = await this.getAllSnippetsOrderedByPriority();
    return allSnippets.find((snippet) => snippet.trigger === trigger) || null;
  }

  /**
   * Get tier statistics
   */
  async getTierStats(): Promise<
    Record<PriorityTier, { snippetsCount: number; lastModified: string }>
  > {
    this.ensureInitialized();

    const stats: Record<
      PriorityTier,
      { snippetsCount: number; lastModified: string }
    > = {} as any;

    for (const tier of Object.keys(TIER_CONFIGS) as PriorityTier[]) {
      const store = this.tierStores.get(tier);
      if (store) {
        stats[tier] = {
          snippetsCount: store.snippets.length,
          lastModified: store.lastModified,
        };
      }
    }

    return stats;
  }

  /**
   * Save tier store to storage
   */
  private async saveTierStore(
    tier: PriorityTier,
    store: PriorityTierStore,
  ): Promise<void> {
    const schema: TierStorageSchema = {
      schema: "priority-tier-v1",
      tier,
      snippets: store.snippets,
      metadata: {
        version: store.version,
        created: store.metadata.lastSync || store.lastModified,
        modified: store.lastModified,
        owner: store.metadata.owner || "user",
        description: `${TIER_CONFIGS[tier].displayName} - ${store.snippets.length} snippets`,
      },
    };

    await this.saveTierToStorage(tier, schema);
  }

  /**
   * Find the correct insertion index to maintain priority order
   */
  private findInsertionIndex(
    snippets: EnhancedSnippet[],
    newSnippet: EnhancedSnippet,
  ): number {
    // For now, simply append to the end (maintain order of insertion within tier)
    // This can be enhanced later with actual priority scoring
    return snippets.length;
  }

  /**
   * Compare snippets for priority sorting
   */
  private comparePriority(a: EnhancedSnippet, b: EnhancedSnippet): number {
    // For now, maintain insertion order within tier
    // This can be enhanced later with usage count, modification time, etc.
    return 0;
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        "PriorityTierManager not initialized. Call initialize() first.",
      );
    }
  }

  /**
   * Reset all tiers (for testing)
   */
  async reset(): Promise<void> {
    this.tierStores.clear();
    this.initialized = false;
    await this.initialize();
  }
}
