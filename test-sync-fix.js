/**
 * Comprehensive sync test script
 * This should be run in the extension's background script console
 * Go to chrome://extensions/ -> PuffPuffPaste -> Inspect views: service worker
 */

async function comprehensiveSyncTest() {
  console.log("🔍 [COMPREHENSIVE-TEST] Starting comprehensive sync test...");

  try {
    // Step 1: Check current state
    console.log("📚 [TEST] Step 1: Checking current state...");
    const { ExtensionStorage } = await import("./src/shared/storage.js");
    const currentSnippets = await ExtensionStorage.getSnippets();
    console.log(`📋 [TEST] Current snippets: ${currentSnippets.length}`);
    currentSnippets.forEach((snippet, index) => {
      console.log(
        `  ${index + 1}. ${snippet.trigger} (${snippet.source || "unknown"})`,
      );
    });

    // Check for ;pony before sync
    const ponyBefore = currentSnippets.find((s) => s.trigger === ";pony");
    console.log(
      `🐴 [TEST] ;pony before sync: ${ponyBefore ? "FOUND" : "NOT FOUND"}`,
    );

    // Step 2: Check settings and provider
    console.log("⚙️ [TEST] Step 2: Checking settings...");
    const settings = await ExtensionStorage.getSettings();
    console.log(`🔧 [TEST] Cloud provider: ${settings.cloudProvider}`);
    console.log(`🔧 [TEST] Auto sync: ${settings.autoSync}`);

    if (settings.cloudProvider === "local") {
      console.warn(
        "⚠️ [TEST] Cloud provider is set to 'local' - no cloud sync will occur!",
      );
      return;
    }

    // Step 3: Get sync manager and force sync
    console.log("🔄 [TEST] Step 3: Forcing manual sync...");
    const { SyncManager } = await import("./src/background/sync-manager.js");
    const syncManager = SyncManager.getInstance();

    // Check authentication
    const isAuth = await syncManager.isAuthenticated();
    console.log(`🔐 [TEST] Is authenticated: ${isAuth}`);

    if (!isAuth) {
      console.warn("⚠️ [TEST] Not authenticated - sync will likely fail");
    }

    // Force sync
    console.log("🚀 [TEST] Triggering sync...");
    await syncManager.syncNow();
    console.log("✅ [TEST] Sync completed");

    // Step 4: Check results
    console.log("📊 [TEST] Step 4: Checking results after sync...");
    const postSyncSnippets = await ExtensionStorage.getSnippets();
    console.log(`📋 [TEST] Post-sync snippets: ${postSyncSnippets.length}`);
    postSyncSnippets.forEach((snippet, index) => {
      console.log(
        `  ${index + 1}. ${snippet.trigger} (${snippet.source || "unknown"})`,
      );
    });

    // Check for ;pony after sync
    const ponyAfter = postSyncSnippets.find((s) => s.trigger === ";pony");
    console.log(
      `🐴 [TEST] ;pony after sync: ${ponyAfter ? "FOUND" : "NOT FOUND"}`,
    );

    if (ponyAfter) {
      console.log(`✅ [TEST] SUCCESS: ;pony snippet is now available:`, {
        trigger: ponyAfter.trigger,
        content: ponyAfter.content,
        source: ponyAfter.source,
      });
    } else {
      console.error(
        `❌ [TEST] FAILED: ;pony snippet is still missing after sync`,
      );
      console.error(
        `🔍 [TEST] Available triggers:`,
        postSyncSnippets.map((s) => s.trigger),
      );
    }

    // Step 5: Test IndexedDB directly
    console.log("💾 [TEST] Step 5: Testing IndexedDB directly...");
    const { IndexedDB } = await import("./src/shared/indexed-db.js");
    const db = new IndexedDB();
    const dbSnippets = await db.getSnippets();
    console.log(`📋 [TEST] IndexedDB snippets: ${dbSnippets.length}`);

    const ponyInDB = dbSnippets.find((s) => s.trigger === ";pony");
    console.log(
      `🐴 [TEST] ;pony in IndexedDB: ${ponyInDB ? "FOUND" : "NOT FOUND"}`,
    );

    // Summary
    console.log("\n📊 [TEST] SUMMARY:");
    console.log(`📈 [TEST] Snippets before sync: ${currentSnippets.length}`);
    console.log(`📈 [TEST] Snippets after sync: ${postSyncSnippets.length}`);
    console.log(`🐴 [TEST] ;pony before: ${ponyBefore ? "YES" : "NO"}`);
    console.log(`🐴 [TEST] ;pony after: ${ponyAfter ? "YES" : "NO"}`);
    console.log(`💾 [TEST] ;pony in IndexedDB: ${ponyInDB ? "YES" : "NO"}`);

    if (ponyAfter && ponyInDB) {
      console.log("🎉 [TEST] SUCCESS: Sync is working correctly!");
    } else {
      console.error("💥 [TEST] FAILURE: Sync is not working correctly!");
    }
  } catch (error) {
    console.error("❌ [TEST] Test failed:", error);
  }
}

// Run the test
console.log(
  "🎯 Comprehensive sync test loaded. Run comprehensiveSyncTest() to execute.",
);
