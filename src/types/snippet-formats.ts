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
}

/**
 * Canonical metadata structure for all snippet formats
 */
export interface SnippetMeta {
  /** Unique identifier */
  id: string;
  /** Trigger text (e.g., ";eata") */
  trigger: string;
  /** Array of dependent snippet triggers (e.g., [";gb"]) */
  snipDependencies: string[];
  /** Content type - canonical values only */
  contentType: "plainText" | "markdown" | "html" | "latex";
  /** Human-readable description */
  description: string;
  /** Scope for priority system */
  scope: "personal" | "group" | "org";
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
