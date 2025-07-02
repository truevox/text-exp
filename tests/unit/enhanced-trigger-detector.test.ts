/**
 * Tests for Enhanced Trigger Detector
 * Ensures performance improvements maintain compatibility
 */

import { EnhancedTriggerDetector, TriggerState } from '../../src/content/enhanced-trigger-detector.js';

describe('EnhancedTriggerDetector', () => {
  let detector: EnhancedTriggerDetector;
  
  const testSnippets = [
    { trigger: ';hello', content: 'Hello, World!' },
    { trigger: ';helloworld', content: 'Hello, entire world!' },
    { trigger: ';he', content: 'He/him' },
    { trigger: ';help', content: 'Need assistance?' },
    { trigger: ';h', content: 'H' },
    { trigger: ';test', content: 'This is a test' },
    { trigger: ';longertrigger', content: 'A longer trigger for testing' }
  ];

  beforeEach(() => {
    detector = new EnhancedTriggerDetector(testSnippets);
  });

  describe('Basic Functionality', () => {
    test('should detect exact trigger with delimiter', () => {
      const result = detector.processInput(';hello ');
      
      expect(result.isMatch).toBe(true);
      expect(result.state).toBe(TriggerState.COMPLETE);
      expect(result.trigger).toBe(';hello');
      expect(result.content).toBe('Hello, World!');
    });

    test('should handle no matches', () => {
      const result = detector.processInput(';unknown ');
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.NO_MATCH);
    });

    test('should detect typing state', () => {
      const result = detector.processInput(';hel');
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.TYPING);
      expect(result.potentialTrigger).toBe(';hel');
    });
  });

  describe('Performance Optimizations', () => {
    test('should handle large input efficiently', () => {
      const largeInput = 'a'.repeat(1000) + ' ;hello ';
      const startTime = performance.now();
      
      const result = detector.processInput(largeInput);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(result.isMatch).toBe(true);
      expect(duration).toBeLessThan(5); // Should be very fast
    });

    test('should handle many similar triggers efficiently', () => {
      const manySnippets = [];
      for (let i = 0; i < 1000; i++) {
        manySnippets.push({
          trigger: `;test${i}`,
          content: `Test content ${i}`
        });
      }
      
      const bigDetector = new EnhancedTriggerDetector(manySnippets);
      const startTime = performance.now();
      
      const result = bigDetector.processInput(';test500 ');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(';test500');
      expect(duration).toBeLessThan(10); // Should still be fast
    });

    test('should fail fast on invalid characters', () => {
      const result = detector.processInput(';xyz123!@# ');
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.NO_MATCH);
    });
  });

  describe('Ambiguous Trigger Handling', () => {
    test('should detect ambiguous state with multiple possible completions', () => {
      const result = detector.processInput(';he');
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.AMBIGUOUS);
      expect(result.possibleCompletions).toContain(';hello');
      expect(result.possibleCompletions).toContain(';help');
      expect(result.possibleCompletions).toContain(';he');
    });

    test('should handle prefix overlap correctly', () => {
      const result = detector.processInput(';h');
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.AMBIGUOUS);
      expect(result.possibleCompletions?.length).toBeGreaterThan(1);
    });
  });

  describe('Context Awareness', () => {
    test('should require word boundary before prefix', () => {
      const result = detector.processInput('word;hello ');
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });

    test('should work at start of input', () => {
      const result = detector.processInput(';hello ');
      
      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(';hello');
    });

    test('should work after valid delimiters', () => {
      const result = detector.processInput('Word. ;hello ');
      
      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(';hello');
    });
  });

  describe('Cursor Position Handling', () => {
    test('should process up to cursor position', () => {
      const input = ';hello world';
      const result = detector.processInput(input, 6); // After ';hello'
      
      expect(result.isMatch).toBe(false);
      // Should be ambiguous because ;helloworld exists
      expect(result.state).toBe(TriggerState.AMBIGUOUS);
      expect(result.potentialTrigger).toBe(';hello');
      expect(result.possibleCompletions).toContain(';helloworld');
    });

    test('should handle cursor in middle of trigger', () => {
      const input = ';hello';
      const result = detector.processInput(input, 4); // After ';hel'
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.TYPING);
      expect(result.potentialTrigger).toBe(';hel');
    });
  });

  describe('Performance Statistics', () => {
    test('should provide performance statistics', () => {
      const stats = detector.getPerformanceStats();
      
      expect(stats.snippetCount).toBe(testSnippets.length);
      expect(stats.maxTriggerLength).toBeGreaterThan(0);
      expect(stats.trieDepth).toBeGreaterThan(0);
      expect(stats.totalNodes).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Updates', () => {
    test('should update snippets and maintain performance', () => {
      const newSnippets = [
        { trigger: ';new', content: 'New content' },
        { trigger: ';updated', content: 'Updated content' }
      ];
      
      detector.updateSnippets(newSnippets);
      
      const result = detector.processInput(';new ');
      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(';new');
      
      // Old triggers should no longer work
      const oldResult = detector.processInput(';hello ');
      expect(oldResult.isMatch).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty input', () => {
      const result = detector.processInput('');
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });

    test('should handle input with only prefix', () => {
      const result = detector.processInput(';');
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });

    test('should handle very long invalid trigger', () => {
      const longInvalid = ';' + 'x'.repeat(1000);
      const result = detector.processInput(longInvalid);
      
      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });
  });

  describe('Delimiter Handling', () => {
    test('should recognize all standard delimiters', () => {
      const delimiters = [' ', '\t', '\n', '.', ',', '!', '?', ';', ':', '(', ')', '[', ']'];
      
      for (const delimiter of delimiters) {
        const result = detector.processInput(`;hello${delimiter}`);
        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe(';hello');
      }
    });
  });
});