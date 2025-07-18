/**
 * @file MultiScopeSyncManager
 * @description Orchestrates snippet synchronization from multiple sources (personal, department, org)
 * with a priority-based merging strategy.
 */

import type { Snippet, SyncedSource, SnippetScope } from "../shared/types";
import { multiFormatSyncService } from "./multi-format-sync-service.js";

const scopePriority: Record<SnippetScope, number> = {
  "priority-0": 5, // Highest priority for appdata store
  personal: 4,
  team: 3,
  department: 2,
  org: 1,
};

export class MultiScopeSyncManager {
  public async syncAndMerge(sources: SyncedSource[]): Promise<Snippet[]> {
    if (!sources || sources.length === 0) {
      return [];
    }

    const snippetMap = new Map<string, Snippet>();

    const allSnippets = await Promise.all(
      sources.map((s) => this.fetchFromSource(s)),
    );

    for (const { source, snippets } of allSnippets) {
      for (const snippet of snippets) {
        const existing = snippetMap.get(snippet.trigger);
        const currentPriority = scopePriority[source.name] || 0;
        // Get priority from existing snippet's _priorityLevel or fallback to scope lookup
        const existingPriority =
          existing && (existing as any)._priorityLevel
            ? (existing as any)._priorityLevel
            : existing && existing.scope
              ? scopePriority[existing.scope] || 0
              : -1;

        if (!existing || currentPriority > existingPriority) {
          snippetMap.set(snippet.trigger, {
            ...snippet,
            scope: source.name,
            // Add priority as a custom property for internal tracking
            _priorityLevel: currentPriority,
          } as any);
        }
      }
    }

    // Clean up internal tracking properties before returning
    const cleanedSnippets = Array.from(snippetMap.values()).map((snippet) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _priorityLevel, ...cleanedSnippet } = snippet as any;
      return cleanedSnippet;
    });

    return cleanedSnippets;
  }

  private async fetchFromSource(
    source: SyncedSource,
  ): Promise<{ source: SyncedSource; snippets: Snippet[] }> {
    try {
      console.log(
        `🔍 Fetching snippets from ${source.displayName} (scope: ${source.name}, folderId: ${source.folderId})`,
      );

      let snippets: Snippet[] = [];

      // Handle appdata store specially
      if (
        source.name === "priority-0" &&
        source.folderId === "appdata-priority-0"
      ) {
        console.log("🔍 Fetching Priority #0 store from appdata");
        const appdataStore = await (
          source.adapter as any
        ).discoverAppDataStore();
        if (appdataStore.hasStore) {
          snippets = appdataStore.snippets;
          console.log(
            `📥 Downloaded ${snippets.length} snippets from Priority #0 store`,
          );
        } else {
          console.log("📭 No Priority #0 store found in appdata");
        }
      } else {
        // Use multi-format sync service if supported, otherwise fallback to original method
        snippets = await multiFormatSyncService.downloadSnippetsWithFormats(
          source.adapter,
          source.folderId,
        );

        console.log(
          `📥 Downloaded ${snippets.length} snippets from ${source.displayName}`,
        );
        console.log(
          `📋 Snippets:`,
          snippets.map((s) => ({
            trigger: s.trigger,
            content: s.content.substring(0, 50) + "...",
          })),
        );

        // Log format support info
        if (multiFormatSyncService.supportsMultiFormat(source.adapter)) {
          console.log(
            `✨ Multi-format support enabled for ${source.displayName}`,
          );
        } else {
          console.log(
            `📄 Using legacy single-file sync for ${source.displayName}`,
          );
        }
      }

      return { source, snippets };
    } catch (error) {
      console.error(
        `Failed to fetch snippets for source: ${source.displayName}`,
        error,
      );
      return { source, snippets: [] };
    }
  }
}
