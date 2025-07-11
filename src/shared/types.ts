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
  contentType?: "text" | "html"; // Added contentType
  description?: string;
  scope?: SnippetScope; // Added scope
  variables?: SnippetVariable[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastModified?: Date; // Added lastModified
  isShared?: boolean;
  sharedBy?: string;
  isBuiltIn?: boolean;
  isActive?: boolean; // Added isActive
  // Usage tracking fields
  usageCount?: number; // Number of times this snippet has been used
  lastUsed?: Date; // When this snippet was last used
  priority?: number; // Priority level from folder hierarchy (1 = highest)
  sourceFolder?: string; // ID of the folder this snippet came from
  fileHash?: string; // Hash prefix to prevent name collisions
}

/**
 * Alias for TextSnippet for backwards compatibility
 */
export type Snippet = TextSnippet;

/**
 * Variable definition for dynamic snippets
 */
export interface SnippetVariable {
  name: string;
  placeholder: string;
  defaultValue?: string;
  required?: boolean;
  type?: "text" | "number" | "date" | "choice";
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
export type CloudProvider =
  | "google-drive"
  | "dropbox"
  | "onedrive"
  | "local"
  | "local-filesystem";

/**
 * Snippet scopes for multi-tier sync architecture
 */
export type SnippetScope = "personal" | "department" | "team" | "org";

/**
 * Scoped source configuration
 */
export interface SyncedSource {
  name: SnippetScope;
  adapter: CloudAdapter;
  folderId: string;
  displayName: string;
  // For local-filesystem, store serializable parts of FileSystemDirectoryHandle
  handleId?: string;
  handleName?: string;
}

export interface ConfiguredScopedSource {
  provider: CloudProvider;
  scope: SnippetScope;
  folderId: string;
  displayName: string;
  // For local-filesystem, store serializable parts of FileSystemDirectoryHandle
  handleId?: string;
  handleName?: string;
}

/**
 * Scoped source for managing snippet sources by scope
 */
export interface ScopedSource {
  scope: SnippetScope;
  provider: CloudProvider;
  name: string;
  displayName: string;
  folderId?: string;
  lastSync?: Date;
  // For local-filesystem, store serializable parts of FileSystemDirectoryHandle
  handleId?: string;
  handleName?: string;
}

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
  downloadSnippets(folderId: string): Promise<TextSnippet[]>;

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

  /**
   * Select a folder for storing snippets (optional for cloud providers)
   */
  selectFolder?(): Promise<{ folderId: string; folderName: string }>;

  /**
   * Get folders from cloud provider (optional, for Google Drive)
   */
  getFolders?(
    parentId?: string,
  ): Promise<
    Array<{ id: string; name: string; parentId?: string; isFolder: boolean }>
  >;

  /**
   * Create folder in cloud provider (optional, for Google Drive)
   */
  createFolder?(
    folderName: string,
    parentId?: string,
  ): Promise<{ id: string; name: string }>;
}

/**
 * Extension storage keys
 */
export interface StorageKeys {
  SNIPPETS: "snippets";
  SETTINGS: "settings";
  SYNC_STATUS: "syncStatus";
  CLOUD_CREDENTIALS: "cloudCredentials";
  LAST_SYNC: "lastSync";
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
  configuredSources: ConfiguredScopedSource[]; // New field
  // Global toggle settings
  globalToggleEnabled: boolean;
  globalToggleShortcut: string;
  // Built-in test snippet settings
  testTrigger?: string;
  disableTestSnippet?: boolean;
  hasSeenTestSnippet?: boolean;
}

/**
 * Message types for extension communication
 */
export type MessageType =
  | "GET_SNIPPETS"
  | "ADD_SNIPPET"
  | "UPDATE_SNIPPET"
  | "DELETE_SNIPPET"
  | "SYNC_SNIPPETS"
  | "GET_SETTINGS"
  | "UPDATE_SETTINGS"
  | "SETTINGS_UPDATED"
  | "GET_SYNC_STATUS"
  | "TRIGGER_DETECTED"
  | "EXPAND_TEXT"
  | "VARIABLE_PROMPT"
  | "AUTHENTICATE_CLOUD"
  | "SELECT_CLOUD_FOLDER"
  | "DISCONNECT_CLOUD";

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
  type: "EXPAND_TEXT";
  trigger: string;
  snippet: TextSnippet;
  variables?: Record<string, string>;
}

/**
 * Message for variable prompt requests
 */
export interface VariablePromptMessage extends BaseMessage {
  type: "VARIABLE_PROMPT";
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
