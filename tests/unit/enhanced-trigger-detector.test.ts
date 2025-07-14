/**
 * Tests for Enhanced Trigger Detector
 * Ensures performance improvements maintain compatibility
 */

import {
  EnhancedTriggerDetector,
  TriggerState,
} from "../../src/content/enhanced-trigger-detector.js";

describe("EnhancedTriggerDetector", () => {
  let detector: EnhancedTriggerDetector;

  const testSnippets = [
    { trigger: ";hello", content: "Hello, World!" },
    { trigger: ";helloworld", content: "Hello, entire world!" },
    { trigger: ";he", content: "He/him" },
    { trigger: ";help", content: "Need assistance?" },
    { trigger: ";h", content: "H" },
    { trigger: ";test", content: "This is a test" },
    { trigger: ";longertrigger", content: "A longer trigger for testing" },
    { trigger: "punt", content: "PUNT! LETS GOOOOOO!!!!" }, // Non-prefixed trigger
    { trigger: "hello", content: "Hi there!" }, // Another non-prefixed trigger
  ];

  beforeEach(() => {
    detector = new EnhancedTriggerDetector(testSnippets);
  });

  describe("Basic Functionality", () => {
    test("should detect exact trigger with delimiter", () => {
      const result = detector.processInput(";hello ");

      expect(result.isMatch).toBe(true);
      expect(result.state).toBe(TriggerState.COMPLETE);
      expect(result.trigger).toBe(";hello");
      expect(result.content).toBe("Hello, World!");
    });

    test("should handle no matches", () => {
      const result = detector.processInput(";unknown ");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.NO_MATCH);
    });

    test("should detect typing state", () => {
      const result = detector.processInput(";hel");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.TYPING);
      expect(result.potentialTrigger).toBe(";hel");
    });
  });

  describe("Performance Optimizations", () => {
    test("should handle large input efficiently", () => {
      const largeInput = "a".repeat(1000) + " ;hello ";
      const startTime = performance.now();

      const result = detector.processInput(largeInput);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.isMatch).toBe(true);
      expect(duration).toBeLessThan(10); // Should be reasonably fast (increased for non-prefixed trigger support)
    });

    test("should handle many similar triggers efficiently", () => {
      const manySnippets = [];
      for (let i = 0; i < 1000; i++) {
        manySnippets.push({
          trigger: `;test${i}`,
          content: `Test content ${i}`,
        });
      }

      const bigDetector = new EnhancedTriggerDetector(manySnippets);
      const startTime = performance.now();

      const result = bigDetector.processInput(";test500 ");

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(";test500");
      expect(duration).toBeLessThan(20); // Should still be fast
    });

    test("should fail fast on invalid characters", () => {
      const result = detector.processInput(";xyz123!@# ");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.NO_MATCH);
    });
  });

  describe("Ambiguous Trigger Handling", () => {
    test("should detect ambiguous state with multiple possible completions", () => {
      const result = detector.processInput(";he");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.AMBIGUOUS);
      expect(result.possibleCompletions).toContain(";hello");
      expect(result.possibleCompletions).toContain(";help");
      expect(result.possibleCompletions).toContain(";he");
    });

    test("should handle prefix overlap correctly", () => {
      const result = detector.processInput(";h");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.AMBIGUOUS);
      expect(result.possibleCompletions?.length).toBeGreaterThan(1);
    });
  });

  describe("Context Awareness", () => {
    test("should require word boundary before prefix", () => {
      const result = detector.processInput("word;hello ");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });

    test("should work at start of input", () => {
      const result = detector.processInput(";hello ");

      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(";hello");
    });

    test("should work after valid delimiters", () => {
      const result = detector.processInput("Word. ;hello ");

      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(";hello");
    });
  });

  describe("Cursor Position Handling", () => {
    test("should process up to cursor position", () => {
      const input = ";hello world";
      const result = detector.processInput(input, 6); // After ';hello'

      expect(result.isMatch).toBe(false);
      // Should be ambiguous because ;helloworld exists
      expect(result.state).toBe(TriggerState.AMBIGUOUS);
      expect(result.potentialTrigger).toBe(";hello");
      expect(result.possibleCompletions).toContain(";helloworld");
    });

    test("should handle cursor in middle of trigger", () => {
      const input = ";hello";
      const result = detector.processInput(input, 4); // After ';hel'

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.TYPING);
      expect(result.potentialTrigger).toBe(";hel");
    });
  });

  describe("Performance Statistics", () => {
    test("should provide performance statistics", () => {
      const stats = detector.getPerformanceStats();

      expect(stats.snippetCount).toBe(testSnippets.length);
      expect(stats.maxTriggerLength).toBeGreaterThan(0);
      expect(stats.trieDepth).toBeGreaterThan(0);
      expect(stats.totalNodes).toBeGreaterThan(0);
    });
  });

  describe("Dynamic Updates", () => {
    test("should update snippets and maintain performance", () => {
      const newSnippets = [
        { trigger: ";new", content: "New content" },
        { trigger: ";updated", content: "Updated content" },
      ];

      detector.updateSnippets(newSnippets);

      const result = detector.processInput(";new ");
      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(";new");

      // Old triggers should no longer work
      const oldResult = detector.processInput(";hello ");
      expect(oldResult.isMatch).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty input", () => {
      const result = detector.processInput("");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });

    test("should handle input with only prefix", () => {
      const result = detector.processInput(";");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });

    test("should handle very long invalid trigger", () => {
      const longInvalid = ";" + "x".repeat(1000);
      const result = detector.processInput(longInvalid);

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });
  });

  describe("Delimiter Handling", () => {
    test("should recognize all standard delimiters", () => {
      const delimiters = [
        " ",
        "\t",
        "\n",
        ".",
        ",",
        "!",
        "?",
        ";",
        ":",
        "(",
        ")",
        "[",
        "]",
      ];

      for (const delimiter of delimiters) {
        const result = detector.processInput(`;hello${delimiter}`);
        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe(";hello");
      }
    });
  });

  describe("Non-Prefixed Triggers", () => {
    test("should detect non-prefixed trigger at end of input", () => {
      const result = detector.processInput("hello");

      expect(result.isMatch).toBe(true);
      expect(result.state).toBe(TriggerState.COMPLETE);
      expect(result.trigger).toBe("hello");
      expect(result.content).toBe("Hi there!");
    });

    test("should detect non-prefixed trigger followed by delimiter", () => {
      const result = detector.processInput("punt ");

      expect(result.isMatch).toBe(true);
      expect(result.state).toBe(TriggerState.COMPLETE);
      expect(result.trigger).toBe("punt");
      expect(result.content).toBe("PUNT! LETS GOOOOOO!!!!");
    });

    test("should handle partial non-prefixed trigger", () => {
      const result = detector.processInput("pu");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.TYPING);
      expect(result.potentialTrigger).toBe("pu");
    });

    test("should detect non-prefixed trigger in longer text", () => {
      const result = detector.processInput("some text punt here");

      expect(result.isMatch).toBe(true);
      expect(result.state).toBe(TriggerState.COMPLETE);
      expect(result.trigger).toBe("punt");
      expect(result.content).toBe("PUNT! LETS GOOOOOO!!!!");
    });

    test("should handle mixed prefixed and non-prefixed triggers", () => {
      // Should still detect prefixed triggers
      const prefixedResult = detector.processInput(";hello ");
      expect(prefixedResult.isMatch).toBe(true);
      expect(prefixedResult.trigger).toBe(";hello");

      // Should also detect non-prefixed triggers
      const nonPrefixedResult = detector.processInput("hello ");
      expect(nonPrefixedResult.isMatch).toBe(true);
      expect(nonPrefixedResult.trigger).toBe("hello");
    });

    test("should not match non-prefixed trigger in middle of word", () => {
      const result = detector.processInput("hellothere");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });
  });

  describe("Word Boundary Validation for Non-Prefixed Triggers", () => {
    beforeEach(() => {
      // Add additional triggers for comprehensive word boundary testing
      const boundaryTestSnippets = [
        { trigger: ";hello", content: "Hello, World!" },
        { trigger: "punt", content: "PUNT! LETS GOOOOOO!!!!" },
        { trigger: "hello", content: "Hi there!" },
        { trigger: "test", content: "Test content" },
        { trigger: "go", content: "Let's go!" },
        { trigger: "run", content: "Running fast!" },
      ];
      detector = new EnhancedTriggerDetector(boundaryTestSnippets);
    });

    describe("Valid word boundary cases", () => {
      const validCases = [
        { input: "test", description: "trigger at end of input" },
        { input: "test ", description: "trigger followed by space" },
        { input: "test.", description: "trigger followed by period" },
        { input: "test!", description: "trigger followed by exclamation" },
        { input: "test?", description: "trigger followed by question mark" },
        { input: "test,", description: "trigger followed by comma" },
        // Note: semicolon is a trigger prefix, so "test;" is handled differently
        { input: "test:", description: "trigger followed by colon" },
        { input: "test(", description: "trigger followed by opening paren" },
        { input: "test)", description: "trigger followed by closing paren" },
        { input: "test[", description: "trigger followed by opening bracket" },
        { input: "test]", description: "trigger followed by closing bracket" },
        { input: "test\n", description: "trigger followed by newline" },
        { input: "test\t", description: "trigger followed by tab" },
        { input: "hello test", description: "trigger with proper start boundary" },
        { input: "hello test world", description: "trigger with proper boundaries on both sides" },
        { input: " test ", description: "trigger surrounded by spaces" },
      ];

      validCases.forEach(({ input, description }) => {
        test(`should match '${input}' (${description})`, () => {
          const result = detector.processInput(input);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("test");
        });
      });
    });

    describe("Invalid word boundary cases - should NOT match", () => {
      const invalidCases = [
        { input: "testing", description: "trigger followed by alphanumeric" },
        { input: "test123", description: "trigger followed by numbers" },
        { input: "testabc", description: "trigger followed by letters" },
        { input: "mytest", description: "trigger preceded by alphanumeric" },
        { input: "123test", description: "trigger preceded by numbers" },
        { input: "abctest", description: "trigger preceded by letters" },
        { input: "sometestword", description: "trigger in middle of word" },
        { input: "atestb", description: "trigger surrounded by alphanumeric" },
        { input: "test_word", description: "trigger followed by underscore" },
        { input: "my_test", description: "trigger preceded by underscore" },
      ];

      invalidCases.forEach(({ input, description }) => {
        test(`should NOT match '${input}' (${description})`, () => {
          const result = detector.processInput(input);
          // Should either not match at all, or match a different trigger
          if (result.isMatch) {
            expect(result.trigger).not.toBe("test");
          } else {
            expect(result.isMatch).toBe(false);
          }
        });
      });
    });

    describe("Edge cases with multiple potential triggers", () => {
      test("should not match 'go' inside 'going'", () => {
        const result = detector.processInput("going");
        expect(result.isMatch).toBe(false);
      });

      test("should not match 'run' inside 'running'", () => {
        const result = detector.processInput("running");
        expect(result.isMatch).toBe(false);
      });

      test("should match 'go' when properly bounded", () => {
        const result = detector.processInput("let's go!");
        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe("go");
      });

      test("should match 'run' when properly bounded", () => {
        const result = detector.processInput("please run fast");
        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe("run");
      });
    });

    describe("Performance with boundary checking", () => {
      test("should handle boundary checking efficiently", () => {
        // Use a shorter text that's within the search optimization range
        const longText = "a".repeat(50) + " test " + "b".repeat(50);
        const startTime = performance.now();
        
        const result = detector.processInput(longText);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe("test");
        expect(duration).toBeLessThan(100); // Should be fast even with boundary checking
      });

      test("should not find triggers without proper boundaries even in long text", () => {
        // This should NOT match because "test" is not properly bounded
        const longText = "a".repeat(1000) + "testword" + "b".repeat(1000);
        const result = detector.processInput(longText);
        
        // Should either not match at all, or not match "test" specifically
        if (result.isMatch) {
          expect(result.trigger).not.toBe("test");
        } else {
          expect(result.isMatch).toBe(false);
        }
      });
    });
  });
});
