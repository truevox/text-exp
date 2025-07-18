/**
 * Priority Tier Manager for PuffPuffPaste
 * Manages tier-based snippet storage (personal.json, team.json, org.json)
 * Enhanced for Phase 2: Storage System Core with comprehensive tier management
 */

import type {
  PriorityTier,
  PriorityTierStore,
  EnhancedSnippet,
  TierStorageSchema,
} from "../types/snippet-formats.js";

import { JsonSerializer } from "./json-serializer.js";
import { MergeHelper } from "./merge-helper.js";
import type { JsonSerializationOptions } from "./json-serializer.js";
import type { MergeOptions } from "./merge-helper.js";

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
 * Enhanced tier configuration for Phase 2
 */
export interface TierManagementConfig {
  /** Base path for tier files */
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
}

/**
 * Result of tier operations with enhanced metadata
 */
export interface TierOperationResult {
  success: boolean;
  tier: PriorityTier;
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
  };
}

/**
 * Tier load options
 */
export interface TierLoadOptions {
  /** Whether to validate schema */
  validateSchema?: boolean;

  /** Whether to use cache if available */
  useCache?: boolean;

  /** Whether to create backup before loading */
  createBackup?: boolean;

  /** Custom validation function */
  customValidation?: (tier: TierStorageSchema) => boolean;
}

/**
 * Tier save options
 */
export interface TierSaveOptions {
  /** Whether to create backup before save */
  createBackup?: boolean;

  /** Whether to validate before save */
  validateBeforeSave?: boolean;

  /** Whether to update modification timestamp */
  updateTimestamp?: boolean;

  /** Custom serialization options */
  serializationOptions?: Partial<JsonSerializationOptions>;
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
 * Default tier management configuration
 */
export const DEFAULT_TIER_MANAGEMENT_CONFIG: TierManagementConfig = {
  basePath: "./snippet-stores",
  enableBackups: true,
  maxBackups: 5,
  enableCaching: true,
  cacheTtl: 300000, // 5 minutes
  serializationOptions: {
    pretty: true,
    preserveOrder: true,
    atomicWrite: true,
    backup: false, // Handled separately by tier manager
  },
  mergeOptions: {
    strategy: "newest-wins",
    preserveLocalChanges: false,
    detectContentChanges: true,
    allowTriggerDuplicates: false,
  },
};

/**
 * Enhanced Priority Tier Manager for Phase 2
 * Manages tier-based snippet storage with JSON serialization and merge capabilities
 */
export class PriorityTierManager {
  private tierStores: Map<PriorityTier, PriorityTierStore> = new Map();
  private initialized: boolean = false;
  private jsonSerializer: JsonSerializer;
  private mergeHelper: MergeHelper;
  private config: TierManagementConfig;
  private tierCache: Map<
    PriorityTier,
    { data: TierStorageSchema; timestamp: number }
  >;

  constructor(config: Partial<TierManagementConfig> = {}) {
    this.config = { ...DEFAULT_TIER_MANAGEMENT_CONFIG, ...config };
    this.jsonSerializer = new JsonSerializer();
    this.mergeHelper = new MergeHelper();
    this.tierCache = new Map();
  }

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
   * Enhanced tier loading with JSON serialization and caching
   */
  async loadTier(
    tier: PriorityTier,
    options: TierLoadOptions = {},
  ): Promise<TierOperationResult> {
    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (this.config.enableCaching && options.useCache !== false) {
        const cached = this.getCachedTier(tier);
        if (cached) {
          return {
            success: true,
            tier,
            snippetsCount: cached.snippets.length,
            metadata: {
              operation: "load",
              duration: Date.now() - startTime,
              fromCache: true,
            },
          };
        }
      }

      // Load from storage
      const tierData = await this.loadTierFromStorage(tier);

      if (!tierData) {
        // Create empty tier if doesn't exist
        const emptyTier = await this.createEmptyTierSchema(tier);

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

      try {
        const serializedData = JsonSerializer.serialize(
          tierData,
          serializationOptions,
        );

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

      if (!mergeResult.success) {
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

      // Update tier data with merged snippets
      const updatedTierData: TierStorageSchema = {
        ...currentTierData,
        snippets: mergeResult.mergedSnippets || currentTierData.snippets,
      };

      // Save updated tier
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
  // ENHANCED HELPER METHODS FOR PHASE 2
  // ========================================================================

  /**
   * Get cached tier data if valid
   */
  private getCachedTier(tier: PriorityTier): TierStorageSchema | null {
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
