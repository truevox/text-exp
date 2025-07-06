#!/usr/bin/env node

/**
 * Configuration validation script
 * Validates the build system configuration without requiring full npm install
 */

import fs from "fs";

const requiredFiles = [
  "vite.config.ts",
  "tsconfig.json",
  "package.json",
  "manifest.json",
  ".env.development",
  ".env.production",
  "BUILD.md",
];

const requiredDirs = [
  "src/background",
  "src/content",
  "src/popup",
  "src/options",
  "src/shared",
  "src/utils",
  "scripts",
  "vite-plugins",
  ".vscode",
];

function checkFile(filepath) {
  if (fs.existsSync(filepath)) {
    console.log(`✅ ${filepath}`);
    return true;
  } else {
    console.log(`❌ Missing: ${filepath}`);
    return false;
  }
}

function checkDir(dirpath) {
  if (fs.existsSync(dirpath) && fs.statSync(dirpath).isDirectory()) {
    console.log(`✅ ${dirpath}/`);
    return true;
  } else {
    console.log(`❌ Missing directory: ${dirpath}/`);
    return false;
  }
}

function validatePackageJson() {
  try {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

    const requiredScripts = [
      "dev",
      "dev:extension",
      "build",
      "build:dev",
      "test",
      "lint",
      "format",
      "type-check",
      "version:bump",
      "version:feature",
      "version:fix",
    ];

    console.log("\n📦 Package.json validation:");
    let allScriptsPresent = true;

    requiredScripts.forEach((script) => {
      if (pkg.scripts && pkg.scripts[script]) {
        console.log(`✅ Script: ${script}`);
      } else {
        console.log(`❌ Missing script: ${script}`);
        allScriptsPresent = false;
      }
    });

    const requiredDevDeps = [
      "vite",
      "typescript",
      "@types/chrome",
      "vite-plugin-static-copy",
      "fast-glob",
    ];

    let allDepsPresent = true;
    requiredDevDeps.forEach((dep) => {
      if (pkg.devDependencies && pkg.devDependencies[dep]) {
        console.log(`✅ Dependency: ${dep}`);
      } else {
        console.log(`❌ Missing dependency: ${dep}`);
        allDepsPresent = false;
      }
    });

    return allScriptsPresent && allDepsPresent;
  } catch (error) {
    console.log(`❌ Invalid package.json: ${error.message}`);
    return false;
  }
}

function validateTsConfig() {
  try {
    const tsconfig = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));

    console.log("\n🔧 TypeScript configuration:");

    const requiredPaths = [
      "@/*",
      "@/shared/*",
      "@/utils/*",
      "@/background/*",
      "@/content/*",
      "@/popup/*",
      "@/options/*",
    ];

    let allPathsPresent = true;
    if (tsconfig.compilerOptions && tsconfig.compilerOptions.paths) {
      requiredPaths.forEach((pathAlias) => {
        if (tsconfig.compilerOptions.paths[pathAlias]) {
          console.log(`✅ Path alias: ${pathAlias}`);
        } else {
          console.log(`❌ Missing path alias: ${pathAlias}`);
          allPathsPresent = false;
        }
      });
    } else {
      console.log("❌ No path mapping configured");
      allPathsPresent = false;
    }

    return allPathsPresent;
  } catch (error) {
    console.log(`❌ Invalid tsconfig.json: ${error.message}`);
    return false;
  }
}

function validateViteConfig() {
  try {
    const viteConfig = fs.readFileSync("vite.config.ts", "utf8");

    console.log("\n⚡ Vite configuration:");

    const requiredImports = [
      "chromeExtensionHotReload",
      "viteStaticCopy",
      "chromeExtensionPlugin",
    ];

    let allImportsPresent = true;
    requiredImports.forEach((importName) => {
      if (viteConfig.includes(importName)) {
        console.log(`✅ Import: ${importName}`);
      } else {
        console.log(`❌ Missing import: ${importName}`);
        allImportsPresent = false;
      }
    });

    const requiredEntryPoints = [
      "background/service-worker",
      "content/content-script",
      "popup/popup",
      "options/options",
    ];

    let allEntryPointsPresent = true;
    requiredEntryPoints.forEach((entry) => {
      if (viteConfig.includes(entry)) {
        console.log(`✅ Entry point: ${entry}`);
      } else {
        console.log(`❌ Missing entry point: ${entry}`);
        allEntryPointsPresent = false;
      }
    });

    return allImportsPresent && allEntryPointsPresent;
  } catch (error) {
    console.log(`❌ Could not read vite.config.ts: ${error.message}`);
    return false;
  }
}

function main() {
  console.log("🔍 Validating Chrome Extension Build System Configuration");
  console.log("=".repeat(60));

  console.log("\n📁 Required files:");
  let allFilesPresent = true;
  requiredFiles.forEach((file) => {
    if (!checkFile(file)) {
      allFilesPresent = false;
    }
  });

  console.log("\n📂 Required directories:");
  let allDirsPresent = true;
  requiredDirs.forEach((dir) => {
    if (!checkDir(dir)) {
      allDirsPresent = false;
    }
  });

  const packageValid = validatePackageJson();
  const tsconfigValid = validateTsConfig();
  const viteConfigValid = validateViteConfig();

  console.log("\n" + "=".repeat(60));

  if (
    allFilesPresent &&
    allDirsPresent &&
    packageValid &&
    tsconfigValid &&
    viteConfigValid
  ) {
    console.log("🎉 Configuration validation PASSED!");
    console.log("\n📋 Next steps:");
    console.log("1. Run: npm install");
    console.log("2. Run: npm run dev:extension");
    console.log("3. Load extension in Chrome from build/ directory");
    process.exit(0);
  } else {
    console.log("❌ Configuration validation FAILED!");
    console.log("\n🔧 Please fix the issues above before proceeding.");
    process.exit(1);
  }
}

main();
