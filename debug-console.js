/**
 * Debug console script for testing Google Drive sync
 * Paste this into the browser console when the extension is active
 */

async function debugGoogleDriveSync() {
  console.log("🔍 [DEBUG] Starting Google Drive sync debug...");

  try {
    // Step 1: Send manual sync message to background script
    console.log("🔄 [DEBUG] Step 1: Triggering manual sync...");
    const syncResponse = await chrome.runtime.sendMessage({
      type: "SYNC_SNIPPETS",
    });
    console.log("📤 [DEBUG] Sync response:", syncResponse);

    // Step 2: Wait a moment for sync to complete
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 3: Check what snippets are available via messaging
    console.log(
      "📚 [DEBUG] Step 3: Checking snippets via background messaging...",
    );
    const snippetsResponse = await chrome.runtime.sendMessage({
      type: "GET_SNIPPETS",
    });
    console.log("📋 [DEBUG] Snippets from background:", snippetsResponse);

    if (snippetsResponse.success && snippetsResponse.data) {
      const snippets = snippetsResponse.data;
      console.log(`📊 [DEBUG] Found ${snippets.length} total snippets:`);
      snippets.forEach((snippet, index) => {
        console.log(
          `  ${index + 1}. ${snippet.trigger} (${snippet.source || "unknown source"}): ${snippet.content.substring(0, 50)}...`,
        );
      });

      // Check specifically for ;pony
      const ponySnippet = snippets.find((s) => s.trigger === ";pony");
      if (ponySnippet) {
        console.log("✅ [DEBUG] ;pony snippet found:", ponySnippet);
      } else {
        console.log("❌ [DEBUG] ;pony snippet NOT found in results");
      }
    }

    // Step 4: Test Google Drive API directly
    console.log("🔍 [DEBUG] Step 4: Testing Google Drive API access...");
    const testApiResponse = await chrome.runtime.sendMessage({
      type: "TEST_GOOGLE_DRIVE_API",
    });
    console.log("🧪 [DEBUG] API test response:", testApiResponse);
  } catch (error) {
    console.error("❌ [DEBUG] Debug process failed:", error);
  }
}

// Also provide a simpler version for quick testing
async function quickSyncTest() {
  console.log("⚡ [QUICK] Quick sync test...");

  try {
    // Trigger sync
    await chrome.runtime.sendMessage({ type: "SYNC_SNIPPETS" });

    // Wait and check results
    setTimeout(async () => {
      const response = await chrome.runtime.sendMessage({
        type: "GET_SNIPPETS",
      });
      const snippets = response.success ? response.data : [];
      console.log(`⚡ [QUICK] Result: ${snippets.length} snippets found`);

      const pony = snippets.find((s) => s.trigger === ";pony");
      console.log(`⚡ [QUICK] ;pony found: ${!!pony}`);

      if (pony) {
        console.log("⚡ [QUICK] ;pony content:", pony.content);
      } else {
        console.log(
          "⚡ [QUICK] Available triggers:",
          snippets.map((s) => s.trigger),
        );
      }
    }, 2000);
  } catch (error) {
    console.error("❌ [QUICK] Quick test failed:", error);
  }
}

// Instructions
console.log(`
🎯 PuffPuffPaste Debug Tools Loaded!

To debug the ;pony sync issue, run either:

1. Full debug (recommended):
   debugGoogleDriveSync()

2. Quick test:
   quickSyncTest()

These functions will:
- Trigger a manual sync
- Check what snippets are returned
- Look specifically for the ;pony snippet
- Test Google Drive API access
`);
