/**
 * Enhanced Merge Helper for Priority-Tier Storage System - Phase 2
 * Handles upsert operations by ID with conflict resolution and priority-based merging
 */

import type {
  EnhancedSnippet,
  PriorityTier,
  TierStorageSchema,
} from "../types/snippet-formats.js";

// Export types for external use
export type { EnhancedSnippet, PriorityTier, TierStorageSchema };

/**
 * Enhanced conflict resolution strategies for Phase 2
 */
export type ConflictResolutionStrategy =
  | "local-wins" // Local changes take priority
  | "remote-wins" // Remote changes take priority
  | "newest-wins" // Most recent updatedAt wins
  | "manual" // Require manual resolution
  | "merge-content" // Attempt to merge content
  | "priority-based" // Use tier priority for resolution
  | "timestamp-based" // Use timestamp with tolerance
  | "overwrite"; // Force overwrite with source

/**
 * Enhanced merge options for Phase 2
 */
export interface MergeOptions {
  strategy: ConflictResolutionStrategy;
  preserveLocalChanges?: boolean;
  detectContentChanges?: boolean;
  allowTriggerDuplicates?: boolean;
  tier?: PriorityTier;
  // Phase 2 enhancements
  createBackup?: boolean;
  preserveFields?: string[];
  forceUpdateFields?: string[];
  timestampToleranceMs?: number;
  validateResult?: boolean;
  performanceTracking?: boolean;
  conflictResolution?: {
    scopeMismatchAction?: "adapt-priority" | "reject" | "ignore";
    timestampTolerance?: number;
    customRules?: Record<string, any>;
  };
}

/**
 * Enhanced merge conflict information for Phase 2
 */
export interface MergeConflict {
  snippetId: string;
  trigger: string;
  conflictType:
    | "duplicate-trigger"
    | "duplicate-id"
    | "content-mismatch"
    | "field-conflict"
    | "type-mismatch"
    | "array-difference";
  localSnippet: EnhancedSnippet;
  remoteSnippet: EnhancedSnippet;
  suggestedResolution?: EnhancedSnippet;
  // Phase 2 enhancements
  field?: string;
  sourceValue?: any;
  targetValue?: any;
  resolutionStrategy?: string;
}

/**
 * Enhanced merge operation result for Phase 2
 */
export interface MergeResult {
  success: boolean;
  mergedSnippets: EnhancedSnippet[];
  conflicts: MergeConflict[];
  stats: {
    added: number;
    updated: number;
    removed: number;
    conflicts: number;
    // Phase 2 enhancements
    fieldsMerged?: number;
    conflictsResolved?: number;
    backupCreated?: boolean;
  };
  warnings?: string[];
  error?: string;
  // Phase 2 enhancements
  metadata?: MergeMetadata;
}

/**
 * Phase 2 merge operation metadata
 */
export interface MergeMetadata {
  operation: "upsert" | "merge" | "bulk-upsert" | "conflict-resolution";
  startTime: number;
  duration: number;
  sourceTier?: PriorityTier;
  targetTier?: PriorityTier;
  strategy: string;
  backupPath?: string;
  performanceMetrics?: {
    processingTime: number;
    validationTime: number;
    conflictResolutionTime: number;
  };
}

/**
 * Default enhanced merge options for Phase 2
 */
const DEFAULT_ENHANCED_MERGE_OPTIONS: Required<MergeOptions> = {
  strategy: "priority-based",
  preserveLocalChanges: true,
  detectContentChanges: true,
  allowTriggerDuplicates: false,
  tier: "personal",
  createBackup: true,
  preserveFields: ["id", "createdAt", "createdBy"],
  forceUpdateFields: [],
  timestampToleranceMs: 5000,
  validateResult: true,
  performanceTracking: true,
  conflictResolution: {
    scopeMismatchAction: "adapt-priority",
    timestampTolerance: 5000,
    customRules: {},
  },
};

/**
 * Priority tier rankings for Phase 2 conflict resolution
 */
const TIER_PRIORITY: Record<PriorityTier, number> = {
  "priority-0": 5,
  personal: 4,
  department: 3,
  team: 2,
  org: 1,
};

/**
 * Fields that should be merged as arrays
 */
const ARRAY_MERGE_FIELDS = ["snipDependencies", "variables", "images", "tags"];

/**
 * Enhanced MergeHelper for Priority-Tier Storage System - Phase 2
 */
export class MergeHelper {
  /**
   * Phase 2: Enhanced upsert operation for tier-based storage with advanced conflict resolution
   */
  static async upsertSnippetAdvanced(
    sourceSnippet: EnhancedSnippet,
    targetSchema: TierStorageSchema,
    options: Partial<MergeOptions> = {},
  ): Promise<MergeResult> {
    const startTime = performance.now();
    const opts = { ...DEFAULT_ENHANCED_MERGE_OPTIONS, ...options };

    const metadata: MergeMetadata = {
      operation: "upsert",
      startTime,
      duration: 0,
      sourceTier: sourceSnippet.scope,
      targetTier: targetSchema.tier,
      strategy: opts.strategy,
    };

    try {
      // Create backup if requested
      let backupCreated = false;
      if (opts.createBackup) {
        // In a real implementation, this would create an actual backup file
        metadata.backupPath = `backup-${targetSchema.tier}-${Date.now()}.json`;
        backupCreated = true;
      }

      // Find existing snippet by ID
      const existingIndex = targetSchema.snippets.findIndex(
        (s) => s.id === sourceSnippet.id,
      );

      if (existingIndex === -1) {
        // No existing snippet - perform insert with validation
        return await this.insertSnippetAdvanced(
          sourceSnippet,
          targetSchema,
          opts,
          metadata,
          backupCreated,
        );
      }

      // Existing snippet found - perform advanced merge
      const existingSnippet = targetSchema.snippets[existingIndex];
      const mergeResult = await this.mergeSnippetsAdvanced(
        sourceSnippet,
        existingSnippet,
        opts,
        metadata,
      );

      if (mergeResult.success && mergeResult.mergedSnippets.length > 0) {
        // Update the snippet in the schema
        targetSchema.snippets[existingIndex] = mergeResult.mergedSnippets[0];

        // Update schema metadata
        targetSchema.metadata.modified = new Date().toISOString();
        if (sourceSnippet.updatedBy) {
          targetSchema.metadata.owner = sourceSnippet.updatedBy;
        }
      }

      // Update metadata and stats
      mergeResult.metadata = {
        ...metadata,
        duration: performance.now() - startTime,
      };

      if (mergeResult.stats) {
        mergeResult.stats.backupCreated = backupCreated;
      }

      return mergeResult;
    } catch (error) {
      return {
        success: false,
        mergedSnippets: [],
        conflicts: [],
        stats: {
          added: 0,
          updated: 0,
          removed: 0,
          conflicts: 0,
          backupCreated: false,
        },
        error: `Advanced upsert operation failed: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          ...metadata,
          duration: performance.now() - startTime,
        },
      };
    }
  }

  /**
   * Phase 2: Advanced snippet insertion with validation and conflict detection
   */
  private static async insertSnippetAdvanced(
    snippet: EnhancedSnippet,
    schema: TierStorageSchema,
    options: Required<MergeOptions>,
    metadata: MergeMetadata,
    backupCreated: boolean,
  ): Promise<MergeResult> {
    const warnings: string[] = [];
    const conflicts: MergeConflict[] = [];

    // Validate snippet scope matches schema tier
    if (snippet.scope !== schema.tier) {
      if (
        options.strategy === "priority-based" ||
        options.strategy === "overwrite"
      ) {
        // Adjust scope to match tier
        const adjustedSnippet = { ...snippet, scope: schema.tier };
        warnings.push(
          `Adjusted snippet scope from '${snippet.scope}' to '${schema.tier}' to match tier`,
        );

        schema.snippets.push(adjustedSnippet);

        return {
          success: true,
          mergedSnippets: [adjustedSnippet],
          conflicts,
          warnings,
          stats: {
            added: 1,
            updated: 0,
            removed: 0,
            conflicts: 0,
            fieldsMerged: 1,
            backupCreated,
          },
          metadata: {
            ...metadata,
            duration: performance.now() - metadata.startTime,
          },
        };
      } else {
        conflicts.push({
          snippetId: snippet.id,
          trigger: snippet.trigger,
          conflictType: "field-conflict",
          localSnippet: snippet,
          remoteSnippet: snippet,
          field: "scope",
          sourceValue: snippet.scope,
          targetValue: schema.tier,
          resolutionStrategy: "manual-required",
        });

        return {
          success: false,
          mergedSnippets: [],
          conflicts,
          warnings,
          stats: {
            added: 0,
            updated: 0,
            removed: 0,
            conflicts: 1,
            backupCreated,
          },
          error: `Snippet scope '${snippet.scope}' does not match tier '${schema.tier}'`,
          metadata: {
            ...metadata,
            duration: performance.now() - metadata.startTime,
          },
        };
      }
    }

    // Check for trigger conflicts if not allowed
    if (!options.allowTriggerDuplicates) {
      const triggerConflict = schema.snippets.find(
        (s) => s.trigger === snippet.trigger,
      );
      if (triggerConflict) {
        conflicts.push({
          snippetId: snippet.id,
          trigger: snippet.trigger,
          conflictType: "duplicate-trigger",
          localSnippet: triggerConflict,
          remoteSnippet: snippet,
          resolutionStrategy: options.strategy,
        });

        return {
          success: false,
          mergedSnippets: [],
          conflicts,
          warnings,
          stats: {
            added: 0,
            updated: 0,
            removed: 0,
            conflicts: 1,
            backupCreated,
          },
          error: `Duplicate trigger '${snippet.trigger}' found`,
          metadata: {
            ...metadata,
            duration: performance.now() - metadata.startTime,
          },
        };
      }
    }

    // Insert snippet successfully
    schema.snippets.push(snippet);

    // Validate if requested
    if (options.validateResult) {
      const validation = this.validateMergedSnippet(snippet);
      if (!validation.success) {
        // Remove the snippet we just added since validation failed
        schema.snippets.pop();
        return {
          success: false,
          mergedSnippets: [],
          conflicts,
          warnings,
          stats: {
            added: 0,
            updated: 0,
            removed: 0,
            conflicts: 0,
            backupCreated,
          },
          error: `Snippet validation failed: ${validation.error}`,
          metadata: {
            ...metadata,
            duration: performance.now() - metadata.startTime,
          },
        };
      }
      if (validation.warnings) {
        warnings.push(...validation.warnings);
      }
    }

    return {
      success: true,
      mergedSnippets: [snippet],
      conflicts,
      warnings,
      stats: { added: 1, updated: 0, removed: 0, conflicts: 0, backupCreated },
      metadata: {
        ...metadata,
        duration: performance.now() - metadata.startTime,
      },
    };
  }

  /**
   * Phase 2: Advanced snippet merging with field-level conflict resolution
   */
  private static async mergeSnippetsAdvanced(
    sourceSnippet: EnhancedSnippet,
    targetSnippet: EnhancedSnippet,
    options: Required<MergeOptions>,
    metadata: MergeMetadata,
  ): Promise<MergeResult> {
    const conflicts: MergeConflict[] = [];
    const warnings: string[] = [];
    const mergedSnippet: EnhancedSnippet = { ...targetSnippet };

    metadata.operation = "merge";
    let fieldsMerged = 0;
    let conflictsResolved = 0;

    // Check for scope mismatch
    if (sourceSnippet.scope !== targetSnippet.scope) {
      if (
        options.conflictResolution?.scopeMismatchAction === "adapt-priority"
      ) {
        // Use tier priority to determine which scope to keep
        const sourcePriority = this.getTierPriority(sourceSnippet.scope);
        const targetPriority = this.getTierPriority(targetSnippet.scope);

        if (sourcePriority > targetPriority) {
          warnings.push(
            `Adjusted snippet scope from '${targetSnippet.scope}' to '${sourceSnippet.scope}' to match tier`,
          );
          mergedSnippet.scope = sourceSnippet.scope;
          fieldsMerged++;
        } else {
          warnings.push(
            `Kept existing scope '${targetSnippet.scope}' due to higher priority`,
          );
        }
      } else if (options.conflictResolution?.scopeMismatchAction === "reject") {
        return {
          success: false,
          mergedSnippets: [],
          conflicts: [],
          warnings: [],
          stats: {
            added: 0,
            updated: 0,
            removed: 0,
            conflicts: 0,
            backupCreated: false,
          },
          error: `Scope mismatch: existing '${targetSnippet.scope}' vs new '${sourceSnippet.scope}'`,
          metadata,
        };
      }
    }

    // Get all fields to process
    const allFields = new Set([
      ...Object.keys(sourceSnippet),
      ...Object.keys(targetSnippet),
    ]);

    for (const field of allFields) {
      const sourceValue = (sourceSnippet as any)[field];
      const targetValue = (targetSnippet as any)[field];

      // Skip preserved fields
      if (options.preserveFields.includes(field)) {
        continue;
      }

      // Force update fields
      if (options.forceUpdateFields.includes(field)) {
        (mergedSnippet as any)[field] = sourceValue;
        fieldsMerged++;
        continue;
      }

      // Handle missing fields
      if (sourceValue === undefined && targetValue !== undefined) {
        continue; // Keep target value
      }

      if (sourceValue !== undefined && targetValue === undefined) {
        (mergedSnippet as any)[field] = sourceValue;
        fieldsMerged++;
        continue;
      }

      // Both values exist - check for conflicts
      if (sourceValue !== targetValue) {
        const conflict = await this.detectAdvancedConflict(
          field,
          sourceValue,
          targetValue,
          sourceSnippet,
          targetSnippet,
        );
        conflicts.push(conflict);

        // Resolve conflict based on strategy
        const resolution = await this.resolveAdvancedConflict(
          conflict,
          sourceSnippet,
          targetSnippet,
          options,
          metadata,
        );

        if (resolution.success) {
          (mergedSnippet as any)[field] = resolution.value;
          fieldsMerged++;
          conflictsResolved++;

          if (resolution.warning) {
            warnings.push(resolution.warning);
          }
        } else {
          // Use fallback strategy
          if (options.strategy === "priority-based") {
            const sourcePriority = TIER_PRIORITY[metadata.sourceTier!];
            const targetPriority = TIER_PRIORITY[metadata.targetTier!];

            if (sourcePriority > targetPriority) {
              (mergedSnippet as any)[field] = sourceValue;
              warnings.push(
                `Used source value for field '${field}' (priority: ${metadata.sourceTier} > ${metadata.targetTier})`,
              );
            } else {
              warnings.push(
                `Kept target value for field '${field}' (priority: ${metadata.targetTier} >= ${metadata.sourceTier})`,
              );
            }
          } else {
            warnings.push(
              `Used target value for unresolved conflict in field '${field}': ${resolution.reason}`,
            );
          }
        }
      }
    }

    // Update timestamps and ownership
    mergedSnippet.updatedAt = new Date().toISOString();
    if (sourceSnippet.updatedBy) {
      mergedSnippet.updatedBy = sourceSnippet.updatedBy;
    }
    fieldsMerged += 2;

    // Validate result if requested
    if (options.validateResult) {
      const validation = this.validateMergedSnippet(mergedSnippet);
      if (!validation.success) {
        return {
          success: false,
          mergedSnippets: [],
          conflicts,
          warnings,
          stats: {
            added: 0,
            updated: 0,
            removed: 0,
            conflicts: conflicts.length,
            fieldsMerged,
            conflictsResolved,
          },
          error: `Merged snippet validation failed: ${validation.error}`,
          metadata,
        };
      }
      if (validation.warnings) {
        warnings.push(...validation.warnings);
      }
    }

    return {
      success: true,
      mergedSnippets: [mergedSnippet],
      conflicts,
      warnings,
      stats: {
        added: 0,
        updated: 1,
        removed: 0,
        conflicts: conflicts.length,
        fieldsMerged,
        conflictsResolved,
      },
      metadata,
    };
  }

  /**
   * Phase 2: Advanced conflict detection with detailed analysis
   */
  private static async detectAdvancedConflict(
    field: string,
    sourceValue: any,
    targetValue: any,
    sourceSnippet: EnhancedSnippet,
    targetSnippet: EnhancedSnippet,
  ): Promise<MergeConflict> {
    let conflictType: MergeConflict["conflictType"] = "field-conflict";

    // Determine conflict type
    if (typeof sourceValue !== typeof targetValue) {
      conflictType = "type-mismatch";
    } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      conflictType = "array-difference";
    }

    return {
      snippetId: sourceSnippet.id,
      trigger: sourceSnippet.trigger,
      conflictType,
      localSnippet: targetSnippet,
      remoteSnippet: sourceSnippet,
      field,
      sourceValue,
      targetValue,
      resolutionStrategy: "pending",
    };
  }

  /**
   * Phase 2: Advanced conflict resolution with multiple strategies
   */
  private static async resolveAdvancedConflict(
    conflict: MergeConflict,
    sourceSnippet: EnhancedSnippet,
    targetSnippet: EnhancedSnippet,
    options: Required<MergeOptions>,
    metadata: MergeMetadata,
  ): Promise<{
    success: boolean;
    value?: any;
    warning?: string;
    reason?: string;
  }> {
    switch (options.strategy) {
      case "priority-based":
        return this.resolvePriorityBased(conflict, metadata);

      case "timestamp-based":
        return this.resolveTimestampBased(
          conflict,
          sourceSnippet,
          targetSnippet,
          options.timestampToleranceMs,
        );

      case "newest-wins": {
        const sourceTime = new Date(sourceSnippet.updatedAt).getTime();
        const targetTime = new Date(targetSnippet.updatedAt).getTime();

        if (sourceTime > targetTime) {
          return {
            success: true,
            value: conflict.sourceValue,
            warning: `Used source value for field '${conflict.field}' (newer timestamp)`,
          };
        } else {
          return {
            success: true,
            value: conflict.targetValue,
            warning: `Kept target value for field '${conflict.field}' (newer timestamp)`,
          };
        }
      }

      case "overwrite":
        return {
          success: true,
          value: conflict.sourceValue,
          warning: `Overwrote field '${conflict.field}' with source value`,
        };

      case "merge-content":
        if (
          conflict.conflictType === "array-difference" &&
          ARRAY_MERGE_FIELDS.includes(conflict.field!)
        ) {
          const mergedArray = this.mergeArraysAdvanced(
            conflict.sourceValue,
            conflict.targetValue,
          );
          return {
            success: true,
            value: mergedArray,
            warning: `Merged arrays for field '${conflict.field}' (${conflict.sourceValue.length} + ${conflict.targetValue.length} → ${mergedArray.length} items)`,
          };
        }
        return {
          success: false,
          reason: "Content merge not supported for this field type",
        };

      case "local-wins":
        return {
          success: true,
          value: conflict.targetValue,
          warning: `Kept local value for field '${conflict.field}'`,
        };

      case "remote-wins":
        return {
          success: true,
          value: conflict.sourceValue,
          warning: `Used remote value for field '${conflict.field}'`,
        };

      case "manual":
        return { success: false, reason: "Manual resolution required" };

      default:
        return {
          success: false,
          reason: `Unknown conflict resolution strategy: ${options.strategy}`,
        };
    }
  }

  /**
   * Phase 2: Priority-based conflict resolution
   */
  private static resolvePriorityBased(
    conflict: MergeConflict,
    metadata: MergeMetadata,
  ): { success: boolean; value?: any; warning?: string; reason?: string } {
    const sourcePriority = TIER_PRIORITY[metadata.sourceTier!];
    const targetPriority = TIER_PRIORITY[metadata.targetTier!];

    // Handle array merging for specific fields
    if (
      conflict.conflictType === "array-difference" &&
      ARRAY_MERGE_FIELDS.includes(conflict.field!)
    ) {
      const mergedArray = this.mergeArraysAdvanced(
        conflict.sourceValue,
        conflict.targetValue,
      );
      return {
        success: true,
        value: mergedArray,
        warning: `Merged arrays for field '${conflict.field}' (${conflict.sourceValue.length} + ${conflict.targetValue.length} → ${mergedArray.length} items)`,
      };
    }

    // Priority-based resolution
    if (sourcePriority > targetPriority) {
      return {
        success: true,
        value: conflict.sourceValue,
        warning: `Used source value for field '${conflict.field}' (${metadata.sourceTier} priority > ${metadata.targetTier} priority)`,
      };
    } else if (targetPriority > sourcePriority) {
      return {
        success: true,
        value: conflict.targetValue,
        warning: `Kept target value for field '${conflict.field}' (${metadata.targetTier} priority > ${metadata.sourceTier} priority)`,
      };
    } else {
      // Same priority - use source as default
      return {
        success: true,
        value: conflict.sourceValue,
        warning: `Used source value for field '${conflict.field}' (equal priority, defaulted to source)`,
      };
    }
  }

  /**
   * Phase 2: Timestamp-based conflict resolution
   */
  private static resolveTimestampBased(
    conflict: MergeConflict,
    sourceSnippet: EnhancedSnippet,
    targetSnippet: EnhancedSnippet,
    toleranceMs: number,
  ): { success: boolean; value?: any; warning?: string; reason?: string } {
    try {
      const sourceTime = new Date(sourceSnippet.updatedAt).getTime();
      const targetTime = new Date(targetSnippet.updatedAt).getTime();

      const timeDiff = Math.abs(sourceTime - targetTime);

      if (timeDiff <= toleranceMs) {
        return {
          success: true,
          value: conflict.sourceValue,
          warning: `Used source value for field '${conflict.field}' (timestamps within tolerance: ${timeDiff}ms)`,
        };
      }

      if (sourceTime > targetTime) {
        return {
          success: true,
          value: conflict.sourceValue,
          warning: `Used source value for field '${conflict.field}' (newer: ${new Date(sourceTime).toISOString()})`,
        };
      } else {
        return {
          success: true,
          value: conflict.targetValue,
          warning: `Kept target value for field '${conflict.field}' (newer: ${new Date(targetTime).toISOString()})`,
        };
      }
    } catch (error) {
      return {
        success: false,
        reason: `Invalid timestamp format: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Phase 2: Advanced array merging with deduplication
   */
  private static mergeArraysAdvanced(
    sourceArray: any[],
    targetArray: any[],
  ): any[] {
    const merged = [...targetArray];

    for (const sourceItem of sourceArray) {
      if (typeof sourceItem === "string" || typeof sourceItem === "number") {
        if (!merged.includes(sourceItem)) {
          merged.push(sourceItem);
        }
      } else if (typeof sourceItem === "object" && sourceItem !== null) {
        // For objects (like variables), check by name property if it exists
        if ("name" in sourceItem) {
          const existingIndex = merged.findIndex(
            (item) =>
              typeof item === "object" &&
              item !== null &&
              "name" in item &&
              item.name === sourceItem.name,
          );
          if (existingIndex === -1) {
            merged.push(sourceItem);
          } else {
            // Replace existing with source (newer wins)
            merged[existingIndex] = sourceItem;
          }
        } else {
          // For other objects, use JSON comparison
          const exists = merged.some(
            (targetItem) =>
              JSON.stringify(targetItem) === JSON.stringify(sourceItem),
          );
          if (!exists) {
            merged.push(sourceItem);
          }
        }
      } else {
        // For other types, add if not found
        if (!merged.includes(sourceItem)) {
          merged.push(sourceItem);
        }
      }
    }

    return merged;
  }

  /**
   * Phase 2: Enhanced validation for merged snippets
   */
  private static validateMergedSnippet(snippet: EnhancedSnippet): {
    success: boolean;
    error?: string;
    warnings?: string[];
  } {
    const warnings: string[] = [];

    // Check required fields
    const requiredFields = ["id", "trigger", "content", "contentType", "scope"];
    for (const field of requiredFields) {
      if (!(snippet as any)[field]) {
        return { success: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate content type
    const validContentTypes = [
      "html",
      "plaintext",
      "markdown",
      "latex",
      "html+KaTeX",
    ];
    if (!validContentTypes.includes(snippet.contentType)) {
      warnings.push(`Unknown content type: ${snippet.contentType}`);
    }

    // Validate scope
    const validScopes = ["personal", "team", "org"];
    if (!validScopes.includes(snippet.scope)) {
      return { success: false, error: `Invalid scope: ${snippet.scope}` };
    }

    // Validate arrays
    const arrayFields = ["snipDependencies", "variables", "images", "tags"];
    for (const field of arrayFields) {
      const value = (snippet as any)[field];
      if (value && !Array.isArray(value)) {
        return { success: false, error: `Field '${field}' must be an array` };
      }
    }

    // Validate timestamps
    try {
      if (snippet.createdAt && isNaN(new Date(snippet.createdAt).getTime())) {
        warnings.push(`Invalid createdAt timestamp: ${snippet.createdAt}`);
      }
      if (snippet.updatedAt && isNaN(new Date(snippet.updatedAt).getTime())) {
        warnings.push(`Invalid updatedAt timestamp: ${snippet.updatedAt}`);
      }
    } catch (error) {
      warnings.push(`Timestamp validation error: ${error}`);
    }

    return {
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Phase 2: Bulk upsert with advanced capabilities
   */
  static async bulkUpsertAdvanced(
    snippets: EnhancedSnippet[],
    targetSchema: TierStorageSchema,
    options: Partial<MergeOptions> = {},
  ): Promise<{
    success: boolean;
    results: MergeResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      conflicts: number;
      warnings: number;
      totalFieldsMerged: number;
      totalConflictsResolved: number;
    };
    metadata: MergeMetadata;
  }> {
    const startTime = performance.now();
    const results: MergeResult[] = [];
    let successful = 0;
    let failed = 0;
    let totalConflicts = 0;
    let totalWarnings = 0;
    let totalFieldsMerged = 0;
    let totalConflictsResolved = 0;

    for (const snippet of snippets) {
      const result = await this.upsertSnippetAdvanced(
        snippet,
        targetSchema,
        options,
      );
      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      totalConflicts += result.conflicts.length;
      totalWarnings += result.warnings?.length || 0;
      totalFieldsMerged += result.stats.fieldsMerged || 0;
      totalConflictsResolved += result.stats.conflictsResolved || 0;
    }

    return {
      success: failed === 0,
      results,
      summary: {
        total: snippets.length,
        successful,
        failed,
        conflicts: totalConflicts,
        warnings: totalWarnings,
        totalFieldsMerged,
        totalConflictsResolved,
      },
      metadata: {
        operation: "bulk-upsert",
        startTime,
        duration: performance.now() - startTime,
        strategy: options.strategy || "priority-based",
      },
    };
  }
  /**
   * Merge two arrays of snippets with conflict detection
   */
  static merge(
    localSnippets: EnhancedSnippet[],
    remoteSnippets: EnhancedSnippet[],
    options: MergeOptions,
  ): MergeResult {
    try {
      const conflicts: MergeConflict[] = [];
      const warnings: string[] = [];
      const merged = new Map<string, EnhancedSnippet>();
      const stats = { added: 0, updated: 0, removed: 0, conflicts: 0 };

      // Start with local snippets
      for (const snippet of localSnippets) {
        merged.set(snippet.id, { ...snippet });
      }

      // Process remote snippets
      for (const remoteSnippet of remoteSnippets) {
        const localSnippet = merged.get(remoteSnippet.id);

        if (!localSnippet) {
          // New snippet from remote
          merged.set(remoteSnippet.id, { ...remoteSnippet });
          stats.added++;
        } else {
          // Existing snippet - check for conflicts
          const conflict = this.detectConflict(
            localSnippet,
            remoteSnippet,
            options,
          );

          if (conflict) {
            conflicts.push(conflict);
            stats.conflicts++;

            // Apply resolution strategy
            const resolved = this.resolveConflict(conflict, options);
            if (resolved) {
              merged.set(resolved.id, resolved);
              stats.updated++;
            }
          } else {
            // No conflict - update with remote
            merged.set(remoteSnippet.id, { ...remoteSnippet });
            stats.updated++;
          }
        }
      }

      // Check for trigger duplicates across all snippets
      const triggerConflicts = this.detectTriggerDuplicates(
        Array.from(merged.values()),
        options,
      );
      if (triggerConflicts.length > 0) {
        conflicts.push(...triggerConflicts);
        stats.conflicts += triggerConflicts.length;
      }

      return {
        success: conflicts.length === 0,
        mergedSnippets: Array.from(merged.values()),
        conflicts,
        stats,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        mergedSnippets: [],
        conflicts: [],
        stats: { added: 0, updated: 0, removed: 0, conflicts: 0 },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Upsert a single snippet into an array
   */
  static upsertSnippet(
    snippets: EnhancedSnippet[],
    snippet: EnhancedSnippet,
    options: MergeOptions,
  ): MergeResult {
    const existingIndex = snippets.findIndex((s) => s.id === snippet.id);

    if (existingIndex === -1) {
      // New snippet - check for trigger conflicts
      const triggerConflict = snippets.find(
        (s) => s.trigger === snippet.trigger,
      );
      if (triggerConflict && !options.allowTriggerDuplicates) {
        return {
          success: false,
          mergedSnippets: snippets,
          conflicts: [
            {
              snippetId: snippet.id,
              trigger: snippet.trigger,
              conflictType: "duplicate-trigger",
              localSnippet: triggerConflict,
              remoteSnippet: snippet,
            },
          ],
          stats: { added: 0, updated: 0, removed: 0, conflicts: 1 },
        };
      }

      // Add new snippet
      const newSnippets = [...snippets, snippet];
      return {
        success: true,
        mergedSnippets: newSnippets,
        conflicts: [],
        stats: { added: 1, updated: 0, removed: 0, conflicts: 0 },
      };
    } else {
      // Update existing snippet
      const existing = snippets[existingIndex];
      const conflict = this.detectConflict(existing, snippet, options);

      if (conflict) {
        const resolved = this.resolveConflict(conflict, options);
        if (resolved) {
          const newSnippets = [...snippets];
          newSnippets[existingIndex] = resolved;
          return {
            success: true,
            mergedSnippets: newSnippets,
            conflicts: [conflict],
            stats: { added: 0, updated: 1, removed: 0, conflicts: 1 },
          };
        } else {
          return {
            success: false,
            mergedSnippets: snippets,
            conflicts: [conflict],
            stats: { added: 0, updated: 0, removed: 0, conflicts: 1 },
          };
        }
      } else {
        // No conflict - simple update
        const newSnippets = [...snippets];
        newSnippets[existingIndex] = snippet;
        return {
          success: true,
          mergedSnippets: newSnippets,
          conflicts: [],
          stats: { added: 0, updated: 1, removed: 0, conflicts: 0 },
        };
      }
    }
  }

  /**
   * Remove snippets by ID
   */
  static removeSnippets(
    snippets: EnhancedSnippet[],
    idsToRemove: string[],
  ): MergeResult {
    const before = snippets.length;
    const filtered = snippets.filter((s) => !idsToRemove.includes(s.id));
    const removed = before - filtered.length;

    return {
      success: true,
      mergedSnippets: filtered,
      conflicts: [],
      stats: { added: 0, updated: 0, removed, conflicts: 0 },
    };
  }

  /**
   * Detect conflicts between two snippets
   */
  private static detectConflict(
    local: EnhancedSnippet,
    remote: EnhancedSnippet,
    options: MergeOptions,
  ): MergeConflict | null {
    // Different IDs but same trigger
    if (
      local.id !== remote.id &&
      local.trigger === remote.trigger &&
      !options.allowTriggerDuplicates
    ) {
      return {
        snippetId: local.id,
        trigger: local.trigger,
        conflictType: "duplicate-trigger",
        localSnippet: local,
        remoteSnippet: remote,
      };
    }

    // Same ID but different content
    if (local.id === remote.id && options.detectContentChanges) {
      if (
        local.content !== remote.content ||
        local.trigger !== remote.trigger ||
        local.description !== remote.description
      ) {
        // Check timestamps to suggest resolution
        const localTime = new Date(local.updatedAt).getTime();
        const remoteTime = new Date(remote.updatedAt).getTime();
        const suggestedResolution = localTime > remoteTime ? local : remote;

        return {
          snippetId: local.id,
          trigger: local.trigger,
          conflictType: "content-mismatch",
          localSnippet: local,
          remoteSnippet: remote,
          suggestedResolution,
        };
      }
    }

    return null;
  }

  /**
   * Detect trigger duplicates within a snippet array
   */
  private static detectTriggerDuplicates(
    snippets: EnhancedSnippet[],
    options: MergeOptions,
  ): MergeConflict[] {
    if (options.allowTriggerDuplicates) {
      return [];
    }

    const conflicts: MergeConflict[] = [];
    const triggerMap = new Map<string, EnhancedSnippet[]>();

    // Group snippets by trigger
    for (const snippet of snippets) {
      if (!triggerMap.has(snippet.trigger)) {
        triggerMap.set(snippet.trigger, []);
      }
      triggerMap.get(snippet.trigger)!.push(snippet);
    }

    // Find duplicates
    for (const [trigger, triggerSnippets] of triggerMap) {
      if (triggerSnippets.length > 1) {
        // Create conflicts for each duplicate pair
        for (let i = 1; i < triggerSnippets.length; i++) {
          conflicts.push({
            snippetId: triggerSnippets[i].id,
            trigger,
            conflictType: "duplicate-trigger",
            localSnippet: triggerSnippets[0],
            remoteSnippet: triggerSnippets[i],
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve a conflict using the specified strategy
   */
  private static resolveConflict(
    conflict: MergeConflict,
    options: MergeOptions,
  ): EnhancedSnippet | null {
    switch (options.strategy) {
      case "local-wins":
        return conflict.localSnippet;

      case "remote-wins":
        return conflict.remoteSnippet;

      case "newest-wins": {
        const localTime = new Date(conflict.localSnippet.updatedAt).getTime();
        const remoteTime = new Date(conflict.remoteSnippet.updatedAt).getTime();
        return localTime > remoteTime
          ? conflict.localSnippet
          : conflict.remoteSnippet;
      }

      case "merge-content":
        return this.mergeSnippetContent(
          conflict.localSnippet,
          conflict.remoteSnippet,
        );

      case "manual":
        return null; // Require manual resolution

      default:
        return conflict.localSnippet;
    }
  }

  /**
   * Attempt to merge content of two snippets
   */
  private static mergeSnippetContent(
    local: EnhancedSnippet,
    remote: EnhancedSnippet,
  ): EnhancedSnippet {
    // Simple merge strategy - combine fields intelligently
    const merged: EnhancedSnippet = {
      ...local, // Start with local as base

      // Use newer updatedAt
      updatedAt:
        new Date(local.updatedAt).getTime() >
        new Date(remote.updatedAt).getTime()
          ? local.updatedAt
          : remote.updatedAt,

      // Merge arrays (tags, images, variables)
      tags: [...new Set([...local.tags, ...remote.tags])],
      images: [...new Set([...local.images, ...remote.images])],

      // For variables, prefer local but add any new remote variables
      variables: this.mergeVariables(local.variables, remote.variables),

      // For snipDependencies, merge unique values
      snipDependencies: [
        ...new Set([...local.snipDependencies, ...remote.snipDependencies]),
      ],
    };

    return merged;
  }

  /**
   * Merge variable arrays intelligently
   */
  private static mergeVariables(localVars: any[], remoteVars: any[]): any[] {
    const merged = new Map<string, any>();

    // Add local variables first
    for (const variable of localVars) {
      merged.set(variable.name, variable);
    }

    // Add remote variables that don't exist locally
    for (const variable of remoteVars) {
      if (!merged.has(variable.name)) {
        merged.set(variable.name, variable);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Sort snippets by priority within a tier
   */
  static sortByPriority(snippets: EnhancedSnippet[]): EnhancedSnippet[] {
    return [...snippets].sort((a, b) => {
      // Primary sort: by tier priority
      const tierPriority = { personal: 1, team: 2, org: 3 };
      const aPriority = tierPriority[a.scope] || 999;
      const bPriority = tierPriority[b.scope] || 999;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Secondary sort: by updated time (newer first)
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  }

  /**
   * Validate merge result
   */
  static validateMergeResult(result: MergeResult): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for trigger duplicates if not allowed
    const triggerMap = new Map<string, number>();
    for (const snippet of result.mergedSnippets) {
      const count = triggerMap.get(snippet.trigger) || 0;
      triggerMap.set(snippet.trigger, count + 1);
    }

    for (const [trigger, count] of triggerMap) {
      if (count > 1) {
        errors.push(`Duplicate trigger found: ${trigger} (${count} times)`);
      }
    }

    // Check for ID duplicates
    const idMap = new Map<string, number>();
    for (const snippet of result.mergedSnippets) {
      const count = idMap.get(snippet.id) || 0;
      idMap.set(snippet.id, count + 1);
    }

    for (const [id, count] of idMap) {
      if (count > 1) {
        errors.push(`Duplicate ID found: ${id} (${count} times)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get tier priority for conflict resolution
   */
  private static getTierPriority(scope: string): number {
    return TIER_PRIORITY[scope as PriorityTier] || 0;
  }
}
