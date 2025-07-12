/**
 * Debug script to test Google Drive sync process
 * Run this in the Chrome extension context to debug the sync issue
 */

async function debugSyncProcess() {
  console.log("🔍 Starting sync debug process...");

  try {
    // Step 1: Check current storage state
    console.log("📚 Step 1: Checking current storage state...");
    const { ExtensionStorage } = await import("./src/shared/storage.js");
    const currentSnippets = await ExtensionStorage.getSnippets();
    console.log(
      `📋 Current storage has ${currentSnippets.length} snippets:`,
      currentSnippets.map((s) => ({ trigger: s.trigger, source: s.source })),
    );

    // Step 2: Check IndexedDB directly
    console.log("💾 Step 2: Checking IndexedDB directly...");
    const { IndexedDB } = await import("./src/shared/indexed-db.js");
    const db = new IndexedDB();
    const indexedDBSnippets = await db.getSnippets();
    console.log(
      `📋 IndexedDB has ${indexedDBSnippets.length} snippets:`,
      indexedDBSnippets.map((s) => ({ trigger: s.trigger, source: s.source })),
    );

    // Step 3: Get sync manager and test sync
    console.log("🔄 Step 3: Testing sync process...");
    const { SyncManager } = await import("./src/background/sync-manager.js");
    const syncManager = SyncManager.getInstance();

    // Check if authenticated
    const isAuth = await syncManager.isAuthenticated();
    console.log(`🔐 Is authenticated: ${isAuth}`);

    if (!isAuth) {
      console.log("🔐 Not authenticated, attempting authentication...");
      try {
        await syncManager.authenticate();
        console.log("✅ Authentication successful");
      } catch (error) {
        console.error("❌ Authentication failed:", error);
        return;
      }
    }

    // Step 4: Trigger manual sync
    console.log("🔄 Step 4: Triggering manual sync...");
    await syncManager.syncNow();
    console.log("✅ Sync completed");

    // Step 5: Check storage again after sync
    console.log("📚 Step 5: Checking storage after sync...");
    const postSyncSnippets = await ExtensionStorage.getSnippets();
    console.log(
      `📋 Post-sync storage has ${postSyncSnippets.length} snippets:`,
      postSyncSnippets.map((s) => ({ trigger: s.trigger, source: s.source })),
    );

    // Step 6: Check if ;pony is now available
    const ponySnippet = postSyncSnippets.find((s) => s.trigger === ";pony");
    if (ponySnippet) {
      console.log("✅ Found ;pony snippet after sync:", ponySnippet);
    } else {
      console.log("❌ ;pony snippet still not found after sync");
    }

    // Step 7: Test Google Drive adapter directly
    console.log("🔍 Step 7: Testing Google Drive adapter directly...");
    const settings = await ExtensionStorage.getSettings();
    console.log(`⚙️ Cloud provider setting: ${settings.cloudProvider}`);

    if (settings.cloudProvider === "google-drive") {
      try {
        const { GoogleDriveAdapter } = await import(
          "./src/background/cloud-adapters/google-drive-adapter.js"
        );
        const adapter = new GoogleDriveAdapter();

        // Initialize with stored credentials
        const credentials = await ExtensionStorage.getCloudCredentials();
        if (credentials) {
          await adapter.initialize(credentials);

          // Test file listing
          const files = await adapter.listFiles();
          console.log(
            `📁 Google Drive folder contains ${files.length} files:`,
            files,
          );

          // Test downloading snippets
          const downloadResult = await adapter.downloadSnippets();
          console.log(
            `📥 Downloaded ${downloadResult.length} snippets from Google Drive:`,
            downloadResult.map((s) => ({
              trigger: s.trigger,
              content: s.content.substring(0, 50) + "...",
            })),
          );
        } else {
          console.log("❌ No stored credentials found");
        }
      } catch (error) {
        console.error("❌ Google Drive adapter test failed:", error);
      }
    }
  } catch (error) {
    console.error("❌ Debug process failed:", error);
  }
}

// Run the debug process
debugSyncProcess();
