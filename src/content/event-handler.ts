/**
 * Event Handler for Content Script
 * Manages all DOM event listeners and event delegation
 */

import { isTextInput, getElementText, getCursorPosition } from "./utils/dom-utils";

/**
 * Event handler callbacks interface
 */
export interface EventHandlerCallbacks {
  onTriggerDetected: (text: string, cursorPosition: number, target: HTMLElement) => Promise<void>;
  onKeyEvent: (event: KeyboardEvent, target: HTMLElement) => Promise<void>;
  onElementFocus: (target: HTMLElement) => void;
  onElementBlur: (target: HTMLElement) => void;
  onDOMChange: () => void;
}

/**
 * Content Script Event Handler
 * Handles all DOM events and delegates to callbacks
 */
export class ContentEventHandler {
  private callbacks: EventHandlerCallbacks;
  private isEnabled = true;
  private observer: MutationObserver | null = null;

  // Bound event handlers to maintain context
  private handleInputBound = this.handleInput.bind(this);
  private handleKeyDownBound = this.handleKeyDown.bind(this);
  private handleFocusInBound = this.handleFocusIn.bind(this);
  private handleFocusOutBound = this.handleFocusOut.bind(this);

  constructor(callbacks: EventHandlerCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners(): void {
    // Listen for input events on the document (event delegation)
    document.addEventListener("input", this.handleInputBound, true);

    // Listen for keydown events for trigger detection
    document.addEventListener("keydown", this.handleKeyDownBound, true);

    // Listen for focus events to track active element
    document.addEventListener("focusin", this.handleFocusInBound, true);
    document.addEventListener("focusout", this.handleFocusOutBound, true);

    // Setup DOM mutation observer
    this.setupDOMObserver();

    console.log("🎧 Content script event listeners set up");
  }

  /**
   * Remove all event listeners
   */
  removeEventListeners(): void {
    document.removeEventListener("input", this.handleInputBound, true);
    document.removeEventListener("keydown", this.handleKeyDownBound, true);
    document.removeEventListener("focusin", this.handleFocusInBound, true);
    document.removeEventListener("focusout", this.handleFocusOutBound, true);

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    console.log("🔇 Content script event listeners removed");
  }

  /**
   * Enable/disable event handling
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Handle input events for trigger detection
   */
  private async handleInput(event: Event): Promise<void> {
    if (!this.isEnabled) return;

    const target = event.target as HTMLElement;

    // Only process text inputs and contenteditable elements
    if (!isTextInput(target)) return;

    try {
      const text = getElementText(target);
      const cursorPosition = getCursorPosition(target);

      console.log("🔍 Input event:", {
        text,
        cursorPosition,
        textLength: text.length,
      });

      // Delegate to callback
      await this.callbacks.onTriggerDetected(text, cursorPosition, target);
    } catch (error) {
      console.error("❌ Error handling input:", error);
    }
  }

  /**
   * Handle keydown events for special key combinations
   */
  private async handleKeyDown(event: KeyboardEvent): Promise<void> {
    if (!this.isEnabled) return;

    const target = event.target as HTMLElement;

    try {
      // Delegate all key events to callback for processing
      await this.callbacks.onKeyEvent(event, target);
    } catch (error) {
      console.error("❌ Error handling keydown:", error);
    }
  }

  /**
   * Handle focus in events
   */
  private handleFocusIn(event: FocusEvent): void {
    if (!this.isEnabled) return;

    const target = event.target as HTMLElement;

    if (isTextInput(target)) {
      this.callbacks.onElementFocus(target);
    }
  }

  /**
   * Handle focus out events
   */
  private handleFocusOut(event: FocusEvent): void {
    if (!this.isEnabled) return;

    const target = event.target as HTMLElement;

    if (isTextInput(target)) {
      this.callbacks.onElementBlur(target);
    }
  }

  /**
   * Setup DOM mutation observer
   */
  private setupDOMObserver(): void {
    // Create observer to watch for DOM changes
    this.observer = new MutationObserver((mutations) => {
      let hasRelevantChanges = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          hasRelevantChanges = true;
          break;
        }
      }

      if (hasRelevantChanges) {
        this.handleDOMChanges();
      }
    });

    // Start observing
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Handle DOM changes (new elements added)
   */
  private handleDOMChanges(): void {
    if (!this.isEnabled) return;

    try {
      this.callbacks.onDOMChange();
    } catch (error) {
      console.error("❌ Error handling DOM changes:", error);
    }
  }

  /**
   * Get current enabled state
   */
  isEventHandlingEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.removeEventListeners();
  }
}