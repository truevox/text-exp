/**
 * JSON Schema and validation for snippet data model
 * Supports CloudAdapter architecture with multi-scope sync
 */

import { TextSnippet, SnippetVariable, CloudProvider } from './types';

/**
 * Snippet validation schema
 */
export const SNIPPET_SCHEMA = {
  type: 'object',
  required: ['id', 'trigger', 'content', 'createdAt', 'updatedAt'],
  properties: {
    id: {
      type: 'string',
      pattern: '^[a-zA-Z0-9_-]+$',
      minLength: 1,
      maxLength: 64
    },
    trigger: {
      type: 'string',
      pattern: '^;[a-zA-Z0-9_-]+$',
      minLength: 2,
      maxLength: 32
    },
    content: {
      type: 'string',
      minLength: 1,
      maxLength: 10000
    },
    description: {
      type: 'string',
      maxLength: 500
    },
    variables: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'placeholder'],
        properties: {
          name: {
            type: 'string',
            pattern: '^[a-zA-Z][a-zA-Z0-9_]*$',
            minLength: 1,
            maxLength: 32
          },
          placeholder: {
            type: 'string',
            minLength: 1,
            maxLength: 100
          },
          defaultValue: {
            type: 'string',
            maxLength: 200
          },
          required: {
            type: 'boolean'
          },
          type: {
            type: 'string',
            enum: ['text', 'number', 'date', 'choice']
          },
          choices: {
            type: 'array',
            items: {
              type: 'string',
              maxLength: 100
            },
            maxItems: 20
          }
        }
      },
      maxItems: 10
    },
    tags: {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 32
      },
      maxItems: 10
    },
    scope: {
      type: 'string',
      enum: ['personal', 'department', 'org']
    },
    provider: {
      type: 'string',
      enum: ['google-drive', 'dropbox', 'onedrive', 'local']
    },
    createdAt: {
      type: 'string',
      format: 'date-time'
    },
    updatedAt: {
      type: 'string',
      format: 'date-time'
    },
    isShared: {
      type: 'boolean'
    },
    sharedBy: {
      type: 'string',
      maxLength: 100
    }
  }
} as const;

/**
 * Snippet library schema for JSON files
 */
export const SNIPPET_LIBRARY_SCHEMA = {
  type: 'object',
  required: ['version', 'snippets'],
  properties: {
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$'
    },
    metadata: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 100 },
        description: { type: 'string', maxLength: 500 },
        owner: { type: 'string', maxLength: 100 },
        scope: { type: 'string', enum: ['personal', 'department', 'org'] },
        provider: { type: 'string', enum: ['google-drive', 'dropbox', 'onedrive', 'local'] },
        lastSync: { type: 'string', format: 'date-time' },
        syncCursor: { type: 'string' }
      }
    },
    snippets: {
      type: 'array',
      items: SNIPPET_SCHEMA,
      maxItems: 1000
    }
  }
} as const;

/**
 * Create a new snippet with default values
 */
export function createSnippet(
  trigger: string,
  content: string,
  options: Partial<TextSnippet> = {}
): TextSnippet {
  const now = new Date();
  const id = options.id || generateSnippetId(trigger);
  
  return {
    id,
    trigger: trigger.startsWith(';') ? trigger : `;${trigger}`,
    content,
    description: options.description,
    variables: options.variables || [],
    tags: options.tags || [],
    createdAt: now,
    updatedAt: now,
    isShared: options.isShared || false,
    sharedBy: options.sharedBy,
    ...options
  };
}

/**
 * Generate a unique snippet ID from trigger
 */
export function generateSnippetId(trigger: string): string {
  const base = trigger.replace(/^;/, '').replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 4);
  return `${base}_${timestamp}_${random}`;
}

/**
 * Validate snippet against schema
 */
export function validateSnippet(snippet: unknown): snippet is TextSnippet {
  if (!snippet || typeof snippet !== 'object') {
    return false;
  }
  
  const s = snippet as Partial<TextSnippet>;
  
  // Required fields
  if (!s.id || !s.trigger || !s.content || !s.createdAt || !s.updatedAt) {
    return false;
  }
  
  // Trigger format
  if (!s.trigger.match(/^;[a-zA-Z0-9_-]+$/)) {
    return false;
  }
  
  // Content length
  if (s.content.length === 0 || s.content.length > 10000) {
    return false;
  }
  
  // Variables validation
  if (s.variables && s.variables.length > 0) {
    for (const variable of s.variables) {
      if (!variable.name || !variable.placeholder) {
        return false;
      }
      if (!variable.name.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Validate snippet library against schema
 */
export function validateSnippetLibrary(library: unknown): boolean {
  if (!library || typeof library !== 'object') {
    return false;
  }
  
  const lib = library as any;
  
  // Required fields
  if (!lib.version || !lib.snippets || !Array.isArray(lib.snippets)) {
    return false;
  }
  
  // Version format
  if (!lib.version.match(/^\d+\.\d+\.\d+$/)) {
    return false;
  }
  
  // Validate all snippets
  for (const snippet of lib.snippets) {
    if (!validateSnippet(snippet)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Create snippet variable
 */
export function createVariable(
  name: string,
  placeholder: string,
  options: Partial<SnippetVariable> = {}
): SnippetVariable {
  return {
    name,
    placeholder,
    defaultValue: options.defaultValue,
    required: options.required ?? false,
    type: options.type || 'text',
    choices: options.choices
  };
}

/**
 * Process snippet content with variables
 */
export function processSnippetContent(
  content: string,
  variables: Record<string, string>
): string {
  let processed = content;
  
  // Replace variables in {name} format
  for (const [name, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${name}\\}`, 'g');
    processed = processed.replace(regex, value);
  }
  
  // Handle special placeholders
  processed = processed.replace(/\{date\}/g, new Date().toLocaleDateString());
  processed = processed.replace(/\{time\}/g, new Date().toLocaleTimeString());
  processed = processed.replace(/\{datetime\}/g, new Date().toLocaleString());
  processed = processed.replace(/\{url\}/g, window.location?.href || '');
  
  return processed;
}

/**
 * Extract variables from snippet content
 */
export function extractVariablesFromContent(content: string): string[] {
  const regex = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1];
    if (!['date', 'time', 'datetime', 'url', 'cursor'].includes(varName)) {
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }
  }
  
  return variables;
}

/**
 * Default snippet library structure
 */
export function createSnippetLibrary(
  scope: 'personal' | 'department' | 'org',
  provider: CloudProvider,
  metadata: { name?: string; description?: string; owner?: string } = {}
) {
  return {
    version: '1.0.0',
    metadata: {
      name: metadata.name || `${scope} snippets`,
      description: metadata.description || `${scope} text expansion snippets`,
      owner: metadata.owner,
      scope,
      provider,
      lastSync: new Date().toISOString(),
      syncCursor: null
    },
    snippets: []
  };
}