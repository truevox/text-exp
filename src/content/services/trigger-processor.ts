/**
 * Trigger Processor for Content Script
 * Handles trigger processing, expansion, and cycling logic
 */

import type { TextSnippet, ReplacementContext } from "../../shared/types";
import type { TextReplacer } from "../text-replacer";
import type { PlaceholderHandler } from "../placeholder-handler";
import type { TriggerCyclingUI, CyclingOption } from "../trigger-cycling-ui";
import type { ContentSnippetManager } from "./snippet-manager";
import {
  isTextInput,
  getElementText,
  getCursorPosition,
  isContentEditable,
} from "../utils/dom-utils";
import { targetDetector } from "../target-detector";
import { pasteManager } from "../paste-strategies/paste-manager";
import type { PasteContent } from "../paste-strategies/base-strategy";
import {
  getExpansionDependencyManager,
  type ExpansionDependencyManager,
  type DependencyResolutionContext,
  DEFAULT_RESOLUTION_CONTEXT,
} from "../expansion-dependency-manager";
import { logExpansionUsage } from "../expansion-usage-logger";

/**
 * Trigger processor callbacks interface
 */
export interface TriggerProcessorCallbacks {
  onTestSnippetModalShow: () => Promise<void>;
}

/**
 * Content Script Trigger Processor
 * Handles all trigger detection, processing, and text expansion
 */
export class ContentTriggerProcessor {
  private textReplacer: TextReplacer;
  private placeholderHandler: PlaceholderHandler;
  private cyclingUI: TriggerCyclingUI;
  private snippetManager: ContentSnippetManager;
  private callbacks: TriggerProcessorCallbacks;
  private expansionDependencyManager: ExpansionDependencyManager;
  private isCycling = false;
  private currentCyclingTrigger = "";
  private currentCyclingOptions: CyclingOption[] = [];

  constructor(
    textReplacer: TextReplacer,
    placeholderHandler: PlaceholderHandler,
    cyclingUI: TriggerCyclingUI,
    snippetManager: ContentSnippetManager,
    callbacks: TriggerProcessorCallbacks,
    expansionDependencyManager?: ExpansionDependencyManager,
  ) {
    this.textReplacer = textReplacer;
    this.placeholderHandler = placeholderHandler;
    this.cyclingUI = cyclingUI;
    this.snippetManager = snippetManager;
    this.callbacks = callbacks;
    this.expansionDependencyManager =
      expansionDependencyManager || getExpansionDependencyManager();
  }

  /**
   * Process detected trigger
   */
  async processTrigger(
    trigger: string,
    element: HTMLElement,
    result: any,
  ): Promise<void> {
    console.log("🎯 Processing trigger:", { trigger, element, result });

    try {
      // Check if we have multiple possible completions (ambiguous state)
      if (
        result.state === "ambiguous" &&
        result.possibleCompletions &&
        result.possibleCompletions.length > 1
      ) {
        console.log("🔄 Ambiguous trigger detected, starting cycling mode");
        await this.startCycling(
          result.potentialTrigger,
          result.possibleCompletions,
          element,
        );
        return;
      }

      console.log(
        `🎯 [TRIGGER-PROCESSOR] Looking for snippet with trigger: "${trigger}"`,
      );
      const snippet = await this.snippetManager.findSnippetByTrigger(trigger);

      console.log(
        `🔍 [TRIGGER-PROCESSOR] Found snippet:`,
        snippet
          ? {
              id: snippet.id,
              trigger: snippet.trigger,
              content: snippet.content?.substring(0, 50) + "...",
              source: (snippet as any).source,
            }
          : null,
      );

      if (!snippet) {
        console.log("❌ No matching snippet found for trigger:", trigger);
        return; // No matching snippet found
      }

      await this.expandSnippet(snippet, element, result);
    } catch (error) {
      console.error("❌ Error processing trigger:", error);
    }
  }

  /**
   * Expand snippet with appropriate handler
   */
  private async expandSnippet(
    snippet: TextSnippet,
    element: HTMLElement,
    result: any,
  ): Promise<void> {
    console.log("🚀 expandSnippet called with:", { snippet, element, result });

    try {
      // STEP 1: Resolve dependencies first
      console.log("🔗 Resolving dependencies for snippet:", snippet.trigger);
      const resolvedSnippet = await this.resolveDependencies(snippet);
      console.log(
        "✅ Dependencies resolved, using content:",
        resolvedSnippet.content.substring(0, 100) + "...",
      );

      // STEP 2: Handle variables if present
      if (resolvedSnippet.variables && resolvedSnippet.variables.length > 0) {
        console.log("📝 Resolved snippet has variables, showing prompt");
        try {
          const variableValues =
            await this.placeholderHandler.promptForVariables(resolvedSnippet);
          await this.expandWithVariables(
            resolvedSnippet,
            variableValues,
            element,
            result,
          );
        } catch (error) {
          if (error instanceof Error && error.message === "User cancelled") {
            console.log("❌ User cancelled variable input");
            return;
          }
          console.error("❌ Error handling variables:", error);
        }
      } else {
        // Check for built-in test snippet customization
        if (snippet.isBuiltIn && snippet.trigger.includes("test")) {
          const settings = await this.snippetManager.getSettings();
          if (settings.enableTestSnippetModal) {
            await this.callbacks.onTestSnippetModalShow();
            return;
          }
        }

        console.log("📝 Resolved snippet has no variables, expanding directly");
        await this.expandText(resolvedSnippet, element, result);
      }
    } catch (error) {
      console.error("❌ Error expanding snippet with dependencies:", error);

      // Fallback to original snippet expansion if dependency resolution fails
      console.log("⚠️ Falling back to original snippet expansion");
      await this.expandSnippetFallback(snippet, element, result);
    }
  }

  /**
   * Resolve dependencies for a snippet
   */
  private async resolveDependencies(
    snippet: TextSnippet,
  ): Promise<TextSnippet> {
    try {
      // Get available stores from snippet manager
      const availableStores = await this.snippetManager.getAvailableStores();

      // Create dependency resolution context
      const context: DependencyResolutionContext = {
        ...DEFAULT_RESOLUTION_CONTEXT,
        rootSnippet: snippet,
        availableStores,
        sessionId: `expansion-${Date.now()}`,
        userId: "current-user", // TODO: Get actual user ID
      };

      // Use ExpansionDependencyManager to resolve dependencies
      const expansionResult =
        await this.expansionDependencyManager.expandWithDependencies(
          snippet,
          context,
        );

      if (expansionResult.success) {
        console.log("✅ Dependencies resolved successfully", {
          originalContent: snippet.content.substring(0, 50) + "...",
          resolvedContent:
            expansionResult.expandedContent.substring(0, 50) + "...",
          dependenciesResolved: expansionResult.resolvedDependencies.length,
        });

        // Return snippet with resolved content
        return {
          ...snippet,
          content: expansionResult.expandedContent,
        };
      } else {
        console.warn(
          "⚠️ Dependency resolution failed:",
          expansionResult.errors,
        );

        // Return original snippet if resolution fails
        return snippet;
      }
    } catch (error) {
      console.error("❌ Error during dependency resolution:", error);

      // Return original snippet on error
      return snippet;
    }
  }

  /**
   * Fallback expansion without dependency resolution
   */
  private async expandSnippetFallback(
    snippet: TextSnippet,
    element: HTMLElement,
    result: any,
  ): Promise<void> {
    console.log("🔄 expandSnippetFallback called with:", {
      snippet,
      element,
      result,
    });

    // Check if snippet has variables that need user input
    if (snippet.variables && snippet.variables.length > 0) {
      console.log("📝 Fallback: Snippet has variables, showing prompt");
      try {
        const variableValues =
          await this.placeholderHandler.promptForVariables(snippet);
        await this.expandWithVariables(
          snippet,
          variableValues,
          element,
          result,
        );
      } catch (error) {
        if (error instanceof Error && error.message === "User cancelled") {
          console.log("❌ User cancelled variable input");
          return;
        }
        console.error("❌ Error handling variables:", error);
      }
    } else {
      // Check for built-in test snippet customization
      if (snippet.isBuiltIn && snippet.trigger.includes("test")) {
        const settings = await this.snippetManager.getSettings();
        if (settings.enableTestSnippetModal) {
          await this.callbacks.onTestSnippetModalShow();
          return;
        }
      }

      console.log("📝 Fallback: Snippet has no variables, expanding directly");
      await this.expandText(snippet, element, result);
    }
  }

  /**
   * Expand text without variables
   */
  private async expandText(
    snippet: TextSnippet,
    element: HTMLElement,
    _result: any,
  ): Promise<void> {
    console.log("🚀 expandText called with:", { snippet, element });

    let expansionSuccess = false;
    let errorMessage: string | undefined;

    // Use new paste strategy system
    try {
      await this.expandWithPasteStrategy(snippet, element);
      expansionSuccess = true;

      // Log expansion for analytics
      console.log(
        `✨ Expanded "${snippet.trigger}" → "${snippet.content.substring(0, 50)}..."`,
      );
    } catch (error) {
      console.error("❌ Error expanding text with paste strategy:", error);
      errorMessage = error.message;

      // Fallback to old replacement system
      try {
        const context = this.createReplacementContext(
          element,
          snippet.trigger,
          snippet,
        );
        console.log("📍 Falling back to old replacement system");

        if (context) {
          if (snippet.contentType === "html" && isContentEditable(element)) {
            this.textReplacer.insertHtmlAtCursor(element, snippet.content);
          } else {
            this.textReplacer.replaceText(context, snippet.content);
          }
          expansionSuccess = true;
          errorMessage = undefined; // Clear error since fallback worked
        } else {
          console.log("❌ Invalid replacement context");
          errorMessage = "Invalid replacement context";
        }
      } catch (fallbackError) {
        console.error("❌ Error in fallback expansion:", fallbackError);
        errorMessage = `${errorMessage}; Fallback failed: ${fallbackError.message}`;
      }
    }

    // Track usage regardless of success/failure for analytics
    try {
      const targetElement = this.getTargetElementType(element);
      await logExpansionUsage(snippet, expansionSuccess, errorMessage, {
        targetElement,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    } catch (trackingError) {
      // Usage tracking errors should not affect expansion
      console.warn("⚠️ Usage tracking failed:", trackingError);
    }
  }

  /**
   * Get target element type for analytics
   */
  private getTargetElementType(element: HTMLElement): string {
    if (isTextInput(element)) {
      return element.tagName.toLowerCase();
    }
    if (isContentEditable(element)) {
      return "contenteditable";
    }
    return element.tagName.toLowerCase();
  }

  /**
   * Expand text with variables
   */
  private async expandWithVariables(
    snippet: TextSnippet,
    variables: Record<string, string>,
    element: HTMLElement,
    _result: any,
  ): Promise<void> {
    const processedContent = this.placeholderHandler.replaceVariables(
      snippet.content,
      variables,
    );

    // Create a temporary snippet with processed content
    const processedSnippet = {
      ...snippet,
      content: processedContent,
    };

    let expansionSuccess = false;
    let errorMessage: string | undefined;

    // Use new paste strategy system
    try {
      await this.expandWithPasteStrategy(processedSnippet, element);
      expansionSuccess = true;

      console.log(
        `✨ Expanded "${snippet.trigger}" with variables → "${processedContent.substring(0, 50)}..."`,
      );
    } catch (error) {
      console.error(
        "❌ Error expanding text with variables via paste strategy:",
        error,
      );
      errorMessage = error.message;

      // Fallback to old replacement system
      try {
        const context = this.createReplacementContext(
          element,
          snippet.trigger,
          snippet,
        );
        if (context) {
          if (snippet.contentType === "html" && isContentEditable(element)) {
            this.textReplacer.insertHtmlAtCursor(element, processedContent);
          } else {
            this.textReplacer.replaceText(context, processedContent);
          }
          expansionSuccess = true;
          errorMessage = undefined; // Clear error since fallback worked
        } else {
          errorMessage = "Invalid replacement context";
        }
      } catch (fallbackError) {
        errorMessage = `${errorMessage}; Fallback failed: ${fallbackError.message}`;
      }
    }

    // Track usage for variable expansion
    try {
      const targetElement = this.getTargetElementType(element);
      await logExpansionUsage(
        snippet, // Track the original snippet, not the processed one
        expansionSuccess,
        errorMessage,
        {
          targetElement,
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
      );
    } catch (trackingError) {
      // Usage tracking errors should not affect expansion
      console.warn(
        "⚠️ Usage tracking failed for variable expansion:",
        trackingError,
      );
    }
  }

  /**
   * Expand snippet using advanced paste strategy system
   */
  private async expandWithPasteStrategy(
    snippet: TextSnippet,
    element: HTMLElement,
  ): Promise<void> {
    console.log("🎯 Using paste strategy system for expansion");

    // First, remove the trigger text from the element
    const context = this.createReplacementContext(
      element,
      snippet.trigger,
      snippet,
    );

    if (context) {
      // Remove the trigger text
      if (this.isFormInput(element)) {
        const input = element as HTMLInputElement | HTMLTextAreaElement;
        const currentValue = input.value;
        const beforeText = currentValue.substring(0, context.startOffset);
        const afterText = currentValue.substring(context.endOffset);
        input.value = beforeText + afterText;
        input.setSelectionRange(context.startOffset, context.startOffset);
      } else if (isContentEditable(element)) {
        const text = getElementText(element);
        const beforeText = text.substring(0, context.startOffset);
        const afterText = text.substring(context.endOffset);
        element.textContent = beforeText + afterText;

        // Set cursor position
        const range = document.createRange();
        const selection = window.getSelection();
        if (selection) {
          range.setStart(element.firstChild || element, context.startOffset);
          range.setEnd(element.firstChild || element, context.startOffset);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }

    // Detect target surface
    const targetSurface = targetDetector.detectTargetSurface(element);
    console.log("🎯 Detected target surface:", targetSurface);

    if (!targetSurface) {
      throw new Error("Unable to detect target surface for paste operation");
    }

    // Create paste content
    const pasteContent: PasteContent = {
      text:
        snippet.contentType === "html"
          ? this.htmlToText(snippet.content)
          : snippet.content,
      html: snippet.contentType === "html" ? snippet.content : undefined,
      metadata: {
        originalFormat: snippet.contentType === "html" ? "html" : "plaintext",
        snippetId: snippet.id,
        timestamp: Date.now(),
        transformations: [],
      },
    };

    // Execute paste operation
    const result = await pasteManager.executePaste(
      pasteContent,
      targetSurface,
      {
        preserveFormatting: snippet.contentType === "html",
        convertToMarkdown: false,
        stripStyles: false,
        simulateTyping: false,
        insertAtCursor: true,
      },
    );

    console.log("🎯 Paste operation result:", result);

    if (!result.success) {
      throw new Error(`Paste operation failed: ${result.error}`);
    }
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  /**
   * Check if element is a form input
   */
  private isFormInput(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    return tagName === "input" || tagName === "textarea";
  }

  /**
   * Create replacement context for text replacement
   */
  private createReplacementContext(
    element: HTMLElement,
    trigger: string,
    snippet: TextSnippet,
  ): ReplacementContext | null {
    if (!isTextInput(element)) {
      console.log("❌ Element is not a text input");
      return null;
    }

    const text = getElementText(element);
    const cursorPosition = getCursorPosition(element);

    console.log("📍 Creating replacement context:", {
      trigger,
      text,
      cursorPosition,
    });

    const triggerStart = text.lastIndexOf(trigger, cursorPosition);
    if (triggerStart === -1) {
      console.log("❌ Trigger not found in text");
      return null;
    }

    return {
      element,
      startOffset: triggerStart,
      endOffset: triggerStart + trigger.length,
      trigger,
      snippet,
    };
  }

  /**
   * Start cycling through trigger options
   */
  private async startCycling(
    trigger: string,
    options: CyclingOption[],
    element: HTMLElement,
  ): Promise<void> {
    this.isCycling = true;
    this.currentCyclingTrigger = trigger;
    this.currentCyclingOptions = options;

    // Show cycling UI
    const rect = element.getBoundingClientRect();
    this.cyclingUI.show(options, element, { x: rect.left, y: rect.top });

    // Immediately show the first option
    if (options.length > 0) {
      const firstOption = options[0];
      const snippet = await this.snippetManager.findSnippetByTrigger(
        firstOption.trigger,
      );
      if (snippet) {
        const context = this.createReplacementContext(
          element,
          trigger,
          snippet,
        );
        if (context) {
          this.textReplacer.replaceText(context, snippet.content);
        }
      }
    }
  }

  /**
   * Cycle to next option during cycling mode
   */
  async cycleToNextOption(): Promise<void> {
    if (!this.isCycling) return;

    const nextOption = this.cyclingUI.cycleNext();
    const activeElement = document.activeElement as HTMLElement;

    if (activeElement && nextOption) {
      const snippet = await this.snippetManager.findSnippetByTrigger(
        nextOption.trigger,
      );
      if (snippet) {
        const context = this.createReplacementContext(
          activeElement,
          this.currentCyclingTrigger,
          snippet,
        );
        if (context) {
          this.textReplacer.replaceText(context, snippet.content);
        }
      }
    }
  }

  /**
   * Cement current cycling option and exit cycling mode
   */
  async cementCurrentCyclingOption(element: HTMLElement): Promise<void> {
    if (!this.isCycling) return;

    const selectedOption = this.cyclingUI.getCurrentOption();

    if (selectedOption) {
      const snippet = await this.snippetManager.findSnippetByTrigger(
        selectedOption.trigger,
      );
      if (snippet) {
        // Expand the selected snippet properly (with variables if needed)
        await this.expandSnippet(snippet, element, {});
      }
    }

    this.endCycling();
  }

  /**
   * End cycling mode
   */
  endCycling(): void {
    this.isCycling = false;
    this.currentCyclingTrigger = "";
    this.currentCyclingOptions = [];
    this.cyclingUI.hide();
  }

  /**
   * Check if currently in cycling mode
   */
  getIsCycling(): boolean {
    return this.isCycling;
  }

  /**
   * Undo last replacement
   */
  undoLastReplacement(element: HTMLElement): void {
    this.textReplacer.undoLastReplacement(element);
  }
}
