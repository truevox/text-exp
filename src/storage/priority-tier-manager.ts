/**
 * Numeric Priority Manager for PuffPuffPaste
 * Manages numeric priority-based snippet storage with FILO ordering
 * Enhanced for numeric priority system: simpler scopes, better ordering
 */

import type {
  SnippetScope,
  SnippetStore,
  EnhancedSnippet,
  NumericPriorityStorageSchema,
  TierStorageSchema, // Legacy support
  PriorityTier,
} from "../types/snippet-formats.js";

import { JsonSerializer } from "./json-serializer.js";
import { MergeHelper } from "./merge-helper.js";
import type { JsonSerializationOptions } from "./json-serializer.js";
import type { MergeOptions } from "./merge-helper.js";

/**
 * Configuration for snippet scope stores
 */
export interface ScopeConfig {
  fileName: string;
  displayName: string;
  defaultEnabled: boolean;
  description: string;
}

/**
 * Legacy tier configurations for backward compatibility
 */
export const TIER_CONFIGS: Record<PriorityTier, ScopeConfig> = {
  "priority-0": {
    fileName: "priority-0.json",
    displayName: "Priority 0",
    defaultEnabled: true,
    description: "Highest priority snippets",
  },
  personal: {
    fileName: "personal.json",
    displayName: "Personal",
    defaultEnabled: true,
    description: "Personal snippets",
  },
  team: {
    fileName: "team.json",
    displayName: "Team",
    defaultEnabled: false,
    description: "Team snippets",
  },
  org: {
    fileName: "org.json",
    displayName: "Organization",
    defaultEnabled: false,
    description: "Organization snippets",
  },
  department: {
    fileName: "department.json",
    displayName: "Department",
    defaultEnabled: false,
    description: "Department snippets",
  },
};

/**
 * Enhanced snippet priority management configuration
 */
export interface PriorityManagementConfig {
  /** Base path for snippet store files */
  basePath: string;

  /** Whether to enable automatic backups */
  enableBackups: boolean;

  /** Maximum number of backups to keep */
  maxBackups: number;

  /** Whether to enable caching */
  enableCaching: boolean;

  /** Cache TTL in milliseconds */
  cacheTtl: number;

  /** JSON serialization options */
  serializationOptions: JsonSerializationOptions;

  /** Merge options for conflicts */
  mergeOptions: MergeOptions;

  /** Initial priority for new snippets (FILO - newest gets 0) */
  initialPriority: number;
}

/**
 * Result of priority store operations with enhanced metadata
 */
export interface PriorityOperationResult {
  success: boolean;
  scope: SnippetScope;
  snippetsCount: number;
  error?: string;
  warnings?: string[];
  /** Operation metadata */
  metadata?: {
    operation: "load" | "save" | "upsert" | "delete" | "migrate";
    duration: number;
    fileSize?: number;
    backupCreated?: boolean;
    fromCache?: boolean;
    priorityRange?: { min: number; max: number };
  };
}

/**
 * Store load options
 */
export interface StoreLoadOptions {
  /** Whether to validate schema */
  validateSchema?: boolean;

  /** Whether to use cache if available */
  useCache?: boolean;

  /** Whether to create backup before loading */
  createBackup?: boolean;

  /** Custom validation function */
  customValidation?: (store: NumericPriorityStorageSchema) => boolean;

  /** Whether to migrate legacy tier format */
  migrateLegacyFormat?: boolean;
}

/**
 * Store save options
 */
export interface StoreSaveOptions {
  /** Whether to create backup before save */
  createBackup?: boolean;

  /** Whether to validate before save */
  validateBeforeSave?: boolean;

  /** Whether to update modification timestamp */
  updateTimestamp?: boolean;

  /** Custom serialization options */
  serializationOptions?: Partial<JsonSerializationOptions>;

  /** Whether to reorder snippets by priority */
  reorderByPriority?: boolean;
}

/**
 * Scope configuration mapping (simplified from tier system)
 */
export const SCOPE_CONFIGS: Record<SnippetScope, ScopeConfig> = {
  personal: {
    fileName: "personal.json",
    displayName: "Personal Snippets",
    defaultEnabled: true,
    description: "Your private snippet collection",
  },
  team: {
    fileName: "team.json",
    displayName: "Team Snippets",
    defaultEnabled: false,
    description: "Shared snippets for your team",
  },
  org: {
    fileName: "org.json",
    displayName: "Organization Snippets",
    defaultEnabled: false,
    description: "Company-wide snippet collection",
  },
};

/**
 * Default priority management configuration
 */
export const DEFAULT_PRIORITY_MANAGEMENT_CONFIG: PriorityManagementConfig = {
  basePath: "./snippet-stores",
  enableBackups: true,
  maxBackups: 5,
  enableCaching: true,
  cacheTtl: 300000, // 5 minutes
  initialPriority: 0, // FILO - newest snippets get priority 0
  serializationOptions: {
    pretty: true,
    preserveOrder: true,
    atomicWrite: true,
    backup: false, // Handled separately by priority manager
  },
  mergeOptions: {
    strategy: "newest-wins",
    preserveLocalChanges: false,
    detectContentChanges: true,
    allowTriggerDuplicates: false,
  },
};

/**
 * Enhanced Numeric Priority Manager
 * Manages numeric priority-based snippet storage with JSON serialization and merge capabilities
 * Uses FILO ordering: newest snippets get priority 0, older snippets get higher numbers
 */
export class NumericPriorityManager {
  private scopeStores: Map<SnippetScope, SnippetStore> = new Map();
  private initialized: boolean = false;
  private jsonSerializer: JsonSerializer;
  private mergeHelper: MergeHelper;
  private config: PriorityManagementConfig;
  private storeCache: Map<
    SnippetScope,
    { data: NumericPriorityStorageSchema; timestamp: number }
  >;
  private nextPriorityMap: Map<SnippetScope, number> = new Map();

  constructor(config: Partial<PriorityManagementConfig> = {}) {
    this.config = { ...DEFAULT_PRIORITY_MANAGEMENT_CONFIG, ...config };
    this.jsonSerializer = new JsonSerializer();
    this.mergeHelper = new MergeHelper();
    this.storeCache = new Map();
  }

  /**
   * Initialize the priority manager with available scope stores
   */
  async initialize(): Promise<void> {
    console.log("🏗️ Initializing NumericPriorityManager...");

    // Clear existing stores
    this.scopeStores.clear();
    this.nextPriorityMap.clear();

    // Initialize each scope
    for (const scope of Object.keys(SCOPE_CONFIGS) as SnippetScope[]) {
      try {
        const store = await this.createEmptySnippetStore(scope);
        this.scopeStores.set(scope, store);
        this.nextPriorityMap.set(scope, this.config.initialPriority);
        console.log(
          `✅ Initialized scope: ${scope} (${SCOPE_CONFIGS[scope].fileName})`,
        );
      } catch (error) {
        console.error(`❌ Failed to initialize scope ${scope}:`, error);
        throw new Error(`Failed to initialize scope ${scope}: ${error}`);
      }
    }

    this.initialized = true;
    console.log("🎉 NumericPriorityManager initialized successfully");
  }

  /**
   * Enhanced store loading with JSON serialization and caching
   */
  async loadStore(
    scope: SnippetScope,
    options: StoreLoadOptions = {},
  ): Promise<PriorityOperationResult> {
    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (this.config.enableCaching && options.useCache !== false) {
        const cached = this.getCachedStore(scope);
        if (cached) {
          // Update next priority from cached data
          this.updateNextPriorityFromData(scope, cached);
          return {
            success: true,
            scope,
            snippetsCount: cached.snippets.length,
            metadata: {
              operation: "load",
              duration: Date.now() - startTime,
              fromCache: true,
              priorityRange: this.getPriorityRange(cached.snippets),
            },
          };
        }
      }

      // Load from storage
      const storeData = await this.loadStoreFromStorage(scope);

      if (!tierData) {
        // Create empty tier if doesn't exist
        const emptyTier = await this.createEmptyTierSchema(tier);

        // Custom validation if provided (including for empty tiers)
        if (options.customValidation && !options.customValidation(emptyTier)) {
          return {
            success: false,
            tier,
            snippetsCount: 0,
            error: `Custom validation failed for tier ${tier}`,
            metadata: {
              operation: "load",
              duration: Date.now() - startTime,
              fromCache: false,
            },
          };
        }

        if (this.config.enableCaching) {
          this.updateCache(tier, emptyTier);
        }

        return {
          success: true,
          tier,
          snippetsCount: 0,
          metadata: {
            operation: "load",
            duration: Date.now() - startTime,
            fromCache: false,
          },
        };
      }

      // Validate schema if requested
      if (options.validateSchema !== false) {
        const isValid = this.validateTierSchema(tierData);
        if (!isValid) {
          return {
            success: false,
            tier,
            snippetsCount: 0,
            error: `Invalid tier schema for ${tier}`,
            metadata: {
              operation: "load",
              duration: Date.now() - startTime,
              fromCache: false,
            },
          };
        }
      }

      // Custom validation if provided
      if (options.customValidation && !options.customValidation(tierData)) {
        return {
          success: false,
          tier,
          snippetsCount: 0,
          error: `Custom validation failed for tier ${tier}`,
          metadata: {
            operation: "load",
            duration: Date.now() - startTime,
            fromCache: false,
          },
        };
      }

      // Update cache
      if (this.config.enableCaching) {
        this.updateCache(tier, tierData);
      }

      return {
        success: true,
        tier,
        snippetsCount: tierData.snippets.length,
        metadata: {
          operation: "load",
          duration: Date.now() - startTime,
          fromCache: false,
        },
      };
    } catch (error) {
      return {
        success: false,
        tier,
        snippetsCount: 0,
        error: `Failed to load tier ${tier}: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          operation: "load",
          duration: Date.now() - startTime,
          fromCache: false,
        },
      };
    }
  }

  /**
   * Enhanced tier saving with JSON serialization and backup
   */
  async saveTier(
    tier: PriorityTier,
    tierData: TierStorageSchema,
    options: TierSaveOptions = {},
  ): Promise<TierOperationResult> {
    const startTime = Date.now();
    let backupCreated = false;

    try {
      // Validate before save if requested
      if (options.validateBeforeSave !== false) {
        const isValid = this.validateTierSchema(tierData);
        if (!isValid) {
          return {
            success: false,
            tier,
            snippetsCount: tierData.snippets.length,
            error: `Invalid tier schema for ${tier}`,
            metadata: {
              operation: "save",
              duration: Date.now() - startTime,
              backupCreated,
            },
          };
        }
      }

      // Create backup if enabled
      if (options.createBackup ?? this.config.enableBackups) {
        try {
          await this.createTierBackup(tier);
          backupCreated = true;
        } catch (backupError) {
          console.warn(
            `Failed to create backup for tier ${tier}:`,
            backupError,
          );
          // Continue with save even if backup fails
        }
      }

      // Update timestamp if requested
      if (options.updateTimestamp !== false) {
        tierData.metadata.modified = new Date().toISOString();
      }

      // Serialize with JSON serializer
      const serializationOptions = {
        ...this.config.serializationOptions,
        ...options.serializationOptions,
      };

      let serializedData: string;
      try {
        serializedData = JsonSerializer.serializeToString(
          tierData,
          serializationOptions,
        );
      } catch (serializationError) {
        return {
          success: false,
          tier,
          snippetsCount: tierData.snippets.length,
          error: `Serialization failed: ${serializationError instanceof Error ? serializationError.message : String(serializationError)}`,
          metadata: {
            operation: "save",
            duration: Date.now() - startTime,
            backupCreated,
          },
        };
      }

      try {
        // Save to storage
        await this.saveTierToStorage(tier, tierData);

        // Update cache
        if (this.config.enableCaching) {
          this.updateCache(tier, tierData);
        }

        return {
          success: true,
          tier,
          snippetsCount: tierData.snippets.length,
          metadata: {
            operation: "save",
            duration: Date.now() - startTime,
            fileSize: serializedData.length,
            backupCreated,
          },
        };
      } catch (saveError) {
        return {
          success: false,
          tier,
          snippetsCount: tierData.snippets.length,
          error: `Save failed: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
          metadata: {
            operation: "save",
            duration: Date.now() - startTime,
            backupCreated,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        tier,
        snippetsCount: tierData.snippets.length,
        error: `Failed to save tier ${tier}: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          operation: "save",
          duration: Date.now() - startTime,
          backupCreated,
        },
      };
    }
  }

  /**
   * Enhanced upsert operation with merge capabilities
   */
  async upsertSnippet(
    snippet: EnhancedSnippet,
    targetTier?: PriorityTier,
  ): Promise<TierOperationResult> {
    const startTime = Date.now();
    const tier = targetTier || this.determineTierFromSnippet(snippet);

    try {
      // Load current tier data
      const loadResult = await this.loadTier(tier);
      if (!loadResult.success) {
        return {
          success: false,
          tier,
          snippetsCount: 0,
          error: `Failed to load tier for upsert: ${loadResult.error}`,
          metadata: {
            operation: "upsert",
            duration: Date.now() - startTime,
          },
        };
      }

      // Get current tier data from cache or create empty
      const currentTierData =
        this.getCachedTier(tier) || (await this.createEmptyTierSchema(tier));

      // Use merge helper to handle conflicts
      const mergeResult = MergeHelper.merge(
        currentTierData.snippets,
        [snippet],
        { ...this.config.mergeOptions, tier },
      );

      // Always continue with merge result, handle conflicts gracefully
      const updatedTierData: TierStorageSchema = {
        ...currentTierData,
        snippets: mergeResult.mergedSnippets || currentTierData.snippets,
      };

      // If there were conflicts but we got merged snippets, consider it successful
      if (mergeResult.mergedSnippets && mergeResult.mergedSnippets.length > 0) {
        const saveResult = await this.saveTier(tier, updatedTierData);
        return {
          success: true, // Consider merge successful even with conflicts
          tier,
          snippetsCount: updatedTierData.snippets.length,
          warnings: mergeResult.warnings,
          metadata: {
            operation: "upsert",
            duration: Date.now() - startTime,
            fileSize: saveResult.metadata?.fileSize,
            backupCreated: saveResult.metadata?.backupCreated,
          },
        };
      }

      // If merge completely failed
      if (
        !mergeResult.success &&
        (!mergeResult.mergedSnippets || mergeResult.mergedSnippets.length === 0)
      ) {
        return {
          success: false,
          tier,
          snippetsCount: currentTierData.snippets.length,
          error: `Merge failed: ${mergeResult.error}`,
          warnings: mergeResult.warnings,
          metadata: {
            operation: "upsert",
            duration: Date.now() - startTime,
          },
        };
      }

      // Save updated tier (fallback case)
      const saveResult = await this.saveTier(tier, updatedTierData);

      return {
        success: saveResult.success,
        tier,
        snippetsCount: updatedTierData.snippets.length,
        error: saveResult.error,
        warnings: mergeResult.warnings,
        metadata: {
          operation: "upsert",
          duration: Date.now() - startTime,
          fileSize: saveResult.metadata?.fileSize,
          backupCreated: saveResult.metadata?.backupCreated,
        },
      };
    } catch (error) {
      return {
        success: false,
        tier,
        snippetsCount: 0,
        error: `Failed to upsert snippet: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          operation: "upsert",
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Create an empty snippet store
   */
  private async createEmptySnippetStore(
    scope: SnippetScope,
  ): Promise<SnippetStore> {
    const config = SCOPE_CONFIGS[scope];
    const now = new Date().toISOString();

    return {
      storeName: `${scope}-store`,
      fileName: config.fileName,
      scope: scope,
      snippets: [],
      lastModified: now,
      version: "1.0.0",
      metadata: {
        totalSnippets: 0,
        highestPriority: this.config.initialPriority,
        lowestPriority: this.config.initialPriority,
        owner: "user",
        permissions: ["read", "write"],
      },
    };
  }

  /**
   * Get all snippets from a specific scope store
   */
  async getStoreSnippets(scope: SnippetScope): Promise<EnhancedSnippet[]> {
    this.ensureInitialized();

    const store = this.scopeStores.get(scope);
    if (!store) {
      throw new Error(`Scope store ${scope} not found`);
    }

    // Return snippets sorted by priority (0 = highest priority)
    return [...store.snippets].sort((a, b) => a.priority - b.priority);
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
   * Get all snippets across all scope stores, ordered by numeric priority
   */
  async getAllSnippetsOrderedByPriority(): Promise<EnhancedSnippet[]> {
    this.ensureInitialized();

    const allSnippets: EnhancedSnippet[] = [];

    // Collect snippets from all scopes
    for (const scope of ["personal", "team", "org"] as SnippetScope[]) {
      const storeSnippets = await this.getStoreSnippets(scope);
      allSnippets.push(...storeSnippets);
    }

    // Sort by numeric priority (0 = highest priority)
    return allSnippets.sort((a, b) => a.priority - b.priority);
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
    _newSnippet: EnhancedSnippet,
  ): number {
    // For now, simply append to the end (maintain order of insertion within tier)
    // This can be enhanced later with actual priority scoring
    return snippets.length;
  }

  /**
   * Compare snippets for priority sorting
   */
  private comparePriority(_a: EnhancedSnippet, _b: EnhancedSnippet): number {
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
    this.tierCache.clear();
    this.initialized = false;
    await this.initialize();
  }

  // ========================================================================
  // NUMERIC PRIORITY HELPER METHODS
  // ========================================================================

  /**
   * Get next priority number for a scope (FILO - newest gets lowest number)
   */
  private getNextPriority(scope: SnippetScope): number {
    return this.nextPriorityMap.get(scope) ?? this.config.initialPriority;
  }

  /**
   * Update next priority number for a scope
   */
  private updateNextPriority(scope: SnippetScope, priority: number): void {
    this.nextPriorityMap.set(scope, priority);
  }

  /**
   * Calculate priority range from snippet array
   */
  private getPriorityRange(snippets: EnhancedSnippet[]): {
    min: number;
    max: number;
  } {
    if (snippets.length === 0) {
      return {
        min: this.config.initialPriority,
        max: this.config.initialPriority,
      };
    }
    const priorities = snippets.map((s) => s.priority);
    return {
      min: Math.min(...priorities),
      max: Math.max(...priorities),
    };
  }

  /**
   * Update next priority from loaded data
   */
  private updateNextPriorityFromData(
    scope: SnippetScope,
    data: NumericPriorityStorageSchema,
  ): void {
    const nextPriority =
      data.metadata.nextPriority ?? this.config.initialPriority;
    this.updateNextPriority(scope, nextPriority);
  }

  /**
   * Get cached store data if valid
   */
  private getCachedStore(
    scope: SnippetScope,
  ): NumericPriorityStorageSchema | null {
    if (!this.config.enableCaching) return null;

    const cached = this.tierCache.get(tier);
    if (!cached) return null;

    const now = Date.now();
    const isExpired = now - cached.timestamp > this.config.cacheTtl;

    if (isExpired) {
      this.tierCache.delete(tier);
      return null;
    }

    return cached.data;
  }

  /**
   * Update cache with tier data
   */
  private updateCache(tier: PriorityTier, data: TierStorageSchema): void {
    if (!this.config.enableCaching) return;

    this.tierCache.set(tier, {
      data: JSON.parse(JSON.stringify(data)), // Deep copy
      timestamp: Date.now(),
    });
  }

  /**
   * Create empty tier schema
   */
  private async createEmptyTierSchema(
    tier: PriorityTier,
  ): Promise<TierStorageSchema> {
    const config = TIER_CONFIGS[tier];
    const now = new Date().toISOString();

    return {
      schema: "priority-tier-v1",
      tier,
      snippets: [],
      metadata: {
        version: "1.0.0",
        created: now,
        modified: now,
        owner: "user",
        description: `${config.displayName} - Empty tier`,
      },
    };
  }

  /**
   * Validate tier schema structure
   */
  private validateTierSchema(tierData: TierStorageSchema): boolean {
    try {
      return (
        tierData &&
        typeof tierData === "object" &&
        tierData.schema === "priority-tier-v1" &&
        ["personal", "team", "org"].includes(tierData.tier) &&
        Array.isArray(tierData.snippets) &&
        tierData.metadata &&
        typeof tierData.metadata === "object"
      );
    } catch {
      return false;
    }
  }

  /**
   * Determine tier from snippet metadata
   */
  private determineTierFromSnippet(snippet: EnhancedSnippet): PriorityTier {
    // Use snippet scope to determine tier
    if (snippet.scope && ["personal", "team", "org"].includes(snippet.scope)) {
      return snippet.scope as PriorityTier;
    }

    // Default to personal tier
    return "personal";
  }

  /**
   * Create backup of tier file
   */
  private async createTierBackup(tier: PriorityTier): Promise<void> {
    try {
      const currentData = await this.loadTierFromStorage(tier);
      if (currentData) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupFileName = `${tier}-backup-${timestamp}.json`;
        console.log(`Creating backup: ${backupFileName}`);
        // Backup logic would be implemented here based on storage adapter
      }
    } catch (error) {
      console.warn(`Failed to create backup for tier ${tier}:`, error);
      // Don't throw - backup failure shouldn't prevent save
    }
  }

  /**
   * Load tier data from storage (to be implemented by storage adapters)
   */
  protected async loadTierFromStorage(
    tier: PriorityTier,
  ): Promise<TierStorageSchema | null> {
    // This will be implemented by specific storage adapters (CloudAdapter, LocalStorage, etc.)
    // For now, return null to indicate no existing data
    console.log(`📂 Loading tier ${tier} from storage...`);
    return null;
  }

  /**
   * Save tier data to storage (to be implemented by storage adapters)
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
}

// MIGRATION: Import from new simplified store manager
export {
  SimpleStoreManager as PriorityTierManager,
  SimpleStoreManager as NumericPriorityManager,
  SimpleStoreManager,
} from "./simple-store-manager.js";

// Legacy exports for gradual migration
export type {
  SimpleStore as SnippetStore,
  SimpleStoreManagerConfig as PriorityManagementConfig,
  StoreOperationResult as PriorityOperationResult,
  StoreOperationResult as TierOperationResult,
} from "./simple-store-manager.js";
