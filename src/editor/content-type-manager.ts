/**
 * Content Type Manager
 * Handles different content types: HTML, plaintext, and LaTeX
 * Provides conversion, validation, and editor configuration
 */

import type { Editor as TinyMCEEditor } from "tinymce";
import type { SnippetMeta } from "../types/snippet-formats.js";

export type ContentType = "html" | "plaintext" | "latex";

export interface ContentTypeConfig {
  type: ContentType;
  label: string;
  description: string;
  fileExtension: string;
  mimeType: string;
  editorConfig: Partial<any>; // TinyMCE config
  validation: {
    maxLength?: number;
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
  };
}

export interface ContentConversionOptions {
  preserveFormatting?: boolean;
  stripStyles?: boolean;
  convertToMarkdown?: boolean;
  escapeSpecialChars?: boolean;
}

export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedContent?: string;
}

/**
 * Content type configurations
 */
const CONTENT_TYPE_CONFIGS: Record<ContentType, ContentTypeConfig> = {
  html: {
    type: "html",
    label: "Rich Text (HTML)",
    description: "Full HTML with formatting, links, and media",
    fileExtension: "html",
    mimeType: "text/html",
    editorConfig: {
      plugins: [
        "lists",
        "link",
        "image",
        "charmap",
        "preview",
        "searchreplace",
        "visualblocks",
        "code",
        "fullscreen",
        "insertdatetime",
        "media",
        "table",
        "help",
        "wordcount",
      ],
      toolbar:
        "undo redo | blocks | " +
        "bold italic forecolor backcolor | alignleft aligncenter " +
        "alignright alignjustify | bullist numlist outdent indent | " +
        "link image table | code preview | removeformat help",
      menubar: false,
      statusbar: true,
      content_style: `
        body { 
          font-family: -apple-system, BlinkMacSystemFont, San Francisco, Segoe UI, Roboto, Helvetica Neue, sans-serif; 
          font-size: 14px;
          line-height: 1.5;
          color: #333;
          padding: 8px;
        }
        .variable-placeholder {
          background-color: #fef3c7;
          border: 1px dashed #f59e0b;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #92400e;
          font-weight: 500;
          display: inline-block;
          white-space: nowrap;
        }
      `,
      paste_as_text: false,
      paste_preprocess: (pl: any, o: any) => {
        // Allow rich paste for HTML content
        return o.content;
      },
    },
    validation: {
      maxLength: 50000,
      allowedTags: [
        "p",
        "br",
        "strong",
        "em",
        "u",
        "s",
        "sub",
        "sup",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "ul",
        "ol",
        "li",
        "dl",
        "dt",
        "dd",
        "a",
        "img",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "blockquote",
        "code",
        "pre",
        "span",
        "div",
      ],
      allowedAttributes: {
        a: ["href", "title", "target"],
        img: ["src", "alt", "title", "width", "height"],
        table: ["border", "cellpadding", "cellspacing"],
        td: ["colspan", "rowspan"],
        th: ["colspan", "rowspan", "scope"],
        "*": ["class", "style", "id"],
      },
    },
  },

  plaintext: {
    type: "plaintext",
    label: "Plain Text",
    description: "Simple text without formatting",
    fileExtension: "txt",
    mimeType: "text/plain",
    editorConfig: {
      plugins: ["code", "searchreplace", "wordcount"],
      toolbar: "undo redo | searchreplace | code | wordcount",
      menubar: false,
      statusbar: true,
      content_style: `
        body { 
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.4;
          color: #333;
          padding: 12px;
          white-space: pre-wrap;
          background: #f8f9fa;
        }
        .variable-placeholder {
          background-color: #fff3cd;
          color: #856404;
          padding: 1px 3px;
          border-radius: 2px;
          font-weight: 600;
        }
      `,
      paste_as_text: true,
      paste_preprocess: (pl: any, o: any) => {
        // Strip all HTML for plaintext
        return o.content.replace(/<[^>]*>/g, "");
      },
      setup: (editor: TinyMCEEditor) => {
        // Disable rich text features for plaintext
        editor.on("BeforeSetContent", (e) => {
          if (e.content) {
            e.content = e.content.replace(/<[^>]*>/g, "");
          }
        });
      },
    },
    validation: {
      maxLength: 10000,
      allowedTags: [], // No HTML tags allowed
      allowedAttributes: {},
    },
  },

  latex: {
    type: "latex",
    label: "LaTeX",
    description: "LaTeX markup for mathematical and scientific content",
    fileExtension: "tex",
    mimeType: "text/x-latex",
    editorConfig: {
      plugins: ["code", "searchreplace", "wordcount"],
      toolbar:
        "undo redo | searchreplace | code | insertMath insertSymbol | wordcount",
      menubar: false,
      statusbar: true,
      content_style: `
        body { 
          font-family: 'Computer Modern', 'Latin Modern Math', 'Times New Roman', serif;
          font-size: 14px;
          line-height: 1.6;
          color: #333;
          padding: 12px;
          background: #fefefe;
        }
        .latex-command {
          background-color: #e8f4fd;
          color: #0969da;
          font-family: monospace;
          padding: 1px 3px;
          border-radius: 2px;
          font-weight: 600;
        }
        .variable-placeholder {
          background-color: #fff8dc;
          color: #b8860b;
          font-family: monospace;
          padding: 1px 3px;
          border-radius: 2px;
          font-weight: 600;
        }
      `,
      paste_as_text: true,
      paste_preprocess: (pl: any, o: any) => {
        // Preserve LaTeX commands but strip other HTML
        return o.content.replace(/<(?!\/?(em|strong|code))[^>]*>/g, "");
      },
      setup: (editor: TinyMCEEditor) => {
        // Add LaTeX-specific toolbar buttons
        editor.ui.registry.addButton("insertMath", {
          text: "∑",
          tooltip: "Insert Math Expression",
          onAction: () => {
            editor.insertContent("$${}$$");
            // Move cursor between $$
            const selection = editor.selection;
            const range = selection.getRng();
            range.setStart(range.startContainer, range.startOffset - 2);
            range.setEnd(range.startContainer, range.startOffset);
            selection.setRng(range);
          },
        });

        editor.ui.registry.addButton("insertSymbol", {
          text: "α",
          tooltip: "Insert Greek Letter",
          onAction: () => {
            const symbol = prompt(
              "Enter Greek letter name (alpha, beta, gamma, etc.):",
            );
            if (symbol) {
              editor.insertContent(`\\${symbol} `);
            }
          },
        });

        // Highlight LaTeX commands
        editor.on("SetContent", () => {
          setTimeout(() => {
            const content = editor.getContent();
            const highlightedContent = content.replace(
              /\\([a-zA-Z]+)(\{[^}]*\})?/g,
              '<span class="latex-command">\\$1$2</span>',
            );
            if (highlightedContent !== content) {
              editor.setContent(highlightedContent);
            }
          }, 100);
        });
      },
    },
    validation: {
      maxLength: 20000,
      allowedTags: ["em", "strong", "code", "span"],
      allowedAttributes: {
        span: ["class"],
      },
    },
  },
};

/**
 * Content Type Manager
 * Handles content type switching, validation, and conversion
 */
export class ContentTypeManager {
  private currentType: ContentType = "html";
  private editor: TinyMCEEditor | null = null;

  /**
   * Get all available content type configurations
   */
  static getContentTypes(): ContentTypeConfig[] {
    return Object.values(CONTENT_TYPE_CONFIGS);
  }

  /**
   * Get configuration for a specific content type
   */
  static getConfig(type: ContentType): ContentTypeConfig {
    return CONTENT_TYPE_CONFIGS[type];
  }

  /**
   * Detect content type from content analysis
   */
  static detectContentType(content: string): ContentType {
    // Check for LaTeX patterns
    if (/\\[a-zA-Z]+\{[^}]*\}|\\[a-zA-Z]+|\$\$.*\$\$|\$.*\$/.test(content)) {
      return "latex";
    }

    // Check for HTML tags
    if (/<[a-zA-Z][^>]*>/.test(content)) {
      return "html";
    }

    // Default to plaintext
    return "plaintext";
  }

  /**
   * Initialize with editor instance
   */
  setEditor(editor: TinyMCEEditor): void {
    this.editor = editor;
  }

  /**
   * Get current content type
   */
  getCurrentType(): ContentType {
    return this.currentType;
  }

  /**
   * Switch to a different content type
   */
  async switchContentType(
    newType: ContentType,
    options: ContentConversionOptions = {},
  ): Promise<void> {
    if (!this.editor) {
      throw new Error("Editor not set");
    }

    if (newType === this.currentType) {
      return;
    }

    const currentContent = this.editor.getContent();
    const convertedContent = this.convertContent(
      currentContent,
      this.currentType,
      newType,
      options,
    );

    // Update editor configuration
    const newConfig = CONTENT_TYPE_CONFIGS[newType].editorConfig;

    // Note: In a real implementation, you might need to reinitialize
    // the editor with new configuration
    console.log("🔄 Switching content type:", this.currentType, "→", newType);

    this.editor.setContent(convertedContent);
    this.currentType = newType;
  }

  /**
   * Convert content between different types
   */
  convertContent(
    content: string,
    fromType: ContentType,
    toType: ContentType,
    options: ContentConversionOptions = {},
  ): string {
    if (fromType === toType) {
      return content;
    }

    let convertedContent = content;

    // Convert FROM current type
    switch (fromType) {
      case "html":
        convertedContent = this.convertFromHTML(content, toType, options);
        break;
      case "plaintext":
        convertedContent = this.convertFromPlainText(content, toType, options);
        break;
      case "latex":
        convertedContent = this.convertFromLaTeX(content, toType, options);
        break;
    }

    return convertedContent;
  }

  /**
   * Convert from HTML to other formats
   */
  private convertFromHTML(
    content: string,
    toType: ContentType,
    options: ContentConversionOptions,
  ): string {
    switch (toType) {
      case "plaintext": {
        // Strip HTML tags, preserve line breaks
        let text = content
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .trim();

        // Clean up extra whitespace
        text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
        return text;
      }

      case "latex":
        // Convert basic HTML formatting to LaTeX
        return content
          .replace(/<strong>(.*?)<\/strong>/gi, "\\textbf{$1}")
          .replace(/<em>(.*?)<\/em>/gi, "\\textit{$1}")
          .replace(/<u>(.*?)<\/u>/gi, "\\underline{$1}")
          .replace(/<h1>(.*?)<\/h1>/gi, "\\section{$1}")
          .replace(/<h2>(.*?)<\/h2>/gi, "\\subsection{$1}")
          .replace(/<h3>(.*?)<\/h3>/gi, "\\subsubsection{$1}")
          .replace(/<p>(.*?)<\/p>/gi, "$1\n\n")
          .replace(/<br\s*\/?>/gi, "\\\\\n")
          .replace(/<[^>]*>/g, "") // Remove remaining HTML tags
          .trim();

      default:
        return content;
    }
  }

  /**
   * Convert from plain text to other formats
   */
  private convertFromPlainText(
    content: string,
    toType: ContentType,
    options: ContentConversionOptions,
  ): string {
    switch (toType) {
      case "html":
        // Convert line breaks to HTML
        return content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n\n/g, "</p><p>")
          .replace(/\n/g, "<br>")
          .replace(/^/, "<p>")
          .replace(/$/, "</p>");

      case "latex":
        // Escape LaTeX special characters
        return content
          .replace(/\\/g, "\\textbackslash{}")
          .replace(/\{/g, "\\{")
          .replace(/\}/g, "\\}")
          .replace(/\$/g, "\\$")
          .replace(/&/g, "\\&")
          .replace(/%/g, "\\%")
          .replace(/#/g, "\\#")
          .replace(/\^/g, "\\textasciicircum{}")
          .replace(/_/g, "\\_")
          .replace(/~/g, "\\textasciitilde{}")
          .replace(/\n\n/g, "\n\n\\par\n");

      default:
        return content;
    }
  }

  /**
   * Convert from LaTeX to other formats
   */
  private convertFromLaTeX(
    content: string,
    toType: ContentType,
    options: ContentConversionOptions,
  ): string {
    switch (toType) {
      case "html":
        // Convert basic LaTeX to HTML
        return content
          .replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>")
          .replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>")
          .replace(/\\underline\{([^}]*)\}/g, "<u>$1</u>")
          .replace(/\\section\{([^}]*)\}/g, "<h1>$1</h1>")
          .replace(/\\subsection\{([^}]*)\}/g, "<h2>$1</h2>")
          .replace(/\\subsubsection\{([^}]*)\}/g, "<h3>$1</h3>")
          .replace(/\\\\\s*/g, "<br>")
          .replace(/\\par\s*/g, "</p><p>")
          .replace(/\$\$(.*?)\$\$/g, "<em>$1</em>") // Math to italic for now
          .replace(/\$([^$]*)\$/g, "<em>$1</em>")
          .replace(/^/, "<p>")
          .replace(/$/, "</p>");

      case "plaintext":
        // Strip LaTeX commands, preserve content
        return content
          .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
          .replace(/\\[a-zA-Z]+\s*/g, "")
          .replace(/\$\$([^$]*)\$\$/g, "$1")
          .replace(/\$([^$]*)\$/g, "$1")
          .replace(/\\\\\s*/g, "\n")
          .replace(/\\par\s*/g, "\n\n")
          .replace(/\{([^}]*)\}/g, "$1")
          .trim();

      default:
        return content;
    }
  }

  /**
   * Validate content for a specific content type
   */
  validateContent(content: string, type: ContentType): ContentValidationResult {
    const config = CONTENT_TYPE_CONFIGS[type];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check length
    if (
      config.validation.maxLength &&
      content.length > config.validation.maxLength
    ) {
      errors.push(
        `Content exceeds maximum length of ${config.validation.maxLength} characters`,
      );
    }

    // Content-specific validation
    switch (type) {
      case "html":
        return this.validateHTML(content, config);
      case "plaintext":
        return this.validatePlainText(content, config);
      case "latex":
        return this.validateLaTeX(content, config);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate HTML content
   */
  private validateHTML(
    content: string,
    config: ContentTypeConfig,
  ): ContentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for malformed tags
    const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    const openTags: string[] = [];
    let match;

    while ((match = tagPattern.exec(content)) !== null) {
      const tagName = match[1].toLowerCase();
      const isClosing = match[0].startsWith("</");

      if (isClosing) {
        const lastOpen = openTags.pop();
        if (lastOpen !== tagName) {
          errors.push(
            `Mismatched closing tag: expected ${lastOpen}, found ${tagName}`,
          );
        }
      } else if (!match[0].endsWith("/>")) {
        // Self-closing tags like <br/> don't need matching close tags
        const selfClosing = ["br", "hr", "img", "input", "meta", "link"];
        if (!selfClosing.includes(tagName)) {
          openTags.push(tagName);
        }
      }
    }

    if (openTags.length > 0) {
      warnings.push(`Unclosed tags: ${openTags.join(", ")}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate plain text content
   */
  private validatePlainText(
    content: string,
    config: ContentTypeConfig,
  ): ContentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for HTML tags (not allowed in plaintext)
    if (/<[^>]*>/.test(content)) {
      errors.push("HTML tags are not allowed in plain text content");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate LaTeX content
   */
  private validateLaTeX(
    content: string,
    config: ContentTypeConfig,
  ): ContentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for unmatched braces
    let braceCount = 0;
    for (const char of content) {
      if (char === "{") braceCount++;
      if (char === "}") braceCount--;
      if (braceCount < 0) {
        errors.push("Unmatched closing brace found");
        break;
      }
    }

    if (braceCount > 0) {
      warnings.push("Unclosed braces detected");
    }

    // Check for unmatched math delimiters
    const dollarSigns = (content.match(/\$/g) || []).length;
    if (dollarSigns % 2 !== 0) {
      warnings.push("Unmatched math delimiters ($)");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get preview HTML for any content type
   */
  async getPreviewHTML(content: string, type: ContentType): Promise<string> {
    switch (type) {
      case "html":
        return content;
      case "plaintext":
        return this.convertFromPlainText(content, "html", {});
      case "latex": {
        try {
          // Try to use LaTeX preview renderer for proper math rendering
          const { LaTeXPreviewRenderer } = await import(
            "./latex-preview-renderer.js"
          );
          const renderer = new LaTeXPreviewRenderer();
          const result = await renderer.renderLaTeX(content);

          if (result.success) {
            return result.html;
          } else {
            // Fallback to simple conversion
            const htmlContent = this.convertFromLaTeX(content, "html", {});
            return `<div class="latex-preview-note">LaTeX Preview (simplified - ${result.errors?.join(", ")})</div>${htmlContent}`;
          }
        } catch (error) {
          // Fallback if LaTeX renderer fails to load
          const htmlContent = this.convertFromLaTeX(content, "html", {});
          return `<div class="latex-preview-note">LaTeX Preview (simplified)</div>${htmlContent}`;
        }
      }
    }
  }
}

/**
 * Utility function to create a content type manager instance
 */
export function createContentTypeManager(): ContentTypeManager {
  return new ContentTypeManager();
}
