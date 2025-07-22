/**
 * JSON Format Parser for PuffPuffPaste
 * Handles the canonical JSON array format
 */

import type {
  FormatParser,
  SnippetDoc,
  SnippetMeta,
  VariableDef,
  LegacySnippet,
  FlatSnippet,
  ParseOptions,
  SerializeOptions,
} from "../types/snippet-formats.js";

export class JSONParser implements FormatParser {
  getFormat(): "json" | "txt" | "md" | "html" | "tex" {
    return "json";
  }

  parse(
    content: string,
    fileName?: string,
    _options: ParseOptions = {},
  ): SnippetDoc[] {
    try {
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => this.parseSnippetItem(item, index));
      } else if (typeof parsed === "object" && parsed !== null) {
        // Single snippet object
        return [this.parseSnippetItem(parsed, 0)];
      } else {
        throw new Error("JSON content must be an object or array of objects");
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON format: ${error.message}`);
      }
      throw error;
    }
  }

  private parseSnippetItem(item: any, index: number): SnippetDoc {
    // Handle legacy format
    if (this.isLegacySnippet(item)) {
      return this.convertLegacySnippet(item);
    }

    // Handle flat format
    if (this.isFlatSnippet(item)) {
      return this.convertFlatSnippet(item);
    }

    // Modern format validation
    if (!item.meta || !item.body) {
      throw new Error(
        `Snippet at index ${index} is missing required fields (meta, body)`,
      );
    }

    const meta: SnippetMeta = {
      id: item.meta.id || `snippet-${Date.now()}-${index}`,
      trigger: item.meta.trigger,
      content: String(item.body),
      snipDependencies: Array.isArray(item.meta.snipDependencies)
        ? item.meta.snipDependencies
        : [],
      contentType: this.normalizeContentType(item.meta.contentType),
      description: item.meta.description || "",
      scope: this.normalizeScope(item.meta.scope),
      priority: typeof item.meta.priority === "number" ? item.meta.priority : 0, // Default to highest priority
      variables: this.normalizeVariables(item.meta.variables),
      images: Array.isArray(item.meta.images) ? item.meta.images : [],
      tags: Array.isArray(item.meta.tags) ? item.meta.tags : [],
      createdAt: item.meta.createdAt || new Date().toISOString(),
      createdBy: item.meta.createdBy || "unknown",
      updatedAt: item.meta.updatedAt || new Date().toISOString(),
      updatedBy: item.meta.updatedBy || "unknown",
    };

    if (!meta.trigger) {
      throw new Error(`Snippet at index ${index} is missing required trigger`);
    }

    return {
      meta,
      body: String(item.body),
      format: item.format || "json",
    };
  }

  private isLegacySnippet(item: any): item is LegacySnippet {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.trigger === "string" &&
      typeof item.content === "string" &&
      !item.meta && // Key indicator that it's legacy format
      (item.createdAt instanceof Date ||
        item.lastModified instanceof Date ||
        (typeof item.isActive === "boolean" && item.lastModified !== undefined)) // Legacy has isActive and lastModified
    );
  }

  private isFlatSnippet(item: any): item is FlatSnippet {
    return (
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      typeof item.trigger === "string" &&
      typeof item.content === "string" &&
      !item.meta && // Key indicator that it's not modern format
      !this.isLegacySnippet(item) && // Not legacy format
      (typeof item.createdAt === "string" || typeof item.updatedAt === "string") // Flat uses ISO strings
    );
  }

  private convertLegacySnippet(legacy: LegacySnippet): SnippetDoc {
    const meta: SnippetMeta = {
      id: legacy.id,
      trigger: legacy.trigger,
      content: legacy.content,
      snipDependencies: [],
      contentType: "plaintext",
      description: `Legacy snippet: ${legacy.trigger}`,
      scope: this.normalizeScope(legacy.scope as any),
      priority: 0, // Default priority for legacy snippets
      variables: [],
      images: [],
      tags: [],
      createdAt:
        legacy.createdAt instanceof Date
          ? legacy.createdAt.toISOString()
          : typeof legacy.createdAt === "string"
            ? legacy.createdAt
            : new Date().toISOString(),
      createdBy: "legacy-import",
      updatedAt:
        legacy.lastModified instanceof Date
          ? legacy.lastModified.toISOString()
          : typeof legacy.lastModified === "string"
            ? legacy.lastModified
            : legacy.createdAt instanceof Date
              ? legacy.createdAt.toISOString()
              : typeof legacy.createdAt === "string"
                ? legacy.createdAt
                : new Date().toISOString(),
      updatedBy: "legacy-import",
    };

    return {
      meta,
      body: legacy.content,
      format: "json",
    };
  }

  private convertFlatSnippet(flat: FlatSnippet): SnippetDoc {
    const meta: SnippetMeta = {
      id: flat.id,
      trigger: flat.trigger,
      content: flat.content,
      snipDependencies: [],
      contentType: this.normalizeContentType(flat.contentType),
      description: flat.description || `Flat snippet: ${flat.trigger}`,
      scope: this.normalizeScope(flat.scope),
      priority: typeof flat.priority === "number" ? flat.priority : 0, // Default priority for flat snippets
      variables: this.normalizeVariables(flat.variables),
      images: [],
      tags: Array.isArray(flat.tags) ? flat.tags : [],
      createdAt: flat.createdAt || new Date().toISOString(),
      createdBy: "flat-import",
      updatedAt: flat.updatedAt || flat.createdAt || new Date().toISOString(),
      updatedBy: "flat-import",
    };

    return {
      meta,
      body: flat.content,
      format: "json",
    };
  }

  private normalizeContentType(
    contentType: any,
  ): "plaintext" | "markdown" | "html" | "latex" {
    if (typeof contentType === "string") {
      switch (contentType.toLowerCase()) {
        case "text/markdown":
        case "markdown":
          return "markdown";
        case "text/html":
        case "html":
          return "html";
        case "application/x-latex":
        case "text/x-latex":
        case "latex":
        case "tex":
          return "latex";
        default:
          return "plaintext";
      }
    }
    return "plaintext";
  }

  private normalizeScope(scope: any): "personal" | "team" | "org" {
    if (typeof scope === "string") {
      switch (scope.toLowerCase()) {
        case "group":
        case "team":
        case "department":
          return "team";
        case "org":
        case "organization":
        case "company":
          return "org";
        default:
          return "personal";
      }
    }
    return "personal";
  }

  private normalizeVariables(variables: any): VariableDef[] {
    if (Array.isArray(variables)) {
      return variables.map((v) => {
        if (typeof v === "string") {
          return { name: v, prompt: `Enter ${v}` };
        } else if (v && typeof v === "object" && v.name) {
          return { name: v.name, prompt: v.prompt || `Enter ${v.name}` };
        }
        return { name: "unknown", prompt: "Enter value" };
      });
    }
    return [];
  }

  serialize(
    docs: SnippetDoc | SnippetDoc[],
    options: SerializeOptions = {},
  ): string {
    const docArray = Array.isArray(docs) ? docs : [docs];

    const serializable = docArray.map((doc) => ({
      meta: doc.meta, // Already in canonical format with string timestamps
      body: doc.body,
      format: doc.format,
    }));

    const indent = options.pretty ? 2 : 0;
    const result = JSON.stringify(serializable, null, indent);

    // Add trailing newline for better file handling
    return result + "\n";
  }

  validate(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const parsed = JSON.parse(content);

      if (
        !Array.isArray(parsed) &&
        (typeof parsed !== "object" || parsed === null)
      ) {
        errors.push("JSON content must be an object or array of objects");
        return { valid: false, errors };
      }

      const items = Array.isArray(parsed) ? parsed : [parsed];

      items.forEach((item, index) => {
        if (typeof item !== "object" || item === null) {
          errors.push(`Item at index ${index} is not an object`);
          return;
        }

        // Check for legacy format
        if (this.isLegacySnippet(item)) {
          if (!item.trigger) {
            errors.push(`Legacy snippet at index ${index} is missing trigger`);
          }
          if (!item.content) {
            errors.push(`Legacy snippet at index ${index} is missing content`);
          }
          return;
        }

        // Check for flat format
        if (this.isFlatSnippet(item)) {
          if (!item.trigger) {
            errors.push(`Flat snippet at index ${index} is missing trigger`);
          }
          if (!item.content) {
            errors.push(`Flat snippet at index ${index} is missing content`);
          }
          return;
        }

        // Check modern format
        if (!item.meta) {
          errors.push(`Snippet at index ${index} is missing meta field`);
        } else {
          if (!item.meta.trigger) {
            errors.push(`Snippet at index ${index} is missing meta.trigger`);
          }
          if (typeof item.meta.trigger !== "string") {
            errors.push(
              `Snippet at index ${index} has invalid meta.trigger (must be string)`,
            );
          }
        }

        if (item.body === undefined || item.body === null) {
          errors.push(`Snippet at index ${index} is missing body field`);
        }
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        errors.push(`Invalid JSON syntax: ${error.message}`);
      } else {
        errors.push(
          `JSON parsing error: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create a new snippet document with sensible defaults
   */
  createNew(
    trigger: string,
    content: string,
    options: Partial<SnippetMeta> = {},
  ): SnippetDoc {
    const now = new Date().toISOString();
    const id =
      options.id ||
      `snippet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const meta: SnippetMeta = {
      id,
      trigger,
      content,
      snipDependencies: [],
      contentType: "plaintext",
      description: options.description || `Snippet: ${trigger}`,
      scope: "personal",
      variables: [],
      images: [],
      tags: [],
      createdAt: now,
      createdBy: "user",
      updatedAt: now,
      updatedBy: "user",
      ...options,
    };

    return {
      meta,
      body: content,
      format: "json",
    };
  }
}
