/**
 * Message Service for Content Script
 * Handles all message communication with background script
 */

import {
  createMessageHandler,
  createSuccessResponse,
  createErrorResponse,
} from "../../shared/messaging";
import type {
  ExpandTextMessage,
  VariablePromptMessage,
  TextSnippet,
} from "../../shared/types";

/**
 * Message service callbacks interface
 */
export interface MessageServiceCallbacks {
  onExpandText: (snippet: TextSnippet) => Promise<void>;
  onVariablePrompt: (message: VariablePromptMessage) => Promise<void>;
  onSnippetsUpdated: () => Promise<void>;
  onSettingsUpdated: (settings: any) => void;
}

/**
 * Content Script Message Service
 * Manages all communication with background script and popup
 */
export class ContentMessageService {
  private messageHandler = createMessageHandler();
  private callbacks: MessageServiceCallbacks;

  constructor(callbacks: MessageServiceCallbacks) {
    this.callbacks = callbacks;
    this.setupMessageHandlers();
  }

  /**
   * Set up message handlers for communication with background script
   */
  private setupMessageHandlers(): void {
    this.messageHandler.on("EXPAND_TEXT", this.handleExpandText.bind(this));
    this.messageHandler.on(
      "VARIABLE_PROMPT",
      this.handleVariablePrompt.bind(this),
    );

    // Listen for snippet updates from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "SNIPPETS_UPDATED") {
        console.log(
          "📢 Received SNIPPETS_UPDATED message, refreshing snippets...",
        );
        this.callbacks.onSnippetsUpdated();
        sendResponse({ success: true });
        return true; // Indicate async response
      } else if (message.type === "SETTINGS_UPDATED") {
        console.log(
          "⚙️ Received SETTINGS_UPDATED message, updating settings...",
        );
        this.callbacks.onSettingsUpdated(message.settings);
        sendResponse({ success: true });
        return true; // Indicate async response
      }
      return false; // Not handling this message
    });

    this.messageHandler.listen();
  }

  /**
   * Handle expand text message from popup or background
   */
  private async handleExpandText(message: ExpandTextMessage): Promise<any> {
    try {
      console.log("📨 Handling EXPAND_TEXT message:", message);
      await this.callbacks.onExpandText(message.snippet);
      return createSuccessResponse({ expanded: true });
    } catch (error) {
      console.error("❌ Error expanding text:", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Handle variable prompt message
   */
  private async handleVariablePrompt(
    message: VariablePromptMessage,
  ): Promise<any> {
    try {
      console.log("📨 Handling VARIABLE_PROMPT message:", message);
      await this.callbacks.onVariablePrompt(message);
      return createSuccessResponse({ prompted: true });
    } catch (error) {
      console.error("❌ Error handling variable prompt:", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Destroy the message service
   */
  destroy(): void {
    // Cleanup if needed
  }
}
