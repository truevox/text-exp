/**
 * LaTeX Format Parser for PuffPuffPaste
 * Handles LaTeX with YAML frontmatter
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

export class LaTeXParser implements FormatParser {
  getFormat(): SnippetFormat {
    return "tex";
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
        `tex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trigger: meta.trigger,
      content: extracted.body,
      snipDependencies: Array.isArray(meta.snipDependencies)
        ? meta.snipDependencies
        : [],
      contentType: this.normalizeContentType(meta.contentType),
      description: meta.description || "",
      scope: this.normalizeScope(meta.scope),
      variables: this.normalizeVariables(meta.variables, extracted.body),
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
      format: "tex",
    };
  }

  private parseWithoutFrontmatter(
    content: string,
    fileName?: string,
  ): SnippetDoc {
    // For LaTeX without frontmatter, try to extract title from \title{} command
    let title = "";
    let trigger = "";

    // Extract title from LaTeX
    const titleMatch = content.match(/\\title\{([^}]+)\}/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      trigger = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 20);
    }

    // Fallback to filename
    if (!trigger && fileName) {
      trigger = fileName.replace(/\.(tex|latex|ppp\.tex)$/i, "").toLowerCase();
    }

    if (!trigger) {
      trigger = `tex-${Date.now()}`;
    }

    const now = new Date().toISOString();
    const meta: SnippetMeta = {
      id: `tex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trigger,
      content: content,
      snipDependencies: [],
      contentType: "latex",
      description:
        title || `LaTeX snippet${fileName ? ` from ${fileName}` : ""}`,
      scope: "personal",
      variables: this.extractVariables(content),
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
      format: "tex",
    };
  }

  private extractVariables(latex: string): VariableDef[] {
    const variables = new Set<string>();

    // Extract placeholder variables like {variable}
    const variableRegex = /\{([^}]+)\}/g;
    let match;
    while ((match = variableRegex.exec(latex)) !== null) {
      const variable = match[1];
      // Skip LaTeX commands and common LaTeX constructs
      if (
        !this.isLaTeXCommand(variable) &&
        !variable.includes("\\") &&
        !variable.includes(" ")
      ) {
        variables.add(variable);
      }
    }

    return Array.from(variables).map((name) => ({
      name,
      prompt: `Enter ${name}`,
    }));
  }

  private isLaTeXCommand(text: string): boolean {
    // Common LaTeX environments and commands to ignore
    const latexConstructs = [
      "document",
      "theorem",
      "proof",
      "equation",
      "align",
      "figure",
      "table",
      "center",
      "itemize",
      "enumerate",
      "description",
      "abstract",
      "section",
      "subsection",
      "chapter",
      "part",
      "paragraph",
      "subparagraph",
    ];

    return (
      latexConstructs.includes(text.toLowerCase()) ||
      text.startsWith("\\") ||
      /^[a-z]+\*?$/i.test(text)
    ); // Single word commands
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
    return "latex"; // Default for LaTeX files
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
        if (
          !this.isLaTeXCommand(name) &&
          !name.includes("\\") &&
          !variableMap.has(name)
        ) {
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
      return doc
        .map((d) => this.serializeOne(d, options))
        .join("\n\n% \\newpage\n\n");
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
        errors.push("LaTeX body content cannot be empty");
      }

      // Validate LaTeX syntax
      this.validateLaTeXSyntax(extracted.body, errors);
    } else {
      // Validate standalone LaTeX
      this.validateLaTeXSyntax(trimmed, errors);
    }

    return { valid: errors.length === 0, errors };
  }

  private validateLaTeXSyntax(latex: string, errors: string[]): void {
    // Check for unmatched braces
    const openBraces = (latex.match(/\{/g) || []).length;
    const closeBraces = (latex.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push("Unmatched braces in LaTeX");
    }

    // Check for unmatched environments
    const beginMatches = latex.match(/\\begin\{([^}]+)\}/g);
    const endMatches = latex.match(/\\end\{([^}]+)\}/g);

    if (beginMatches && endMatches) {
      const beginEnvs = beginMatches
        .map((m) => m.match(/\\begin\{([^}]+)\}/)?.[1])
        .filter(Boolean);
      const endEnvs = endMatches
        .map((m) => m.match(/\\end\{([^}]+)\}/)?.[1])
        .filter(Boolean);

      // Check if all begin environments have corresponding end environments
      for (const env of beginEnvs) {
        const beginCount = beginEnvs.filter((e) => e === env).length;
        const endCount = endEnvs.filter((e) => e === env).length;
        if (beginCount !== endCount) {
          errors.push(`Unmatched LaTeX environment: ${env}`);
        }
      }
    } else if (beginMatches && !endMatches) {
      errors.push("LaTeX environments not properly closed");
    }

    // Check for common LaTeX errors
    if (latex.includes("$$") && (latex.match(/\$\$/g) || []).length % 2 !== 0) {
      errors.push("Unmatched display math delimiters ($$)");
    }

    if (
      latex.includes("$") &&
      (latex.match(/(?<!\$)\$(?!\$)/g) || []).length % 2 !== 0
    ) {
      errors.push("Unmatched inline math delimiters ($)");
    }
  }

  /**
   * Create a new LaTeX snippet with YAML frontmatter
   */
  createNew(
    trigger: string,
    content: string,
    options: Partial<SnippetMeta> = {},
  ): SnippetDoc {
    const now = new Date().toISOString();
    const id =
      options.id ||
      `tex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const meta: SnippetMeta = {
      id,
      trigger,
      content,
      snipDependencies: [],
      contentType: "latex",
      description: options.description || `LaTeX snippet: ${trigger}`,
      scope: "personal",
      variables: this.extractVariables(content),
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
      format: "tex",
    };
  }
}
