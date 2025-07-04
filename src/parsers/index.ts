/**
 * Unified Parser Interface for Multi-Format Snippet System
 * Provides a single entry point for all format parsing operations
 */

import { JSONParser } from './json.js';
import { TxtParser } from './txt.js';
import { MarkdownParser } from './md.js';
import { HTMLParser } from './html.js';
import { LaTeXParser } from './tex.js';
import { detectFormat, type SnippetFormat } from '../utils/detectFormat.js';
import type { FormatParser, SnippetDoc, ParseOptions, SerializeOptions } from '../types/snippet-formats.js';

/**
 * Parser factory and unified interface for all snippet formats
 */
export class MultiFormatParser {
  private parsers: Map<SnippetFormat, FormatParser>;

  constructor() {
    this.parsers = new Map([
      ['json', new JSONParser()],
      ['txt', new TxtParser()],
      ['md', new MarkdownParser()],
      ['html', new HTMLParser()],
      ['tex', new LaTeXParser()]
    ]);
  }

  /**
   * Parse content with automatic format detection
   * @param content - The content to parse
   * @param fileName - Optional filename for format detection hints
   * @param options - Parse options
   * @returns Parsed snippet document(s)
   */
  parse(content: string, fileName?: string, options: ParseOptions = {}): SnippetDoc | SnippetDoc[] {
    const format = detectFormat(fileName || '', content);
    return this.parseAs(content, format, fileName, options);
  }

  /**
   * Parse content as a specific format
   * @param content - The content to parse
   * @param format - The format to parse as
   * @param fileName - Optional filename
   * @param options - Parse options
   * @returns Parsed snippet document(s)
   */
  parseAs(content: string, format: SnippetFormat, fileName?: string, options: ParseOptions = {}): SnippetDoc | SnippetDoc[] {
    const parser = this.getParser(format);
    if (!parser) {
      throw new Error(`No parser available for format: ${format}`);
    }

    try {
      return parser.parse(content, fileName, options);
    } catch (error) {
      throw new Error(`Failed to parse ${format} content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Serialize snippet document(s) to string
   * @param docs - The document(s) to serialize
   * @param format - Target format (defaults to document's format)
   * @param options - Serialization options
   * @returns Serialized string content
   */
  serialize(docs: SnippetDoc | SnippetDoc[], format?: SnippetFormat, options: SerializeOptions = {}): string {
    const targetFormat = format || (Array.isArray(docs) ? docs[0]?.format : docs.format) || 'json';
    const parser = this.getParser(targetFormat);
    
    if (!parser) {
      throw new Error(`No parser available for format: ${targetFormat}`);
    }

    try {
      // If converting between formats, convert the documents first
      if (format && format !== (Array.isArray(docs) ? docs[0]?.format : docs.format)) {
        docs = this.convertFormat(docs, format);
      }

      return parser.serialize(docs, options);
    } catch (error) {
      throw new Error(`Failed to serialize ${targetFormat} content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate content for a specific format
   * @param content - The content to validate
   * @param format - The format to validate against
   * @returns Validation result
   */
  validate(content: string, format: SnippetFormat): { valid: boolean; errors: string[] } {
    const parser = this.getParser(format);
    if (!parser) {
      return {
        valid: false,
        errors: [`No parser available for format: ${format}`]
      };
    }

    return parser.validate(content);
  }

  /**
   * Convert snippet document(s) between formats
   * @param docs - The document(s) to convert
   * @param targetFormat - The target format
   * @returns Converted document(s)
   */
  convertFormat(docs: SnippetDoc | SnippetDoc[], targetFormat: SnippetFormat): SnippetDoc | SnippetDoc[] {
    const docsArray = Array.isArray(docs) ? docs : [docs];
    const convertedDocs = docsArray.map(doc => ({
      ...doc,
      format: targetFormat,
      // Update content type if needed
      meta: {
        ...doc.meta,
        contentType: this.getContentTypeForFormat(targetFormat)
      }
    }));

    return Array.isArray(docs) ? convertedDocs : convertedDocs[0];
  }

  /**
   * Get available parsers
   * @returns Map of format to parser
   */
  getParsers(): Map<SnippetFormat, FormatParser> {
    return new Map(this.parsers);
  }

  /**
   * Get parser for a specific format
   * @param format - The format
   * @returns The parser or undefined
   */
  getParser(format: SnippetFormat): FormatParser | undefined {
    return this.parsers.get(format);
  }

  /**
   * Get all supported formats
   * @returns Array of supported formats
   */
  getSupportedFormats(): SnippetFormat[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Check if a format is supported
   * @param format - The format to check
   * @returns True if supported
   */
  isFormatSupported(format: string): format is SnippetFormat {
    return this.parsers.has(format as SnippetFormat);
  }

  /**
   * Detect format from content and filename
   * @param content - The content
   * @param fileName - Optional filename
   * @returns Detected format
   */
  detectFormat(content: string, fileName?: string): SnippetFormat {
    return detectFormat(fileName || '', content);
  }

  /**
   * Parse multiple files with different formats
   * @param files - Array of file objects with content and filename
   * @param options - Parse options
   * @returns Array of parsed documents
   */
  parseMultiple(files: Array<{ content: string; fileName?: string }>, options: ParseOptions = {}): SnippetDoc[] {
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
        console.warn(`Failed to parse file ${file.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Validate multiple files
   * @param files - Array of file objects with content and format
   * @returns Validation results for each file
   */
  validateMultiple(files: Array<{ content: string; format: SnippetFormat; fileName?: string }>): Array<{ fileName?: string; valid: boolean; errors: string[] }> {
    return files.map(file => ({
      fileName: file.fileName,
      ...this.validate(file.content, file.format)
    }));
  }

  private getContentTypeForFormat(format: SnippetFormat): "plainText" | "markdown" | "html" | "latex" {
    switch (format) {
      case 'json':
        return 'plainText';
      case 'txt':
        return 'plainText';
      case 'md':
        return 'markdown';
      case 'html':
        return 'html';
      case 'tex':
        return 'latex';
      default:
        return 'plainText';
    }
  }

}

// Export individual parsers
export { JSONParser } from './json.js';
export { TxtParser } from './txt.js';
export { MarkdownParser } from './md.js';
export { HTMLParser } from './html.js';
export { LaTeXParser } from './tex.js';

// Export the unified parser as default
export default MultiFormatParser;

// Create a singleton instance for convenience
export const multiFormatParser = new MultiFormatParser();