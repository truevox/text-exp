/**
 * Batch Update Manager for Mirrored Snippets
 * Handles batch operations for snippets across multiple stores
 */

import type { TextSnippet } from "../shared/types.js";
import type { MultiFileSelection } from "../ui/components/multi-file-selector.js";
import type {
  PriorityTier,
  EnhancedSnippet,
  TierStorageSchema,
} from "../types/snippet-formats.js";

export interface BatchUpdateOperation {
  type: "create" | "update" | "delete";
  snippetId: string;
  snippet?: TextSnippet;
  targetStores: MultiFileSelection[];
  timestamp: number;
}

export interface BatchUpdateResult {
  operation: BatchUpdateOperation;
  results: StoreUpdateResult[];
  overallSuccess: boolean;
  errors: string[];
  warnings: string[];
}

export interface StoreUpdateResult {
  storeFileName: string;
  tierName: PriorityTier;
  success: boolean;
  error?: string;
  conflictResolution?: "overwrite" | "skip" | "merge";
  previousVersion?: EnhancedSnippet;
  newVersion?: EnhancedSnippet;
}

export interface BatchUpdateOptions {
  allowPartialSuccess?: boolean;
  rollbackOnFailure?: boolean;
  maxConcurrentOperations?: number;
  conflictResolution?: "overwrite" | "skip" | "merge";
  dryRun?: boolean;
}

export interface ConflictResolutionStrategy {
  onConflict: (
    existing: EnhancedSnippet,
    incoming: EnhancedSnippet,
    store: MultiFileSelection,
  ) => Promise<"overwrite" | "skip" | "merge" | EnhancedSnippet>;
}

/**
 * Manager for batch update operations across multiple snippet stores
 */
export class BatchUpdateManager {
  private pendingOperations: BatchUpdateOperation[] = [];
  private activeOperations: Map<string, Promise<BatchUpdateResult>> = new Map();
  private operationHistory: BatchUpdateResult[] = [];
  private maxHistorySize = 100;

  constructor(
    private storeLoader: StoreLoaderInterface,
    private options: BatchUpdateOptions = {},
  ) {
    this.options = {
      allowPartialSuccess: true,
      rollbackOnFailure: false,
      maxConcurrentOperations: 3,
      conflictResolution: "overwrite",
      dryRun: false,
      ...options,
    };
  }

  /**
   * Create a snippet in multiple stores
   */
  async createSnippet(
    snippet: TextSnippet,
    targetStores: MultiFileSelection[],
    options?: Partial<BatchUpdateOptions>,
  ): Promise<BatchUpdateResult> {
    const operation: BatchUpdateOperation = {
      type: "create",
      snippetId: snippet.id,
      snippet,
      targetStores,
      timestamp: Date.now(),
    };

    return this.executeOperation(operation, options);
  }

  /**
   * Update a snippet across multiple stores
   */
  async updateSnippet(
    snippet: TextSnippet,
    targetStores: MultiFileSelection[],
    options?: Partial<BatchUpdateOptions>,
  ): Promise<BatchUpdateResult> {
    const operation: BatchUpdateOperation = {
      type: "update",
      snippetId: snippet.id,
      snippet,
      targetStores,
      timestamp: Date.now(),
    };

    return this.executeOperation(operation, options);
  }

  /**
   * Delete a snippet from multiple stores
   */
  async deleteSnippet(
    snippetId: string,
    targetStores: MultiFileSelection[],
    options?: Partial<BatchUpdateOptions>,
  ): Promise<BatchUpdateResult> {
    const operation: BatchUpdateOperation = {
      type: "delete",
      snippetId,
      targetStores,
      timestamp: Date.now(),
    };

    return this.executeOperation(operation, options);
  }

  /**
   * Execute a batch operation
   */
  private async executeOperation(
    operation: BatchUpdateOperation,
    options?: Partial<BatchUpdateOptions>,
  ): Promise<BatchUpdateResult> {
    const mergedOptions = { ...this.options, ...options };
    const operationKey = `${operation.type}-${operation.snippetId}-${operation.timestamp}`;

    // Check if operation is already running
    if (this.activeOperations.has(operationKey)) {
      return this.activeOperations.get(operationKey)!;
    }

    // Create operation promise
    const operationPromise = this.performBatchUpdate(operation, mergedOptions);
    this.activeOperations.set(operationKey, operationPromise);

    try {
      const result = await operationPromise;
      this.addToHistory(result);
      return result;
    } finally {
      this.activeOperations.delete(operationKey);
    }
  }

  /**
   * Perform the actual batch update
   */
  private async performBatchUpdate(
    operation: BatchUpdateOperation,
    options: BatchUpdateOptions,
  ): Promise<BatchUpdateResult> {
    const results: StoreUpdateResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(
      `🔄 Starting batch ${operation.type} operation for snippet: ${operation.snippetId}`,
    );

    // Group stores by tier for optimal processing
    const storesByTier = this.groupStoresByTier(operation.targetStores);

    // Process each tier
    for (const [tierName, stores] of Object.entries(storesByTier)) {
      console.log(`📁 Processing ${stores.length} stores in ${tierName} tier`);

      // Process stores in parallel within each tier
      const tierResults = await this.processStoresInTier(
        operation,
        stores,
        tierName as PriorityTier,
        options,
      );

      results.push(...tierResults);
    }

    // Check overall success
    const successfulResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    if (failedResults.length > 0) {
      errors.push(`${failedResults.length} store(s) failed to update`);
      failedResults.forEach((result) => {
        if (result.error) {
          errors.push(`${result.storeFileName}: ${result.error}`);
        }
      });
    }

    const overallSuccess = options.allowPartialSuccess
      ? successfulResults.length > 0
      : failedResults.length === 0;

    // Handle rollback if needed
    if (!overallSuccess && options.rollbackOnFailure) {
      await this.rollbackOperation(operation, successfulResults);
      errors.push("Operation rolled back due to failures");
    }

    console.log(
      `✅ Batch operation completed: ${successfulResults.length}/${results.length} stores updated successfully`,
    );

    return {
      operation,
      results,
      overallSuccess,
      errors,
      warnings,
    };
  }

  /**
   * Process stores within a single tier
   */
  private async processStoresInTier(
    operation: BatchUpdateOperation,
    stores: MultiFileSelection[],
    tierName: PriorityTier,
    options: BatchUpdateOptions,
  ): Promise<StoreUpdateResult[]> {
    // Limit concurrency to prevent overwhelming the system
    const semaphore = new Semaphore(options.maxConcurrentOperations || 3);

    const promises = stores.map(async (store) => {
      await semaphore.acquire();
      try {
        return await this.processStoreUpdate(
          operation,
          store,
          tierName,
          options,
        );
      } finally {
        semaphore.release();
      }
    });

    return Promise.all(promises);
  }

  /**
   * Process update for a single store
   */
  private async processStoreUpdate(
    operation: BatchUpdateOperation,
    store: MultiFileSelection,
    tierName: PriorityTier,
    options: BatchUpdateOptions,
  ): Promise<StoreUpdateResult> {
    const result: StoreUpdateResult = {
      storeFileName: store.storeFileName,
      tierName,
      success: false,
      conflictResolution:
        store.conflictResolution || options.conflictResolution,
    };

    try {
      console.log(
        `🔧 Processing ${operation.type} for store: ${store.storeFileName}`,
      );

      if (options.dryRun) {
        console.log(
          `🧪 Dry run: Would ${operation.type} snippet ${operation.snippetId} in ${store.storeFileName}`,
        );
        result.success = true;
        return result;
      }

      // Load the store
      const storeData = await this.storeLoader.loadStore(
        tierName,
        store.storeFileName,
      );
      const existingSnippetIndex = storeData.snippets.findIndex(
        (s) => s.id === operation.snippetId,
      );
      const existingSnippet =
        existingSnippetIndex >= 0
          ? storeData.snippets[existingSnippetIndex]
          : undefined;

      switch (operation.type) {
        case "create":
          await this.handleCreateOperation(
            operation,
            store,
            storeData,
            existingSnippet,
            result,
          );
          break;
        case "update":
          await this.handleUpdateOperation(
            operation,
            store,
            storeData,
            existingSnippet,
            result,
            existingSnippetIndex,
          );
          break;
        case "delete":
          await this.handleDeleteOperation(
            operation,
            store,
            storeData,
            existingSnippet,
            result,
            existingSnippetIndex,
          );
          break;
      }

      // Save the store if changes were made
      if (result.success) {
        await this.storeLoader.saveStore(
          tierName,
          store.storeFileName,
          storeData,
        );
        console.log(`💾 Saved changes to store: ${store.storeFileName}`);
      }
    } catch (error) {
      console.error(`❌ Error processing store ${store.storeFileName}:`, error);
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * Handle create operation for a store
   */
  private async handleCreateOperation(
    operation: BatchUpdateOperation,
    store: MultiFileSelection,
    storeData: TierStorageSchema,
    existingSnippet: EnhancedSnippet | undefined,
    result: StoreUpdateResult,
  ): Promise<void> {
    if (!operation.snippet) {
      throw new Error("Snippet data required for create operation");
    }

    if (existingSnippet) {
      // Handle conflict
      switch (result.conflictResolution) {
        case "skip":
          console.log(
            `⏭️ Skipping create - snippet already exists in ${store.storeFileName}`,
          );
          result.success = true;
          return;
        case "overwrite":
          console.log(
            `🔄 Overwriting existing snippet in ${store.storeFileName}`,
          );
          break;
        case "merge":
          console.log(
            `🔀 Merging with existing snippet in ${store.storeFileName}`,
          );
          const enhancedOperation = this.convertToEnhancedSnippet(
            operation.snippet,
            store,
          );
          const mergedEnhanced = await this.mergeSnippets(
            existingSnippet,
            enhancedOperation,
          );
          // Convert back to TextSnippet for operation
          operation.snippet = this.convertToTextSnippet(mergedEnhanced);
          break;
      }
      result.previousVersion = existingSnippet;
    }

    if (!operation.snippet) {
      throw new Error("Snippet data required for create operation");
    }

    const enhancedSnippet = this.convertToEnhancedSnippet(
      operation.snippet,
      store,
    );

    if (existingSnippet) {
      // Replace existing
      const index = storeData.snippets.findIndex(
        (s) => s.id === operation.snippetId,
      );
      storeData.snippets[index] = enhancedSnippet;
    } else {
      // Add new snippet in priority order
      this.insertSnippetByPriority(storeData.snippets, enhancedSnippet);
    }

    result.newVersion = enhancedSnippet;
    result.success = true;
  }

  /**
   * Handle update operation for a store
   */
  private async handleUpdateOperation(
    operation: BatchUpdateOperation,
    store: MultiFileSelection,
    storeData: TierStorageSchema,
    existingSnippet: EnhancedSnippet | undefined,
    result: StoreUpdateResult,
    existingIndex: number,
  ): Promise<void> {
    if (!operation.snippet) {
      throw new Error("Snippet data required for update operation");
    }

    if (!existingSnippet) {
      throw new Error(
        `Snippet ${operation.snippetId} not found in store ${store.storeFileName}`,
      );
    }

    result.previousVersion = existingSnippet;

    let updatedSnippet = this.convertToEnhancedSnippet(
      operation.snippet,
      store,
    );

    // Handle merge if requested
    if (result.conflictResolution === "merge") {
      updatedSnippet = await this.mergeSnippets(
        existingSnippet,
        updatedSnippet,
      );
    }

    storeData.snippets[existingIndex] = updatedSnippet;

    // Re-sort if priority changed
    if (existingSnippet.scope !== updatedSnippet.scope) {
      storeData.snippets.sort(
        (a, b) => (b as any).priority - (a as any).priority,
      );
    }

    result.newVersion = updatedSnippet;
    result.success = true;
  }

  /**
   * Handle delete operation for a store
   */
  private async handleDeleteOperation(
    operation: BatchUpdateOperation,
    store: MultiFileSelection,
    storeData: TierStorageSchema,
    existingSnippet: EnhancedSnippet | undefined,
    result: StoreUpdateResult,
    existingIndex: number,
  ): Promise<void> {
    if (!existingSnippet) {
      console.log(
        `⏭️ Snippet ${operation.snippetId} not found in ${store.storeFileName} - skipping delete`,
      );
      result.success = true;
      return;
    }

    result.previousVersion = existingSnippet;
    storeData.snippets.splice(existingIndex, 1);
    result.success = true;
  }

  /**
   * Convert TextSnippet to EnhancedSnippet
   */
  private convertToEnhancedSnippet(
    snippet: TextSnippet,
    store: MultiFileSelection,
  ): EnhancedSnippet {
    return {
      id: snippet.id,
      trigger: snippet.trigger,
      content: snippet.content,
      contentType: (snippet.contentType === "html" ? "html" : "plaintext") as
        | "html"
        | "plaintext"
        | "latex",
      snipDependencies: [],
      description: snippet.description || "",
      scope: store.tierName,
      variables: (snippet.variables || []).map((v) => ({
        name: v.name,
        prompt: v.placeholder || v.name,
      })),
      images: [],
      tags: snippet.tags || [],
      createdAt: snippet.createdAt.toISOString(),
      createdBy: "user",
      updatedAt: snippet.updatedAt.toISOString(),
      updatedBy: "user",
    };
  }

  /**
   * Convert EnhancedSnippet to TextSnippet
   */
  private convertToTextSnippet(snippet: EnhancedSnippet): TextSnippet {
    return {
      id: snippet.id,
      trigger: snippet.trigger,
      content: snippet.content || "",
      contentType: snippet.contentType === "html" ? "html" : "plaintext",
      description: snippet.description,
      scope: snippet.scope,
      variables:
        snippet.variables?.map((v) => ({
          name: v.name,
          placeholder: v.prompt || v.name,
          defaultValue: "",
          required: false,
          type: "text",
        })) || [],
      tags: snippet.tags,
      createdAt: new Date(snippet.createdAt),
      updatedAt: new Date(snippet.updatedAt),
    };
  }

  /**
   * Insert snippet in priority order
   */
  private insertSnippetByPriority(
    snippets: EnhancedSnippet[],
    newSnippet: EnhancedSnippet,
  ): void {
    const priority = (newSnippet as any).priority || 100;
    let insertIndex = 0;

    for (let i = 0; i < snippets.length; i++) {
      const existingPriority = (snippets[i] as any).priority || 100;
      if (priority > existingPriority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }

    snippets.splice(insertIndex, 0, newSnippet);
  }

  /**
   * Merge two snippets
   */
  private async mergeSnippets(
    existing: EnhancedSnippet,
    incoming: EnhancedSnippet,
  ): Promise<EnhancedSnippet> {
    // Simple merge strategy - combine fields, preferring incoming for most fields
    return {
      ...existing,
      ...incoming,
      variables: [
        ...existing.variables,
        ...incoming.variables.filter(
          (v) => !existing.variables.some((ev) => ev.name === v.name),
        ),
      ],
      tags: [...new Set([...existing.tags, ...incoming.tags])],
      images: [...new Set([...existing.images, ...incoming.images])],
      updatedAt: new Date().toISOString(),
      updatedBy: "user",
    };
  }

  /**
   * Group stores by tier
   */
  private groupStoresByTier(
    stores: MultiFileSelection[],
  ): Record<string, MultiFileSelection[]> {
    return stores.reduce(
      (acc, store) => {
        const tier = store.tierName;
        if (!acc[tier]) acc[tier] = [];
        acc[tier].push(store);
        return acc;
      },
      {} as Record<string, MultiFileSelection[]>,
    );
  }

  /**
   * Rollback operation
   */
  private async rollbackOperation(
    operation: BatchUpdateOperation,
    successfulResults: StoreUpdateResult[],
  ): Promise<void> {
    console.log(
      `🔄 Rolling back ${successfulResults.length} successful operations`,
    );

    const rollbackPromises = successfulResults.map(async (result) => {
      try {
        if (operation.type === "create" || operation.type === "update") {
          // Restore previous version or delete if it was a create
          const storeData = await this.storeLoader.loadStore(
            result.tierName,
            result.storeFileName,
          );

          if (result.previousVersion) {
            // Restore previous version
            const index = storeData.snippets.findIndex(
              (s) => s.id === operation.snippetId,
            );
            if (index >= 0) {
              storeData.snippets[index] = result.previousVersion;
            }
          } else {
            // Remove created snippet
            const index = storeData.snippets.findIndex(
              (s) => s.id === operation.snippetId,
            );
            if (index >= 0) {
              storeData.snippets.splice(index, 1);
            }
          }

          await this.storeLoader.saveStore(
            result.tierName,
            result.storeFileName,
            storeData,
          );
        } else if (operation.type === "delete" && result.previousVersion) {
          // Restore deleted snippet
          const storeData = await this.storeLoader.loadStore(
            result.tierName,
            result.storeFileName,
          );
          this.insertSnippetByPriority(
            storeData.snippets,
            result.previousVersion,
          );
          await this.storeLoader.saveStore(
            result.tierName,
            result.storeFileName,
            storeData,
          );
        }

        console.log(`✅ Rolled back changes in ${result.storeFileName}`);
      } catch (error) {
        console.error(`❌ Failed to rollback ${result.storeFileName}:`, error);
      }
    });

    await Promise.all(rollbackPromises);
  }

  /**
   * Add result to operation history
   */
  private addToHistory(result: BatchUpdateResult): void {
    this.operationHistory.unshift(result);

    // Limit history size
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory = this.operationHistory.slice(
        0,
        this.maxHistorySize,
      );
    }
  }

  /**
   * Get operation history
   */
  getHistory(): BatchUpdateResult[] {
    return [...this.operationHistory];
  }

  /**
   * Get pending operations
   */
  getPendingOperations(): BatchUpdateOperation[] {
    return [...this.pendingOperations];
  }

  /**
   * Get active operations count
   */
  getActiveOperationsCount(): number {
    return this.activeOperations.size;
  }

  /**
   * Clear operation history
   */
  clearHistory(): void {
    this.operationHistory = [];
  }
}

/**
 * Simple semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    const resolve = this.waiting.shift();
    if (resolve) {
      this.permits--;
      resolve();
    }
  }
}

/**
 * Interface for store loading operations
 */
export interface StoreLoaderInterface {
  loadStore(tier: PriorityTier, fileName: string): Promise<TierStorageSchema>;
  saveStore(
    tier: PriorityTier,
    fileName: string,
    data: TierStorageSchema,
  ): Promise<void>;
}

/**
 * Create a batch update manager with default configuration
 */
export function createBatchUpdateManager(
  storeLoader: StoreLoaderInterface,
  options?: BatchUpdateOptions,
): BatchUpdateManager {
  return new BatchUpdateManager(storeLoader, options);
}
