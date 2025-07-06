/**
 * Test for content script refresh after sync completion
 * Tests the messaging system between background and content scripts
 */

// @ts-nocheck - Disable strict type checking for complex Jest mocking
import { jest } from "@jest/globals";

// Mock the shared modules before importing content script
jest.mock("../../src/shared/storage", () => ({
  ExtensionStorage: {
    getSettings: jest.fn().mockResolvedValue({ enabled: true } as any),
    getSnippets: jest.fn().mockResolvedValue([] as any),
    findSnippetByTrigger: jest.fn().mockResolvedValue(null as any),
  },
}));

jest.mock("../../src/content/enhanced-trigger-detector", () => ({
  EnhancedTriggerDetector: jest.fn().mockImplementation(() => ({
    updateSnippets: jest.fn(),
    reset: jest.fn(),
    processInput: jest.fn().mockReturnValue({ isMatch: false }),
  })),
}));

jest.mock("../../src/content/text-replacer", () => ({
  TextReplacer: jest.fn().mockImplementation(() => ({
    replaceText: jest.fn(),
    insertHtmlAtCursor: jest.fn(),
    undoLastReplacement: jest.fn(),
  })),
}));

jest.mock("../../src/content/placeholder-handler", () => ({
  PlaceholderHandler: jest.fn().mockImplementation(() => ({
    promptForVariables: jest.fn().mockResolvedValue({} as any),
  })),
}));

jest.mock("../../src/background/image-processor", () => ({
  ImageProcessor: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../src/content/trigger-cycling-ui", () => ({
  TriggerCyclingUI: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    hide: jest.fn(),
    cycleNext: jest.fn(),
    getCurrentOption: jest.fn(),
  })),
}));

jest.mock("../../src/shared/messaging", () => ({
  createMessageHandler: jest.fn().mockReturnValue({
    on: jest.fn(),
    listen: jest.fn(),
  }),
  createSuccessResponse: jest.fn(),
  createErrorResponse: jest.fn(),
}));

describe("Content Script Sync Refresh", () => {
  let mockChrome: any;
  let mockSendMessage: jest.Mock;
  let mockOnMessage: any;
  let messageListeners: ((message: any) => boolean)[];

  beforeEach(() => {
    // Setup DOM mocks using direct assignment to avoid redefinition errors
    const mockDocument = {
      readyState: "complete",
      addEventListener: jest.fn(),
      activeElement: null,
      createElement: jest.fn().mockReturnValue({
        style: {},
        addEventListener: jest.fn(),
        appendChild: jest.fn(),
        querySelector: jest.fn(),
        innerHTML: "",
      }),
      body: {
        appendChild: jest.fn(),
      },
    };

    const mockWindow = {
      getSelection: jest.fn().mockReturnValue({
        rangeCount: 0,
      }),
    };

    // Assign to global directly instead of redefining
    (global as any).document = mockDocument;
    (global as any).window = mockWindow;

    // Setup chrome.runtime.sendMessage mock
    mockSendMessage = jest.fn();

    // Setup chrome.runtime.onMessage mock with listener management
    messageListeners = [];
    mockOnMessage = {
      addListener: jest.fn((listener: (message: any) => boolean) => {
        messageListeners.push(listener);
      }),
      removeListener: jest.fn(),
    };

    // Mock chrome API
    mockChrome = {
      runtime: {
        sendMessage: mockSendMessage,
        onMessage: mockOnMessage,
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
      },
    };

    // @ts-ignore
    global.chrome = mockChrome;
  });

  afterEach(() => {
    messageListeners = [];
    jest.clearAllMocks();
  });

  describe("Background Script Notification", () => {
    it("should send SNIPPETS_UPDATED message to all tabs after successful sync", async () => {
      // Mock tabs.query to return active tabs
      const mockTabs = [
        { id: 1, url: "https://example.com" },
        { id: 2, url: "https://docs.google.com" },
      ];

      mockChrome.tabs.query.mockImplementation(
        (query: any, callback: (tabs: any[]) => void) => {
          callback(mockTabs);
        },
      );

      // Mock successful message sending
      mockChrome.tabs.sendMessage.mockResolvedValue(true);

      // Import the function we need to implement
      const messagingHelpers = await import(
        "../../src/background/messaging-helpers.js"
      );
      const { notifyContentScriptsOfSnippetUpdate } = messagingHelpers;

      // Call the function
      await notifyContentScriptsOfSnippetUpdate();

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify tabs.query was called correctly
      expect(mockChrome.tabs.query).toHaveBeenCalledWith(
        {},
        expect.any(Function),
      );

      // Verify messages were sent to all tabs
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: "SNIPPETS_UPDATED",
      });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
        type: "SNIPPETS_UPDATED",
      });
    });

    it("should handle errors when sending messages to tabs", async () => {
      // Mock tabs.query to return active tabs
      const mockTabs = [{ id: 1, url: "https://example.com" }];

      mockChrome.tabs.query.mockImplementation(
        (query: any, callback: (tabs: any[]) => void) => {
          callback(mockTabs);
        },
      );

      // Mock tabs.sendMessage to throw error
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error("Tab not found"));

      const messagingHelpers = await import(
        "../../src/background/messaging-helpers.js"
      );
      const { notifyContentScriptsOfSnippetUpdate } = messagingHelpers;

      // Should not throw error - should handle gracefully
      await expect(
        notifyContentScriptsOfSnippetUpdate(),
      ).resolves.not.toThrow();
    });
  });

  describe("Content Script Message Handling", () => {
    it("should refresh snippets when receiving SNIPPETS_UPDATED message", async () => {
      // Import and create content script instance
      const { ContentScript } = await import(
        "../../src/content/content-script.js"
      );

      // Wait a bit for initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create content script instance which will register the message listener
      const contentScript = new ContentScript();
      const mockLoadSnippets = jest.fn();
      jest
        .spyOn(contentScript as any, "loadSnippets")
        .mockImplementation(mockLoadSnippets);

      // Wait for async initialization (loadSnippets called once during init)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reset mock to only track calls from message handling
      mockLoadSnippets.mockClear();

      // Verify message listener was registered
      expect(messageListeners.length).toBeGreaterThan(0);
      const messageListener = messageListeners[messageListeners.length - 1];

      // Mock sendResponse function
      const mockSendResponse = jest.fn();

      // Simulate receiving SNIPPETS_UPDATED message
      const result = messageListener(
        { type: "SNIPPETS_UPDATED" },
        {},
        mockSendResponse,
      );

      // Verify loadSnippets was called once for the message and listener returned true
      expect(mockLoadSnippets).toHaveBeenCalledTimes(1);
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
      expect(result).toBe(true);
    });

    it("should ignore unrelated messages", async () => {
      const { ContentScript } = await import(
        "../../src/content/content-script.js"
      );

      // Wait for any previous setup to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const contentScript = new ContentScript();
      const mockLoadSnippets = jest.fn();
      jest
        .spyOn(contentScript as any, "loadSnippets")
        .mockImplementation(mockLoadSnippets);

      // Wait for async initialization (loadSnippets called once during init)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reset mock to only track calls from message handling
      mockLoadSnippets.mockClear();

      const messageListener = messageListeners[messageListeners.length - 1];
      expect(messageListener).toBeDefined();

      // Mock sendResponse function
      const mockSendResponse = jest.fn();

      // Send unrelated message
      const result = messageListener(
        { type: "SOME_OTHER_MESSAGE" },
        {},
        mockSendResponse,
      );

      // Verify loadSnippets was NOT called for unrelated message and listener returned false
      expect(mockLoadSnippets).not.toHaveBeenCalled();
      expect(mockSendResponse).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("Integration Flow", () => {
    it("should complete full sync-to-content-refresh flow", async () => {
      // This test verifies the complete flow:
      // 1. Sync completes in background
      // 2. Background notifies all content scripts
      // 3. Content scripts refresh their snippet cache

      const mockTabs = [{ id: 1, url: "https://example.com" }];
      mockChrome.tabs.query.mockImplementation(
        (query: any, callback: (tabs: any[]) => void) => {
          callback(mockTabs);
        },
      );

      // Mock successful message sending
      mockChrome.tabs.sendMessage.mockResolvedValue(true);

      // Import the background notification helper
      const messagingHelpers = await import(
        "../../src/background/messaging-helpers.js"
      );
      const { notifyContentScriptsOfSnippetUpdate } = messagingHelpers;

      // Wait for any previous setup to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Import and setup content script
      const { ContentScript } = await import(
        "../../src/content/content-script.js"
      );
      const contentScript = new ContentScript();
      const mockLoadSnippets = jest.fn();
      jest
        .spyOn(contentScript as any, "loadSnippets")
        .mockImplementation(mockLoadSnippets);

      // Wait for content script initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 1: Background script sends notification
      await notifyContentScriptsOfSnippetUpdate();

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Step 2: Simulate content script receiving the message
      const messageListener = messageListeners[messageListeners.length - 1];
      const mockSendResponse = jest.fn();
      messageListener({ type: "SNIPPETS_UPDATED" }, {}, mockSendResponse);

      // Step 3: Verify the complete flow
      expect(mockChrome.tabs.query).toHaveBeenCalled();
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: "SNIPPETS_UPDATED",
      });
      expect(mockLoadSnippets).toHaveBeenCalled();
      expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
    });
  });
});
