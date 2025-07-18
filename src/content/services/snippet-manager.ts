/**
 * Snippet Manager for Content Script
 * Manages snippet loading, caching, and retrieval
 */

import { ExtensionStorage } from "../../shared/storage";
import type { TextSnippet } from "../../shared/types";
import type { EnhancedTriggerDetector } from "../enhanced-trigger-detector";

/**
 * Content Script Snippet Manager
 * Handles all snippet-related operations
 */
export class ContentSnippetManager {
  private triggerDetector: EnhancedTriggerDetector;

  constructor(triggerDetector: EnhancedTriggerDetector) {
    this.triggerDetector = triggerDetector;
  }

  /**
   * Load snippets from storage and update trigger detector with retry logic
   */
  async loadSnippets(retryCount = 0): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 200; // ms

    try {
      console.log(
        `🔄 [SNIPPET-LOAD] Loading snippets (attempt ${retryCount + 1}/${maxRetries + 1})`,
      );

      const snippets = await ExtensionStorage.getSnippets();
      const settings = await ExtensionStorage.getSettings();

      // Add built-in test snippet if not disabled
      if (!settings.disableTestSnippet) {
        const testTrigger = settings.testTrigger || ";htest";

        const builtInTestSnippet: TextSnippet = {
          id: "builtin-test",
          trigger: testTrigger,
          content: "Hello World!",
          createdAt: new Date(),
          updatedAt: new Date(),
          variables: [],
          tags: ["builtin", "test"],
          isBuiltIn: true,
        };

        snippets.push(builtInTestSnippet);
        console.log(
          "📝 Added built-in test snippet with trigger:",
          testTrigger,
        );
      }

      console.log("📚 Loaded snippets:", snippets.length, "total");

      // Check if we have expected snippets (like ;eata or ;pony)
      const cloudSnippets = snippets.filter((s) => !s.isBuiltIn);
      const triggers = snippets.map((s) => s.trigger);

      console.log(
        `🔍 [CONTENT-DEBUG] Content script received ${snippets.length} snippets (${cloudSnippets.length} from cloud):`,
      );
      console.log(`🎯 [CONTENT-DEBUG] All triggers:`, triggers);

      // Log detailed snippet data
      snippets.forEach((snippet, index) => {
        console.log(
          `  📋 Snippet ${index + 1} (${(snippet as any).source || (snippet.isBuiltIn ? "builtin" : "unknown")}):`,
          {
            id: snippet.id,
            trigger: snippet.trigger,
            content:
              snippet.content?.substring(0, 50) +
              (snippet.content?.length > 50 ? "..." : ""),
            description: snippet.description,
            tags: snippet.tags,
            source: (snippet as any).source,
            isBuiltIn: snippet.isBuiltIn,
            hasRequiredFields: !!(
              snippet.id &&
              snippet.trigger &&
              snippet.content
            ),
          },
        );
      });

      // RETRY LOGIC: If we have very few cloud snippets and retries available, try again
      if (cloudSnippets.length === 0 && retryCount < maxRetries) {
        console.warn(
          `⚠️ [SNIPPET-LOAD] No cloud snippets found, retrying in ${retryDelay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return this.loadSnippets(retryCount + 1);
      }

      // Check for specific test snippets
      const eataTrigger = snippets.find((s) => s.trigger === ";eata");
      const ponyTrigger = snippets.find((s) => s.trigger === ";pony");

      if (eataTrigger) {
        console.log(`✅ [SNIPPET-CHECK] ;eata snippet found:`, {
          id: eataTrigger.id,
          content: eataTrigger.content?.substring(0, 30) + "...",
          source: (eataTrigger as any).source,
        });
      } else {
        console.warn(`❌ [SNIPPET-CHECK] ;eata snippet NOT found`);
      }

      if (ponyTrigger) {
        console.log(`✅ [SNIPPET-CHECK] ;pony snippet found:`, {
          id: ponyTrigger.id,
          content: ponyTrigger.content?.substring(0, 30) + "...",
          source: (ponyTrigger as any).source,
        });
      } else {
        console.warn(`❌ [SNIPPET-CHECK] ;pony snippet NOT found`);
      }

      this.triggerDetector.updateSnippets(snippets);

      // Verify trigger detector received the snippets
      const detectorCount = this.triggerDetector.getLoadedSnippetsCount();
      console.log(
        `🔍 [TRIGGER-DETECTOR] Detector now has ${detectorCount} snippets loaded`,
      );

      if (detectorCount !== snippets.length) {
        console.warn(
          `⚠️ [TRIGGER-DETECTOR] Mismatch: provided ${snippets.length} snippets but detector has ${detectorCount}`,
        );
      }

      // DEBUG: Also check IndexedDB directly to see what's really stored
      this.debugIndexedDB();
    } catch (error) {
      console.error("Failed to load snippets:", error);

      // RETRY LOGIC: On error, retry with delay
      if (retryCount < maxRetries) {
        console.warn(
          `⚠️ [SNIPPET-LOAD] Error loading snippets, retrying in ${retryDelay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return this.loadSnippets(retryCount + 1);
      } else {
        console.error(
          `❌ [SNIPPET-LOAD] Failed to load snippets after ${maxRetries + 1} attempts`,
        );
      }
    }
  }

  /**
   * Debug function to check IndexedDB directly
   */
  private async debugIndexedDB(): Promise<void> {
    try {
      const { IndexedDB } = await import("../../shared/indexed-db");
      const db = new IndexedDB();
      const snippets = await db.getSnippets();
      console.log(
        `🔍 [DIRECT-INDEXEDDB] Direct IndexedDB query returned ${snippets.length} snippets:`,
      );
      snippets.forEach((snippet, index) => {
        console.log(`  📋 Direct snippet ${index + 1}:`, {
          id: snippet.id,
          trigger: snippet.trigger,
          content: snippet.content?.substring(0, 30) + "...",
          source: (snippet as any).source,
        });
      });
    } catch (error) {
      console.error("Failed to debug IndexedDB:", error);
    }
  }

  /**
   * Find snippet by trigger, including built-in test snippet
   */
  async findSnippetByTrigger(trigger: string): Promise<TextSnippet | null> {
    let snippet = await ExtensionStorage.findSnippetByTrigger(trigger);

    // If not found in storage, check if it's the built-in test snippet
    if (!snippet) {
      const settings = await ExtensionStorage.getSettings();
      const testTrigger = settings.testTrigger || ";htest";

      if (trigger === testTrigger && !settings.disableTestSnippet) {
        // Create the built-in test snippet
        snippet = {
          id: "builtin-test",
          trigger: testTrigger,
          content: "Hello World!",
          createdAt: new Date(),
          updatedAt: new Date(),
          variables: [],
          tags: ["builtin", "test"],
          isBuiltIn: true,
        };
        console.log("🧪 Using built-in test snippet:", snippet);
      }
    }

    return snippet;
  }

  /**
   * Get current settings
   */
  async getSettings(): Promise<any> {
    return await ExtensionStorage.getSettings();
  }

  /**
   * Get available stores formatted for dependency resolution
   * Returns snippets organized by store for the ExpansionDependencyManager
   */
  async getAvailableStores(): Promise<
    import("../../storage/snippet-dependency-resolver.js").StoreSnippetMap
  > {
    const snippets = await ExtensionStorage.getSnippets();
    const settings = await ExtensionStorage.getSettings();

    // Add built-in test snippet if not disabled
    if (!settings.disableTestSnippet) {
      const testTrigger = settings.testTrigger || ";htest";
      const builtInTestSnippet: TextSnippet = {
        id: "builtin-test",
        trigger: testTrigger,
        content: "Hello World!",
        createdAt: new Date(),
        updatedAt: new Date(),
        variables: [],
        tags: ["builtin", "test"],
        isBuiltIn: true,
      };
      snippets.push(builtInTestSnippet);
    }

    // For now, organize all snippets under a "local" store
    // This can be enhanced later when we have multiple stores
    const storeMap: import("../../storage/snippet-dependency-resolver.js").StoreSnippetMap =
      {
        local: {
          snippets,
          storeId: "local-storage",
          displayName: "Local Storage",
        },
      };

    console.log(
      `🗄️ [STORE-MAP] Created store map with ${snippets.length} snippets in 'local' store`,
    );
    return storeMap;
  }
}
