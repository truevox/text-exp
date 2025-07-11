#!/usr/bin/env node
import fs from "fs";

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  process.exit(0); // No commit file passed, shouldn't happen with husky
}

const commitMsg = fs.readFileSync(commitMsgFile, "utf-8").trim();

// Split commit message into title and body
const lines = commitMsg.split("\n");
const title = lines[0].trim();

// Regex to match the format: :emoji: Category, TC: 00.0%
// Uses Unicode property escapes to properly match emojis and other Unicode symbols
// \p{Emoji} matches emoji characters, \p{Symbol} matches other symbols like •, ★, etc.
const commitRegex =
  /^[\p{Emoji}\p{Symbol}\*] [A-Z][a-z]+, TC: (100(\.\d{1,2})?|\d{1,2}(\.\d{1,2})?)%$/u;

// Only validate the title line, allow detailed body
if (!commitRegex.test(title)) {
  console.error(`\n\x1b[31m[INVALID COMMIT MESSAGE]\x1b[0m`);
  console.error(`------------------------`);
  console.error(`Your commit message does not follow the required format.`);
  console.error(`It should be: \x1b[32m":emoji: Category, TC: 00.0%"\x1b[0m`);
  console.error(`Example: \x1b[32m"🐛 Fix, TC: 93.4%"\x1b[0m`);
  console.error(
    `You can use '\x1b[33mnpm run commit\x1b[0m' to help create a valid commit message.`,
  );
  console.error(`------------------------\n`);
  process.exit(1);
}

process.exit(0);
