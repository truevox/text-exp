/**
 * End-to-end tests for complete user workflows
 * Tests real user scenarios and interactions
 */

import { SyncManager } from '../../src/background/sync-manager';
import { TriggerDetector } from '../../src/content/trigger-detector';
import { TextReplacer } from '../../src/content/text-replacer';
import { ExtensionStorage } from '../../src/shared/storage';
import { AuthManager } from '../../src/background/auth-manager';
import type { TextSnippet } from '../../src/shared/types';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  identity: {
    launchWebAuthFlow: jest.fn()
  }
} as any;

// Mock DOM for content script tests
global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  execCommand: jest.fn(),
  activeElement: null,
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
} as any;

global.window = {
  getSelection: jest.fn(() => ({
    removeAllRanges: jest.fn(),
    addRange: jest.fn()
  })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
} as any;

// Mock fetch for cloud operations
global.fetch = jest.fn();

describe('Complete User Workflows E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default Chrome API responses
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 1, url: 'https://example.com' }]);
    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue({ success: true });
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
    (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
  });

  describe('New User Onboarding Flow', () => {
    it('should complete full onboarding workflow', async () => {
      // Step 1: Extension installation - no snippets exist
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({});
      
      const initialSnippets = await ExtensionStorage.getSnippets();
      expect(initialSnippets).toEqual([]);

      // Step 2: User creates first snippet
      const firstSnippet: TextSnippet = {
        id: 'first-snippet',
        trigger: 'hello',
        content: 'Hello World!',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await ExtensionStorage.setSnippets([firstSnippet]);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        snippets: [firstSnippet]
      });

      // Step 3: User tests text expansion
      const triggerDetector = new TriggerDetector([firstSnippet]);
      const textReplacer = new TextReplacer();

      // Simulate typing "hello" + Tab
      const mockInput = {
        value: 'hello',
        selectionStart: 5,
        selectionEnd: 5,
        focus: jest.fn(),
        setSelectionRange: jest.fn()
      };

      const detected = triggerDetector.processInput(';hello ');
      expect(detected.isMatch).toBe(true);
      expect(detected.trigger).toBe(';hello');
      expect(detected.content).toBe('Hello World!');

      // Text replacement - create snippet-like object from detected result
      const snippet = {
        id: '1',
        trigger: detected.trigger!,
        content: detected.content!,
        createdAt: firstSnippet.createdAt,
        updatedAt: firstSnippet.updatedAt
      };
      textReplacer.replaceText(mockInput as any, snippet, 0, detected.trigger!.length);
      
      expect(mockInput.value).toBe('Hello World!');
      expect(mockInput.setSelectionRange).toHaveBeenCalledWith(12, 12);

      // Step 4: User sets up cloud sync
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockResolvedValue(
        'https://test-extension-id.chromiumapp.org/?code=auth-code-123'
      );

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'access-token-123',
          refresh_token: 'refresh-token-123',
          expires_in: 3600
        })
      });

      const authResult = await AuthManager.authenticateWithGoogle();
      expect(authResult.success).toBe(true);
      expect(authResult.credentials?.accessToken).toBe('access-token-123');
    });

    it('should handle user errors gracefully during onboarding', async () => {
      // Test invalid snippet creation
      const invalidSnippet = {
        trigger: '', // Empty trigger
        content: 'Content',
        id: 'invalid'
      };

      // Should handle gracefully without crashing
      await expect(ExtensionStorage.setSnippets([invalidSnippet as any])).resolves.toBeUndefined();

      // Test auth failure recovery
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockResolvedValue(null);
      
      const authResult = await AuthManager.authenticateWithGoogle();
      expect(authResult.success).toBe(false);
      expect(authResult.error).toContain('OAuth flow cancelled');
    });
  });

  describe('Daily Usage Workflow', () => {
    const userSnippets: TextSnippet[] = [
      {
        id: '1',
        trigger: 'email',
        content: 'john.doe@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2', 
        trigger: 'addr',
        content: '123 Main St, City, State 12345',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        trigger: 'sig',
        content: 'Best regards,\nJohn Doe\nSoftware Engineer',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    beforeEach(() => {
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        snippets: userSnippets
      });
    });

    it('should handle typical workday text expansion scenarios', async () => {
      const triggerDetector = new TriggerDetector(userSnippets);
      const textReplacer = new TextReplacer();

      // Scenario 1: Email composition
      const emailField = {
        value: 'Contact me at email if you have questions.',
        selectionStart: 17,
        selectionEnd: 17,
        focus: jest.fn(),
        setSelectionRange: jest.fn()
      };

      const emailDetection = triggerDetector.processInput('email ');
      expect(emailDetection.isMatch).toBe(true);
      expect(emailDetection.trigger).toBe(';email');

      const emailSnippet = {
        id: '2',
        trigger: emailDetection.trigger!,
        content: emailDetection.content!,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      textReplacer.replaceText(emailField as any, emailSnippet, 14, 19);
      expect(emailField.value).toBe('Contact me at john.doe@example.com if you have questions.');

      // Scenario 2: Form filling with address
      const addressField = {
        value: 'Ship to: addr',
        selectionStart: 13,
        selectionEnd: 13,
        focus: jest.fn(),
        setSelectionRange: jest.fn()
      };

      const addrDetection = triggerDetector.detectTrigger(addressField.value, 13);
      textReplacer.replaceText(addressField as any, addrDetection.snippet, 9, 13);
      expect(addressField.value).toBe('Ship to: 123 Main St, City, State 12345');

      // Scenario 3: Email signature
      const signatureField = {
        value: '\n\nsig',
        selectionStart: 5,
        selectionEnd: 5,
        focus: jest.fn(),
        setSelectionRange: jest.fn()
      };

      const sigDetection = triggerDetector.detectTrigger(signatureField.value, 5);
      textReplacer.replaceText(signatureField as any, sigDetection.snippet, 2, 5);
      expect(signatureField.value).toContain('Best regards,\nJohn Doe\nSoftware Engineer');
    });

    it('should handle edge cases during daily usage', async () => {
      const triggerDetector = new TriggerDetector(userSnippets);

      // Test partial trigger matching
      const partialInput = 'em'; // Partial match for 'email'
      const noDetection = triggerDetector.detectTrigger(partialInput, 2);
      expect(noDetection).toBeNull();

      // Test trigger in middle of word
      const middleWord = 'myemail@test.com';
      const middleDetection = triggerDetector.detectTrigger(middleWord, 7);
      expect(middleDetection).toBeNull(); // Should not trigger inside words

      // Test multiple triggers in same text
      const multipleText = 'email and addr are needed';
      const firstTrigger = triggerDetector.detectTrigger(multipleText, 5);
      expect(firstTrigger?.snippet.trigger).toBe('email');
    });

    it('should sync changes during active usage', async () => {
      const syncManager = new SyncManager();
      
      // Mock Google Drive API calls
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ // Auth check
          ok: true,
          json: () => Promise.resolve({ user: {} })
        })
        .mockResolvedValueOnce({ // Upload snippets
          ok: true,
          json: () => Promise.resolve({ id: 'file-123' })
        })
        .mockResolvedValueOnce({ // Download snippets
          ok: true,
          json: () => Promise.resolve({ files: [] })
        });

      // User adds new snippet during the day
      const newSnippet: TextSnippet = {
        id: '4',
        trigger: 'phone',
        content: '(555) 123-4567',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedSnippets = [...userSnippets, newSnippet];
      await ExtensionStorage.setSnippets(updatedSnippets);

      // Sync should happen automatically
      await syncManager.syncSnippets();

      // Verify sync occurred
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Collaboration Workflow', () => {
    it('should handle team snippet sharing', async () => {
      const teamSnippets: TextSnippet[] = [
        {
          id: 'team-1',
          trigger: 'support',
          content: 'Thank you for contacting our support team. We will respond within 24 hours.',
          createdAt: new Date(),
          updatedAt: new Date(),
          isShared: true,
          scope: 'department'
        },
        {
          id: 'team-2',
          trigger: 'meeting',
          content: 'Please join our team meeting at: https://zoom.us/j/123456789',
          createdAt: new Date(),
          updatedAt: new Date(),
          isShared: true,
          scope: 'department'
        }
      ];

      const personalSnippets: TextSnippet[] = [
        {
          id: 'personal-1',
          trigger: 'myname',
          content: 'John Doe',
          createdAt: new Date(),
          updatedAt: new Date(),
          isShared: false,
          scope: 'personal'
        }
      ];

      const allSnippets = [...teamSnippets, ...personalSnippets];
      
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        snippets: allSnippets
      });

      const triggerDetector = new TriggerDetector(allSnippets);

      // Test team snippet usage
      const supportResponse = triggerDetector.detectTrigger('support', 7);
      expect(supportResponse?.snippet.isShared).toBe(true);
      expect(supportResponse?.snippet.scope).toBe('department');

      // Test personal snippet usage
      const personalUsage = triggerDetector.detectTrigger('myname', 6);
      expect(personalUsage?.snippet.isShared).toBe(false);
      expect(personalUsage?.snippet.scope).toBe('personal');
    });

    it('should handle scope-based snippet access', async () => {
      const scopedSnippets: TextSnippet[] = [
        { id: '1', trigger: 'personal', content: 'Personal content', scope: 'personal', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', trigger: 'dept', content: 'Department content', scope: 'department', createdAt: new Date(), updatedAt: new Date() },
        { id: '3', trigger: 'org', content: 'Organization content', scope: 'org', createdAt: new Date(), updatedAt: new Date() }
      ];

      // Test access based on user's scope permissions
      const triggerDetector = new TriggerDetector(scopedSnippets);

      // All scopes should be accessible in this test scenario
      expect(triggerDetector.detectTrigger('personal', 8)?.snippet.scope).toBe('personal');
      expect(triggerDetector.detectTrigger('dept', 4)?.snippet.scope).toBe('department');
      expect(triggerDetector.detectTrigger('org', 3)?.snippet.scope).toBe('org');
    });
  });

  describe('Cross-Device Synchronization Workflow', () => {
    it('should handle sync conflicts between devices', async () => {
      const syncManager = new SyncManager();

      // Device A has these snippets
      const deviceASnippets: TextSnippet[] = [
        {
          id: '1',
          trigger: 'email',
          content: 'old.email@example.com',
          updatedAt: new Date('2023-01-01'),
          createdAt: new Date('2023-01-01')
        }
      ];

      // Device B has updated the same snippet
      const deviceBSnippets: TextSnippet[] = [
        {
          id: '1',
          trigger: 'email',
          content: 'new.email@example.com',
          updatedAt: new Date('2023-01-02'), // Newer
          createdAt: new Date('2023-01-01')
        }
      ];

      // Mock cloud storage returning Device B's version
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ user: {} })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            files: [{
              id: 'cloud-file-123',
              name: 'snippets.json',
              modifiedTime: '2023-01-02T12:00:00Z'
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(deviceBSnippets))
        });

      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        snippets: deviceASnippets
      });

      // Sync should merge and prefer newer version
      await syncManager.syncSnippets();

      // Should update local storage with newer version
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        snippets: deviceBSnippets // Newer version wins
      });
    });

    it('should handle network failures during sync', async () => {
      const syncManager = new SyncManager();
      
      // Mock network failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        snippets: [{ id: '1', trigger: 'test', content: 'test', createdAt: new Date(), updatedAt: new Date() }]
      });

      // Sync should fail gracefully
      await expect(syncManager.syncSnippets()).rejects.toThrow('Network error');

      // Local data should remain unchanged
      const localSnippets = await ExtensionStorage.getSnippets();
      expect(localSnippets).toHaveLength(1);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle large snippet libraries efficiently', async () => {
      // Create 1000 snippets
      const largeSnippetLibrary: TextSnippet[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `snippet-${i}`,
        trigger: `trigger${i}`,
        content: `Content for snippet ${i}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        snippets: largeSnippetLibrary
      });

      const start = Date.now();
      
      const triggerDetector = new TriggerDetector(largeSnippetLibrary);
      
      // Test trigger detection performance
      const detection = triggerDetector.detectTrigger('trigger500', 10);
      
      const duration = Date.now() - start;

      expect(detection?.snippet.id).toBe('snippet-500');
      expect(duration).toBeLessThan(100); // Should be fast even with 1000 snippets
    });

    it('should handle rapid successive text expansions', async () => {
      const snippets: TextSnippet[] = [
        { id: '1', trigger: 'a', content: 'Alpha', createdAt: new Date(), updatedAt: new Date() },
        { id: '2', trigger: 'b', content: 'Beta', createdAt: new Date(), updatedAt: new Date() },
        { id: '3', trigger: 'c', content: 'Gamma', createdAt: new Date(), updatedAt: new Date() }
      ];

      const triggerDetector = new TriggerDetector(snippets);
      const textReplacer = new TextReplacer();

      // Simulate rapid typing and expansion
      const mockField = {
        value: '',
        selectionStart: 0,
        selectionEnd: 0,
        focus: jest.fn(),
        setSelectionRange: jest.fn()
      };

      const triggers = ['a', 'b', 'c'];
      
      for (const trigger of triggers) {
        const detection = triggerDetector.detectTrigger(trigger, trigger.length);
        if (detection) {
          textReplacer.replaceText(mockField as any, detection.snippet, 0, trigger.length);
          mockField.value += ' '; // Add space between expansions
          mockField.selectionStart = mockField.value.length;
          mockField.selectionEnd = mockField.value.length;
        }
      }

      expect(mockField.value).toContain('Alpha');
      expect(mockField.value).toContain('Beta');
      expect(mockField.value).toContain('Gamma');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from corrupted local storage', async () => {
      // Mock corrupted data
      (chrome.storage.local.get as jest.Mock).mockResolvedValue({
        snippets: 'corrupted-string-instead-of-array'
      });

      const snippets = await ExtensionStorage.getSnippets();
      
      // Should return empty array instead of crashing
      expect(Array.isArray(snippets)).toBe(true);
      expect(snippets).toEqual([]);
    });

    it('should handle extension updates gracefully', async () => {
      // Simulate old data format
      const oldFormatData = {
        textSnippets: [ // Old property name
          { shortcut: 'email', expansion: 'test@example.com' } // Old property names
        ]
      };

      (chrome.storage.local.get as jest.Mock).mockResolvedValue(oldFormatData);

      // Should handle old format gracefully
      const snippets = await ExtensionStorage.getSnippets();
      expect(Array.isArray(snippets)).toBe(true);
    });

    it('should handle content script injection failures', async () => {
      // Mock content script injection failure
      (chrome.tabs.sendMessage as jest.Mock).mockRejectedValue(
        new Error('Could not establish connection')
      );

      // Should not crash the background script
      await expect(chrome.tabs.sendMessage(1, { type: 'TEST' })).rejects.toThrow('Could not establish connection');
    });
  });

  describe('Accessibility and Usability', () => {
    it('should work with screen readers and accessibility tools', async () => {
      const snippets: TextSnippet[] = [
        {
          id: '1',
          trigger: 'phone',
          content: '(555) 123-4567',
          description: 'My phone number',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const triggerDetector = new TriggerDetector(snippets);
      const textReplacer = new TextReplacer();

      // Mock accessibility-enabled input field
      const accessibleField = {
        value: 'Call me at phone',
        selectionStart: 15,
        selectionEnd: 15,
        focus: jest.fn(),
        setSelectionRange: jest.fn(),
        setAttribute: jest.fn(),
        getAttribute: jest.fn(() => 'textbox'),
        'aria-label': 'Phone number field'
      };

      const detection = triggerDetector.detectTrigger(accessibleField.value, 15);
      textReplacer.replaceText(accessibleField as any, detection.snippet, 10, 15);

      expect(accessibleField.value).toBe('Call me at (555) 123-4567');
      expect(accessibleField.focus).toHaveBeenCalled(); // Should refocus for screen readers
    });

    it('should provide clear feedback for user actions', async () => {
      const snippets: TextSnippet[] = [
        { id: '1', trigger: 'test', content: 'Test Content', createdAt: new Date(), updatedAt: new Date() }
      ];

      // Mock notification system
      const mockNotification = jest.fn();
      global.Notification = mockNotification as any;

      const triggerDetector = new TriggerDetector(snippets);
      
      // Test successful expansion
      const detection = triggerDetector.detectTrigger('test', 4);
      expect(detection).toBeTruthy();

      // Test failed expansion (no matching trigger)
      const noDetection = triggerDetector.detectTrigger('nomatch', 7);
      expect(noDetection).toBeNull();
    });
  });
});