/**
 * Expansion Deduplicator
 * Handles duplicate snippet deduplication in expansion UI
 * Provides priority-based ordering and cross-store deduplication
 */

import type { TextSnippet } from "../shared/types.js";
import type {
  EnhancedSnippet,
  PriorityTier,
} from "../types/snippet-formats.js";

export interface StoreInfo {
  storeId: string;
  storeName: string;
  displayName: string;
  tierName: PriorityTier;
  priority: number; // 0 = highest priority (appdata), 1+ = secondary stores
  isReadOnly: boolean;
}

export interface SnippetWithStore {
  snippet: TextSnippet | EnhancedSnippet;
  storeInfo: StoreInfo;
}

export interface DeduplicationOptions {
  /** Priority ordering method: 'store-first' (default) or 'usage-first' */
  priorityMethod?: "store-first" | "usage-first";

  /** Enable alphabetical fallback for ties */
  enableAlphabeticalFallback?: boolean;

  /** Include usage metrics in deduplication results */
  includeUsageMetrics?: boolean;

  /** Maximum number of results to return */
  maxResults?: number;

  /** Store IDs to exclude from results */
  excludeStoreIds?: string[];

  /** Only include snippets from specified stores */
  includeStoreIds?: string[];

  /** Filter by content type */
  contentTypes?: (
    | "html"
    | "plaintext"
    | "markdown"
    | "latex"
    | "html+KaTeX"
    | "text"
  )[];
}

export interface DeduplicationResult {
  /** Unique snippet ID */
  id: string;

  /** Trigger text */
  trigger: string;

  /** Primary snippet (highest priority) */
  primarySnippet: SnippetWithStore;

  /** All duplicate instances across stores */
  duplicates: SnippetWithStore[];

  /** Total count of duplicates */
  duplicateCount: number;

  /** Store priority of primary snippet */
  priority: number;

  /** Usage metrics (if available) */
  usageMetrics?: {
    totalUsageCount: number;
    lastUsed?: Date;
    averageUsage: number;
  };
}

export interface DeduplicationStats {
  totalSnippets: number;
  uniqueSnippets: number;
  duplicatesRemoved: number;
  storesProcessed: number;
  processingTimeMs: number;
}

/**
 * Handles deduplication of snippets across multiple stores
 * Implements priority-based ordering with store hierarchy
 */
export class ExpansionDeduplicator {
  private storeInfoMap: Map<string, StoreInfo> = new Map();
  private lastStats: DeduplicationStats | null = null;

  /**
   * Register store information for priority calculation
   */
  registerStore(storeInfo: StoreInfo): void {
    this.storeInfoMap.set(storeInfo.storeId, storeInfo);
  }

  /**
   * Register multiple stores at once
   */
  registerStores(storeInfos: StoreInfo[]): void {
    storeInfos.forEach((store) => this.registerStore(store));
  }

  /**
   * Get registered store information
   */
  getStoreInfo(storeId: string): StoreInfo | undefined {
    return this.storeInfoMap.get(storeId);
  }

  /**
   * Clear all registered stores
   */
  clearStores(): void {
    this.storeInfoMap.clear();
  }

  /**
   * Deduplicate snippets by ID with priority ordering
   */
  deduplicateById(
    snippetsWithStores: SnippetWithStore[],
    options: DeduplicationOptions = {},
  ): DeduplicationResult[] {
    const startTime = Date.now();
    const {
      priorityMethod = "store-first",
      enableAlphabeticalFallback = true,
      includeUsageMetrics = false,
      maxResults,
      excludeStoreIds = [],
      includeStoreIds,
      contentTypes,
    } = options;

    // Filter by store IDs if specified
    let filteredSnippets = snippetsWithStores;
    if (includeStoreIds && includeStoreIds.length > 0) {
      filteredSnippets = filteredSnippets.filter((s) =>
        includeStoreIds.includes(s.storeInfo.storeId),
      );
    }
    if (excludeStoreIds.length > 0) {
      filteredSnippets = filteredSnippets.filter(
        (s) => !excludeStoreIds.includes(s.storeInfo.storeId),
      );
    }

    // Filter by content types if specified
    if (contentTypes && contentTypes.length > 0) {
      filteredSnippets = filteredSnippets.filter((s) => {
        const contentType = this.getSnippetContentType(s.snippet);
        return contentTypes.includes(contentType);
      });
    }

    // Group snippets by ID
    const snippetGroups = new Map<string, SnippetWithStore[]>();

    filteredSnippets.forEach((snippetWithStore) => {
      const id = snippetWithStore.snippet.id;
      if (!snippetGroups.has(id)) {
        snippetGroups.set(id, []);
      }
      snippetGroups.get(id)!.push(snippetWithStore);
    });

    // Process each group to find primary snippet and duplicates
    const results: DeduplicationResult[] = [];

    for (const [id, group] of snippetGroups) {
      if (group.length === 0) continue;

      // Sort group by priority to find primary snippet
      const sortedGroup = this.sortByPriority(
        group,
        priorityMethod,
        enableAlphabeticalFallback,
      );
      const primarySnippet = sortedGroup[0];
      const duplicates = sortedGroup.slice(1);

      // Calculate usage metrics if requested
      let usageMetrics;
      if (includeUsageMetrics) {
        usageMetrics = this.calculateUsageMetrics(group);
      }

      const result: DeduplicationResult = {
        id,
        trigger: primarySnippet.snippet.trigger,
        primarySnippet,
        duplicates,
        duplicateCount: duplicates.length,
        priority: primarySnippet.storeInfo.priority,
        usageMetrics,
      };

      results.push(result);
    }

    // Sort results by priority and trigger (alphabetical fallback)
    results.sort((a, b) => {
      // First sort by store priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then alphabetically by trigger
      if (enableAlphabeticalFallback) {
        return a.trigger.localeCompare(b.trigger);
      }

      return 0;
    });

    // Apply max results limit
    const finalResults = maxResults ? results.slice(0, maxResults) : results;

    // Update stats
    this.lastStats = {
      totalSnippets: filteredSnippets.length,
      uniqueSnippets: finalResults.length,
      duplicatesRemoved: filteredSnippets.length - finalResults.length,
      storesProcessed: new Set(filteredSnippets.map((s) => s.storeInfo.storeId))
        .size,
      processingTimeMs: Date.now() - startTime,
    };

    return finalResults;
  }

  /**
   * Deduplicate snippets by trigger text
   */
  deduplicateByTrigger(
    snippetsWithStores: SnippetWithStore[],
    options: DeduplicationOptions = {},
  ): DeduplicationResult[] {
    const startTime = Date.now();
    const {
      priorityMethod = "store-first",
      enableAlphabeticalFallback = true,
      includeUsageMetrics = false,
      maxResults,
      excludeStoreIds = [],
      includeStoreIds,
      contentTypes,
    } = options;

    // Filter by store IDs if specified
    let filteredSnippets = snippetsWithStores;
    if (includeStoreIds && includeStoreIds.length > 0) {
      filteredSnippets = filteredSnippets.filter((s) =>
        includeStoreIds.includes(s.storeInfo.storeId),
      );
    }
    if (excludeStoreIds.length > 0) {
      filteredSnippets = filteredSnippets.filter(
        (s) => !excludeStoreIds.includes(s.storeInfo.storeId),
      );
    }

    // Filter by content types if specified
    if (contentTypes && contentTypes.length > 0) {
      filteredSnippets = filteredSnippets.filter((s) => {
        const contentType = this.getSnippetContentType(s.snippet);
        return contentTypes.includes(contentType);
      });
    }

    // Group snippets by trigger
    const snippetGroups = new Map<string, SnippetWithStore[]>();

    filteredSnippets.forEach((snippetWithStore) => {
      const trigger = snippetWithStore.snippet.trigger;
      if (!snippetGroups.has(trigger)) {
        snippetGroups.set(trigger, []);
      }
      snippetGroups.get(trigger)!.push(snippetWithStore);
    });

    // Process each group to find primary snippet and duplicates
    const results: DeduplicationResult[] = [];

    for (const [trigger, group] of snippetGroups) {
      if (group.length === 0) continue;

      // Sort group by priority to find primary snippet
      const sortedGroup = this.sortByPriority(
        group,
        priorityMethod,
        enableAlphabeticalFallback,
      );
      const primarySnippet = sortedGroup[0];
      const duplicates = sortedGroup.slice(1);

      // Calculate usage metrics if requested
      let usageMetrics;
      if (includeUsageMetrics) {
        usageMetrics = this.calculateUsageMetrics(group);
      }

      const result: DeduplicationResult = {
        id: primarySnippet.snippet.id,
        trigger,
        primarySnippet,
        duplicates,
        duplicateCount: duplicates.length,
        priority: primarySnippet.storeInfo.priority,
        usageMetrics,
      };

      results.push(result);
    }

    // Sort results by priority and trigger
    results.sort((a, b) => {
      // First sort by store priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // Then alphabetically by trigger
      if (enableAlphabeticalFallback) {
        return a.trigger.localeCompare(b.trigger);
      }

      return 0;
    });

    // Apply max results limit
    const finalResults = maxResults ? results.slice(0, maxResults) : results;

    // Update stats
    this.lastStats = {
      totalSnippets: filteredSnippets.length,
      uniqueSnippets: finalResults.length,
      duplicatesRemoved: filteredSnippets.length - finalResults.length,
      storesProcessed: new Set(filteredSnippets.map((s) => s.storeInfo.storeId))
        .size,
      processingTimeMs: Date.now() - startTime,
    };

    return finalResults;
  }

  /**
   * Get statistics from the last deduplication operation
   */
  getLastStats(): DeduplicationStats | null {
    return this.lastStats;
  }

  /**
   * Sort snippets by priority (store-first or usage-first)
   */
  private sortByPriority(
    snippets: SnippetWithStore[],
    priorityMethod: "store-first" | "usage-first",
    enableAlphabeticalFallback: boolean,
  ): SnippetWithStore[] {
    return snippets.sort((a, b) => {
      if (priorityMethod === "usage-first") {
        // Usage-based priority (future enhancement)
        const aUsage = this.getSnippetUsageCount(a.snippet);
        const bUsage = this.getSnippetUsageCount(b.snippet);

        if (aUsage !== bUsage) {
          return bUsage - aUsage; // Higher usage first
        }
      }

      // Store-based priority (current implementation)
      if (a.storeInfo.priority !== b.storeInfo.priority) {
        return a.storeInfo.priority - b.storeInfo.priority; // Lower priority number = higher priority
      }

      // Alphabetical fallback by trigger
      if (enableAlphabeticalFallback) {
        return a.snippet.trigger.localeCompare(b.snippet.trigger);
      }

      return 0;
    });
  }

  /**
   * Calculate usage metrics for a group of snippets
   */
  private calculateUsageMetrics(snippets: SnippetWithStore[]): {
    totalUsageCount: number;
    lastUsed?: Date;
    averageUsage: number;
  } {
    let totalUsageCount = 0;
    let lastUsed: Date | undefined;
    let usageCount = 0;

    snippets.forEach(({ snippet }) => {
      const usage = this.getSnippetUsageCount(snippet);
      const lastUsedDate = this.getSnippetLastUsed(snippet);

      totalUsageCount += usage;
      if (usage > 0) usageCount++;

      if (lastUsedDate && (!lastUsed || lastUsedDate > lastUsed)) {
        lastUsed = lastUsedDate;
      }
    });

    const averageUsage = usageCount > 0 ? totalUsageCount / usageCount : 0;

    return {
      totalUsageCount,
      lastUsed,
      averageUsage,
    };
  }

  /**
   * Get snippet usage count (supports both TextSnippet and EnhancedSnippet)
   */
  private getSnippetUsageCount(snippet: TextSnippet | EnhancedSnippet): number {
    if ("usageCount" in snippet && typeof snippet.usageCount === "number") {
      return snippet.usageCount;
    }
    return 0;
  }

  /**
   * Get snippet last used date (supports both TextSnippet and EnhancedSnippet)
   */
  private getSnippetLastUsed(
    snippet: TextSnippet | EnhancedSnippet,
  ): Date | undefined {
    if ("lastUsed" in snippet && snippet.lastUsed instanceof Date) {
      return snippet.lastUsed;
    }
    return undefined;
  }

  /**
   * Get snippet content type (supports both TextSnippet and EnhancedSnippet)
   */
  private getSnippetContentType(
    snippet: TextSnippet | EnhancedSnippet,
  ): "html" | "plaintext" | "markdown" | "latex" | "html+KaTeX" | "text" {
    if ("contentType" in snippet && snippet.contentType) {
      return snippet.contentType;
    }
    return "plaintext"; // Default fallback
  }
}
