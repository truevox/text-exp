#!/usr/bin/env node

/**
 * Sync version from package.json to src/utils/version.ts
 * Ensures runtime version matches build version
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function syncVersion() {
  try {
    // Read version from package.json
    const packagePath = path.resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const version = packageJson.version;
    
    // Update src/utils/version.ts
    const versionPath = path.resolve(__dirname, '../src/utils/version.ts');
    const versionContent = `/**
 * Extension version - auto-synced from package.json
 * DO NOT EDIT MANUALLY - This file is updated by scripts/sync-version.js
 */

export const VERSION = '${version}';
export const BUILD_TIME = '${new Date().toISOString()}';

export function logVersion(): void {
  console.log(\`🚀 PuffPuffPaste v\${VERSION}\`);
  console.log('📋 CloudAdapter Architecture | Multi-Provider Sync');
  console.log('🔧 Pre-launch (staying at 0.x.y until launch)');
}
`;

    fs.writeFileSync(versionPath, versionContent);
    console.log(`✅ Version synced: ${version}`);
    
  } catch (error) {
    console.error('❌ Failed to sync version:', error);
    process.exit(1);
  }
}

syncVersion();
