// Simple debug script to test TriggerDetector behavior

import { TriggerDetector } from "./src/content/trigger-detector.ts";

const testSnippets = [{ trigger: "email", content: "john.doe@example.com" }];

console.log("Creating TriggerDetector with snippets:", testSnippets);
const detector = new TriggerDetector(testSnippets);

console.log("Detector prefix:", detector.getPrefix());
console.log("Loaded snippets count:", detector.getLoadedSnippetsCount());

console.log('Testing processInput(";email "):');
const result1 = detector.processInput(";email ");
console.log("Result:", result1);

console.log('Testing processInput("email "):');
const result2 = detector.processInput("email ");
console.log("Result:", result2);

console.log('Testing processInput(";email"):');
const result3 = detector.processInput(";email");
console.log("Result:", result3);
