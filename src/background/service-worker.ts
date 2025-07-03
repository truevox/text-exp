/**
 * Background Service Worker for Collaborative Text Expander
 * Handles CloudAdapter coordination, sync management, and extension lifecycle
 */

import { logVersion } from '../utils/version.js';
import { SyncManager } from './sync-manager.js';
import { ScopedSourceManager } from './scoped-source-manager.js';
import { ImageProcessor } from './image-processor.js';
import { sanitizeHtml } from '../shared/sanitizer.js';
import { ExtensionStorage } from '../shared/storage.js';

// Log version on startup
logVersion();

// Initialize managers
let syncManager: SyncManager;
let scopedSourceManager: ScopedSourceManager;
let imageProcessor: ImageProcessor;

// Extension installation and startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('📦 PuffPuffPaste installed:', details.reason);
  
  // Initialize managers
  syncManager = SyncManager.getInstance();
  scopedSourceManager = ScopedSourceManager.getInstance();
  imageProcessor = new ImageProcessor();
  
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
          
        case 'SELECT_CLOUD_FOLDER':
          const selectedFolder = await syncManager.selectFolder(message.provider, message.scope);
          sendResponse({ success: true, data: selectedFolder });
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
          let snippetContentToAdd = message.snippet.content;
          if (message.snippet.contentType === 'html') {
            snippetContentToAdd = sanitizeHtml(snippetContentToAdd);
            snippetContentToAdd = await imageProcessor.processHtmlContent(snippetContentToAdd);
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

        case 'UPDATE_SNIPPET':
          let snippetContentToUpdate = message.updates.content;
          if (message.updates.contentType === 'html') {
            snippetContentToUpdate = sanitizeHtml(snippetContentToUpdate);
            snippetContentToUpdate = await imageProcessor.processHtmlContent(snippetContentToUpdate);
          }
          await ExtensionStorage.updateSnippet(message.id, { ...message.updates, content: snippetContentToUpdate });
          sendResponse({ success: true });
          break;

        case 'DELETE_SNIPPET':
          await ExtensionStorage.deleteSnippet(message.id);
          sendResponse({ success: true });
          break;

        case 'GET_SNIPPETS':
          const snippets = await ExtensionStorage.getSnippets();
          sendResponse({ success: true, data: snippets });
          break;
          
        case 'GET_SETTINGS':
          const settings = await ExtensionStorage.getSettings();
          sendResponse({ success: true, data: settings });
          break;

        case 'UPDATE_SETTINGS':
          await ExtensionStorage.setSettings(message.settings);
          sendResponse({ success: true });
          break;

        case 'DISCONNECT_CLOUD':
          await syncManager.disconnect();
          sendResponse({ success: true });
          break;

        case 'GET_GOOGLE_DRIVE_FOLDERS':
          const folders = await syncManager.getGoogleDriveFolders(message.parentId);
          sendResponse({ success: true, data: folders });
          break;

        case 'CREATE_GOOGLE_DRIVE_FOLDER':
          const newFolder = await syncManager.createGoogleDriveFolder(message.folderName, message.parentId);
          sendResponse({ success: true, data: newFolder });
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