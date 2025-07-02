/**
 * Content Script for Collaborative Text Expander
 * Main entry point for text expansion functionality on web pages
 */

import { EnhancedTriggerDetector } from './enhanced-trigger-detector';
import { TextReplacer } from './text-replacer';
import { PlaceholderHandler } from './placeholder-handler';
import { createMessageHandler, createSuccessResponse, createErrorResponse } from '../shared/messaging';
import type { ExpandTextMessage, VariablePromptMessage, TextSnippet, ReplacementContext } from '../shared/types';
import { ExtensionStorage } from '../shared/storage';

/**
 * Main content script class
 */
export class ContentScript {
  private triggerDetector: EnhancedTriggerDetector;
  private textReplacer: TextReplacer;
  private placeholderHandler: PlaceholderHandler;
  private messageHandler = createMessageHandler();
  private isEnabled = true;
  private activeElement: HTMLElement | null = null;

  constructor(
    triggerDetector?: EnhancedTriggerDetector,
    textReplacer?: TextReplacer,
    placeholderHandler?: PlaceholderHandler
  ) {
    // Initialize with empty snippets and default prefix
    this.triggerDetector = triggerDetector || new EnhancedTriggerDetector([], ';');
    this.textReplacer = textReplacer || new TextReplacer();
    this.placeholderHandler = placeholderHandler || new PlaceholderHandler();
    
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
        console.log('PuffPuffPaste is disabled');
        return;
      }
      
      // Load snippets and update trigger detector
      await this.loadSnippets();
      
      this.setupEventListeners();
      this.setupMessageHandlers();
      
      console.log('✅ PuffPuffPaste content script initialized');
    } catch (error) {
      console.error('Failed to initialize content script:', error);
    }
  }

  /**
   * Load snippets from storage and update trigger detector
   */
  private async loadSnippets(): Promise<void> {
    try {
      const snippets = await ExtensionStorage.getSnippets();
      const settings = await ExtensionStorage.getSettings();
      
      // Add built-in test snippet if not disabled
      if (!settings.disableTestSnippet) {
        const testTrigger = settings.testTrigger || ';htest';
        
        const builtInTestSnippet: TextSnippet = {
          id: 'builtin-test',
          trigger: testTrigger,
          content: 'Hello World!',
          createdAt: new Date(),
          updatedAt: new Date(),
          variables: [],
          tags: ['builtin', 'test'],
          isBuiltIn: true
        };
        
        snippets.push(builtInTestSnippet);
        console.log('📝 Added built-in test snippet with trigger:', testTrigger);
      }
      
      console.log('📚 Loaded snippets:', snippets.length, 'total');
      this.triggerDetector.updateSnippets(snippets);
    } catch (error) {
      console.error('Failed to load snippets:', error);
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
      const text = this.getElementText(target);
      const cursorPosition = this.getCursorPosition(target);
      
      console.log('🔍 Input event:', { text, cursorPosition, textLength: text.length });
      
      const result = this.triggerDetector.processInput(text, cursorPosition);
      
      console.log('🎯 Trigger detection result:', result);
      
      if (result.isMatch && result.trigger) {
        console.log('✨ Match found! Processing trigger:', result.trigger);
        await this.processTrigger(result.trigger, target, result);
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
      const text = this.getElementText(target);
      const cursorPosition = this.getCursorPosition(target);
      
      console.log('⌨️ Keydown trigger check:', { key: event.key, text, cursorPosition });
      
      const result = this.triggerDetector.processInput(text, cursorPosition);
      
      console.log('🔍 Keydown trigger result:', result);
      
      if (result.potentialTrigger || (result.isMatch && result.trigger)) {
        console.log('🚀 Preventing default and processing trigger');
        event.preventDefault();
        const triggerToProcess = result.trigger || result.potentialTrigger;
        if (triggerToProcess) {
          await this.processTrigger(triggerToProcess, target, result);
        }
      }
    }
  }

  /**
   * Handle focus in events
   */
  private handleFocusIn(event: Event): void {
    const target = event.target as HTMLElement;
    if (this.isTextInput(target)) {
      this.activeElement = target;
      // Load fresh snippets when focusing on a new element
      this.loadSnippets();
    }
  }

  /**
   * Handle focus out events
   */
  private handleFocusOut(event: Event): void {
    this.activeElement = null;
    // Reset the detector state
    this.triggerDetector.reset();
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
  private async processTrigger(trigger: string, element: HTMLElement, result: any): Promise<void> {
    console.log('🎯 Processing trigger:', { trigger, element, result });
    
    try {
      let snippet = await ExtensionStorage.findSnippetByTrigger(trigger);
      
      // If not found in storage, check if it's the built-in test snippet
      if (!snippet) {
        const settings = await ExtensionStorage.getSettings();
        const testTrigger = settings.testTrigger || ';htest';
        
        if (trigger === testTrigger && !settings.disableTestSnippet) {
          // Create the built-in test snippet
          snippet = {
            id: 'builtin-test',
            trigger: testTrigger,
            content: 'Hello World!',
            createdAt: new Date(),
            updatedAt: new Date(),
            variables: [],
            tags: ['builtin', 'test'],
            isBuiltIn: true
          };
          console.log('🧪 Using built-in test snippet:', snippet);
        }
      }
      
      console.log('🔍 Found snippet:', snippet);
      
      if (!snippet) {
        console.log('❌ No matching snippet found for trigger:', trigger);
        return; // No matching snippet found
      }
      
      // Handle built-in test snippet customization
      if (snippet.isBuiltIn && snippet.id === 'builtin-test') {
        console.log('🧪 Built-in test snippet detected');
        const settings = await ExtensionStorage.getSettings();
        console.log('⚙️ Settings:', settings);
        if (!settings.hasSeenTestSnippet) {
          console.log('👋 First time seeing test snippet - showing customization');
          await this.showTestSnippetCustomization();
          return; // Don't expand on first use, just show customization
        }
      }
      
      // Check if snippet has variables
      if (snippet.variables && snippet.variables.length > 0) {
        console.log('📝 Snippet has variables, prompting...');
        const variables = await this.placeholderHandler.promptForVariables(snippet);
        await this.expandWithVariables(snippet, variables, element, result);
      } else {
        console.log('✨ Expanding simple snippet');
        await this.expandText(snippet, element, result);
      }
    } catch (error) {
      console.error('❌ Error processing trigger:', error);
    }
  }

  /**
   * Expand text without variables
   */
  private async expandText(snippet: TextSnippet, element: HTMLElement, result: any): Promise<void> {
    console.log('🚀 expandText called with:', { snippet, element });
    
    const context = this.createReplacementContext(element, snippet.trigger, snippet);
    console.log('📍 Replacement context:', context);
    
    if (context) {
      console.log('✅ Context valid, calling textReplacer');
      this.textReplacer.replaceText(context, snippet.content);
      
      // Log expansion for analytics
      console.log(`✨ Expanded "${snippet.trigger}" → "${snippet.content.substring(0, 50)}..."`);
    } else {
      console.log('❌ Invalid replacement context');
    }
  }

  /**
   * Expand text with variables
   */
  private async expandWithVariables(
    snippet: TextSnippet, 
    variables: Record<string, string>, 
    element: HTMLElement,
    result: any
  ): Promise<void> {
    const context = this.createReplacementContext(element, snippet.trigger, snippet);
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
      
      // For manual expansion, insert at cursor position
      const expandedContent = message.variables 
        ? this.placeholderHandler.replaceVariables(message.snippet.content, message.variables)
        : message.snippet.content;
      
      this.textReplacer.insertTextAtCursor(expandedContent, activeElement);
      
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
   * Get text content from element
   */
  private getElementText(element: HTMLElement): string {
    if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
      return (element as HTMLInputElement | HTMLTextAreaElement).value;
    } else if (element.contentEditable === 'true') {
      return element.textContent || '';
    }
    return '';
  }

  /**
   * Get cursor position in element
   */
  private getCursorPosition(element: HTMLElement): number {
    if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
      return (element as HTMLInputElement | HTMLTextAreaElement).selectionStart || 0;
    } else if (element.contentEditable === 'true') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        return range.startOffset;
      }
    }
    return 0;
  }

  /**
   * Create replacement context for text replacer
   */
  private createReplacementContext(element: HTMLElement, trigger: string, snippet: TextSnippet): ReplacementContext | null {
    const text = this.getElementText(element);
    const cursorPosition = this.getCursorPosition(element);
    
    // Find trigger position by looking backwards from cursor
    const beforeCursor = text.substring(0, cursorPosition);
    const triggerStart = beforeCursor.lastIndexOf(trigger);
    
    if (triggerStart === -1) {
      return null;
    }
    
    return {
      element,
      startOffset: triggerStart,
      endOffset: triggerStart + trigger.length,
      trigger,
      snippet
    };
  }

  /**
   * Show test snippet customization modal
   */
  private async showTestSnippetCustomization(): Promise<void> {
    return new Promise((resolve) => {
      const modal = this.createTestCustomizationModal(resolve);
      document.body.appendChild(modal);
      
      // Focus the input field
      const input = modal.querySelector('input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  /**
   * Create test snippet customization modal
   */
  private createTestCustomizationModal(onComplete: () => void): HTMLElement {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      min-width: 400px;
      max-width: 500px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    `;

    modal.innerHTML = `
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #333;">
        🧪 Test Snippet Found!
      </h2>
      <p style="margin: 0 0 20px 0; color: #666; line-height: 1.4;">
        PuffPuffPaste includes a built-in test snippet to verify basic functionality. 
        You can customize or disable it:
      </p>
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #555;">
          Trigger (current: ;htest):
        </label>
        <input type="text" id="customTrigger" value=";htest" 
               style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
      </div>
      
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
        <button id="disableBtn" style="padding: 8px 16px; border: 1px solid #ddd; background: white; color: #333; border-radius: 4px; cursor: pointer; font-size: 14px;">
          Disable Test
        </button>
        <button id="saveBtn" style="padding: 8px 16px; border: 1px solid #007bff; background: #007bff; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
          Save & Continue
        </button>
      </div>
    `;

    overlay.appendChild(modal);

    // Handle buttons
    const saveBtn = modal.querySelector('#saveBtn') as HTMLButtonElement;
    const disableBtn = modal.querySelector('#disableBtn') as HTMLButtonElement;
    const input = modal.querySelector('#customTrigger') as HTMLInputElement;

    saveBtn.addEventListener('click', async () => {
      const newTrigger = input.value.trim();
      if (newTrigger && newTrigger !== ';htest') {
        await ExtensionStorage.setSettings({ testTrigger: newTrigger });
      }
      await ExtensionStorage.setSettings({ hasSeenTestSnippet: true });
      await this.loadSnippets(); // Reload with new trigger
      document.body.removeChild(overlay);
      onComplete();
    });

    disableBtn.addEventListener('click', async () => {
      await ExtensionStorage.setSettings({ 
        disableTestSnippet: true,
        hasSeenTestSnippet: true 
      });
      await this.loadSnippets(); // Reload without test snippet
      document.body.removeChild(overlay);
      onComplete();
    });

    // Handle Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveBtn.click();
      }
    });

    return overlay;
  }

  /**
   * Enable/disable content script
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`PuffPuffPaste ${enabled ? 'enabled' : 'disabled'}`);
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