/**
 * Unit tests for text replacement system
 * Following TDD approach - tests written first to define expected behavior
 */

import { TextReplacer } from "../../src/content/text-replacer";
import { ImageProcessor } from "../../src/background/image-processor";
import { ReplacementContext } from "../../src/shared/types";
import { isContentEditable } from "../../src/content/utils/dom-utils";

// Mock DOM methods for testing
const mockSetSelectionRange = jest.fn();
const mockFocus = jest.fn();
const mockDispatchEvent = jest.fn();

describe("TextReplacer", () => {
  let replacer: TextReplacer;
  let mockInput: HTMLInputElement;
  let mockTextarea: HTMLTextAreaElement;
  let mockContentEditable: HTMLDivElement;
  let mockRange: Range;

  beforeEach(() => {
    const mockImageProcessor = new ImageProcessor();
    replacer = new TextReplacer(mockImageProcessor);

    // Mock Range
    mockRange = {
      deleteContents: jest.fn(),
      insertNode: jest.fn(),
      setStart: jest.fn(),
      setEnd: jest.fn(),
      setStartAfter: jest.fn(),
      setEndAfter: jest.fn(),
      cloneRange: jest.fn(() => mockRange),
      selectNodeContents: jest.fn(),
    } as unknown as Range;

    // Mock HTML input element
    mockInput = {
      tagName: "INPUT",
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      setSelectionRange: mockSetSelectionRange,
      focus: mockFocus,
      dispatchEvent: mockDispatchEvent,
    } as unknown as HTMLInputElement;

    // Mock HTML textarea element
    mockTextarea = {
      tagName: "TEXTAREA",
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      setSelectionRange: mockSetSelectionRange,
      focus: mockFocus,
      dispatchEvent: mockDispatchEvent,
    } as unknown as HTMLTextAreaElement;

    // Mock contenteditable div
    mockContentEditable = {
      tagName: "DIV",
      contentEditable: "true",
      textContent: "",
      dispatchEvent: mockDispatchEvent,
    } as unknown as HTMLDivElement;

    // Mock window.getSelection
    global.window.getSelection = jest.fn();
    global.document.createRange = jest.fn(() => mockRange);
    global.document.createTextNode = jest.fn(
      (text) => ({ textContent: text }) as any,
    );

    // Mock document.activeElement
    Object.defineProperty(document, "activeElement", {
      writable: true,
      value: null,
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("Form Input Replacement", () => {
    test("should replace text in input element", () => {
      mockInput.value = "Hello ;gb world";
      const context: ReplacementContext = {
        element: mockInput,
        startOffset: 6,
        endOffset: 9,
        trigger: ";gb",
        snippet: null as any,
      };

      replacer.replaceText(context, "Goodbye!");

      expect(mockInput.value).toBe("Hello Goodbye! world");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(14, 14); // Cursor after "Goodbye!"
      expect(mockFocus).toHaveBeenCalled();
      expect(mockDispatchEvent).toHaveBeenCalled();
    });

    test("should replace text in textarea element", () => {
      mockTextarea.value = "Start ;email end";
      const context: ReplacementContext = {
        element: mockTextarea,
        startOffset: 6,
        endOffset: 12,
        trigger: ";email",
        snippet: null as any,
      };

      replacer.replaceText(context, "user@example.com");

      expect(mockTextarea.value).toBe("Start user@example.com end");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(22, 22); // Cursor after email
      expect(mockFocus).toHaveBeenCalled();
    });

    test("should handle replacement at beginning of input", () => {
      mockInput.value = ";gb rest of text";
      const context: ReplacementContext = {
        element: mockInput,
        startOffset: 0,
        endOffset: 3,
        trigger: ";gb",
        snippet: null as any,
      };

      replacer.replaceText(context, "Hello");

      expect(mockInput.value).toBe("Hello rest of text");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(5, 5);
    });

    test("should handle replacement at end of input", () => {
      mockInput.value = "text ends with ;gb";
      const context: ReplacementContext = {
        element: mockInput,
        startOffset: 15,
        endOffset: 18,
        trigger: ";gb",
        snippet: null as any,
      };

      replacer.replaceText(context, "Goodbye");

      expect(mockInput.value).toBe("text ends with Goodbye");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(22, 22);
    });

    test("should handle empty input replacement", () => {
      mockInput.value = ";gb";
      const context: ReplacementContext = {
        element: mockInput,
        startOffset: 0,
        endOffset: 3,
        trigger: ";gb",
        snippet: null as any,
      };

      replacer.replaceText(context, "Hello World!");

      expect(mockInput.value).toBe("Hello World!");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(12, 12);
    });

    test("should trigger input and change events", () => {
      mockInput.value = ";gb";
      const context: ReplacementContext = {
        element: mockInput,
        startOffset: 0,
        endOffset: 3,
        trigger: ";gb",
        snippet: null as any,
      };

      replacer.replaceText(context, "Hello");

      // Should dispatch both input and change events for form inputs
      expect(mockDispatchEvent).toHaveBeenCalledTimes(2);
      const calls = mockDispatchEvent.mock.calls;
      expect(calls[0][0].type).toBe("input");
      expect(calls[1][0].type).toBe("change");
    });
  });

  describe("ContentEditable Replacement", () => {
    let mockSelection: Selection;

    beforeEach(() => {
      mockSelection = {
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
        rangeCount: 1,
        getRangeAt: jest.fn(() => mockRange),
        toString: jest.fn(() => "selected text"),
      } as unknown as Selection;

      (global.window.getSelection as jest.Mock).mockReturnValue(mockSelection);
      global.document.createTreeWalker = jest.fn() as any;
    });

    test("should replace text in contenteditable element", () => {
      const context: ReplacementContext = {
        element: mockContentEditable,
        startOffset: 5,
        endOffset: 8,
        trigger: ";gb",
        snippet: null as any,
      };

      // Mock createRangeFromOffsets to return a valid range
      const replacerAny = replacer as any;
      replacerAny.createRangeFromOffsets = jest.fn(() => mockRange);

      replacer.replaceText(context, "Goodbye");

      expect(mockSelection.removeAllRanges).toHaveBeenCalled();
      expect(mockSelection.addRange).toHaveBeenCalledWith(mockRange);
      expect(mockRange.deleteContents).toHaveBeenCalled();
      expect(mockRange.insertNode).toHaveBeenCalled();
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: "input" }),
      );
    });

    test("should handle contenteditable with no selection", () => {
      (global.window.getSelection as jest.Mock).mockReturnValue(null);

      const context: ReplacementContext = {
        element: mockContentEditable,
        startOffset: 0,
        endOffset: 3,
        trigger: ";gb",
        snippet: null as any,
      };

      // Should not throw error
      expect(() => {
        replacer.replaceText(context, "Hello");
      }).not.toThrow();
    });

    test("should handle invalid range creation", () => {
      const context: ReplacementContext = {
        element: mockContentEditable,
        startOffset: 0,
        endOffset: 3,
        trigger: ";gb",
        snippet: null as any,
      };

      // Mock createRangeFromOffsets to return null
      const replacerAny = replacer as any;
      replacerAny.createRangeFromOffsets = jest.fn(() => null);

      // Should not throw error
      expect(() => {
        replacer.replaceText(context, "Hello");
      }).not.toThrow();
    });
  });

  describe("Text Insertion", () => {
    test("should insert text at cursor in input", () => {
      mockInput.value = "Hello world";
      mockInput.selectionStart = 5;

      replacer.insertTextAtCursor(mockInput, " beautiful");

      expect(mockInput.value).toBe("Hello beautiful world");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(15, 15);
      expect(mockDispatchEvent).toHaveBeenCalled();
    });

    test("should insert text at cursor in textarea", () => {
      mockTextarea.value = "Line 1\nLine 2";
      mockTextarea.selectionStart = 7; // After "Line 1\n"

      replacer.insertTextAtCursor(mockTextarea, "Inserted ");

      expect(mockTextarea.value).toBe("Line 1\nInserted Line 2");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(16, 16);
    });

    test("should insert text at cursor in contenteditable", () => {
      const mockTextNode = { textContent: "inserted" };
      global.document.createTextNode = jest.fn(() => mockTextNode) as any;

      const mockSelection = {
        rangeCount: 1,
        getRangeAt: jest.fn(() => mockRange),
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
      } as unknown as Selection;

      const mockRange = {
        insertNode: jest.fn(),
        setStartAfter: jest.fn(),
        setEndAfter: jest.fn(),
      } as unknown as Range;

      (global.window.getSelection as jest.Mock).mockReturnValue(mockSelection);
      mockSelection.getRangeAt = jest.fn(() => mockRange);

      replacer.insertTextAtCursor(mockContentEditable, "inserted text");

      expect(mockRange.insertNode).toHaveBeenCalledWith(mockTextNode);
      expect(mockRange.setStartAfter).toHaveBeenCalledWith(mockTextNode);
      expect(mockRange.setEndAfter).toHaveBeenCalledWith(mockTextNode);
    });

    test("should handle insert with no cursor position", () => {
      mockInput.selectionStart = null;

      replacer.insertTextAtCursor(mockInput, "text");

      expect(mockInput.value).toBe("text");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(4, 4);
    });
  });

  describe("Selected Text Operations", () => {
    test("should replace selected text in input", () => {
      mockInput.value = "Hello selected world";
      mockInput.selectionStart = 6;
      mockInput.selectionEnd = 14; // "selected"

      replacer.replaceSelectedText(mockInput, "beautiful");

      expect(mockInput.value).toBe("Hello beautiful world");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(15, 15);
    });

    test("should replace selected text in contenteditable", () => {
      const mockTextNode = { textContent: "replacement" };
      global.document.createTextNode = jest.fn(() => mockTextNode) as any;

      const mockSelection = {
        rangeCount: 1,
        getRangeAt: jest.fn(() => mockRange),
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
      } as unknown as Selection;

      const mockRange = {
        deleteContents: jest.fn(),
        insertNode: jest.fn(),
        setStartAfter: jest.fn(),
        setEndAfter: jest.fn(),
      } as unknown as Range;

      (global.window.getSelection as jest.Mock).mockReturnValue(mockSelection);
      mockSelection.getRangeAt = jest.fn(() => mockRange);

      replacer.replaceSelectedText(mockContentEditable, "replacement text");

      expect(mockRange.deleteContents).toHaveBeenCalled();
      expect(mockRange.insertNode).toHaveBeenCalledWith(mockTextNode);
    });

    test("should get selected text from input", () => {
      mockInput.value = "Hello world";
      mockInput.selectionStart = 0;
      mockInput.selectionEnd = 5;

      const selected = replacer.getSelectedText(mockInput);

      expect(selected).toBe("Hello");
    });

    test("should get selected text from contenteditable", () => {
      const mockSelection = {
        toString: jest.fn(() => "selected content"),
      } as unknown as Selection;

      (global.window.getSelection as jest.Mock).mockReturnValue(mockSelection);

      const selected = replacer.getSelectedText(mockContentEditable);

      expect(selected).toBe("selected content");
    });

    test("should handle no selection", () => {
      mockInput.selectionStart = null;
      mockInput.selectionEnd = null;

      const selected = replacer.getSelectedText(mockInput);

      expect(selected).toBe("");
    });
  });

  describe("Cursor Position Management", () => {
    test("should get cursor position from input", () => {
      mockInput.selectionStart = 10;

      const position = replacer.getCursorPosition(mockInput);

      expect(position).toBe(10);
    });

    test("should get cursor position from contenteditable", () => {
      const mockRange = {
        cloneRange: jest.fn(() => ({
          selectNodeContents: jest.fn(),
          setEnd: jest.fn(),
          toString: jest.fn(() => "0123456789"), // 10 characters
        })),
        endContainer: {},
        endOffset: 5,
      } as unknown as Range;

      const mockSelection = {
        rangeCount: 1,
        getRangeAt: jest.fn(() => mockRange),
      } as unknown as Selection;

      (global.window.getSelection as jest.Mock).mockReturnValue(mockSelection);

      const position = replacer.getCursorPosition(mockContentEditable);

      expect(position).toBe(10);
    });

    test("should set cursor position in input", () => {
      replacer.setCursorPosition(mockInput, 15);

      expect(mockSetSelectionRange).toHaveBeenCalledWith(15, 15);
    });

    test("should set cursor position in contenteditable", () => {
      const mockNode = { textContent: "0123456789" };
      const mockWalker = {
        nextNode: jest
          .fn()
          .mockReturnValueOnce(mockNode)
          .mockReturnValueOnce(null),
      };

      global.document.createTreeWalker = jest.fn(() => mockWalker) as any;

      const mockSelection = {
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
      } as unknown as Selection;

      (global.window.getSelection as jest.Mock).mockReturnValue(mockSelection);

      replacer.setCursorPosition(mockContentEditable, 5);

      expect(mockRange.setStart).toHaveBeenCalledWith(mockNode, 5);
      expect(mockRange.setEnd).toHaveBeenCalledWith(mockNode, 5);
      expect(mockSelection.addRange).toHaveBeenCalledWith(mockRange);
    });

    test("should handle setting cursor with no selection", () => {
      (global.window.getSelection as jest.Mock).mockReturnValue(null);

      // Should not throw error
      expect(() => {
        replacer.setCursorPosition(mockContentEditable, 5);
      }).not.toThrow();
    });
  });

  describe("Utility Operations", () => {
    test("should clear text in input", () => {
      mockInput.value = "some text";

      replacer.clearText(mockInput);

      expect(mockInput.value).toBe("");
      expect(mockSetSelectionRange).toHaveBeenCalledWith(0, 0);
      expect(mockDispatchEvent).toHaveBeenCalled();
    });

    test("should clear text in contenteditable", () => {
      mockContentEditable.textContent = "some content";

      const mockSelection = {
        removeAllRanges: jest.fn(),
        addRange: jest.fn(),
      } as unknown as Selection;

      (global.window.getSelection as jest.Mock).mockReturnValue(mockSelection);

      replacer.clearText(mockContentEditable);

      expect(mockContentEditable.textContent).toBe("");
      expect(mockRange.setStart).toHaveBeenCalledWith(mockContentEditable, 0);
      expect(mockRange.setEnd).toHaveBeenCalledWith(mockContentEditable, 0);
    });

    test("should trigger undo for last replacement", () => {
      // Mock Event constructor
      global.Event = jest.fn().mockImplementation((type, options) => ({
        type,
        bubbles: options?.bubbles || false,
        cancelable: options?.cancelable || false,
      })) as any;

      // Set up initial text
      mockInput.value = "test text";

      // First perform a replacement to set up undo state
      const context: ReplacementContext = {
        element: mockInput,
        startOffset: 0,
        endOffset: 4,
        trigger: "test",
        snippet: null as any,
      };

      replacer.replaceText(context, "Hello World");

      // Verify replacement happened
      expect(mockInput.value).toBe("Hello World text");

      // Now test undo
      mockDispatchEvent.mockClear();
      replacer.undoLastReplacement(mockInput);

      // Should restore original text and trigger input event
      expect(mockInput.value).toBe("test text");
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "input",
        }),
      );
    });

    test("should not trigger undo if element not active", () => {
      Object.defineProperty(document, "activeElement", {
        writable: true,
        value: null,
      });

      replacer.undoLastReplacement(mockInput);

      expect(mockDispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe("Element Type Detection", () => {
    test("should identify form input elements", () => {
      const replacerAny = replacer as any;

      expect(replacerAny.isFormInput(mockInput)).toBe(true);
      expect(replacerAny.isFormInput(mockTextarea)).toBe(true);
      expect(replacerAny.isFormInput(mockContentEditable)).toBe(false);
    });

    test("should identify contenteditable elements", () => {
      expect(isContentEditable(mockContentEditable)).toBe(true);
      expect(isContentEditable(mockInput)).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("should handle unsupported element types", () => {
      const unsupportedElement = {
        tagName: "SPAN",
        contentEditable: "false",
      } as HTMLElement;

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const context: ReplacementContext = {
        element: unsupportedElement,
        startOffset: 0,
        endOffset: 3,
        trigger: ";gb",
        snippet: null as any,
      };

      replacer.replaceText(context, "Hello");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Unsupported element type for text replacement",
      );
      consoleSpy.mockRestore();
    });

    test("should handle errors during replacement", () => {
      mockInput.value = "test";
      mockSetSelectionRange.mockImplementation(() => {
        throw new Error("Selection error");
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const context: ReplacementContext = {
        element: mockInput,
        startOffset: 0,
        endOffset: 4,
        trigger: "test",
        snippet: null as any,
      };

      // Should not throw
      expect(() => {
        replacer.replaceText(context, "replacement");
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error replacing text:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    test("should handle errors during event triggering", () => {
      // Clear any existing mocks
      jest.clearAllMocks();

      const erroringDispatchEvent = jest.fn(() => {
        throw new Error("Event error");
      });

      const workingSetSelectionRange = jest.fn(); // Working selection range function

      const erroringInput = {
        ...mockInput,
        dispatchEvent: erroringDispatchEvent,
        setSelectionRange: workingSetSelectionRange,
        value: "",
        selectionStart: 0,
      } as unknown as HTMLInputElement;

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      replacer.insertTextAtCursor(erroringInput, "text");

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error triggering input event:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("Range Creation for ContentEditable", () => {
    test("should create range from text offsets", () => {
      const mockTextNode1 = { textContent: "01234" }; // 5 chars
      const mockTextNode2 = { textContent: "56789" }; // 5 chars

      const mockWalker = {
        nextNode: jest
          .fn()
          .mockReturnValueOnce(mockTextNode1)
          .mockReturnValueOnce(mockTextNode2)
          .mockReturnValueOnce(null),
      };

      global.document.createTreeWalker = jest.fn(() => mockWalker) as any;

      const replacerAny = replacer as any;
      const range = replacerAny.createRangeFromOffsets(
        mockContentEditable,
        3,
        7,
      );

      expect(range).toBe(mockRange);
      expect(mockRange.setStart).toHaveBeenCalledWith(mockTextNode1, 3);
      expect(mockRange.setEnd).toHaveBeenCalledWith(mockTextNode2, 2); // 7 - 5 = 2
    });

    test("should handle range creation errors", () => {
      const mockTextNode = { textContent: "0123456789" };
      const mockWalker = {
        nextNode: jest
          .fn()
          .mockReturnValueOnce(mockTextNode)
          .mockReturnValueOnce(null),
      };

      // Create a new mockRange that throws error
      const errorRange = {
        ...mockRange,
        setStart: jest.fn(() => {
          throw new Error("Range error");
        }),
      };

      global.document.createRange = jest.fn(() => errorRange);
      global.document.createTreeWalker = jest.fn(() => mockWalker) as any;
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const replacerAny = replacer as any;
      const range = replacerAny.createRangeFromOffsets(
        mockContentEditable,
        0,
        5,
      );

      expect(range).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error creating range:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    test("should return null for invalid offsets", () => {
      const mockWalker = {
        nextNode: jest.fn().mockReturnValue(null),
      };

      global.document.createTreeWalker = jest.fn(() => mockWalker) as any;

      const replacerAny = replacer as any;
      const range = replacerAny.createRangeFromOffsets(
        mockContentEditable,
        0,
        5,
      );

      expect(range).toBeNull();
    });
  });
});
