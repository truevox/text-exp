/**
 * Debug script to check IndexedDB contents and force sync
 * Run this in the extension service worker console
 */

async function debugIndexedDBAndSync() {
  console.log("🔍 [DEBUG] Starting IndexedDB and sync investigation...");

  try {
    // Step 1: Check current IndexedDB contents
    console.log("📊 [DEBUG] Step 1: Checking current IndexedDB contents...");
    const { IndexedDB } = await import("./src/shared/indexed-db.js");
    const db = new IndexedDB();
    const dbSnippets = await db.getSnippets();

    console.log(
      `💾 [DEBUG] IndexedDB currently contains ${dbSnippets.length} snippets:`,
    );
    dbSnippets.forEach((snippet, index) => {
      console.log(`  📋 DB Snippet ${index + 1}:`, {
        id: snippet.id,
        trigger: snippet.trigger,
        content: snippet.content?.substring(0, 50) + "...",
        source: snippet.source,
      });
    });

    const ponyInDB = dbSnippets.find((s) => s.trigger === ";pony");
    console.log(
      `🐴 [DEBUG] ;pony in IndexedDB: ${ponyInDB ? "FOUND" : "NOT FOUND"}`,
    );

    // Step 2: Check chrome.storage.local
    console.log("📦 [DEBUG] Step 2: Checking chrome.storage.local...");
    const { ExtensionStorage } = await import("./src/shared/storage.js");
    const localSnippets = await chrome.storage.local.get("snippets");
    const snippetsData = localSnippets.snippets || [];

    console.log(
      `🏠 [DEBUG] chrome.storage.local contains ${snippetsData.length} snippets:`,
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
      `🐴 [DEBUG] ;pony in chrome.storage.local: ${ponyInLocal ? "FOUND" : "NOT FOUND"}`,
    );

    // Step 3: Force a fresh sync
    console.log("🔄 [DEBUG] Step 3: Forcing fresh sync...");
    const { SyncManager } = await import("./src/background/sync-manager.js");
    const syncManager = SyncManager.getInstance();

    try {
      await syncManager.syncNow();
      console.log("✅ [DEBUG] Fresh sync completed");

      // Step 4: Check IndexedDB again after sync
      console.log("📊 [DEBUG] Step 4: Checking IndexedDB after fresh sync...");
      const dbSnippetsAfter = await db.getSnippets();

      console.log(
        `💾 [DEBUG] IndexedDB after sync contains ${dbSnippetsAfter.length} snippets:`,
      );
      dbSnippetsAfter.forEach((snippet, index) => {
        console.log(`  📋 Post-sync DB Snippet ${index + 1}:`, {
          id: snippet.id,
          trigger: snippet.trigger,
          content: snippet.content?.substring(0, 50) + "...",
          source: snippet.source,
        });
      });

      const ponyAfterSync = dbSnippetsAfter.find((s) => s.trigger === ";pony");
      console.log(
        `🐴 [DEBUG] ;pony in IndexedDB after sync: ${ponyAfterSync ? "FOUND" : "STILL NOT FOUND"}`,
      );

      if (ponyAfterSync) {
        console.log("🎉 [DEBUG] SUCCESS: ;pony is now in IndexedDB!");
        console.log("🔄 [DEBUG] Notifying content scripts...");
        const { notifyContentScriptsOfSnippetUpdate } = await import(
          "./src/background/messaging-helpers.js"
        );
        await notifyContentScriptsOfSnippetUpdate();
        console.log("📢 [DEBUG] Content scripts notified");
      } else {
        console.error(
          "💥 [DEBUG] FAILURE: ;pony is still missing from IndexedDB after sync!",
        );

        // Try to manually add it if we found it in cloud
        console.log("🔧 [DEBUG] Attempting manual recovery...");
        // This will be handled by the sync process debugging
      }
    } catch (syncError) {
      console.error("❌ [DEBUG] Sync failed:", syncError);
    }
  } catch (error) {
    console.error("❌ [DEBUG] Debug script failed:", error);
  }
}

// Run the debug
console.log(
  "🎯 IndexedDB and sync debug script loaded. Run debugIndexedDBAndSync() to execute.",
);
