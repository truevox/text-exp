/**
 * Test script to verify content script can access synced snippets
 * This should be run in a web page's console while the extension is active
 */

async function testContentScriptAccess() {
  console.log("🔍 [CONTENT-TEST] Testing content script snippet access...");

  try {
    // Test 1: Check if content script is loaded
    console.log(
      "📋 [CONTENT-TEST] Step 1: Checking if content script is loaded...",
    );
    if (typeof window.contentScript === "undefined") {
      console.log(
        "⚠️ [CONTENT-TEST] Content script not found on window object",
      );
      console.log("🔍 [CONTENT-TEST] Checking for extension namespace...");

      // Try to send a message to background script to get snippets
      console.log("📢 [CONTENT-TEST] Sending message to background script...");

      chrome.runtime.sendMessage({ type: "GET_SNIPPETS" }, (response) => {
        if (response && response.success) {
          const snippets = response.data;
          console.log(
            `✅ [CONTENT-TEST] Background script returned ${snippets.length} snippets:`,
          );
          snippets.forEach((snippet, index) => {
            console.log(
              `  📋 Snippet ${index + 1}: "${snippet.trigger}" -> "${snippet.content.substring(0, 30)}..."`,
            );
          });

          const ponySnippet = snippets.find((s) => s.trigger === ";pony");
          if (ponySnippet) {
            console.log(
              `✅ [CONTENT-TEST] ;pony snippet FOUND via background script:`,
              ponySnippet,
            );
          } else {
            console.error(
              `❌ [CONTENT-TEST] ;pony snippet NOT FOUND via background script`,
            );
            console.log(
              `🔍 [CONTENT-TEST] Available triggers:`,
              snippets.map((s) => s.trigger),
            );
          }
        } else {
          console.error(
            "❌ [CONTENT-TEST] Failed to get snippets from background:",
            response,
          );
        }
      });
    }

    // Test 2: Direct IndexedDB access from content script context
    console.log("💾 [CONTENT-TEST] Step 2: Testing direct IndexedDB access...");

    // This would normally fail due to module loading in content script context
    // But let's try anyway
    try {
      // Simulate what the content script does
      const testInput = ";pony ";
      console.log(
        `🎯 [CONTENT-TEST] Testing trigger detection for: "${testInput}"`,
      );

      // Create a fake trigger detector to test the logic
      const triggerRegex = /;(\w+)/g;
      const matches = [...testInput.matchAll(triggerRegex)];

      if (matches.length > 0) {
        console.log(
          `🎯 [CONTENT-TEST] Found potential triggers:`,
          matches.map((m) => m[0]),
        );

        // Check if ;pony would be detected
        if (matches.some((m) => m[0] === ";pony")) {
          console.log(`✅ [CONTENT-TEST] ;pony trigger detected correctly`);
        } else {
          console.warn(`⚠️ [CONTENT-TEST] ;pony trigger not detected in input`);
        }
      } else {
        console.warn(
          `⚠️ [CONTENT-TEST] No triggers detected in input: "${testInput}"`,
        );
      }
    } catch (error) {
      console.error(
        "❌ [CONTENT-TEST] Error during trigger detection test:",
        error,
      );
    }

    // Test 3: Check extension storage directly if possible
    console.log(
      "📦 [CONTENT-TEST] Step 3: Testing extension storage access...",
    );
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(null, (items) => {
        console.log(
          "📦 [CONTENT-TEST] Extension storage contents:",
          Object.keys(items),
        );

        // Look for snippet-related keys
        const snippetKeys = Object.keys(items).filter(
          (key) =>
            key.includes("snippet") ||
            key.includes("pony") ||
            key.includes("sync"),
        );

        if (snippetKeys.length > 0) {
          console.log(
            "📋 [CONTENT-TEST] Found snippet-related storage keys:",
            snippetKeys,
          );
          snippetKeys.forEach((key) => {
            console.log(`  🔑 ${key}:`, items[key]);
          });
        } else {
          console.warn(
            "⚠️ [CONTENT-TEST] No snippet-related storage keys found",
          );
        }
      });
    } else {
      console.warn("⚠️ [CONTENT-TEST] Chrome storage API not available");
    }
  } catch (error) {
    console.error("❌ [CONTENT-TEST] Test failed:", error);
  }
}

// Auto-run if we're in a browser context
if (typeof window !== "undefined") {
  console.log(
    "🎯 Content script access test loaded. Run testContentScriptAccess() to execute.",
  );
  // Run automatically after a short delay
  setTimeout(testContentScriptAccess, 1000);
} else {
  console.log(
    "📋 This script should be run in a browser page console with the extension active.",
  );
}
