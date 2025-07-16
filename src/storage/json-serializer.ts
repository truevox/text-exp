/**
 * JSON Serializer for Priority Tier Storage
 * Handles reading/writing JSON with preserved field order and atomic operations
 */

import type {
  TierStorageSchema,
  EnhancedSnippet,
  PriorityTier,
} from "../types/snippet-formats.js";

/**
 * Options for JSON serialization
 */
export interface JsonSerializationOptions {
  pretty?: boolean; // Pretty print JSON
  preserveOrder?: boolean; // Maintain field order
  atomicWrite?: boolean; // Ensure atomic writes
  backup?: boolean; // Create backup before write
}

/**
 * Result of JSON operations
 */
export interface JsonOperationResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
  backupCreated?: boolean;
}

/**
 * JSON field ordering configuration
 */
const SNIPPET_FIELD_ORDER = [
  "id",
  "trigger", 
  "content",
  "contentType",
  "snipDependencies",
  "description",
  "scope",
  "variables",
  "images",
  "tags",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
];

const SCHEMA_FIELD_ORDER = [
  "schema",
  "tier",
  "snippets",
  "metadata",
];

const METADATA_FIELD_ORDER = [
  "version",
  "created",
  "modified", 
  "owner",
  "description",
];

/**
 * Handles JSON serialization with field order preservation
 */
export class JsonSerializer {
  /**
   * Serialize tier storage schema to JSON string
   */
  static serialize(
    schema: TierStorageSchema,
    options: JsonSerializationOptions = {}
  ): string {
    const opts = {
      pretty: true,
      preserveOrder: true,
      ...options,
    };

    try {
      if (opts.preserveOrder) {
        const orderedSchema = this.orderSchemaFields(schema);
        return JSON.stringify(orderedSchema, null, opts.pretty ? 2 : undefined);
      } else {
        return JSON.stringify(schema, null, opts.pretty ? 2 : undefined);
      }
    } catch (error) {
      throw new Error(`JSON serialization failed: ${error}`);
    }
  }

  /**
   * Deserialize JSON string to tier storage schema
   */
  static deserialize(jsonString: string): JsonOperationResult {
    try {
      const data = JSON.parse(jsonString);
      
      // Validate schema structure
      const validation = this.validateSchema(data);
      if (!validation.success) {
        return {
          success: false,
          error: validation.error,
          warnings: validation.warnings,
        };
      }

      return {
        success: true,
        data: data as TierStorageSchema,
      };
    } catch (error) {
      return {
        success: false,
        error: `JSON parsing failed: ${error}`,
      };
    }
  }

  /**
   * Serialize array of snippets to JSON
   */
  static serializeSnippets(
    snippets: EnhancedSnippet[],
    options: JsonSerializationOptions = {}
  ): string {
    const opts = {
      pretty: true,
      preserveOrder: true,
      ...options,
    };

    try {
      if (opts.preserveOrder) {
        const orderedSnippets = snippets.map(snippet => this.orderSnippetFields(snippet));
        return JSON.stringify(orderedSnippets, null, opts.pretty ? 2 : undefined);
      } else {
        return JSON.stringify(snippets, null, opts.pretty ? 2 : undefined);
      }
    } catch (error) {
      throw new Error(`Snippet serialization failed: ${error}`);
    }
  }

  /**
   * Create a minimal schema for a new tier
   */
  static createEmptySchema(tier: PriorityTier, owner: string = "user"): TierStorageSchema {
    const now = new Date().toISOString();
    
    return this.orderSchemaFields({
      schema: "priority-tier-v1",
      tier,
      snippets: [],
      metadata: {
        version: "1.0.0",
        created: now,
        modified: now,
        owner,
        description: `${tier} tier snippets`,
      },
    });
  }

  /**
   * Order schema fields according to predefined order
   */
  private static orderSchemaFields(schema: TierStorageSchema): TierStorageSchema {
    const ordered: any = {};

    // Order top-level fields
    for (const field of SCHEMA_FIELD_ORDER) {
      if (field in schema) {
        if (field === "snippets") {
          ordered[field] = (schema[field] as EnhancedSnippet[]).map(snippet => 
            this.orderSnippetFields(snippet)
          );
        } else if (field === "metadata") {
          ordered[field] = this.orderMetadataFields(schema[field]);
        } else {
          ordered[field] = (schema as any)[field];
        }
      }
    }

    // Add any remaining fields not in the predefined order
    for (const [key, value] of Object.entries(schema)) {
      if (!SCHEMA_FIELD_ORDER.includes(key)) {
        ordered[key] = value;
      }
    }

    return ordered;
  }

  /**
   * Order snippet fields according to predefined order
   */
  private static orderSnippetFields(snippet: EnhancedSnippet): EnhancedSnippet {
    const ordered: any = {};

    // Order fields according to predefined order
    for (const field of SNIPPET_FIELD_ORDER) {
      if (field in snippet) {
        ordered[field] = (snippet as any)[field];
      }
    }

    // Add any remaining fields not in the predefined order
    for (const [key, value] of Object.entries(snippet)) {
      if (!SNIPPET_FIELD_ORDER.includes(key)) {
        ordered[key] = value;
      }
    }

    return ordered;
  }

  /**
   * Order metadata fields according to predefined order
   */
  private static orderMetadataFields(metadata: any): any {
    const ordered: any = {};

    // Order fields according to predefined order
    for (const field of METADATA_FIELD_ORDER) {
      if (field in metadata) {
        ordered[field] = metadata[field];
      }
    }

    // Add any remaining fields not in the predefined order
    for (const [key, value] of Object.entries(metadata)) {
      if (!METADATA_FIELD_ORDER.includes(key)) {
        ordered[key] = value;
      }
    }

    return ordered;
  }

  /**
   * Validate tier storage schema structure
   */
  private static validateSchema(data: any): JsonOperationResult {
    const warnings: string[] = [];

    // Check required top-level fields
    if (!data.schema) {
      return { success: false, error: "Missing 'schema' field" };
    }

    if (data.schema !== "priority-tier-v1") {
      warnings.push(`Unknown schema version: ${data.schema}`);
    }

    if (!data.tier) {
      return { success: false, error: "Missing 'tier' field" };
    }

    if (!["personal", "team", "org"].includes(data.tier)) {
      return { success: false, error: `Invalid tier: ${data.tier}` };
    }

    if (!Array.isArray(data.snippets)) {
      return { success: false, error: "'snippets' must be an array" };
    }

    if (!data.metadata || typeof data.metadata !== "object") {
      return { success: false, error: "Missing or invalid 'metadata' field" };
    }

    // Validate each snippet
    for (let i = 0; i < data.snippets.length; i++) {
      const snippet = data.snippets[i];
      const snippetValidation = this.validateSnippet(snippet, i);
      if (!snippetValidation.success) {
        return {
          success: false,
          error: `Snippet ${i}: ${snippetValidation.error}`,
          warnings,
        };
      }
      if (snippetValidation.warnings) {
        warnings.push(...snippetValidation.warnings.map(w => `Snippet ${i}: ${w}`));
      }
    }

    return {
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate individual snippet structure
   */
  private static validateSnippet(snippet: any, index: number): JsonOperationResult {
    const warnings: string[] = [];

    // Check required fields
    const requiredFields = ["id", "trigger", "content", "contentType", "scope"];
    for (const field of requiredFields) {
      if (!snippet[field]) {
        return { success: false, error: `Missing required field: ${field}` };
      }
    }

    // Validate content type
    if (!["html", "plaintext", "latex"].includes(snippet.contentType)) {
      warnings.push(`Unknown content type: ${snippet.contentType}`);
    }

    // Validate scope
    if (!["personal", "team", "org"].includes(snippet.scope)) {
      return { success: false, error: `Invalid scope: ${snippet.scope}` };
    }

    // Validate arrays
    const arrayFields = ["snipDependencies", "variables", "images", "tags"];
    for (const field of arrayFields) {
      if (snippet[field] && !Array.isArray(snippet[field])) {
        return { success: false, error: `${field} must be an array` };
      }
    }

    return {
      success: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Deep clone an object to prevent mutations
   */
  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Compare two schemas for equality (useful for detecting changes)
   */
  static schemasEqual(schema1: TierStorageSchema, schema2: TierStorageSchema): boolean {
    try {
      const json1 = this.serialize(schema1, { pretty: false, preserveOrder: true });
      const json2 = this.serialize(schema2, { pretty: false, preserveOrder: true });
      return json1 === json2;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate size of serialized schema in bytes
   */
  static calculateSize(schema: TierStorageSchema): number {
    try {
      const serialized = this.serialize(schema, { pretty: false });
      return new Blob([serialized]).size;
    } catch (error) {
      return 0;
    }
  }
}