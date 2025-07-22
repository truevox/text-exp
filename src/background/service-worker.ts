/**
 * Background Service Worker for Collaborative Text Expander
 * Handles CloudAdapter coordination, sync management, and extension lifecycle
 */

import { logVersion } from "../utils/version.js";
import { SyncManager } from "./sync-manager.js";
import { ScopedSourceManager } from "./scoped-source-manager.js";
import { ImageProcessor } from "./image-processor.js";
import { DefaultStoreInitializer } from "./default-store-initializer.js";
import { sanitizeHtml } from "../shared/sanitizer.js";
import { ExtensionStorage } from "../shared/storage.js";
import { IndexedDB } from "../shared/indexed-db.js";
import { notifyContentScriptsOfSnippetUpdate } from "./messaging-helpers.js";
import type { CloudProvider } from "../shared/types.js";

// Log version on startup
logVersion();

// Initialize managers
let syncManager: SyncManager;
let scopedSourceManager: ScopedSourceManager;
let imageProcessor: ImageProcessor;
let defaultStoreInitializer: DefaultStoreInitializer;

// Extension installation and startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("📦 PuffPuffPaste installed:", details.reason);

  try {
    // Initialize managers
    syncManager = SyncManager.getInstance();
    scopedSourceManager = ScopedSourceManager.getInstance();
    imageProcessor = new ImageProcessor();

    await syncManager.initialize();
    await scopedSourceManager.initialize();

    console.log("✅ Extension managers initialized successfully");

    // Automatically attempt Google Drive authentication
    await attemptAutoGoogleDriveAuth();

    if (details.reason === "install") {
      console.log("🎉 First installation - extension ready to use");
    } else if (details.reason === "update") {
      console.log("🔄 Extension updated - checking for migrations");
      // TODO: Handle version migrations if needed
    }
  } catch (error) {
    console.error("❌ Failed to initialize extension managers:", error);
    // Ensure extension still works in basic mode even if cloud auth fails
    console.log("🔄 Extension will continue in local mode");
  }
});

// Extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("🚀 Extension starting up");
  logVersion();

  try {
    // Re-initialize managers on startup
    if (!syncManager) {
      syncManager = SyncManager.getInstance();
      scopedSourceManager = ScopedSourceManager.getInstance();
      defaultStoreInitializer = DefaultStoreInitializer.getInstance();

      await syncManager.initialize();
      await scopedSourceManager.initialize();

      console.log("✅ Extension managers re-initialized successfully");
    }

    // Automatically attempt Google Drive authentication on startup
    await attemptAutoGoogleDriveAuth();
  } catch (error) {
    console.error("❌ Failed to re-initialize extension managers:", error);
    // Ensure extension still works in basic mode even if cloud auth fails
    console.log("🔄 Extension will continue in local mode");
  }
});

// Handle global keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
  console.log("⌨️ Global command received:", command);

  try {
    if (command === "toggle-expansion") {
      // Get current settings
      const settings = await ExtensionStorage.getSettings();

      // Check if global toggle is enabled
      if (!settings.globalToggleEnabled) {
        console.log("🚫 Global toggle is disabled in settings");
        return;
      }

      // Toggle the enabled state
      const newEnabledState = !settings.enabled;
      await ExtensionStorage.setSettings({
        ...settings,
        enabled: newEnabledState,
      });

      console.log(
        `🔄 Text expansion toggled ${newEnabledState ? "ON" : "OFF"}`,
      );

      // Show notification if enabled
      if (settings.showNotifications) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon-48.png",
          title: "PuffPuffPaste",
          message: `Text expansion ${newEnabledState ? "enabled" : "disabled"}`,
        });
      }

      // Broadcast the settings change to all content scripts
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: "SETTINGS_UPDATED",
                settings: { ...settings, enabled: newEnabledState },
              })
              .catch(() => {
                // Ignore errors for tabs that don't have content scripts
              });
          }
        });
      });
    }
  } catch (error) {
    console.error("❌ Error handling global command:", error);
  }
});

/**
 * Automatically attempt Google Drive authentication and default store creation
 */
async function attemptAutoGoogleDriveAuth(): Promise<void> {
  try {
    console.log("🔐 Attempting automatic Google Drive authentication...");

    if (!syncManager) {
      console.log("⚠️ SyncManager not initialized, skipping auto auth");
      return;
    }

    // Set Google Drive as the default provider
    await syncManager.setCloudProvider("google-drive");

    // Check if already authenticated
    if (await syncManager.isAuthenticated()) {
      console.log("✅ Already authenticated with Google Drive");
      await initializeDefaultStoreIfNeeded();
      return;
    }

    // Attempt silent authentication (using stored credentials)
    console.log("🔄 Attempting silent authentication...");
    const settings = await ExtensionStorage.getSettings();

    // Update settings to use Google Drive as default
    if (settings.cloudProvider !== "google-drive") {
      await ExtensionStorage.setSettings({
        ...settings,
        cloudProvider: "google-drive",
      });
    }

    // Try to authenticate with stored credentials
    const credentials = await ExtensionStorage.getCloudCredentials();
    if (credentials && credentials.provider === "google-drive") {
      // Validate existing credentials
      try {
        await syncManager.getCurrentAdapter()?.initialize(credentials);
        if (await syncManager.isAuthenticated()) {
          console.log("✅ Silent authentication successful");
          await initializeDefaultStoreIfNeeded();
          return;
        }
      } catch (error) {
        console.log("🔄 Stored credentials invalid, clearing...");
        await ExtensionStorage.clearCloudCredentials();
      }
    }

    // If no valid stored credentials, attempt interactive authentication
    // This will only show UI if absolutely necessary
    console.log("🔄 Attempting interactive authentication...");
    try {
      // Clear any cached tokens first to ensure fresh authentication
      await ExtensionStorage.clearCloudCredentials();
      console.log(
        "🗑️ Cleared stored credentials, forcing fresh authentication",
      );

      const newCredentials = await syncManager.authenticate();
      console.log("✅ Interactive authentication successful");
      await initializeDefaultStoreIfNeeded();
    } catch (authError) {
      console.log(
        "⚠️ Interactive authentication failed, will remain in local mode:",
        authError,
      );
      // Extension will work in local mode, this is expected behavior
    }
  } catch (error) {
    console.log("⚠️ Auto Google Drive authentication failed:", error);
    // This is not a critical error - extension can work without cloud sync
  }
}

/**
 * Initialize default appdata store if needed
 */
async function initializeDefaultStoreIfNeeded(): Promise<void> {
  try {
    if (!defaultStoreInitializer) {
      defaultStoreInitializer = DefaultStoreInitializer.getInstance();
    }

    const needsInit = await defaultStoreInitializer.needsInitialization();
    if (needsInit) {
      console.log("🎯 Auto-initializing default appdata store...");
      const credentials = await ExtensionStorage.getCloudCredentials();
      if (credentials) {
        await defaultStoreInitializer.initializeDefaultStore(credentials);
        console.log("✅ Default appdata store auto-initialized successfully");
      }
    } else {
      console.log("✅ Default appdata store already exists");
    }
  } catch (error) {
    console.log("⚠️ Failed to initialize default store:", error);
    // This is not critical - user can still use the extension
  }
}

// Message handling for sync operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!syncManager) {
        syncManager = SyncManager.getInstance();
        scopedSourceManager = ScopedSourceManager.getInstance();

        await syncManager.initialize();
        await scopedSourceManager.initialize();
      }

      switch (message.type) {
        case "AUTHENTICATE_CLOUD": {
          const credentials = await syncManager.authenticate();
          sendResponse({ success: true, data: credentials });
          break;
        }

        case "AUTHENTICATE_GOOGLE_DRIVE": {
          await syncManager.setCloudProvider("google-drive");
          const credentials = await syncManager.authenticate();

          // Initialize default appdata store for new users
          try {
            if (!defaultStoreInitializer) {
              defaultStoreInitializer = DefaultStoreInitializer.getInstance();
            }

            const needsInit =
              await defaultStoreInitializer.needsInitialization();
            if (needsInit) {
              console.log(
                "🎯 Initializing default appdata store for new user...",
              );
              await defaultStoreInitializer.initializeDefaultStore(credentials);
              console.log("✅ Default appdata store initialized successfully");
            }
          } catch (initError) {
            console.error("⚠️ Failed to initialize default store:", initError);
            // Don't fail authentication if default store initialization fails
          }

          sendResponse({ success: true, data: credentials });
          break;
        }

        case "SELECT_CLOUD_FOLDER": {
          const selectedFolder = await syncManager.selectFolder(
            message.provider,
            message.scope,
          );
          sendResponse({ success: true, data: selectedFolder });
          break;
        }

        case "SYNC_SNIPPETS": {
          console.log("🔄 [SYNC-DEBUG] Manual sync triggered from message");
          try {
            await syncManager.syncNow();
            console.log("✅ [SYNC-DEBUG] Manual sync completed successfully");
            sendResponse({ success: true });
          } catch (error) {
            console.error("❌ [SYNC-DEBUG] Manual sync failed:", error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Sync failed",
            });
          }
          break;
        }

        case "GET_SYNC_STATUS": {
          const syncStatus = await syncManager.getSyncStatus();
          sendResponse({ success: true, data: syncStatus });
          break;
        }

        case "CHECK_AUTH_STATUS": {
          try {
            const isAuthenticated = await syncManager.isAuthenticated();
            const currentProvider = syncManager.getCurrentProvider();

            let authData: {
              isAuthenticated: boolean;
              provider: CloudProvider | null;
              expiresAt?: Date;
              email?: string;
            } = {
              isAuthenticated,
              provider: currentProvider,
            };

            // If authenticated, get additional details
            if (isAuthenticated && currentProvider !== "local") {
              const credentials = await ExtensionStorage.getCloudCredentials();
              if (credentials) {
                authData = {
                  ...authData,
                  expiresAt: credentials.expiresAt,
                  email: credentials.email,
                };
              }
            }

            sendResponse({ success: true, data: authData });
          } catch (error) {
            console.error("Error checking auth status:", error);
            sendResponse({
              success: true,
              data: {
                isAuthenticated: false,
                provider: syncManager.getCurrentProvider() || "local",
              },
            });
          }
          break;
        }

        case "SET_CLOUD_PROVIDER":
          await syncManager.setCloudProvider(message.provider);
          sendResponse({ success: true });
          break;

        case "SETUP_LOCAL_FILESYSTEM_SOURCES":
          // This operation must be initiated from the UI, not the service worker
          sendResponse({
            success: false,
            error: "Local filesystem setup must be initiated from options page",
          });
          break;

        case "SYNC_ALL_SCOPED_SOURCES": {
          const mergedSnippets = await scopedSourceManager.syncAllSources();
          sendResponse({ success: true, data: mergedSnippets });
          break;
        }

        case "GET_SCOPED_SOURCES": {
          const sources = scopedSourceManager.getScopedSources();
          sendResponse({ success: true, data: sources });
          break;
        }

        case "GET_SCOPED_SYNC_STATUS": {
          const scopedStatus = await scopedSourceManager.getSyncStatus();
          sendResponse({ success: true, data: scopedStatus });
          break;
        }

        case "ADD_SNIPPET_TO_SCOPE":
          await scopedSourceManager.addSnippetToScope(
            message.snippet,
            message.scope,
          );
          sendResponse({ success: true });
          break;

        case "ADD_SNIPPET": {
          let snippetContentToAdd = message.snippet.content;
          if (message.snippet.contentType === "html") {
            snippetContentToAdd = sanitizeHtml(snippetContentToAdd);
            snippetContentToAdd =
              await imageProcessor.processHtmlContent(snippetContentToAdd);
          }
          const newSnippet = {
            ...message.snippet,
            content: snippetContentToAdd,
            id: crypto.randomUUID(), // Generate a unique ID
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await ExtensionStorage.addSnippet(newSnippet);
          sendResponse({ success: true, data: newSnippet });
          break;
        }

        case "UPDATE_SNIPPET": {
          let snippetContentToUpdate = message.updates.content;
          if (message.updates.contentType === "html") {
            snippetContentToUpdate = sanitizeHtml(snippetContentToUpdate);
            snippetContentToUpdate = await imageProcessor.processHtmlContent(
              snippetContentToUpdate,
            );
          }
          await ExtensionStorage.updateSnippet(message.id, {
            ...message.updates,
            content: snippetContentToUpdate,
          });
          sendResponse({ success: true });
          break;
        }

        case "DELETE_SNIPPET":
          await ExtensionStorage.deleteSnippet(message.id);
          sendResponse({ success: true });
          break;

        case "GET_SNIPPETS": {
          const snippets = await ExtensionStorage.getSnippets();
          sendResponse({ success: true, data: snippets });
          break;
        }

        case "GET_SETTINGS": {
          const settings = await ExtensionStorage.getSettings();
          sendResponse({ success: true, data: settings });
          break;
        }

        case "UPDATE_SETTINGS":
          await ExtensionStorage.setSettings(message.settings);
          sendResponse({ success: true });
          break;

        case "DISCONNECT_CLOUD":
          await syncManager.disconnect();
          sendResponse({ success: true });
          break;

        case "DISCONNECT_GOOGLE_DRIVE":
          await syncManager.disconnect();
          sendResponse({ success: true });
          break;

        case "FORCE_REAUTH_GOOGLE_DRIVE": {
          try {
            console.log("🔄 Forcing Google Drive re-authentication...");

            // Clear stored credentials
            await ExtensionStorage.clearCloudCredentials();

            // Set Google Drive as provider
            await syncManager.setCloudProvider("google-drive");

            // Force fresh authentication
            const newCredentials = await syncManager.authenticate();

            // Initialize default store if needed
            await initializeDefaultStoreIfNeeded();

            console.log("✅ Forced re-authentication successful");
            sendResponse({ success: true, data: newCredentials });
          } catch (error) {
            console.error("❌ Failed to force re-authentication:", error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
          break;
        }

        case "CHECK_GOOGLE_DRIVE_CONNECTION": {
          console.log("🔍 [DEBUG] Checking Google Drive connection status...");
          try {
            if (!syncManager) {
              console.error("❌ [DEBUG] SyncManager not available");
              sendResponse({
                success: false,
                error: "Extension not initialized",
              });
              break;
            }

            const currentProvider = syncManager.getCurrentProvider();
            console.log("🔍 [DEBUG] Current provider:", currentProvider);

            if (currentProvider !== "google-drive") {
              console.log("⚠️ [DEBUG] Google Drive not set as provider");
              sendResponse({
                success: false,
                error: "Google Drive not connected",
              });
              break;
            }

            const isAuthenticated = await syncManager.isAuthenticated();
            console.log("🔍 [DEBUG] Authentication status:", isAuthenticated);

            if (!isAuthenticated) {
              console.log("⚠️ [DEBUG] Not authenticated with Google Drive");
              sendResponse({
                success: false,
                error: "Not authenticated with Google Drive",
              });
              break;
            }

            console.log("✅ [DEBUG] Google Drive connection verified");
            sendResponse({ success: true });
          } catch (error) {
            console.error(
              "❌ [DEBUG] Error checking Google Drive connection:",
              error,
            );
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        }

        case "CREATE_GOOGLE_DRIVE_FOLDER": {
          const newFolder = await syncManager.createCloudFolder(
            message.folderName,
            message.parentId,
          );
          sendResponse({ success: true, data: newFolder });
          break;
        }

        case "GET_DEFAULT_STORE_STATUS": {
          try {
            if (!defaultStoreInitializer) {
              defaultStoreInitializer = DefaultStoreInitializer.getInstance();
            }

            const status =
              await defaultStoreInitializer.getDefaultStoreStatus();
            sendResponse({ success: true, data: status });
          } catch (error) {
            console.error("❌ Failed to get default store status:", error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
          break;
        }

        case "SAVE_SNIPPET": {
          try {
            console.log("💾 Saving new snippet to local storage...");

            if (!message.snippet) {
              sendResponse({
                success: false,
                error: "No snippet data provided",
              });
              break;
            }

            // Use static import (already imported at top)
            const indexedDB = new IndexedDB();
            
            // Get existing snippets and add the new one
            const existingSnippets = await indexedDB.getSnippets();
            const updatedSnippets = [...existingSnippets, message.snippet];
            
            // Save all snippets including the new one
            await indexedDB.saveSnippets(updatedSnippets);
            
            console.log("✅ Snippet saved to local storage");
            
            // Notify content scripts to reload snippets
            await notifyContentScriptsOfSnippetUpdate();
            console.log("📢 Notified content scripts of snippet update");
            
            // If sync manager is available, try to sync to cloud
            if (syncManager) {
              try {
                await syncManager.syncNow();
                console.log("✅ Snippet synced to cloud");
              } catch (syncError) {
                console.warn("⚠️ Cloud sync failed, but snippet saved locally:", syncError);
              }
            }
            
            sendResponse({ success: true });
          } catch (error) {
            console.error("❌ Failed to save snippet:", error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Failed to save snippet",
            });
          }
          break;
        }

        case "INITIALIZE_DEFAULT_STORE": {
          try {
            if (!defaultStoreInitializer) {
              defaultStoreInitializer = DefaultStoreInitializer.getInstance();
            }

            const credentials = await ExtensionStorage.getCloudCredentials();
            if (!credentials) {
              sendResponse({
                success: false,
                error: "No credentials available. Please authenticate first.",
              });
              break;
            }

            await defaultStoreInitializer.initializeDefaultStore(credentials);
            sendResponse({ success: true });
          } catch (error) {
            console.error("❌ Failed to initialize default store:", error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
          break;
        }

        case "CREATE_CUSTOM_STORE": {
          try {
            console.log(
              "📝 Creating custom store:",
              message.scope,
              message.storeName,
            );

            const credentials = await ExtensionStorage.getCloudCredentials();
            if (!credentials) {
              sendResponse({
                success: false,
                error: "No credentials available. Please authenticate first.",
              });
              break;
            }

            const { GoogleDriveFilePickerService } = await import(
              "./cloud-adapters/google-drive/file-picker-service.js"
            );

            // Create structured snippet store
            const storeFile =
              await GoogleDriveFilePickerService.createStructuredSnippetStore(
                credentials,
                message.scope,
                message.description,
              );

            // Add to configured sources
            const settings = await ExtensionStorage.getSettings();
            if (!settings.configuredSources) {
              settings.configuredSources = [];
            }

            const newSource = {
              provider: "google-drive" as const,
              scope: message.scope,
              folderId: storeFile.fileId,
              displayName: message.storeName,
            };

            settings.configuredSources.push(newSource);
            await ExtensionStorage.setSettings(settings);

            console.log("✅ Custom store created and configured:", newSource);
            sendResponse({ success: true, data: newSource });
          } catch (error) {
            console.error("❌ Failed to create custom store:", error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
          break;
        }

        case "VALIDATE_STORE_FILE": {
          try {
            console.log("🔍 Validating store file:", message.fileId);

            const credentials = await ExtensionStorage.getCloudCredentials();
            if (!credentials) {
              sendResponse({
                success: false,
                error: "No credentials available. Please authenticate first.",
              });
              break;
            }

            const { GoogleDriveFilePickerService } = await import(
              "./cloud-adapters/google-drive/file-picker-service.js"
            );

            // Validate file format and access
            const validation =
              await GoogleDriveFilePickerService.validateSnippetStoreFile(
                credentials,
                message.fileId,
              );

            if (!validation.isValid) {
              sendResponse({
                success: false,
                error: validation.reason || "File validation failed",
              });
              break;
            }

            // Test file access
            const accessTest =
              await GoogleDriveFilePickerService.testFileAccess(
                credentials,
                message.fileId,
              );

            sendResponse({
              success: true,
              data: {
                isValid: validation.isValid,
                canWrite: validation.canWrite && accessTest.canWrite,
                canRead: accessTest.canRead,
              },
            });
          } catch (error) {
            console.error("❌ File validation failed:", error);
            sendResponse({
              success: false,
              error:
                error instanceof Error ? error.message : "Validation failed",
            });
          }
          break;
        }

        case "GET_FILE_FROM_SHARE_LINK": {
          try {
            console.log(
              "🔗 Extracting file ID from share link:",
              message.shareLink,
            );

            // Extract file ID from Google Drive share link
            const fileId = extractFileIdFromShareLink(message.shareLink);

            if (!fileId) {
              sendResponse({
                success: false,
                error:
                  "Invalid Google Drive share link. Please check the link format.",
              });
              break;
            }

            // Validate the extracted file ID
            const credentials = await ExtensionStorage.getCloudCredentials();
            if (!credentials) {
              sendResponse({
                success: false,
                error: "No credentials available. Please authenticate first.",
              });
              break;
            }

            const { GoogleDriveFilePickerService } = await import(
              "./cloud-adapters/google-drive/file-picker-service.js"
            );

            const fileInfo = await GoogleDriveFilePickerService.getFileInfo(
              credentials,
              fileId,
            );

            sendResponse({
              success: true,
              data: {
                fileId: fileId,
                fileName: fileInfo.name,
                mimeType: fileInfo.mimeType,
              },
            });
          } catch (error) {
            console.error("❌ Failed to process share link:", error);
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to process share link",
            });
          }
          break;
        }

        case "SELECT_EXISTING_STORE": {
          try {
            console.log(
              "📁 Configuring existing store:",
              message.fileId,
              message.scope,
            );

            const credentials = await ExtensionStorage.getCloudCredentials();
            if (!credentials) {
              sendResponse({
                success: false,
                error: "No credentials available. Please authenticate first.",
              });
              break;
            }

            // First validate the file
            const { GoogleDriveFilePickerService } = await import(
              "./cloud-adapters/google-drive/file-picker-service.js"
            );

            const validation =
              await GoogleDriveFilePickerService.validateSnippetStoreFile(
                credentials,
                message.fileId,
              );

            if (!validation.isValid) {
              sendResponse({
                success: false,
                error:
                  validation.reason ||
                  "Selected file is not a valid snippet store",
              });
              break;
            }

            const fileInfo = await GoogleDriveFilePickerService.getFileInfo(
              credentials,
              message.fileId,
            );

            // Add to configured sources
            const settings = await ExtensionStorage.getSettings();
            if (!settings.configuredSources) {
              settings.configuredSources = [];
            }

            // Check for duplicates
            const existingSource = settings.configuredSources.find(
              (source) => source.folderId === message.fileId,
            );

            if (existingSource) {
              sendResponse({
                success: false,
                error: "This file is already configured as a snippet store",
              });
              break;
            }

            const newSource = {
              provider: "google-drive" as const,
              scope: message.scope,
              folderId: message.fileId,
              displayName:
                message.displayName || fileInfo.name.replace(".json", ""),
            };

            settings.configuredSources.push(newSource);
            await ExtensionStorage.setSettings(settings);

            console.log("✅ Existing store configured:", newSource);
            sendResponse({ success: true, data: newSource });
          } catch (error) {
            console.error("❌ Failed to configure existing store:", error);
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to configure store",
            });
          }
          break;
        }

        case "TEST_GOOGLE_DRIVE_API": {
          try {
            console.log("🧪 [DEBUG] Testing Google Drive API access...");
            const { GoogleDriveAdapter } = await import(
              "./cloud-adapters/google-drive-adapter.js"
            );
            const adapter = new GoogleDriveAdapter();

            // Get stored credentials
            const credentials = await ExtensionStorage.getCloudCredentials();
            if (!credentials) {
              sendResponse({
                success: false,
                error:
                  "No stored credentials found. Please authenticate first.",
              });
              break;
            }

            // Initialize adapter
            await adapter.initialize(credentials);

            // Run debug flow
            const debugResult = await adapter.debugCompleteFlow();

            sendResponse({ success: true, data: debugResult });
          } catch (error) {
            console.error("❌ [DEBUG] Google Drive API test failed:", error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
          break;
        }

        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("Background script error:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })();

  // Return true to indicate async response
  return true;
});

/**
 * Extract file ID from Google Drive share link
 * Supports various Google Drive URL formats
 */
function extractFileIdFromShareLink(shareLink: string): string | null {
  if (!shareLink || typeof shareLink !== "string") {
    return null;
  }

  // Common Google Drive share link patterns
  const patterns = [
    // https://drive.google.com/file/d/FILE_ID/view
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    // https://drive.google.com/open?id=FILE_ID
    /[?&]id=([a-zA-Z0-9-_]+)/,
    // https://docs.google.com/document/d/FILE_ID/
    /\/document\/d\/([a-zA-Z0-9-_]+)/,
    // https://docs.google.com/spreadsheets/d/FILE_ID/
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    // Direct file ID (if user just pastes the ID)
    /^([a-zA-Z0-9-_]{25,})$/,
  ];

  for (const pattern of patterns) {
    const match = shareLink.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// Keep service worker alive with periodic tasks
setInterval(() => {
  console.log("💓 Service worker heartbeat");
}, 30000);

console.log("✅ Background service worker initialized");
