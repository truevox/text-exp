/**
 * Scoped Source Manager for Multi-Tier Snippet Sync
 * Handles personal, team, and org-level snippet sources with priority resolution
 */

import type { 
  ScopedSource, 
  SnippetScope, 
  CloudProvider, 
  TextSnippet,
  CloudAdapter,
  ConfiguredScopedSource // Import new type
} from '../shared/types.js';
import { ExtensionStorage } from '../shared/storage.js';
import { getCloudAdapterFactory } from './cloud-adapters/index.js';

/**
 * Priority order for scope resolution (higher index = higher priority)
 */
const SCOPE_PRIORITY: SnippetScope[] = ['org', 'team', 'personal'];

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
      this.scopedSources.set(this.getSourceKey(source.scope, source.name), source);
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
    return this.getScopedSources().filter(source => source.scope === scope);
  }

  /**
   * Setup local filesystem sources for all three scopes
   * Note: This method should only be called from UI contexts (popup/options), not service worker
   */
  async setupLocalFilesystemSources(): Promise<void> {
    throw new Error('setupLocalFilesystemSources must be called from a UI context (popup/options page), not service worker');
  }

  /**
   * Add a local filesystem source with directory handle
   */
  async addLocalFilesystemSource(scope: SnippetScope, directoryHandle: FileSystemDirectoryHandle): Promise<void> {
    const source: ScopedSource = {
      scope,
      provider: 'local-filesystem',
      name: `${scope}-snippets`,
      handleName: directoryHandle.name,
      handleId: (directoryHandle as any).id || undefined, // ID might not be available in all browsers
      displayName: `${scope.charAt(0).toUpperCase() + scope.slice(1)} Snippets (${directoryHandle.name})`,
      lastSync: new Date()
    };

    await this.addScopedSource(source);
    console.log(`✅ Added ${scope} source: ${directoryHandle.name}`);
  }

  /**
   * Sync all scoped sources and merge snippets with priority resolution
   */
  async syncAllSources(): Promise<TextSnippet[]> {
    const allSnippets: Map<string, { snippet: TextSnippet; scope: SnippetScope }> = new Map();
    
    // Load snippets from all sources
    for (const source of this.scopedSources.values()) {
      try {
        const adapter = await this.getAdapterForSource(source);
        const snippets = await adapter.downloadSnippets();
        
        // Add snippets with scope information
        for (const snippet of snippets) {
          const existing = allSnippets.get(snippet.trigger);
          
          if (!existing || this.hasHigherPriority(source.scope, existing.scope)) {
            allSnippets.set(snippet.trigger, { snippet, scope: source.scope });
          }
        }
        
        // Update last sync time
        source.lastSync = new Date();
        
      } catch (error) {
        console.error(`Failed to sync ${source.scope} source ${source.name}:`, error);
      }
    }
    
    // Save updated sources
    await this.saveScopedSources();
    
    // Return merged snippets (priority already resolved)
    const mergedSnippets = Array.from(allSnippets.values()).map(item => ({
      ...item.snippet,
      // Add scope metadata to snippet for reference
      scope: item.scope
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
        const snippets = await adapter.downloadSnippets();
        
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
  async addSnippetToScope(snippet: TextSnippet, scope: SnippetScope): Promise<void> {
    const scopeSources = this.getScopedSourcesByScope(scope);
    
    if (scopeSources.length === 0) {
      throw new Error(`No ${scope} sources configured`);
    }
    
    // Add to the first source of the specified scope
    const source = scopeSources[0];
    const adapter = await this.getAdapterForSource(source);
    
    const existingSnippets = await adapter.downloadSnippets();
    const updatedSnippets = [...existingSnippets, snippet];
    
    await adapter.uploadSnippets(updatedSnippets);
    
    // Trigger a full sync to update merged snippets
    await this.syncAllSources();
  }

  /**
   * Get sync status for all sources
   */
  async getSyncStatus(): Promise<Record<string, { scope: SnippetScope; name: string; lastSync?: Date; snippetCount: number }>> {
    const status: Record<string, { scope: SnippetScope; name: string; lastSync?: Date; snippetCount: number }> = {};
    
    for (const source of this.scopedSources.values()) {
      try {
        const adapter = await this.getAdapterForSource(source);
        const snippets = await adapter.downloadSnippets();
        
        status[this.getSourceKey(source.scope, source.name)] = {
          scope: source.scope,
          name: source.displayName,
          lastSync: source.lastSync,
          snippetCount: snippets.length
        };
      } catch (error) {
        status[this.getSourceKey(source.scope, source.name)] = {
          scope: source.scope,
          name: source.displayName,
          lastSync: source.lastSync,
          snippetCount: 0
        };
      }
    }
    
    return status;
  }

  /**
   * Get adapter for a scoped source
   */
  private async getAdapterForSource(source: ScopedSource): Promise<CloudAdapter> {
    const key = this.getSourceKey(source.scope, source.name);
    
    if (!this.adapters.has(key)) {
      const factory = getCloudAdapterFactory();
      const adapter = factory.createAdapter(source.provider);
      
      // Initialize adapter with stored credentials or source info
      if (source.provider === 'local-filesystem' && source.handleName) {
        // For local filesystem, we need to re-obtain the directory handle
        try {
          const root = await navigator.storage.getDirectory();
          const directoryHandle = await root.getDirectoryHandle(source.handleName, { create: false });
          
          // Verify permission
          const permissionStatus = await directoryHandle.queryPermission({ mode: 'readwrite' });
          if (permissionStatus !== 'granted') {
            // If permission is not granted, we might need to prompt the user again
            // For now, we'll just log a warning and not set the handle
            console.warn(`Permission not granted for local filesystem source: ${source.displayName}. Please re-select the folder in options.`);
            return adapter; // Return adapter without handle
          }

          // Set the directory handle on the adapter
          if ('setDirectoryHandle' in adapter) {
            (adapter as any).setDirectoryHandle(directoryHandle);
          }
        } catch (error) {
          console.error(`Failed to re-obtain directory handle for ${source.displayName}:`, error);
          return adapter; // Return adapter without handle
        }
      }
      
      this.adapters.set(key, adapter);
    }
    
    return this.adapters.get(key)!;
  }

  /**
   * Check if scope A has higher priority than scope B
   */
  private hasHigherPriority(scopeA: SnippetScope, scopeB: SnippetScope): boolean {
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