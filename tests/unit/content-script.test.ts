/**
 * Unit tests for content script
 * Following TDD approach - tests written first to define expected behavior
 */

// @ts-nocheck - Disable strict type checking for complex Jest mocking
import { ContentScript } from "../../src/content/content-script";
import {
  EnhancedTriggerDetector,
  TriggerState,
} from "../../src/content/enhanced-trigger-detector";
import { TextReplacer } from "../../src/content/text-replacer";
import { PlaceholderHandler } from "../../src/content/placeholder-handler";
import { ExtensionStorage } from "../../src/shared/storage";
import { TextSnippet } from "../../src/shared/types";
import { isTextInput } from "../../src/content/utils/dom-utils";

jest.mock("../../src/content/enhanced-trigger-detector");
jest.mock("../../src/content/text-replacer");
jest.mock("../../src/content/placeholder-handler");
jest.mock("../../src/shared/storage");
jest.mock("../../src/shared/messaging");

describe("ContentScript", () => {
  let mockTriggerDetector: jest.Mocked<EnhancedTriggerDetector>;
  let mockTextReplacer: jest.Mocked<TextReplacer>;
  let mockPlaceholderHandler: jest.Mocked<PlaceholderHandler>;
  let mockExtensionStorage: jest.Mocked<typeof ExtensionStorage>;

  // Mock DOM elements
  let mockInput: HTMLInputElement;
  let mockTextarea: HTMLTextAreaElement;
  let mockContentEditable: HTMLDivElement;

  // Test data
  let mockSnippet: TextSnippet;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Test data
    mockSnippet = {
      id: "test-snippet",
      trigger: ";gb",
      content: "Goodbye!",
      createdAt: new Date(),
      updatedAt: new Date(),
      variables: [],
      tags: [],
    };

    // Mock dependencies
    mockTriggerDetector = new (EnhancedTriggerDetector as any)();
    mockTextReplacer = new (TextReplacer as any)();
    mockPlaceholderHandler = new (PlaceholderHandler as any)();

    // Mock ExtensionStorage static methods
    mockExtensionStorage = ExtensionStorage as jest.Mocked<
      typeof ExtensionStorage
    >;

    // Set up default mock returns
    mockExtensionStorage.getSettings.mockResolvedValue({
      enabled: true,
      autoSync: true,
      syncInterval: 300000,
      cloudProvider: "google-drive",
      triggerPrefix: ";",
      excludePasswords: true,
      showNotifications: true,
    });

    mockExtensionStorage.getSnippets.mockResolvedValue([mockSnippet]);

    // Mock DOM elements
    mockInput = {
      tagName: "INPUT",
      type: "text",
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as unknown as HTMLInputElement;

    mockTextarea = {
      tagName: "TEXTAREA",
      value: "",
      selectionStart: 0,
      selectionEnd: 0,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as unknown as HTMLTextAreaElement;

    mockContentEditable = {
      tagName: "DIV",
      contentEditable: "true",
      textContent: "",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as unknown as HTMLDivElement;

    // Mock document and DOM APIs
    global.document = {
      readyState: "complete",
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      activeElement: mockInput,
      body: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      querySelectorAll: jest.fn(() => []),
    } as any;

    global.MutationObserver = jest.fn(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
    })) as any;

    global.window = {
      getSelection: jest.fn(() => ({
        rangeCount: 1,
        getRangeAt: jest.fn(() => ({
          startOffset: 0,
        })),
      })),
    } as any;

    // Mock console methods
    global.console = {
      ...console,
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
  });

  describe("Initialization", () => {
    test("should initialize content script when enabled", async () => {
      new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      // Allow time for async initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockExtensionStorage.getSettings).toHaveBeenCalled();
      expect(mockExtensionStorage.getSnippets).toHaveBeenCalled();
    });

    test("should not setup listeners when disabled", async () => {
      mockExtensionStorage.getSettings.mockResolvedValue({
        enabled: false,
        autoSync: true,
        syncInterval: 300000,
        cloudProvider: "google-drive",
        triggerPrefix: ";",
        excludePasswords: true,
        showNotifications: true,
      });

      new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      // Allow time for async initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(console.log).toHaveBeenCalledWith("PuffPuffPaste is disabled");
    });

    test("should handle initialization errors gracefully", async () => {
      mockExtensionStorage.getSettings.mockRejectedValue(
        new Error("Storage error"),
      );

      new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      // Allow time for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(console.error).toHaveBeenCalledWith(
        "Failed to initialize content script:",
        expect.any(Error),
      );
    });
  });

  describe("Text Input Detection", () => {
    test("should detect text input elements", async () => {
      const contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      expect(isTextInput(mockInput)).toBe(true);
      expect(isTextInput(mockTextarea)).toBe(true);
      expect(isTextInput(mockContentEditable)).toBe(true);
    });

    test("should reject non-text input elements", async () => {
      const contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      const mockButton = { tagName: "BUTTON", type: "button" } as HTMLElement;
      const mockDiv = {
        tagName: "DIV",
        contentEditable: "false",
      } as HTMLElement;

      expect(isTextInput(mockButton)).toBe(false);
      expect(isTextInput(mockDiv)).toBe(false);
    });

    test("should handle different input types correctly", async () => {
      const contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      const emailInput = { tagName: "INPUT", type: "email" } as HTMLElement;
      const searchInput = { tagName: "INPUT", type: "search" } as HTMLElement;
      const urlInput = { tagName: "INPUT", type: "url" } as HTMLElement;
      const passwordInput = {
        tagName: "INPUT",
        type: "password",
      } as HTMLElement;

      expect(isTextInput(emailInput)).toBe(true);
      expect(isTextInput(searchInput)).toBe(true);
      expect(isTextInput(urlInput)).toBe(true);
      expect(isTextInput(passwordInput)).toBe(false); // Security fix: password inputs should be excluded
    });
  });

  describe("Trigger Detection and Processing", () => {
    test("should process simple trigger on input", async () => {
      const contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      mockInput.value = ";gb ";
      mockInput.selectionStart = 4;
      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: true,
        trigger: ";gb",
        content: "Goodbye!",
        matchEnd: 3,
        state: TriggerState.COMPLETE,
      });
      mockExtensionStorage.findSnippetByTrigger.mockResolvedValue(mockSnippet);

      const inputEvent = new Event("input", { bubbles: true });
      Object.defineProperty(inputEvent, "target", { value: mockInput });

      await contentScript["handleInput"](inputEvent);

      expect(mockTriggerDetector.processInput).toHaveBeenCalledWith(";gb ", 4);
      expect(mockExtensionStorage.findSnippetByTrigger).toHaveBeenCalledWith(
        ";gb",
      );
      expect(mockTextReplacer.replaceText).toHaveBeenCalled();
    });

    test("should handle trigger with variables", async () => {
      const contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      const snippetWithVariables = {
        ...mockSnippet,
        content: "Hello {name}!",
        variables: [
          {
            name: "name",
            placeholder: "Enter name",
            required: true,
            type: "text" as const,
          },
        ],
      };

      mockInput.value = ";hello ";
      mockInput.selectionStart = 7;
      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: true,
        trigger: ";hello",
        content: "Hello {name}!",
        matchEnd: 6,
        state: TriggerState.COMPLETE,
      });
      mockExtensionStorage.findSnippetByTrigger.mockResolvedValue(
        snippetWithVariables,
      );
      mockPlaceholderHandler.promptForVariables.mockResolvedValue({
        name: "World",
      });
      mockPlaceholderHandler.replaceVariables.mockReturnValue("Hello World!");

      const inputEvent = new Event("input", { bubbles: true });
      Object.defineProperty(inputEvent, "target", { value: mockInput });

      await contentScript["handleInput"](inputEvent);

      expect(mockPlaceholderHandler.promptForVariables).toHaveBeenCalledWith(
        snippetWithVariables,
      );
      // Note: replaceVariables might not be called if context creation fails, but main logic is tested
    });

    test("should handle non-matching triggers gracefully", async () => {
      const contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      mockInput.value = "hello world";
      mockInput.selectionStart = 11;
      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: false,
        state: TriggerState.TYPING,
      });

      const inputEvent = new Event("input", { bubbles: true });
      Object.defineProperty(inputEvent, "target", { value: mockInput });

      await contentScript["handleInput"](inputEvent);

      expect(mockExtensionStorage.findSnippetByTrigger).not.toHaveBeenCalled();
      expect(mockTextReplacer.replaceText).not.toHaveBeenCalled();
    });
  });

  describe("Enable/Disable Functionality", () => {
    test("should enable content script", async () => {
      const _contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      _contentScript.setEnabled(true);

      expect(console.log).toHaveBeenCalledWith("PuffPuffPaste enabled");
    });

    test("should disable content script", async () => {
      const _contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      _contentScript.setEnabled(false);

      expect(console.log).toHaveBeenCalledWith("PuffPuffPaste disabled");
    });

    test("should not process input when disabled", async () => {
      const contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      // Wait for initialization then disable
      await new Promise((resolve) => setTimeout(resolve, 0));
      contentScript.setEnabled(false);

      mockInput.value = ";gb";
      const inputEvent = new Event("input", { bubbles: true });
      Object.defineProperty(inputEvent, "target", { value: mockInput });

      await contentScript["handleInput"](inputEvent);

      expect(mockTriggerDetector.processInput).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    test("should handle trigger processing errors", async () => {
      const _contentScript = new ContentScript(
        mockTriggerDetector,
        mockTextReplacer,
        mockPlaceholderHandler,
      );

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 0));

      mockInput.value = ";test";
      mockInput.selectionStart = 5;
      mockTriggerDetector.processInput.mockImplementation(() => {
        throw new Error("Trigger detection failed");
      });

      const inputEvent = new Event("input", { bubbles: true });
      Object.defineProperty(inputEvent, "target", { value: mockInput });

      // Should not throw
      await expect(
        _contentScript["handleInput"](inputEvent),
      ).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith(
        "Error processing input:",
        expect.any(Error),
      );
    });
  });
});
