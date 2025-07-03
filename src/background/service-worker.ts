/**
 * Background Service Worker for Collaborative Text Expander
 * Handles CloudAdapter coordination, sync management, and extension lifecycle
 */

import { logVersion } from '../utils/version.js';
import { SyncManager } from './sync-manager.js';
import { ScopedSourceManager } from './scoped-source-manager.js';

// Log version on startup
logVersion();

// Initialize managers
let syncManager: SyncManager;
let scopedSourceManager: ScopedSourceManager;

// Extension installation and startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('📦 PuffPuffPaste installed:', details.reason);
  
  // Initialize managers
  syncManager = SyncManager.getInstance();
  scopedSourceManager = ScopedSourceManager.getInstance();
  
  await syncManager.initialize();
  await scopedSourceManager.initialize();
  
  if (details.reason === 'install') {
    console.log('🎉 First installation - initializing extension');
    // TODO: Initialize default settings and show onboarding
  } else if (details.reason === 'update') {
    console.log('🔄 Extension updated - checking for migrations');
    // TODO: Handle version migrations if needed
  }
});

// Extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Extension starting up');
  logVersion();
  
  // Re-initialize managers on startup
  if (!syncManager) {
    syncManager = SyncManager.getInstance();
    scopedSourceManager = ScopedSourceManager.getInstance();
    
    await syncManager.initialize();
    await scopedSourceManager.initialize();
  }
});

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
        case 'AUTHENTICATE_CLOUD':
          const credentials = await syncManager.authenticate();
          sendResponse({ success: true, data: credentials });
          break;
          
        case 'SYNC_SNIPPETS':
          await syncManager.syncNow();
          sendResponse({ success: true });
          break;
          
        case 'GET_SYNC_STATUS':
          const syncStatus = await syncManager.getSyncStatus();
          sendResponse({ success: true, data: syncStatus });
          break;
          
        case 'SET_CLOUD_PROVIDER':
          await syncManager.setCloudProvider(message.provider);
          sendResponse({ success: true });
          break;

        case 'SETUP_LOCAL_FILESYSTEM_SOURCES':
          // This operation must be initiated from the UI, not the service worker
          sendResponse({ 
            success: false, 
            error: 'Local filesystem setup must be initiated from options page' 
          });
          break;

        case 'ADD_LOCAL_FILESYSTEM_SOURCE':
          await scopedSourceManager.addLocalFilesystemSource(message.scope, message.directoryHandle);
          sendResponse({ success: true });
          break;

        case 'SYNC_ALL_SCOPED_SOURCES':
          const mergedSnippets = await scopedSourceManager.syncAllSources();
          sendResponse({ success: true, data: mergedSnippets });
          break;

        case 'GET_SCOPED_SOURCES':
          const sources = scopedSourceManager.getScopedSources();
          sendResponse({ success: true, data: sources });
          break;

        case 'GET_SCOPED_SYNC_STATUS':
          const scopedStatus = await scopedSourceManager.getSyncStatus();
          sendResponse({ success: true, data: scopedStatus });
          break;

        case 'ADD_SNIPPET_TO_SCOPE':
          await scopedSourceManager.addSnippetToScope(message.snippet, message.scope);
          sendResponse({ success: true });
          break;

        case 'ADD_SNIPPET':
          const newSnippet = {
            ...message.snippet,
            id: crypto.randomUUID(), // Generate a unique ID
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await ExtensionStorage.addSnippet(newSnippet);
          sendResponse({ success: true, data: newSnippet });
          break;

        case 'UPDATE_SNIPPET':
          await ExtensionStorage.updateSnippet(message.id, message.updates);
          sendResponse({ success: true });
          break;

        case 'GET_SNIPPETS':
          const snippets = await ExtensionStorage.getSnippets();
          sendResponse({ success: true, data: snippets });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  })();
  
  // Return true to indicate async response
  return true;
});

// Keep service worker alive with periodic tasks
setInterval(() => {
  console.log('💓 Service worker heartbeat');
}, 30000);

console.log('✅ Background service worker initialized');