/**
 * Unit tests for trigger detection system
 * Following TDD approach - tests written first to define expected behavior
 */

import {
  TriggerDetector,
  TriggerState,
} from "../../src/content/trigger-detector";

describe("TriggerDetector", () => {
  let detector: TriggerDetector;

  beforeEach(() => {
    const snippets = [
      { trigger: ";gb", content: "Goodbye!" },
      { trigger: ";hello", content: "Hello World!" },
      { trigger: ";addr", content: "123 Main St" },
      { trigger: ";ad", content: "Advertisement" },
      { trigger: ";email", content: "user@example.com" },
      { trigger: ";long-trigger-name", content: "Long trigger content" },
    ];
    detector = new TriggerDetector(snippets);
  });

  describe("Construction and Configuration", () => {
    test("should create detector with default prefix", () => {
      expect(detector.getPrefix()).toBe(";");
    });

    test("should create detector with custom prefix", () => {
      const customDetector = new TriggerDetector([], "/");
      expect(customDetector.getPrefix()).toBe("/");
    });

    test("should load snippets into internal trie", () => {
      expect(detector.getLoadedSnippetsCount()).toBe(6);
    });
  });

  describe("Basic Trigger Detection", () => {
    test("should detect simple trigger", () => {
      const result = detector.processInput(";gb ");

      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(";gb");
      expect(result.content).toBe("Goodbye!");
      expect(result.matchEnd).toBe(3);
    });

    test("should not match incomplete trigger", () => {
      const result = detector.processInput(";g");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.TYPING);
    });

    test("should handle trigger without delimiter", () => {
      const result = detector.processInput(";gb");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.COMPLETE);
      expect(result.potentialTrigger).toBe(";gb");
    });

    test("should match trigger with space delimiter", () => {
      const result = detector.processInput(";hello ");

      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(";hello");
    });

    test("should match trigger with punctuation delimiter", () => {
      const result = detector.processInput(";email.");

      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(";email");
      expect(result.matchEnd).toBe(6);
    });
  });

  describe("Overlapping Triggers", () => {
    test("should handle overlapping triggers correctly", () => {
      // First test shorter trigger
      const result1 = detector.processInput(";ad ");
      expect(result1.isMatch).toBe(true);
      expect(result1.trigger).toBe(";ad");

      // Then test longer trigger
      const result2 = detector.processInput(";addr ");
      expect(result2.isMatch).toBe(true);
      expect(result2.trigger).toBe(";addr");
    });

    test("should detect potential ambiguous triggers", () => {
      const result = detector.processInput(";ad");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.AMBIGUOUS);
      expect(result.potentialTrigger).toBe(";ad");
      expect(result.possibleCompletions).toContain(";addr");
    });

    test("REGRESSION: should NOT trigger cycling UI for partial triggers", () => {
      // This is the critical bug that was fixed:
      // Partial triggers should never return AMBIGUOUS state
      // Only complete triggers with longer alternatives should be AMBIGUOUS

      // Test with triggers that would have caused the bug: ";gb" and ";gballs"
      const buggyDetector = new TriggerDetector([
        { trigger: ";gb", content: "Goodbye!" },
        { trigger: ";gballs", content: "Golf balls" },
      ]);

      // Typing ";g" should be TYPING, not AMBIGUOUS
      const partialResult = buggyDetector.processInput(";g");
      expect(partialResult.isMatch).toBe(false);
      expect(partialResult.state).toBe(TriggerState.TYPING);
      expect(partialResult.potentialTrigger).toBe(";g");

      // Typing ";gb" should be AMBIGUOUS (complete trigger with longer alternative)
      const completeResult = buggyDetector.processInput(";gb");
      expect(completeResult.isMatch).toBe(false);
      expect(completeResult.state).toBe(TriggerState.AMBIGUOUS);
      expect(completeResult.potentialTrigger).toBe(";gb");
      expect(completeResult.possibleCompletions).toContain(";gballs");

      // Typing ";gba" should be TYPING, not AMBIGUOUS
      const partialLongerResult = buggyDetector.processInput(";gba");
      expect(partialLongerResult.isMatch).toBe(false);
      expect(partialLongerResult.state).toBe(TriggerState.TYPING);
      expect(partialLongerResult.potentialTrigger).toBe(";gba");
    });
  });

  describe("Invalid Input Handling", () => {
    test("should handle empty input", () => {
      const result = detector.processInput("");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });

    test("should handle input without prefix", () => {
      const result = detector.processInput("hello world");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.IDLE);
    });

    test("should handle unknown trigger", () => {
      const result = detector.processInput(";unknown ");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.NO_MATCH);
    });

    test("should handle invalid characters in trigger", () => {
      const result = detector.processInput(";test@#$ ");

      expect(result.isMatch).toBe(false);
      expect(result.state).toBe(TriggerState.NO_MATCH);
    });
  });

  describe("Context Awareness", () => {
    test("should detect trigger at beginning of text", () => {
      const result = detector.processInput(";gb ");
      expect(result.isMatch).toBe(true);
    });

    test("should detect trigger after whitespace", () => {
      const result = detector.processInputWithContext("Hello ;gb ", 6);
      expect(result.isMatch).toBe(true);
      expect(result.trigger).toBe(";gb");
    });

    test("should not detect trigger in middle of word", () => {
      const result = detector.processInputWithContext("test;gb ", 0);
      expect(result.isMatch).toBe(false);
    });

    test("should handle multiple triggers in sequence", () => {
      // This tests the stateless nature of detection
      const result1 = detector.processInput(";gb ");
      const result2 = detector.processInput(";hello ");

      expect(result1.isMatch).toBe(true);
      expect(result2.isMatch).toBe(true);
    });
  });

  describe("Performance Considerations", () => {
    test("should handle long input efficiently", () => {
      const longInput = "a".repeat(1000) + " ;gb ";
      const start = performance.now();
      const result = detector.processInputWithContext(
        longInput,
        longInput.length - 5,
      );
      const end = performance.now();

      expect(result.isMatch).toBe(true);
      expect(end - start).toBeLessThan(10); // Should be very fast
    });

    test("should handle many snippets efficiently", () => {
      const manySnippets = Array.from({ length: 1000 }, (_, i) => ({
        trigger: `;snippet${i}`,
        content: `Content ${i}`,
      }));

      const bigDetector = new TriggerDetector(manySnippets);
      const start = performance.now();
      const result = bigDetector.processInput(";snippet500 ");
      const end = performance.now();

      expect(result.isMatch).toBe(true);
      expect(end - start).toBeLessThan(50); // Should still be reasonably fast
    });
  });

  describe("State Management", () => {
    test("should reset state properly", () => {
      detector.processInput(";g");
      detector.reset();

      const result = detector.getCurrentState();
      expect(result.state).toBe(TriggerState.IDLE);
    });

    test("should maintain state between partial inputs", () => {
      const result1 = detector.processInput(";h");
      expect(result1.state).toBe(TriggerState.TYPING);

      const result2 = detector.processInput(";he");
      expect(result2.state).toBe(TriggerState.TYPING);

      const result3 = detector.processInput(";hello ");
      expect(result3.isMatch).toBe(true);
    });
  });

  describe("Delimiter Handling", () => {
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

    delimiters.forEach((delimiter) => {
      test(`should recognize ${delimiter === " " ? "space" : delimiter === "\t" ? "tab" : delimiter === "\n" ? "newline" : delimiter} as delimiter`, () => {
        const result = detector.processInput(`;gb${delimiter}`);
        expect(result.isMatch).toBe(true);
      });
    });

    test("should not treat alphanumeric as delimiter", () => {
      const result = detector.processInput(";gba");
      expect(result.isMatch).toBe(false);
    });
  });

  describe("Update Functionality", () => {
    test("should update snippets dynamically", () => {
      const newSnippets = [
        { trigger: ";new", content: "New snippet" },
        { trigger: ";updated", content: "Updated content" },
      ];

      detector.updateSnippets(newSnippets);

      const result = detector.processInput(";new ");
      expect(result.isMatch).toBe(true);
      expect(result.content).toBe("New snippet");

      // Old snippets should no longer work
      const oldResult = detector.processInput(";gb ");
      expect(oldResult.isMatch).toBe(false);
    });
  });
});
