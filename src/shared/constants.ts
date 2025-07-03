/**
 * Constants and configuration for Collaborative Text Expander
 */

/**
 * Extension configuration
 */
export const EXTENSION_CONFIG = {
  NAME: 'PuffPuffPaste',
  VERSION: '0.5.0',
  DESCRIPTION: 'Blow up your words! Expand text snippets with cloud synchronization',
} as const;

/**
 * Storage keys for Chrome extension storage
 */
export const STORAGE_KEYS = {
  SNIPPETS: 'snippets',
  SETTINGS: 'settings',
  SYNC_STATUS: 'syncStatus',
  CLOUD_CREDENTIALS: 'cloudCredentials',
  LAST_SYNC: 'lastSync',
} as const;

/**
 * Default extension settings
 */
export const DEFAULT_SETTINGS = {
  enabled: true,
  cloudProvider: 'local' as const,
  autoSync: true,
  syncInterval: 30, // minutes
  showNotifications: true,
  triggerDelay: 100, // milliseconds
  caseSensitive: false,
  enableSharedSnippets: true,
  triggerPrefix: ';',
  excludePasswords: true,
  configuredSources: [],
};

/**
 * Cloud provider configuration
 */
export const CLOUD_PROVIDERS = {
  'google-drive': {
    name: 'Google Drive',
    icon: 'google-drive.svg',
    authUrl: 'https://accounts.google.com/oauth/authorize',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  },
  'dropbox': {
    name: 'Dropbox',
    icon: 'dropbox.svg',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    scopes: ['files.content.write'],
  },
  'onedrive': {
    name: 'OneDrive',
    icon: 'onedrive.svg',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: ['Files.ReadWrite'],
  },
  'local': {
    name: 'Local Storage',
    icon: 'local.svg',
    authUrl: '',
    scopes: [],
  },
} as const;

/**
 * Sync configuration
 */
export const SYNC_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // milliseconds
  BATCH_SIZE: 50,
  TIMEOUT: 30000, // milliseconds
  FILE_NAME: 'text-expander-snippets.json',
} as const;

/**
 * UI configuration
 */
export const UI_CONFIG = {
  POPUP_WIDTH: 400,
  POPUP_HEIGHT: 600,
  VARIABLE_MODAL_WIDTH: 350,
  VARIABLE_MODAL_HEIGHT: 200,
  DEBOUNCE_DELAY: 300, // milliseconds
} as const;

/**
 * Text expansion configuration
 */
export const EXPANSION_CONFIG = {
  TRIGGER_PATTERN: /\b[a-zA-Z0-9_-]+$/,
  MAX_TRIGGER_LENGTH: 50,
  VARIABLE_PATTERN: /\{\{(\w+)\}\}/g,
  PLACEHOLDER_PATTERN: /\[\[([^\]]+)\]\]/g,
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  AUTHENTICATION_FAILED: 'Failed to authenticate with cloud provider',
  SYNC_FAILED: 'Failed to synchronize snippets',
  STORAGE_QUOTA_EXCEEDED: 'Storage quota exceeded',
  NETWORK_ERROR: 'Network connection error',
  INVALID_SNIPPET: 'Invalid snippet format',
  TRIGGER_EXISTS: 'Trigger already exists',
  SNIPPET_NOT_FOUND: 'Snippet not found',
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  SNIPPET_ADDED: 'Snippet added successfully',
  SNIPPET_UPDATED: 'Snippet updated successfully',
  SNIPPET_DELETED: 'Snippet deleted successfully',
  SYNC_COMPLETED: 'Synchronization completed',
  SETTINGS_SAVED: 'Settings saved successfully',
} as const;

/**
 * Chrome extension permissions
 */
export const REQUIRED_PERMISSIONS = [
  'storage',
  'activeTab',
  'identity',
  'notifications',
] as const;

/**
 * Chrome extension host permissions
 */
export const HOST_PERMISSIONS = [
  'https://www.googleapis.com/*',
  'https://api.dropboxapi.com/*',
  'https://graph.microsoft.com/*',
] as const;