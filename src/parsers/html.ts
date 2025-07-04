/**
 * HTML Format Parser for PuffPuffPaste
 * Handles HTML with YAML frontmatter embedded in comments
 */

import * as yaml from 'js-yaml';
import DOMPurify from 'dompurify';
import type { FormatParser, SnippetDoc, SnippetMeta, VariableDef, ParseOptions, SerializeOptions } from '../types/snippet-formats.js';
import type { SnippetFormat } from '../utils/detectFormat.js';

export class HTMLParser implements FormatParser {
  getFormat(): SnippetFormat {
    return 'html';
  }

  parse(content: string, fileName?: string, options: ParseOptions = {}): SnippetDoc {
    const trimmed = content.trim();
    
    // Check for YAML frontmatter in HTML comments
    const frontmatterMatch = this.extractHTMLFrontmatter(trimmed);
    if (frontmatterMatch) {
      return this.parseWithFrontmatter(trimmed, frontmatterMatch, fileName, options);
    } else {
      return this.parseWithoutFrontmatter(trimmed, fileName, options);
    }
  }

  private extractHTMLFrontmatter(content: string): { frontmatter: string; body: string } | null {
    // Look for YAML frontmatter in HTML comments at the beginning of the file
    // Format: <!-- YAML\n... YAML content ...\n-->
    const frontmatterRegex = /^<!--\s*YAML\s*\n([\s\S]*?)\n-->\s*([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (match) {
      return {
        frontmatter: match[1],
        body: match[2].trim()
      };
    }

    // Also try the standard --- format at the beginning
    const standardRegex = /^---\s*\n([\s\S]*?)\n---\s*([\s\S]*)$/;
    const standardMatch = content.match(standardRegex);
    
    if (standardMatch) {
      return {
        frontmatter: standardMatch[1],
        body: standardMatch[2].trim()
      };
    }

    return null;
  }

  private parseWithFrontmatter(content: string, extracted: { frontmatter: string; body: string }, fileName?: string, options: ParseOptions = {}): SnippetDoc {
    let meta: any;
    try {
      meta = yaml.load(extracted.frontmatter);
      if (!meta || typeof meta !== 'object') {
        throw new Error('YAML frontmatter must be an object');
      }
    } catch (error) {
      throw new Error(`Invalid YAML frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Validate required fields
    if (!meta.trigger) {
      throw new Error('Missing required field: trigger');
    }

    const now = new Date().toISOString();
    let htmlBody = extracted.body;

    // Sanitize HTML if requested
    if (options.sanitizeHtml !== false) {
      htmlBody = DOMPurify.sanitize(htmlBody, {
        ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'br', 'strong', 'em', 'code', 'pre', 'blockquote', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'button'],
        ALLOWED_ATTR: ['class', 'id', 'style', 'href', 'src', 'alt', 'title', 'target', 'rel', 'data-*']
      });
    }

    const fullMeta: SnippetMeta = {
      id: meta.id || `html-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trigger: meta.trigger,
      snipDependencies: Array.isArray(meta.snipDependencies) ? meta.snipDependencies : [],
      contentType: this.normalizeContentType(meta.contentType),
      description: meta.description || '',
      scope: this.normalizeScope(meta.scope),
      variables: this.normalizeVariables(meta.variables, extracted.body),
      images: this.extractImages(extracted.body, meta.images),
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      createdAt: meta.createdAt || now,
      createdBy: meta.createdBy || 'user',
      updatedAt: meta.updatedAt || now,
      updatedBy: meta.updatedBy || 'user'
    };

    return {
      meta: fullMeta,
      body: htmlBody,
      format: 'html'
    };
  }

  private parseWithoutFrontmatter(content: string, fileName?: string, options: ParseOptions = {}): SnippetDoc {
    // For HTML without frontmatter, try to extract title from <title> tag or filename
    let title = '';
    let trigger = '';
    
    // Extract title from HTML
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      trigger = title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    }
    
    // Fallback to filename
    if (!trigger && fileName) {
      trigger = fileName.replace(/\.(html?|htm|ppp\.html?)$/i, '').toLowerCase();
    }
    
    if (!trigger) {
      trigger = `html-${Date.now()}`;
    }

    const now = new Date().toISOString();
    let htmlBody = content;

    // Sanitize HTML if requested
    if (options.sanitizeHtml !== false) {
      htmlBody = DOMPurify.sanitize(htmlBody);
    }

    const meta: SnippetMeta = {
      id: `html-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trigger,
      snipDependencies: [],
      contentType: 'html',
      description: title || `HTML snippet${fileName ? ` from ${fileName}` : ''}`,
      scope: 'personal',
      variables: this.extractVariables(content),
      images: this.extractImages(content),
      tags: [],
      createdAt: now,
      createdBy: 'user',
      updatedAt: now,
      updatedBy: 'user'
    };

    return {
      meta,
      body: htmlBody,
      format: 'html'
    };
  }

  private extractVariables(html: string): VariableDef[] {
    const variables = new Set<string>();
    
    // Extract placeholder variables like {variable}
    const variableRegex = /\{([^}]+)\}/g;
    let match;
    while ((match = variableRegex.exec(html)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables).map(name => ({ name, prompt: `Enter ${name}` }));
  }

  private extractImages(html: string, yamlImages?: string[]): string[] {
    const images = new Set<string>();
    
    // Add images from YAML frontmatter first
    if (Array.isArray(yamlImages)) {
      yamlImages.forEach(img => images.add(img));
    }
    
    // Extract from img tags
    const imgMatches = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi);
    if (imgMatches) {
      imgMatches.forEach(match => {
        const srcMatch = match.match(/src\s*=\s*["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1] && !srcMatch[1].startsWith('{')) {
          images.add(srcMatch[1]);
        }
      });
    }
    
    return Array.from(images);
  }

  private normalizeContentType(contentType: any): "plainText" | "markdown" | "html" | "latex" {
    if (typeof contentType === 'string') {
      switch (contentType.toLowerCase()) {
        case 'text/markdown':
        case 'markdown':
          return 'markdown';
        case 'text/html':
        case 'html':
          return 'html';
        case 'application/x-latex':
        case 'text/x-latex':
        case 'latex':
        case 'tex':
          return 'latex';
        default:
          return 'plainText';
      }
    }
    return 'html'; // Default for HTML files
  }

  private normalizeScope(scope: any): "personal" | "group" | "org" {
    if (typeof scope === 'string') {
      switch (scope.toLowerCase()) {
        case 'group':
        case 'team':
        case 'department':
          return 'group';
        case 'org':
        case 'organization':
        case 'company':
          return 'org';
        default:
          return 'personal';
      }
    }
    return 'personal';
  }

  private normalizeVariables(variables: any, content?: string): VariableDef[] {
    const variableMap = new Map<string, string>();
    
    // First add from YAML frontmatter
    if (Array.isArray(variables)) {
      variables.forEach(v => {
        if (typeof v === 'string') {
          variableMap.set(v, `Enter ${v}`);
        } else if (v && typeof v === 'object' && v.name) {
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
    
    return Array.from(variableMap.entries()).map(([name, prompt]) => ({ name, prompt }));
  }

  serialize(doc: SnippetDoc | SnippetDoc[], options: SerializeOptions = {}): string {
    if (Array.isArray(doc)) {
      // For multiple docs, serialize each separately
      return doc.map(d => this.serializeOne(d, options)).join('\n\n<!-- DOCUMENT SEPARATOR -->\n\n');
    }
    return this.serializeOne(doc, options);
  }

  private serializeOne(doc: SnippetDoc, options: SerializeOptions = {}): string {
    const { meta, body } = doc;
    
    // Prepare metadata for YAML
    const yamlMeta: Record<string, any> = {
      trigger: meta.trigger,
      contentType: meta.contentType,
    };

    // Add optional fields if they exist
    if (meta.description) yamlMeta.description = meta.description;
    if (meta.tags && meta.tags.length > 0) yamlMeta.tags = meta.tags;
    if (meta.variables && meta.variables.length > 0) yamlMeta.variables = meta.variables;
    if (meta.images && meta.images.length > 0) yamlMeta.images = meta.images;
    if (meta.snipDependencies && meta.snipDependencies.length > 0) yamlMeta.snipDependencies = meta.snipDependencies;
    if (meta.scope && meta.scope !== 'personal') yamlMeta.scope = meta.scope;

    // Include timestamps if requested
    if (options.includeTimestamps) {
      yamlMeta.createdAt = meta.createdAt;
      yamlMeta.updatedAt = meta.updatedAt;
      yamlMeta.createdBy = meta.createdBy;
      yamlMeta.updatedBy = meta.updatedBy;
    }

    // Serialize YAML frontmatter in HTML comment
    const yamlString = yaml.dump(yamlMeta, {
      indent: 2,
      lineWidth: 80,
      noRefs: true,
      sortKeys: true
    }).trim();

    // Combine frontmatter and body
    return `<!-- YAML\n${yamlString}\n-->\n${body}`;
  }

  validate(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const trimmed = content.trim();

    if (!trimmed) {
      errors.push('Content cannot be empty');
      return { valid: false, errors };
    }

    const frontmatterMatch = this.extractHTMLFrontmatter(trimmed);
    if (frontmatterMatch) {
      try {
        const meta = yaml.load(frontmatterMatch.frontmatter);
        if (!meta || typeof meta !== 'object') {
          errors.push('YAML frontmatter must be an object');
        } else {
          const metaObj = meta as Record<string, any>;
          
          if (!metaObj.trigger) {
            errors.push('Missing required field: trigger');
          } else if (typeof metaObj.trigger !== 'string') {
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
        errors.push(`Invalid YAML syntax: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      if (!frontmatterMatch.body.trim()) {
        errors.push('HTML body content cannot be empty');
      }

      // Basic HTML validation
      this.validateHTMLSyntax(frontmatterMatch.body, errors);
    } else {
      // Validate standalone HTML
      this.validateHTMLSyntax(trimmed, errors);
    }

    return { valid: errors.length === 0, errors };
  }

  private validateHTMLSyntax(html: string, errors: string[]): void {
    // Check for unmatched angle brackets
    const openBrackets = (html.match(/</g) || []).length;
    const closeBrackets = (html.match(/>/g) || []).length;
    if (openBrackets !== closeBrackets) {
      errors.push('Unmatched angle brackets in HTML');
    }

    // Check for unclosed tags (basic check)
    const selfClosingTags = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
    const tagStack: string[] = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    let match;
    
    while ((match = tagRegex.exec(html)) !== null) {
      const tagName = match[1].toLowerCase();
      const isClosing = match[0].startsWith('</');
      const isSelfClosing = match[0].endsWith('/>') || selfClosingTags.test(tagName);
      
      if (isClosing) {
        if (tagStack.length === 0 || tagStack.pop() !== tagName) {
          errors.push(`Unmatched closing tag: ${tagName}`);
        }
      } else if (!isSelfClosing) {
        tagStack.push(tagName);
      }
    }
    
    if (tagStack.length > 0) {
      errors.push(`Unclosed tags: ${tagStack.join(', ')}`);
    }
  }

  /**
   * Create a new HTML snippet with YAML frontmatter
   */
  createNew(trigger: string, content: string, options: Partial<SnippetMeta> = {}): SnippetDoc {
    const now = new Date().toISOString();
    const id = options.id || `html-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const meta: SnippetMeta = {
      id,
      trigger,
      snipDependencies: [],
      contentType: 'html',
      description: options.description || `HTML snippet: ${trigger}`,
      scope: 'personal',
      variables: this.extractVariables(content),
      images: this.extractImages(content),
      tags: [],
      createdAt: now,
      createdBy: 'user',
      updatedAt: now,
      updatedBy: 'user',
      ...options
    };

    return {
      meta,
      body: content,
      format: 'html'
    };
  }
}