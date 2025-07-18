/**
 * Google Docs Paste Strategy Tests
 * Tests for Google Docs paste strategy
 */

import { GoogleDocsPasteStrategy } from "../../../src/content/paste-strategies/google-docs-strategy";
import type {
  PasteContent,
  PasteOptions,
} from "../../../src/content/paste-strategies/base-strategy";
import type { TargetSurface } from "../../../src/content/target-detector";

// Mock DOM methods
const mockDispatchEvent = jest.fn();
const mockCreateElement = jest.fn();
const mockQuerySelectorAll = jest.fn();
const mockClosest = jest.fn();
const mockGetSelection = jest.fn();
const mockCreateRange = jest.fn();
const mockGetRangeAt = jest.fn();
const mockInsertNode = jest.fn();
const mockDeleteContents = jest.fn();

// Mock global objects
(global as any).document = {
  createElement: mockCreateElement,
  appendChild: jest.fn(),
  removeChild: jest.fn(),
  body: { appendChild: jest.fn(), removeChild: jest.fn() },
  createRange: mockCreateRange,
  execCommand: jest.fn(),
};

(global as any).window = {
  getSelection: mockGetSelection,
  location: {
    hostname: "docs.google.com",
    pathname: "/document/d/123/edit",
  },
  docs: undefined,
  _docs_chrome_extension_api: undefined,
};

(global as any).navigator = {
  clipboard: {
    writeText: jest.fn(),
    write: jest.fn(),
  },
};

(global as any).DataTransfer = jest.fn(() => ({
  setData: jest.fn(),
}));

(global as any).ClipboardEvent = jest.fn();

(global as any).CustomEvent = jest.fn();

describe("GoogleDocsPasteStrategy", () => {
  let strategy: GoogleDocsPasteStrategy;
  let mockGoogleDocsTarget: TargetSurface;
  let mockUnsupportedTarget: TargetSurface;

  beforeEach(() => {
    strategy = new GoogleDocsPasteStrategy();

    // Mock Google Docs target
    mockGoogleDocsTarget = {
      type: "google-docs-editor",
      element: {
        tagName: "DIV",
        classList: {
          contains: jest.fn().mockReturnValue(false),
        },
        closest: mockClosest,
        dispatchEvent: mockDispatchEvent,
        focus: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: mockQuerySelectorAll,
        innerHTML: "",
        ownerDocument: {
          getSelection: mockGetSelection,
        },
      } as any,
      context: {
        domain: "docs.google.com",
        url: "https://docs.google.com/document/d/123/edit",
        pageTitle: "Google Docs",
        isFramed: false,
      },
      capabilities: {
        supportsHTML: true,
        supportsMarkdown: false,
        supportsPlainText: true,
        supportsImages: true,
        supportsLinks: true,
        supportsFormatting: true,
        supportsLists: true,
        supportsTables: true,
        customPasteHandler: true,
      },
      metadata: {
        editorName: "Google Docs",
        detectionConfidence: 0.96,
        detectionMethod: "google-docs-editor-rule",
      },
    };

    // Mock unsupported target
    mockUnsupportedTarget = {
      type: "plaintext-input",
      element: {} as any,
      context: {
        domain: "test.com",
        url: "https://test.com/page",
        pageTitle: "Test Page",
        isFramed: false,
      },
      capabilities: {
        supportsHTML: false,
        supportsMarkdown: false,
        supportsPlainText: true,
        supportsImages: false,
        supportsLinks: false,
        supportsFormatting: false,
        supportsLists: false,
        supportsTables: false,
      },
      metadata: {
        editorName: "Text Input",
        detectionConfidence: 0.9,
        detectionMethod: "text-input-rule",
      },
    };

    // Mock selection and range
    const mockRange = {
      deleteContents: mockDeleteContents,
      insertNode: mockInsertNode,
      collapse: jest.fn(),
      setStartAfter: jest.fn(),
      setEndAfter: jest.fn(),
    };

    mockGetRangeAt.mockReturnValue(mockRange);
    mockCreateRange.mockReturnValue(mockRange);
    mockGetSelection.mockReturnValue({
      getRangeAt: mockGetRangeAt,
      rangeCount: 1,
      removeAllRanges: jest.fn(),
      addRange: jest.fn(),
    });

    mockQuerySelectorAll.mockReturnValue([]);
    mockCreateElement.mockReturnValue({
      innerHTML: "",
      style: {},
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelectorAll: mockQuerySelectorAll,
      firstChild: null,
    });

    mockClosest.mockReturnValue({}); // Mock element found

    jest.clearAllMocks();
  });

  describe("Strategy Properties", () => {
    test("should have correct strategy properties", () => {
      expect(strategy.name).toBe("google-docs-paste");
      expect(strategy.priority).toBe(96);
      expect(strategy.supportedTargets).toEqual(["google-docs-editor"]);
    });
  });

  describe("canHandle", () => {
    test("should handle Google Docs editor", () => {
      expect(strategy.canHandle(mockGoogleDocsTarget)).toBe(true);
    });

    test("should handle elements on Google Docs page", () => {
      const genericTarget = {
        ...mockGoogleDocsTarget,
        type: "contenteditable" as any,
      };

      expect(strategy.canHandle(genericTarget)).toBe(true);
    });

    test("should not handle non-Google Docs targets", () => {
      expect(strategy.canHandle(mockUnsupportedTarget)).toBe(false);
    });

    test("should not handle elements on non-Google Docs pages", () => {
      const nonDocsTarget = {
        ...mockGoogleDocsTarget,
        type: "contenteditable" as any,
      };

      // Update window.location for this test
      (window.location as any).hostname = "test.com";

      expect(strategy.canHandle(nonDocsTarget)).toBe(false);

      // Reset for other tests
      (window.location as any).hostname = "docs.google.com";
    });
  });

  describe("getConfidence", () => {
    test("should return very high confidence for Google Docs editor", () => {
      expect(strategy.getConfidence(mockGoogleDocsTarget)).toBe(0.96);
    });

    test("should return high confidence for Google Docs page detection", () => {
      const genericTarget = {
        ...mockGoogleDocsTarget,
        type: "contenteditable" as any,
      };

      expect(strategy.getConfidence(genericTarget)).toBe(0.92);
    });

    test("should return lower confidence for element detection", () => {
      const genericTarget = {
        ...mockGoogleDocsTarget,
        type: "contenteditable" as any,
      };

      // Mock non-Google Docs page but with Google Docs element
      (window.location as any).hostname = "test.com";

      expect(strategy.getConfidence(genericTarget)).toBe(0.85);

      // Reset
      (window.location as any).hostname = "docs.google.com";
    });

    test("should return zero confidence for unsupported targets", () => {
      expect(strategy.getConfidence(mockUnsupportedTarget)).toBe(0);
    });
  });

  describe("transformContent", () => {
    test("should convert text to Google Docs HTML", async () => {
      const content: PasteContent = {
        text: "Hello\nWorld\n\nTest",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.html).toBe("<p>Hello<br>World</p><p>Test</p>");
      expect(result.metadata?.transformations).toContain("text-to-html");
    });

    test("should optimize HTML for Google Docs", async () => {
      const content: PasteContent = {
        html: "<div>Test content</div><ul><li>Item 1</li><li>Item 2</li></ul>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.html).toBeDefined();
      expect(result.metadata?.transformations).toContain(
        "google-docs-optimization",
      );
      expect(result.metadata?.transformations).toContain("google-docs-styling");
    });

    test("should generate text version from HTML", async () => {
      const content: PasteContent = {
        html: "<p>Hello <strong>world</strong>!</p>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.text).toBe("Hello world!");
      expect(result.metadata?.transformations).toContain("html-to-text");
    });
  });

  describe("executePaste", () => {
    test("should execute Google Docs-specific paste", async () => {
      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.executePaste(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.success).toBe(true);
      expect(mockGoogleDocsTarget.element.focus).toHaveBeenCalled();
    });

    test("should handle paste errors gracefully", async () => {
      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      // Mock error in focus
      mockGoogleDocsTarget.element.focus = jest.fn().mockImplementation(() => {
        throw new Error("Focus error");
      });

      const result = await strategy.executePaste(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Focus error");
    });
  });

  describe("HTML Optimization", () => {
    test("should convert divs to paragraphs", async () => {
      const content: PasteContent = {
        html: "<div>Simple text</div><div>Another paragraph</div>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockGoogleDocsTarget,
        {},
      );

      // Should convert divs to paragraphs
      expect(result.html).toContain("<p>");
      expect(result.html).not.toContain("<div>");
    });

    test("should optimize lists for Google Docs", async () => {
      const content: PasteContent = {
        html: "<ul><li>Item 1</li><li>Item 2</li></ul>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      mockQuerySelectorAll.mockImplementation((selector) => {
        if (selector === "ul, ol") {
          return [
            {
              style: {},
              querySelectorAll: jest
                .fn()
                .mockReturnValue([{ style: {} }, { style: {} }]),
            },
          ];
        }
        return [];
      });

      const result = await strategy.transformContent(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.html).toBeDefined();
      expect(result.metadata?.transformations).toContain(
        "google-docs-optimization",
      );
    });

    test("should remove unsupported elements", async () => {
      const content: PasteContent = {
        html: '<p>Safe content</p><script>alert("bad")</script><canvas>Canvas</canvas>',
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      mockQuerySelectorAll.mockImplementation((selector) => {
        if (
          selector ===
          "script, style, meta, link, object, embed, iframe, form, input, button, select, textarea, canvas, svg"
        ) {
          return [{ remove: jest.fn() }, { remove: jest.fn() }];
        }
        if (selector === "*") {
          return [{ removeAttribute: jest.fn() }];
        }
        return [];
      });

      const result = await strategy.transformContent(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.html).toBeDefined();
      expect(result.metadata?.transformations).toContain(
        "google-docs-optimization",
      );
    });
  });

  describe("Google Docs API Integration", () => {
    test("should attempt to use Google Docs API when available", async () => {
      const mockEditor = {
        insertContent: jest.fn(),
      };

      (window as any).docs = {
        editor: mockEditor,
      };

      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.executePaste(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.success).toBe(true);
      expect(mockEditor.insertContent).toHaveBeenCalledWith(
        "<p>Test content</p>",
      );

      // Clean up
      (window as any).docs = undefined;
    });

    test("should fallback when Google Docs API is not available", async () => {
      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.executePaste(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.success).toBe(true);
      // Should fall back to contenteditable methods
    });
  });

  describe("Font and Styling", () => {
    test("should apply Google Docs-specific font styling", async () => {
      const content: PasteContent = {
        html: "<p>Test content</p>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.html).toContain('font-family: "Google Sans"');
      expect(result.html).toContain("font-size: 11pt");
    });

    test("should convert font sizes to points", async () => {
      const content: PasteContent = {
        html: '<p style="font-size: 14px;">Test content</p>',
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      mockQuerySelectorAll.mockImplementation((selector) => {
        if (selector === "[style]") {
          return [
            {
              getAttribute: jest.fn().mockReturnValue("font-size: 14px;"),
              setAttribute: jest.fn(),
            },
          ];
        }
        return [];
      });

      const result = await strategy.transformContent(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.html).toBeDefined();
      expect(result.metadata?.transformations).toContain(
        "google-docs-optimization",
      );
    });
  });

  describe("Event Triggering", () => {
    test("should trigger Google Docs-specific events", async () => {
      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      await strategy.executePaste(content, mockGoogleDocsTarget, {});

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "input",
        }),
      );
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "change",
        }),
      );
    });

    test("should trigger custom Google Docs events", async () => {
      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      await strategy.executePaste(content, mockGoogleDocsTarget, {});

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "docs-paste",
        }),
      );
    });
  });

  describe("Page Detection", () => {
    test("should detect Google Docs pages correctly", async () => {
      expect(strategy.canHandle(mockGoogleDocsTarget)).toBe(true);
    });

    test("should not detect non-document Google pages", async () => {
      (window.location as any).pathname = "/spreadsheets/d/123/edit";

      const target = {
        ...mockGoogleDocsTarget,
        type: "contenteditable" as any,
      };

      expect(strategy.canHandle(target)).toBe(false);

      // Reset
      (window.location as any).pathname = "/document/d/123/edit";
    });
  });

  describe("Error Handling", () => {
    test("should handle clipboard API not available", async () => {
      const originalClipboard = navigator.clipboard;
      (navigator as any).clipboard = undefined;

      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.executePaste(
        content,
        mockGoogleDocsTarget,
        {},
      );

      expect(result.success).toBe(true);

      // Restore clipboard
      (navigator as any).clipboard = originalClipboard;
    });
  });
});
