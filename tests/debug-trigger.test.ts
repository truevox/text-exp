// Debug test to understand FlexibleTriggerDetector behavior

import { EnhancedTriggerDetector } from "../src/content/enhanced-trigger-detector";
import { TextReplacer } from "../src/content/text-replacer";
import { ImageProcessor } from "../src/background/image-processor";

describe("Debug FlexibleTriggerDetector", () => {
  test("should handle the E2E test case specifically", () => {
    const userSnippets = [
      {
        id: "1",
        trigger: "email",
        content: "john.doe@example.com",
      },
    ];

    console.log(
      "Creating FlexibleTriggerDetector with userSnippets:",
      userSnippets,
    );
    const detector = new EnhancedTriggerDetector(userSnippets);

    console.log('\nTesting processInput("email "):');
    const emailDetection = detector.processInput("email ");
    console.log("emailDetection result:", emailDetection);

    console.log("\nChecking properties:");
    console.log("- isMatch:", emailDetection.isMatch);
    console.log("- trigger:", emailDetection.trigger);
    console.log("- content:", emailDetection.content);

    expect(emailDetection.isMatch).toBe(true);
    expect(emailDetection.trigger).toBe("email");
    expect(emailDetection.content).toBe("john.doe@example.com");
  });

  test("should test TextReplacer with the same setup", () => {
    // Mock ImageProcessor
    const mockImageProcessor = {
      processImage: jest.fn(),
      getImageUrl: jest.fn(),
      uploadImage: jest.fn(),
    } as unknown as ImageProcessor;

    const textReplacer = new TextReplacer(mockImageProcessor);

    // Mock input field
    const emailField = {
      value: "Contact me at email if you have questions.",
      selectionStart: 17,
      selectionEnd: 17,
      focus: jest.fn(),
      setSelectionRange: jest.fn(),
      tagName: "INPUT",
      dispatchEvent: jest.fn(),
    };

    console.log("Original value:", emailField.value);
    console.log("Original value length:", emailField.value.length);

    // Log character positions
    for (let i = 0; i < emailField.value.length; i++) {
      if (i >= 12 && i <= 20) {
        console.log(`Position ${i}: '${emailField.value[i]}'`);
      }
    }

    const context = {
      element: emailField as any,
      startOffset: 14,
      endOffset: 19,
      trigger: "email",
      snippet: {
        id: "1",
        trigger: "email",
        content: "john.doe@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    console.log("Context:", context);
    console.log("Replacement text:", "john.doe@example.com");

    textReplacer.replaceText(context, "john.doe@example.com");

    console.log("New value:", emailField.value);
    console.log(
      "setSelectionRange calls:",
      emailField.setSelectionRange.mock.calls,
    );

    expect(emailField.value).toBe(
      "Contact me at john.doe@example.com if you have questions.",
    );
  });
});
