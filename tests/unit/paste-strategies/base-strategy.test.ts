/**
 * Base Paste Strategy Tests
 * Tests for the base paste strategy class and utilities
 */

import {
  BasePasteStrategy,
  PasteUtils,
} from "../../../src/content/paste-strategies/base-strategy";
import type {
  PasteContent,
  PasteResult,
  PasteOptions,
} from "../../../src/content/paste-strategies/base-strategy";
import type { TargetSurface } from "../../../src/content/target-detector";

// Mock DOM methods
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockCreateTextNode = jest.fn();
const mockCreateRange = jest.fn();
const mockGetSelection = jest.fn();
const mockWriteText = jest.fn();
const mockWrite = jest.fn();
const mockExecCommand = jest.fn();

// Mock global objects
(global as any).document = {
  createElement: mockCreateElement,
  appendChild: mockAppendChild,
  removeChild: mockRemoveChild,
  createTextNode: mockCreateTextNode,
  createRange: mockCreateRange,
  body: { appendChild: mockAppendChild },
  execCommand: mockExecCommand,
};

(global as any).window = {
  getSelection: mockGetSelection,
};

(global as any).navigator = {
  clipboard: {
    writeText: mockWriteText,
    write: mockWrite,
  },
};

// Mock ClipboardEvent
(global as any).ClipboardEvent = class ClipboardEvent {
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  clipboardData: DataTransfer | null;

  constructor(type: string, eventInitDict?: any) {
    this.type = type;
    this.bubbles = eventInitDict?.bubbles || false;
    this.cancelable = eventInitDict?.cancelable || false;
    this.clipboardData = eventInitDict?.clipboardData || null;
  }
};

// Mock DataTransfer
(global as any).DataTransfer = class DataTransfer {
  private data: Map<string, string> = new Map();

  setData(format: string, data: string): void {
    this.data.set(format, data);
  }

  getData(format: string): string {
    return this.data.get(format) || "";
  }
};

// Mock ClipboardItem
(global as any).ClipboardItem = class ClipboardItem {
  private data: Record<string, Blob>;

  constructor(data: Record<string, Blob>) {
    this.data = data;
  }

  getType(type: string): Promise<Blob> {
    return Promise.resolve(this.data[type]);
  }
};

// Mock Blob
(global as any).Blob = class Blob {
  private content: string;
  type: string;

  constructor(content: string[], options?: { type?: string }) {
    this.content = content.join("");
    this.type = options?.type || "";
  }

  text(): Promise<string> {
    return Promise.resolve(this.content);
  }
};

// Test implementation of BasePasteStrategy
class TestPasteStrategy extends BasePasteStrategy {
  readonly name = "test-paste";
  readonly priority = 50;
  readonly supportedTargets = ["test-target"];

  canHandle(target: TargetSurface): boolean {
    return target.type === "test-target";
  }

  async transformContent(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteContent> {
    return content;
  }

  async executePaste(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteResult> {
    return this.createResult(true, "test", []);
  }

  getConfidence(target: TargetSurface): number {
    return this.canHandle(target) ? 0.8 : 0;
  }
}

describe("BasePasteStrategy", () => {
  let strategy: TestPasteStrategy;
  let mockTarget: TargetSurface;

  beforeEach(() => {
    strategy = new TestPasteStrategy();
    
    // Setup mock return values
    const mockDiv = { tagName: "DIV", style: {} };
    const mockTextarea = { 
      tagName: "TEXTAREA", 
      value: "", 
      style: { position: "", left: "", top: "", opacity: "" } 
    };
    
    mockCreateElement.mockImplementation((tag: string) => {
      if (tag === "textarea") {
        return mockTextarea;
      }
      return mockDiv;
    });

    mockTarget = {
      type: "test-target",
      element: mockDiv as any,
      context: {
        domain: "test.com",
        url: "https://test.com/page",
        pageTitle: "Test Page",
        isFramed: false,
      },
      capabilities: {
        supportsHTML: true,
        supportsMarkdown: false,
        supportsPlainText: true,
        supportsImages: false,
        supportsLinks: true,
        supportsFormatting: true,
        supportsLists: true,
        supportsTables: false,
      },
      metadata: {
        editorName: "test-editor",
        detectionConfidence: 0.9,
        detectionMethod: "test-rule",
      },
    };

    jest.clearAllMocks();
  });

  describe("Abstract Methods", () => {
    test("should have required abstract properties", () => {
      expect(strategy.name).toBe("test-paste");
      expect(strategy.priority).toBe(50);
      expect(strategy.supportedTargets).toEqual(["test-target"]);
    });

    test("should implement canHandle method", () => {
      expect(strategy.canHandle(mockTarget)).toBe(true);

      const unsupportedTarget = { ...mockTarget, type: "unsupported" as any };
      expect(strategy.canHandle(unsupportedTarget)).toBe(false);
    });

    test("should implement getConfidence method", () => {
      expect(strategy.getConfidence(mockTarget)).toBe(0.8);

      const unsupportedTarget = { ...mockTarget, type: "unsupported" as any };
      expect(strategy.getConfidence(unsupportedTarget)).toBe(0);
    });
  });

  describe("Utility Methods", () => {
    test("createResult should create proper result object", () => {
      const result = strategy.createResult(true, "test", ["transform1"]);
      expect(result).toEqual({
        success: true,
        method: "test",
        transformations: ["transform1"],
      });

      const errorResult = strategy.createResult(
        false,
        "test",
        [],
        "Error message",
      );
      expect(errorResult).toEqual({
        success: false,
        method: "test",
        transformations: [],
        error: "Error message",
      });
    });

    test("log should not throw errors", () => {
      expect(() => strategy.log("test message")).not.toThrow();
      expect(() =>
        strategy.log("test message", { data: "test" }),
      ).not.toThrow();
    });

    test("focusTarget should focus element", () => {
      const mockElement = document.createElement("input");
      const mockFocus = jest.fn();
      mockElement.focus = mockFocus;

      strategy.focusTarget(mockElement);
      expect(mockFocus).toHaveBeenCalled();
    });

    test("htmlToText should convert HTML to plain text", () => {
      const html = "<p>Hello <strong>world</strong>!</p>";
      const result = strategy.htmlToText(html);
      expect(result).toBe("Hello world!");
    });

    test("simulateTyping should simulate typing with delays", async () => {
      const mockElement = document.createElement("input");
      const mockDispatchEvent = jest.fn();
      mockElement.dispatchEvent = mockDispatchEvent;

      await strategy.simulateTyping("test", mockElement, 1);

      // Should dispatch keydown, keypress, and keyup events for each character
      expect(mockDispatchEvent).toHaveBeenCalledTimes(12); // 3 events * 4 characters
    });
  });

  describe("Content Transformation", () => {
    test("transformContent should be implemented by subclass", async () => {
      const content: PasteContent = {
        text: "test content",
        html: "<p>test content</p>",
        metadata: {
          originalFormat: "html",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.transformContent(content, mockTarget, {});
      expect(result).toEqual(content);
    });
  });

  describe("Paste Execution", () => {
    test("executePaste should be implemented by subclass", async () => {
      const content: PasteContent = {
        text: "test content",
        metadata: {
          originalFormat: "plaintext",
          transformations: [],
          timestamp: Date.now(),
        },
      };

      const result = await strategy.executePaste(content, mockTarget, {});
      expect(result.success).toBe(true);
      expect(result.method).toBe("test");
    });
  });
});

describe("PasteUtils", () => {
  beforeEach(() => {
    // Reset navigator mock to ensure clipboard API is available
    (global as any).navigator = {
      clipboard: {
        writeText: mockWriteText,
        write: mockWrite,
      },
    };
    
    jest.clearAllMocks();
  });

  describe("Clipboard Operations", () => {
    test("isClipboardApiAvailable should check for clipboard API", () => {
      // Override the navigator object for this test
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText,
          write: mockWrite,
        },
        writable: true,
        configurable: true,
      });
      
      expect(PasteUtils.isClipboardApiAvailable()).toBe(true);

      // Test when clipboard API is not available
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(PasteUtils.isClipboardApiAvailable()).toBe(false);
      
      // Restore for other tests
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText,
          write: mockWrite,
        },
        writable: true,
        configurable: true,
      });
    });

    test("writeToClipboard should write text and HTML to clipboard", async () => {
      // Set up clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText,
          write: mockWrite,
        },
        writable: true,
        configurable: true,
      });

      await PasteUtils.writeToClipboard("test text", "<p>test html</p>");

      expect(mockWrite).toHaveBeenCalled();
    });

    test("writeToClipboard should fallback to writeText when HTML fails", async () => {
      // Set up clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText,
          write: mockWrite,
        },
        writable: true,
        configurable: true,
      });
      
      mockWrite.mockRejectedValue(new Error("Write failed"));

      await PasteUtils.writeToClipboard("test text", "<p>test html</p>");

      expect(mockWriteText).toHaveBeenCalledWith("test text");
    });

    test("writeToClipboard should handle writeText failure", async () => {
      // Set up clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: mockWriteText,
          write: mockWrite,
        },
        writable: true,
        configurable: true,
      });
      
      mockWrite.mockRejectedValue(new Error("Write failed"));
      mockWriteText.mockRejectedValue(new Error("WriteText failed"));

      const result = await PasteUtils.writeToClipboard(
        "test text",
        "<p>test html</p>",
      );
      expect(result).toBe(false);
    });
  });

  describe("DOM Utilities", () => {
    test("createTempTextarea should create temporary textarea", () => {
      const mockTextarea = { 
        tagName: "TEXTAREA", 
        value: "", 
        style: { position: "", left: "", top: "", opacity: "" } 
      };
      mockCreateElement.mockReturnValue(mockTextarea);

      // Mock document.body.appendChild
      const originalAppendChild = document.body.appendChild;
      document.body.appendChild = jest.fn();

      // Mock document.createElement to use our mock
      const originalCreateElement = document.createElement;
      document.createElement = mockCreateElement;

      const result = PasteUtils.createTempTextarea("test content");

      expect(mockCreateElement).toHaveBeenCalledWith("textarea");
      expect(result.value).toBe("test content");
      expect(result.style.position).toBe("fixed");
      
      // Restore original
      document.createElement = originalCreateElement;
      document.body.appendChild = originalAppendChild;
    });

    test("removeTempElement should remove element from DOM", () => {
      const mockRemoveChild = jest.fn();
      const mockParent = { removeChild: mockRemoveChild };
      const mockElement = { parentNode: mockParent };

      PasteUtils.removeTempElement(mockElement as any);
      expect(mockRemoveChild).toHaveBeenCalledWith(mockElement);
    });

    test("triggerPasteEvent should dispatch paste event", () => {
      const mockElement = document.createElement("div");
      const mockDispatchEvent = jest.fn();
      mockElement.dispatchEvent = mockDispatchEvent;

      PasteUtils.triggerPasteEvent(mockElement, "text", "html");

      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "paste",
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    test("textToHtml should convert text to HTML", () => {
      const result = PasteUtils.textToHtml("Line 1\nLine 2\n\nLine 3");
      expect(result).toBe("<p>Line 1<br>Line 2</p><p>Line 3</p>");
    });

    test("textToHtml should handle empty text", () => {
      const result = PasteUtils.textToHtml("");
      expect(result).toBe("");
    });

    test("textToHtml should escape HTML entities", () => {
      const result = PasteUtils.textToHtml('<script>alert("test")</script>');
      expect(result).toBe('<p>&lt;script&gt;alert("test")&lt;/script&gt;</p>');
    });
  });
});
