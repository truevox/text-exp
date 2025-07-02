/**
 * Version utilities for Collaborative Text Expander
 * Provides runtime access to version information
 */

// Import version from manifest.json at build time
export const VERSION = '0.2.0';

/**
 * Log version information to console
 * Called during extension initialization
 */
export function logVersion(): void {
  console.log(`🚀 Collaborative Text Expander v${VERSION}`);
  console.log(`📋 CloudAdapter Architecture | Multi-Provider Sync`);
  console.log(`🔧 Pre-launch (staying at 0.x.y until launch)`);
}

/**
 * Get version info object
 */
export function getVersionInfo() {
  const [major, minor, patch] = VERSION.split('.').map(Number);
  
  return {
    version: VERSION,
    major,
    minor,
    patch,
    isPreLaunch: major === 0,
    buildType: minor > 0 ? 'feature-preview' : 'initial-development'
  };
}

/**
 * Check if this is a development build
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get user-friendly version string
 */
export function getDisplayVersion(): string {
  const info = getVersionInfo();
  
  if (info.isPreLaunch) {
    return `v${VERSION} (Pre-Launch)`;
  }
  
  return `v${VERSION}`;
}