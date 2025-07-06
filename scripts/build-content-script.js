#!/usr/bin/env node

/**
 * Post-build script to convert content script from ESM to IIFE format
 * This is necessary because Chrome content scripts can't use ES modules
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { build } from "vite";
import { resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

async function buildContentScriptAsIIFE() {
  console.log("🔧 Building content script as IIFE...");

  try {
    // Build just the content script in IIFE format
    await build({
      root: projectRoot,
      build: {
        outDir: "build-temp",
        emptyOutDir: true,
        lib: {
          entry: resolve(projectRoot, "src/content/content-script.ts"),
          name: "PuffPuffPasteContentScript",
          formats: ["iife"],
          fileName: "content-script",
        },
        rollupOptions: {
          external: ["chrome"],
          output: {
            globals: {
              chrome: "chrome",
            },
          },
        },
        minify: false, // Keep readable for debugging
        target: "es2022",
      },
      logLevel: "warn",
    });

    // Read the generated IIFE file
    const iifeFile = path.join(
      projectRoot,
      "build-temp/content-script.iife.js",
    );
    const iifeContent = fs.readFileSync(iifeFile, "utf8");

    // Copy it to the main build directory
    const outputFile = path.join(
      projectRoot,
      "build/content/content-script.js",
    );
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, iifeContent);

    // Clean up temp directory
    fs.rmSync(path.join(projectRoot, "build-temp"), {
      recursive: true,
      force: true,
    });

    console.log("✅ Content script built as IIFE successfully");
  } catch (error) {
    console.error("❌ Failed to build content script:", error);
    process.exit(1);
  }
}

buildContentScriptAsIIFE();
