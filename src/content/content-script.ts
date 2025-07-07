/**
 * Content Script for Collaborative Text Expander
 * Main entry point for text expansion functionality on web pages
 */

import { EnhancedTriggerDetector } from "./enhanced-trigger-detector";
import { TextReplacer } from "./text-replacer";
import { PlaceholderHandler } from "./placeholder-handler";
import { ImageProcessor } from "../background/image-processor";
import type {
  ExpandTextMessage,
  VariablePromptMessage,
  TextSnippet,
} from "../shared/types";
import { TriggerCyclingUI } from "./trigger-cycling-ui";
import {
  isTextInput,
  getElementText,
  getCursorPosition,
} from "./utils/dom-utils";
import { ContentEventHandler } from "./event-handler";
import { TestSnippetModal } from "./test-snippet-modal";
import { ContentMessageService } from "./services/message-service";
import { ContentSnippetManager } from "./services/snippet-manager";
import { ContentTriggerProcessor } from "./services/trigger-processor";

/**
 * Main content script class
 */
export class ContentScript {
  private triggerDetector: EnhancedTriggerDetector;
  private textReplacer: TextReplacer;
  private placeholderHandler: PlaceholderHandler;
  private isEnabled = true;
  private activeElement: HTMLElement | null = null;
  private imageProcessor: ImageProcessor;
  private cyclingUI: TriggerCyclingUI;
  private settings: any = {};
  private eventHandler: ContentEventHandler;
  private messageService: ContentMessageService;
  private snippetManager: ContentSnippetManager;
  private triggerProcessor: ContentTriggerProcessor;

  constructor(
    triggerDetector?: EnhancedTriggerDetector,
    textReplacer?: TextReplacer,
    placeholderHandler?: PlaceholderHandler,
  ) {
    // Initialize core components
    this.imageProcessor = new ImageProcessor();
    this.triggerDetector =
      triggerDetector || new EnhancedTriggerDetector([], ";");
    this.textReplacer = textReplacer || new TextReplacer(this.imageProcessor);
    this.placeholderHandler = placeholderHandler || new PlaceholderHandler();
    this.cyclingUI = new TriggerCyclingUI();

    // Initialize services
    this.snippetManager = new ContentSnippetManager(this.triggerDetector);
    this.triggerProcessor = new ContentTriggerProcessor(
      this.textReplacer,
      this.placeholderHandler,
      this.cyclingUI,
      this.snippetManager,
      {
        onTestSnippetModalShow: this.handleTestSnippetModalShow.bind(this),
      },
    );
    this.messageService = new ContentMessageService({
      onExpandText: this.handleExpandText.bind(this),
      onVariablePrompt: this.handleVariablePrompt.bind(this),
      onSnippetsUpdated: this.handleSnippetsUpdated.bind(this),
      onSettingsUpdated: this.handleSettingsUpdated.bind(this),
    });

    // Initialize event handler with callbacks
    this.eventHandler = new ContentEventHandler({
      onTriggerDetected: this.handleTriggerDetected.bind(this),
      onKeyEvent: this.handleKeyEvent.bind(this),
      onElementFocus: this.handleElementFocus.bind(this),
      onElementBlur: this.handleElementBlur.bind(this),
      onDOMChange: this.handleDOMChange.bind(this),
    });

    this.initialize();
  }

  /**
   * Initialize content script
   */
  private async initialize(): Promise<void> {
    try {
      // Check if extension is enabled
      this.settings = await this.snippetManager.getSettings();
      this.isEnabled = this.settings.enabled;

      if (!this.isEnabled) {
        console.log("PuffPuffPaste is disabled");
        return;
      }

      // Load snippets and update trigger detector
      await this.snippetManager.loadSnippets();

      this.eventHandler.setupEventListeners();

      console.log("✅ PuffPuffPaste content script initialized");
    } catch (error) {
      console.error("Failed to initialize content script:", error);
    }
  }

  // Message service callbacks
  private async handleSnippetsUpdated(): Promise<void> {
    await this.snippetManager.loadSnippets();
  }

  private handleSettingsUpdated(settings: any): void {
    this.settings = settings;
    this.isEnabled = settings.enabled;
    console.log(`📝 Content script enabled state: ${this.isEnabled}`);
  }

  private async handleTestSnippetModalShow(): Promise<void> {
    await TestSnippetModal.show();
  }

  // Event handler callbacks
  private async handleTriggerDetected(
    text: string,
    cursorPosition: number,
    target: HTMLElement,
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const result = this.triggerDetector.processInput(text, cursorPosition);
      console.log("🎯 Trigger detection result:", result);

      if (result.isMatch && result.trigger) {
        console.log("✨ Match found! Processing trigger:", result.trigger);
        await this.triggerProcessor.processTrigger(
          result.trigger,
          target,
          result,
        );
      }
    } catch (error) {
      console.error("Error processing input:", error);
    }
  }

  private async handleKeyEvent(
    event: KeyboardEvent,
    target: HTMLElement,
  ): Promise<void> {
    // Handle Escape key - undo or hide cycling UI
    if (event.key === "Escape") {
      if (this.triggerProcessor.getIsCycling()) {
        this.triggerProcessor.endCycling();
        event.preventDefault();
        return;
      }
      this.triggerProcessor.undoLastReplacement(target);
      return;
    }

    // Handle cycling state
    if (this.triggerProcessor.getIsCycling() && isTextInput(target)) {
      if (event.key === "Tab") {
        event.preventDefault();
        await this.triggerProcessor.cycleToNextOption();
        return;
      } else {
        event.preventDefault();
        await this.triggerProcessor.cementCurrentCyclingOption(target);
        return;
      }
    }

    // Check for expansion trigger (Tab or Space)
    if ((event.key === "Tab" || event.key === " ") && isTextInput(target)) {
      const text = getElementText(target);
      const cursorPosition = getCursorPosition(target);
      const result = this.triggerDetector.processInput(text, cursorPosition);

      if (result.potentialTrigger || (result.isMatch && result.trigger)) {
        event.preventDefault();
        const triggerToProcess = result.trigger || result.potentialTrigger;
        if (triggerToProcess) {
          await this.triggerProcessor.processTrigger(
            triggerToProcess,
            target,
            result,
          );
        }
      }
    }
  }

  private handleElementFocus(target: HTMLElement): void {
    this.activeElement = target;
    this.snippetManager.loadSnippets();
  }

  private handleElementBlur(_target: HTMLElement): void {
    this.activeElement = null;
    this.triggerDetector.reset();
    if (this.triggerProcessor.getIsCycling()) {
      this.triggerProcessor.endCycling();
    }
  }

  private handleDOMChange(): void {
    console.log("🔄 DOM changed, new elements may be available");
  }

  /**
   * Handle expand text message from popup/background
   */
  private async handleExpandText(snippet: TextSnippet): Promise<void> {
    const activeElement = document.activeElement as HTMLElement;

    if (!isTextInput(activeElement)) {
      console.error("No active text input found");
      return;
    }

    // For manual expansion, insert at cursor position
    this.textReplacer.insertTextAtCursor(activeElement, snippet.content);
  }

  /**
   * Handle variable prompt message
   */
  private async handleVariablePrompt(
    message: VariablePromptMessage,
  ): Promise<void> {
    await this.placeholderHandler.promptForVariables(message.snippet);
  }

  /**
   * Enable/disable content script
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.eventHandler.setEnabled(enabled);
    console.log(`PuffPuffPaste ${enabled ? "enabled" : "disabled"}`);
  }
}

// Initialize content script when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new ContentScript();
  });
} else {
  new ContentScript();
}
