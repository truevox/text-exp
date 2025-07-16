/**
 * Merge Helper for Priority Tier Storage
 * Handles merging, conflict resolution, and deduplication of snippets
 */

import type {
  EnhancedSnippet,
  PriorityTier,
  TierStorageSchema,
} from "../types/snippet-formats.js";

/**
 * Conflict resolution strategies
 */
export type ConflictResolutionStrategy = 
  | "local-wins"      // Local changes take priority
  | "remote-wins"     // Remote changes take priority  
  | "newest-wins"     // Most recent updatedAt wins
  | "manual"          // Require manual resolution
  | "merge-content";  // Attempt to merge content

/**
 * Merge conflict information
 */
export interface MergeConflict {
  snippetId: string;
  trigger: string;
  conflictType: "duplicate-trigger" | "duplicate-id" | "content-mismatch";
  localSnippet: EnhancedSnippet;
  remoteSnippet: EnhancedSnippet;
  suggestedResolution?: EnhancedSnippet;
}

/**
 * Merge operation result
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
  };
  warnings?: string[];
  error?: string;
}

/**
 * Merge options
 */
export interface MergeOptions {
  strategy: ConflictResolutionStrategy;
  preserveLocalChanges?: boolean;
  detectContentChanges?: boolean;
  allowTriggerDuplicates?: boolean;
  tier?: PriorityTier;
}

/**
 * Handles merging and conflict resolution for snippet operations
 */
export class MergeHelper {
  /**
   * Merge two arrays of snippets with conflict detection
   */
  static merge(
    localSnippets: EnhancedSnippet[],
    remoteSnippets: EnhancedSnippet[],
    options: MergeOptions
  ): MergeResult {
    try {
      const conflicts: MergeConflict[] = [];
      const warnings: string[] = [];
      const merged = new Map<string, EnhancedSnippet>();
      let stats = { added: 0, updated: 0, removed: 0, conflicts: 0 };

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
          const conflict = this.detectConflict(localSnippet, remoteSnippet, options);
          
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
      const triggerConflicts = this.detectTriggerDuplicates(Array.from(merged.values()), options);
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
    options: MergeOptions
  ): MergeResult {
    const existingIndex = snippets.findIndex(s => s.id === snippet.id);
    
    if (existingIndex === -1) {
      // New snippet - check for trigger conflicts
      const triggerConflict = snippets.find(s => s.trigger === snippet.trigger);
      if (triggerConflict && !options.allowTriggerDuplicates) {
        return {
          success: false,
          mergedSnippets: snippets,
          conflicts: [{
            snippetId: snippet.id,
            trigger: snippet.trigger,
            conflictType: "duplicate-trigger",
            localSnippet: triggerConflict,
            remoteSnippet: snippet,
          }],
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
    idsToRemove: string[]
  ): MergeResult {
    const before = snippets.length;
    const filtered = snippets.filter(s => !idsToRemove.includes(s.id));
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
    options: MergeOptions
  ): MergeConflict | null {
    // Different IDs but same trigger
    if (local.id !== remote.id && local.trigger === remote.trigger && !options.allowTriggerDuplicates) {
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
      if (local.content !== remote.content || 
          local.trigger !== remote.trigger ||
          local.description !== remote.description) {
        
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
    options: MergeOptions
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
    options: MergeOptions
  ): EnhancedSnippet | null {
    switch (options.strategy) {
      case "local-wins":
        return conflict.localSnippet;

      case "remote-wins":
        return conflict.remoteSnippet;

      case "newest-wins":
        if (conflict.suggestedResolution) {
          return conflict.suggestedResolution;
        }
        // Fall back to timestamp comparison
        const localTime = new Date(conflict.localSnippet.updatedAt).getTime();
        const remoteTime = new Date(conflict.remoteSnippet.updatedAt).getTime();
        return localTime > remoteTime ? conflict.localSnippet : conflict.remoteSnippet;

      case "merge-content":
        return this.mergeSnippetContent(conflict.localSnippet, conflict.remoteSnippet);

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
    remote: EnhancedSnippet
  ): EnhancedSnippet {
    // Simple merge strategy - combine fields intelligently
    const merged: EnhancedSnippet = {
      ...local, // Start with local as base
      
      // Use newer updatedAt
      updatedAt: new Date(local.updatedAt).getTime() > new Date(remote.updatedAt).getTime() 
        ? local.updatedAt 
        : remote.updatedAt,

      // Merge arrays (tags, images, variables)
      tags: [...new Set([...local.tags, ...remote.tags])],
      images: [...new Set([...local.images, ...remote.images])],
      
      // For variables, prefer local but add any new remote variables
      variables: this.mergeVariables(local.variables, remote.variables),

      // For snipDependencies, merge unique values
      snipDependencies: [...new Set([...local.snipDependencies, ...remote.snipDependencies])],
    };

    return merged;
  }

  /**
   * Merge variable arrays intelligently
   */
  private static mergeVariables(
    localVars: any[],
    remoteVars: any[]
  ): any[] {
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
  static validateMergeResult(result: MergeResult): { valid: boolean; errors: string[] } {
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
}