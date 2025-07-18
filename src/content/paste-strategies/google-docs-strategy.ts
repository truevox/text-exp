/**
 * Google Docs Paste Strategy
 * Handles pasting into Google Docs with document-specific optimizations
 */

import {
  BasePasteStrategy,
  PasteContent,
  PasteResult,
  PasteOptions,
  PasteUtils,
} from "./base-strategy.js";
import type { TargetSurface } from "../target-detector.js";

export class GoogleDocsPasteStrategy extends BasePasteStrategy {
  readonly name = "google-docs-paste";
  readonly priority = 96; // Higher than Gmail, lower than TinyMCE
  readonly supportedTargets = ["google-docs-editor"];

  /**
   * Check if this strategy can handle the target
   */
  canHandle(target: TargetSurface): boolean {
    return (
      target.type === "google-docs-editor" ||
      (this.isGoogleDocsPage() && this.isGoogleDocsEditor(target.element))
    );
  }

  /**
   * Transform content for Google Docs
   */
  async transformContent(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteContent> {
    const transformations: string[] = [];
    let html = content.html || "";
    let text = content.text || "";

    // If we only have text, convert to Google Docs-friendly HTML
    if (!html && text) {
      html = this.textToGoogleDocsHtml(text);
      transformations.push("text-to-html");
    }

    // Transform HTML for Google Docs compatibility
    if (html) {
      html = this.optimizeForGoogleDocs(html);
      transformations.push("google-docs-optimization");
    }

    // Generate text version
    if (!text && html) {
      text = this.htmlToText(html);
      transformations.push("html-to-text");
    }

    // Apply Google Docs-specific formatting
    html = this.applyGoogleDocsStyling(html);
    transformations.push("google-docs-styling");

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
   * Execute paste operation for Google Docs
   */
  async executePaste(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteResult> {
    const element = target.element;
    const html = content.html || "";
    const text = content.text || "";

    this.log("Executing Google Docs paste", {
      html: html.substring(0, 100),
      target: target.type,
    });

    try {
      // Focus the Google Docs editor
      this.focusTarget(element);

      // Try Google Docs-specific paste methods in order of preference
      const result = await this.tryGoogleDocsSpecificPaste(
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
      this.log("Google Docs paste failed", error);
      return this.createResult(
        false,
        "direct",
        content.metadata?.transformations || [],
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Try Google Docs-specific paste methods
   */
  private async tryGoogleDocsSpecificPaste(
    html: string,
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["google-docs-specific"];

    try {
      // Method 1: Use Google Docs native paste handling
      if (await this.tryGoogleDocsNativePaste(html, text, element)) {
        return this.createResult(true, "custom", transformations);
      }

      // Method 2: Use clipboard API with Google Docs-optimized content
      if (await this.tryClipboardApiPaste(html, text, element)) {
        return this.createResult(true, "clipboard", transformations);
      }

      // Method 3: Use execCommand with Google Docs-optimized content
      if (await this.tryExecCommandPaste(html, text, element)) {
        return this.createResult(true, "clipboard", transformations);
      }

      // Method 4: Direct insertion using Google Docs API
      if (await this.tryGoogleDocsApiPaste(html, text, element)) {
        return this.createResult(true, "custom", transformations);
      }

      return this.createResult(
        false,
        "custom",
        transformations,
        "All Google Docs-specific methods failed",
      );
    } catch (error) {
      return this.createResult(
        false,
        "custom",
        transformations,
        error instanceof Error ? error.message : "Google Docs paste failed",
      );
    }
  }

  /**
   * Try Google Docs native paste handling
   */
  private async tryGoogleDocsNativePaste(
    html: string,
    text: string,
    element: HTMLElement,
  ): Promise<boolean> {
    try {
      // Look for Google Docs' paste handler in the global scope
      const docsWindow = window as any;
      if (docsWindow._docs_chrome_extension_api || docsWindow.docs) {
        // Google Docs has specific paste handling, trigger it
        const pasteEvent = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer(),
        });

        pasteEvent.clipboardData?.setData("text/html", html);
        pasteEvent.clipboardData?.setData("text/plain", text);

        return element.dispatchEvent(pasteEvent);
      }

      return false;
    } catch (error) {
      this.log("Google Docs native paste failed", error);
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

      // Wait for clipboard to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Focus and trigger paste
      this.focusTarget(element);
      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
      });

      return element.dispatchEvent(pasteEvent);
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
   * Try Google Docs API paste (if available)
   */
  private async tryGoogleDocsApiPaste(
    html: string,
    text: string,
    element: HTMLElement,
  ): Promise<boolean> {
    try {
      // Look for Google Docs internal API
      const docsWindow = window as any;

      // Check for Google Docs editor API
      if (docsWindow.docs && docsWindow.docs.editor) {
        const editor = docsWindow.docs.editor;

        // Try to insert content using Google Docs API
        if (typeof editor.insertContent === "function") {
          editor.insertContent(html);
          return true;
        }

        if (typeof editor.pasteContent === "function") {
          editor.pasteContent(html);
          return true;
        }
      }

      // Check for Kix (Google Docs editor) API
      if (docsWindow.kix && docsWindow.kix.editor) {
        const kixEditor = docsWindow.kix.editor;

        if (typeof kixEditor.insertHtml === "function") {
          kixEditor.insertHtml(html);
          return true;
        }
      }

      return false;
    } catch (error) {
      this.log("Google Docs API paste failed", error);
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

      // Trigger input events for Google Docs
      this.triggerGoogleDocsEvents(element);

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
   * Check if current page is Google Docs
   */
  private isGoogleDocsPage(): boolean {
    return (
      window.location.hostname === "docs.google.com" &&
      window.location.pathname.includes("/document/")
    );
  }

  /**
   * Check if element is part of Google Docs editor
   */
  private isGoogleDocsEditor(element: HTMLElement): boolean {
    return (
      element.closest('[role="document"]') !== null ||
      element.closest(".kix-appview-editor") !== null ||
      element.closest(".docs-texteventtarget-iframe") !== null ||
      element.classList.contains("kix-cursor-caret") ||
      element.classList.contains("kix-selection-overlay")
    );
  }

  /**
   * Optimize HTML for Google Docs compatibility
   */
  private optimizeForGoogleDocs(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;

    // Convert block elements to Google Docs-friendly formats
    this.convertBlockElementsForDocs(div);

    // Optimize lists for Google Docs
    this.optimizeListsForDocs(div);

    // Convert inline styles to Google Docs-compatible ones
    this.convertInlineStylesForDocs(div);

    // Remove unsupported elements
    this.removeUnsupportedElementsForDocs(div);

    return div.innerHTML;
  }

  /**
   * Convert block elements for Google Docs
   */
  private convertBlockElementsForDocs(container: HTMLElement): void {
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

    // Ensure paragraphs have proper Google Docs styling
    const paragraphs = container.querySelectorAll("p");
    paragraphs.forEach((p) => {
      if (!p.style.margin) {
        p.style.margin = "0";
      }
    });
  }

  /**
   * Optimize lists for Google Docs
   */
  private optimizeListsForDocs(container: HTMLElement): void {
    const lists = container.querySelectorAll("ul, ol");
    lists.forEach((list) => {
      // Google Docs handles list styling internally
      (list as HTMLElement).style.margin = "0";
      (list as HTMLElement).style.padding = "0";

      // Optimize list items
      const items = list.querySelectorAll("li");
      items.forEach((item) => {
        (item as HTMLElement).style.margin = "0";
        (item as HTMLElement).style.padding = "0";
      });
    });
  }

  /**
   * Convert inline styles for Google Docs
   */
  private convertInlineStylesForDocs(container: HTMLElement): void {
    const styledElements = container.querySelectorAll("[style]");
    styledElements.forEach((element) => {
      const style = element.getAttribute("style") || "";

      // Convert to Google Docs-compatible styles
      const docsStyle = style
        .replace(/font-family:\s*([^;]+)/g, "font-family: $1")
        .replace(/font-size:\s*(\d+)px/g, "font-size: $1pt") // Google Docs prefers pt
        .replace(/color:\s*([^;]+)/g, "color: $1")
        .replace(/background-color:\s*([^;]+)/g, "background-color: $1")
        .replace(/text-align:\s*([^;]+)/g, "text-align: $1")
        .replace(/font-weight:\s*bold/g, "font-weight: bold")
        .replace(/font-style:\s*italic/g, "font-style: italic")
        .replace(/text-decoration:\s*underline/g, "text-decoration: underline");

      element.setAttribute("style", docsStyle);
    });
  }

  /**
   * Remove elements not supported by Google Docs
   */
  private removeUnsupportedElementsForDocs(container: HTMLElement): void {
    const unsupportedElements = container.querySelectorAll(
      "script, style, meta, link, object, embed, iframe, form, input, button, select, textarea, canvas, svg",
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
        "javascript:",
      ];
      dangerousAttrs.forEach((attr) => {
        element.removeAttribute(attr);
      });
    });
  }

  /**
   * Apply Google Docs-specific styling
   */
  private applyGoogleDocsStyling(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;

    // Add Google Docs-friendly font styling
    const bodyStyle =
      'font-family: "Google Sans", Arial, sans-serif; font-size: 11pt; line-height: 1.15;';

    // Wrap content in a styled div
    const wrapper = document.createElement("div");
    wrapper.style.cssText = bodyStyle;
    wrapper.innerHTML = div.innerHTML;

    return wrapper.innerHTML;
  }

  /**
   * Convert plain text to Google Docs-compatible HTML
   */
  private textToGoogleDocsHtml(text: string): string {
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
   * Trigger Google Docs-specific events
   */
  private triggerGoogleDocsEvents(element: HTMLElement): void {
    // Standard input events
    const inputEvent = new Event("input", { bubbles: true });
    element.dispatchEvent(inputEvent);

    const changeEvent = new Event("change", { bubbles: true });
    element.dispatchEvent(changeEvent);

    // Google Docs-specific events
    const docsInputEvent = new Event("DOMSubtreeModified", { bubbles: true });
    element.dispatchEvent(docsInputEvent);

    // Custom Google Docs events (if available)
    try {
      const customEvent = new CustomEvent("docs-paste", {
        bubbles: true,
        detail: { source: "extension" },
      });
      element.dispatchEvent(customEvent);
    } catch (error) {
      // Ignore if custom events are not supported
    }
  }

  /**
   * Get confidence score for Google Docs strategy
   */
  override getConfidence(target: TargetSurface): number {
    if (!this.canHandle(target)) {
      return 0;
    }

    // Very high confidence for Google Docs editor
    if (target.type === "google-docs-editor") {
      return 0.96;
    }

    // High confidence for Google Docs detection
    if (this.isGoogleDocsPage()) {
      return 0.92;
    }

    // Lower confidence for generic Google Docs element detection
    if (this.isGoogleDocsEditor(target.element)) {
      return 0.85;
    }

    return 0;
  }
}
