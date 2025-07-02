/**
 * @file MultiScopeSyncManager
 * @description Orchestrates snippet synchronization from multiple sources (personal, department, org)
 * with a priority-based merging strategy.
 */

import type { Snippet, SyncedSource, SnippetScope } from '../shared/types';

const scopePriority: Record<SnippetScope, number> = {
  personal: 3,
  department: 2,
  org: 1,
};

export class MultiScopeSyncManager {
  public async syncAndMerge(sources: SyncedSource[]): Promise<Snippet[]> {
    if (!sources || sources.length === 0) {
      return [];
    }

    const snippetMap = new Map<string, Snippet>();

    const allSnippets = await Promise.all(sources.map(s => this.fetchFromSource(s)));

    for (const { source, snippets } of allSnippets) {
      for (const snippet of snippets) {
        const existing = snippetMap.get(snippet.trigger);
        const currentPriority = scopePriority[source.name] || 0;
        const existingPriority = existing && existing.scope ? scopePriority[existing.scope] || 0 : -1;

        if (!existing || currentPriority > existingPriority) {
          snippetMap.set(snippet.trigger, { ...snippet, scope: source.name });
        }
      }
    }

    return Array.from(snippetMap.values());
  }

  private async fetchFromSource(source: SyncedSource): Promise<{ source: SyncedSource, snippets: Snippet[] }> {
    try {
      const snippets = await source.adapter.downloadSnippets(source.folderId);
      return { source, snippets };
    } catch (error) {
      console.error(`Failed to fetch snippets for source: ${source.displayName}`, error);
      return { source, snippets: [] };
    }
  }
}
