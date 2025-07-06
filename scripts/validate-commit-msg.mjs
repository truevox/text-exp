#!/usr/bin/env node
import fs from "fs";

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  process.exit(0); // No commit file passed, shouldn't happen with husky
}

const commitMsg = fs.readFileSync(commitMsgFile, "utf-8").trim();

// Regex to match the format: :emoji: Category, TC: 00.0%
// This regex is simplified to check for any character at the start for the emoji,
// as a full emoji regex can be complex and vary between platforms.
const commitRegex =
  /^(.) [A-Z][a-z]+, TC: (100(\.\d{1,2})?|\d{1,2}(\.\d{1,2})?)%$/;

if (!commitRegex.test(commitMsg)) {
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
