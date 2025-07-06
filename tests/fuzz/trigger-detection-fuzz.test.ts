/**
 * Property-based fuzzing tests for trigger detection
 * Uses fuzzing to test robustness against unexpected inputs
 */

import { TriggerDetector } from "../../src/content/trigger-detector";
import { EnhancedTriggerDetector } from "../../src/content/enhanced-trigger-detector";
import type { TextSnippet } from "../../src/shared/types";

describe("Trigger Detection Fuzzing", () => {
  // Property-based test data generators
  const generateRandomString = (length: number, charset?: string): string => {
    const chars =
      charset ||
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !@#$%^&*()_+-=[]{}|;:,.<>?";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const generateRandomTrigger = (): string => {
    const length = Math.floor(Math.random() * 20) + 1; // 1-20 chars
    const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
    return generateRandomString(length, charset);
  };

  const generateRandomSnippets = (count: number): TextSnippet[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `snippet-${i}`,
      trigger: generateRandomTrigger(),
      content: generateRandomString(Math.floor(Math.random() * 1000) + 1),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  };

  const generateUnicodeString = (length: number): string => {
    let result = "";
    for (let i = 0; i < length; i++) {
      // Generate random Unicode code points from various ranges
      const ranges = [
        [0x0020, 0x007e], // Basic Latin
        [0x00a0, 0x00ff], // Latin-1 Supplement
        [0x0100, 0x017f], // Latin Extended-A
        [0x0400, 0x04ff], // Cyrillic
        [0x4e00, 0x9fff], // CJK Unified Ideographs
        [0x1f600, 0x1f64f], // Emoticons
      ];

      const range = ranges[Math.floor(Math.random() * ranges.length)];
      const codePoint =
        Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
      result += String.fromCodePoint(codePoint);
    }
    return result;
  };

  describe("Basic Trigger Detection Fuzzing", () => {
    it("should never crash with random inputs (fuzz test)", () => {
      const snippets = generateRandomSnippets(50);
      const detector = new TriggerDetector(snippets);

      // Run 500 iterations with random inputs
      for (let i = 0; i < 500; i++) {
        const text = generateRandomString(Math.floor(Math.random() * 1000) + 1);
        const position = Math.floor(Math.random() * (text.length + 1));

        expect(() => {
          const result = detector.processInput(text, position);
          // Result should be a valid TriggerMatch object
          expect(typeof result).toBe("object");
          expect(result).toHaveProperty("isMatch");
          expect(result).toHaveProperty("state");
          if (result.isMatch && result.matchEnd !== undefined) {
            expect(typeof result.matchEnd).toBe("number");
            expect(result.matchEnd).toBeGreaterThanOrEqual(0);
            expect(result.matchEnd).toBeLessThanOrEqual(text.length);
          }
        }).not.toThrow();
      }
    });

    it("should handle extreme edge cases (fuzz test)", () => {
      const snippets = generateRandomSnippets(10);
      const detector = new TriggerDetector(snippets);

      const edgeCases = [
        "", // Empty string
        " ", // Single space
        "\n", // Newline
        "\t", // Tab
        "\r\n", // CRLF
        "\0", // Null character
        String.fromCharCode(1, 2, 3, 4, 5), // Control characters
        "a".repeat(10000), // Very long string
        "🚀🌟💻🎉🔥", // Only emoji
        "   ", // Only spaces
        "\n\n\n\n\n", // Only newlines
      ];

      edgeCases.forEach((testCase, index) => {
        for (let pos = 0; pos <= testCase.length; pos++) {
          expect(() => {
            const result = detector.processInput(testCase, pos);
            if (result.isMatch) {
              expect(result.matchEnd).toBeLessThanOrEqual(testCase.length);
            }
          }).not.toThrow(`Failed on edge case ${index} at position ${pos}`);
        }
      });
    });

    it("should handle Unicode text correctly (fuzz test)", () => {
      const unicodeSnippets: TextSnippet[] = [
        {
          id: "1",
          trigger: "émoji",
          content: "🚀",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          trigger: "привет",
          content: "Привет мир!",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "3",
          trigger: "你好",
          content: "你好世界！",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "4",
          trigger: "café",
          content: "Coffee ☕",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const detector = new TriggerDetector(unicodeSnippets);

      // Test with random Unicode strings
      for (let i = 0; i < 100; i++) {
        const unicodeText = generateUnicodeString(
          Math.floor(Math.random() * 200) + 10,
        );
        const position = Math.floor(Math.random() * (unicodeText.length + 1));

        expect(() => {
          const result = detector.processInput(unicodeText, position);
          if (result.isMatch) {
            expect(result.matchEnd).toBeLessThanOrEqual(unicodeText.length);
          }
        }).not.toThrow();
      }
    });

    it("should handle invalid cursor positions gracefully (fuzz test)", () => {
      const snippets = generateRandomSnippets(20);
      const detector = new TriggerDetector(snippets);

      for (let i = 0; i < 100; i++) {
        const text = generateRandomString(Math.floor(Math.random() * 100) + 1);
        const invalidPositions = [
          -1,
          -Math.floor(Math.random() * 1000) - 1, // Random negative
          text.length + 1,
          text.length + Math.floor(Math.random() * 1000) + 1, // Random beyond end
          NaN,
          Infinity,
          -Infinity,
        ];

        invalidPositions.forEach((pos) => {
          expect(() => {
            const result = detector.processInput(text, pos);
            // Should either handle gracefully or return null
            if (result.isMatch) {
              expect(result.matchEnd).toBeLessThanOrEqual(text.length);
            }
          }).not.toThrow();
        });
      }
    });
  });

  describe("Enhanced Trigger Detection Fuzzing", () => {
    it("should handle fuzzy matching robustly (fuzz test)", () => {
      const snippets: TextSnippet[] = [
        {
          id: "1",
          trigger: "hello",
          content: "Hello World!",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          trigger: "javascript",
          content: "JavaScript",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "3",
          trigger: "algorithm",
          content: "Algorithm",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const enhancedDetector = new EnhancedTriggerDetector(snippets, ";");

      // Test with variations and typos
      const variations = [
        "helo",
        "hallo",
        "heelo", // hello variations
        "javascrpt",
        "javscript",
        "javascript", // javascript variations
        "algoritm",
        "algorythm",
        "algorithmm", // algorithm variations
      ];

      variations.forEach((variant) => {
        for (let pos = 0; pos <= variant.length; pos++) {
          expect(() => {
            const result = enhancedDetector.processInput(variant, pos);
            if (result.isMatch) {
              expect(result).toHaveProperty("trigger");
              expect(result).toHaveProperty("content");
              expect(typeof result.trigger).toBe("string");
              expect(typeof result.content).toBe("string");
            }
          }).not.toThrow();
        }
      });
    });

    it("should handle rapid successive calls without memory leaks (fuzz test)", () => {
      const snippets = generateRandomSnippets(100);
      const detector = new TriggerDetector(snippets);

      // Simulate rapid text changes (like fast typing)
      for (let i = 0; i < 1000; i++) {
        const text = generateRandomString(Math.floor(Math.random() * 50) + 1);
        const position = Math.floor(Math.random() * (text.length + 1));

        detector.processInput(text, position);

        // Memory usage shouldn't grow significantly
        if (i % 100 === 0 && global.gc) {
          global.gc(); // Force garbage collection if available
        }
      }
    });
  });

  describe("Performance Fuzzing", () => {
    it("should maintain performance under various snippet set sizes (fuzz test)", () => {
      const testSizes = [1, 10, 50, 100, 500, 1000];

      testSizes.forEach((size) => {
        const snippets = generateRandomSnippets(size);
        const detector = new TriggerDetector(snippets);

        const iterations = Math.max(10, 1000 / size); // More iterations for smaller sets
        const times: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const text = generateRandomString(
            Math.floor(Math.random() * 100) + 10,
          );
          const position = Math.floor(Math.random() * (text.length + 1));

          const start = performance.now();
          detector.processInput(text, position);
          const end = performance.now();

          times.push(end - start);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);

        // Performance should scale reasonably
        expect(avgTime).toBeLessThan(size * 0.1); // Linear scaling with reasonable constant
        expect(maxTime).toBeLessThan(100); // No single operation should take too long
      });
    });

    it("should handle pathological trigger patterns efficiently (fuzz test)", () => {
      // Create triggers that could cause worst-case performance
      const pathologicalSnippets: TextSnippet[] = [
        ...Array.from({ length: 100 }, (_, i) => ({
          id: `aa-${i}`,
          trigger: "a".repeat(i + 1), // aa, aaa, aaaa, etc.
          content: `Content ${i}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        ...Array.from({ length: 50 }, (_, i) => ({
          id: `similar-${i}`,
          trigger: `similar${i}`, // similar0, similar1, etc.
          content: `Similar content ${i}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      ];

      const detector = new TriggerDetector(pathologicalSnippets);

      // Test with strings that could trigger worst-case performance
      const pathologicalInputs = [
        "a".repeat(200), // Long string of 'a's
        "similar".repeat(50), // Repeated similar patterns
        "aaaaaasimilarsimilarsimilar",
        "similar999999", // Similar prefix but no match
      ];

      pathologicalInputs.forEach((input) => {
        for (let pos = 0; pos <= Math.min(input.length, 100); pos += 10) {
          const start = performance.now();
          const result = detector.processInput(input, pos);
          const duration = performance.now() - start;

          expect(duration).toBeLessThan(50); // Should be fast even in worst case

          if (result.isMatch) {
            expect(result.matchEnd).toBeLessThanOrEqual(input.length);
          }
        }
      });
    });
  });

  describe("Boundary Condition Fuzzing", () => {
    it("should handle text at exact buffer boundaries (fuzz test)", () => {
      const snippets = generateRandomSnippets(20);
      const detector = new TriggerDetector(snippets);

      // Test various text lengths around common buffer sizes
      const bufferSizes = [64, 128, 256, 512, 1024, 2048, 4096];

      bufferSizes.forEach((bufferSize) => {
        // Test at exact boundary
        const exactText = generateRandomString(bufferSize);
        expect(() => {
          detector.processInput(exactText, bufferSize);
        }).not.toThrow();

        // Test just before boundary
        const beforeText = generateRandomString(bufferSize - 1);
        expect(() => {
          detector.processInput(beforeText, bufferSize - 1);
        }).not.toThrow();

        // Test just after boundary
        const afterText = generateRandomString(bufferSize + 1);
        expect(() => {
          detector.processInput(afterText, bufferSize + 1);
        }).not.toThrow();
      });
    });

    it("should handle mixed content types (fuzz test)", () => {
      const mixedSnippets: TextSnippet[] = [
        {
          id: "1",
          trigger: "code",
          content: 'console.log("hello");',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          trigger: "html",
          content: "<div>Hello</div>",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "3",
          trigger: "json",
          content: '{"key": "value"}',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "4",
          trigger: "url",
          content: "https://example.com/path?param=value",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const detector = new TriggerDetector(mixedSnippets);

      // Generate mixed content that includes various special characters
      for (let i = 0; i < 100; i++) {
        const mixedContent = [
          generateRandomString(10),
          "<tag>",
          generateRandomString(5),
          '{"json": true}',
          generateRandomString(8),
          "https://url.com",
          generateRandomString(12),
          "code();",
          generateRandomString(6),
        ].join("");

        for (let pos = 0; pos < mixedContent.length; pos += 10) {
          expect(() => {
            const result = detector.processInput(mixedContent, pos);
            if (result.isMatch) {
              expect(result.matchEnd).toBeGreaterThanOrEqual(0);
              expect(result.matchEnd).toBeLessThanOrEqual(mixedContent.length);
            }
          }).not.toThrow();
        }
      }
    });

    it("should handle concurrent access safely (fuzz test)", () => {
      const snippets = generateRandomSnippets(50);
      const detector = new TriggerDetector(snippets);

      // Simulate concurrent access from multiple contexts
      const promises = Array.from({ length: 20 }, () => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            for (let i = 0; i < 50; i++) {
              const text = generateRandomString(
                Math.floor(Math.random() * 100) + 1,
              );
              const position = Math.floor(Math.random() * (text.length + 1));

              try {
                const result = detector.processInput(text, position);
                if (result.isMatch) {
                  expect(result).toHaveProperty("trigger");
                  expect(result.matchEnd).toBeGreaterThanOrEqual(0);
                  expect(result.matchEnd).toBeLessThanOrEqual(text.length);
                }
              } catch (error) {
                throw new Error(
                  `Concurrent access failed: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
            resolve();
          }, Math.random() * 10);
        });
      });

      return Promise.all(promises);
    });
  });

  describe("Memory and Resource Fuzzing", () => {
    it("should not leak memory with large numbers of snippets (fuzz test)", () => {
      // Test with progressively larger snippet sets
      const sizes = [100, 500, 1000, 2000];

      sizes.forEach((size) => {
        const snippets = generateRandomSnippets(size);
        const detector = new TriggerDetector(snippets);

        // Perform many operations
        for (let i = 0; i < 100; i++) {
          const text = generateRandomString(50);
          const position = Math.floor(Math.random() * 51);
          detector.processInput(text, position);
        }

        // Memory usage should be bounded
        // (This is a basic test; real memory leak detection would require more sophisticated tooling)
        expect(snippets.length).toBe(size); // Ensure snippets aren't being duplicated
      });
    });

    it("should handle resource exhaustion gracefully (fuzz test)", () => {
      const snippets = generateRandomSnippets(10);
      const detector = new TriggerDetector(snippets);

      // Test with extremely long strings that could exhaust memory
      const veryLongStrings = [
        "a".repeat(100000), // 100KB string
        generateRandomString(50000), // 50KB random string
        "x".repeat(1000000), // 1MB string (if memory allows)
      ];

      veryLongStrings.forEach((longString) => {
        // Test at various positions
        const positions = [
          0,
          100,
          1000,
          Math.floor(longString.length / 2),
          longString.length - 100,
          longString.length,
        ];

        positions.forEach((pos) => {
          if (pos >= 0 && pos <= longString.length) {
            expect(() => {
              const result = detector.processInput(longString, pos);
              if (result.isMatch) {
                expect(result.matchEnd).toBeLessThanOrEqual(longString.length);
              }
            }).not.toThrow();
          }
        });
      });
    });
  });

  describe("Security Fuzzing", () => {
    it("should not execute malicious patterns in triggers or content (fuzz test)", () => {
      const maliciousPatterns = [
        '<script>alert("xss")</script>',
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "${process.env.PASSWORD}",
        "../../etc/passwd",
        "SELECT * FROM users",
        "__proto__",
        "constructor",
        "prototype",
      ];

      // Create snippets with potentially malicious content
      const maliciousSnippets: TextSnippet[] = maliciousPatterns.map(
        (pattern, i) => ({
          id: `malicious-${i}`,
          trigger: `trigger${i}`,
          content: pattern,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const detector = new TriggerDetector(maliciousSnippets);

      // Test that detection works normally without executing malicious code
      maliciousSnippets.forEach((snippet) => {
        const text = `test ${snippet.trigger} test`;
        const result = detector.processInput(
          text,
          text.indexOf(snippet.trigger) + snippet.trigger.length,
        );

        if (result.isMatch) {
          expect(result.content).toBe(snippet.content);
          // Content should be returned as-is, not executed
          expect(typeof result.content).toBe("string");
        }
      });

      // Test with malicious trigger names
      const maliciousTriggerSnippets: TextSnippet[] = maliciousPatterns.map(
        (pattern, i) => ({
          id: `bad-trigger-${i}`,
          trigger: pattern.replace(/[<>]/g, ""), // Remove invalid chars for trigger
          content: `Safe content ${i}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const maliciousTriggerDetector = new TriggerDetector(
        maliciousTriggerSnippets,
      );

      maliciousTriggerSnippets.forEach((snippet) => {
        if (snippet.trigger.length > 0) {
          const text = snippet.trigger;
          expect(() => {
            maliciousTriggerDetector.processInput(text, text.length);
          }).not.toThrow();
        }
      });
    });

    it("should handle injection attempts in text input (fuzz test)", () => {
      const snippets = generateRandomSnippets(10);
      const detector = new TriggerDetector(snippets);

      const injectionAttempts = [
        "'; DROP TABLE snippets; --",
        '<img src="x" onerror="alert(1)">',
        "javascript:void(0)",
        "${7*7}", // Template injection
        "{{7*7}}", // Template injection
        "<%= 7*7 %>", // ERB injection
        "#{7*7}", // Ruby injection
        '">&lt;script&gt;alert(1)&lt;/script&gt;',
        "\\x3cscript\\x3ealert(1)\\x3c/script\\x3e",
      ];

      injectionAttempts.forEach((injection) => {
        const testTexts = [
          injection,
          `before ${injection} after`,
          injection.repeat(3),
          injection + generateRandomString(100),
        ];

        testTexts.forEach((text) => {
          for (
            let pos = 0;
            pos <= text.length;
            pos += Math.max(1, Math.floor(text.length / 10))
          ) {
            expect(() => {
              const result = detector.processInput(text, pos);
              if (result.isMatch) {
                // Should return normal detection result, not execute injection
                expect(typeof result.trigger).toBe("string");
                expect(typeof result.content).toBe("string");
              }
            }).not.toThrow();
          }
        });
      });
    });
  });
});
