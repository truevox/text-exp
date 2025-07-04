import { PlaceholderHandler } from '../../src/content/placeholder-handler';
import { TextSnippet, SnippetVariable } from '../../src/shared/types';

describe('PlaceholderHandler', () => {
  let handler: PlaceholderHandler;

  beforeEach(() => {
    handler = new PlaceholderHandler();
    // Mock window.getSelection and document.createRange for contenteditable tests if needed
    // For promptForVariables, we'll need to mock DOM manipulation
  });

  describe('replaceVariables', () => {
    test('should replace custom variables', () => {
      const content = 'Hello, {{name}}! Today is {{date}}.';
      const variables = { name: 'John', date: '2025-07-02' };
      const result = handler.replaceVariables(content, variables);
      expect(result).toBe('Hello, John! Today is 2025-07-02.');
    });

    test('should handle missing custom variables', () => {
      const content = 'Hello, {{name}}! Today is {{date}}.';
      const variables = { name: 'John' };
      const result = handler.replaceVariables(content, variables);
      expect(result).toBe('Hello, John! Today is {{date}}.');
    });

    test('should replace built-in date placeholders', () => {
      const now = new Date();
      const expectedDate = now.toLocaleDateString();
      const expectedTime = now.toLocaleTimeString();
      const expectedDateTime = now.toLocaleString();
      const expectedYear = now.getFullYear().toString();
      const expectedMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      const expectedDay = now.getDate().toString().padStart(2, '0');
      const expectedWeekday = now.toLocaleDateString('en-US', { weekday: 'long' });

      const content = 'Date: [[date]], Time: [[time]], DateTime: [[datetime]], Year: [[year]], Month: [[month]], Day: [[day]], Weekday: [[weekday]]';
      const result = handler.replaceVariables(content, {});

      expect(result).toContain(`Date: ${expectedDate}`);
      expect(result).toContain(`Time: ${expectedTime}`);
      expect(result).toContain(`DateTime: ${expectedDateTime}`);
      expect(result).toContain(`Year: ${expectedYear}`);
      expect(result).toContain(`Month: ${expectedMonth}`);
      expect(result).toContain(`Day: ${expectedDay}`);
      expect(result).toContain(`Weekday: ${expectedWeekday}`);
    });

    test('should replace built-in URL/title placeholders', () => {
      // Mock document.title
      const originalTitle = document.title;
      Object.defineProperty(document, 'title', {
        value: 'Test Page Title',
        writable: true,
        configurable: true
      });

      const content = 'URL: [[url]], Domain: [[domain]], Title: [[title]]';
      const result = handler.replaceVariables(content, {});

      // JSDOM provides default values for location
      expect(result).toContain('URL: http://localhost/'); // JSDOM default
      expect(result).toContain('Domain: localhost'); // JSDOM default  
      expect(result).toContain('Title: Test Page Title');
      
      // Cleanup
      Object.defineProperty(document, 'title', {
        value: originalTitle,
        writable: true,
        configurable: true
      });
    });

    test('should handle mixed custom and built-in variables', () => {
      const content = 'Hello {{user}}! Today is [[date]] on [[domain]].';
      const variables = { user: 'Alice' };
      
      const result = handler.replaceVariables(content, variables);
      expect(result).toContain('Hello Alice!');
      expect(result).toContain(new Date().toLocaleDateString());
      // JSDOM uses localhost by default, so we test for that
      expect(result).toContain('on localhost.');
    });
  });

  describe('promptForVariables', () => {
    // Mock DOM elements and user interaction for modal
    let appendChildSpy: jest.SpyInstance;
    let removeChildSpy: jest.SpyInstance;
    let querySelectorSpy: jest.SpyInstance;

    beforeEach(() => {
      appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => null);
      removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => null);
      querySelectorSpy = jest.spyOn(document, 'querySelector');
    });

    afterEach(() => {
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      querySelectorSpy.mockRestore();
    });

    test('should resolve with empty object if no variables', async () => {
      const snippet: TextSnippet = { id: '1', trigger: ';test', content: 'test', createdAt: new Date(), updatedAt: new Date() };
      const result = await handler.promptForVariables(snippet);
      expect(result).toEqual({});
      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    test('should show modal and resolve with collected values on submit', (done) => {
      const variables: SnippetVariable[] = [
        { name: 'name', placeholder: 'Your Name' },
        { name: 'age', type: 'number' },
      ];
      const snippet: TextSnippet = { id: '1', trigger: ';test', content: 'test', variables, createdAt: new Date(), updatedAt: new Date() };

      // Mock showVariableModal to test the callback mechanism
      const originalShowModal = handler['showVariableModal'];
      handler['showVariableModal'] = jest.fn((vars, onSubmit, onCancel) => {
        expect(vars).toEqual(variables);
        // Simulate user submitting form with values
        setTimeout(() => {
          onSubmit({ name: 'Jane', age: '30' });
        }, 10);
      });

      handler.promptForVariables(snippet).then((result) => {
        expect(result).toEqual({ name: 'Jane', age: '30' });
        // Restore original method
        handler['showVariableModal'] = originalShowModal;
        done();
      }).catch(done);
    });

    test('should reject on cancel', (done) => {
      const variables: SnippetVariable[] = [{ name: 'name', placeholder: 'Your Name' }];
      const snippet: TextSnippet = { id: '1', trigger: ';test', content: 'test', variables, createdAt: new Date(), updatedAt: new Date() };

      // Mock showVariableModal to test the callback mechanism
      const originalShowModal = handler['showVariableModal'];
      handler['showVariableModal'] = jest.fn((vars, onSubmit, onCancel) => {
        expect(vars).toEqual(variables);
        // Simulate user cancelling
        setTimeout(() => {
          onCancel();
        }, 10);
      });

      handler.promptForVariables(snippet).catch((error) => {
        expect(error.message).toBe('Variable prompt cancelled');
        // Restore original method
        handler['showVariableModal'] = originalShowModal;
        done();
      });
    });

    test('should handle choice variables', (done) => {
      const variables: SnippetVariable[] = [
        { name: 'color', type: 'choice', choices: ['red', 'blue'] },
      ];
      const snippet: TextSnippet = { id: '1', trigger: ';test', content: 'test', variables, createdAt: new Date(), updatedAt: new Date() };

      // Mock showVariableModal to test the callback mechanism
      const originalShowModal = handler['showVariableModal'];
      handler['showVariableModal'] = jest.fn((vars, onSubmit, onCancel) => {
        expect(vars).toEqual(variables);
        // Simulate user selecting choice
        setTimeout(() => {
          onSubmit({ color: 'blue' });
        }, 10);
      });

      handler.promptForVariables(snippet).then((result) => {
        expect(result).toEqual({ color: 'blue' });
        // Restore original method
        handler['showVariableModal'] = originalShowModal;
        done();
      }).catch(done);
    });
  });
});
