/**
 * Gmail Paste Strategy Tests
 * Tests for Gmail composer paste strategy
 */

import { GmailPasteStrategy } from "../../../src/content/paste-strategies/gmail-strategy";
import type {
  PasteContent,
  PasteOptions,
} from "../../../src/content/paste-strategies/base-strategy";
import type { TargetSurface } from "../../../src/content/target-detector";

// Mock DOM methods
const mockDispatchEvent = jest.fn();
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockQuerySelectorAll = jest.fn();
const mockGetSelection = jest.fn();
const mockCreateRange = jest.fn();
const mockGetRangeAt = jest.fn();
const mockInsertNode = jest.fn();
const mockDeleteContents = jest.fn();
const mockSetStart = jest.fn();
const mockSetEnd = jest.fn();

// Mock global objects
(global as any).document = {
  createElement: mockCreateElement,
  appendChild: mockAppendChild,
  removeChild: mockRemoveChild,
  body: { appendChild: mockAppendChild, removeChild: mockRemoveChild },
  createRange: mockCreateRange,
  execCommand: jest.fn(),
};

(global as any).window = {
  getSelection: mockGetSelection,
  location: {
    hostname: "mail.google.com",
  },
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

describe("GmailPasteStrategy", () => {
  let strategy: GmailPasteStrategy;
  let mockGmailTarget: TargetSurface;
  let mockUnsupportedTarget: TargetSurface;

  beforeEach(() => {
    strategy = new GmailPasteStrategy();

    // Mock Gmail target
    mockGmailTarget = {
      type: "gmail-composer",
      element: {
        tagName: "DIV",
        contentEditable: "true",
        getAttribute: jest.fn().mockReturnValue("true"),
        dispatchEvent: mockDispatchEvent,
        focus: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: mockQuerySelectorAll,
        innerHTML: "",
      } as any,
      context: {
        domain: "mail.google.com",
        url: "https://mail.google.com/compose",
        pageTitle: "Gmail",
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
        editorName: "Gmail Composer",
        detectionConfidence: 0.95,
        detectionMethod: "gmail-composer-rule",
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
      setStart: mockSetStart,
      setEnd: mockSetEnd,
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

    jest.clearAllMocks();
  });

  describe("Strategy Properties", () => {
    test("should have correct strategy properties", () => {
      expect(strategy.name).toBe("gmail-paste");
      expect(strategy.priority).toBe(95);
      expect(strategy.supportedTargets).toEqual(["gmail-composer"]);
    });
  });

  describe("canHandle", () => {
    test("should handle Gmail composer", () => {
      expect(strategy.canHandle(mockGmailTarget)).toBe(true);
    });

    test("should handle contenteditable on mail.google.com", () => {
      const genericTarget = {
        ...mockGmailTarget,
        type: "contenteditable" as any,
      };

      expect(strategy.canHandle(genericTarget)).toBe(true);
    });

    test("should not handle non-Gmail targets", () => {
      expect(strategy.canHandle(mockUnsupportedTarget)).toBe(false);
    });

    test("should not handle contenteditable on non-Gmail sites", () => {
      const nonGmailTarget = {
        ...mockGmailTarget,
        type: "contenteditable" as any,
        context: {
          ...mockGmailTarget.context,
          domain: "test.com",
        },
      };

      // Update window.location for this test
      (window.location as any).hostname = "test.com";

      expect(strategy.canHandle(nonGmailTarget)).toBe(false);

      // Reset for other tests
      (window.location as any).hostname = "mail.google.com";
    });
  });

  describe("getConfidence", () => {
    test("should return very high confidence for Gmail composer", () => {
      expect(strategy.getConfidence(mockGmailTarget)).toBe(0.98);
    });

    test("should return high confidence for Gmail detection", () => {
      const genericTarget = {
        ...mockGmailTarget,
        type: "contenteditable" as any,
      };

      expect(strategy.getConfidence(genericTarget)).toBe(0.9);
    });

    test("should return zero confidence for unsupported targets", () => {
      expect(strategy.getConfidence(mockUnsupportedTarget)).toBe(0);
    });
  });

  describe("transformContent", () => {
    test("should convert text to Gmail HTML", async () => {
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
        mockGmailTarget,
        {},
      );

      expect(result.html).toBe("<p>Hello<br>World</p><p>Test</p>");
      expect(result.metadata?.transformations).toContain("text-to-html");
    });

    test("should optimize HTML for Gmail", async () => {
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
        mockGmailTarget,
        {},
      );

      expect(result.html).toBeDefined();
      expect(result.metadata?.transformations).toContain("gmail-optimization");
      expect(result.metadata?.transformations).toContain("gmail-styling");
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
        mockGmailTarget,
        {},
      );

      expect(result.text).toBe("Hello world!");
      expect(result.metadata?.transformations).toContain("html-to-text");
    });
  });

  describe("executePaste", () => {
    test("should execute Gmail-specific paste", async () => {
      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.executePaste(content, mockGmailTarget, {});

      expect(result.success).toBe(true);
      expect(mockGmailTarget.element.focus).toHaveBeenCalled();
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
      mockGmailTarget.element.focus = jest.fn().mockImplementation(() => {
        throw new Error("Focus error");
      });

      const result = await strategy.executePaste(content, mockGmailTarget, {});

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
        mockGmailTarget,
        {},
      );

      // Should convert divs to paragraphs
      expect(result.html).toContain("<p>");
      expect(result.html).not.toContain("<div>");
    });

    test("should optimize lists for Gmail", async () => {
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
        mockGmailTarget,
        {},
      );

      expect(result.html).toBeDefined();
      expect(result.metadata?.transformations).toContain("gmail-optimization");
    });

    test("should remove unsupported elements", async () => {
      const content: PasteContent = {
        html: '<p>Safe content</p><script>alert("bad")</script><style>body{color:red}</style>',
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      mockQuerySelectorAll.mockImplementation((selector) => {
        if (
          selector ===
          "script, style, meta, link, object, embed, iframe, form, input, button, select, textarea"
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
        mockGmailTarget,
        {},
      );

      expect(result.html).toBeDefined();
      expect(result.metadata?.transformations).toContain("gmail-optimization");
    });
  });

  describe("Line Break Optimization", () => {
    test("should convert multiple br tags to paragraph breaks", async () => {
      const content: PasteContent = {
        html: "<p>Line 1<br><br>Line 2</p>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockGmailTarget,
        {},
      );

      expect(result.html).toBeDefined();
      expect(result.metadata?.transformations).toContain("gmail-optimization");
    });
  });

  describe("Clipboard Operations", () => {
    test("should write to clipboard with HTML and text", async () => {
      const mockWrite = jest.fn().mockResolvedValue(undefined);
      (navigator.clipboard as any).write = mockWrite;

      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      await strategy.executePaste(content, mockGmailTarget, {});

      // Should attempt to write to clipboard
      expect(navigator.clipboard.write).toHaveBeenCalled();
    });

    test("should fallback to writeText when write fails", async () => {
      const mockWrite = jest.fn().mockRejectedValue(new Error("Write failed"));
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      (navigator.clipboard as any).write = mockWrite;
      (navigator.clipboard as any).writeText = mockWriteText;

      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      await strategy.executePaste(content, mockGmailTarget, {});

      expect(mockWriteText).toHaveBeenCalledWith("Test content");
    });
  });

  describe("Event Triggering", () => {
    test("should trigger Gmail-specific events", async () => {
      const content: PasteContent = {
        html: "<p>Test content</p>",
        text: "Test content",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      await strategy.executePaste(content, mockGmailTarget, {});

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
  });

  describe("Error Handling", () => {
    test("should handle clipboard API not available", async () => {
      // Mock clipboard API not available
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

      const result = await strategy.executePaste(content, mockGmailTarget, {});

      // Should still succeed with fallback methods
      expect(result.success).toBe(true);

      // Restore clipboard
      (navigator as any).clipboard = originalClipboard;
    });
  });
});
