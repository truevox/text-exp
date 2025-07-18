/**
 * Store Duplicate Validator
 * Prevents duplicate snippet IDs within single stores
 * Allows duplicates between stores, prevents within store
 */

import type { TextSnippet } from "../shared/types.js";
import type { EnhancedSnippet } from "../types/snippet-formats.js";

export interface DuplicateValidationResult {
  isValid: boolean;
  duplicateId?: string;
  duplicateIndices?: number[];
  conflictingSnippets?: (TextSnippet | EnhancedSnippet)[];
  message?: string;
}

export interface ValidationOptions {
  /** Whether to return detailed conflict information */
  includeConflictDetails?: boolean;

  /** Whether to suggest ID modifications for conflicts */
  suggestAlternatives?: boolean;

  /** Custom ID generation function */
  idGenerator?: () => string;

  /** Maximum number of alternative IDs to suggest */
  maxAlternatives?: number;
}

export interface StoreValidationResult {
  storeId: string;
  storeName: string;
  totalSnippets: number;
  validSnippets: number;
  duplicateCount: number;
  duplicateGroups: DuplicateGroup[];
  isValid: boolean;
  message?: string;
}

export interface DuplicateGroup {
  id: string;
  count: number;
  indices: number[];
  snippets: (TextSnippet | EnhancedSnippet)[];
  suggestedIds?: string[];
}

export interface ConflictResolution {
  action:
    | "keep-first"
    | "keep-last"
    | "keep-newest"
    | "keep-oldest"
    | "merge"
    | "rename";
  targetIndex?: number;
  newId?: string;
  mergeStrategy?: "content-priority" | "metadata-priority" | "user-choice";
}

export interface ValidationStats {
  totalStoresValidated: number;
  totalSnippetsValidated: number;
  totalDuplicatesFound: number;
  totalConflictsResolved: number;
  averageDuplicatesPerStore: number;
  processingTimeMs: number;
}

/**
 * Validates and prevents duplicate snippet IDs within single stores
 */
export class StoreDuplicateValidator {
  private validationHistory: Map<string, StoreValidationResult> = new Map();
  private lastStats: ValidationStats | null = null;
  private idCounter = 0;

  /**
   * Validate a single store for duplicate IDs
   */
  validateStore(
    storeId: string,
    storeName: string,
    snippets: (TextSnippet | EnhancedSnippet)[],
    options: ValidationOptions = {},
  ): StoreValidationResult {
    const startTime = Date.now();
    const {
      includeConflictDetails = true,
      suggestAlternatives = true,
      maxAlternatives = 3,
    } = options;

    // Group snippets by ID
    const idGroups = new Map<
      string,
      {
        indices: number[];
        snippets: (TextSnippet | EnhancedSnippet)[];
      }
    >();

    snippets.forEach((snippet, index) => {
      const id = snippet.id;
      if (!idGroups.has(id)) {
        idGroups.set(id, { indices: [], snippets: [] });
      }
      idGroups.get(id)!.indices.push(index);
      idGroups.get(id)!.snippets.push(snippet);
    });

    // Find duplicates
    const duplicateGroups: DuplicateGroup[] = [];
    let duplicateCount = 0;

    for (const [id, group] of idGroups) {
      if (group.indices.length > 1) {
        duplicateCount += group.indices.length - 1; // Count extras only

        const duplicateGroup: DuplicateGroup = {
          id,
          count: group.indices.length,
          indices: group.indices,
          snippets: group.snippets,
        };

        // Generate suggested alternative IDs if requested
        if (suggestAlternatives) {
          duplicateGroup.suggestedIds = this.generateAlternativeIds(
            id,
            snippets,
            maxAlternatives,
          );
        }

        duplicateGroups.push(duplicateGroup);
      }
    }

    const isValid = duplicateGroups.length === 0;
    const result: StoreValidationResult = {
      storeId,
      storeName,
      totalSnippets: snippets.length,
      validSnippets: snippets.length - duplicateCount,
      duplicateCount,
      duplicateGroups,
      isValid,
      message: isValid
        ? `Store "${storeName}" has no duplicate IDs`
        : `Store "${storeName}" has ${duplicateCount} duplicate IDs in ${duplicateGroups.length} groups`,
    };

    // Cache validation result
    this.validationHistory.set(storeId, result);

    return result;
  }

  /**
   * Validate multiple stores simultaneously
   */
  validateMultipleStores(
    stores: Array<{
      storeId: string;
      storeName: string;
      snippets: (TextSnippet | EnhancedSnippet)[];
    }>,
    options: ValidationOptions = {},
  ): StoreValidationResult[] {
    const startTime = Date.now();
    const results: StoreValidationResult[] = [];

    let totalSnippetsValidated = 0;
    let totalDuplicatesFound = 0;

    for (const store of stores) {
      const result = this.validateStore(
        store.storeId,
        store.storeName,
        store.snippets,
        options,
      );

      results.push(result);
      totalSnippetsValidated += result.totalSnippets;
      totalDuplicatesFound += result.duplicateCount;
    }

    // Update statistics
    this.lastStats = {
      totalStoresValidated: stores.length,
      totalSnippetsValidated,
      totalDuplicatesFound,
      totalConflictsResolved: 0, // Will be updated by resolution methods
      averageDuplicatesPerStore:
        stores.length > 0 ? totalDuplicatesFound / stores.length : 0,
      processingTimeMs: Date.now() - startTime,
    };

    return results;
  }

  /**
   * Check if a specific snippet ID would cause a conflict in a store
   */
  checkIdConflict(
    snippetId: string,
    storeSnippets: (TextSnippet | EnhancedSnippet)[],
    excludeIndex?: number,
  ): DuplicateValidationResult {
    const conflictingSnippets: (TextSnippet | EnhancedSnippet)[] = [];
    const conflictingIndices: number[] = [];

    storeSnippets.forEach((snippet, index) => {
      if (snippet.id === snippetId && index !== excludeIndex) {
        conflictingSnippets.push(snippet);
        conflictingIndices.push(index);
      }
    });

    const hasConflict = conflictingSnippets.length > 0;

    return {
      isValid: !hasConflict,
      duplicateId: hasConflict ? snippetId : undefined,
      duplicateIndices: hasConflict ? conflictingIndices : undefined,
      conflictingSnippets: hasConflict ? conflictingSnippets : undefined,
      message: hasConflict
        ? `ID "${snippetId}" conflicts with ${conflictingSnippets.length} existing snippets`
        : `ID "${snippetId}" is available`,
    };
  }

  /**
   * Generate a unique ID for a store
   */
  generateUniqueId(
    baseId: string,
    storeSnippets: (TextSnippet | EnhancedSnippet)[],
    options: ValidationOptions = {},
  ): string {
    const { idGenerator } = options;

    // Use custom ID generator if provided
    if (idGenerator) {
      let newId = idGenerator();
      while (this.checkIdConflict(newId, storeSnippets).isValid === false) {
        newId = idGenerator();
      }
      return newId;
    }

    // Default ID generation strategy
    const existingIds = new Set(storeSnippets.map((s) => s.id));

    // First try the base ID
    if (!existingIds.has(baseId)) {
      return baseId;
    }

    // Try numbered variants
    let counter = 1;
    while (counter < 1000) {
      // Prevent infinite loops
      const candidateId = `${baseId}-${counter}`;
      if (!existingIds.has(candidateId)) {
        return candidateId;
      }
      counter++;
    }

    // Fallback to UUID-like string
    return `${baseId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Resolve duplicate conflicts automatically
   */
  resolveConflicts(
    storeSnippets: (TextSnippet | EnhancedSnippet)[],
    resolution: ConflictResolution,
    duplicateGroups: DuplicateGroup[],
  ): (TextSnippet | EnhancedSnippet)[] {
    const resolvedSnippets = [...storeSnippets];
    let conflictsResolved = 0;

    for (const group of duplicateGroups) {
      const { id, indices, snippets } = group;

      switch (resolution.action) {
        case "keep-first":
          // Remove all but the first occurrence
          for (let i = indices.length - 1; i > 0; i--) {
            resolvedSnippets.splice(indices[i], 1);
          }
          conflictsResolved += indices.length - 1;
          break;

        case "keep-last":
          // Remove all but the last occurrence
          for (let i = indices.length - 2; i >= 0; i--) {
            resolvedSnippets.splice(indices[i], 1);
          }
          conflictsResolved += indices.length - 1;
          break;

        case "keep-newest":
          // Keep the snippet with the most recent updatedAt
          const newestIndex = this.findNewestSnippetIndex(snippets);
          for (let i = indices.length - 1; i >= 0; i--) {
            if (i !== newestIndex) {
              resolvedSnippets.splice(indices[i], 1);
            }
          }
          conflictsResolved += indices.length - 1;
          break;

        case "keep-oldest":
          // Keep the snippet with the oldest createdAt
          const oldestIndex = this.findOldestSnippetIndex(snippets);
          for (let i = indices.length - 1; i >= 0; i--) {
            if (i !== oldestIndex) {
              resolvedSnippets.splice(indices[i], 1);
            }
          }
          conflictsResolved += indices.length - 1;
          break;

        case "rename":
          // Rename all but the first occurrence
          for (let i = 1; i < indices.length; i++) {
            const newId = this.generateUniqueId(id, resolvedSnippets);
            resolvedSnippets[indices[i]] = {
              ...resolvedSnippets[indices[i]],
              id: newId,
            };
          }
          conflictsResolved += indices.length - 1;
          break;

        case "merge":
          // Merge all duplicates into the first occurrence
          const mergedSnippet = this.mergeSnippets(
            snippets,
            resolution.mergeStrategy,
          );
          resolvedSnippets[indices[0]] = mergedSnippet;
          // Remove other occurrences
          for (let i = indices.length - 1; i > 0; i--) {
            resolvedSnippets.splice(indices[i], 1);
          }
          conflictsResolved += indices.length - 1;
          break;
      }
    }

    // Update statistics
    if (this.lastStats) {
      this.lastStats.totalConflictsResolved += conflictsResolved;
    }

    return resolvedSnippets;
  }

  /**
   * Get validation history for a store
   */
  getValidationHistory(storeId: string): StoreValidationResult | undefined {
    return this.validationHistory.get(storeId);
  }

  /**
   * Get all validation history
   */
  getAllValidationHistory(): Map<string, StoreValidationResult> {
    return new Map(this.validationHistory);
  }

  /**
   * Clear validation history
   */
  clearValidationHistory(storeId?: string): void {
    if (storeId) {
      this.validationHistory.delete(storeId);
    } else {
      this.validationHistory.clear();
    }
  }

  /**
   * Get statistics from last validation operation
   */
  getLastStats(): ValidationStats | null {
    return this.lastStats;
  }

  /**
   * Generate alternative IDs for a conflicting ID
   */
  private generateAlternativeIds(
    conflictingId: string,
    storeSnippets: (TextSnippet | EnhancedSnippet)[],
    maxAlternatives: number,
  ): string[] {
    const alternatives: string[] = [];
    const existingIds = new Set(storeSnippets.map((s) => s.id));

    // Try numbered variants
    let counter = 1;
    while (alternatives.length < maxAlternatives && counter < 100) {
      const candidateId = `${conflictingId}-${counter}`;
      if (!existingIds.has(candidateId)) {
        alternatives.push(candidateId);
      }
      counter++;
    }

    // Fill remaining slots with timestamp-based IDs
    while (alternatives.length < maxAlternatives) {
      const timestampId = `${conflictingId}-${Date.now()}-${this.idCounter++}`;
      if (!existingIds.has(timestampId)) {
        alternatives.push(timestampId);
      }
    }

    return alternatives;
  }

  /**
   * Find the index of the newest snippet in a group
   */
  private findNewestSnippetIndex(
    snippets: (TextSnippet | EnhancedSnippet)[],
  ): number {
    let newestIndex = 0;
    let newestDate = this.getSnippetDate(snippets[0], "updated");

    for (let i = 1; i < snippets.length; i++) {
      const snippetDate = this.getSnippetDate(snippets[i], "updated");
      if (snippetDate > newestDate) {
        newestDate = snippetDate;
        newestIndex = i;
      }
    }

    return newestIndex;
  }

  /**
   * Find the index of the oldest snippet in a group
   */
  private findOldestSnippetIndex(
    snippets: (TextSnippet | EnhancedSnippet)[],
  ): number {
    let oldestIndex = 0;
    let oldestDate = this.getSnippetDate(snippets[0], "created");

    for (let i = 1; i < snippets.length; i++) {
      const snippetDate = this.getSnippetDate(snippets[i], "created");
      if (snippetDate < oldestDate) {
        oldestDate = snippetDate;
        oldestIndex = i;
      }
    }

    return oldestIndex;
  }

  /**
   * Get a Date object from a snippet (handles both TextSnippet and EnhancedSnippet)
   */
  private getSnippetDate(
    snippet: TextSnippet | EnhancedSnippet,
    type: "created" | "updated",
  ): Date {
    if (type === "created") {
      if ("createdAt" in snippet) {
        return snippet.createdAt instanceof Date
          ? snippet.createdAt
          : new Date(snippet.createdAt);
      }
    } else {
      if ("updatedAt" in snippet) {
        return snippet.updatedAt instanceof Date
          ? snippet.updatedAt
          : new Date(snippet.updatedAt);
      }
    }

    // Fallback to current date
    return new Date();
  }

  /**
   * Merge multiple snippets into one
   */
  private mergeSnippets(
    snippets: (TextSnippet | EnhancedSnippet)[],
    strategy:
      | "content-priority"
      | "metadata-priority"
      | "user-choice" = "content-priority",
  ): TextSnippet | EnhancedSnippet {
    if (snippets.length === 0) {
      throw new Error("Cannot merge empty snippet array");
    }

    if (snippets.length === 1) {
      return snippets[0];
    }

    const base = { ...snippets[0] };

    switch (strategy) {
      case "content-priority":
        // Use the snippet with the longest content
        const longestContent = snippets.reduce((prev, current) =>
          current.content.length > prev.content.length ? current : prev,
        );
        base.content = longestContent.content;
        base.updatedAt = new Date();
        break;

      case "metadata-priority":
        // Use the newest snippet for metadata
        const newest = snippets.reduce((prev, current) => {
          const prevDate = this.getSnippetDate(prev, "updated");
          const currentDate = this.getSnippetDate(current, "updated");
          return currentDate > prevDate ? current : prev;
        });
        return newest;

      case "user-choice":
        // For now, default to first snippet (would need UI integration for true user choice)
        return snippets[0];
    }

    return base;
  }
}

/**
 * Global instance for easy access
 */
let globalValidator: StoreDuplicateValidator | null = null;

/**
 * Get or create the global validator instance
 */
export function getStoreDuplicateValidator(): StoreDuplicateValidator {
  if (!globalValidator) {
    globalValidator = new StoreDuplicateValidator();
  }
  return globalValidator;
}

/**
 * Validate a store for duplicate IDs (convenience function)
 */
export function validateStoreForDuplicates(
  storeId: string,
  storeName: string,
  snippets: (TextSnippet | EnhancedSnippet)[],
  options?: ValidationOptions,
): StoreValidationResult {
  return getStoreDuplicateValidator().validateStore(
    storeId,
    storeName,
    snippets,
    options,
  );
}

/**
 * Check if a snippet ID would cause a conflict (convenience function)
 */
export function checkSnippetIdConflict(
  snippetId: string,
  storeSnippets: (TextSnippet | EnhancedSnippet)[],
  excludeIndex?: number,
): DuplicateValidationResult {
  return getStoreDuplicateValidator().checkIdConflict(
    snippetId,
    storeSnippets,
    excludeIndex,
  );
}

/**
 * Generate a unique ID for a store (convenience function)
 */
export function generateUniqueSnippetId(
  baseId: string,
  storeSnippets: (TextSnippet | EnhancedSnippet)[],
  options?: ValidationOptions,
): string {
  return getStoreDuplicateValidator().generateUniqueId(
    baseId,
    storeSnippets,
    options,
  );
}
