/**
 * TinyMCE Instance Paste Strategy
 * Handles pasting into TinyMCE editors with schema-valid markup
 */

import {
  BasePasteStrategy,
  PasteContent,
  PasteResult,
  PasteOptions,
  PasteUtils,
} from "./base-strategy.js";
import type { TargetSurface } from "../target-detector.js";

export class TinyMCEPasteStrategy extends BasePasteStrategy {
  readonly name = "tinymce-paste";
  readonly priority = 90;
  readonly supportedTargets = ["tinymce-editor"];

  /**
   * Check if this strategy can handle the target
   */
  canHandle(target: TargetSurface): boolean {
    return (
      target.type === "tinymce-editor" || this.isTinyMCEElement(target.element)
    );
  }

  /**
   * Transform content for TinyMCE editor
   */
  async transformContent(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteContent> {
    const transformations: string[] = [];
    let html = content.html || "";
    let text = content.text || "";

    // If we only have text, convert to HTML
    if (!html && text) {
      html = this.textToTinyMCEHtml(text);
      transformations.push("text-to-html");
    }

    // Get TinyMCE instance and validate content
    const editor = this.getTinyMCEEditor(target.element);
    if (editor) {
      html = this.validateAndCleanForTinyMCE(html, editor);
      transformations.push("tinymce-validation");
    } else {
      // Fallback cleaning without editor instance
      html = this.cleanHtmlForTinyMCE(html);
      transformations.push("fallback-cleaning");
    }

    // Generate clean text version
    if (!text && html) {
      text = this.htmlToText(html);
      transformations.push("html-to-text");
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
   * Execute paste operation for TinyMCE
   */
  async executePaste(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteResult> {
    const element = target.element;
    const html = content.html || "";
    const text = content.text || "";

    this.log("Executing TinyMCE paste", {
      html: html.substring(0, 100),
      target: target.type,
    });

    try {
      // Get TinyMCE editor instance
      const editor = this.getTinyMCEEditor(element);

      if (editor) {
        return await this.pasteThroughTinyMCE(html, text, editor, target);
      } else {
        // Fallback to iframe/contenteditable paste
        return await this.pasteToIframe(html, text, element, target);
      }
    } catch (error) {
      this.log("TinyMCE paste failed", error);
      return this.createResult(
        false,
        "direct",
        content.metadata?.transformations || [],
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Paste through TinyMCE editor instance
   */
  private async pasteThroughTinyMCE(
    html: string,
    text: string,
    editor: any,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["tinymce-api"];

    try {
      // Focus the editor
      editor.focus();

      // Method 1: Use mceInsertContent command
      if (await this.tryMceInsertContent(html, editor)) {
        return this.createResult(true, "custom", transformations);
      }

      // Method 2: Use setContent at selection
      if (await this.trySetContentAtSelection(html, editor)) {
        return this.createResult(true, "custom", transformations);
      }

      // Method 3: Use TinyMCE paste plugin
      if (await this.tryTinyMCEPastePlugin(html, text, editor)) {
        return this.createResult(true, "custom", transformations);
      }

      return this.createResult(
        false,
        "custom",
        transformations,
        "All TinyMCE methods failed",
      );
    } catch (error) {
      return this.createResult(
        false,
        "custom",
        transformations,
        error instanceof Error ? error.message : "TinyMCE API failed",
      );
    }
  }

  /**
   * Try mceInsertContent command
   */
  private async tryMceInsertContent(
    html: string,
    editor: any,
  ): Promise<boolean> {
    try {
      if (typeof editor.execCommand === "function") {
        editor.execCommand("mceInsertContent", false, html);
        return true;
      }
      return false;
    } catch (error) {
      this.log("mceInsertContent failed", error);
      return false;
    }
  }

  /**
   * Try setContent at selection
   */
  private async trySetContentAtSelection(
    html: string,
    editor: any,
  ): Promise<boolean> {
    try {
      if (typeof editor.selection?.setContent === "function") {
        editor.selection.setContent(html);
        return true;
      }
      return false;
    } catch (error) {
      this.log("setContent at selection failed", error);
      return false;
    }
  }

  /**
   * Try TinyMCE paste plugin
   */
  private async tryTinyMCEPastePlugin(
    html: string,
    text: string,
    editor: any,
  ): Promise<boolean> {
    try {
      if (editor.plugins?.paste) {
        // Simulate paste event
        const pasteEvent = {
          clipboardData: {
            getData: (format: string) => {
              if (format === "text/html") return html;
              if (format === "text/plain") return text;
              return "";
            },
          },
        };

        if (typeof editor.plugins.paste.paste === "function") {
          editor.plugins.paste.paste(pasteEvent);
          return true;
        }
      }
      return false;
    } catch (error) {
      this.log("TinyMCE paste plugin failed", error);
      return false;
    }
  }

  /**
   * Paste to iframe (when editor instance not available)
   */
  private async pasteToIframe(
    html: string,
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["iframe-paste"];

    try {
      // Find the iframe
      const iframe =
        element.closest("iframe") || element.querySelector("iframe");
      if (iframe) {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const body = iframeDoc.body;
          if (body) {
            return await this.pasteToContentEditable(html, text, body, target);
          }
        }
      }

      // Fallback to direct element paste
      return await this.pasteToContentEditable(html, text, element, target);
    } catch (error) {
      return this.createResult(
        false,
        "direct",
        transformations,
        error instanceof Error ? error.message : "Iframe paste failed",
      );
    }
  }

  /**
   * Paste to contenteditable element
   */
  private async pasteToContentEditable(
    html: string,
    text: string,
    element: HTMLElement,
    target: TargetSurface,
  ): Promise<PasteResult> {
    const transformations = ["contenteditable"];

    try {
      // Focus the element
      this.focusTarget(element);

      // Insert HTML at cursor position
      const selection = element.ownerDocument.getSelection();
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

      // Trigger events
      this.triggerTinyMCEEvents(element);

      return this.createResult(true, "direct", transformations);
    } catch (error) {
      return this.createResult(
        false,
        "direct",
        transformations,
        error instanceof Error ? error.message : "ContentEditable paste failed",
      );
    }
  }

  /**
   * Check if element is a TinyMCE element
   */
  private isTinyMCEElement(element: HTMLElement): boolean {
    return (
      element.classList.contains("mce-content-body") ||
      element.closest(".mce-tinymce") !== null ||
      element.id?.includes("mce_") ||
      (window as any).tinymce !== undefined
    );
  }

  /**
   * Get TinyMCE editor instance from element
   */
  private getTinyMCEEditor(element: HTMLElement): any {
    const tinymce = (window as any).tinymce;
    if (!tinymce) {
      return null;
    }

    try {
      // Method 1: Find by element ID
      if (element.id) {
        const editor = tinymce.get(element.id);
        if (editor) return editor;
      }

      // Method 2: Find by iframe
      const iframe =
        element.closest("iframe") || element.querySelector("iframe");
      if (iframe?.id) {
        const editor = tinymce.get(iframe.id);
        if (editor) return editor;
      }

      // Method 3: Find by container
      const container = element.closest(".mce-tinymce");
      if (container) {
        const editorId = container.id?.replace("_parent", "");
        if (editorId) {
          const editor = tinymce.get(editorId);
          if (editor) return editor;
        }
      }

      // Method 4: Find by content body
      if (element.classList.contains("mce-content-body")) {
        const editors = tinymce.editors;
        for (const editor of editors) {
          if (editor.getBody() === element) {
            return editor;
          }
        }
      }

      return null;
    } catch (error) {
      this.log("Failed to get TinyMCE editor", error);
      return null;
    }
  }

  /**
   * Validate and clean HTML for TinyMCE
   */
  private validateAndCleanForTinyMCE(html: string, editor: any): string {
    try {
      // Use TinyMCE's own parser if available
      if (editor.parser) {
        const parsed = editor.parser.parse(html);
        return editor.serializer.serialize(parsed);
      }

      // Fallback to manual cleaning
      return this.cleanHtmlForTinyMCE(html);
    } catch (error) {
      this.log("TinyMCE validation failed, using fallback", error);
      return this.cleanHtmlForTinyMCE(html);
    }
  }

  /**
   * Clean HTML for TinyMCE compatibility
   */
  private cleanHtmlForTinyMCE(html: string): string {
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
        "javascript:",
      ];
      dangerousAttrs.forEach((attr) => {
        el.removeAttribute(attr);
      });
    });

    // Clean up nested paragraphs
    div.querySelectorAll("p p").forEach((p) => {
      p.outerHTML = p.innerHTML;
    });

    // Convert div to p where appropriate
    div.querySelectorAll("div").forEach((div) => {
      if (!div.querySelector("div, p, ul, ol, table, h1, h2, h3, h4, h5, h6")) {
        const p = document.createElement("p");
        p.innerHTML = div.innerHTML;
        div.replaceWith(p);
      }
    });

    // Ensure proper list structure
    div.querySelectorAll("ul, ol").forEach((list) => {
      const items = list.querySelectorAll("li");
      items.forEach((item) => {
        // Remove nested lists from li content
        const nestedLists = item.querySelectorAll("ul, ol");
        nestedLists.forEach((nestedList) => {
          item.appendChild(nestedList);
        });
      });
    });

    return div.innerHTML;
  }

  /**
   * Convert plain text to TinyMCE-compatible HTML
   */
  private textToTinyMCEHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^(.+)$/, "<p>$1</p>")
      .replace(/^<p><\/p>$/, "<p><br></p>"); // Handle empty paragraphs
  }

  /**
   * Trigger TinyMCE-specific events
   */
  private triggerTinyMCEEvents(element: HTMLElement): void {
    // Standard input events
    const inputEvent = new Event("input", { bubbles: true });
    element.dispatchEvent(inputEvent);

    const changeEvent = new Event("change", { bubbles: true });
    element.dispatchEvent(changeEvent);

    // TinyMCE-specific events
    const tinyMCEChangeEvent = new Event("ExecCommand", { bubbles: true });
    element.dispatchEvent(tinyMCEChangeEvent);

    // Node change event
    const nodeChangeEvent = new Event("NodeChange", { bubbles: true });
    element.dispatchEvent(nodeChangeEvent);

    // DOM mutation events
    const mutationEvent = new Event("DOMNodeInserted", { bubbles: true });
    element.dispatchEvent(mutationEvent);
  }

  /**
   * Get confidence score for TinyMCE strategy
   */
  override getConfidence(target: TargetSurface): number {
    if (!this.canHandle(target)) {
      return 0;
    }

    // High confidence for detected TinyMCE editors
    if (target.type === "tinymce-editor") {
      return 0.95;
    }

    // Check if TinyMCE is available globally
    if ((window as any).tinymce) {
      return 0.9;
    }

    // Lower confidence for potential TinyMCE elements
    if (this.isTinyMCEElement(target.element)) {
      return 0.8;
    }

    return 0;
  }
}
