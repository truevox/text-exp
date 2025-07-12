/**
 * Service Worker compatible debug script
 * Run this in the extension service worker console
 */

async function debugServiceWorkerSync() {
  console.log("🔍 [SW-DEBUG] Starting service worker sync investigation...");

  try {
    // Step 1: Check chrome.storage.local directly
    console.log("📦 [SW-DEBUG] Step 1: Checking chrome.storage.local...");
    const localData = await chrome.storage.local.get(["snippets"]);
    const snippetsData = localData.snippets || [];

    console.log(
      `🏠 [SW-DEBUG] chrome.storage.local contains ${snippetsData.length} snippets:`,
    );
    snippetsData.forEach((snippet, index) => {
      console.log(`  📋 Local Snippet ${index + 1}:`, {
        id: snippet.id,
        trigger: snippet.trigger,
        content: snippet.content?.substring(0, 50) + "...",
        source: snippet.source,
      });
    });

    const ponyInLocal = snippetsData.find((s) => s.trigger === ";pony");
    console.log(
      `🐴 [SW-DEBUG] ;pony in chrome.storage.local: ${ponyInLocal ? "FOUND" : "NOT FOUND"}`,
    );

    // Step 2: Check sync status and settings
    console.log("⚙️ [SW-DEBUG] Step 2: Checking sync status and settings...");
    const settingsData = await chrome.storage.sync.get(["settings"]);
    const syncStatusData = await chrome.storage.local.get(["syncStatus"]);

    console.log(`⚙️ [SW-DEBUG] Current settings:`, settingsData.settings);
    console.log(
      `📊 [SW-DEBUG] Current sync status:`,
      syncStatusData.syncStatus,
    );

    // Step 3: Try to manually trigger sync via message
    console.log("🔄 [SW-DEBUG] Step 3: Attempting manual sync via message...");

    // Create a promise to handle the sync response
    const syncPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Sync timeout after 30 seconds"));
      }, 30000);

      // Send sync message to self
      chrome.runtime.sendMessage({ type: "SYNC_SNIPPETS" }, (response) => {
        clearTimeout(timeout);
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || "Sync failed"));
        }
      });
    });

    try {
      const syncResult = await syncPromise;
      console.log("✅ [SW-DEBUG] Manual sync completed:", syncResult);

      // Step 4: Check storage again after sync
      console.log("📦 [SW-DEBUG] Step 4: Checking storage after sync...");
      const postSyncData = await chrome.storage.local.get(["snippets"]);
      const postSyncSnippets = postSyncData.snippets || [];

      console.log(
        `🏠 [SW-DEBUG] chrome.storage.local after sync contains ${postSyncSnippets.length} snippets:`,
      );
      postSyncSnippets.forEach((snippet, index) => {
        console.log(`  📋 Post-sync Snippet ${index + 1}:`, {
          id: snippet.id,
          trigger: snippet.trigger,
          content: snippet.content?.substring(0, 50) + "...",
          source: snippet.source,
        });
      });

      const ponyAfterSync = postSyncSnippets.find((s) => s.trigger === ";pony");
      console.log(
        `🐴 [SW-DEBUG] ;pony after sync: ${ponyAfterSync ? "FOUND" : "STILL NOT FOUND"}`,
      );

      if (ponyAfterSync) {
        console.log("🎉 [SW-DEBUG] SUCCESS: ;pony is now available!");
      } else {
        console.error("💥 [SW-DEBUG] FAILURE: ;pony is still missing!");

        // Check if we're authenticated
        const isAuth = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: "GET_SYNC_STATUS" },
            (response) => {
              resolve(response?.success && response?.data?.isOnline);
            },
          );
        });

        console.log(
          `🔐 [SW-DEBUG] Authentication status: ${isAuth ? "AUTHENTICATED" : "NOT AUTHENTICATED"}`,
        );

        if (!isAuth) {
          console.warn(
            "⚠️ [SW-DEBUG] Not authenticated - this might be why ;pony is missing",
          );
          console.log(
            "💡 [SW-DEBUG] Try authenticating first, then run sync again",
          );
        }
      }
    } catch (syncError) {
      console.error("❌ [SW-DEBUG] Sync failed:", syncError);
    }
  } catch (error) {
    console.error("❌ [SW-DEBUG] Debug script failed:", error);
  }
}

// Also create a simple authentication test
async function testAuthentication() {
  console.log("🔐 [AUTH-TEST] Testing authentication...");

  try {
    const authPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Auth timeout after 30 seconds"));
      }, 30000);

      chrome.runtime.sendMessage(
        { type: "AUTHENTICATE_GOOGLE_DRIVE" },
        (response) => {
          clearTimeout(timeout);
          if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || "Auth failed"));
          }
        },
      );
    });

    const authResult = await authPromise;
    console.log("✅ [AUTH-TEST] Authentication successful:", authResult);

    // Now try sync after auth
    console.log("🔄 [AUTH-TEST] Attempting sync after authentication...");
    await debugServiceWorkerSync();
  } catch (error) {
    console.error("❌ [AUTH-TEST] Authentication failed:", error);
  }
}

console.log("🎯 Service Worker debug scripts loaded:");
console.log("  - Run debugServiceWorkerSync() to check sync and storage");
console.log("  - Run testAuthentication() to test auth and then sync");
