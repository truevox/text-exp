/**
 * Markdown Format Parser for PuffPuffPaste
 * Handles Markdown with YAML frontmatter
 */

import * as yaml from "js-yaml";
import type {
  FormatParser,
  SnippetDoc,
  SnippetMeta,
  VariableDef,
  ParseOptions,
  SerializeOptions,
} from "../types/snippet-formats.js";
import type { SnippetFormat } from "../utils/detectFormat.js";
import {
  extractYAMLFrontmatter,
  hasYAMLFrontmatter,
} from "../utils/detectFormat.js";

export class MarkdownParser implements FormatParser {
  getFormat(): SnippetFormat {
    return "md";
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
        `md-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trigger: meta.trigger,
      content: extracted.body,
      snipDependencies: Array.isArray(meta.snipDependencies)
        ? meta.snipDependencies
        : [],
      contentType: this.normalizeContentType(meta.contentType),
      description: meta.description || "",
      scope: this.normalizeScope(meta.scope),
      variables: this.normalizeVariables(meta.variables, extracted.body),
      images: this.extractImages(extracted.body),
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      createdAt: meta.createdAt || now,
      createdBy: meta.createdBy || "user",
      updatedAt: meta.updatedAt || now,
      updatedBy: meta.updatedBy || "user",
    };

    return {
      meta: fullMeta,
      body: extracted.body.trim(),
      format: "md",
    };
  }

  private parseWithoutFrontmatter(
    content: string,
    fileName?: string,
  ): SnippetDoc {
    // For markdown without frontmatter, try to extract title and create metadata
    let title = "";
    let trigger = "";

    // Look for markdown title (# Title)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      trigger = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 20);
    }

    // Fallback to filename
    if (!trigger && fileName) {
      trigger = fileName.replace(/\.(md|markdown|ppp\.md)$/i, "").toLowerCase();
    }

    if (!trigger) {
      trigger = `md-${Date.now()}`;
    }

    const now = new Date().toISOString();
    const meta: SnippetMeta = {
      id: `md-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trigger,
      content: content,
      snipDependencies: [],
      contentType: "markdown",
      description:
        title || `Markdown snippet${fileName ? ` from ${fileName}` : ""}`,
      scope: "personal",
      variables: this.extractVariables(content),
      images: this.extractImages(content),
      tags: [],
      createdAt: now,
      createdBy: "user",
      updatedAt: now,
      updatedBy: "user",
    };

    return {
      meta,
      body: content,
      format: "md",
    };
  }

  private extractVariables(markdown: string): VariableDef[] {
    const variables = new Set<string>();

    // Extract placeholder variables like {variable} or {{variable}}
    const placeholderMatches = markdown.match(/\{+([^}]+)\}+/g);
    if (placeholderMatches) {
      placeholderMatches.forEach((match) => {
        const variable = match.replace(/[{}]/g, "").trim();
        if (variable && !variable.includes(" ")) {
          variables.add(variable);
        }
      });
    }

    return Array.from(variables).map((name) => ({
      name,
      prompt: `Enter ${name}`,
    }));
  }

  private extractImages(markdown: string): string[] {
    const images = new Set<string>();

    // Extract markdown image syntax: ![alt](url) or ![alt](url "title")
    const imageMatches = markdown.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
    if (imageMatches) {
      imageMatches.forEach((match) => {
        const urlMatch = match.match(/!\[([^\]]*)\]\(([^)"\s]+)/);
        if (urlMatch && urlMatch[2]) {
          images.add(urlMatch[2]);
        }
      });
    }

    // Extract HTML img tags
    const htmlImageMatches = markdown.match(
      /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi,
    );
    if (htmlImageMatches) {
      htmlImageMatches.forEach((match) => {
        const srcMatch = match.match(/src\s*=\s*["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          images.add(srcMatch[1]);
        }
      });
    }

    return Array.from(images);
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
    return "markdown"; // Default for MD files
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

  private normalizeVariables(variables: any, content?: string): VariableDef[] {
    const variableMap = new Map<string, string>();

    // First add from YAML frontmatter
    if (Array.isArray(variables)) {
      variables.forEach((v) => {
        if (typeof v === "string") {
          variableMap.set(v, `Enter ${v}`);
        } else if (v && typeof v === "object" && v.name) {
          variableMap.set(v.name, v.prompt || `Enter ${v.name}`);
        }
      });
    }

    // Then extract from content if provided
    if (content) {
      const variableRegex = /\{([^}]+)\}/g;
      let match;
      while ((match = variableRegex.exec(content)) !== null) {
        const name = match[1];
        if (!variableMap.has(name)) {
          variableMap.set(name, `Enter ${name}`);
        }
      }
    }

    return Array.from(variableMap.entries()).map(([name, prompt]) => ({
      name,
      prompt,
    }));
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
    if (meta.scope && meta.scope !== "personal") yamlMeta.scope = meta.scope;

    // Include timestamps if requested
    if (options.includeTimestamps) {
      yamlMeta.createdAt = meta.createdAt;
      yamlMeta.updatedAt = meta.updatedAt;
      yamlMeta.createdBy = meta.createdBy;
      yamlMeta.updatedBy = meta.updatedBy;
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

          if (metaObj.images && !Array.isArray(metaObj.images)) {
            errors.push('Field "images" must be an array');
          }
        }
      } catch (error) {
        errors.push(
          `Invalid YAML syntax: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      if (!extracted.body.trim()) {
        errors.push("Markdown body content cannot be empty");
      }

      // Validate markdown syntax (basic checks)
      this.validateMarkdownSyntax(extracted.body, errors);
    } else {
      // Validate standalone markdown
      this.validateMarkdownSyntax(trimmed, errors);
    }

    return { valid: errors.length === 0, errors };
  }

  private validateMarkdownSyntax(markdown: string, errors: string[]): void {
    // Check for unmatched brackets in links and images
    const linkBrackets = (markdown.match(/\[/g) || []).length;
    const linkCloseBrackets = (markdown.match(/\]/g) || []).length;
    if (linkBrackets !== linkCloseBrackets) {
      errors.push("Unmatched square brackets in markdown links");
    }

    // Check for malformed image syntax
    const malformedImages = markdown.match(/!\[[^\]]*\]\([^)]*$/gm);
    if (malformedImages) {
      errors.push("Malformed image syntax (unclosed parentheses)");
    }

    // Check for malformed links
    const malformedLinks = markdown.match(/\[[^\]]*\]\([^)]*$/gm);
    if (malformedLinks) {
      errors.push("Malformed link syntax (unclosed parentheses)");
    }
  }

  /**
   * Create a new markdown snippet with YAML frontmatter
   */
  createNew(
    trigger: string,
    content: string,
    options: Partial<SnippetMeta> = {},
  ): SnippetDoc {
    const now = new Date().toISOString();
    const id =
      options.id ||
      `md-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const meta: SnippetMeta = {
      id,
      trigger,
      content,
      snipDependencies: [],
      contentType: "markdown",
      description: options.description || `Markdown snippet: ${trigger}`,
      scope: "personal",
      variables: this.extractVariables(content),
      images: this.extractImages(content),
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
      format: "md",
    };
  }
}
