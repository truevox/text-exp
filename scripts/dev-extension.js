#!/usr/bin/env node

/**
 * Development script for Chrome Extension
 * Builds extension in development mode and provides helpful development information
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BUILD_DIR = 'build';
const MANIFEST_PATH = path.join(BUILD_DIR, 'manifest.json');

function printBanner() {
  console.log('');
  console.log('🚀 Chrome Extension Development Mode');
  console.log('=====================================');
  console.log('');
}

function buildExtension() {
  console.log('📦 Building extension in development mode...');
  
  try {
    execSync('npm run build:dev', { stdio: 'inherit' });
    console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

function printInstructions() {
  console.log('');
  console.log('📋 Development Instructions:');
  console.log('============================');
  console.log('');
  console.log('1. Open Chrome and navigate to: chrome://extensions/');
  console.log('2. Enable "Developer mode" (toggle in top right)');
  console.log('3. Click "Load unpacked" and select the build/ directory');
  console.log('4. Your extension is now loaded and ready for testing!');
  console.log('');
  console.log('📁 Extension files are in: ' + path.resolve(BUILD_DIR));
  console.log('');
  console.log('🔄 For auto-rebuild on changes, run: npm run dev');
  console.log('🧪 To run tests: npm test');
  console.log('📏 To type check: npm run type-check');
  console.log('🎨 To format code: npm run format');
  console.log('');
  console.log('Happy coding! 🎉');
  console.log('');
}

function checkBuildOutput() {
  if (!fs.existsSync(BUILD_DIR)) {
    console.error('❌ Build directory not found. Build may have failed.');
    return false;
  }
  
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('❌ manifest.json not found in build directory.');
    return false;
  }
  
  // Read and display manifest info
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  console.log('📄 Extension Info:');
  console.log(`   Name: ${manifest.name}`);
  console.log(`   Version: ${manifest.version}`);
  console.log(`   Manifest Version: ${manifest.manifest_version}`);
  
  return true;
}

function main() {
  printBanner();
  buildExtension();
  
  if (checkBuildOutput()) {
    printInstructions();
  }
}

main();