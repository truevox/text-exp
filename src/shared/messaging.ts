/**
 * Chrome extension messaging utilities
 * Handles communication between content scripts, popup, and background
 */

import type { 
  BaseMessage, 
  MessageType, 
  TextSnippet, 
  ExtensionSettings,
  ExpandTextMessage,
  VariablePromptMessage 
} from './types.js';

/**
 * Message sender utility class
 */
export class MessageSender {
  /**
   * Send message to background script
   */
  static async sendToBackground<T = any>(
    type: MessageType, 
    data?: any
  ): Promise<T> {
    const message: BaseMessage = {
      type,
      timestamp: Date.now(),
      ...data
    };
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Send message to content script
   */
  static async sendToContentScript<T = any>(
    tabId: number,
    type: MessageType,
    data?: any
  ): Promise<T> {
    const message: BaseMessage = {
      type,
      timestamp: Date.now(),
      ...data
    };
    
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Send message to active tab
   */
  static async sendToActiveTab<T = any>(
    type: MessageType,
    data?: any
  ): Promise<T> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error('No active tab found');
    }
    
    return this.sendToContentScript(tab.id, type, data);
  }

  /**
   * Broadcast message to all tabs
   */
  static async broadcastToAllTabs(
    type: MessageType,
    data?: any
  ): Promise<void> {
    const tabs = await chrome.tabs.query({});
    const message: BaseMessage = {
      type,
      timestamp: Date.now(),
      ...data
    };
    
    const promises = tabs
      .filter(tab => tab.id !== undefined)
      .map(tab => 
        chrome.tabs.sendMessage(tab.id!, message).catch(() => {
          // Ignore errors for tabs that can't receive messages
        })
      );
    
    await Promise.allSettled(promises);
  }
}

/**
 * Message handler utility class
 */
export class MessageHandler {
  private handlers = new Map<MessageType, Function>();

  /**
   * Register a message handler
   */
  on<T = any>(type: MessageType, handler: (data: T, sender: chrome.runtime.MessageSender) => any): void {
    this.handlers.set(type, handler);
  }

  /**
   * Start listening for messages
   */
  listen(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const handler = this.handlers.get(message.type);
      
      if (handler) {
        try {
          const result = handler(message, sender);
          
          // Handle async responses
          if (result instanceof Promise) {
            result
              .then(sendResponse)
              .catch(error => sendResponse({ error: error.message }));
            return true; // Keep message channel open
          } else {
            sendResponse(result);
          }
        } catch (error) {
          sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      return false;
    });
  }

  /**
   * Remove a message handler
   */
  off(type: MessageType): void {
    this.handlers.delete(type);
  }

  /**
   * Remove all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Specific message utilities for common operations
 */
export class SnippetMessages {
  /**
   * Request snippets from background
   */
  static async getSnippets(): Promise<TextSnippet[]> {
    return MessageSender.sendToBackground('GET_SNIPPETS');
  }

  /**
   * Add a new snippet
   */
  static async addSnippet(snippet: Omit<TextSnippet, 'id' | 'createdAt' | 'updatedAt'>): Promise<TextSnippet> {
    return MessageSender.sendToBackground('ADD_SNIPPET', { snippet });
  }

  /**
   * Update an existing snippet
   */
  static async updateSnippet(id: string, updates: Partial<TextSnippet>): Promise<void> {
    return MessageSender.sendToBackground('UPDATE_SNIPPET', { id, updates });
  }

  /**
   * Delete a snippet
   */
  static async deleteSnippet(id: string): Promise<void> {
    return MessageSender.sendToBackground('DELETE_SNIPPET', { id });
  }

  /**
   * Trigger text expansion
   */
  static async expandText(trigger: string, variables?: Record<string, string>): Promise<void> {
    return MessageSender.sendToActiveTab('EXPAND_TEXT', { trigger, variables });
  }

  /**
   * Request variable input from user
   */
  static async promptForVariables(snippet: TextSnippet): Promise<Record<string, string>> {
    return MessageSender.sendToActiveTab('VARIABLE_PROMPT', { snippet });
  }
}

/**
 * Settings message utilities
 */
export class SettingsMessages {
  /**
   * Get extension settings
   */
  static async getSettings(): Promise<ExtensionSettings> {
    return MessageSender.sendToBackground('GET_SETTINGS');
  }

  /**
   * Update extension settings
   */
  static async updateSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    return MessageSender.sendToBackground('UPDATE_SETTINGS', { settings });
  }
}

/**
 * Sync message utilities
 */
export class SyncMessages {
  /**
   * Trigger manual sync
   */
  static async syncSnippets(): Promise<void> {
    return MessageSender.sendToBackground('SYNC_SNIPPETS');
  }
}

/**
 * Create a typed message handler for easier use
 */
export function createMessageHandler() {
  return new MessageHandler();
}

/**
 * Response wrapper for message handlers
 */
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(data?: T): MessageResponse<T> {
  return { success: true, data };
}

/**
 * Create an error response
 */
export function createErrorResponse(error: string): MessageResponse {
  return { success: false, error };
}