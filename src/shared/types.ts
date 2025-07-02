/**
 * Core TypeScript interfaces and types for Collaborative Text Expander
 * Defines the CloudAdapter pattern and extension data structures
 */

/**
 * Text expansion snippet with support for variables and placeholders
 */
export interface TextSnippet {
  id: string;
  trigger: string;
  content: string;
  description?: string;
  variables?: SnippetVariable[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  isShared?: boolean;
  sharedBy?: string;
  isBuiltIn?: boolean;
}

/**
 * Variable definition for dynamic snippets
 */
export interface SnippetVariable {
  name: string;
  placeholder: string;
  defaultValue?: string;
  required?: boolean;
  type?: 'text' | 'number' | 'date' | 'choice';
  choices?: string[];
}

/**
 * Cloud storage sync status
 */
export interface SyncStatus {
  provider: CloudProvider;
  lastSync: Date | null;
  isOnline: boolean;
  hasChanges: boolean;
  error?: string;
}

/**
 * Supported cloud storage providers
 */
export type CloudProvider = 'google-drive' | 'dropbox' | 'onedrive' | 'local';

/**
 * Cloud authentication credentials
 */
export interface CloudCredentials {
  provider: CloudProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Base interface for all cloud adapters
 */
export interface CloudAdapter {
  readonly provider: CloudProvider;
  
  /**
   * Initialize the adapter with credentials
   */
  initialize(credentials: CloudCredentials): Promise<void>;
  
  /**
   * Check if the adapter is authenticated and ready
   */
  isAuthenticated(): Promise<boolean>;
  
  /**
   * Authenticate with the cloud provider
   */
  authenticate(): Promise<CloudCredentials>;
  
  /**
   * Upload snippets to cloud storage
   */
  uploadSnippets(snippets: TextSnippet[]): Promise<void>;
  
  /**
   * Download snippets from cloud storage
   */
  downloadSnippets(): Promise<TextSnippet[]>;
  
  /**
   * Sync local changes with remote storage
   */
  syncSnippets(localSnippets: TextSnippet[]): Promise<TextSnippet[]>;
  
  /**
   * Delete snippets from cloud storage
   */
  deleteSnippets(snippetIds: string[]): Promise<void>;
  
  /**
   * Get sync status
   */
  getSyncStatus(): Promise<SyncStatus>;
}

/**
 * Extension storage keys
 */
export interface StorageKeys {
  SNIPPETS: 'snippets';
  SETTINGS: 'settings';
  SYNC_STATUS: 'syncStatus';
  CLOUD_CREDENTIALS: 'cloudCredentials';
  LAST_SYNC: 'lastSync';
}

/**
 * Extension settings
 */
export interface ExtensionSettings {
  enabled: boolean;
  cloudProvider: CloudProvider;
  autoSync: boolean;
  syncInterval: number; // minutes
  showNotifications: boolean;
  triggerDelay: number; // milliseconds
  caseSensitive: boolean;
  enableSharedSnippets: boolean;
  triggerPrefix: string;
  excludePasswords: boolean;
  // Built-in test snippet settings
  testTrigger?: string;
  disableTestSnippet?: boolean;
  hasSeenTestSnippet?: boolean;
}

/**
 * Message types for extension communication
 */
export type MessageType = 
  | 'GET_SNIPPETS'
  | 'ADD_SNIPPET'
  | 'UPDATE_SNIPPET'
  | 'DELETE_SNIPPET'
  | 'SYNC_SNIPPETS'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'TRIGGER_DETECTED'
  | 'EXPAND_TEXT'
  | 'VARIABLE_PROMPT';

/**
 * Base message structure for extension communication
 */
export interface BaseMessage {
  type: MessageType;
  id?: string;
  timestamp: number;
}

/**
 * Message for text expansion requests
 */
export interface ExpandTextMessage extends BaseMessage {
  type: 'EXPAND_TEXT';
  trigger: string;
  snippet: TextSnippet;
  variables?: Record<string, string>;
}

/**
 * Message for variable prompt requests
 */
export interface VariablePromptMessage extends BaseMessage {
  type: 'VARIABLE_PROMPT';
  snippet: TextSnippet;
  variables: SnippetVariable[];
}

/**
 * Text replacement context
 */
export interface ReplacementContext {
  element: HTMLElement;
  startOffset: number;
  endOffset: number;
  trigger: string;
  snippet: TextSnippet;
}

/**
 * Cloud adapter factory interface
 */
export interface CloudAdapterFactory {
  createAdapter(provider: CloudProvider): CloudAdapter;
  getSupportedProviders(): CloudProvider[];
}