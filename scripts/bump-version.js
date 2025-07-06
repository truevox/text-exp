#!/usr/bin/env node

/**
 * Version bumping script for Collaborative Text Expander
 *
 * Usage:
 *   node scripts/bump-version.js fix     # 0.1.0 -> 0.1.1 (bug fixes)
 *   node scripts/bump-version.js feature # 0.1.0 -> 0.2.0 (new features)
 *   node scripts/bump-version.js         # defaults to feature bump
 *
 * Stays at 0.x.y until launch (per CLAUDE.md instructions)
 */

import fs from "fs";

const PACKAGE_JSON = "package.json";
const MANIFEST_JSON = "manifest.json";

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
  return pkg.version;
}

function parseVersion(version) {
  const [, minor, patch] = version.split(".").map(Number);
  return { minor, patch };
}

function bumpVersion(type = "feature") {
  const currentVersion = getCurrentVersion();
  const { minor, patch } = parseVersion(currentVersion);

  // Keep major at 0 until launch
  const newMajor = 0;
  let newMinor = minor;
  let newPatch = patch;

  if (type === "fix") {
    newPatch = patch + 1;
  } else if (type === "feature") {
    newMinor = minor + 1;
    newPatch = 0;
  } else {
    console.error('❌ Invalid bump type. Use "fix" or "feature"');
    process.exit(1);
  }

  const newVersion = `${newMajor}.${newMinor}.${newPatch}`;

  console.log(
    `📦 Bumping version: ${currentVersion} → ${newVersion} (${type})`,
  );

  return newVersion;
}

function updateFile(filePath, newVersion) {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
    content.version = newVersion;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n");
    console.log(`✅ Updated ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error.message);
    process.exit(1);
  }
}

function main() {
  const type = process.argv[2] || "feature";

  if (!["fix", "feature"].includes(type)) {
    console.error('❌ Invalid bump type. Use "fix" or "feature"');
    process.exit(1);
  }

  const newVersion = bumpVersion(type);

  // Update package.json
  updateFile(PACKAGE_JSON, newVersion);

  // Update manifest.json
  updateFile(MANIFEST_JSON, newVersion);

  console.log(`🎉 Version bumped to ${newVersion}`);
  console.log(`💡 Run 'git add . && git commit -m "v${newVersion}"' to commit`);
}

// Log version to console as requested
const currentVersion = getCurrentVersion();
console.log(`🏷️  Current version: ${currentVersion}`);

// Check if script is being run directly
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename;

console.log("Debug:", {
  __filename,
  "process.argv[1]": process.argv[1],
  isMain,
});

if (isMain) {
  main();
}
