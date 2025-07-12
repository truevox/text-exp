/**
 * Messaging helpers for background script
 * Handles communication between background and content scripts
 */

/**
 * Notify all content scripts that snippets have been updated
 * Called after successful sync completion
 */
export async function notifyContentScriptsOfSnippetUpdate(): Promise<void> {
  try {
    // Query all tabs
    chrome.tabs.query({}, (tabs) => {
      console.log(`🔍 [MESSAGING-DEBUG] Found ${tabs.length} tabs to notify`);
      // Send message to each tab's content script
      tabs.forEach((tab) => {
        if (tab.id) {
          console.log(
            `🔍 [MESSAGING-DEBUG] Sending SNIPPETS_UPDATED to tab ${tab.id} (${tab.url})`,
          );
          chrome.tabs
            .sendMessage(tab.id, { type: "SNIPPETS_UPDATED" })
            .then(() => {
              console.log(
                `✅ [MESSAGING-DEBUG] Successfully notified tab ${tab.id} of snippet update`,
              );
            })
            .catch((error) => {
              // Silently handle errors (tab might not have content script or be closed)
              console.warn(
                `❌ [MESSAGING-DEBUG] Failed to notify tab ${tab.id}:`,
                error.message,
              );
            });
        }
      });
    });
  } catch (error) {
    console.error("Failed to notify content scripts of snippet update:", error);
  }
}

/**
 * Broadcast a message to all content scripts
 */
export async function broadcastToContentScripts(message: any): Promise<void> {
  try {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch((error) => {
            console.debug(
              `Failed to broadcast to tab ${tab.id}:`,
              error.message,
            );
          });
        }
      });
    });
  } catch (error) {
    console.error("Failed to broadcast to content scripts:", error);
  }
}
