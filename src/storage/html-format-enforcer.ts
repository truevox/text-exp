/**
 * HTML Format Enforcer
 * Ensures all snippets are stored as HTML in JSON files
 * Converts plaintext to HTML on save, maintains HTML format
 */

import type { TextSnippet } from "../shared/types.js";
import type { EnhancedSnippet } from "../types/snippet-formats.js";

export type SupportedContentType =
  | "html"
  | "plaintext"
  | "markdown"
  | "latex"
  | "html+KaTeX"
  | "text";

export interface FormatConversionResult {
  success: boolean;
  originalContent: string;
  convertedContent: string;
  originalFormat: SupportedContentType;
  targetFormat: "html";
  conversionMethod: string;
  warnings?: string[];
  errors?: string[];
}

export interface BatchConversionResult {
  totalSnippets: number;
  successfulConversions: number;
  failedConversions: number;
  skippedConversions: number;
  conversionResults: FormatConversionResult[];
  processingTimeMs: number;
}

export interface EnforcementOptions {
  /** Whether to preserve original format as metadata */
  preserveOriginalFormat?: boolean;

  /** Whether to validate HTML after conversion */
  validateHtml?: boolean;

  /** Whether to pretty-print HTML output */
  prettyPrint?: boolean;

  /** Whether to sanitize HTML content */
  sanitizeHtml?: boolean;

  /** Custom conversion handlers */
  customConverters?: Map<SupportedContentType, (content: string) => string>;

  /** Whether to generate warnings for lossy conversions */
  generateWarnings?: boolean;

  /** Maximum content length to process */
  maxContentLength?: number;
}

export interface ValidationResult {
  isValid: boolean;
  isHtml: boolean;
  hasValidStructure: boolean;
  warnings: string[];
  errors: string[];
  suggestedFormat?: SupportedContentType;
}

export interface ConversionStats {
  totalProcessed: number;
  htmlAlready: number;
  plaintextConverted: number;
  markdownConverted: number;
  latexConverted: number;
  unknownFormatConverted: number;
  processingTimeMs: number;
}

/**
 * Enforces HTML format for all snippet content in JSON storage
 */
export class HTMLFormatEnforcer {
  private conversionStats: ConversionStats | null = null;
  private lastBatchResult: BatchConversionResult | null = null;

  /**
   * Convert snippet content to HTML format
   */
  convertToHtml(
    content: string,
    currentFormat: SupportedContentType,
    options: EnforcementOptions = {},
  ): FormatConversionResult {
    const {
      validateHtml = true,
      prettyPrint = false,
      sanitizeHtml = false,
      customConverters,
      generateWarnings = true,
      maxContentLength = 1000000, // 1MB
    } = options;

    // Validate input
    if (content.length > maxContentLength) {
      return {
        success: false,
        originalContent: content,
        convertedContent: content,
        originalFormat: currentFormat,
        targetFormat: "html",
        conversionMethod: "failed",
        errors: [
          `Content length ${content.length} exceeds maximum ${maxContentLength}`,
        ],
      };
    }

    // If already HTML, validate and return
    if (currentFormat === "html") {
      let convertedContent = content;
      let conversionMethod = "no-conversion";
      const warnings: string[] = [];
      const errors: string[] = [];

      // Sanitize if requested
      if (sanitizeHtml) {
        convertedContent = this.sanitizeHtml(convertedContent);
        conversionMethod += "+sanitized";
      }

      // Pretty print if requested
      if (prettyPrint) {
        convertedContent = this.prettyPrintHtml(convertedContent);
        conversionMethod += "+pretty";
      }

      // Validate if requested
      if (validateHtml) {
        const validationResult = this.validateHtml(convertedContent);
        if (!validationResult.isValid) {
          errors.push(...validationResult.errors);
        }
        if (generateWarnings) {
          warnings.push(...validationResult.warnings);
        }
      }

      return {
        success: errors.length === 0,
        originalContent: content,
        convertedContent,
        originalFormat: currentFormat,
        targetFormat: "html",
        conversionMethod,
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    let convertedContent: string;
    let conversionMethod: string;
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Use custom converter if provided
      if (customConverters && customConverters.has(currentFormat)) {
        convertedContent = customConverters.get(currentFormat)!(content);
        conversionMethod = "custom-converter";
      } else {
        // Use built-in conversion methods
        switch (currentFormat) {
          case "plaintext":
          case "text":
            convertedContent = this.convertPlaintextToHtml(content);
            conversionMethod = "plaintext-to-html";
            break;

          case "markdown":
            convertedContent = this.convertMarkdownToHtml(content);
            conversionMethod = "markdown-to-html";
            break;

          case "latex":
            convertedContent = this.convertLatexToHtml(content);
            conversionMethod = "latex-to-html";
            if (generateWarnings) {
              warnings.push("LaTeX conversion may not preserve all formatting");
            }
            break;

          case "html+KaTeX":
            convertedContent = this.convertKaTeXToHtml(content);
            conversionMethod = "katex-to-html";
            break;

          default:
            // Fallback to plaintext conversion
            convertedContent = this.convertPlaintextToHtml(content);
            conversionMethod = "fallback-plaintext-to-html";
            if (generateWarnings) {
              warnings.push(
                `Unknown format "${currentFormat}" treated as plaintext`,
              );
            }
            break;
        }
      }

      // Sanitize if requested
      if (sanitizeHtml) {
        convertedContent = this.sanitizeHtml(convertedContent);
        conversionMethod += "+sanitized";
      }

      // Pretty print if requested
      if (prettyPrint) {
        convertedContent = this.prettyPrintHtml(convertedContent);
        conversionMethod += "+pretty";
      }

      // Validate result if requested
      if (validateHtml) {
        const validationResult = this.validateHtml(convertedContent);
        if (!validationResult.isValid) {
          errors.push(...validationResult.errors);
        }
        if (generateWarnings) {
          warnings.push(...validationResult.warnings);
        }
      }

      return {
        success: errors.length === 0,
        originalContent: content,
        convertedContent,
        originalFormat: currentFormat,
        targetFormat: "html",
        conversionMethod,
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        originalContent: content,
        convertedContent: content,
        originalFormat: currentFormat,
        targetFormat: "html",
        conversionMethod: "failed",
        errors: [
          `Conversion failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Enforce HTML format for a single snippet
   */
  enforceHtmlFormat(
    snippet: TextSnippet | EnhancedSnippet,
    options: EnforcementOptions = {},
  ): {
    snippet: TextSnippet | EnhancedSnippet;
    result: FormatConversionResult;
  } {
    const { preserveOriginalFormat = true } = options;

    const currentFormat = this.detectContentFormat(snippet);
    const conversionResult = this.convertToHtml(
      snippet.content,
      currentFormat,
      options,
    );

    if (conversionResult.success) {
      const updatedSnippet = { ...snippet };

      // Update content and format
      updatedSnippet.content = conversionResult.convertedContent;
      updatedSnippet.contentType = "html";

      // Preserve original format if requested
      if (preserveOriginalFormat && currentFormat !== "html") {
        // Add original format to metadata (implementation depends on snippet type)
        const originalFormatTag = `original-format:${currentFormat}`;
        // Initialize tags array if it doesn't exist
        if (!updatedSnippet.tags) {
          updatedSnippet.tags = [];
        }
        if (!updatedSnippet.tags.includes(originalFormatTag)) {
          updatedSnippet.tags.push(originalFormatTag);
        }
      }

      // Update timestamps
      const now = new Date();
      if ("updatedAt" in updatedSnippet) {
        updatedSnippet.updatedAt = now;
      }
      if ("lastModified" in updatedSnippet) {
        updatedSnippet.lastModified = now;
      }

      return { snippet: updatedSnippet, result: conversionResult };
    }

    return { snippet, result: conversionResult };
  }

  /**
   * Enforce HTML format for multiple snippets
   */
  enforceHtmlFormatBatch(
    snippets: (TextSnippet | EnhancedSnippet)[],
    options: EnforcementOptions = {},
  ): BatchConversionResult {
    const startTime = Date.now();
    const conversionResults: FormatConversionResult[] = [];
    const convertedSnippets: (TextSnippet | EnhancedSnippet)[] = [];

    let successfulConversions = 0;
    let failedConversions = 0;
    let skippedConversions = 0;

    for (const snippet of snippets) {
      const { snippet: updatedSnippet, result } = this.enforceHtmlFormat(
        snippet,
        options,
      );

      conversionResults.push(result);
      convertedSnippets.push(updatedSnippet);

      if (result.success) {
        if (result.conversionMethod === "no-conversion") {
          skippedConversions++;
        } else {
          successfulConversions++;
        }
      } else {
        failedConversions++;
      }
    }

    const batchResult: BatchConversionResult = {
      totalSnippets: snippets.length,
      successfulConversions,
      failedConversions,
      skippedConversions,
      conversionResults,
      processingTimeMs: Date.now() - startTime,
    };

    this.lastBatchResult = batchResult;

    return batchResult;
  }

  /**
   * Detect the content format of a snippet
   */
  detectContentFormat(
    snippet: TextSnippet | EnhancedSnippet,
  ): SupportedContentType {
    // Check explicit contentType field
    if ("contentType" in snippet && snippet.contentType) {
      const contentType = snippet.contentType as SupportedContentType;
      // If it's an unknown format, fall back to content detection
      if (
        [
          "html",
          "plaintext",
          "markdown",
          "latex",
          "html+KaTeX",
          "text",
        ].includes(contentType)
      ) {
        return contentType;
      }
    }

    // Analyze content to detect format
    const content = snippet.content;

    // Check for HTML tags
    if (this.looksLikeHtml(content)) {
      return "html";
    }

    // Check for Markdown syntax
    if (this.looksLikeMarkdown(content)) {
      return "markdown";
    }

    // Check for LaTeX syntax
    if (this.looksLikeLatex(content)) {
      return "latex";
    }

    // Check for KaTeX syntax
    if (this.looksLikeKaTeX(content)) {
      return "html+KaTeX";
    }

    // Default to plaintext
    return "plaintext";
  }

  /**
   * Validate HTML content
   */
  validateHtml(content: string): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Basic HTML structure validation
    const hasValidStructure = this.hasValidHtmlStructure(content);
    const isHtml = this.looksLikeHtml(content);

    if (!isHtml && content.trim().length > 0) {
      warnings.push("Content does not appear to be HTML");
    }

    if (isHtml && !hasValidStructure) {
      warnings.push("HTML structure may be invalid");
    }

    // Check for common HTML issues
    if (content.includes("<script")) {
      errors.push("Script tags are not allowed");
    }

    if (content.includes("javascript:")) {
      errors.push("JavaScript URLs are not allowed");
    }

    return {
      isValid: errors.length === 0,
      isHtml,
      hasValidStructure,
      warnings,
      errors,
    };
  }

  /**
   * Get statistics from last batch conversion
   */
  getLastBatchResult(): BatchConversionResult | null {
    return this.lastBatchResult;
  }

  /**
   * Convert plaintext to HTML
   */
  private convertPlaintextToHtml(content: string): string {
    return content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^(.+)$/gm, "<p>$1</p>")
      .replace(/<p><\/p>/g, "")
      .replace(/<p>(<br>)+<\/p>/g, "");
  }

  /**
   * Convert Markdown to HTML (basic implementation)
   */
  private convertMarkdownToHtml(content: string): string {
    return (
      content
        // Headers
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        // Bold and italic
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Code blocks
        .replace(/```(.+?)```/gs, "<pre><code>$1</code></pre>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        // Lists
        .replace(/^\* (.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
        // Paragraphs
        .replace(/\n\n/g, "</p><p>")
        .replace(/^(.+)$/gm, "<p>$1</p>")
        .replace(/<p><h/g, "<h")
        .replace(/<\/h([1-6])><\/p>/g, "</h$1>")
        .replace(/<p><ul>/g, "<ul>")
        .replace(/<\/ul><\/p>/g, "</ul>")
        .replace(/<p><pre>/g, "<pre>")
        .replace(/<\/pre><\/p>/g, "</pre>")
    );
  }

  /**
   * Convert LaTeX to HTML (basic implementation)
   */
  private convertLatexToHtml(content: string): string {
    return (
      content
        // Basic text formatting
        .replace(/\\textbf\{([^}]+)\}/g, "<strong>$1</strong>")
        .replace(/\\textit\{([^}]+)\}/g, "<em>$1</em>")
        .replace(/\\underline\{([^}]+)\}/g, "<u>$1</u>")
        // Sections
        .replace(/\\section\{([^}]+)\}/g, "<h2>$1</h2>")
        .replace(/\\subsection\{([^}]+)\}/g, "<h3>$1</h3>")
        .replace(/\\subsubsection\{([^}]+)\}/g, "<h4>$1</h4>")
        // Lists
        .replace(/\\begin\{itemize\}/g, "<ul>")
        .replace(/\\end\{itemize\}/g, "</ul>")
        .replace(/\\item\s+/g, "<li>")
        .replace(/<li>([^<]*?)(?=<li>|<\/ul>)/g, "<li>$1</li>")
        // Math (basic)
        .replace(/\$\$([^$]+)\$\$/g, '<span class="math-block">$1</span>')
        .replace(/\$([^$]+)\$/g, '<span class="math-inline">$1</span>')
        // Paragraphs
        .replace(/\n\n/g, "</p><p>")
        .replace(/^(.+)$/gm, "<p>$1</p>")
        .replace(/<p><h/g, "<h")
        .replace(/<\/h([1-6])><\/p>/g, "</h$1>")
        .replace(/<p><ul>/g, "<ul>")
        .replace(/<\/ul><\/p>/g, "</ul>")
    );
  }

  /**
   * Convert KaTeX to HTML
   */
  private convertKaTeXToHtml(content: string): string {
    // KaTeX content is already HTML with embedded KaTeX
    // Just ensure it's properly formatted
    return content
      .replace(/\$\$([^$]+)\$\$/g, '<span class="katex-display">$1</span>')
      .replace(/\$([^$]+)\$/g, '<span class="katex-inline">$1</span>');
  }

  /**
   * Sanitize HTML content
   */
  private sanitizeHtml(content: string): string {
    return content
      .replace(/<script[^>]*>.*?<\/script>/gi, "")
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+="[^"]*"/gi, "")
      .replace(/on\w+='[^']*'/gi, "");
  }

  /**
   * Pretty print HTML content
   */
  private prettyPrintHtml(content: string): string {
    // Basic pretty printing (simplified)
    return content
      .replace(/></g, ">\n<")
      .replace(/\n\s*\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n");
  }

  /**
   * Check if content looks like HTML
   */
  private looksLikeHtml(content: string): boolean {
    const htmlPattern = /<[^>]+>/;
    return htmlPattern.test(content);
  }

  /**
   * Check if content looks like Markdown
   */
  private looksLikeMarkdown(content: string): boolean {
    const markdownPatterns = [
      /^#+\s/m, // Headers
      /\*\*[^*]+\*\*/, // Bold
      /\*[^*]+\*/, // Italic
      /\[[^\]]+\]\([^)]+\)/, // Links
      /^[*-]\s/m, // Lists
      /`[^`]+`/, // Code
      /```[\s\S]*?```/, // Code blocks
    ];

    return markdownPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Check if content looks like LaTeX
   */
  private looksLikeLatex(content: string): boolean {
    const latexPatterns = [
      /\\[a-zA-Z]+\{[^}]*\}/, // LaTeX commands
      /\\begin\{[^}]+\}/, // Begin environments
      /\\end\{[^}]+\}/, // End environments
      /\$\$[^$]+\$\$/, // Display math
      /\$[^$]+\$/, // Inline math
    ];

    return latexPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Check if content looks like KaTeX
   */
  private looksLikeKaTeX(content: string): boolean {
    return (
      /class=["']katex/.test(content) ||
      (this.looksLikeHtml(content) && /\$[^$]+\$/.test(content))
    );
  }

  /**
   * Check if HTML has valid structure
   */
  private hasValidHtmlStructure(content: string): boolean {
    // Basic check for balanced tags
    const openTags = content.match(/<[^/!][^>]*>/g) || [];
    const closeTags = content.match(/<\/[^>]*>/g) || [];

    // Count self-closing tags
    const selfClosingTags = content.match(/<[^>]*\/>/g) || [];

    // Very basic validation
    return openTags.length - selfClosingTags.length <= closeTags.length;
  }
}

/**
 * Global instance for easy access
 */
let globalEnforcer: HTMLFormatEnforcer | null = null;

/**
 * Get or create the global enforcer instance
 */
export function getHtmlFormatEnforcer(): HTMLFormatEnforcer {
  if (!globalEnforcer) {
    globalEnforcer = new HTMLFormatEnforcer();
  }
  return globalEnforcer;
}

/**
 * Enforce HTML format for a single snippet (convenience function)
 */
export function enforceHtmlFormat(
  snippet: TextSnippet | EnhancedSnippet,
  options?: EnforcementOptions,
): { snippet: TextSnippet | EnhancedSnippet; result: FormatConversionResult } {
  return getHtmlFormatEnforcer().enforceHtmlFormat(snippet, options);
}

/**
 * Enforce HTML format for multiple snippets (convenience function)
 */
export function enforceHtmlFormatBatch(
  snippets: (TextSnippet | EnhancedSnippet)[],
  options?: EnforcementOptions,
): BatchConversionResult {
  return getHtmlFormatEnforcer().enforceHtmlFormatBatch(snippets, options);
}

/**
 * Convert content to HTML (convenience function)
 */
export function convertToHtml(
  content: string,
  currentFormat: SupportedContentType,
  options?: EnforcementOptions,
): FormatConversionResult {
  return getHtmlFormatEnforcer().convertToHtml(content, currentFormat, options);
}
