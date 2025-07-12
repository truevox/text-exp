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
  private isCycling = false;
  private currentCyclingTrigger = "";
  private currentCyclingOptions: CyclingOption[] = [];

  constructor(
    textReplacer: TextReplacer,
    placeholderHandler: PlaceholderHandler,
    cyclingUI: TriggerCyclingUI,
    snippetManager: ContentSnippetManager,
    callbacks: TriggerProcessorCallbacks,
  ) {
    this.textReplacer = textReplacer;
    this.placeholderHandler = placeholderHandler;
    this.cyclingUI = cyclingUI;
    this.snippetManager = snippetManager;
    this.callbacks = callbacks;
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

    // Check if snippet has variables that need user input
    if (snippet.variables && snippet.variables.length > 0) {
      console.log("📝 Snippet has variables, showing prompt");
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

      console.log("📝 Snippet has no variables, expanding directly");
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

    const context = this.createReplacementContext(
      element,
      snippet.trigger,
      snippet,
    );
    console.log("📍 Replacement context:", context);

    if (context) {
      if (snippet.contentType === "html" && isContentEditable(element)) {
        this.textReplacer.insertHtmlAtCursor(element, snippet.content);
      } else {
        this.textReplacer.replaceText(context, snippet.content);
      }

      // Log expansion for analytics
      console.log(
        `✨ Expanded "${snippet.trigger}" → "${snippet.content.substring(0, 50)}..."`,
      );
    } else {
      console.log("❌ Invalid replacement context");
    }
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
    const context = this.createReplacementContext(
      element,
      snippet.trigger,
      snippet,
    );
    if (context) {
      const processedContent = this.placeholderHandler.replaceVariables(
        snippet.content,
        variables,
      );

      if (snippet.contentType === "html" && isContentEditable(element)) {
        this.textReplacer.insertHtmlAtCursor(element, processedContent);
      } else {
        this.textReplacer.replaceText(context, processedContent);
      }

      console.log(
        `✨ Expanded "${snippet.trigger}" with variables → "${processedContent.substring(0, 50)}..."`,
      );
    }
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
