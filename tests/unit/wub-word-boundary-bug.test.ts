/**
 * Test to reproduce and verify fix for the "wub" word boundary detection bug
 *
 * Issue: "wub" trigger incorrectly matches inside "Wubbalubba" text
 * Root Cause: Word boundary detection not properly validating end boundaries
 */

import {
  EnhancedTriggerDetector,
  TriggerState,
} from "../../src/content/enhanced-trigger-detector";

describe("Word Boundary Detection Bug - 'wub' inside 'Wubbalubba'", () => {
  let detector: EnhancedTriggerDetector;

  beforeEach(() => {
    const testSnippets = [
      { trigger: "wub", content: "WUB EXPANSION!" },
      { trigger: ";hello", content: "Hello World!" },
      { trigger: "punt", content: "PUNT! LETS GOOOOOO!!!!" },
    ];
    detector = new EnhancedTriggerDetector(testSnippets);
  });

  describe("Cases that should NOT match 'wub' trigger", () => {
    const shouldNotMatch = [
      {
        input: "Wubbalubba",
        description: "wub inside Wubbalubba - CRITICAL BUG",
      },
      {
        input: "Wubbalubba Dub Dub!!!",
        description: "Full text from user logs",
      },
      {
        input: "wubba",
        description: "wub at start but followed by alphanumeric",
      },
      {
        input: "subwub",
        description: "wub at end but preceded by alphanumeric",
      },
      { input: "somewubtext", description: "wub in middle of word" },
      { input: "awubz", description: "wub surrounded by alphanumeric" },
    ];

    shouldNotMatch.forEach(({ input, description }) => {
      test(`should NOT match "wub" in "${input}" (${description})`, () => {
        const result = detector.processInput(input);

        expect(result.isMatch).toBe(false);
        expect(result.trigger).not.toBe("wub");

        // Log for debugging
        console.log(
          `❌ "${input}" -> Match: ${result.isMatch}, State: ${result.state}, Trigger: ${result.trigger || "none"}`,
        );
      });
    });
  });

  describe("Cases that SHOULD match 'wub' trigger", () => {
    const shouldMatch = [
      { input: "wub", description: "End of input" },
      { input: "wub ", description: "Followed by space" },
      { input: "wub!", description: "Followed by exclamation" },
      { input: "wub.", description: "Followed by period" },
      { input: "wub,", description: "Followed by comma" },
      { input: "hello wub", description: "Proper word boundaries at end" },
      {
        input: "test wub test",
        description: "Surrounded by proper boundaries",
      },
      { input: " wub ", description: "Surrounded by spaces" },
    ];

    shouldMatch.forEach(({ input, description }) => {
      test(`should match "wub" in "${input}" (${description})`, () => {
        const result = detector.processInput(input);

        expect(result.isMatch).toBe(true);
        expect(result.state).toBe(TriggerState.COMPLETE);
        expect(result.trigger).toBe("wub");
        expect(result.content).toBe("WUB EXPANSION!");

        // Log for debugging
        console.log(
          `✅ "${input}" -> Match: ${result.isMatch}, State: ${result.state}, Trigger: ${result.trigger}`,
        );
      });
    });
  });

  describe("Specific user-reported case", () => {
    test('should NOT match "wub" inside "Wubbalubba Dub Dub!!!" - CRITICAL BUG REPRODUCTION', () => {
      const input = "Wubbalubba Dub Dub!!!";
      const result = detector.processInput(input);

      // This is the exact scenario from user logs that was incorrectly matching
      expect(result.isMatch).toBe(false);
      expect(result.trigger).not.toBe("wub");

      console.log(`🔍 CRITICAL TEST: "${input}"`);
      console.log(
        `   Result: Match=${result.isMatch}, State=${result.state}, Trigger=${result.trigger || "none"}`,
      );
      console.log(
        `   Expected: Match=false (wub should NOT be found inside Wubbalubba)`,
      );
    });
  });
});
