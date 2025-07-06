#!/usr/bin/env node

/**
 * Build content script using dedicated Vite config
 * This ensures proper bundling without variable conflicts
 */

import { build } from "vite";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildContentScript() {
  console.log("🔧 Building content script as IIFE...");

  try {
    await build({
      configFile: path.resolve(__dirname, "vite.content.config.ts"),
      logLevel: "info",
    });

    console.log("✅ Content script built successfully");
  } catch (error) {
    console.error("❌ Failed to build content script:", error);
    process.exit(1);
  }
}

buildContentScript();
