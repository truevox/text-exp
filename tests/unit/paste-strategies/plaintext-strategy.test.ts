/**
 * Plaintext Paste Strategy Tests
 * Tests for plaintext field paste strategy
 */

import { PlaintextPasteStrategy } from "../../../src/content/paste-strategies/plaintext-strategy";
import type {
  PasteContent,
  PasteOptions,
} from "../../../src/content/paste-strategies/base-strategy";
import type { TargetSurface } from "../../../src/content/target-detector";

// Mock DOM methods
const mockDispatchEvent = jest.fn();
const mockSetSelectionRange = jest.fn();
const mockFocus = jest.fn();
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();

// Mock global objects
(global as any).document = {
  createElement: mockCreateElement,
  appendChild: mockAppendChild,
  removeChild: mockRemoveChild,
  body: { appendChild: mockAppendChild, removeChild: mockRemoveChild },
};

describe("PlaintextPasteStrategy", () => {
  let strategy: PlaintextPasteStrategy;
  let mockInputTarget: TargetSurface;
  let mockTextareaTarget: TargetSurface;
  let mockUnsupportedTarget: TargetSurface;

  beforeEach(() => {
    strategy = new PlaintextPasteStrategy();

    // Mock input target
    mockInputTarget = {
      type: "plaintext-input",
      element: {
        tagName: "INPUT",
        type: "text",
        value: "existing text",
        selectionStart: 5,
        selectionEnd: 5,
        dispatchEvent: mockDispatchEvent,
        setSelectionRange: mockSetSelectionRange,
        focus: mockFocus,
      } as any,
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
        detectionConfidence: 0.95,
        detectionMethod: "text-input-rule",
        timestamp: Date.now(),
      },
    };

    // Mock textarea target
    mockTextareaTarget = {
      ...mockInputTarget,
      type: "plaintext-textarea",
      element: {
        tagName: "TEXTAREA",
        value: "existing text",
        selectionStart: 5,
        selectionEnd: 5,
        dispatchEvent: mockDispatchEvent,
        setSelectionRange: mockSetSelectionRange,
        focus: mockFocus,
      } as any,
      metadata: {
        editorName: "Textarea",
        detectionConfidence: 0.9,
        detectionMethod: "textarea-rule",
        timestamp: Date.now(),
      },
    };

    // Mock unsupported target
    mockUnsupportedTarget = {
      type: "tinymce-editor",
      element: {} as any,
      context: mockInputTarget.context,
      capabilities: {
        supportsHTML: true,
        supportsMarkdown: false,
        supportsPlainText: true,
        supportsImages: true,
        supportsLinks: true,
        supportsFormatting: true,
        supportsLists: true,
        supportsTables: true,
      },
      metadata: {
        editorName: "TinyMCE",
        detectionConfidence: 0.9,
        detectionMethod: "tinymce-rule",
        timestamp: Date.now(),
      },
    };

    jest.clearAllMocks();
  });

  describe("Strategy Properties", () => {
    test("should have correct strategy properties", () => {
      expect(strategy.name).toBe("plaintext-paste");
      expect(strategy.priority).toBe(70);
      expect(strategy.supportedTargets).toEqual([
        "plaintext-input",
        "plaintext-textarea",
      ]);
    });
  });

  describe("canHandle", () => {
    test("should handle plaintext input", () => {
      expect(strategy.canHandle(mockInputTarget)).toBe(true);
    });

    test("should handle plaintext textarea", () => {
      expect(strategy.canHandle(mockTextareaTarget)).toBe(true);
    });

    test("should not handle unsupported targets", () => {
      expect(strategy.canHandle(mockUnsupportedTarget)).toBe(false);
    });
  });

  describe("getConfidence", () => {
    test("should return high confidence for native inputs", () => {
      expect(strategy.getConfidence(mockInputTarget)).toBe(0.95);
    });

    test("should return high confidence for textarea", () => {
      expect(strategy.getConfidence(mockTextareaTarget)).toBe(0.95);
    });

    test("should return zero confidence for unsupported targets", () => {
      expect(strategy.getConfidence(mockUnsupportedTarget)).toBe(0);
    });
  });

  describe("transformContent", () => {
    test("should strip HTML from content", async () => {
      const content: PasteContent = {
        html: "<p>Hello <strong>world</strong>!</p>",
        text: "Hello world!",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockInputTarget,
        {},
      );

      expect(result.text).toBe("Hello **world**!");
      expect(result.html).toBeUndefined();
      expect(result.metadata?.transformations).toContain("html-to-text");
    });

    test("should convert HTML to AsciiDoc when enabled", async () => {
      const content: PasteContent = {
        html: "<p>Hello <strong>world</strong>!</p>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const options: PasteOptions = {
        convertToMarkdown: true,
      };

      const result = await strategy.transformContent(
        content,
        mockInputTarget,
        options,
      );

      expect(result.text).toBe("Hello *world*!");
      expect(result.metadata?.transformations).toContain("html-to-asciidoc");
    });

    test("should apply length limits", async () => {
      const longText = "a".repeat(1000);
      const content: PasteContent = {
        text: longText,
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const targetWithLimit = {
        ...mockInputTarget,
        capabilities: {
          ...mockInputTarget.capabilities,
          maxLength: 100,
        },
      };

      const result = await strategy.transformContent(
        content,
        targetWithLimit,
        {},
      );

      expect(result.text?.length).toBe(100);
      expect(result.metadata?.transformations).toContain("truncated-to-100");
    });

    test("should clean text content", async () => {
      const content: PasteContent = {
        text: "Hello\r\nworld\r\n\r\n\r\ntest",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockInputTarget,
        {},
      );

      expect(result.text).toBe("Hello\nworld\ntest");
      expect(result.metadata?.transformations).toContain("text-passthrough");
    });
  });

  describe("executePaste", () => {
    test("should paste into input field", async () => {
      const content: PasteContent = {
        text: "pasted text",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.executePaste(content, mockInputTarget, {});

      expect(result.success).toBe(true);
      expect(result.method).toBe("direct");
      expect((mockInputTarget.element as any).value).toBe("existpasted texting text");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(16, 16);
    });

    test("should paste into textarea", async () => {
      const content: PasteContent = {
        text: "pasted text",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.executePaste(
        content,
        mockTextareaTarget,
        {},
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe("direct");
      expect((mockTextareaTarget.element as any).value).toBe("existpasted texting text");
    });

    test("should handle paste errors", async () => {
      const content: PasteContent = {
        text: "pasted text",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      // Mock error in setSelectionRange
      mockSetSelectionRange.mockImplementation(() => {
        throw new Error("Selection error");
      });

      const result = await strategy.executePaste(content, mockInputTarget, {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Selection error");
    });

    test("should trigger input events", async () => {
      // Ensure mocks don't throw errors for this test
      mockSetSelectionRange.mockClear();
      mockSetSelectionRange.mockImplementation(() => {});
      mockFocus.mockImplementation(() => {});

      const content: PasteContent = {
        text: "pasted text",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      await strategy.executePaste(content, mockInputTarget, {});

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "input",
          bubbles: true,
        }),
      );
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "change",
          bubbles: true,
        }),
      );
    });

    test("should handle cursor positioning", async () => {
      const content: PasteContent = {
        text: "test",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const targetWithSelection = {
        ...mockInputTarget,
        element: {
          ...mockInputTarget.element,
          selectionStart: 2,
          selectionEnd: 4,
        },
      };

      await strategy.executePaste(content, targetWithSelection, {});

      // Should replace selection and position cursor after inserted text
      expect(mockSetSelectionRange).toHaveBeenCalledWith(13, 13);
    });
  });

  describe("HTML to AsciiDoc Conversion", () => {
    test("should convert basic HTML elements", async () => {
      const content: PasteContent = {
        html: "<p>Regular text</p><p><strong>Bold</strong> and <em>italic</em></p>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const options: PasteOptions = {
        convertToMarkdown: true,
      };

      const result = await strategy.transformContent(
        content,
        mockInputTarget,
        options,
      );

      expect(result.text).toContain("*Bold*");
      expect(result.text).toContain("_italic_");
    });

    test("should convert lists", async () => {
      const content: PasteContent = {
        html: "<ul><li>Item 1</li><li>Item 2</li></ul>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const options: PasteOptions = {
        convertToMarkdown: true,
      };

      const result = await strategy.transformContent(
        content,
        mockInputTarget,
        options,
      );

      expect(result.text).toContain("* Item 1");
      expect(result.text).toContain("* Item 2");
    });

    test("should convert links", async () => {
      const content: PasteContent = {
        html: '<a href="https://example.com">Link text</a>',
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const options: PasteOptions = {
        convertToMarkdown: true,
      };

      const result = await strategy.transformContent(
        content,
        mockInputTarget,
        options,
      );

      expect(result.text).toBe("link:https://example.com[Link text]");
    });
  });

  describe("Text Cleaning", () => {
    test("should normalize line endings", async () => {
      const content: PasteContent = {
        text: "Line 1\r\nLine 2\rLine 3\n",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockInputTarget,
        {},
      );

      expect(result.text).toBe("Line 1\nLine 2\nLine 3");
    });

    test("should convert tabs to spaces", async () => {
      const content: PasteContent = {
        text: "Text\twith\ttabs",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockInputTarget,
        {},
      );

      expect(result.text).toBe("Text    with    tabs");
    });

    test("should limit consecutive newlines", async () => {
      const content: PasteContent = {
        text: "Line 1\n\n\n\n\nLine 2",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(
        content,
        mockInputTarget,
        {},
      );

      expect(result.text).toBe("Line 1\nLine 2");
    });
  });
});
