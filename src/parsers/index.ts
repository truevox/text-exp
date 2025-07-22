/**
 * Simplified Parser Interface for JSON-Only Snippet System
 * Provides JSON parsing for snippet stores (only format used in production)
 */

import { JSONParser } from "./json.js";
import { detectFormat, type SnippetFormat } from "../utils/detectFormat.js";
import type {
  FormatParser,
  SnippetDoc,
  ParseOptions,
  SerializeOptions,
} from "../types/snippet-formats.js";

/**
 * Simplified parser for JSON-only snippet format
 */
export class MultiFormatParser {
  private jsonParser: JSONParser;

  constructor() {
    this.jsonParser = new JSONParser();
  }

  /**
   * Parse content (JSON only)
   * @param content - The content to parse
   * @param fileName - Optional filename for format detection hints
   * @param options - Parse options
   * @returns Parsed snippet document(s)
   */
  parse(
    content: string,
    fileName?: string,
    options: ParseOptions = {},
  ): SnippetDoc | SnippetDoc[] {
    const format = detectFormat(fileName || "", content);
    if (format !== "json") {
      throw new Error(`Only JSON format is supported, got: ${format}`);
    }
    return this.parseAs(content, format, fileName, options);
  }

  /**
   * Parse content as JSON format
   * @param content - The content to parse
   * @param format - The format to parse as (must be 'json')
   * @param fileName - Optional filename
   * @param options - Parse options
   * @returns Parsed snippet document(s)
   */
  parseAs(
    content: string,
    format: SnippetFormat,
    fileName?: string,
    _options: ParseOptions = {},
  ): SnippetDoc | SnippetDoc[] {
    if (format !== "json") {
      throw new Error(`Only JSON format is supported, got: ${format}`);
    }

    try {
      return this.jsonParser.parse(content, fileName);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON content: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Serialize snippet document(s) to JSON string
   * @param docs - The document(s) to serialize
   * @param format - Target format (must be 'json' or undefined)
   * @param options - Serialization options
   * @returns Serialized JSON string content
   */
  serialize(
    docs: SnippetDoc | SnippetDoc[],
    format?: SnippetFormat,
    options: SerializeOptions = {},
  ): string {
    const targetFormat = format || "json";
    if (targetFormat !== "json") {
      throw new Error(`Only JSON format is supported, got: ${targetFormat}`);
    }

    try {
      return this.jsonParser.serialize(docs, options);
    } catch (error) {
      throw new Error(
        `Failed to serialize JSON content: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Validate content for JSON format
   * @param content - The content to validate
   * @param format - The format to validate against (must be 'json')
   * @returns Validation result
   */
  validate(
    content: string,
    format: SnippetFormat,
  ): { valid: boolean; errors: string[] } {
    if (format !== "json") {
      return {
        valid: false,
        errors: [`Only JSON format is supported, got: ${format}`],
      };
    }

    return this.jsonParser.validate(content);
  }

  /**
   * Get the JSON parser
   * @param format - The format (must be 'json')
   * @returns The JSON parser or undefined
   */
  getParser(format: SnippetFormat): FormatParser | undefined {
    return format === "json" ? this.jsonParser : undefined;
  }

  /**
   * Get supported formats (JSON only)
   * @returns Array containing only 'json'
   */
  getSupportedFormats(): SnippetFormat[] {
    return ["json"];
  }

  /**
   * Check if a format is supported (JSON only)
   * @param format - The format to check
   * @returns True if format is 'json'
   */
  isFormatSupported(format: string): format is SnippetFormat {
    return format === "json";
  }

  /**
   * Detect format from content and filename
   * @param content - The content
   * @param fileName - Optional filename
   * @returns Detected format (should be 'json')
   */
  detectFormat(content: string, fileName?: string): SnippetFormat {
    return detectFormat(fileName || "", content);
  }

  /**
   * Parse multiple JSON files
   * @param files - Array of file objects with content and filename
   * @param options - Parse options
   * @returns Array of parsed documents
   */
  parseMultiple(
    files: Array<{ content: string; fileName?: string }>,
    options: ParseOptions = {},
  ): SnippetDoc[] {
    const results: SnippetDoc[] = [];

    for (const file of files) {
      try {
        const parsed = this.parse(file.content, file.fileName, options);
        if (Array.isArray(parsed)) {
          results.push(...parsed);
        } else {
          results.push(parsed);
        }
      } catch (error) {
        console.warn(
          `Failed to parse file ${file.fileName}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Validate multiple JSON files
   * @param files - Array of file objects with content and format
   * @returns Validation results for each file
   */
  validateMultiple(
    files: Array<{ content: string; format: SnippetFormat; fileName?: string }>,
  ): Array<{ fileName?: string; valid: boolean; errors: string[] }> {
    return files.map((file) => ({
      fileName: file.fileName,
      ...this.validate(file.content, file.format),
    }));
  }
}

// Export JSON parser
export { JSONParser } from "./json.js";

// Export the simplified parser as default
export default MultiFormatParser;

// Create a singleton instance for convenience
export const multiFormatParser = new MultiFormatParser();
