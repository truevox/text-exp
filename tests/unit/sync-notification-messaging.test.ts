/**
 * Simple integration test for sync notification messaging
 * Tests just the core messaging between background and content scripts
 */

describe("Sync Notification Messaging", () => {
  let mockChrome: any;

  beforeEach(() => {
    // Mock chrome API
    mockChrome = {
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
      },
    };

    // @ts-ignore
    global.chrome = mockChrome;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should notify all tabs when sync completes", async () => {
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

    // Import and test the messaging helper
    const { notifyContentScriptsOfSnippetUpdate } = await import(
      "../../src/background/messaging-helpers.js"
    );

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

  it("should handle message sending errors gracefully", async () => {
    const mockTabs = [{ id: 1, url: "https://example.com" }];

    mockChrome.tabs.query.mockImplementation(
      (query: any, callback: (tabs: any[]) => void) => {
        callback(mockTabs);
      },
    );

    // Mock message sending to reject
    mockChrome.tabs.sendMessage.mockRejectedValue(new Error("Tab not found"));

    const { notifyContentScriptsOfSnippetUpdate } = await import(
      "../../src/background/messaging-helpers.js"
    );

    // Should not throw error - should handle gracefully
    await expect(notifyContentScriptsOfSnippetUpdate()).resolves.not.toThrow();

    // Verify it still attempted to send message
    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: "SNIPPETS_UPDATED",
    });
  });
});
