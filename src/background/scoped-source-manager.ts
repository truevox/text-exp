/**
 * Scoped Source Manager for Multi-Tier Snippet Sync
 * Handles personal, team, and org-level snippet sources with priority resolution
 */

import type {
  ScopedSource,
  SnippetScope,
  TextSnippet,
  CloudAdapter,
} from "../shared/types.js";
import { ExtensionStorage } from "../shared/storage.js";
import { getCloudAdapterFactory } from "./cloud-adapters/index.js";

/**
 * Priority order for scope resolution (higher index = higher priority)
 */
const SCOPE_PRIORITY: SnippetScope[] = ["org", "team", "personal"];

/**
 * Manages multiple scoped snippet sources with conflict resolution
 */
export class ScopedSourceManager {
  private static instance: ScopedSourceManager;
  private scopedSources: Map<string, ScopedSource> = new Map();
  private adapters: Map<string, CloudAdapter> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ScopedSourceManager {
    if (!ScopedSourceManager.instance) {
      ScopedSourceManager.instance = new ScopedSourceManager();
    }
    return ScopedSourceManager.instance;
  }

  /**
   * Initialize with stored scoped sources
   */
  async initialize(): Promise<void> {
    const storedSources = await ExtensionStorage.getScopedSources();

    for (const source of storedSources) {
      this.scopedSources.set(
        this.getSourceKey(source.scope, source.name),
        source,
      );
    }
  }

  /**
   * Add a new scoped source
   */
  async addScopedSource(source: ScopedSource): Promise<void> {
    const key = this.getSourceKey(source.scope, source.name);
    this.scopedSources.set(key, source);

    await this.saveScopedSources();
  }

  /**
   * Remove a scoped source
   */
  async removeScopedSource(scope: SnippetScope, name: string): Promise<void> {
    const key = this.getSourceKey(scope, name);
    this.scopedSources.delete(key);
    this.adapters.delete(key);

    await this.saveScopedSources();
  }

  /**
   * Get all scoped sources
   */
  getScopedSources(): ScopedSource[] {
    return Array.from(this.scopedSources.values());
  }

  /**
   * Get scoped sources by scope
   */
  getScopedSourcesByScope(scope: SnippetScope): ScopedSource[] {
    return this.getScopedSources().filter((source) => source.scope === scope);
  }

  /**
   * Sync all scoped sources and merge snippets with priority resolution
   */
  async syncAllSources(): Promise<TextSnippet[]> {
    const allSnippets: Map<
      string,
      { snippet: TextSnippet; scope: SnippetScope }
    > = new Map();

    // Load snippets from all sources
    for (const source of this.scopedSources.values()) {
      try {
        const adapter = await this.getAdapterForSource(source);
        const snippets = await adapter.downloadSnippets(source.folderId || "");

        // Add snippets with scope information
        for (const snippet of snippets) {
          const existing = allSnippets.get(snippet.trigger);

          if (
            !existing ||
            this.hasHigherPriority(source.scope, existing.scope)
          ) {
            allSnippets.set(snippet.trigger, { snippet, scope: source.scope });
          }
        }

        // Update last sync time
        source.lastSync = new Date();
      } catch (error) {
        console.error(
          `Failed to sync ${source.scope} source ${source.name}:`,
          error,
        );
      }
    }

    // Save updated sources
    await this.saveScopedSources();

    // Return merged snippets (priority already resolved)
    const mergedSnippets = Array.from(allSnippets.values()).map((item) => ({
      ...item.snippet,
      // Add scope metadata to snippet for reference
      scope: item.scope,
    })) as (TextSnippet & { scope: SnippetScope })[];

    // Save merged snippets to local cache
    await ExtensionStorage.setSnippets(mergedSnippets);

    return mergedSnippets;
  }

  /**
   * Get all unique triggers across all sources
   */
  async getAllTriggers(): Promise<string[]> {
    const triggers = new Set<string>();

    for (const source of this.scopedSources.values()) {
      try {
        const adapter = await this.getAdapterForSource(source);
        const snippets = await adapter.downloadSnippets(source.folderId || "");

        for (const snippet of snippets) {
          triggers.add(snippet.trigger);
        }
      } catch (error) {
        console.error(`Failed to get triggers from ${source.name}:`, error);
      }
    }

    return Array.from(triggers);
  }

  /**
   * Add snippet to specific scope
   */
  async addSnippetToScope(
    snippet: TextSnippet,
    scope: SnippetScope,
  ): Promise<void> {
    const scopeSources = this.getScopedSourcesByScope(scope);

    if (scopeSources.length === 0) {
      throw new Error(`No ${scope} sources configured`);
    }

    // Add to the first source of the specified scope
    const source = scopeSources[0];
    const adapter = await this.getAdapterForSource(source);

    const existingSnippets = await adapter.downloadSnippets(
      source.folderId || "",
    );
    const updatedSnippets = [...existingSnippets, snippet];

    await adapter.uploadSnippets(updatedSnippets);

    // Trigger a full sync to update merged snippets
    await this.syncAllSources();
  }

  /**
   * Update existing snippet in specific scope
   */
  async updateSnippetInScope(
    snippetId: string,
    updates: Partial<TextSnippet>,
    scope: SnippetScope,
  ): Promise<void> {
    const scopeSources = this.getScopedSourcesByScope(scope);

    if (scopeSources.length === 0) {
      throw new Error(`No ${scope} sources configured`);
    }

    // Update in the first source of the specified scope
    const source = scopeSources[0];
    const adapter = await this.getAdapterForSource(source);

    const existingSnippets = await adapter.downloadSnippets(
      source.folderId || "",
    );

    // Find and update the snippet
    const snippetIndex = existingSnippets.findIndex((s) => s.id === snippetId);
    if (snippetIndex === -1) {
      throw new Error(
        `Snippet with id ${snippetId} not found in ${scope} scope`,
      );
    }

    // Apply updates with proper timestamp
    const updatedSnippet = {
      ...existingSnippets[snippetIndex],
      ...updates,
      updatedAt: new Date(),
    };

    const updatedSnippets = [...existingSnippets];
    updatedSnippets[snippetIndex] = updatedSnippet;

    await adapter.uploadSnippets(updatedSnippets);

    // Trigger a full sync to update merged snippets
    await this.syncAllSources();
  }

  /**
   * Get sync status for all sources
   */
  async getSyncStatus(): Promise<
    Record<
      string,
      {
        scope: SnippetScope;
        name: string;
        lastSync?: Date;
        snippetCount: number;
      }
    >
  > {
    const status: Record<
      string,
      {
        scope: SnippetScope;
        name: string;
        lastSync?: Date;
        snippetCount: number;
      }
    > = {};

    for (const source of this.scopedSources.values()) {
      try {
        const adapter = await this.getAdapterForSource(source);
        const snippets = await adapter.downloadSnippets(source.folderId || "");

        status[this.getSourceKey(source.scope, source.name)] = {
          scope: source.scope,
          name: source.displayName,
          lastSync: source.lastSync,
          snippetCount: snippets.length,
        };
      } catch (error) {
        status[this.getSourceKey(source.scope, source.name)] = {
          scope: source.scope,
          name: source.displayName,
          lastSync: source.lastSync,
          snippetCount: 0,
        };
      }
    }

    return status;
  }

  /**
   * Get adapter for a scoped source
   */
  private async getAdapterForSource(
    source: ScopedSource,
  ): Promise<CloudAdapter> {
    const key = this.getSourceKey(source.scope, source.name);

    if (!this.adapters.has(key)) {
      const factory = getCloudAdapterFactory();
      const adapter = factory.createAdapter(source.provider);

      // Initialize adapter with stored credentials if needed

      this.adapters.set(key, adapter);
    }

    return this.adapters.get(key)!;
  }

  /**
   * Check if scope A has higher priority than scope B
   */
  private hasHigherPriority(
    scopeA: SnippetScope,
    scopeB: SnippetScope,
  ): boolean {
    const priorityA = SCOPE_PRIORITY.indexOf(scopeA);
    const priorityB = SCOPE_PRIORITY.indexOf(scopeB);
    return priorityA > priorityB;
  }

  /**
   * Generate unique key for scoped source
   */
  private getSourceKey(scope: SnippetScope, name: string): string {
    return `${scope}:${name}`;
  }

  /**
   * Save scoped sources to storage
   */
  private async saveScopedSources(): Promise<void> {
    const sources = Array.from(this.scopedSources.values());
    await ExtensionStorage.setScopedSources(sources);
  }
}
