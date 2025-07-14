/**
 * Test script to reproduce the "wub" word boundary detection bug
 */

import { EnhancedTriggerDetector } from "./src/content/enhanced-trigger-detector.js";

// Test snippets including the problematic "wub" trigger
const testSnippets = [
  { trigger: "wub", content: "WUB EXPANSION!" },
  { trigger: ";hello", content: "Hello World!" },
  { trigger: "punt", content: "PUNT! LETS GOOOOOO!!!!" },
];

const detector = new EnhancedTriggerDetector(testSnippets);

console.log("🔍 Testing word boundary detection bug:");
console.log();

// Test cases that should NOT match
const shouldNotMatch = [
  "Wubbalubba",           // "wub" inside "Wubbalubba" - should NOT match
  "Wubbalubba Dub Dub!!!", // Full text from user logs
  "wubba",                // "wub" at start but followed by alphanumeric
  "subwub",               // "wub" at end but preceded by alphanumeric  
  "somewubtext",          // "wub" in middle of word
];

// Test cases that SHOULD match
const shouldMatch = [
  "wub",                  // End of input
  "wub ",                 // Followed by space
  "wub!",                 // Followed by punctuation
  "wub.",                 // Followed by period
  "hello wub",            // Proper word boundaries
  "test wub test",        // Surrounded by proper boundaries
];

console.log("❌ Cases that should NOT match 'wub':");
shouldNotMatch.forEach(input => {
  const result = detector.processInput(input);
  const status = result.isMatch ? "❌ INCORRECTLY MATCHED" : "✅ Correctly rejected";
  console.log(`  "${input}" -> ${status}`);
  if (result.isMatch) {
    console.log(`    Found: "${result.trigger}" -> "${result.content}"`);
  }
});

console.log();
console.log("✅ Cases that SHOULD match 'wub':");
shouldMatch.forEach(input => {
  const result = detector.processInput(input);
  const status = result.isMatch ? "✅ Correctly matched" : "❌ INCORRECTLY REJECTED";
  console.log(`  "${input}" -> ${status}`);
  if (result.isMatch) {
    console.log(`    Found: "${result.trigger}" -> "${result.content}"`);
  }
});