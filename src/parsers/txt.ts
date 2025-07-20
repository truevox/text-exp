/**
 * Plain Text Format Parser for PuffPuffPaste
 * Handles plain text with optional YAML frontmatter
 */

import * as yaml from "js-yaml";
import type {
  FormatParser,
  SnippetDoc,
  SnippetMeta,
  ParseOptions,
  SerializeOptions,
} from "../types/snippet-formats.js";
import type { SnippetFormat } from "../utils/detectFormat.js";
import {
  extractYAMLFrontmatter,
  hasYAMLFrontmatter,
} from "../utils/detectFormat.js";

export class TxtParser implements FormatParser {
  getFormat(): SnippetFormat {
    return "txt";
  }

  parse(
    content: string,
    fileName?: string,
    _options: ParseOptions = {},
  ): SnippetDoc {
    const trimmed = content.trim();

    if (hasYAMLFrontmatter(trimmed)) {
      return this.parseWithFrontmatter(trimmed, fileName);
    } else {
      return this.parseWithoutFrontmatter(trimmed, fileName);
    }
  }

  private parseWithFrontmatter(
    content: string,
    _fileName?: string,
  ): SnippetDoc {
    const extracted = extractYAMLFrontmatter(content);
    if (!extracted) {
      throw new Error("Failed to extract YAML frontmatter");
    }

    let meta: any;
    try {
      meta = yaml.load(extracted.frontmatter);
      if (!meta || typeof meta !== "object") {
        throw new Error("YAML frontmatter must be an object");
      }
    } catch (error) {
      throw new Error(
        `Invalid YAML frontmatter: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Validate required fields
    if (!meta.trigger) {
      throw new Error("Missing required field: trigger");
    }

    const now = new Date().toISOString();
    const fullMeta: SnippetMeta = {
      id:
        meta.id ||
        `txt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trigger: meta.trigger,
      content: extracted.body,
      snipDependencies: Array.isArray(meta.snipDependencies)
        ? meta.snipDependencies
        : [],
      contentType: this.normalizeContentType(meta.contentType),
      description: meta.description || "",
      scope: this.normalizeScope(meta.scope),
      variables: this.normalizeVariables(meta.variables),
      images: Array.isArray(meta.images) ? meta.images : [],
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      createdAt: meta.createdAt || now,
      createdBy: meta.createdBy || "user",
      updatedAt: meta.updatedAt || now,
      updatedBy: meta.updatedBy || "user",
    };

    return {
      meta: fullMeta,
      body: extracted.body.trim(),
      format: "txt",
    };
  }

  private parseWithoutFrontmatter(
    content: string,
    fileName?: string,
  ): SnippetDoc {
    // For plain text without frontmatter, we need to infer the trigger
    // This is a fallback for simple text files
    const lines = content.split("\n");
    const firstLine = lines[0]?.trim() || "";

    // Try to extract trigger from filename or first line
    let trigger = "";
    if (fileName) {
      // Remove extension and use as trigger
      trigger = fileName.replace(/\.(txt|ppp\.txt)$/i, "").toLowerCase();
    } else if (firstLine.length > 0 && firstLine.length <= 20) {
      // Use first line if it's short enough to be a trigger
      trigger = firstLine.toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    if (!trigger) {
      trigger = `txt-${Date.now()}`;
    }

    const now = new Date().toISOString();
    const meta: SnippetMeta = {
      id: `txt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trigger,
      content: content,
      snipDependencies: [],
      contentType: "plaintext",
      description: `Plain text snippet${fileName ? ` from ${fileName}` : ""}`,
      scope: "personal",
      variables: [],
      images: [],
      tags: [],
      createdAt: now,
      createdBy: "user",
      updatedAt: now,
      updatedBy: "user",
    };

    return {
      meta,
      body: content,
      format: "txt",
    };
  }

  serialize(
    doc: SnippetDoc | SnippetDoc[],
    options: SerializeOptions = {},
  ): string {
    if (Array.isArray(doc)) {
      // For multiple docs, serialize each separately
      return doc.map((d) => this.serializeOne(d, options)).join("\n\n---\n\n");
    }
    return this.serializeOne(doc, options);
  }

  private serializeOne(
    doc: SnippetDoc,
    options: SerializeOptions = {},
  ): string {
    const { meta, body } = doc;

    // Prepare metadata for YAML
    const yamlMeta: Record<string, any> = {
      trigger: meta.trigger,
      contentType: meta.contentType,
    };

    // Add optional fields if they exist
    if (meta.description) yamlMeta.description = meta.description;
    if (meta.tags && meta.tags.length > 0) yamlMeta.tags = meta.tags;
    if (meta.variables && meta.variables.length > 0)
      yamlMeta.variables = meta.variables;
    if (meta.images && meta.images.length > 0) yamlMeta.images = meta.images;
    if (meta.snipDependencies && meta.snipDependencies.length > 0)
      yamlMeta.snipDependencies = meta.snipDependencies;
    // Note: language and category properties don't exist in SnippetMeta interface
    if (meta.scope && meta.scope !== "personal") yamlMeta.scope = meta.scope;
    // Note: isActive and priority properties don't exist in SnippetMeta interface

    // Include timestamps if requested
    if (options?.includeTimestamps) {
      yamlMeta.createdAt = meta.createdAt || new Date();
      yamlMeta.updatedAt = meta.updatedAt || new Date();
      yamlMeta.createdBy = meta.createdBy || "system";
      yamlMeta.updatedBy = meta.updatedBy || "system";
    }

    // Serialize YAML frontmatter
    const yamlString = yaml
      .dump(yamlMeta, {
        indent: 2,
        lineWidth: 80,
        noRefs: true,
        sortKeys: true,
      })
      .trim();

    // Combine frontmatter and body
    return `---\n${yamlString}\n---\n${body}`;
  }

  validate(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const trimmed = content.trim();

    if (!trimmed) {
      errors.push("Content cannot be empty");
      return { valid: false, errors };
    }

    if (hasYAMLFrontmatter(trimmed)) {
      const extracted = extractYAMLFrontmatter(trimmed);
      if (!extracted) {
        errors.push("Invalid YAML frontmatter format");
        return { valid: false, errors };
      }

      try {
        const meta = yaml.load(extracted.frontmatter);
        if (!meta || typeof meta !== "object") {
          errors.push("YAML frontmatter must be an object");
        } else {
          const metaObj = meta as Record<string, any>;

          if (!metaObj.trigger) {
            errors.push("Missing required field: trigger");
          } else if (typeof metaObj.trigger !== "string") {
            errors.push('Field "trigger" must be a string');
          }

          if (metaObj.tags && !Array.isArray(metaObj.tags)) {
            errors.push('Field "tags" must be an array');
          }

          if (metaObj.variables && !Array.isArray(metaObj.variables)) {
            errors.push('Field "variables" must be an array');
          }

          if (metaObj.isActive && typeof metaObj.isActive !== "boolean") {
            errors.push('Field "isActive" must be a boolean');
          }
        }
      } catch (error) {
        errors.push(
          `Invalid YAML syntax: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      if (!extracted.body.trim()) {
        errors.push("Body content cannot be empty");
      }
    }
    // If no frontmatter, plain text is always valid

    return { valid: errors.length === 0, errors };
  }

  /**
   * Create a new plain text snippet with YAML frontmatter
   */
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

  private normalizeVariables(
    variables: any,
  ): { name: string; prompt: string }[] {
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

  createNew(
    trigger: string,
    content: string,
    options: Partial<SnippetMeta> = {},
  ): SnippetDoc {
    const now = new Date().toISOString();
    const id =
      options.id ||
      `txt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const meta: SnippetMeta = {
      id,
      trigger,
      content,
      snipDependencies: [],
      contentType: "plaintext",
      description: options.description || `Plain text snippet: ${trigger}`,
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
      format: "txt",
    };
  }
}
