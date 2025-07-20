/**
 * Test bridge for intercepting extension messages
 * This allows E2E tests to verify extension behavior
 */

export let __TEST_LAST_MSG: any;

// Listen for runtime messages and store for testing
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
    __TEST_LAST_MSG = msg;

    // Forward to test environment if available
    if (process.env.NODE_ENV === "test" && typeof globalThis !== "undefined") {
      (globalThis as any).__LAST_EXT_MSG__ = __TEST_LAST_MSG;
    }

    // Allow other listeners to handle the message
    return false;
  });
}

// Export for test access
export const getLastMessage = () => __TEST_LAST_MSG;
export const clearLastMessage = () => {
  __TEST_LAST_MSG = undefined;
  if (typeof globalThis !== "undefined") {
    (globalThis as any).__LAST_EXT_MSG__ = undefined;
  }
};
