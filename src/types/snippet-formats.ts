/**
 * Type definitions for multi-format snippet system
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
  /** Scope for priority system */
  scope: "personal" | "team" | "org";
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
  scope?: string;
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
 * Priority tier names for the new tier-based architecture
 */
export type PriorityTier = "personal" | "team" | "org";

/**
 * Enhanced snippet for the new priority-tier architecture
 */
export interface EnhancedSnippet {
  id: string;
  trigger: string;
  content: string; // HTML content by default
  contentType: "html" | "plaintext" | "markdown" | "latex" | "html+KaTeX";
  snipDependencies: string[];
  description: string;
  scope: PriorityTier;
  variables: VariableDef[];
  images: string[];
  tags: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Priority tier store - represents a single JSON file containing 1 or more snippets
 */
export interface PriorityTierStore {
  tierName: PriorityTier;
  fileName: string; // e.g., 'personal.json'
  snippets: EnhancedSnippet[]; // Array of 1 or more snippets, ordered by descending priority
  lastModified: string;
  version: string; // Schema version for migration support
  metadata: {
    totalSnippets: number;
    averagePriority: number;
    lastSync?: string;
    owner?: string;
    permissions?: string[];
  };
}

/**
 * Array-based snippet storage schema for tier files (stores 1 or more snippets)
 */
export interface TierStorageSchema {
  schema: "priority-tier-v1";
  tier: PriorityTier;
  snippets: EnhancedSnippet[]; // Array of 1 or more snippets with complete field specification
  metadata: {
    version: string;
    created: string;
    modified: string;
    owner: string;
    description?: string;
  };
}
