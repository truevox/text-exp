/**
 * Base Paste Strategy Interface
 * Defines the contract for all paste strategies
 */

import type { TargetSurface } from "../target-detector.js";

export interface PasteContent {
  html?: string;
  text?: string;
  markdown?: string;
  variables?: Record<string, string>;
  metadata?: PasteMetadata;
}

export interface PasteMetadata {
  originalFormat: "html" | "plaintext" | "latex" | "markdown";
  transformations: string[];
  snippetId?: string;
  timestamp: number;
}

export interface PasteResult {
  success: boolean;
  method: "direct" | "clipboard" | "simulation" | "custom";
  transformations: string[];
  error?: string;
  fallbackUsed?: boolean;
}

export interface PasteOptions {
  preserveFormatting?: boolean;
  convertToMarkdown?: boolean;
  stripStyles?: boolean;
  maxLength?: number;
  allowedTags?: string[];
  simulateTyping?: boolean;
  insertAtCursor?: boolean;
}

/**
 * Base paste strategy that all implementations inherit from
 */
export abstract class BasePasteStrategy {
  abstract readonly name: string;
  abstract readonly priority: number;
  abstract readonly supportedTargets: string[];

  /**
   * Check if this strategy can handle the given target
   */
  abstract canHandle(target: TargetSurface): boolean;

  /**
   * Transform content for the target surface
   */
  abstract transformContent(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteContent>;

  /**
   * Execute the paste operation
   */
  abstract executePaste(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteResult>;

  /**
   * Get the confidence score for handling this target (0-1)
   */
  getConfidence(target: TargetSurface): number {
    if (!this.canHandle(target)) {
      return 0;
    }
    return target.metadata.detectionConfidence * 0.8; // Base confidence
  }

  /**
   * Validate content before pasting
   */
  protected validateContent(
    content: PasteContent,
    target: TargetSurface,
  ): boolean {
    const caps = target.capabilities;

    // Check if content type is supported
    if (content.html && !caps.supportsHTML) {
      return false;
    }

    if (content.markdown && !caps.supportsMarkdown) {
      return false;
    }

    // Check length limits
    if (caps.maxLength) {
      const textLength = content.text?.length || content.html?.length || 0;
      if (textLength > caps.maxLength) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitize HTML content based on target capabilities
   */
  protected sanitizeHTML(html: string, target: TargetSurface): string {
    if (!target.capabilities.allowedTags) {
      return html;
    }

    const allowedTags = target.capabilities.allowedTags;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Remove disallowed tags
    const allElements = tempDiv.querySelectorAll("*");
    for (const element of allElements) {
      if (!allowedTags.includes(element.tagName.toLowerCase())) {
        element.outerHTML = element.innerHTML;
      }
    }

    return tempDiv.innerHTML;
  }

  /**
   * Convert HTML to plain text
   */
  protected htmlToText(html: string): string {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  }

  /**
   * Simulate typing text character by character
   */
  protected async simulateTyping(
    text: string,
    target: HTMLElement,
    delay: number = 10,
  ): Promise<void> {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Create and dispatch input events
      const inputEvent = new InputEvent("input", {
        data: char,
        inputType: "insertText",
        bubbles: true,
      });

      // Insert character
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        const input = target as HTMLInputElement;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const value = input.value;

        input.value = value.slice(0, start) + char + value.slice(end);
        input.selectionStart = input.selectionEnd = start + 1;
      } else if (target.contentEditable === "true") {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(char));
          range.collapse(false);
        }
      }

      target.dispatchEvent(inputEvent);

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Focus the target element
   */
  protected focusTarget(target: HTMLElement): void {
    if (target.focus) {
      target.focus();
    }

    // Set cursor to end for inputs
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      const input = target as HTMLInputElement;
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  /**
   * Get cursor position in target
   */
  protected getCursorPosition(target: HTMLElement): number {
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      return (target as HTMLInputElement).selectionStart || 0;
    }

    if (target.contentEditable === "true") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(target);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        return preCaretRange.toString().length;
      }
    }

    return 0;
  }

  /**
   * Set cursor position in target
   */
  protected setCursorPosition(target: HTMLElement, position: number): void {
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      const input = target as HTMLInputElement;
      input.setSelectionRange(position, position);
    } else if (target.contentEditable === "true") {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        const textNode = target.childNodes[0];
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          range.setStart(
            textNode,
            Math.min(position, textNode.textContent?.length || 0),
          );
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }

  /**
   * Create a paste result
   */
  protected createResult(
    success: boolean,
    method: PasteResult["method"],
    transformations: string[] = [],
    error?: string,
    fallbackUsed?: boolean,
  ): PasteResult {
    return {
      success,
      method,
      transformations,
      error,
      fallbackUsed,
    };
  }

  /**
   * Log paste operation for debugging
   */
  protected log(message: string, ...args: any[]): void {
    console.log(`[${this.name}] ${message}`, ...args);
  }
}

/**
 * Utility functions for paste strategies
 */
export class PasteUtils {
  /**
   * Check if clipboard API is available
   */
  static isClipboardApiAvailable(): boolean {
    return (
      typeof navigator !== "undefined" &&
      "clipboard" in navigator &&
      "writeText" in navigator.clipboard
    );
  }

  /**
   * Write text to clipboard
   */
  static async writeToClipboard(text: string, html?: string): Promise<boolean> {
    if (!this.isClipboardApiAvailable()) {
      return false;
    }

    try {
      if (html && "write" in navigator.clipboard) {
        const data = new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        });
        await navigator.clipboard.write([data]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      return true;
    } catch (error) {
      console.error("Failed to write to clipboard:", error);
      return false;
    }
  }

  /**
   * Create a temporary textarea for clipboard operations
   */
  static createTempTextarea(content: string): HTMLTextAreaElement {
    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    return textarea;
  }

  /**
   * Remove temporary element
   */
  static removeTempElement(element: HTMLElement): void {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /**
   * Trigger paste event on element
   */
  static triggerPasteEvent(
    element: HTMLElement,
    text: string,
    html?: string,
  ): void {
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer(),
    });

    // Add data to clipboard event
    pasteEvent.clipboardData?.setData("text/plain", text);
    if (html) {
      pasteEvent.clipboardData?.setData("text/html", html);
    }

    element.dispatchEvent(pasteEvent);
  }

  /**
   * Get text content from HTML
   */
  static getTextContent(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  /**
   * Escape HTML entities
   */
  static escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Strip HTML tags
   */
  static stripHtml(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  /**
   * Convert line breaks to HTML
   */
  static textToHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }
}
