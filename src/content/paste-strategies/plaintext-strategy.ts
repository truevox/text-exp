/**
 * Plain Text Field Paste Strategy
 * Handles pasting into plain text inputs and textareas
 * Strips HTML markup and optionally converts to AsciiDoc
 */

import {
  BasePasteStrategy,
  PasteContent,
  PasteResult,
  PasteOptions,
  PasteUtils,
} from "./base-strategy.js";
import type { TargetSurface } from "../target-detector.js";

export class PlaintextPasteStrategy extends BasePasteStrategy {
  readonly name = "plaintext-paste";
  readonly priority = 70;
  readonly supportedTargets = ["plaintext-input", "plaintext-textarea"];

  /**
   * Check if this strategy can handle the target
   */
  canHandle(target: TargetSurface): boolean {
    return (
      this.supportedTargets.includes(target.type) ||
      (target.element.tagName === "INPUT" &&
        (target.element as HTMLInputElement).type === "text") ||
      target.element.tagName === "TEXTAREA"
    );
  }

  /**
   * Transform content for plain text targets
   */
  async transformContent(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteContent> {
    const transformations: string[] = [];
    let finalText = "";

    // Start with HTML content if available, otherwise use text
    if (content.html) {
      if (options.convertToMarkdown) {
        finalText = this.htmlToAsciiDoc(content.html);
        transformations.push("html-to-asciidoc");
      } else {
        finalText = this.stripHtmlToText(content.html);
        transformations.push("html-to-text");
      }
    } else if (content.text) {
      finalText = content.text;
      transformations.push("text-passthrough");
    } else {
      finalText = "";
      transformations.push("empty-content");
    }

    // Apply length limits
    if (options.maxLength || target.capabilities.maxLength) {
      const maxLength = options.maxLength || target.capabilities.maxLength!;
      if (finalText.length > maxLength) {
        finalText = finalText.substring(0, maxLength);
        transformations.push(`truncated-to-${maxLength}`);
      }
    }

    // Clean up whitespace
    finalText = this.cleanupWhitespace(finalText);
    transformations.push("whitespace-cleanup");

    return {
      text: finalText,
      metadata: {
        originalFormat: content.metadata?.originalFormat || "html",
        transformations,
        snippetId: content.metadata?.snippetId,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Execute paste operation for plain text targets
   */
  async executePaste(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteResult> {
    const element = target.element;
    const text = content.text || "";

    this.log("Executing plaintext paste", {
      text: text.substring(0, 100),
      target: target.type,
    });

    try {
      // Focus the target element
      this.focusTarget(element);

      // Try different paste methods in order of preference
      if (options.simulateTyping) {
        return await this.simulateTypingPaste(text, element, target);
      }

      if (target.capabilities.customPasteHandler) {
        const result = await this.tryCustomPasteHandler(text, element, target);
        if (result.success) {
          return result;
        }
      }

      return await this.directValuePaste(text, element, target);
    } catch (error) {
      this.log("Paste failed", error);
      return this.createResult(
        false,
        "direct",
        content.metadata?.transformations || [],
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Direct value assignment paste
   */
  private async directValuePaste(
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["direct-value"];

    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      const input = element as HTMLInputElement;
      const startPos = input.selectionStart || 0;
      const endPos = input.selectionEnd || 0;
      const currentValue = input.value;

      // Insert text at cursor position
      const newValue =
        currentValue.slice(0, startPos) + text + currentValue.slice(endPos);
      input.value = newValue;

      // Set cursor position after inserted text
      const newCursorPos = startPos + text.length;
      input.setSelectionRange(newCursorPos, newCursorPos);

      // Trigger events
      this.triggerInputEvents(input);

      return this.createResult(true, "direct", transformations);
    }

    return this.createResult(
      false,
      "direct",
      transformations,
      "Unsupported element type",
    );
  }

  /**
   * Simulate typing paste
   */
  private async simulateTypingPaste(
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["simulated-typing"];

    try {
      await this.simulateTyping(text, element, 10);
      return this.createResult(true, "simulation", transformations);
    } catch (error) {
      return this.createResult(
        false,
        "simulation",
        transformations,
        error instanceof Error ? error.message : "Simulation failed",
      );
    }
  }

  /**
   * Try custom paste handler
   */
  private async tryCustomPasteHandler(
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["custom-handler"];

    try {
      // Try clipboard API first
      if (PasteUtils.isClipboardApiAvailable()) {
        await PasteUtils.writeToClipboard(text);

        // Focus and trigger paste event
        this.focusTarget(element);
        PasteUtils.triggerPasteEvent(element, text);

        return this.createResult(true, "clipboard", transformations);
      }

      // Fallback to execCommand
      const tempTextarea = PasteUtils.createTempTextarea(text);
      tempTextarea.select();

      const success = document.execCommand("copy");
      PasteUtils.removeTempElement(tempTextarea);

      if (success) {
        this.focusTarget(element);
        PasteUtils.triggerPasteEvent(element, text);
        return this.createResult(true, "clipboard", transformations);
      }

      return this.createResult(
        false,
        "clipboard",
        transformations,
        "Copy command failed",
      );
    } catch (error) {
      return this.createResult(
        false,
        "custom",
        transformations,
        error instanceof Error ? error.message : "Custom handler failed",
      );
    }
  }

  /**
   * Strip HTML and convert to plain text
   */
  private stripHtmlToText(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;

    // Replace common HTML elements with text equivalents
    const lineBreaks = div.querySelectorAll(
      "br, p, div, h1, h2, h3, h4, h5, h6",
    );
    lineBreaks.forEach((el) => {
      if (el.tagName === "BR") {
        el.replaceWith("\n");
      } else {
        el.insertAdjacentText("afterend", "\n");
      }
    });

    // Replace list items with bullets
    const listItems = div.querySelectorAll("li");
    listItems.forEach((li) => {
      li.insertAdjacentText("beforebegin", "• ");
      li.insertAdjacentText("afterend", "\n");
    });

    // Handle links - show URL
    const links = div.querySelectorAll("a[href]");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && href !== link.textContent) {
        link.textContent = `${link.textContent} (${href})`;
      }
    });

    // Handle bold and italic with text markers
    const bold = div.querySelectorAll("b, strong");
    bold.forEach((el) => {
      el.insertAdjacentText("beforebegin", "**");
      el.insertAdjacentText("afterend", "**");
    });

    const italic = div.querySelectorAll("i, em");
    italic.forEach((el) => {
      el.insertAdjacentText("beforebegin", "*");
      el.insertAdjacentText("afterend", "*");
    });

    return div.textContent || div.innerText || "";
  }

  /**
   * Convert HTML to AsciiDoc format
   */
  private htmlToAsciiDoc(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;

    // Convert headers
    const headers = div.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headers.forEach((header) => {
      const level = parseInt(header.tagName.charAt(1));
      const prefix = "=".repeat(level);
      header.insertAdjacentText("beforebegin", `${prefix} `);
      header.insertAdjacentText("afterend", "\n\n");
    });

    // Convert paragraphs
    const paragraphs = div.querySelectorAll("p");
    paragraphs.forEach((p) => {
      p.insertAdjacentText("afterend", "\n\n");
    });

    // Convert lists
    const ulLists = div.querySelectorAll("ul");
    ulLists.forEach((ul) => {
      const items = ul.querySelectorAll("li");
      items.forEach((li) => {
        li.insertAdjacentText("beforebegin", "* ");
        li.insertAdjacentText("afterend", "\n");
      });
    });

    const olLists = div.querySelectorAll("ol");
    olLists.forEach((ol) => {
      const items = ol.querySelectorAll("li");
      items.forEach((li, index) => {
        li.insertAdjacentText("beforebegin", `${index + 1}. `);
        li.insertAdjacentText("afterend", "\n");
      });
    });

    // Convert emphasis
    const bold = div.querySelectorAll("b, strong");
    bold.forEach((el) => {
      el.insertAdjacentText("beforebegin", "*");
      el.insertAdjacentText("afterend", "*");
    });

    const italic = div.querySelectorAll("i, em");
    italic.forEach((el) => {
      el.insertAdjacentText("beforebegin", "_");
      el.insertAdjacentText("afterend", "_");
    });

    // Convert links
    const links = div.querySelectorAll("a[href]");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      const text = link.textContent;
      if (href && text) {
        link.outerHTML = `link:${href}[${text}]`;
      }
    });

    // Convert code blocks
    const codeBlocks = div.querySelectorAll("pre code, code");
    codeBlocks.forEach((code) => {
      if (code.parentElement?.tagName === "PRE") {
        code.insertAdjacentText("beforebegin", "----\n");
        code.insertAdjacentText("afterend", "\n----\n");
      } else {
        code.insertAdjacentText("beforebegin", "`");
        code.insertAdjacentText("afterend", "`");
      }
    });

    // Convert line breaks
    const lineBreaks = div.querySelectorAll("br");
    lineBreaks.forEach((br) => {
      br.replaceWith("\n");
    });

    return div.textContent || div.innerText || "";
  }

  /**
   * Clean up whitespace in text
   */
  private cleanupWhitespace(text: string): string {
    return text
      .replace(/\r\n/g, "\n") // Normalize line endings
      .replace(/\r/g, "\n") // Normalize line endings
      .replace(/\t/g, "    ") // Convert tabs to spaces
      .replace(/\n\s*\n\s*\n/g, "\n\n") // Reduce multiple empty lines
      .replace(/^\s+/gm, "") // Remove leading whitespace
      .replace(/\s+$/gm, "") // Remove trailing whitespace
      .trim(); // Remove leading/trailing whitespace
  }

  /**
   * Trigger appropriate input events
   */
  private triggerInputEvents(element: HTMLElement): void {
    // Trigger input event
    const inputEvent = new Event("input", { bubbles: true });
    element.dispatchEvent(inputEvent);

    // Trigger change event
    const changeEvent = new Event("change", { bubbles: true });
    element.dispatchEvent(changeEvent);

    // Trigger keyup event for frameworks that listen to it
    const keyupEvent = new KeyboardEvent("keyup", { bubbles: true });
    element.dispatchEvent(keyupEvent);
  }

  /**
   * Get confidence score for this strategy
   */
  override getConfidence(target: TargetSurface): number {
    if (!this.canHandle(target)) {
      return 0;
    }

    // High confidence for native inputs
    if (
      target.element.tagName === "INPUT" ||
      target.element.tagName === "TEXTAREA"
    ) {
      return 0.95;
    }

    // Lower confidence for other plaintext targets
    return 0.8;
  }
}
