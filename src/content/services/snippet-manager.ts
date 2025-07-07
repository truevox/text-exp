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
   * Load snippets from storage and update trigger detector
   */
  async loadSnippets(): Promise<void> {
    try {
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
      this.triggerDetector.updateSnippets(snippets);
    } catch (error) {
      console.error("Failed to load snippets:", error);
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
}
