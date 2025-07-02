/**
 * Content Script for Collaborative Text Expander
 * Main entry point for text expansion functionality on web pages
 */

import { TriggerDetector } from './trigger-detector.js';
import { TextReplacer } from './text-replacer.js';
import { PlaceholderHandler } from './placeholder-handler.js';
import { createMessageHandler, createSuccessResponse, createErrorResponse } from '../shared/messaging.js';
import type { ExpandTextMessage, VariablePromptMessage, TextSnippet } from '../shared/types.js';
import { ExtensionStorage } from '../shared/storage.js';

/**
 * Main content script class
 */
class ContentScript {
  private triggerDetector: TriggerDetector;
  private textReplacer: TextReplacer;
  private placeholderHandler: PlaceholderHandler;
  private messageHandler = createMessageHandler();
  private isEnabled = true;

  constructor() {
    this.triggerDetector = new TriggerDetector();
    this.textReplacer = new TextReplacer();
    this.placeholderHandler = new PlaceholderHandler();
    
    this.initialize();
  }

  /**
   * Initialize content script
   */
  private async initialize(): Promise<void> {
    try {
      // Check if extension is enabled
      const settings = await ExtensionStorage.getSettings();
      this.isEnabled = settings.enabled;
      
      if (!this.isEnabled) {
        console.log('Text Expander is disabled');
        return;
      }
      
      this.setupEventListeners();
      this.setupMessageHandlers();
      
      console.log('✅ Text Expander content script initialized');
    } catch (error) {
      console.error('Failed to initialize content script:', error);
    }
  }

  /**
   * Set up DOM event listeners
   */
  private setupEventListeners(): void {
    // Listen for text input events
    document.addEventListener('input', this.handleInput.bind(this), true);
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    
    // Listen for focus changes to track active element
    document.addEventListener('focusin', this.handleFocusIn.bind(this), true);
    document.addEventListener('focusout', this.handleFocusOut.bind(this), true);
    
    // Handle dynamic content changes
    const observer = new MutationObserver(this.handleDOMChanges.bind(this));
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Set up message handlers for communication with background script
   */
  private setupMessageHandlers(): void {
    this.messageHandler.on('EXPAND_TEXT', this.handleExpandText.bind(this));
    this.messageHandler.on('VARIABLE_PROMPT', this.handleVariablePrompt.bind(this));
    this.messageHandler.listen();
  }

  /**
   * Handle text input events
   */
  private async handleInput(event: Event): Promise<void> {
    if (!this.isEnabled) return;
    
    const target = event.target as HTMLElement;
    
    // Only process text inputs and contenteditable elements
    if (!this.isTextInput(target)) return;
    
    try {
      const trigger = this.triggerDetector.detectTrigger(target);
      if (trigger) {
        await this.processTrigger(trigger, target);
      }
    } catch (error) {
      console.error('Error processing input:', error);
    }
  }

  /**
   * Handle keydown events
   */
  private async handleKeyDown(event: KeyboardEvent): Promise<void> {
    if (!this.isEnabled) return;
    
    const target = event.target as HTMLElement;
    
    // Check for expansion trigger (Tab or Space)
    if ((event.key === 'Tab' || event.key === ' ') && this.isTextInput(target)) {
      const trigger = this.triggerDetector.detectTrigger(target);
      if (trigger) {
        event.preventDefault();
        await this.processTrigger(trigger, target);
      }
    }
  }

  /**
   * Handle focus in events
   */
  private handleFocusIn(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.isTextInput(target)) {
      this.triggerDetector.setActiveElement(target);
    }
  }

  /**
   * Handle focus out events
   */
  private handleFocusOut(event: Event): void {
    this.triggerDetector.setActiveElement(null);
  }

  /**
   * Handle DOM changes (for dynamic content)
   */
  private handleDOMChanges(mutations: MutationRecord[]): void {
    // Re-initialize for newly added text inputs
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const textInputs = element.querySelectorAll('input[type="text"], textarea, [contenteditable="true"]');
          textInputs.forEach(() => {
            // New text inputs are automatically handled by event delegation
          });
        }
      });
    });
  }

  /**
   * Process detected trigger
   */
  private async processTrigger(trigger: string, element: HTMLElement): Promise<void> {
    try {
      const snippet = await ExtensionStorage.findSnippetByTrigger(trigger);
      
      if (!snippet) {
        return; // No matching snippet found
      }
      
      // Check if snippet has variables
      if (snippet.variables && snippet.variables.length > 0) {
        const variables = await this.placeholderHandler.promptForVariables(snippet);
        await this.expandWithVariables(snippet, variables, element);
      } else {
        await this.expandText(snippet, element);
      }
    } catch (error) {
      console.error('Error processing trigger:', error);
    }
  }

  /**
   * Expand text without variables
   */
  private async expandText(snippet: TextSnippet, element: HTMLElement): Promise<void> {
    const context = this.triggerDetector.getReplacementContext(element, snippet.trigger);
    if (context) {
      this.textReplacer.replaceText(context, snippet.content);
      
      // Log expansion for analytics
      console.log(`Expanded "${snippet.trigger}" → "${snippet.content.substring(0, 50)}..."`);
    }
  }

  /**
   * Expand text with variables
   */
  private async expandWithVariables(
    snippet: TextSnippet, 
    variables: Record<string, string>, 
    element: HTMLElement
  ): Promise<void> {
    const context = this.triggerDetector.getReplacementContext(element, snippet.trigger);
    if (context) {
      const expandedContent = this.placeholderHandler.replaceVariables(snippet.content, variables);
      this.textReplacer.replaceText(context, expandedContent);
      
      // Log expansion for analytics
      console.log(`Expanded "${snippet.trigger}" with variables → "${expandedContent.substring(0, 50)}..."`);
    }
  }

  /**
   * Handle expand text message from popup/background
   */
  private async handleExpandText(message: ExpandTextMessage): Promise<any> {
    try {
      const activeElement = document.activeElement as HTMLElement;
      
      if (!this.isTextInput(activeElement)) {
        return createErrorResponse('No active text input found');
      }
      
      if (message.variables) {
        await this.expandWithVariables(message.snippet, message.variables, activeElement);
      } else {
        await this.expandText(message.snippet, activeElement);
      }
      
      return createSuccessResponse();
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Expansion failed');
    }
  }

  /**
   * Handle variable prompt message
   */
  private async handleVariablePrompt(message: VariablePromptMessage): Promise<any> {
    try {
      const variables = await this.placeholderHandler.promptForVariables(message.snippet);
      return createSuccessResponse(variables);
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Variable prompt failed');
    }
  }

  /**
   * Check if element is a text input
   */
  private isTextInput(element: HTMLElement): boolean {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    
    // Check for input elements
    if (tagName === 'input') {
      const inputType = (element as HTMLInputElement).type.toLowerCase();
      return ['text', 'email', 'password', 'search', 'url', 'tel'].includes(inputType);
    }
    
    // Check for textarea
    if (tagName === 'textarea') {
      return true;
    }
    
    // Check for contenteditable
    if (element.contentEditable === 'true') {
      return true;
    }
    
    return false;
  }

  /**
   * Enable/disable content script
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`Text Expander ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Initialize content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScript();
  });
} else {
  new ContentScript();
}