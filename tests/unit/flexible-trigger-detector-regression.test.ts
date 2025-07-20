/**
 * Regression tests for FlexibleTriggerDetector
 * Specifically testing the critical bug fix for trigger cycling UI
 */

import {
  FlexibleTriggerDetector,
  TriggerState,
} from "../../src/content/flexible-trigger-detector";

describe("FlexibleTriggerDetector - Regression Tests", () => {
  test("CRITICAL REGRESSION: should NOT trigger cycling UI for partial triggers", () => {
    // This is the critical bug that was fixed:
    // Partial triggers should never return AMBIGUOUS state
    // Only complete triggers with longer alternatives should be AMBIGUOUS

    const detector = new FlexibleTriggerDetector([
      { trigger: "gb", content: "Goodbye!" },
      { trigger: "gballs", content: "Golf balls" },
      { trigger: "goodbye", content: "Farewell!" },
    ]);

    // Typing "g" should be TYPING, not AMBIGUOUS (partial trigger)
    const partialResult = detector.processInput("g");
    expect(partialResult.isMatch).toBe(false);
    expect(partialResult.state).toBe(TriggerState.TYPING);
    expect(partialResult.potentialTrigger).toBe("g");

    // Typing "gb" should be AMBIGUOUS (complete trigger with longer alternative)
    const completeResult = detector.processInput("gb");
    expect(completeResult.isMatch).toBe(false);
    expect(completeResult.state).toBe(TriggerState.AMBIGUOUS);
    expect(completeResult.potentialTrigger).toBe("gb");
    expect(completeResult.possibleCompletions).toContain("gballs");

    // Typing "gba" should be TYPING, not AMBIGUOUS (partial trigger)
    const partialLongerResult = detector.processInput("gba");
    expect(partialLongerResult.isMatch).toBe(false);
    expect(partialLongerResult.state).toBe(TriggerState.TYPING);
    expect(partialLongerResult.potentialTrigger).toBe("gba");

    // Typing "goodbye" with no longer alternatives should be COMPLETE
    const completeNoAlternatives = detector.processInput("goodbye");
    expect(completeNoAlternatives.isMatch).toBe(false);
    expect(completeNoAlternatives.state).toBe(TriggerState.COMPLETE);
    expect(completeNoAlternatives.potentialTrigger).toBe("goodbye");

    // Typing "goodbye " with space should be an exact match
    const exactMatch = detector.processInput("goodbye ");
    expect(exactMatch.isMatch).toBe(true);
    expect(exactMatch.state).toBe(TriggerState.COMPLETE);
    expect(exactMatch.trigger).toBe("goodbye");
  });

  test("should handle multiple overlapping triggers correctly", () => {
    const detector = new FlexibleTriggerDetector([
      { trigger: "a", content: "A" },
      { trigger: "ab", content: "AB" },
      { trigger: "abc", content: "ABC" },
      { trigger: "abcd", content: "ABCD" },
    ]);

    // Typing "a" should be AMBIGUOUS (complete with longer alternatives)
    const aResult = detector.processInput("a");
    expect(aResult.state).toBe(TriggerState.AMBIGUOUS);
    expect(aResult.possibleCompletions).toEqual(["a", "ab", "abc", "abcd"]);

    // Typing "ab" should be AMBIGUOUS (complete with longer alternatives)
    const abResult = detector.processInput("ab");
    expect(abResult.state).toBe(TriggerState.AMBIGUOUS);
    expect(abResult.possibleCompletions).toEqual(["ab", "abc", "abcd"]);

    // Typing "abc" should be AMBIGUOUS (complete with longer alternatives)
    const abcResult = detector.processInput("abc");
    expect(abcResult.state).toBe(TriggerState.AMBIGUOUS);
    expect(abcResult.possibleCompletions).toEqual(["abc", "abcd"]);

    // Typing "abcd" should be COMPLETE (no longer alternatives)
    const abcdResult = detector.processInput("abcd");
    expect(abcdResult.state).toBe(TriggerState.COMPLETE);

    // Typing "abcde" should be TYPING (partial, no matches)
    const abcdeResult = detector.processInput("abcde");
    expect(abcdeResult.state).toBe(TriggerState.IDLE);
  });
});
