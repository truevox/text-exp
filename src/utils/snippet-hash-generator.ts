/**
 * Snippet hash generation utilities
 * Generates quick hash of snippet content excluding ID and timestamp fields
 */

import type { SnippetMeta, EnhancedSnippet } from "../types/snippet-formats.js";

/**
 * Fields to exclude from hashing (timestamps and ID)
 */
const EXCLUDED_FIELDS = [
  "id",
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
] as const;

/**
 * Generate a quick hash of snippet content excluding timestamps and ID
 * Used for duplicate detection and cross-store identification
 */
export function generateSnippetHash(
  snippet: SnippetMeta | EnhancedSnippet,
): string {
  // Create a copy excluding timestamp and ID fields
  const hashableData = Object.fromEntries(
    Object.entries(snippet).filter(
      ([key]) => !EXCLUDED_FIELDS.includes(key as any),
    ),
  );

  // Sort keys for consistent hashing
  const sortedKeys = Object.keys(hashableData).sort();
  const normalizedData = sortedKeys.reduce(
    (acc, key) => {
      acc[key] = hashableData[key];
      return acc;
    },
    {} as Record<string, any>,
  );

  // Convert to stable JSON string
  const jsonString = JSON.stringify(normalizedData, null, 0);

  // Generate simple hash using built-in browser/Node APIs
  return generateSimpleHash(jsonString);
}

/**
 * Generate a simple hash from a string
 * Uses a basic but sufficient hash algorithm for duplicate detection
 */
function generateSimpleHash(str: string): string {
  let hash = 0;

  if (str.length === 0) return hash.toString(36);

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to base36 for shorter hash
  return Math.abs(hash).toString(36);
}

/**
 * Compare two snippets for content equality (excluding timestamps and ID)
 */
export function areSnippetsContentEqual(
  snippet1: SnippetMeta | EnhancedSnippet,
  snippet2: SnippetMeta | EnhancedSnippet,
): boolean {
  return generateSnippetHash(snippet1) === generateSnippetHash(snippet2);
}

/**
 * Generate hash for a partial snippet object (useful for search/comparison)
 */
export function generatePartialSnippetHash(
  partialSnippet: Partial<SnippetMeta | EnhancedSnippet>,
): string {
  // Filter out excluded fields from partial data
  const hashableData = Object.fromEntries(
    Object.entries(partialSnippet).filter(
      ([key]) => !EXCLUDED_FIELDS.includes(key as any),
    ),
  );

  const sortedKeys = Object.keys(hashableData).sort();
  const normalizedData = sortedKeys.reduce(
    (acc, key) => {
      acc[key] = hashableData[key];
      return acc;
    },
    {} as Record<string, any>,
  );

  const jsonString = JSON.stringify(normalizedData, null, 0);
  return generateSimpleHash(jsonString);
}

/**
 * Get hashable fields from a snippet (fields used in hash generation)
 */
export function getHashableFields(
  snippet: SnippetMeta | EnhancedSnippet,
): Partial<SnippetMeta | EnhancedSnippet> {
  return Object.fromEntries(
    Object.entries(snippet).filter(
      ([key]) => !EXCLUDED_FIELDS.includes(key as any),
    ),
  );
}
