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

  // Comprehensive Live Trigger Dataset - 50+ Real-World Triggers
  const liveTriggersDataset = [
    // Slash-prefixed triggers
    {
      trigger: "/gb",
      content: "Goodbye! Have a great day!",
      type: "slash-prefixed",
    },
    { trigger: "/shrug", content: "¯\\_(ツ)_/¯", type: "slash-prefixed" },
    {
      trigger: "/help",
      content: "How can I help you today?",
      type: "slash-prefixed",
    },
    {
      trigger: "/update",
      content: "Just a quick update:",
      type: "slash-prefixed",
    },
    {
      trigger: "/lorem",
      content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      type: "slash-prefixed",
    },
    {
      trigger: "/date",
      content: "{{date:YYYY-MM-DD}}",
      type: "slash-prefixed",
    },
    { trigger: "/link", content: "Link text", type: "slash-prefixed" },
    {
      trigger: "/conf",
      content: "Please confirm receipt.",
      type: "slash-prefixed",
    },
    {
      trigger: "/eta?",
      content: "Any update on the ETA?",
      type: "slash-prefixed",
    },
    { trigger: "/wel", content: "Welcome aboard!", type: "slash-prefixed" },
    { trigger: "/omw", content: "On my way! 🚗💨", type: "slash-prefixed" },
    {
      trigger: "/queue",
      content: "Your request has been added to the queue.",
      type: "slash-prefixed",
    },
    { trigger: "/json", content: '{"status":"ok"}', type: "slash-prefixed" },
    { trigger: "/sig2", content: "— Marv B.", type: "slash-prefixed" },
    { trigger: "/yeet", content: "✨YEET!✨", type: "slash-prefixed" },
    {
      trigger: "/sig",
      content: "— Marvin C. Bentley II",
      type: "slash-prefixed",
    },
    {
      trigger: "/email",
      content: "mbentley@windhamcentral.org",
      type: "slash-prefixed",
    },

    // Semicolon-prefixed triggers
    {
      trigger: ";brb",
      content: "Be right back—just a sec!",
      type: "semicolon-prefixed",
    },
    {
      trigger: ";addr",
      content: "907 Newfane Rd, Wardsboro VT 05355",
      type: "semicolon-prefixed",
    },
    {
      trigger: ";phone",
      content: "(802) 555-0123",
      type: "semicolon-prefixed",
    },
    { trigger: ";gm", content: "Good morning! ☀️", type: "semicolon-prefixed" },
    { trigger: ";gn", content: "Good night! 🌙", type: "semicolon-prefixed" },
    {
      trigger: ";tyvm",
      content: "Thank you very much!",
      type: "semicolon-prefixed",
    },
    {
      trigger: ";np",
      content: "No problem at all!",
      type: "semicolon-prefixed",
    },
    { trigger: ";woot", content: "🎉 Woo-hoo!", type: "semicolon-prefixed" },
    {
      trigger: ";asy",
      content: "As soon as you're able.",
      type: "semicolon-prefixed",
    },
    {
      trigger: ";fyi",
      content: "For your information:",
      type: "semicolon-prefixed",
    },
    {
      trigger: ";asap",
      content: "As soon as possible, please.",
      type: "semicolon-prefixed",
    },
    {
      trigger: ";sign",
      content: "Kindly sign and return.",
      type: "semicolon-prefixed",
    },
    { trigger: ";cheers", content: "Cheers! 🥂", type: "semicolon-prefixed" },
    { trigger: ";time", content: "{{time:HH:mm}}", type: "semicolon-prefixed" },
    { trigger: ";emoji", content: "😺💻✨", type: "semicolon-prefixed" },
    {
      trigger: ";code",
      content: 'print("Hello, world!")',
      type: "semicolon-prefixed",
    },
    {
      trigger: ";quote",
      content:
        '"The only limit to our realization of tomorrow is our doubts of today."',
      type: "semicolon-prefixed",
    },
    {
      trigger: ";afk",
      content: "Away from keyboard—back soon!",
      type: "semicolon-prefixed",
    },
    { trigger: ";oops", content: "Oops—my bad!", type: "semicolon-prefixed" },
    {
      trigger: ";re",
      content: "Regarding our previous conversation,",
      type: "semicolon-prefixed",
    },
    {
      trigger: ";tyia",
      content: "Thank you in advance!",
      type: "semicolon-prefixed",
    },
    {
      trigger: ";gtg",
      content: "Gotta go—catch you later!",
      type: "semicolon-prefixed",
    },
    { trigger: ";ily", content: "I love you! ❤️", type: "semicolon-prefixed" },
    {
      trigger: ";cat",
      content: "Look at this kitty: 🐱",
      type: "semicolon-prefixed",
    },
    { trigger: ";yay", content: "Yay! ✨", type: "semicolon-prefixed" },
    {
      trigger: ";eta10",
      content: "I'll be there in about 10 minutes.",
      type: "semicolon-prefixed",
    },
    {
      trigger: ";html5",
      content:
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Document</title></head><body></body></html>',
      type: "semicolon-prefixed",
    },
    {
      trigger: ";zoom",
      content: "Here's the Zoom link: https://zoom.us/j/123456789",
      type: "semicolon-prefixed",
    },
    { trigger: ";bc", content: "Because 🐻", type: "semicolon-prefixed" },

    // Non-prefixed triggers
    { trigger: "ty", content: "Thank you!", type: "non-prefixed" },
    {
      trigger: "gg!",
      content: "Good game! Well played!",
      type: "non-prefixed",
    },
    { trigger: ":smile:", content: "😊", type: "non-prefixed" },
    { trigger: "kk", content: "👍 Roger that!", type: "non-prefixed" },
    { trigger: "yay", content: "Yay! ✨", type: "non-prefixed" }, // Note: different from ;yay

    // Test triggers for boundary validation
    { trigger: "wub", content: "Wubbalubba Dub Dub!!!", type: "non-prefixed" },
    {
      trigger: "punt",
      content: "PUNT! LETS GOOOOOO!!!!",
      type: "non-prefixed",
    },
    { trigger: "test", content: "Test content", type: "non-prefixed" },
    { trigger: "go", content: "Let's go!", type: "non-prefixed" },
    { trigger: "run", content: "Running fast!", type: "non-prefixed" },
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
        {
          input: "hello test",
          description: "trigger with proper start boundary",
        },
        {
          input: "hello test world",
          description: "trigger with proper boundaries on both sides",
        },
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

  describe("Live Trigger Expansion Testing", () => {
    let liveDetector: EnhancedTriggerDetector;

    beforeEach(() => {
      // For the comprehensive test, we need to handle all trigger types
      // Since the detector can only handle one prefix at a time, we need to
      // test different trigger types separately or modify the detector
      liveDetector = new EnhancedTriggerDetector(liveTriggersDataset);
    });

    describe("Slash-Prefixed Triggers (/)", () => {
      const slashTriggers = liveTriggersDataset.filter(
        (t) => t.type === "slash-prefixed",
      );
      let slashDetector: EnhancedTriggerDetector;

      beforeEach(() => {
        // Create a detector specifically for slash-prefixed triggers
        slashDetector = new EnhancedTriggerDetector(slashTriggers, "/");
      });

      slashTriggers.forEach(({ trigger, content }) => {
        test(`should expand '${trigger}' to '${content.substring(0, 50)}${content.length > 50 ? "..." : ""}'`, () => {
          const result = slashDetector.processInput(`${trigger} `);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(trigger);
          expect(result.content).toBe(content);
          expect(result.state).toBe(TriggerState.COMPLETE);
        });

        test(`should detect '${trigger}' at start of input`, () => {
          const result = slashDetector.processInput(`${trigger} test`);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(trigger);
        });

        test(`should detect '${trigger}' after delimiter`, () => {
          const result = slashDetector.processInput(`hello. ${trigger} `);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(trigger);
        });
      });
    });

    describe("Semicolon-Prefixed Triggers (;)", () => {
      const semicolonTriggers = liveTriggersDataset.filter(
        (t) => t.type === "semicolon-prefixed",
      );
      let semicolonDetector: EnhancedTriggerDetector;

      beforeEach(() => {
        // Create a detector specifically for semicolon-prefixed triggers
        semicolonDetector = new EnhancedTriggerDetector(semicolonTriggers, ";");
      });

      semicolonTriggers.forEach(({ trigger, content }) => {
        test(`should expand '${trigger}' to '${content.substring(0, 50)}${content.length > 50 ? "..." : ""}'`, () => {
          const result = semicolonDetector.processInput(`${trigger} `);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(trigger);
          expect(result.content).toBe(content);
          expect(result.state).toBe(TriggerState.COMPLETE);
        });

        test(`should detect '${trigger}' at start of input`, () => {
          const result = semicolonDetector.processInput(`${trigger} test`);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(trigger);
        });

        test(`should detect '${trigger}' after delimiter`, () => {
          const result = semicolonDetector.processInput(`word ${trigger} `);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(trigger);
        });
      });
    });

    describe("Non-Prefixed Triggers - Core Functionality", () => {
      const nonPrefixedTriggers = liveTriggersDataset.filter(
        (t) => t.type === "non-prefixed",
      );
      let nonPrefixedDetector: EnhancedTriggerDetector;

      beforeEach(() => {
        // Create a detector for non-prefixed triggers (any prefix works since these don't use prefix matching)
        nonPrefixedDetector = new EnhancedTriggerDetector(
          nonPrefixedTriggers,
          ";",
        );
      });

      nonPrefixedTriggers.forEach(({ trigger, content }) => {
        test(`should expand '${trigger}' to '${content.substring(0, 50)}${content.length > 50 ? "..." : ""}'`, () => {
          const result = nonPrefixedDetector.processInput(`${trigger} `);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(trigger);
          expect(result.content).toBe(content);
          expect(result.state).toBe(TriggerState.COMPLETE);
        });

        test(`should detect '${trigger}' at end of input`, () => {
          const result = nonPrefixedDetector.processInput(trigger);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(trigger);
        });

        test(`should detect '${trigger}' with delimiter`, () => {
          const result = nonPrefixedDetector.processInput(`${trigger}.`);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(trigger);
        });
      });
    });

    describe("Critical Word Boundary Validation", () => {
      beforeEach(() => {
        // Use a focused set of triggers for boundary testing
        const boundaryTestTriggers = [
          { trigger: "ty", content: "Thank you!" },
          { trigger: "wub", content: "Wubbalubba Dub Dub!!!" },
          { trigger: "punt", content: "PUNT! LETS GOOOOOO!!!!" },
          { trigger: "test", content: "Test content" },
          { trigger: "go", content: "Let's go!" },
          { trigger: "run", content: "Running fast!" },
          { trigger: "gg!", content: "Good game! Well played!" },
          { trigger: ":smile:", content: "😊" },
        ];
        liveDetector = new EnhancedTriggerDetector(boundaryTestTriggers, ";");
      });

      describe("Valid Word Boundaries - Should Match", () => {
        const validBoundaryTests = [
          { trigger: "ty", input: "ty", description: "at end of input" },
          { trigger: "ty", input: "ty ", description: "followed by space" },
          { trigger: "ty", input: "ty.", description: "followed by period" },
          {
            trigger: "ty",
            input: "ty!",
            description: "followed by exclamation",
          },
          {
            trigger: "ty",
            input: "ty?",
            description: "followed by question mark",
          },
          { trigger: "ty", input: "ty,", description: "followed by comma" },
          { trigger: "ty", input: "ty:", description: "followed by colon" },
          {
            trigger: "ty",
            input: "ty(",
            description: "followed by opening paren",
          },
          {
            trigger: "ty",
            input: "ty)",
            description: "followed by closing paren",
          },
          {
            trigger: "ty",
            input: "ty[",
            description: "followed by opening bracket",
          },
          {
            trigger: "ty",
            input: "ty]",
            description: "followed by closing bracket",
          },
          { trigger: "ty", input: "ty\n", description: "followed by newline" },
          { trigger: "ty", input: "ty\t", description: "followed by tab" },
          {
            trigger: "ty",
            input: "hello ty",
            description: "with proper start boundary",
          },
          {
            trigger: "ty",
            input: "hello ty world",
            description: "with proper boundaries on both sides",
          },
          { trigger: "ty", input: " ty ", description: "surrounded by spaces" },

          // Test other triggers
          {
            trigger: "wub",
            input: "wub ",
            description: "wub followed by space",
          },
          {
            trigger: "punt",
            input: "punt.",
            description: "punt followed by period",
          },
          {
            trigger: "test",
            input: "test!",
            description: "test followed by exclamation",
          },
          {
            trigger: "go",
            input: "let's go",
            description: "go with proper boundary",
          },
          {
            trigger: "run",
            input: "please run fast",
            description: "run with proper boundary",
          },
        ];

        validBoundaryTests.forEach(({ trigger, input, description }) => {
          test(`should match '${trigger}' in '${input}' (${description})`, () => {
            const result = liveDetector.processInput(input);
            expect(result.isMatch).toBe(true);
            expect(result.trigger).toBe(trigger);
          });
        });
      });

      describe("Invalid Word Boundaries - Should NOT Match", () => {
        const invalidBoundaryTests = [
          // Critical bug cases
          {
            trigger: "wub",
            input: "Wubbalubba",
            description: "wub in Wubbalubba (reported bug)",
          },
          {
            trigger: "punt",
            input: "punting",
            description: "punt in punting (reported bug)",
          },

          // Systematic boundary violations
          {
            trigger: "ty",
            input: "typo",
            description: "ty followed by alphanumeric",
          },
          {
            trigger: "ty",
            input: "city",
            description: "ty preceded by alphanumeric",
          },
          {
            trigger: "ty",
            input: "twenty",
            description: "ty in middle of word",
          },
          {
            trigger: "ty",
            input: "qty",
            description: "ty at end but preceded by alphanumeric",
          },
          {
            trigger: "ty",
            input: "ty123",
            description: "ty followed by numbers",
          },
          {
            trigger: "ty",
            input: "123ty",
            description: "ty preceded by numbers",
          },
          {
            trigger: "ty",
            input: "ty_word",
            description: "ty followed by underscore",
          },
          {
            trigger: "ty",
            input: "my_ty",
            description: "ty preceded by underscore",
          },
          {
            trigger: "ty",
            input: "atyb",
            description: "ty surrounded by alphanumeric",
          },

          // Other trigger boundary violations
          { trigger: "test", input: "testing", description: "test in testing" },
          { trigger: "test", input: "contest", description: "test in contest" },
          {
            trigger: "test",
            input: "test123",
            description: "test followed by numbers",
          },
          {
            trigger: "test",
            input: "123test",
            description: "test preceded by numbers",
          },
          { trigger: "go", input: "going", description: "go in going" },
          { trigger: "go", input: "ago", description: "go in ago" },
          { trigger: "run", input: "running", description: "run in running" },
          { trigger: "run", input: "grunt", description: "run in grunt" },
          { trigger: "wub", input: "wubba", description: "wub in wubba" },
          { trigger: "wub", input: "subwub", description: "wub after sub" },
        ];

        invalidBoundaryTests.forEach(({ trigger, input, description }) => {
          test(`should NOT match '${trigger}' in '${input}' (${description})`, () => {
            const result = liveDetector.processInput(input);
            // Should either not match at all, or match a different trigger
            if (result.isMatch) {
              expect(result.trigger).not.toBe(trigger);
            } else {
              expect(result.isMatch).toBe(false);
            }
          });
        });
      });

      describe("Complex Trigger Boundaries", () => {
        test("should handle 'gg!' properly - match only when bounded", () => {
          const result1 = liveDetector.processInput("gg! ");
          expect(result1.isMatch).toBe(true);
          expect(result1.trigger).toBe("gg!");

          const result2 = liveDetector.processInput("gg!!");
          expect(result2.isMatch).toBe(false);

          const result3 = liveDetector.processInput("gg!world");
          expect(result3.isMatch).toBe(false);
        });

        test("should handle ':smile:' properly - match only when bounded", () => {
          const result1 = liveDetector.processInput(":smile: ");
          expect(result1.isMatch).toBe(true);
          expect(result1.trigger).toBe(":smile:");

          const result2 = liveDetector.processInput(":smile:face");
          expect(result2.isMatch).toBe(false);
        });
      });
    });

    describe("Position-Specific Testing", () => {
      describe("Triggers at Start of Input", () => {
        test("should match 'ty' non-prefixed at start", () => {
          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: "ty", content: "Thank you!" }],
            ";",
          );
          const result = nonPrefixedDetector.processInput("ty");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("ty");
        });

        test("should match '/gb' slash-prefixed at start", () => {
          const slashDetector = new EnhancedTriggerDetector(
            [{ trigger: "/gb", content: "Goodbye! Have a great day!" }],
            "/",
          );
          const result = slashDetector.processInput("/gb");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("/gb");
        });

        test("should match ';gm' semicolon-prefixed at start", () => {
          const semicolonDetector = new EnhancedTriggerDetector(
            [{ trigger: ";gm", content: "Good morning! ☀️" }],
            ";",
          );
          const result = semicolonDetector.processInput(";gm");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(";gm");
        });
      });

      describe("Triggers After Newline Variations", () => {
        test("should match 'ty' after LF newline", () => {
          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: "ty", content: "Thank you!" }],
            ";",
          );
          const result = nonPrefixedDetector.processInput("hello\nty");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("ty");
        });

        test("should match 'ty' after CRLF newline", () => {
          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: "ty", content: "Thank you!" }],
            ";",
          );
          const result = nonPrefixedDetector.processInput("hello\r\nty");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("ty");
        });

        test("should match 'ty' after CR newline", () => {
          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: "ty", content: "Thank you!" }],
            ";",
          );
          const result = nonPrefixedDetector.processInput("hello\rty");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("ty");
        });

        test("should match '/gb' slash-prefixed after LF", () => {
          const slashDetector = new EnhancedTriggerDetector(
            [{ trigger: "/gb", content: "Goodbye! Have a great day!" }],
            "/",
          );
          const result = slashDetector.processInput("text\n/gb ");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("/gb");
        });

        test("should match ';gm' semicolon-prefixed after CRLF", () => {
          const semicolonDetector = new EnhancedTriggerDetector(
            [{ trigger: ";gm", content: "Good morning! ☀️" }],
            ";",
          );
          const result = semicolonDetector.processInput("text\r\n;gm ");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(";gm");
        });
      });

      describe("Triggers After Delimiters", () => {
        let delimiterDetector: EnhancedTriggerDetector;

        beforeEach(() => {
          delimiterDetector = new EnhancedTriggerDetector(
            [{ trigger: "ty", content: "Thank you!" }],
            ";",
          );
        });

        const delimiterTests = [
          { input: "word ty", delimiter: "space", description: "after space" },
          { input: "word\tty", delimiter: "tab", description: "after tab" },
          {
            input: "word.ty",
            delimiter: "period",
            description: "after period",
          },
          { input: "word,ty", delimiter: "comma", description: "after comma" },
          {
            input: "word!ty",
            delimiter: "exclamation",
            description: "after exclamation",
          },
          {
            input: "word?ty",
            delimiter: "question",
            description: "after question mark",
          },
          { input: "word:ty", delimiter: "colon", description: "after colon" },
          {
            input: "word;ty",
            delimiter: "semicolon",
            description: "after semicolon",
          },
          {
            input: "word(ty",
            delimiter: "open paren",
            description: "after opening paren",
          },
          {
            input: "word)ty",
            delimiter: "close paren",
            description: "after closing paren",
          },
          {
            input: "word[ty",
            delimiter: "open bracket",
            description: "after opening bracket",
          },
          {
            input: "word]ty",
            delimiter: "close bracket",
            description: "after closing bracket",
          },
        ];

        delimiterTests.forEach(({ input, delimiter, description }) => {
          test(`should match 'ty' ${description}`, () => {
            const result = delimiterDetector.processInput(input);
            expect(result.isMatch).toBe(true);
            expect(result.trigger).toBe("ty");
          });
        });
      });

      describe("Triggers in Mid-Sentence", () => {
        test("should match 'ty' - ty in middle of sentence", () => {
          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: "ty", content: "Thank you!" }],
            ";",
          );
          const result = nonPrefixedDetector.processInput(
            "Please ty for your help",
          );
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("ty");
        });

        test("should match '/help' - slash-prefixed in sentence", () => {
          const slashDetector = new EnhancedTriggerDetector(
            [{ trigger: "/help", content: "How can I help you today?" }],
            "/",
          );
          const result = slashDetector.processInput(
            "Could you /help me with this?",
          );
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("/help");
        });

        test("should match ';gm' - semicolon-prefixed in sentence", () => {
          const semicolonDetector = new EnhancedTriggerDetector(
            [{ trigger: ";gm", content: "Good morning! ☀️" }],
            ";",
          );
          const result = semicolonDetector.processInput(
            "Just wanted to say ;gm everyone",
          );
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(";gm");
        });
      });
    });

    describe("Multi-line Content Testing", () => {
      test("should handle HTML trigger with proper formatting", () => {
        const semicolonDetector = new EnhancedTriggerDetector(
          [
            {
              trigger: ";html5",
              content:
                '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Document</title></head><body></body></html>',
            },
          ],
          ";",
        );
        const result = semicolonDetector.processInput(";html5 ");
        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe(";html5");
        expect(result.content).toContain("<!DOCTYPE html>");
        expect(result.content).toContain('<html lang="en">');
      });

      test("should handle JSON trigger with proper structure", () => {
        const slashDetector = new EnhancedTriggerDetector(
          [{ trigger: "/json", content: '{"status":"ok"}' }],
          "/",
        );
        const result = slashDetector.processInput("/json ");
        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe("/json");
        expect(result.content).toBe('{"status":"ok"}');
      });

      test("should handle signature triggers with proper formatting", () => {
        const slashDetector = new EnhancedTriggerDetector(
          [
            { trigger: "/sig", content: "— Marvin C. Bentley II" },
            { trigger: "/sig2", content: "— Marv B." },
          ],
          "/",
        );

        const result1 = slashDetector.processInput("/sig ");
        expect(result1.isMatch).toBe(true);
        expect(result1.trigger).toBe("/sig");
        expect(result1.content).toBe("— Marvin C. Bentley II");

        const result2 = slashDetector.processInput("/sig2 ");
        expect(result2.isMatch).toBe(true);
        expect(result2.trigger).toBe("/sig2");
        expect(result2.content).toBe("— Marv B.");
      });
    });

    describe("Performance and Stress Testing", () => {
      test("should handle 50+ trigger dataset efficiently", () => {
        const slashDetector = new EnhancedTriggerDetector(
          liveTriggersDataset.filter((t) => t.type === "slash-prefixed"),
          "/",
        );
        const startTime = performance.now();
        const result = slashDetector.processInput("/gb ");
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe("/gb");
        expect(duration).toBeLessThan(20); // Should be fast even with many triggers
      });

      test("should handle mixed input with multiple potential triggers", () => {
        const slashDetector = new EnhancedTriggerDetector(
          liveTriggersDataset.filter((t) => t.type === "slash-prefixed"),
          "/",
        );
        const complexInput = "Hello /gb and /help for assistance";
        const startTime = performance.now();
        const result = slashDetector.processInput(complexInput);
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(result.isMatch).toBe(true);
        expect(duration).toBeLessThan(25); // Should handle complex input efficiently
      });

      test("should handle long input with triggers efficiently", () => {
        const nonPrefixedDetector = new EnhancedTriggerDetector(
          liveTriggersDataset.filter((t) => t.type === "non-prefixed"),
          ";",
        );
        const longInput = "a".repeat(500) + " ty " + "b".repeat(500);
        const startTime = performance.now();
        const result = nonPrefixedDetector.processInput(longInput);
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe("ty");
        expect(duration).toBeLessThan(50); // Should handle long input efficiently
      });

      test("should maintain performance with boundary checking", () => {
        const boundaryDetector = new EnhancedTriggerDetector(
          [
            { trigger: "ty", content: "Thank you!" },
            { trigger: "test", content: "Test content" },
            { trigger: "go", content: "Let's go!" },
            { trigger: "run", content: "Running fast!" },
          ],
          ";",
        );

        const testCases = [
          "typo",
          "city",
          "twenty",
          "testing",
          "contest",
          "going",
          "ago",
          "running",
          "grunt",
        ];

        const startTime = performance.now();
        testCases.forEach((input) => {
          boundaryDetector.processInput(input);
        });
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(50); // Should handle boundary checking efficiently
      });
    });

    describe("Integration and Real-World Scenarios", () => {
      describe("Mixed Trigger Type Testing", () => {
        test("should handle prefixed and non-prefixed triggers in same input", () => {
          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: "ty", content: "Thank you!" }],
            ";",
          );
          const result1 = nonPrefixedDetector.processInput("Please help me ty");
          expect(result1.isMatch).toBe(true);
          expect(result1.trigger).toBe("ty"); // Should find the non-prefixed trigger

          const slashDetector = new EnhancedTriggerDetector(
            [{ trigger: "/help", content: "How can I help you today?" }],
            "/",
          );
          const result2 = slashDetector.processInput("ty for /help");
          expect(result2.isMatch).toBe(true);
          expect(result2.trigger).toBe("/help");
        });

        test("should handle overlapping patterns correctly", () => {
          // Test cases where triggers share prefixes or could conflict
          const semicolonDetector = new EnhancedTriggerDetector(
            [
              { trigger: ";g", content: "G" },
              { trigger: ";gm", content: "Good morning! ☀️" },
            ],
            ";",
          );

          const result1 = semicolonDetector.processInput(";g ");
          expect(result1.isMatch).toBe(true);
          expect(result1.trigger).toBe(";g");

          const result2 = semicolonDetector.processInput(";gm ");
          expect(result2.isMatch).toBe(true);
          expect(result2.trigger).toBe(";gm");
        });

        test("should handle priority correctly with multiple matches", () => {
          // When multiple triggers could match, should pick the most recent/complete one
          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: "ty", content: "Thank you!" }],
            ";",
          );
          const result = nonPrefixedDetector.processInput("ty and more text");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("ty");
        });
      });

      describe("Edge Case Validation", () => {
        test("should handle Unicode content properly", () => {
          const semicolonDetector = new EnhancedTriggerDetector(
            [{ trigger: ";emoji", content: "😺💻✨" }],
            ";",
          );
          const result1 = semicolonDetector.processInput(";emoji ");
          expect(result1.isMatch).toBe(true);
          expect(result1.trigger).toBe(";emoji");
          expect(result1.content).toBe("😺💻✨");

          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: ":smile:", content: "😊" }],
            ";",
          );
          const result2 = nonPrefixedDetector.processInput(":smile: ");
          expect(result2.isMatch).toBe(true);
          expect(result2.trigger).toBe(":smile:");
          expect(result2.content).toBe("😊");
        });

        test("should handle variable placeholders", () => {
          const slashDetector = new EnhancedTriggerDetector(
            [{ trigger: "/date", content: "{{date:YYYY-MM-DD}}" }],
            "/",
          );
          const result1 = slashDetector.processInput("/date ");
          expect(result1.isMatch).toBe(true);
          expect(result1.trigger).toBe("/date");
          expect(result1.content).toBe("{{date:YYYY-MM-DD}}");

          const semicolonDetector = new EnhancedTriggerDetector(
            [{ trigger: ";time", content: "{{time:HH:mm}}" }],
            ";",
          );
          const result2 = semicolonDetector.processInput(";time ");
          expect(result2.isMatch).toBe(true);
          expect(result2.trigger).toBe(";time");
          expect(result2.content).toBe("{{time:HH:mm}}");
        });

        test("should handle URL and email patterns", () => {
          const slashDetector = new EnhancedTriggerDetector(
            [{ trigger: "/email", content: "mbentley@windhamcentral.org" }],
            "/",
          );
          const result1 = slashDetector.processInput("/email ");
          expect(result1.isMatch).toBe(true);
          expect(result1.trigger).toBe("/email");
          expect(result1.content).toBe("mbentley@windhamcentral.org");

          const semicolonDetector = new EnhancedTriggerDetector(
            [
              {
                trigger: ";zoom",
                content: "Here's the Zoom link: https://zoom.us/j/123456789",
              },
            ],
            ";",
          );
          const result2 = semicolonDetector.processInput(";zoom ");
          expect(result2.isMatch).toBe(true);
          expect(result2.trigger).toBe(";zoom");
          expect(result2.content).toContain("https://zoom.us/j/");
        });

        test("should handle code snippets properly", () => {
          const semicolonDetector = new EnhancedTriggerDetector(
            [{ trigger: ";code", content: 'print("Hello, world!")' }],
            ";",
          );
          const result = semicolonDetector.processInput(";code ");
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe(";code");
          expect(result.content).toBe('print("Hello, world!")');
        });

        test("should handle complex punctuation patterns", () => {
          const slashDetector = new EnhancedTriggerDetector(
            [{ trigger: "/eta?", content: "Any update on the ETA?" }],
            "/",
          );
          const result1 = slashDetector.processInput("/eta? ");
          expect(result1.isMatch).toBe(true);
          expect(result1.trigger).toBe("/eta?");

          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: "gg!", content: "Good game! Well played!" }],
            ";",
          );
          const result2 = nonPrefixedDetector.processInput("gg! ");
          expect(result2.isMatch).toBe(true);
          expect(result2.trigger).toBe("gg!");
        });
      });

      describe("Real-World Usage Patterns", () => {
        test("should handle common typing patterns", () => {
          // Simulate real typing scenarios
          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [{ trigger: "ty", content: "Thank you!" }],
            ";",
          );

          const typingSequence = [
            "ty", // Should match at end
            "ty ", // Should match with space
            "ty for", // Should match ty, ignore 'for'
            "Please ty", // Should match ty at end
          ];

          typingSequence.forEach((input) => {
            const result = nonPrefixedDetector.processInput(input);
            expect(result.isMatch).toBe(true);
            expect(result.trigger).toBe("ty");
          });
        });

        test("should handle email and signature workflows", () => {
          const slashDetector = new EnhancedTriggerDetector(
            [
              { trigger: "/sig", content: "— Marvin C. Bentley II" },
              { trigger: "/email", content: "mbentley@windhamcentral.org" },
            ],
            "/",
          );
          const semicolonDetector = new EnhancedTriggerDetector(
            [
              { trigger: ";phone", content: "(802) 555-0123" },
              {
                trigger: ";addr",
                content: "907 Newfane Rd, Wardsboro VT 05355",
              },
            ],
            ";",
          );

          const result1 = slashDetector.processInput("/sig ");
          expect(result1.isMatch).toBe(true);
          expect(result1.content).toBeTruthy();

          const result2 = slashDetector.processInput("/email ");
          expect(result2.isMatch).toBe(true);
          expect(result2.content).toBeTruthy();

          const result3 = semicolonDetector.processInput(";phone ");
          expect(result3.isMatch).toBe(true);
          expect(result3.content).toBeTruthy();

          const result4 = semicolonDetector.processInput(";addr ");
          expect(result4.isMatch).toBe(true);
          expect(result4.content).toBeTruthy();
        });

        test("should handle chat and messaging patterns", () => {
          const semicolonDetector = new EnhancedTriggerDetector(
            [
              { trigger: ";brb", content: "Be right back—just a sec!" },
              { trigger: ";afk", content: "Away from keyboard—back soon!" },
              { trigger: ";gtg", content: "Gotta go—catch you later!" },
              { trigger: ";np", content: "No problem at all!" },
            ],
            ";",
          );
          const nonPrefixedDetector = new EnhancedTriggerDetector(
            [
              { trigger: "ty", content: "Thank you!" },
              { trigger: "gg!", content: "Good game! Well played!" },
            ],
            ";",
          );

          const result1 = semicolonDetector.processInput(";brb ");
          expect(result1.isMatch).toBe(true);
          expect(result1.content).toBeTruthy();

          const result2 = nonPrefixedDetector.processInput("ty ");
          expect(result2.isMatch).toBe(true);
          expect(result2.content).toBeTruthy();

          const result3 = nonPrefixedDetector.processInput("gg! ");
          expect(result3.isMatch).toBe(true);
          expect(result3.content).toBeTruthy();
        });
      });
    });

    describe("Regression and Compatibility Testing", () => {
      test("should maintain compatibility with existing test snippets", () => {
        // Test that original testSnippets still work
        const originalDetector = new EnhancedTriggerDetector(testSnippets);

        const result1 = originalDetector.processInput(";hello ");
        expect(result1.isMatch).toBe(true);
        expect(result1.trigger).toBe(";hello");

        const result2 = originalDetector.processInput("punt ");
        expect(result2.isMatch).toBe(true);
        expect(result2.trigger).toBe("punt");
      });

      test("should handle different newline types consistently", () => {
        const nonPrefixedDetector = new EnhancedTriggerDetector(
          [{ trigger: "ty", content: "Thank you!" }],
          ";",
        );

        const newlineTypes = [
          { input: "text\nty", type: "LF" },
          { input: "text\rty", type: "CR" },
          { input: "text\r\nty", type: "CRLF" },
        ];

        newlineTypes.forEach(({ input, type }) => {
          const result = nonPrefixedDetector.processInput(input);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("ty");
        });
      });

      test("should handle Unicode consistently", () => {
        const nonPrefixedDetector = new EnhancedTriggerDetector(
          [{ trigger: "ty", content: "Thank you!" }],
          ";",
        );

        const unicodeInputs = [
          "héllo ty", // Accented characters
          "🚀 ty", // Emoji
          "测试 ty", // Chinese characters
          "🌟ty🌟", // Emoji boundaries
        ];

        unicodeInputs.forEach((input) => {
          const result = nonPrefixedDetector.processInput(input);
          expect(result.isMatch).toBe(true);
          expect(result.trigger).toBe("ty");
        });
      });

      test("should maintain performance benchmarks", () => {
        const slashDetector = new EnhancedTriggerDetector(
          [{ trigger: "/gb", content: "Goodbye! Have a great day!" }],
          "/",
        );
        const nonPrefixedDetector = new EnhancedTriggerDetector(
          [{ trigger: "ty", content: "Thank you!" }],
          ";",
        );
        const semicolonDetector = new EnhancedTriggerDetector(
          [{ trigger: ";gm", content: "Good morning! ☀️" }],
          ";",
        );

        const benchmarkTests = [
          { detector: slashDetector, input: "/gb ", expectedTime: 15 },
          { detector: nonPrefixedDetector, input: "ty ", expectedTime: 15 },
          { detector: semicolonDetector, input: ";gm ", expectedTime: 15 },
          {
            detector: nonPrefixedDetector,
            input: "a".repeat(100) + " ty ",
            expectedTime: 25,
          },
        ];

        benchmarkTests.forEach(({ detector, input, expectedTime }) => {
          const startTime = performance.now();
          const result = detector.processInput(input);
          const endTime = performance.now();
          const duration = endTime - startTime;

          expect(result.isMatch).toBe(true);
          expect(duration).toBeLessThan(expectedTime);
        });
      });
    });
  });
});
