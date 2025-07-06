/**
 * Format Detection Utility for Multi-Format Snippet Storage
 * Automatically detects snippet format based on filename and content
 */

export type SnippetFormat = "json" | "txt" | "md" | "html" | "tex";

/**
 * Detects the format of a snippet based on filename and content
 * @param fileName - The filename of the snippet
 * @param fileContent - The content of the snippet
 * @returns The detected format
 */
export function detectFormat(
  fileName: string,
  fileContent: string,
): SnippetFormat {
  const content = fileContent.trim();
  const lowerFileName = fileName.toLowerCase();

  // JSON format detection
  if (lowerFileName.endsWith(".json") || lowerFileName.endsWith(".ppp.json")) {
    return "json";
  }

  // Check if content starts with JSON structure
  if (content.startsWith("{") || content.startsWith("[")) {
    try {
      JSON.parse(content);
      return "json";
    } catch {
      // Not valid JSON, continue with other checks
    }
  }

  // LaTeX format detection
  if (lowerFileName.endsWith(".tex") || lowerFileName.endsWith(".ppp.tex")) {
    return "tex";
  }

  // Check for LaTeX document structure or LaTeX commands
  if (
    /\\begin\{document\}|\\documentclass|\\usepackage|\\begin\{.*\}|\\end\{.*\}|\\[a-zA-Z]+/i.test(
      content,
    )
  ) {
    return "tex";
  }

  // HTML format detection
  if (
    lowerFileName.endsWith(".html") ||
    lowerFileName.endsWith(".htm") ||
    lowerFileName.endsWith(".ppp.html")
  ) {
    return "html";
  }

  // Check for HTML tags (case insensitive)
  if (
    /<html|<head|<body|<p|<div|<span|<h[1-6]|<ul|<ol|<li|<table|<tr|<td|<img|<a\s/i.test(
      content,
    )
  ) {
    return "html";
  }

  // Markdown format detection
  if (
    lowerFileName.endsWith(".md") ||
    lowerFileName.endsWith(".markdown") ||
    lowerFileName.endsWith(".ppp.md")
  ) {
    return "md";
  }

  // Check for Markdown with YAML frontmatter and markdown syntax
  const yamlFrontmatterWithMarkdown =
    /^---\n[\s\S]*?\n---\n[\s\S]*?[[#*_`>-]|^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|```|`[^`]+`|\[.*\]\(.*\)/m;
  if (yamlFrontmatterWithMarkdown.test(content)) {
    return "md";
  }

  // Plain text format (default)
  // This includes plain text with YAML frontmatter
  return "txt";
}

/**
 * Checks if content has YAML frontmatter
 * @param content - The content to check
 * @returns True if content has YAML frontmatter
 */
export function hasYAMLFrontmatter(content: string): boolean {
  return /^---\n[\s\S]*?\n---\n/m.test(content.trim());
}

/**
 * Extracts YAML frontmatter and body from content
 * @param content - The content with potential YAML frontmatter
 * @returns Object with frontmatter and body, or null if no frontmatter
 */
export function extractYAMLFrontmatter(
  content: string,
): { frontmatter: string; body: string } | null {
  const trimmed = content.trim();
  const match = trimmed.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m);

  if (match) {
    return {
      frontmatter: match[1],
      body: match[2],
    };
  }

  return null;
}

/**
 * Gets the appropriate file extension for a format
 * @param format - The snippet format
 * @returns The file extension (without dot)
 */
export function getFileExtension(format: SnippetFormat): string {
  switch (format) {
    case "json":
      return "ppp.json";
    case "txt":
      return "ppp.txt";
    case "md":
      return "ppp.md";
    case "html":
      return "ppp.html";
    case "tex":
      return "ppp.tex";
    default:
      return "ppp.txt";
  }
}

/**
 * Gets a human-readable name for a format
 * @param format - The snippet format
 * @returns The human-readable format name
 */
export function getFormatName(format: SnippetFormat): string {
  switch (format) {
    case "json":
      return "JSON";
    case "txt":
      return "Plain Text";
    case "md":
      return "Markdown";
    case "html":
      return "HTML";
    case "tex":
      return "LaTeX";
    default:
      return "Plain Text";
  }
}

/**
 * Gets the MIME type for a format
 * @param format - The snippet format
 * @returns The MIME type
 */
export function getMimeType(format: SnippetFormat): string {
  switch (format) {
    case "json":
      return "application/json";
    case "txt":
      return "text/plain";
    case "md":
      return "text/markdown";
    case "html":
      return "text/html";
    case "tex":
      return "application/x-latex";
    default:
      return "text/plain";
  }
}
