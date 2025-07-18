/**
 * Gmail Composer Paste Strategy
 * Handles pasting into Gmail compose window with Gmail-tuned HTML
 */

import {
  BasePasteStrategy,
  PasteContent,
  PasteResult,
  PasteOptions,
  PasteUtils,
} from "./base-strategy.js";
import type { TargetSurface } from "../target-detector.js";

export class GmailPasteStrategy extends BasePasteStrategy {
  readonly name = "gmail-paste";
  readonly priority = 95;
  readonly supportedTargets = ["gmail-composer"];

  /**
   * Check if this strategy can handle the target
   */
  canHandle(target: TargetSurface): boolean {
    return (
      target.type === "gmail-composer" ||
      (window.location.hostname.includes("mail.google.com") &&
        target.element.getAttribute("contenteditable") === "true")
    );
  }

  /**
   * Transform content for Gmail composer
   */
  async transformContent(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteContent> {
    const transformations: string[] = [];
    let html = content.html || "";
    let text = content.text || "";

    // If we only have text, convert to basic HTML
    if (!html && text) {
      html = this.textToGmailHtml(text);
      transformations.push("text-to-html");
    }

    // Transform HTML for Gmail compatibility
    if (html) {
      html = this.optimizeForGmail(html);
      transformations.push("gmail-optimization");
    }

    // Generate text version
    if (!text && html) {
      text = this.htmlToText(html);
      transformations.push("html-to-text");
    }

    // Apply Gmail-specific formatting
    html = this.applyGmailStyling(html);
    transformations.push("gmail-styling");

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
   * Execute paste operation for Gmail composer
   */
  async executePaste(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteResult> {
    const element = target.element;
    const html = content.html || "";
    const text = content.text || "";

    this.log("Executing Gmail paste", {
      html: html.substring(0, 100),
      target: target.type,
    });

    try {
      // Focus the Gmail composer
      this.focusTarget(element);

      // Try Gmail-specific paste methods
      const result = await this.tryGmailSpecificPaste(
        html,
        text,
        element,
        target,
      );
      if (result.success) {
        return result;
      }

      // Fallback to contenteditable paste
      return await this.tryContentEditablePaste(html, text, element, target);
    } catch (error) {
      this.log("Gmail paste failed", error);
      return this.createResult(
        false,
        "direct",
        content.metadata?.transformations || [],
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Try Gmail-specific paste methods
   */
  private async tryGmailSpecificPaste(
    html: string,
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["gmail-specific"];

    try {
      // Method 1: Use Gmail's own paste handling
      if (await this.tryGmailNativePaste(html, text, element)) {
        return this.createResult(true, "custom", transformations);
      }

      // Method 2: Use clipboard API with Gmail-optimized content
      if (await this.tryClipboardApiPaste(html, text, element)) {
        return this.createResult(true, "clipboard", transformations);
      }

      // Method 3: Use execCommand with Gmail-optimized content
      if (await this.tryExecCommandPaste(html, text, element)) {
        return this.createResult(true, "clipboard", transformations);
      }

      return this.createResult(
        false,
        "custom",
        transformations,
        "All Gmail-specific methods failed",
      );
    } catch (error) {
      return this.createResult(
        false,
        "custom",
        transformations,
        error instanceof Error ? error.message : "Gmail paste failed",
      );
    }
  }

  /**
   * Try Gmail's native paste handling
   */
  private async tryGmailNativePaste(
    html: string,
    text: string,
    element: HTMLElement,
  ): Promise<boolean> {
    try {
      // Look for Gmail's paste handler
      const gmailWindow = window as any;
      if (gmailWindow.gmail || gmailWindow.gmonkey) {
        // Gmail has specific paste handling, trigger it
        const pasteEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer(),
        });

        pasteEvent.clipboardData?.setData("text/html", html);
        pasteEvent.clipboardData?.setData("text/plain", text);

        element.dispatchEvent(pasteEvent);
        return true;
      }

      return false;
    } catch (error) {
      this.log("Gmail native paste failed", error);
      return false;
    }
  }

  /**
   * Try clipboard API paste
   */
  private async tryClipboardApiPaste(
    html: string,
    text: string,
    element: HTMLElement,
  ): Promise<boolean> {
    try {
      if (!PasteUtils.isClipboardApiAvailable()) {
        return false;
      }

      await PasteUtils.writeToClipboard(text, html);

      // Wait a bit for clipboard to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Focus and trigger paste
      this.focusTarget(element);
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
      });

      element.dispatchEvent(pasteEvent);
      return true;
    } catch (error) {
      this.log("Clipboard API paste failed", error);
      return false;
    }
  }

  /**
   * Try execCommand paste
   */
  private async tryExecCommandPaste(
    html: string,
    text: string,
    element: HTMLElement,
  ): Promise<boolean> {
    try {
      // Create temporary element with content
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      tempDiv.style.position = "fixed";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "-9999px";
      tempDiv.contentEditable = "true";

      document.body.appendChild(tempDiv);

      // Select the content
      const range = document.createRange();
      range.selectNodeContents(tempDiv);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Copy to clipboard
      const success = document.execCommand("copy");

      // Clean up
      document.body.removeChild(tempDiv);

      if (success) {
        // Focus target and paste
        this.focusTarget(element);
        return document.execCommand("paste");
      }

      return false;
    } catch (error) {
      this.log("execCommand paste failed", error);
      return false;
    }
  }

  /**
   * Try contenteditable paste as fallback
   */
  private async tryContentEditablePaste(
    html: string,
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["contenteditable-fallback"];

    try {
      // Insert HTML directly into contenteditable
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();

        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;

        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }

        range.insertNode(fragment);
        range.collapse(false);
      } else {
        // Fallback: append to end
        element.innerHTML += html;
      }

      // Trigger input events
      this.triggerInputEvents(element);

      return this.createResult(true, "direct", transformations);
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
   * Optimize HTML for Gmail compatibility
   */
  private optimizeForGmail(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;

    // Convert block elements to Gmail-friendly formats
    this.convertBlockElements(div);

    // Optimize lists for Gmail
    this.optimizeListsForGmail(div);

    // Convert inline styles
    this.convertInlineStyles(div);

    // Optimize line breaks
    this.optimizeLineBreaks(div);

    // Remove unsupported elements
    this.removeUnsupportedElements(div);

    return div.innerHTML;
  }

  /**
   * Convert block elements to Gmail-friendly formats
   */
  private convertBlockElements(container: HTMLElement): void {
    // Convert divs to paragraphs where appropriate
    const divs = container.querySelectorAll("div");
    divs.forEach((div) => {
      if (
        !div.querySelector("div, p, ul, ol, table") &&
        div.textContent?.trim()
      ) {
        const p = document.createElement("p");
        p.innerHTML = div.innerHTML;
        div.replaceWith(p);
      }
    });

    // Ensure paragraphs have proper spacing
    const paragraphs = container.querySelectorAll("p");
    paragraphs.forEach((p) => {
      if (!p.style.margin) {
        p.style.margin = "0 0 1em 0";
      }
    });
  }

  /**
   * Optimize lists for Gmail
   */
  private optimizeListsForGmail(container: HTMLElement): void {
    const lists = container.querySelectorAll("ul, ol");
    lists.forEach((list) => {
      // Add proper spacing
      (list as HTMLElement).style.margin = "0 0 1em 0";
      (list as HTMLElement).style.paddingLeft = "20px";

      // Optimize list items
      const items = list.querySelectorAll("li");
      items.forEach((item) => {
        (item as HTMLElement).style.margin = "0 0 0.5em 0";
      });
    });
  }

  /**
   * Convert inline styles to Gmail-compatible ones
   */
  private convertInlineStyles(container: HTMLElement): void {
    const styledElements = container.querySelectorAll("[style]");
    styledElements.forEach((element) => {
      const style = element.getAttribute("style") || "";

      // Convert common CSS properties to Gmail-compatible ones
      const gmailStyle = style
        .replace(/font-family:\s*([^;]+)/g, "font-family: $1")
        .replace(/font-size:\s*(\d+)px/g, "font-size: $1px")
        .replace(/color:\s*([^;]+)/g, "color: $1")
        .replace(/background-color:\s*([^;]+)/g, "background-color: $1")
        .replace(/text-align:\s*([^;]+)/g, "text-align: $1")
        .replace(/font-weight:\s*bold/g, "font-weight: bold")
        .replace(/font-style:\s*italic/g, "font-style: italic")
        .replace(/text-decoration:\s*underline/g, "text-decoration: underline");

      element.setAttribute("style", gmailStyle);
    });
  }

  /**
   * Optimize line breaks for Gmail
   */
  private optimizeLineBreaks(container: HTMLElement): void {
    // Replace multiple <br> tags with paragraph breaks
    const brElements = container.querySelectorAll("br");
    let consecutiveBrs: HTMLBRElement[] = [];

    brElements.forEach((br) => {
      if (
        br.previousSibling?.nodeType === Node.ELEMENT_NODE &&
        (br.previousSibling as HTMLElement).tagName === "BR"
      ) {
        consecutiveBrs.push(br);
      } else {
        if (consecutiveBrs.length > 0) {
          // Replace consecutive <br> tags with paragraph break
          const p = document.createElement("p");
          p.innerHTML = "&nbsp;";
          consecutiveBrs[0].replaceWith(p);
          consecutiveBrs.slice(1).forEach((br) => br.remove());
        }
        consecutiveBrs = [br];
      }
    });
  }

  /**
   * Remove elements not supported by Gmail
   */
  private removeUnsupportedElements(container: HTMLElement): void {
    const unsupportedElements = container.querySelectorAll(
      "script, style, meta, link, object, embed, iframe, form, input, button, select, textarea",
    );

    unsupportedElements.forEach((element) => {
      element.remove();
    });

    // Remove dangerous attributes
    const allElements = container.querySelectorAll("*");
    allElements.forEach((element) => {
      const dangerousAttrs = [
        "onclick",
        "onload",
        "onerror",
        "onmouseover",
        "onmouseout",
      ];
      dangerousAttrs.forEach((attr) => {
        element.removeAttribute(attr);
      });
    });
  }

  /**
   * Apply Gmail-specific styling
   */
  private applyGmailStyling(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;

    // Add Gmail-friendly font styling
    const bodyStyle =
      "font-family: Arial, sans-serif; font-size: 13px; line-height: 1.4;";

    // Wrap content in a styled div
    const wrapper = document.createElement("div");
    wrapper.style.cssText = bodyStyle;
    wrapper.innerHTML = div.innerHTML;

    return wrapper.innerHTML;
  }

  /**
   * Convert plain text to Gmail-compatible HTML
   */
  private textToGmailHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^/, "<p>")
      .replace(/$/, "</p>");
  }

  /**
   * Trigger input events for Gmail
   */
  private triggerInputEvents(element: HTMLElement): void {
    // Input event
    const inputEvent = new Event("input", { bubbles: true });
    element.dispatchEvent(inputEvent);

    // Change event
    const changeEvent = new Event("change", { bubbles: true });
    element.dispatchEvent(changeEvent);

    // Gmail-specific events
    const gmailInputEvent = new Event("DOMSubtreeModified", { bubbles: true });
    element.dispatchEvent(gmailInputEvent);

    // Mutation event for Gmail's change detection
    const mutationEvent = new Event("DOMNodeInserted", { bubbles: true });
    element.dispatchEvent(mutationEvent);
  }

  /**
   * Get confidence score for Gmail strategy
   */
  override getConfidence(target: TargetSurface): number {
    if (!this.canHandle(target)) {
      return 0;
    }

    // Very high confidence for Gmail composer
    if (target.type === "gmail-composer") {
      return 0.98;
    }

    // Lower confidence for generic Gmail detection
    if (window.location.hostname.includes("mail.google.com")) {
      return 0.9;
    }

    return 0;
  }
}
