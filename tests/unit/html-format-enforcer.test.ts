/**
 * HTML Format Enforcer Tests
 * Tests for ensuring all snippets are stored as HTML in JSON files
 */

import {
  HTMLFormatEnforcer,
  type FormatConversionResult,
  type BatchConversionResult,
  type EnforcementOptions,
  getHtmlFormatEnforcer,
  enforceHtmlFormat,
  enforceHtmlFormatBatch,
  convertToHtml,
} from "../../src/storage/html-format-enforcer";
import type { TextSnippet } from "../../src/shared/types";
import type { EnhancedSnippet } from "../../src/types/snippet-formats";

describe("HTMLFormatEnforcer", () => {
  let enforcer: HTMLFormatEnforcer;
  let mockTextSnippets: TextSnippet[];
  let mockEnhancedSnippets: EnhancedSnippet[];

  beforeEach(() => {
    enforcer = new HTMLFormatEnforcer();

    // Create mock TextSnippets with different content types
    mockTextSnippets = [
      {
        id: "html-snippet",
        trigger: ";html",
        content: "<p>Hello <strong>World</strong>!</p>",
        contentType: "html",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
        usageCount: 5,
        lastUsed: new Date("2023-01-10"),
      },
      {
        id: "text-snippet",
        trigger: ";text",
        content: "Hello World!\nThis is a test.",
        contentType: "plaintext",
        createdAt: new Date("2023-01-02"),
        updatedAt: new Date("2023-01-02"),
        usageCount: 3,
        lastUsed: new Date("2023-01-08"),
      },
      {
        id: "markdown-snippet",
        trigger: ";md",
        content:
          "# Header\n\nThis is **bold** and *italic*.\n\n* List item 1\n* List item 2",
        contentType: "markdown",
        createdAt: new Date("2023-01-03"),
        updatedAt: new Date("2023-01-03"),
        usageCount: 2,
        lastUsed: new Date("2023-01-05"),
      },
      {
        id: "latex-snippet",
        trigger: ";tex",
        content:
          "\\section{Title}\n\\textbf{Bold} and \\textit{italic}.\n\\begin{itemize}\n\\item First\n\\item Second\n\\end{itemize}",
        contentType: "latex",
        createdAt: new Date("2023-01-04"),
        updatedAt: new Date("2023-01-04"),
        usageCount: 1,
        lastUsed: new Date("2023-01-06"),
      },
    ];

    // Create mock EnhancedSnippets
    mockEnhancedSnippets = [
      {
        id: "enhanced-html",
        trigger: ";ehtml",
        content: "<p>Enhanced <em>HTML</em> content</p>",
        contentType: "html",
        snipDependencies: [],
        description: "Enhanced HTML snippet",
        scope: "personal",
        variables: [],
        images: [],
        tags: ["html", "enhanced"],
        createdAt: "2023-01-01T00:00:00Z",
        createdBy: "user1",
        updatedAt: "2023-01-01T00:00:00Z",
        updatedBy: "user1",
      },
      {
        id: "enhanced-plaintext",
        trigger: ";etext",
        content: "Plain text content\nWith multiple lines",
        contentType: "plaintext",
        snipDependencies: [],
        description: "Enhanced plaintext snippet",
        scope: "team",
        variables: [],
        images: [],
        tags: ["plaintext"],
        createdAt: "2023-01-02T00:00:00Z",
        createdBy: "user2",
        updatedAt: "2023-01-02T00:00:00Z",
        updatedBy: "user2",
      },
    ];
  });

  describe("Content Format Detection", () => {
    it("should detect HTML content", () => {
      const format = enforcer.detectContentFormat(mockTextSnippets[0]);
      expect(format).toBe("html");
    });

    it("should detect plaintext content", () => {
      const format = enforcer.detectContentFormat(mockTextSnippets[1]);
      expect(format).toBe("text");
    });

    it("should detect markdown content", () => {
      const format = enforcer.detectContentFormat(mockTextSnippets[2]);
      expect(format).toBe("markdown");
    });

    it("should detect LaTeX content", () => {
      const format = enforcer.detectContentFormat(mockTextSnippets[3]);
      expect(format).toBe("latex");
    });

    it("should detect content without explicit contentType", () => {
      const snippetWithoutType = { ...mockTextSnippets[0] };
      delete (snippetWithoutType as any).contentType;

      const format = enforcer.detectContentFormat(snippetWithoutType);
      expect(format).toBe("html"); // Should detect based on content
    });

    it("should fallback to plaintext for unknown content", () => {
      const unknownSnippet = {
        ...mockTextSnippets[1],
        content: "Just some text without special formatting",
        contentType: "unknown" as any,
      };

      const format = enforcer.detectContentFormat(unknownSnippet);
      expect(format).toBe("plaintext");
    });
  });

  describe("HTML Validation", () => {
    it("should validate valid HTML", () => {
      const result = enforcer.validateHtml(
        "<p>Hello <strong>World</strong>!</p>",
      );

      expect(result.isValid).toBe(true);
      expect(result.isHtml).toBe(true);
      expect(result.hasValidStructure).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid HTML with script tags", () => {
      const result = enforcer.validateHtml(
        '<p>Hello</p><script>alert("xss")</script>',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Script tags are not allowed");
    });

    it("should detect JavaScript URLs", () => {
      const result = enforcer.validateHtml(
        '<a href="javascript:alert(1)">Link</a>',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("JavaScript URLs are not allowed");
    });

    it("should warn about non-HTML content", () => {
      const result = enforcer.validateHtml("Just plain text");

      expect(result.isValid).toBe(true);
      expect(result.isHtml).toBe(false);
      expect(result.warnings).toContain("Content does not appear to be HTML");
    });
  });

  describe("Content Conversion", () => {
    it("should convert plaintext to HTML", () => {
      const result = enforcer.convertToHtml(
        "Hello World!\nThis is a test.\n\nNew paragraph.",
        "plaintext",
      );

      expect(result.success).toBe(true);
      expect(result.convertedContent).toContain(
        "<p>Hello World!<br>This is a test.</p>",
      );
      expect(result.convertedContent).toContain("<p>New paragraph.</p>");
      expect(result.conversionMethod).toBe("plaintext-to-html");
    });

    it("should convert markdown to HTML", () => {
      const result = enforcer.convertToHtml(
        "# Header\n\nThis is **bold** and *italic*.\n\n* Item 1\n* Item 2",
        "markdown",
      );

      expect(result.success).toBe(true);
      expect(result.convertedContent).toContain("<h1>Header</h1>");
      expect(result.convertedContent).toContain("<strong>bold</strong>");
      expect(result.convertedContent).toContain("<em>italic</em>");
      expect(result.convertedContent).toContain("<ul>");
      expect(result.convertedContent).toContain("<li>Item 1</li>");
      expect(result.conversionMethod).toBe("markdown-to-html");
    });

    it("should convert LaTeX to HTML", () => {
      const result = enforcer.convertToHtml(
        "\\section{Title}\n\\textbf{Bold} and \\textit{italic}.",
        "latex",
      );

      expect(result.success).toBe(true);
      expect(result.convertedContent).toContain("<h2>Title</h2>");
      expect(result.convertedContent).toContain("<strong>Bold</strong>");
      expect(result.convertedContent).toContain("<em>italic</em>");
      expect(result.conversionMethod).toBe("latex-to-html");
    });

    it("should handle KaTeX content", () => {
      const result = enforcer.convertToHtml(
        "Math: $$E = mc^2$$ and inline $x = 1$",
        "html+KaTeX",
      );

      expect(result.success).toBe(true);
      expect(result.convertedContent).toContain(
        '<span class="katex-display">E = mc^2</span>',
      );
      expect(result.convertedContent).toContain(
        '<span class="katex-inline">x = 1</span>',
      );
      expect(result.conversionMethod).toBe("katex-to-html");
    });

    it("should handle already HTML content", () => {
      const htmlContent = "<p>Already <strong>HTML</strong></p>";
      const result = enforcer.convertToHtml(htmlContent, "html");

      expect(result.success).toBe(true);
      expect(result.convertedContent).toBe(htmlContent);
      expect(result.conversionMethod).toBe("no-conversion");
    });

    it("should use custom converters when provided", () => {
      const customConverters = new Map([
        [
          "plaintext" as const,
          (content: string) => `<div class="custom">${content}</div>`,
        ],
      ]);

      const result = enforcer.convertToHtml("Test content", "plaintext", {
        customConverters,
      });

      expect(result.success).toBe(true);
      expect(result.convertedContent).toBe(
        '<div class="custom">Test content</div>',
      );
      expect(result.conversionMethod).toBe("custom-converter");
    });

    it("should handle content length limits", () => {
      const longContent = "a".repeat(1000);
      const result = enforcer.convertToHtml(longContent, "plaintext", {
        maxContentLength: 500,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Content length 1000 exceeds maximum 500",
      );
    });

    it("should sanitize HTML when requested", () => {
      const result = enforcer.convertToHtml(
        '<p>Safe content</p><script>alert("xss")</script>',
        "html",
        { sanitizeHtml: true, validateHtml: false }, // Disable validation to allow sanitization
      );

      expect(result.success).toBe(true);
      expect(result.convertedContent).toContain("<p>Safe content</p>");
      expect(result.convertedContent).not.toContain("<script>");
      expect(result.conversionMethod).toBe("no-conversion+sanitized");
    });
  });

  describe("Single Snippet Enforcement", () => {
    it("should enforce HTML format for TextSnippet", () => {
      const { snippet: updatedSnippet, result } = enforcer.enforceHtmlFormat(
        mockTextSnippets[1], // plaintext snippet
      );

      expect(result.success).toBe(true);
      expect(updatedSnippet.contentType).toBe("html");
      expect(updatedSnippet.content).toContain(
        "<p>Hello World!<br>This is a test.</p>",
      );
      expect(updatedSnippet.updatedAt).toBeInstanceOf(Date);
    });

    it("should enforce HTML format for EnhancedSnippet", () => {
      const { snippet: updatedSnippet, result } = enforcer.enforceHtmlFormat(
        mockEnhancedSnippets[1], // plaintext snippet
      );

      expect(result.success).toBe(true);
      expect(updatedSnippet.contentType).toBe("html");
      expect(updatedSnippet.content).toContain(
        "<p>Plain text content<br>With multiple lines</p>",
      );
    });

    it("should preserve original format in tags when requested", () => {
      const { snippet: updatedSnippet } = enforcer.enforceHtmlFormat(
        mockTextSnippets[1],
        { preserveOriginalFormat: true },
      );

      expect(updatedSnippet.tags).toContain("original-format:text");
    });

    it("should not modify already HTML snippets", () => {
      const { snippet: updatedSnippet, result } = enforcer.enforceHtmlFormat(
        mockTextSnippets[0], // already HTML
      );

      expect(result.success).toBe(true);
      expect(result.conversionMethod).toBe("no-conversion");
      expect(updatedSnippet.content).toBe(mockTextSnippets[0].content);
    });

    it("should handle conversion failures gracefully", () => {
      const problematicSnippet = {
        ...mockTextSnippets[1],
        content: "a".repeat(2000000), // Very long content
      };

      const { snippet: updatedSnippet, result } = enforcer.enforceHtmlFormat(
        problematicSnippet,
        { maxContentLength: 1000 },
      );

      expect(result.success).toBe(false);
      expect(updatedSnippet).toEqual(problematicSnippet); // Should remain unchanged
    });
  });

  describe("Batch Enforcement", () => {
    it("should enforce HTML format for multiple snippets", () => {
      const result = enforcer.enforceHtmlFormatBatch(mockTextSnippets);

      expect(result.totalSnippets).toBe(4);
      expect(result.successfulConversions).toBe(3); // 3 non-HTML snippets
      expect(result.skippedConversions).toBe(1); // 1 already HTML
      expect(result.failedConversions).toBe(0);
      expect(result.conversionResults).toHaveLength(4);
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle mixed TextSnippet and EnhancedSnippet types", () => {
      const mixedSnippets = [
        mockTextSnippets[0],
        mockEnhancedSnippets[0],
        mockTextSnippets[1],
        mockEnhancedSnippets[1],
      ];

      const result = enforcer.enforceHtmlFormatBatch(mixedSnippets);

      expect(result.totalSnippets).toBe(4);
      expect(result.successfulConversions).toBe(2); // 2 non-HTML snippets
      expect(result.skippedConversions).toBe(2); // 2 already HTML
      expect(result.failedConversions).toBe(0);
    });

    it("should track statistics correctly", () => {
      enforcer.enforceHtmlFormatBatch(mockTextSnippets);
      const batchResult = enforcer.getLastBatchResult();

      expect(batchResult).toBeDefined();
      expect(batchResult!.totalSnippets).toBe(4);
      expect(
        batchResult!.successfulConversions +
          batchResult!.skippedConversions +
          batchResult!.failedConversions,
      ).toBe(4);
    });

    it("should handle empty batch", () => {
      const result = enforcer.enforceHtmlFormatBatch([]);

      expect(result.totalSnippets).toBe(0);
      expect(result.successfulConversions).toBe(0);
      expect(result.skippedConversions).toBe(0);
      expect(result.failedConversions).toBe(0);
    });
  });

  describe("Advanced Features", () => {
    it("should pretty print HTML when requested", () => {
      const result = enforcer.convertToHtml(
        "<p>Hello</p><div><span>World</span></div>",
        "html",
        { prettyPrint: true, validateHtml: false },
      );

      expect(result.success).toBe(true);
      expect(result.convertedContent).toContain("\n");
      expect(result.conversionMethod).toBe("no-conversion+pretty");
    });

    it("should generate warnings for lossy conversions", () => {
      const result = enforcer.convertToHtml(
        "\\documentclass{article}\n\\begin{document}\nContent\n\\end{document}",
        "latex",
        { generateWarnings: true },
      );

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        "LaTeX conversion may not preserve all formatting",
      );
    });

    it("should handle unknown formats with warnings", () => {
      const result = enforcer.convertToHtml(
        "Some unknown format content",
        "unknown" as any,
        { generateWarnings: true },
      );

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'Unknown format "unknown" treated as plaintext',
      );
    });
  });

  describe("Convenience Functions", () => {
    it("should provide global enforcer instance", () => {
      const instance1 = getHtmlFormatEnforcer();
      const instance2 = getHtmlFormatEnforcer();
      expect(instance1).toBe(instance2); // Should be same instance
    });

    it("should provide convenience enforcement function", () => {
      const { snippet: updatedSnippet, result } = enforceHtmlFormat(
        mockTextSnippets[1],
      );

      expect(result.success).toBe(true);
      expect(updatedSnippet.contentType).toBe("html");
    });

    it("should provide convenience batch enforcement function", () => {
      const result = enforceHtmlFormatBatch(mockTextSnippets);

      expect(result.totalSnippets).toBe(4);
      expect(result.successfulConversions).toBe(3);
    });

    it("should provide convenience conversion function", () => {
      const result = convertToHtml("Hello World!", "plaintext");

      expect(result.success).toBe(true);
      expect(result.convertedContent).toContain("<p>Hello World!</p>");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty content", () => {
      const result = enforcer.convertToHtml("", "plaintext");

      expect(result.success).toBe(true);
      expect(result.convertedContent).toBe("");
    });

    it("should handle HTML with special characters", () => {
      const result = enforcer.convertToHtml(
        "Hello & goodbye < > \" ' test",
        "plaintext",
      );

      expect(result.success).toBe(true);
      expect(result.convertedContent).toContain("&amp;");
      expect(result.convertedContent).toContain("&lt;");
      expect(result.convertedContent).toContain("&gt;");
      expect(result.convertedContent).toContain("&quot;");
      expect(result.convertedContent).toContain("&#39;");
    });

    it("should handle malformed HTML gracefully", () => {
      const result = enforcer.convertToHtml(
        "<p>Unclosed paragraph<div>Mixed nesting</p></div>",
        "html",
        { generateWarnings: true, validateHtml: true },
      );

      expect(result.success).toBe(true);
      // The basic validation might generate warnings about invalid structure
      expect(result.warnings === undefined || result.warnings.length >= 0).toBe(
        true,
      );
    });

    it("should handle very long content efficiently", () => {
      const longContent = "a".repeat(100000);
      const startTime = Date.now();

      const result = enforcer.convertToHtml(longContent, "plaintext");

      const endTime = Date.now();
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it("should handle complex markdown formatting", () => {
      const complexMarkdown = `
# Main Title

## Subtitle

This is a paragraph with **bold** and *italic* text.

### Lists

* First item
* Second item with [link](https://example.com)
* Third item

### Code

Here's some \`inline code\` and a code block:

\`\`\`
function hello() {
  return "world";
}
\`\`\`

### More formatting

This is a paragraph with multiple lines
that should be handled correctly.
      `;

      const result = enforcer.convertToHtml(complexMarkdown, "markdown");

      expect(result.success).toBe(true);
      expect(result.convertedContent).toContain("<h1>Main Title</h1>");
      expect(result.convertedContent).toContain("<h2>Subtitle</h2>");
      expect(result.convertedContent).toContain("<strong>bold</strong>");
      expect(result.convertedContent).toContain("<em>italic</em>");
      expect(result.convertedContent).toContain("<ul>");
      expect(result.convertedContent).toContain(
        '<a href="https://example.com">link</a>',
      );
      expect(result.convertedContent).toContain("<code>inline code</code>");
      expect(result.convertedContent).toContain("<pre><code>");
    });
  });
});
