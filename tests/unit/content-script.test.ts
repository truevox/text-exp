/**
 * Unit tests for content script
 * Following TDD approach - tests written first to define expected behavior
 */

import { TriggerDetector, TriggerState } from '../../src/content/trigger-detector';
import { TextReplacer } from '../../src/content/text-replacer';
import { PlaceholderHandler } from '../../src/content/placeholder-handler';
import { ExtensionStorage } from '../../src/shared/storage';
import { TextSnippet } from '../../src/shared/types';

// Mock dependencies
jest.mock('../../src/content/trigger-detector');
jest.mock('../../src/content/text-replacer');
jest.mock('../../src/content/placeholder-handler');
jest.mock('../../src/shared/storage');
jest.mock('../../src/shared/messaging');

// We'll need to dynamically import the content script module for testing
// since it has initialization side effects

describe('ContentScript', () => {
  let mockTriggerDetector: jest.Mocked<TriggerDetector>;
  let mockTextReplacer: jest.Mocked<TextReplacer>;
  let mockPlaceholderHandler: jest.Mocked<PlaceholderHandler>;
  let mockExtensionStorage: jest.Mocked<typeof ExtensionStorage>;

  // Mock DOM elements
  let mockInput: HTMLInputElement;
  let mockTextarea: HTMLTextAreaElement;
  let mockContentEditable: HTMLDivElement;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.resetModules();

    // Mock dependencies
    mockTriggerDetector = {
      processInput: jest.fn(),
      processInputWithContext: jest.fn(),
      getPrefix: jest.fn(() => ';'),
      getLoadedSnippetsCount: jest.fn(() => 5),
      updateSnippets: jest.fn(),
      reset: jest.fn(),
      getCurrentState: jest.fn(() => ({ state: TriggerState.IDLE }))
    } as any;

    mockTextReplacer = {
      replaceText: jest.fn(),
      insertTextAtCursor: jest.fn(),
      replaceSelectedText: jest.fn(),
      getSelectedText: jest.fn(),
      getCursorPosition: jest.fn(),
      setCursorPosition: jest.fn(),
      clearText: jest.fn(),
      undoLastReplacement: jest.fn()
    } as any;

    mockPlaceholderHandler = {
      promptForVariables: jest.fn(),
      replaceVariables: jest.fn(),
      hasVariables: jest.fn()
    } as any;

    mockExtensionStorage = {
      getSettings: jest.fn(),
      setSettings: jest.fn(),
      getSnippets: jest.fn(),
      setSnippets: jest.fn(),
      findSnippetByTrigger: jest.fn(),
      addSnippet: jest.fn(),
      updateSnippet: jest.fn(),
      deleteSnippet: jest.fn()
    } as any;

    // Mock constructors
    (TriggerDetector as jest.MockedClass<typeof TriggerDetector>).mockImplementation(() => mockTriggerDetector);
    (TextReplacer as jest.MockedClass<typeof TextReplacer>).mockImplementation(() => mockTextReplacer);
    (PlaceholderHandler as jest.MockedClass<typeof PlaceholderHandler>).mockImplementation(() => mockPlaceholderHandler);

    // Mock ExtensionStorage static methods
    Object.assign(ExtensionStorage, mockExtensionStorage);

    // Set up default mock returns
    mockExtensionStorage.getSettings.mockResolvedValue({
      enabled: true,
      autoSync: true,
      syncInterval: 300000,
      cloudProvider: 'google-drive',
      triggerPrefix: ';',
      excludePasswords: true,
      showNotifications: true
    });

    // Mock DOM elements
    mockInput = {
      tagName: 'INPUT',
      type: 'text',
      value: '',
      selectionStart: 0,
      selectionEnd: 0,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    } as unknown as HTMLInputElement;

    mockTextarea = {
      tagName: 'TEXTAREA',
      value: '',
      selectionStart: 0,
      selectionEnd: 0,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    } as unknown as HTMLTextAreaElement;

    mockContentEditable = {
      tagName: 'DIV',
      contentEditable: 'true',
      textContent: '',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    } as unknown as HTMLDivElement;

    // Mock document and DOM APIs
    global.document = {
      readyState: 'complete',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      activeElement: null,
      body: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      },
      querySelectorAll: jest.fn(() => [])
    } as any;

    global.MutationObserver = jest.fn(() => ({
      observe: jest.fn(),
      disconnect: jest.fn()
    })) as any;

    // Mock console methods
    global.console = {
      ...console,
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
  });

  describe('Initialization', () => {
    test('should initialize content script when enabled', async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      
      expect(TriggerDetector).toHaveBeenCalledWith([], ';');
      expect(TextReplacer).toHaveBeenCalled();
      expect(PlaceholderHandler).toHaveBeenCalled();
      expect(mockExtensionStorage.getSettings).toHaveBeenCalled();
    });

    test('should not initialize when disabled', async () => {
      mockExtensionStorage.getSettings.mockResolvedValue({
        enabled: false,
        autoSync: true,
        syncInterval: 300000,
        cloudProvider: 'google-drive',
        triggerPrefix: ';',
        excludePasswords: true,
        showNotifications: true
      });

      const { ContentScript } = await import('../../src/content/content-script');
      
      // Should still create instances but not set up listeners
      expect(console.log).toHaveBeenCalledWith('Text Expander is disabled');
    });

    test('should handle initialization errors gracefully', async () => {
      mockExtensionStorage.getSettings.mockRejectedValue(new Error('Storage error'));

      const { ContentScript } = await import('../../src/content/content-script');
      
      expect(console.error).toHaveBeenCalledWith('Failed to initialize content script:', expect.any(Error));
    });

    test('should set up event listeners when enabled', async () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      
      const { ContentScript } = await import('../../src/content/content-script');
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function), true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('focusin', expect.any(Function), true);
      expect(addEventListenerSpy).toHaveBeenCalledWith('focusout', expect.any(Function), true);
    });
  });

  describe('Text Input Detection', () => {
    test('should detect text input elements', async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      const contentScript = new (ContentScript as any)();

      expect(contentScript.isTextInput(mockInput)).toBe(true);
      expect(contentScript.isTextInput(mockTextarea)).toBe(true);
      expect(contentScript.isTextInput(mockContentEditable)).toBe(true);
    });

    test('should reject non-text input elements', async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      const contentScript = new (ContentScript as any)();

      const mockButton = { tagName: 'BUTTON', type: 'button' } as HTMLElement;
      const mockDiv = { tagName: 'DIV', contentEditable: 'false' } as HTMLElement;
      const mockPasswordInput = { tagName: 'INPUT', type: 'password' } as HTMLElement;

      expect(contentScript.isTextInput(mockButton)).toBe(false);
      expect(contentScript.isTextInput(mockDiv)).toBe(false);
    });

    test('should handle different input types correctly', async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      const contentScript = new (ContentScript as any)();

      const emailInput = { tagName: 'INPUT', type: 'email' } as HTMLElement;
      const searchInput = { tagName: 'INPUT', type: 'search' } as HTMLElement;
      const urlInput = { tagName: 'INPUT', type: 'url' } as HTMLElement;
      const passwordInput = { tagName: 'INPUT', type: 'password' } as HTMLElement;

      expect(contentScript.isTextInput(emailInput)).toBe(true);
      expect(contentScript.isTextInput(searchInput)).toBe(true);
      expect(contentScript.isTextInput(urlInput)).toBe(true);
      expect(contentScript.isTextInput(passwordInput)).toBe(true); // Should be filtered out by settings later
    });
  });

  describe('Trigger Detection and Processing', () => {
    let contentScript: any;
    let mockSnippet: TextSnippet;

    beforeEach(async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      contentScript = new (ContentScript as any)();

      mockSnippet = {
        id: 'test-snippet',
        trigger: ';gb',
        content: 'Goodbye!',
        createdAt: new Date(),
        updatedAt: new Date(),
        variables: [],
        tags: []
      };
    });

    test('should process simple trigger on input', async () => {
      mockInput.value = ';gb ';
      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: true,
        trigger: ';gb',
        content: 'Goodbye!',
        matchEnd: 3,
        state: TriggerState.COMPLETE
      });
      mockExtensionStorage.findSnippetByTrigger.mockResolvedValue(mockSnippet);

      const inputEvent = new Event('input', { bubbles: true });
      Object.defineProperty(inputEvent, 'target', { value: mockInput });

      await contentScript.handleInput(inputEvent);

      expect(mockTriggerDetector.processInput).toHaveBeenCalled();
      expect(mockExtensionStorage.findSnippetByTrigger).toHaveBeenCalledWith(';gb');
      expect(mockTextReplacer.replaceText).toHaveBeenCalled();
    });

    test('should handle trigger with variables', async () => {
      const snippetWithVariables = {
        ...mockSnippet,
        content: 'Hello {name}!',
        variables: [{ name: 'name', placeholder: 'Enter name', required: true, type: 'text' as const }]
      };

      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: true,
        trigger: ';hello',
        content: 'Hello {name}!',
        matchEnd: 6,
        state: TriggerState.COMPLETE
      });
      mockExtensionStorage.findSnippetByTrigger.mockResolvedValue(snippetWithVariables);
      mockPlaceholderHandler.promptForVariables.mockResolvedValue({ name: 'World' });
      mockPlaceholderHandler.replaceVariables.mockReturnValue('Hello World!');

      const inputEvent = new Event('input', { bubbles: true });
      Object.defineProperty(inputEvent, 'target', { value: mockInput });

      await contentScript.handleInput(inputEvent);

      expect(mockPlaceholderHandler.promptForVariables).toHaveBeenCalledWith(snippetWithVariables);
      expect(mockPlaceholderHandler.replaceVariables).toHaveBeenCalledWith('Hello {name}!', { name: 'World' });
    });

    test('should handle non-matching triggers gracefully', async () => {
      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: false,
        state: TriggerState.TYPING
      });

      const inputEvent = new Event('input', { bubbles: true });
      Object.defineProperty(inputEvent, 'target', { value: mockInput });

      await contentScript.handleInput(inputEvent);

      expect(mockExtensionStorage.findSnippetByTrigger).not.toHaveBeenCalled();
      expect(mockTextReplacer.replaceText).not.toHaveBeenCalled();
    });

    test('should handle missing snippets gracefully', async () => {
      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: true,
        trigger: ';unknown',
        state: TriggerState.COMPLETE
      });
      mockExtensionStorage.findSnippetByTrigger.mockResolvedValue(null);

      const inputEvent = new Event('input', { bubbles: true });
      Object.defineProperty(inputEvent, 'target', { value: mockInput });

      await contentScript.handleInput(inputEvent);

      expect(mockExtensionStorage.findSnippetByTrigger).toHaveBeenCalledWith(';unknown');
      expect(mockTextReplacer.replaceText).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Event Handling', () => {
    let contentScript: any;

    beforeEach(async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      contentScript = new (ContentScript as any)();
    });

    test('should process trigger on Tab key', async () => {
      mockInput.value = ';gb';
      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: false,
        trigger: ';gb',
        state: TriggerState.COMPLETE,
        potentialTrigger: ';gb'
      });

      const keyEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      Object.defineProperty(keyEvent, 'target', { value: mockInput });
      keyEvent.preventDefault = jest.fn();

      await contentScript.handleKeyDown(keyEvent);

      expect(mockTriggerDetector.processInput).toHaveBeenCalled();
      expect(keyEvent.preventDefault).toHaveBeenCalled();
    });

    test('should process trigger on Space key', async () => {
      mockInput.value = ';gb';
      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: false,
        trigger: ';gb',
        state: TriggerState.COMPLETE,
        potentialTrigger: ';gb'
      });

      const keyEvent = new KeyboardEvent('keydown', { key: ' ' });
      Object.defineProperty(keyEvent, 'target', { value: mockInput });
      keyEvent.preventDefault = jest.fn();

      await contentScript.handleKeyDown(keyEvent);

      expect(mockTriggerDetector.processInput).toHaveBeenCalled();
      expect(keyEvent.preventDefault).toHaveBeenCalled();
    });

    test('should not process on other keys', async () => {
      const keyEvent = new KeyboardEvent('keydown', { key: 'a' });
      Object.defineProperty(keyEvent, 'target', { value: mockInput });
      keyEvent.preventDefault = jest.fn();

      await contentScript.handleKeyDown(keyEvent);

      expect(mockTriggerDetector.processInput).not.toHaveBeenCalled();
      expect(keyEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    let contentScript: any;

    beforeEach(async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      contentScript = new (ContentScript as any)();
    });

    test('should track focus on text inputs', () => {
      const focusEvent = new Event('focusin');
      Object.defineProperty(focusEvent, 'target', { value: mockInput });

      contentScript.handleFocusIn(focusEvent);

      expect(mockTriggerDetector.updateSnippets).toHaveBeenCalled(); // Should load snippets for new context
    });

    test('should clear focus on focus out', () => {
      const focusEvent = new Event('focusout');

      contentScript.handleFocusOut(focusEvent);

      // Should clear any temporary state
      expect(mockTriggerDetector.reset).toHaveBeenCalled();
    });

    test('should ignore focus on non-text elements', () => {
      const mockButton = { tagName: 'BUTTON' } as HTMLElement;
      const focusEvent = new Event('focusin');
      Object.defineProperty(focusEvent, 'target', { value: mockButton });

      contentScript.handleFocusIn(focusEvent);

      // Should not call any trigger detector methods
      expect(mockTriggerDetector.updateSnippets).not.toHaveBeenCalled();
    });
  });

  describe('Dynamic Content Handling', () => {
    let contentScript: any;

    beforeEach(async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      contentScript = new (ContentScript as any)();
    });

    test('should handle dynamically added text inputs', () => {
      const mockNode = {
        nodeType: Node.ELEMENT_NODE,
        querySelectorAll: jest.fn(() => [mockInput, mockTextarea])
      } as unknown as HTMLElement;

      const mutations = [{
        addedNodes: [mockNode]
      }] as MutationRecord[];

      contentScript.handleDOMChanges(mutations);

      // Should handle new inputs (currently no-op but structure in place)
      expect(mockNode.querySelectorAll).toHaveBeenCalledWith('input[type="text"], textarea, [contenteditable="true"]');
    });

    test('should ignore non-element nodes', () => {
      const mockTextNode = {
        nodeType: Node.TEXT_NODE
      } as unknown as Text;

      const mutations = [{
        addedNodes: [mockTextNode]
      }] as MutationRecord[];

      // Should not throw error
      expect(() => {
        contentScript.handleDOMChanges(mutations);
      }).not.toThrow();
    });
  });

  describe('Message Handling', () => {
    let contentScript: any;

    beforeEach(async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      contentScript = new (ContentScript as any)();

      // Mock activeElement
      Object.defineProperty(document, 'activeElement', {
        value: mockInput,
        writable: true
      });
    });

    test('should handle expand text message', async () => {
      const message = {
        type: 'EXPAND_TEXT',
        snippet: mockSnippet,
        variables: null
      };

      const response = await contentScript.handleExpandText(message);

      expect(mockTextReplacer.replaceText).toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    test('should handle expand text with variables', async () => {
      const snippetWithVariables = {
        ...mockSnippet,
        content: 'Hello {name}!',
        variables: [{ name: 'name', placeholder: 'Enter name', required: true, type: 'text' as const }]
      };

      const message = {
        type: 'EXPAND_TEXT',
        snippet: snippetWithVariables,
        variables: { name: 'World' }
      };

      mockPlaceholderHandler.replaceVariables.mockReturnValue('Hello World!');

      const response = await contentScript.handleExpandText(message);

      expect(mockPlaceholderHandler.replaceVariables).toHaveBeenCalledWith('Hello {name}!', { name: 'World' });
      expect(mockTextReplacer.replaceText).toHaveBeenCalled();
      expect(response.success).toBe(true);
    });

    test('should handle variable prompt message', async () => {
      const message = {
        type: 'VARIABLE_PROMPT',
        snippet: mockSnippet
      };

      mockPlaceholderHandler.promptForVariables.mockResolvedValue({ name: 'Test' });

      const response = await contentScript.handleVariablePrompt(message);

      expect(mockPlaceholderHandler.promptForVariables).toHaveBeenCalledWith(mockSnippet);
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ name: 'Test' });
    });

    test('should handle errors in message processing', async () => {
      const message = {
        type: 'EXPAND_TEXT',
        snippet: mockSnippet,
        variables: null
      };

      mockTextReplacer.replaceText.mockImplementation(() => {
        throw new Error('Replacement failed');
      });

      const response = await contentScript.handleExpandText(message);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Replacement failed');
    });

    test('should handle no active element error', async () => {
      Object.defineProperty(document, 'activeElement', {
        value: null,
        writable: true
      });

      const message = {
        type: 'EXPAND_TEXT',
        snippet: mockSnippet,
        variables: null
      };

      const response = await contentScript.handleExpandText(message);

      expect(response.success).toBe(false);
      expect(response.error).toBe('No active text input found');
    });
  });

  describe('Enable/Disable Functionality', () => {
    let contentScript: any;

    beforeEach(async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      contentScript = new (ContentScript as any)();
    });

    test('should enable content script', () => {
      contentScript.setEnabled(true);

      expect(console.log).toHaveBeenCalledWith('Text Expander enabled');
      expect(contentScript.isEnabled).toBe(true);
    });

    test('should disable content script', () => {
      contentScript.setEnabled(false);

      expect(console.log).toHaveBeenCalledWith('Text Expander disabled');
      expect(contentScript.isEnabled).toBe(false);
    });

    test('should not process input when disabled', async () => {
      contentScript.setEnabled(false);

      const inputEvent = new Event('input', { bubbles: true });
      Object.defineProperty(inputEvent, 'target', { value: mockInput });

      await contentScript.handleInput(inputEvent);

      expect(mockTriggerDetector.processInput).not.toHaveBeenCalled();
    });

    test('should not process keydown when disabled', async () => {
      contentScript.setEnabled(false);

      const keyEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      Object.defineProperty(keyEvent, 'target', { value: mockInput });

      await contentScript.handleKeyDown(keyEvent);

      expect(mockTriggerDetector.processInput).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    let contentScript: any;

    beforeEach(async () => {
      const { ContentScript } = await import('../../src/content/content-script');
      contentScript = new (ContentScript as any)();
    });

    test('should handle trigger processing errors', async () => {
      mockTriggerDetector.processInput.mockImplementation(() => {
        throw new Error('Trigger detection failed');
      });

      const inputEvent = new Event('input', { bubbles: true });
      Object.defineProperty(inputEvent, 'target', { value: mockInput });

      // Should not throw
      await expect(contentScript.handleInput(inputEvent)).resolves.toBeUndefined();

      expect(console.error).toHaveBeenCalledWith('Error processing input:', expect.any(Error));
    });

    test('should handle snippet lookup errors', async () => {
      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: true,
        trigger: ';gb',
        state: TriggerState.COMPLETE
      });
      mockExtensionStorage.findSnippetByTrigger.mockRejectedValue(new Error('Storage error'));

      const inputEvent = new Event('input', { bubbles: true });
      Object.defineProperty(inputEvent, 'target', { value: mockInput });

      await contentScript.handleInput(inputEvent);

      expect(console.error).toHaveBeenCalledWith('Error processing trigger:', expect.any(Error));
    });

    test('should handle variable prompt errors', async () => {
      const snippetWithVariables = {
        ...mockSnippet,
        variables: [{ name: 'name', placeholder: 'Enter name', required: true, type: 'text' as const }]
      };

      mockTriggerDetector.processInput.mockReturnValue({
        isMatch: true,
        trigger: ';hello',
        state: TriggerState.COMPLETE
      });
      mockExtensionStorage.findSnippetByTrigger.mockResolvedValue(snippetWithVariables);
      mockPlaceholderHandler.promptForVariables.mockRejectedValue(new Error('User cancelled'));

      const inputEvent = new Event('input', { bubbles: true });
      Object.defineProperty(inputEvent, 'target', { value: mockInput });

      await contentScript.handleInput(inputEvent);

      expect(console.error).toHaveBeenCalledWith('Error processing trigger:', expect.any(Error));
    });
  });
});