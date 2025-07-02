/**
 * Unit tests for snippet schema and validation
 * Following TDD approach - tests written first to define expected behavior
 */

import {
  createSnippet,
  generateSnippetId,
  validateSnippet,
  validateSnippetLibrary,
  createVariable,
  processSnippetContent,
  extractVariablesFromContent,
  createSnippetLibrary
} from '../../src/shared/snippet-schema';
import { TextSnippet } from '../../src/shared/types';

describe('Snippet Schema and Validation', () => {
  describe('createSnippet', () => {
    test('should create valid snippet with required fields', () => {
      const snippet = createSnippet('test', 'Hello World');
      
      expect(snippet.trigger).toBe(';test');
      expect(snippet.content).toBe('Hello World');
      expect(snippet.id).toBeDefined();
      expect(snippet.createdAt).toBeInstanceOf(Date);
      expect(snippet.updatedAt).toBeInstanceOf(Date);
      expect(snippet.variables).toEqual([]);
      expect(snippet.tags).toEqual([]);
      expect(snippet.isShared).toBe(false);
    });

    test('should handle trigger with semicolon prefix', () => {
      const snippet = createSnippet(';test', 'Hello World');
      expect(snippet.trigger).toBe(';test');
    });

    test('should merge options correctly', () => {
      const snippet = createSnippet('test', 'Hello', {
        description: 'Test snippet',
        tags: ['greeting'],
        isShared: true
      });
      
      expect(snippet.description).toBe('Test snippet');
      expect(snippet.tags).toEqual(['greeting']);
      expect(snippet.isShared).toBe(true);
    });
  });

  describe('generateSnippetId', () => {
    test('should generate unique IDs', () => {
      const id1 = generateSnippetId(';test');
      const id2 = generateSnippetId(';test');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test_[a-z0-9]+_[a-z0-9]+$/);
    });

    test('should sanitize trigger for ID', () => {
      const id = generateSnippetId(';test-snippet!@#');
      expect(id).toMatch(/^test-snippet_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('validateSnippet', () => {
    const validSnippet: TextSnippet = {
      id: 'test_123_abc',
      trigger: ';test',
      content: 'Hello World',
      createdAt: new Date(),
      updatedAt: new Date(),
      variables: [],
      tags: []
    };

    test('should validate correct snippet', () => {
      expect(validateSnippet(validSnippet)).toBe(true);
    });

    test('should reject snippet without required fields', () => {
      expect(validateSnippet({})).toBe(false);
      expect(validateSnippet({ id: 'test' })).toBe(false);
      expect(validateSnippet({ id: 'test', trigger: ';test' })).toBe(false);
    });

    test('should reject invalid trigger format', () => {
      const invalid = { ...validSnippet, trigger: 'test' };
      expect(validateSnippet(invalid)).toBe(false);
      
      const invalid2 = { ...validSnippet, trigger: ';test with spaces' };
      expect(validateSnippet(invalid2)).toBe(false);
    });

    test('should reject empty content', () => {
      const invalid = { ...validSnippet, content: '' };
      expect(validateSnippet(invalid)).toBe(false);
    });

    test('should reject content too long', () => {
      const invalid = { ...validSnippet, content: 'x'.repeat(10001) };
      expect(validateSnippet(invalid)).toBe(false);
    });

    test('should validate snippet with variables', () => {
      const withVars = {
        ...validSnippet,
        variables: [
          { name: 'name', placeholder: 'Enter name', required: true, type: 'text' as const }
        ]
      };
      expect(validateSnippet(withVars)).toBe(true);
    });

    test('should reject invalid variable names', () => {
      const invalid = {
        ...validSnippet,
        variables: [
          { name: '123invalid', placeholder: 'test', required: false, type: 'text' as const }
        ]
      };
      expect(validateSnippet(invalid)).toBe(false);
    });
  });

  describe('validateSnippetLibrary', () => {
    const validLibrary = {
      version: '1.0.0',
      metadata: {
        name: 'Test Library',
        scope: 'personal' as const,
        provider: 'local' as const
      },
      snippets: [
        createSnippet('test', 'Hello World')
      ]
    };

    test('should validate correct library', () => {
      expect(validateSnippetLibrary(validLibrary)).toBe(true);
    });

    test('should reject library without required fields', () => {
      expect(validateSnippetLibrary({})).toBe(false);
      expect(validateSnippetLibrary({ version: '1.0.0' })).toBe(false);
    });

    test('should reject invalid version format', () => {
      const invalid = { ...validLibrary, version: '1.0' };
      expect(validateSnippetLibrary(invalid)).toBe(false);
    });

    test('should reject library with invalid snippets', () => {
      const invalid = {
        ...validLibrary,
        snippets: [{ id: 'invalid', trigger: 'bad' }]
      };
      expect(validateSnippetLibrary(invalid)).toBe(false);
    });
  });

  describe('createVariable', () => {
    test('should create basic variable', () => {
      const variable = createVariable('name', 'Enter your name');
      
      expect(variable.name).toBe('name');
      expect(variable.placeholder).toBe('Enter your name');
      expect(variable.required).toBe(false);
      expect(variable.type).toBe('text');
    });

    test('should merge options', () => {
      const variable = createVariable('count', 'Enter count', {
        required: true,
        type: 'number',
        defaultValue: '1'
      });
      
      expect(variable.required).toBe(true);
      expect(variable.type).toBe('number');
      expect(variable.defaultValue).toBe('1');
    });
  });

  describe('processSnippetContent', () => {
    test('should replace variables with values', () => {
      const content = 'Hello {name}, welcome to {event}!';
      const variables = { name: 'John', event: 'Conference' };
      
      const result = processSnippetContent(content, variables);
      expect(result).toBe('Hello John, welcome to Conference!');
    });

    test('should handle special placeholders', () => {
      const content = 'Today is {date} at {time}';
      const result = processSnippetContent(content, {});
      
      expect(result).toContain('Today is');
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Date format
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Time format
    });

    test('should handle missing variables gracefully', () => {
      const content = 'Hello {name}, {missing} variable';
      const variables = { name: 'John' };
      
      const result = processSnippetContent(content, variables);
      expect(result).toBe('Hello John, {missing} variable');
    });
  });

  describe('extractVariablesFromContent', () => {
    test('should extract custom variables', () => {
      const content = 'Hello {name}, see you at {event} on {date}';
      const variables = extractVariablesFromContent(content);
      
      expect(variables).toEqual(['name', 'event']);
      expect(variables).not.toContain('date'); // Special placeholder
    });

    test('should handle duplicate variables', () => {
      const content = 'Hi {name}, {name} is a great name!';
      const variables = extractVariablesFromContent(content);
      
      expect(variables).toEqual(['name']);
    });

    test('should ignore special placeholders', () => {
      const content = 'Today {date} at {time} - {datetime} - {url}';
      const variables = extractVariablesFromContent(content);
      
      expect(variables).toEqual([]);
    });

    test('should handle invalid variable names', () => {
      const content = 'Invalid {123} and {name} and {_underscore}';
      const variables = extractVariablesFromContent(content);
      
      expect(variables).toEqual(['name']);
    });
  });

  describe('createSnippetLibrary', () => {
    test('should create library with metadata', () => {
      const library = createSnippetLibrary('personal', 'google-drive', {
        name: 'My Snippets',
        owner: 'user@example.com'
      });
      
      expect(library.version).toBe('1.0.0');
      expect(library.metadata.scope).toBe('personal');
      expect(library.metadata.provider).toBe('google-drive');
      expect(library.metadata.name).toBe('My Snippets');
      expect(library.metadata.owner).toBe('user@example.com');
      expect(library.snippets).toEqual([]);
    });

    test('should use default values', () => {
      const library = createSnippetLibrary('department', 'dropbox');
      
      expect(library.metadata.name).toBe('department snippets');
      expect(library.metadata.description).toBe('department text expansion snippets');
    });
  });

  describe('Integration Tests', () => {
    test('should create, validate, and process complete snippet workflow', () => {
      // Create snippet with variables
      const snippet = createSnippet('greeting', 'Hello {name}, welcome to {company}!', {
        description: 'Greeting with personalization',
        variables: [
          createVariable('name', 'Person\'s name', { required: true }),
          createVariable('company', 'Company name', { defaultValue: 'our company' })
        ]
      });
      
      // Validate snippet
      expect(validateSnippet(snippet)).toBe(true);
      
      // Process content with variables
      const processed = processSnippetContent(snippet.content, {
        name: 'Alice',
        company: 'TechCorp'
      });
      
      expect(processed).toBe('Hello Alice, welcome to TechCorp!');
      
      // Create library and validate
      const library = createSnippetLibrary('personal', 'google-drive');
      library.snippets.push(snippet);
      
      expect(validateSnippetLibrary(library)).toBe(true);
    });
  });
});