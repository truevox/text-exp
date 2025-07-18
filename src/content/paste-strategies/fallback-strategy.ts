/**
 * Fallback Clipboard Strategy
 * Universal paste strategy that works with any target surface
 * Uses dual text/html clipboard writes and browser selection optimization
 */

import {
  BasePasteStrategy,
  PasteContent,
  PasteResult,
  PasteOptions,
  PasteUtils,
} from "./base-strategy.js";
import type { TargetSurface } from "../target-detector.js";

export class FallbackPasteStrategy extends BasePasteStrategy {
  readonly name = "fallback-paste";
  readonly priority = 10; // Lowest priority - used as last resort
  readonly supportedTargets = ["*"]; // Supports all target types

  /**
   * Check if this strategy can handle the target (always true for fallback)
   */
  canHandle(target: TargetSurface): boolean {
    return true; // Fallback handles everything
  }

  /**
   * Transform content for fallback strategy
   */
  async transformContent(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteContent> {
    const transformations: string[] = [];
    let html = content.html || "";
    let text = content.text || "";

    // Generate text from HTML if needed
    if (!text && html) {
      text = this.htmlToText(html);
      transformations.push("html-to-text");
    }

    // Generate HTML from text if needed
    if (!html && text) {
      if (target.capabilities.supportsHTML) {
        html = this.textToHtml(text);
        transformations.push("text-to-html");
      }
    }

    // Apply target-specific transformations
    if (!target.capabilities.supportsHTML && html) {
      text = this.htmlToText(html);
      html = "";
      transformations.push("strip-html");
    }

    // Apply length limits
    if (target.capabilities.maxLength) {
      const maxLength = target.capabilities.maxLength;
      if (text.length > maxLength) {
        text = text.substring(0, maxLength);
        transformations.push(`truncate-text-${maxLength}`);
      }
      if (html.length > maxLength) {
        html = html.substring(0, maxLength);
        transformations.push(`truncate-html-${maxLength}`);
      }
    }

    // Clean up content
    if (html) {
      html = this.cleanHtml(html);
      transformations.push("clean-html");
    }

    if (text) {
      text = this.cleanText(text);
      transformations.push("clean-text");
    }

    return {
      html,
      text,
      metadata: {
        originalFormat: content.metadata?.originalFormat || "html",
        transformations,
        snippetId: content.metadata?.snippetId,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Execute fallback paste operation
   */
  async executePaste(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteResult> {
    const element = target.element;
    const html = content.html || "";
    const text = content.text || "";

    this.log("Executing fallback paste", {
      html: html.substring(0, 100),
      text: text.substring(0, 100),
      target: target.type,
    });

    try {
      // Focus the target element
      this.focusTarget(element);

      // Try different paste methods in order of preference
      const methods = [
        () => this.tryClipboardApiPaste(html, text, element, target),
        () => this.tryExecCommandPaste(html, text, element, target),
        () => this.tryDirectContentPaste(html, text, element, target),
        () => this.trySimulatedTypingPaste(text, element, target),
      ];

      for (const method of methods) {
        try {
          const result = await method();
          if (result.success) {
            return result;
          }
        } catch (error) {
          this.log("Paste method failed, trying next", error);
        }
      }

      return this.createResult(
        false,
        "direct",
        content.metadata?.transformations || [],
        "All paste methods failed",
      );
    } catch (error) {
      this.log("Fallback paste failed", error);
      return this.createResult(
        false,
        "direct",
        content.metadata?.transformations || [],
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Try modern clipboard API paste
   */
  private async tryClipboardApiPaste(
    html: string,
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["clipboard-api"];

    if (!PasteUtils.isClipboardApiAvailable()) {
      return this.createResult(
        false,
        "clipboard",
        transformations,
        "Clipboard API not available",
      );
    }

    try {
      // Write to clipboard
      const writeSuccess = await PasteUtils.writeToClipboard(text, html);
      if (!writeSuccess) {
        return this.createResult(
          false,
          "clipboard",
          transformations,
          "Failed to write to clipboard",
        );
      }

      // Wait for clipboard to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Trigger paste event
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
      });

      const handled = element.dispatchEvent(pasteEvent);

      if (!handled) {
        // If paste event was cancelled, try reading from clipboard
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText) {
            return await this.tryDirectContentPaste(
              "",
              clipboardText,
              element,
              target,
            );
          }
        } catch (clipboardError) {
          this.log("Clipboard read failed", clipboardError);
        }
      }

      return this.createResult(true, "clipboard", transformations);
    } catch (error) {
      return this.createResult(
        false,
        "clipboard",
        transformations,
        error instanceof Error ? error.message : "Clipboard API failed",
      );
    }
  }

  /**
   * Try execCommand paste
   */
  private async tryExecCommandPaste(
    html: string,
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["execcommand"];

    try {
      // Create temporary element for copy operation
      const tempElement = target.capabilities.supportsHTML
        ? this.createTempHtmlElement(html)
        : PasteUtils.createTempTextarea(text);

      // Select content
      if (tempElement.tagName === "TEXTAREA") {
        (tempElement as HTMLTextAreaElement).select();
      } else {
        const range = document.createRange();
        range.selectNodeContents(tempElement);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      // Copy to clipboard
      const copySuccess = document.execCommand("copy");

      // Clean up
      PasteUtils.removeTempElement(tempElement);

      if (!copySuccess) {
        return this.createResult(
          false,
          "clipboard",
          transformations,
          "execCommand copy failed",
        );
      }

      // Focus target and paste
      this.focusTarget(element);
      const pasteSuccess = document.execCommand("paste");

      if (!pasteSuccess) {
        // Fallback: trigger paste event
        PasteUtils.triggerPasteEvent(element, text, html);
      }

      return this.createResult(true, "clipboard", transformations);
    } catch (error) {
      return this.createResult(
        false,
        "clipboard",
        transformations,
        error instanceof Error ? error.message : "execCommand failed",
      );
    }
  }

  /**
   * Try direct content insertion
   */
  private async tryDirectContentPaste(
    html: string,
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["direct-insert"];

    try {
      // Handle different element types
      if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        return await this.insertIntoInput(
          text,
          element as HTMLInputElement,
          target,
        );
      } else if (
        element.contentEditable === "true" ||
        element.getAttribute("contenteditable") === "true"
      ) {
        return await this.insertIntoContentEditable(
          html || text,
          element,
          target,
        );
      } else {
        return await this.insertIntoGenericElement(
          html || text,
          element,
          target,
        );
      }
    } catch (error) {
      return this.createResult(
        false,
        "direct",
        transformations,
        error instanceof Error ? error.message : "Direct insertion failed",
      );
    }
  }

  /**
   * Try simulated typing paste
   */
  private async trySimulatedTypingPaste(
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["simulated-typing"];

    try {
      await this.simulateTyping(text, element, 5); // Faster typing for fallback
      return this.createResult(true, "simulation", transformations);
    } catch (error) {
      return this.createResult(
        false,
        "simulation",
        transformations,
        error instanceof Error ? error.message : "Simulated typing failed",
      );
    }
  }

  /**
   * Insert content into input/textarea
   */
  private async insertIntoInput(
    text: string,
    input: HTMLInputElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["input-insert"];

    try {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const value = input.value;

      // Insert text at cursor position
      const newValue = value.slice(0, start) + text + value.slice(end);
      input.value = newValue;

      // Update cursor position
      const newCursor = start + text.length;
      input.setSelectionRange(newCursor, newCursor);

      // Trigger events
      this.triggerInputEvents(input);

      return this.createResult(true, "direct", transformations);
    } catch (error) {
      return this.createResult(
        false,
        "direct",
        transformations,
        error instanceof Error ? error.message : "Input insertion failed",
      );
    }
  }

  /**
   * Insert content into contenteditable element
   */
  private async insertIntoContentEditable(
    content: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["contenteditable-insert"];

    try {
      const selection = window.getSelection();

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();

        if (target.capabilities.supportsHTML && content.includes("<")) {
          // Insert HTML
          const fragment = document.createDocumentFragment();
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = content;

          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }

          range.insertNode(fragment);
        } else {
          // Insert plain text
          range.insertNode(document.createTextNode(content));
        }

        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // Fallback: append to end
        if (target.capabilities.supportsHTML && content.includes("<")) {
          element.innerHTML += content;
        } else {
          element.textContent += content;
        }
      }

      // Trigger events
      this.triggerContentEditableEvents(element);

      return this.createResult(true, "direct", transformations);
    } catch (error) {
      return this.createResult(
        false,
        "direct",
        transformations,
        error instanceof Error
          ? error.message
          : "ContentEditable insertion failed",
      );
    }
  }

  /**
   * Insert content into generic element
   */
  private async insertIntoGenericElement(
    content: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["generic-insert"];

    try {
      if (target.capabilities.supportsHTML && content.includes("<")) {
        element.innerHTML += content;
      } else {
        element.textContent += content;
      }

      // Trigger generic events
      this.triggerGenericEvents(element);

      return this.createResult(true, "direct", transformations);
    } catch (error) {
      return this.createResult(
        false,
        "direct",
        transformations,
        error instanceof Error ? error.message : "Generic insertion failed",
      );
    }
  }

  /**
   * Create temporary HTML element for copy operation
   */
  private createTempHtmlElement(html: string): HTMLElement {
    const div = document.createElement("div");
    div.innerHTML = html;
    div.style.position = "fixed";
    div.style.left = "-9999px";
    div.style.top = "-9999px";
    div.contentEditable = "true";
    document.body.appendChild(div);
    return div;
  }

  /**
   * Clean HTML content
   */
  private cleanHtml(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;

    // Remove script and style tags
    div.querySelectorAll("script, style").forEach((el) => el.remove());

    // Remove dangerous attributes
    div.querySelectorAll("*").forEach((el) => {
      const dangerousAttrs = [
        "onclick",
        "onload",
        "onerror",
        "onmouseover",
        "onmouseout",
      ];
      dangerousAttrs.forEach((attr) => el.removeAttribute(attr));
    });

    return div.innerHTML;
  }

  /**
   * Clean text content
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\t/g, "    ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Convert text to HTML
   */
  private textToHtml(text: string): string {
    return PasteUtils.textToHtml(text);
  }

  /**
   * Trigger input events
   */
  private triggerInputEvents(element: HTMLElement): void {
    const events = ["input", "change", "keyup"];
    events.forEach((eventType) => {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    });
  }

  /**
   * Trigger contenteditable events
   */
  private triggerContentEditableEvents(element: HTMLElement): void {
    const events = ["input", "change", "DOMSubtreeModified"];
    events.forEach((eventType) => {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    });
  }

  /**
   * Trigger generic events
   */
  private triggerGenericEvents(element: HTMLElement): void {
    const events = ["input", "change", "DOMNodeInserted"];
    events.forEach((eventType) => {
      const event = new Event(eventType, { bubbles: true });
      element.dispatchEvent(event);
    });
  }

  /**
   * Get confidence score (always low for fallback)
   */
  override getConfidence(target: TargetSurface): number {
    // Fallback always has low confidence to be used as last resort
    return 0.1;
  }
}
