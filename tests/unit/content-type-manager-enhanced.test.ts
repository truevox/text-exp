/**
 * Tests for Content Type Manager
 */

import {
  ContentTypeManager,
  createContentTypeManager,
  type ContentType,
  type ContentConversionOptions,
} from "../../src/editor/content-type-manager";

// Mock TinyMCE Editor
const mockEditor = {
  getContent: jest.fn(),
  setContent: jest.fn(),
  insertContent: jest.fn(),
  on: jest.fn(),
  ui: {
    registry: {
      addButton: jest.fn(),
    },
  },
  selection: {
    getRng: jest.fn(),
    setRng: jest.fn(),
  },
};

describe("ContentTypeManager", () => {
  let manager: ContentTypeManager;

  beforeEach(() => {
    manager = new ContentTypeManager();
    jest.clearAllMocks();
  });

  describe("Static Methods", () => {
    it("should return all content type configurations", () => {
      const contentTypes = ContentTypeManager.getContentTypes();

      expect(contentTypes).toHaveLength(3);
      expect(contentTypes.map((ct) => ct.type)).toEqual([
        "html",
        "plaintext",
        "latex",
      ]);
    });

    it("should get specific content type configuration", () => {
      const htmlConfig = ContentTypeManager.getConfig("html");

      expect(htmlConfig.type).toBe("html");
      expect(htmlConfig.label).toBe("Rich Text (HTML)");
      expect(htmlConfig.mimeType).toBe("text/html");
      expect(htmlConfig.fileExtension).toBe("html");
    });

    it("should detect content type from HTML content", () => {
      const htmlContent = "<p>This is <strong>HTML</strong> content</p>";
      const detectedType = ContentTypeManager.detectContentType(htmlContent);

      expect(detectedType).toBe("html");
    });

    it("should detect content type from LaTeX content", () => {
      const latexContent = "\\textbf{Bold text} and $$E = mc^2$$";
      const detectedType = ContentTypeManager.detectContentType(latexContent);

      expect(detectedType).toBe("latex");
    });

    it("should detect content type from LaTeX math expressions", () => {
      const mathContent =
        "The equation $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ is the quadratic formula";
      const detectedType = ContentTypeManager.detectContentType(mathContent);

      expect(detectedType).toBe("latex");
    });

    it("should default to plaintext for simple content", () => {
      const plainContent = "This is just plain text without any markup";
      const detectedType = ContentTypeManager.detectContentType(plainContent);

      expect(detectedType).toBe("plaintext");
    });

    it("should detect LaTeX commands correctly", () => {
      const latexContent =
        "\\section{Introduction} Some text \\cite{reference}";
      const detectedType = ContentTypeManager.detectContentType(latexContent);

      expect(detectedType).toBe("latex");
    });
  });

  describe("Editor Integration", () => {
    beforeEach(() => {
      manager.setEditor(mockEditor as any);
    });

    it("should set editor instance", () => {
      expect(manager["editor"]).toBe(mockEditor);
    });

    it("should get current content type", () => {
      expect(manager.getCurrentType()).toBe("html"); // Default
    });

    it("should switch content type without conversion", async () => {
      mockEditor.getContent.mockReturnValue("<p>Test content</p>");
      mockEditor.setContent.mockImplementation();

      await manager.switchContentType("plaintext");

      expect(manager.getCurrentType()).toBe("plaintext");
      expect(mockEditor.setContent).toHaveBeenCalledWith("Test content");
    });

    it("should not switch if type is the same", async () => {
      await manager.switchContentType("html");

      expect(mockEditor.getContent).not.toHaveBeenCalled();
      expect(mockEditor.setContent).not.toHaveBeenCalled();
    });

    it("should throw error if editor not set", async () => {
      const managerWithoutEditor = new ContentTypeManager();

      await expect(
        managerWithoutEditor.switchContentType("plaintext"),
      ).rejects.toThrow("Editor not set");
    });
  });

  describe("Content Conversion", () => {
    describe("HTML to Plaintext", () => {
      it("should convert HTML to plaintext", () => {
        const htmlContent =
          "<p>Hello <strong>world</strong>!</p><br><p>New paragraph</p>";
        const plaintext = manager.convertContent(
          htmlContent,
          "html",
          "plaintext",
        );

        expect(plaintext).toBe("Hello world!\n\nNew paragraph");
      });

      it("should handle HTML entities", () => {
        const htmlContent = "<p>&lt;script&gt; &amp; &nbsp; test</p>";
        const plaintext = manager.convertContent(
          htmlContent,
          "html",
          "plaintext",
        );

        expect(plaintext).toBe("<script> &   test");
      });

      it("should preserve line breaks", () => {
        const htmlContent = "<p>Line 1</p><br><p>Line 2</p>";
        const plaintext = manager.convertContent(
          htmlContent,
          "html",
          "plaintext",
        );

        expect(plaintext).toBe("Line 1\n\nLine 2");
      });
    });

    describe("HTML to LaTeX", () => {
      it("should convert basic HTML formatting to LaTeX", () => {
        const htmlContent = "<strong>Bold</strong> and <em>italic</em> text";
        const latex = manager.convertContent(htmlContent, "html", "latex");

        expect(latex).toBe("\\textbf{Bold} and \\textit{italic} text");
      });

      it("should convert headings to LaTeX sections", () => {
        const htmlContent =
          "<h1>Main Title</h1><h2>Subtitle</h2><h3>Sub-subtitle</h3>";
        const latex = manager.convertContent(htmlContent, "html", "latex");

        expect(latex).toBe(
          "\\section{Main Title}\\subsection{Subtitle}\\subsubsection{Sub-subtitle}",
        );
      });

      it("should convert underline and line breaks", () => {
        const htmlContent = "<u>Underlined</u><br>New line";
        const latex = manager.convertContent(htmlContent, "html", "latex");

        expect(latex).toBe("\\underline{Underlined}\\\\\nNew line");
      });

      it("should handle paragraphs", () => {
        const htmlContent = "<p>First paragraph</p><p>Second paragraph</p>";
        const latex = manager.convertContent(htmlContent, "html", "latex");

        expect(latex).toBe("First paragraph\n\nSecond paragraph");
      });
    });

    describe("Plaintext to HTML", () => {
      it("should convert plaintext to HTML with paragraphs", () => {
        const plaintext = "First paragraph\n\nSecond paragraph";
        const html = manager.convertContent(plaintext, "plaintext", "html");

        expect(html).toBe("<p>First paragraph</p><p>Second paragraph</p>");
      });

      it("should escape HTML characters", () => {
        const plaintext = "<script>alert('xss')</script> & other < > chars";
        const html = manager.convertContent(plaintext, "plaintext", "html");

        expect(html).toBe(
          "<p>&lt;script&gt;alert('xss')&lt;/script&gt; &amp; other &lt; &gt; chars</p>",
        );
      });

      it("should convert line breaks to BR tags", () => {
        const plaintext = "Line 1\nLine 2\nLine 3";
        const html = manager.convertContent(plaintext, "plaintext", "html");

        expect(html).toBe("<p>Line 1<br>Line 2<br>Line 3</p>");
      });
    });

    describe("Plaintext to LaTeX", () => {
      it("should escape LaTeX special characters", () => {
        const plaintext = "Price: $100 & 50% discount {special} offer #1";
        const latex = manager.convertContent(plaintext, "plaintext", "latex");

        expect(latex).toBe(
          "Price: \\$100 \\& 50\\% discount \\{special\\} offer \\#1",
        );
      });

      it("should handle backslashes and other special chars", () => {
        const plaintext =
          "Path: C:\\Program Files & ~user ^superscript _subscript";
        const latex = manager.convertContent(plaintext, "plaintext", "latex");

        expect(latex).toBe(
          "Path: C:\\textbackslash{}Program Files \\& \\textasciitilde{}user \\textasciicircum{}superscript \\_subscript",
        );
      });

      it("should handle paragraphs", () => {
        const plaintext = "First paragraph\n\nSecond paragraph";
        const latex = manager.convertContent(plaintext, "plaintext", "latex");

        expect(latex).toBe("First paragraph\n\n\\par\nSecond paragraph");
      });
    });

    describe("LaTeX to HTML", () => {
      it("should convert LaTeX formatting to HTML", () => {
        const latex = "\\textbf{Bold} and \\textit{italic} text";
        const html = manager.convertContent(latex, "latex", "html");

        expect(html).toBe(
          "<p><strong>Bold</strong> and <em>italic</em> text</p>",
        );
      });

      it("should convert LaTeX sections to HTML headings", () => {
        const latex = "\\section{Main}\\subsection{Sub}\\subsubsection{SubSub}";
        const html = manager.convertContent(latex, "latex", "html");

        expect(html).toBe("<p><h1>Main</h1><h2>Sub</h2><h3>SubSub</h3></p>");
      });

      it("should convert math expressions to italic (simplified)", () => {
        const latex = "The equation $$E = mc^2$$ and inline $x = y$ math";
        const html = manager.convertContent(latex, "latex", "html");

        expect(html).toBe(
          "<p>The equation <em>E = mc^2</em> and inline <em>x = y</em> math</p>",
        );
      });

      it("should convert line breaks and paragraphs", () => {
        const latex = "Line 1\\\\Line 2\\par\nNew paragraph";
        const html = manager.convertContent(latex, "latex", "html");

        expect(html).toBe("<p>Line 1<br>Line 2</p><p>New paragraph</p>");
      });
    });

    describe("LaTeX to Plaintext", () => {
      it("should strip LaTeX commands and preserve content", () => {
        const latex = "\\textbf{Bold text} and \\textit{italic text}";
        const plaintext = manager.convertContent(latex, "latex", "plaintext");

        expect(plaintext).toBe("Bold text and italic text");
      });

      it("should handle math expressions", () => {
        const latex = "The equation $$E = mc^2$$ is famous";
        const plaintext = manager.convertContent(latex, "latex", "plaintext");

        expect(plaintext).toBe("The equation E = mc^2 is famous");
      });

      it("should convert line breaks and paragraphs", () => {
        const latex = "Line 1\\\\Line 2\\par\nNew paragraph";
        const plaintext = manager.convertContent(latex, "latex", "plaintext");

        expect(plaintext).toBe("Line 1\nLine 2\n\nNew paragraph");
      });

      it("should remove braces and preserve content", () => {
        const latex = "\\section{Introduction} Some text with {braces}";
        const plaintext = manager.convertContent(latex, "latex", "plaintext");

        expect(plaintext).toBe("Introduction Some text with braces");
      });
    });

    it("should return unchanged content for same types", () => {
      const content = "<p>Test content</p>";
      const result = manager.convertContent(content, "html", "html");

      expect(result).toBe(content);
    });
  });

  describe("Content Validation", () => {
    describe("HTML Validation", () => {
      it("should validate well-formed HTML", () => {
        const validHtml = "<p>Valid <strong>HTML</strong> content</p>";
        const result = manager.validateContent(validHtml, "html");

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should detect mismatched tags", () => {
        const invalidHtml = "<p>Unclosed paragraph<div>Mismatched</p></div>";
        const result = manager.validateContent(invalidHtml, "html");

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining("Mismatched closing tag"),
        );
      });

      it("should warn about unclosed tags", () => {
        const htmlWithUnclosedTags = "<p>Paragraph<div>Unclosed div";
        const result = manager.validateContent(htmlWithUnclosedTags, "html");

        expect(result.warnings).toContainEqual(
          expect.stringContaining("Unclosed tags"),
        );
      });

      it("should handle self-closing tags correctly", () => {
        const htmlWithSelfClosing = "<p>Line 1<br/>Line 2<hr/></p>";
        const result = manager.validateContent(htmlWithSelfClosing, "html");

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should handle standard self-closing tags", () => {
        const htmlWithStandardSelfClosing =
          "<p>Image: <img src='test.jpg'> and break: <br></p>";
        const result = manager.validateContent(
          htmlWithStandardSelfClosing,
          "html",
        );

        expect(result.isValid).toBe(true);
      });
    });

    describe("Plaintext Validation", () => {
      it("should validate pure plaintext", () => {
        const plaintext = "This is pure plaintext content with no HTML tags";
        const result = manager.validateContent(plaintext, "plaintext");

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should reject HTML tags in plaintext", () => {
        const textWithHtml = "This has <strong>HTML tags</strong> in it";
        const result = manager.validateContent(textWithHtml, "plaintext");

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          "HTML tags are not allowed in plain text content",
        );
      });

      it("should allow special characters", () => {
        const textWithSpecialChars = "Special chars: & < > \" ' are allowed";
        const result = manager.validateContent(
          textWithSpecialChars,
          "plaintext",
        );

        expect(result.isValid).toBe(true);
      });
    });

    describe("LaTeX Validation", () => {
      it("should validate well-formed LaTeX", () => {
        const validLatex = "\\textbf{Bold} text with $$math = formula$$";
        const result = manager.validateContent(validLatex, "latex");

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should detect unmatched braces", () => {
        const latexWithUnmatchedBraces =
          "\\textbf{Bold text missing closing brace";
        const result = manager.validateContent(
          latexWithUnmatchedBraces,
          "latex",
        );

        expect(result.warnings).toContainEqual("Unclosed braces detected");
      });

      it("should detect extra closing braces", () => {
        const latexWithExtraClosing = "Extra closing brace}";
        const result = manager.validateContent(latexWithExtraClosing, "latex");

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual("Unmatched closing brace found");
      });

      it("should detect unmatched math delimiters", () => {
        const latexWithUnmatchedMath =
          "Math formula $x = y missing closing dollar";
        const result = manager.validateContent(latexWithUnmatchedMath, "latex");

        expect(result.warnings).toContainEqual("Unmatched math delimiters ($)");
      });

      it("should handle nested braces correctly", () => {
        const latexWithNestedBraces = "\\textbf{\\textit{nested} formatting}";
        const result = manager.validateContent(latexWithNestedBraces, "latex");

        expect(result.isValid).toBe(true);
      });

      it("should handle multiple math expressions", () => {
        const latexWithMultipleMath =
          "First $x = y$ and second $a = b$ expressions";
        const result = manager.validateContent(latexWithMultipleMath, "latex");

        expect(result.isValid).toBe(true);
      });
    });

    describe("Content Length Validation", () => {
      it("should validate content within length limits", () => {
        const shortContent = "Short content";
        const result = manager.validateContent(shortContent, "html");

        expect(result.isValid).toBe(true);
      });

      it("should reject content exceeding length limits", () => {
        const longContent = "x".repeat(60000); // Exceeds HTML limit of 50000
        const result = manager.validateContent(longContent, "html");

        expect(result.isValid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining("exceeds maximum length"),
        );
      });

      it("should respect different length limits per content type", () => {
        const mediumContent = "x".repeat(15000);

        // Should pass for HTML (limit: 50000)
        const htmlResult = manager.validateContent(mediumContent, "html");
        expect(htmlResult.isValid).toBe(true);

        // Should fail for plaintext (limit: 10000)
        const plaintextResult = manager.validateContent(
          mediumContent,
          "plaintext",
        );
        expect(plaintextResult.isValid).toBe(false);
      });
    });
  });

  describe("Preview Generation", () => {
    it("should return HTML content as-is for preview", async () => {
      const htmlContent = "<p><strong>Bold</strong> content</p>";
      const preview = await manager.getPreviewHTML(htmlContent, "html");

      expect(preview).toBe(htmlContent);
    });

    it("should convert plaintext to HTML for preview", async () => {
      const plaintext = "Line 1\n\nLine 2";
      const preview = await manager.getPreviewHTML(plaintext, "plaintext");

      expect(preview).toBe("<p>Line 1</p><p>Line 2</p>");
    });

    it("should convert LaTeX to HTML with preview note", async () => {
      const latex = "\\textbf{Bold} text with $math$";
      const preview = await manager.getPreviewHTML(latex, "latex");

      expect(preview).toContain("LaTeX Preview (simplified)");
      expect(preview).toContain("<strong>Bold</strong>");
    });
  });

  describe("Configuration Access", () => {
    it("should provide access to content type configurations", () => {
      const htmlConfig = ContentTypeManager.getConfig("html");

      expect(htmlConfig.validation.allowedTags).toContain("p");
      expect(htmlConfig.validation.allowedTags).toContain("strong");
      expect(htmlConfig.validation.allowedAttributes?.["a"]).toContain("href");
    });

    it("should include editor configuration for each type", () => {
      const plaintextConfig = ContentTypeManager.getConfig("plaintext");

      expect(plaintextConfig.editorConfig.paste_as_text).toBe(true);
      expect(plaintextConfig.editorConfig.plugins).toEqual([
        "code",
        "searchreplace",
        "wordcount",
      ]);
    });

    it("should provide content styling for each type", () => {
      const latexConfig = ContentTypeManager.getConfig("latex");

      expect(latexConfig.editorConfig.content_style).toContain(
        "Computer Modern",
      );
      expect(latexConfig.editorConfig.content_style).toContain("latex-command");
    });
  });
});

describe("createContentTypeManager", () => {
  it("should create a new ContentTypeManager instance", () => {
    const manager = createContentTypeManager();

    expect(manager).toBeInstanceOf(ContentTypeManager);
    expect(manager.getCurrentType()).toBe("html");
  });
});
