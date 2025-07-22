/**
 * Type definitions for simplified snippet system
 *
 * PRIORITY SYSTEM CLARIFICATION:
 * - Stores have numeric priorities: 0 = highest, 1, 2, 3... = lower
 * - Default store (/drive.appdata) is always priority 0
 * - Priority is ONLY used for hover-snippet disambiguation
 * - Hover-snippets appear when:
 *   1. Current trigger matches 1+ snippets AND could trigger more with additional chars, OR
 *   2. Current trigger would expand 2+ different snippets
 * - Regular single-snippet expansion ignores priority completely
 */

import type { SnippetFormat } from "../utils/detectFormat.js";

/**
 * Variable definition for snippet placeholders
 */
export interface VariableDef {
  name: string;
  prompt: string;
  defaultValue?: string;
}

/**
 * Canonical metadata structure for all snippet formats
 * Simplified to remove scopes and tiers - just store association
 */
export interface SnippetMeta {
  /** Unique identifier */
  id: string;
  /** Trigger text (e.g., ";eata") */
  trigger: string;
  /** HTML-formatted snippet body */
  content: string;
  /** Array of dependent snippet triggers (e.g., [";gb"]) */
  snipDependencies: string[];
  /** Content type - HTML-focused for new architecture */
  contentType: "html" | "plaintext" | "markdown" | "latex" | "html+KaTeX";
  /** Human-readable description */
  description: string;
  /** Which store this snippet belongs to */
  storeId: string;
  /** Variable definitions with prompts */
  variables: VariableDef[];
  /** Drive fileIds, data URIs, etc. */
  images: string[];
  /** Categorization tags */
  tags: string[];
  /** ISO string timestamps and user info */
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Canonical snippet document structure (THE authoritative shape)
 * All parsers convert to this format internally
 */
export interface SnippetDoc {
  /** All your metadata lines 1-3 (plus audit stuff) */
  meta: SnippetMeta;
  /** Everything *after* the metadata header — the actual snippet text */
  body: string; // raw snippet, unparsed
  /** Original on-disk format so we know how to write it back */
  format: "json" | "txt" | "md" | "html" | "tex";
}

/**
 * Parser interface that all format parsers must implement
 */
export interface FormatParser {
  /**
   * Parse content from string to SnippetDoc
   */
  parse(content: string, fileName?: string): SnippetDoc | SnippetDoc[];

  /**
   * Serialize SnippetDoc to string content
   */
  serialize(doc: SnippetDoc | SnippetDoc[], options?: SerializeOptions): string;

  /**
   * Validate content format
   */
  validate(content: string): { valid: boolean; errors: string[] };

  /**
   * Get format identifier
   */
  getFormat(): SnippetFormat;
}

/**
 * Options for parsing operations
 */
export interface ParseOptions {
  strict?: boolean; // Strict validation
  includeMetadata?: boolean; // Include all metadata
  sanitizeHtml?: boolean; // Sanitize HTML content
  preserveComments?: boolean; // Preserve comments in content
}

/**
 * Options for serialization operations
 */
export interface SerializeOptions {
  pretty?: boolean; // Pretty print output
  includeTimestamps?: boolean; // Include creation/update timestamps
  minifyHtml?: boolean; // Minify HTML content
  escapeSpecialChars?: boolean; // Escape special characters
}

/**
 * Error types for format operations
 */
export class FormatError extends Error {
  constructor(
    message: string,
    public format: SnippetFormat,
    public line?: number,
    public column?: number,
  ) {
    super(message);
    this.name = "FormatError";
  }
}

/**
 * Legacy snippet format (for backwards compatibility)
 */
export interface LegacySnippet {
  id: string;
  trigger: string;
  content: string;
  createdAt: Date;
  lastModified: Date;
  isActive: boolean;
  scope?: string;
}

/**
 * Flat JSON snippet format (modern alternative format)
 */
export interface FlatSnippet {
  id: string;
  trigger: string;
  content: string;
  contentType?: string;
  description?: string;
  scope?: SnippetScope;
  priority?: SnippetPriority;
  variables?: any[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  isShared?: boolean;
  isBuiltIn?: boolean;
}

/**
 * Image reference for HTML and Markdown formats
 */
export interface ImageReference {
  url: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  size?: number; // Size in bytes
  cached?: boolean; // Whether image is cached locally
  cacheKey?: string; // Cache identifier
}

/**
 * Simple numeric priority system for FILO ordering
 * Lower numbers = higher priority (0 = highest, newest stores get highest numbers)
 */
export type StorePriority = number;

/**
 * Simple snippet with no scopes or tiers - just belongs to a store
 */
export interface SimpleSnippet {
  id: string;
  trigger: string;
  content: string; // HTML content by default
  contentType: "html" | "plaintext" | "markdown" | "latex" | "html+KaTeX";
  snipDependencies: string[];
  description: string;
  storeId: string; // Which store this snippet belongs to
  variables: VariableDef[];
  images: string[];
  tags: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Legacy enhanced snippet interface (for backward compatibility during migration)
 */
export interface EnhancedSnippet extends SimpleSnippet {
  /** @deprecated Use storeId instead */
  scope?: string;
  /** @deprecated Priority is now at store level */
  priority?: number;
}

/**
 * Simple store - just a Google Drive folder with snippets and a priority number
 * Priority is ONLY used for hover-snippet disambiguation ordering
 */
export interface SimpleStore {
  id: string; // Unique store identifier
  name: string; // User-friendly name (usually folder name)
  priority: StorePriority; // 0 = highest priority, 1, 2, 3... = lower priority
  googleDriveFolderId: string; // Google Drive folder ID
  isDefault: boolean; // True for /drive.appdata store (always priority 0)
  readOnly: boolean; // True for read-only shared folders
  lastSync: string; // ISO timestamp of last sync
  snippetCount: number; // Number of snippets in this store
}

/**
 * Simple store file schema - the JSON file format stored in Google Drive
 */
export interface SimpleStoreSchema {
  schema: "simple-store-v1";
  storeName: string;
  snippets: SimpleSnippet[];
  metadata: {
    version: string;
    created: string;
    modified: string;
    owner: string;
  };
}

/**
 * @deprecated Use SimpleStoreSchema instead
 * Legacy array-based snippet storage schema with numeric priority ordering
 */
export interface NumericPriorityStorageSchema {
  schema: "numeric-priority-v1";
  scope: string; // Store scope
  snippets: EnhancedSnippet[]; // Array of 1 or more snippets ordered by priority (0 = highest)
  metadata: {
    version: string;
    created: string;
    modified: string;
    owner: string;
    description?: string;
    nextPriority: number; // Next priority number to assign (for FILO ordering)
  };
}

/**
 * Legacy tier storage schema (for backwards compatibility)
 * @deprecated Use SimpleStoreSchema instead
 */
export interface TierStorageSchema {
  schema: "priority-tier-v1";
  tier: "priority-0" | "personal" | "department" | "team" | "org";
  snippets: Array<
    Omit<EnhancedSnippet, "priority"> & {
      scope: "priority-0" | "personal" | "department" | "team" | "org";
    }
  >;
  metadata: {
    version: string;
    created: string;
    modified: string;
    owner: string;
    description?: string;
  };
}
