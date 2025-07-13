/**
 * Debug test for punt trigger detection
 */

import {
  EnhancedTriggerDetector,
  TriggerState,
} from "../../src/content/enhanced-trigger-detector.js";

describe("Debug Punt Trigger", () => {
  let detector: EnhancedTriggerDetector;

  const testSnippets = [
    { trigger: ";eata", content: "Bag of Dicks!!" },
    { trigger: "punt", content: "PUNT! LETS GOOOOOO!!!!" },
    { trigger: ";pony", content: "Peanut **BUTTER** Pony Time!" },
  ];

  beforeEach(() => {
    detector = new EnhancedTriggerDetector(testSnippets);
  });

  test("should debug punt trigger detection", () => {
    console.log("🔍 Testing various punt inputs:");

    const testCases = [
      "punt",
      "punt ",
      "punt!",
      "punt.",
      "hello punt",
      "hello punt ",
      "hello punt!",
      ";punt",
      ";punt ",
    ];

    testCases.forEach((input) => {
      const result = detector.processInput(input);
      console.log(
        `Input: "${input}" -> Match: ${result.isMatch}, State: ${result.state}, Trigger: ${result.trigger || "none"}`,
      );

      // We expect 'punt' and 'punt ' to match
      if (input === "punt" || input === "punt ") {
        expect(result.isMatch).toBe(true);
        expect(result.trigger).toBe("punt");
      }
    });
  });
});
