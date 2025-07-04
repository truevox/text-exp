/**
 * Tests for Multi-Format Parser System
 */

import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MultiFormatParser } from '../../src/parsers/index.js';
import { detectFormat } from '../../src/utils/detectFormat.js';
import type { SnippetDoc } from '../../src/types/snippet-formats.js';

// Helper to read fixture files
function readFixture(filename: string): string {
  return readFileSync(join(process.cwd(), 'tests/fixtures', filename), 'utf-8');
}

describe('Multi-Format Parser System', () => {
  let parser: MultiFormatParser;

  beforeEach(() => {
    parser = new MultiFormatParser();
  });

  describe('Format Detection', () => {
    test('detects JSON format correctly', () => {
      const content = readFixture('sample.json');
      expect(detectFormat('sample.json', content)).toBe('json');
      expect(detectFormat('', content)).toBe('json'); // Content-based detection
    });

    test('detects TXT format correctly', () => {
      const content = readFixture('sample.txt');
      expect(detectFormat('sample.txt', content)).toBe('txt');
      expect(detectFormat('sample.ppp.txt', content)).toBe('txt');
    });

    test('detects Markdown format correctly', () => {
      const content = readFixture('sample.md');
      expect(detectFormat('sample.md', content)).toBe('md');
      expect(detectFormat('sample.markdown', content)).toBe('md');
    });

    test('detects HTML format correctly', () => {
      const content = readFixture('sample.html');
      expect(detectFormat('sample.html', content)).toBe('html');
      expect(detectFormat('', content)).toBe('html'); // Content-based detection
    });

    test('detects LaTeX format correctly', () => {
      const content = readFixture('sample.tex');
      expect(detectFormat('sample.tex', content)).toBe('tex');
      expect(detectFormat('', content)).toBe('tex'); // Content-based detection
    });
  });

  describe('JSON Format Parsing', () => {
    test('parses JSON fixture correctly', () => {
      const content = readFixture('sample.json');
      const result = parser.parseAs(content, 'json');

      expect(Array.isArray(result)).toBe(true);
      const docs = result as SnippetDoc[];
      expect(docs).toHaveLength(2);

      const firstDoc = docs[0];
      expect(firstDoc.meta.trigger).toBe('hello');
      expect(firstDoc.meta.description).toBe('Simple greeting');
      expect(firstDoc.body).toBe('Hello {name}! How are you today?');
      expect(firstDoc.format).toBe('json');
    });

    test('validates JSON format', () => {
      const content = readFixture('sample.json');
      const validation = parser.validate(content, 'json');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('serializes JSON format', () => {
      const content = readFixture('sample.json');
      const parsed = parser.parseAs(content, 'json') as SnippetDoc[];
      const serialized = parser.serialize(parsed, 'json');

      // Should be valid JSON
      expect(() => JSON.parse(serialized)).not.toThrow();
      
      // Should contain expected content
      expect(serialized).toContain('hello');
      expect(serialized).toContain('signature');
    });
  });

  describe('Plain Text Format Parsing', () => {
    test('parses TXT fixture correctly', () => {
      const content = readFixture('sample.txt');
      const result = parser.parseAs(content, 'txt');

      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.meta.trigger).toBe('contact');
      expect(doc.meta.description).toBe('Contact information template');
      expect(doc.body).toContain('Contact Information:');
      expect(doc.format).toBe('txt');
    });

    test('validates TXT format', () => {
      const content = readFixture('sample.txt');
      const validation = parser.validate(content, 'txt');
      expect(validation.valid).toBe(true);
    });

    test('round-trip serialization for TXT', () => {
      const content = readFixture('sample.txt');
      const parsed = parser.parseAs(content, 'txt') as SnippetDoc;
      const serialized = parser.serialize(parsed, 'txt');
      const reparsed = parser.parseAs(serialized, 'txt') as SnippetDoc;

      expect(reparsed.meta.trigger).toBe(parsed.meta.trigger);
      expect(reparsed.meta.description).toBe(parsed.meta.description);
      expect(reparsed.body.trim()).toBe(parsed.body.trim());
    });
  });

  describe('Markdown Format Parsing', () => {
    test('parses Markdown fixture correctly', () => {
      const content = readFixture('sample.md');
      const result = parser.parseAs(content, 'md');

      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.meta.trigger).toBe('readme');
      expect(doc.meta.description).toBe('README template for projects');
      expect(doc.body).toContain('# {projectName}');
      expect(doc.format).toBe('md');
      expect(doc.meta.variables.some(v => v.name === 'projectName')).toBe(true);
      expect(doc.meta.variables.some(v => v.name === 'description')).toBe(true);
    });

    test('extracts variables from Markdown', () => {
      const content = readFixture('sample.md');
      const result = parser.parseAs(content, 'md') as SnippetDoc;
      
      expect(result.meta.variables.map(v => v.name)).toEqual(
        expect.arrayContaining(['projectName', 'description'])
      );
    });

    test('validates Markdown format', () => {
      const content = readFixture('sample.md');
      const validation = parser.validate(content, 'md');
      expect(validation.valid).toBe(true);
    });
  });

  describe('HTML Format Parsing', () => {
    test('parses HTML fixture correctly', () => {
      const content = readFixture('sample.html');
      const result = parser.parseAs(content, 'html');

      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.meta.trigger).toBe('card');
      expect(doc.meta.description).toBe('Responsive card component');
      expect(doc.body).toContain('<div class="card"');
      expect(doc.format).toBe('html');
      expect(doc.meta.variables.some(v => v.name === 'title')).toBe(true);
      expect(doc.meta.images).toContain('https://example.com/placeholder.jpg');
    });

    test('extracts images from HTML', () => {
      const content = readFixture('sample.html');
      const result = parser.parseAs(content, 'html') as SnippetDoc;
      
      expect(result.meta.images).toEqual(
        expect.arrayContaining(['https://example.com/placeholder.jpg'])
      );
    });

    test('sanitizes HTML content by default', () => {
      const maliciousHTML = `<!-- YAML
trigger: "test"
-->
<div onclick="alert('xss')">Safe content</div>
<script>alert('xss')</script>`;

      const result = parser.parseAs(maliciousHTML, 'html', undefined, { sanitizeHtml: true }) as SnippetDoc;
      
      // Script should be removed
      expect(result.body).not.toContain('<script>');
      expect(result.body).not.toContain('onclick');
      expect(result.body).toContain('Safe content');
    });

    test('validates HTML format', () => {
      const content = readFixture('sample.html');
      const validation = parser.validate(content, 'html');
      expect(validation.valid).toBe(true);
    });
  });

  describe('LaTeX Format Parsing', () => {
    test('parses LaTeX fixture correctly', () => {
      const content = readFixture('sample.tex');
      const result = parser.parseAs(content, 'tex');

      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.meta.trigger).toBe('theorem');
      expect(doc.meta.description).toBe('Mathematical theorem template');
      expect(doc.body).toContain('\\begin{theorem}');
      expect(doc.format).toBe('tex');
      expect(doc.meta.variables.some(v => v.name === 'theoremName')).toBe(true);
    });

    test('extracts LaTeX variables', () => {
      const content = readFixture('sample.tex');
      const result = parser.parseAs(content, 'tex') as SnippetDoc;
      
      expect(result.meta.variables.map(v => v.name)).toEqual(
        expect.arrayContaining(['theoremName', 'statement', 'proof'])
      );
    });

    test('validates LaTeX format', () => {
      const content = readFixture('sample.tex');
      const validation = parser.validate(content, 'tex');
      expect(validation.valid).toBe(true);
    });

    test('detects unmatched LaTeX environments', () => {
      const invalidLaTeX = `---
trigger: "bad"
---
\\begin{theorem}
Some content
\\end{proof}`;

      const validation = parser.validate(invalidLaTeX, 'tex');
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(err => err.includes('environment'))).toBe(true);
    });
  });

  describe('Format Conversion', () => {
    test('converts between formats', () => {
      const content = readFixture('sample.txt');
      const parsed = parser.parseAs(content, 'txt') as SnippetDoc;
      
      const converted = parser.convertFormat(parsed, 'md') as SnippetDoc;
      expect(converted.format).toBe('md');
      expect(converted.meta.contentType).toBe('markdown');
      expect(converted.body).toBe(parsed.body); // Content should remain the same
    });

    test('converts array of documents', () => {
      const content = readFixture('sample.json');
      const parsed = parser.parseAs(content, 'json') as SnippetDoc[];
      
      const converted = parser.convertFormat(parsed, 'txt') as SnippetDoc[];
      expect(converted).toHaveLength(2);
      expect(converted[0].format).toBe('txt');
      expect(converted[1].format).toBe('txt');
    });
  });

  describe('Automatic Format Detection and Parsing', () => {
    test('automatically detects and parses JSON', () => {
      const content = readFixture('sample.json');
      const result = parser.parse(content, 'sample.json');
      
      expect(Array.isArray(result)).toBe(true);
      const docs = result as SnippetDoc[];
      expect(docs[0].format).toBe('json');
    });

    test('automatically detects and parses Markdown', () => {
      const content = readFixture('sample.md');
      const result = parser.parse(content, 'sample.md');
      
      expect(Array.isArray(result)).toBe(false);
      const doc = result as SnippetDoc;
      expect(doc.format).toBe('md');
    });
  });

  describe('Multiple File Parsing', () => {
    test('parses multiple files with different formats', () => {
      const files = [
        { content: readFixture('sample.json'), fileName: 'sample.json' },
        { content: readFixture('sample.md'), fileName: 'sample.md' },
        { content: readFixture('sample.html'), fileName: 'sample.html' }
      ];

      const results = parser.parseMultiple(files);
      
      // JSON has 2 docs, MD and HTML have 1 each = 4 total
      expect(results).toHaveLength(4);
      
      const formats = results.map(doc => doc.format);
      expect(formats.filter(f => f === 'json')).toHaveLength(2);
      expect(formats.filter(f => f === 'md')).toHaveLength(1);
      expect(formats.filter(f => f === 'html')).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('handles invalid JSON gracefully', () => {
      const invalidJSON = '{ invalid json }';
      
      expect(() => parser.parseAs(invalidJSON, 'json')).toThrow();
    });

    test('handles missing required fields', () => {
      const invalidYAML = `---
description: "Missing trigger"
---
Some content`;

      expect(() => parser.parseAs(invalidYAML, 'txt')).toThrow('Missing required field: trigger');
    });

    test('validates format support', () => {
      expect(parser.isFormatSupported('json')).toBe(true);
      expect(parser.isFormatSupported('invalid')).toBe(false);
    });
  });

  describe('Serialization Options', () => {
    test('includes timestamps when requested', () => {
      const content = readFixture('sample.txt');
      const parsed = parser.parseAs(content, 'txt') as SnippetDoc;
      
      const serialized = parser.serialize(parsed, 'txt', { includeTimestamps: true });
      
      expect(serialized).toContain('createdAt:');
      expect(serialized).toContain('updatedAt:');
      expect(serialized).toContain('createdBy:');
      expect(serialized).toContain('updatedBy:');
    });

    test('pretty prints JSON when requested', () => {
      const content = readFixture('sample.json');
      const parsed = parser.parseAs(content, 'json');
      
      const compact = parser.serialize(parsed, 'json', { pretty: false });
      const pretty = parser.serialize(parsed, 'json', { pretty: true });
      
      expect(pretty.length).toBeGreaterThan(compact.length);
      expect(pretty).toContain('\n  '); // Indentation
    });
  });
});