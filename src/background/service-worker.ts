/**
 * Background Service Worker for Collaborative Text Expander
 * Handles CloudAdapter coordination, sync management, and extension lifecycle
 */

import { logVersion } from '../utils/version.js';

// Log version on startup
logVersion();

// Extension installation and startup
chrome.runtime.onInstalled.addListener((details) => {
  console.log('📦 Collaborative Text Expander installed:', details.reason);
  
  if (details.reason === 'install') {
    console.log('🎉 First installation - initializing extension');
    // TODO: Initialize default settings and show onboarding
  } else if (details.reason === 'update') {
    console.log('🔄 Extension updated - checking for migrations');
    // TODO: Handle version migrations if needed
  }
});

// Extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Extension starting up');
  logVersion();
});

// Keep service worker alive with periodic tasks
setInterval(() => {
  console.log('💓 Service worker heartbeat');
}, 30000);

console.log('✅ Background service worker initialized');