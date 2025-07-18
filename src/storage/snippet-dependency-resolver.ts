/**
 * Unified Snippet Dependency System
 * Implements unified cross-store snippet dependency format
 * Enforces consistent "store-name:trigger:id" format for ALL dependencies
 */

import type { TextSnippet } from "../shared/types.js";
import type { EnhancedSnippet } from "../types/snippet-formats.js";

export interface ParsedDependency {
  storeName: string;
  trigger: string;
  id: string;
  original: string;
  isValid: boolean;
  error?: string;
}

export interface DependencyResolutionResult {
  dependency: ParsedDependency;
  resolved: boolean;
  snippet?: TextSnippet | EnhancedSnippet;
  error?: string;
  storeExists?: boolean;
  snippetExists?: boolean;
}

export interface DependencyValidationResult {
  isValid: boolean;
  validDependencies: ParsedDependency[];
  invalidDependencies: ParsedDependency[];
  errors: string[];
  warnings: string[];
}

export interface CircularDependencyResult {
  hasCircularDependencies: boolean;
  cycles: string[][];
  affectedSnippets: string[];
  dependencyChains: Map<string, string[]>;
}

export interface StoreSnippetMap {
  [storeName: string]: {
    snippets: (TextSnippet | EnhancedSnippet)[];
    storeId: string;
    displayName: string;
  };
}

export interface DependencyStats {
  totalDependencies: number;
  validDependencies: number;
  invalidDependencies: number;
  resolvedDependencies: number;
  unresolvedDependencies: number;
  circularDependencies: number;
  storesReferenced: number;
  maxDependencyDepth: number;
  processingTimeMs: number;
}

export interface DependencyResolverOptions {
  /** Whether to validate store existence */
  validateStoreExistence?: boolean;

  /** Whether to validate snippet existence */
  validateSnippetExistence?: boolean;

  /** Whether to detect circular dependencies */
  detectCircularDependencies?: boolean;

  /** Maximum dependency resolution depth */
  maxResolutionDepth?: number;

  /** Whether to cache resolution results */
  enableCaching?: boolean;

  /** Whether to generate warnings for missing dependencies */
  generateWarnings?: boolean;
}

/**
 * Unified dependency format: "store-name:trigger:id"
 * Example: "appdata-store:;greeting:abc123"
 */
export class SnippetDependencyResolver {
  private resolutionCache = new Map<string, DependencyResolutionResult>();
  private validationCache = new Map<string, DependencyValidationResult>();
  private lastStats: DependencyStats | null = null;
  private static readonly DEPENDENCY_FORMAT_REGEX = /^([^:]*):([^:]*):([^:]*)$/;

  /**
   * Parse a dependency string into its components
   */
  parseDependency(dependencyString: string): ParsedDependency {
    // Check if format matches expected pattern
    const colonCount = (dependencyString.match(/:/g) || []).length;
    if (colonCount !== 2) {
      return {
        storeName: "",
        trigger: "",
        id: "",
        original: dependencyString,
        isValid: false,
        error: `Invalid dependency format. Expected "store-name:trigger:id", got "${dependencyString}"`,
      };
    }

    const match =
      SnippetDependencyResolver.DEPENDENCY_FORMAT_REGEX.exec(dependencyString);

    if (!match) {
      return {
        storeName: "",
        trigger: "",
        id: "",
        original: dependencyString,
        isValid: false,
        error: `Invalid dependency format. Expected "store-name:trigger:id", got "${dependencyString}"`,
      };
    }

    const [, storeName, trigger, id] = match;

    // Validate components
    if (!storeName.trim()) {
      return {
        storeName,
        trigger,
        id,
        original: dependencyString,
        isValid: false,
        error: "Store name cannot be empty",
      };
    }

    if (!trigger.trim()) {
      return {
        storeName,
        trigger,
        id,
        original: dependencyString,
        isValid: false,
        error: "Trigger cannot be empty",
      };
    }

    if (!id.trim()) {
      return {
        storeName,
        trigger,
        id,
        original: dependencyString,
        isValid: false,
        error: "ID cannot be empty",
      };
    }

    return {
      storeName: storeName.trim(),
      trigger: trigger.trim(),
      id: id.trim(),
      original: dependencyString,
      isValid: true,
    };
  }

  /**
   * Format a dependency from its components
   */
  formatDependency(storeName: string, trigger: string, id: string): string {
    // Validate inputs
    if (!storeName || !trigger || !id) {
      throw new Error(
        "All dependency components (storeName, trigger, id) are required",
      );
    }

    return `${storeName.trim()}:${trigger.trim()}:${id.trim()}`;
  }

  /**
   * Validate snippet dependencies
   */
  validateDependencies(
    dependencies: string[],
    availableStores: StoreSnippetMap,
    options: DependencyResolverOptions = {},
  ): DependencyValidationResult {
    const {
      validateStoreExistence = true,
      validateSnippetExistence = true,
      generateWarnings = true,
    } = options;

    const cacheKey = `${dependencies.join(",")}:${JSON.stringify(options)}`;
    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!;
    }

    const validDependencies: ParsedDependency[] = [];
    const invalidDependencies: ParsedDependency[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const depString of dependencies) {
      const parsed = this.parseDependency(depString);

      if (!parsed.isValid) {
        invalidDependencies.push(parsed);
        errors.push(parsed.error!);
        continue;
      }

      // Validate store existence
      if (validateStoreExistence && !availableStores[parsed.storeName]) {
        parsed.isValid = false;
        parsed.error = `Store "${parsed.storeName}" does not exist`;
        invalidDependencies.push(parsed);
        errors.push(parsed.error);
        continue;
      }

      // Validate snippet existence
      if (validateSnippetExistence && availableStores[parsed.storeName]) {
        const storeSnippets = availableStores[parsed.storeName].snippets;
        const snippetExists = storeSnippets.some((s) => s.id === parsed.id);

        if (!snippetExists) {
          if (generateWarnings) {
            warnings.push(
              `Snippet with ID "${parsed.id}" not found in store "${parsed.storeName}"`,
            );
          }
        }
      }

      validDependencies.push(parsed);
    }

    const result: DependencyValidationResult = {
      isValid: invalidDependencies.length === 0,
      validDependencies,
      invalidDependencies,
      errors,
      warnings,
    };

    this.validationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Resolve a single dependency
   */
  resolveDependency(
    dependency: string,
    availableStores: StoreSnippetMap,
    options: DependencyResolverOptions = {},
  ): DependencyResolutionResult {
    const { enableCaching = true } = options;

    const cacheKey = `${dependency}:${JSON.stringify(options)}`;
    if (enableCaching && this.resolutionCache.has(cacheKey)) {
      return this.resolutionCache.get(cacheKey)!;
    }

    const parsed = this.parseDependency(dependency);

    if (!parsed.isValid) {
      const result: DependencyResolutionResult = {
        dependency: parsed,
        resolved: false,
        error: parsed.error,
      };

      if (enableCaching) {
        this.resolutionCache.set(cacheKey, result);
      }
      return result;
    }

    // Check if store exists
    const storeExists = availableStores[parsed.storeName] !== undefined;
    if (!storeExists) {
      const result: DependencyResolutionResult = {
        dependency: parsed,
        resolved: false,
        storeExists: false,
        error: `Store "${parsed.storeName}" does not exist`,
      };

      if (enableCaching) {
        this.resolutionCache.set(cacheKey, result);
      }
      return result;
    }

    // Find snippet in store
    const storeSnippets = availableStores[parsed.storeName].snippets;
    const snippet = storeSnippets.find((s) => s.id === parsed.id);

    const result: DependencyResolutionResult = {
      dependency: parsed,
      resolved: snippet !== undefined,
      snippet,
      storeExists: true,
      snippetExists: snippet !== undefined,
      error: snippet
        ? undefined
        : `Snippet with ID "${parsed.id}" not found in store "${parsed.storeName}"`,
    };

    if (enableCaching) {
      this.resolutionCache.set(cacheKey, result);
    }
    return result;
  }

  /**
   * Resolve multiple dependencies
   */
  resolveDependencies(
    dependencies: string[],
    availableStores: StoreSnippetMap,
    options: DependencyResolverOptions = {},
  ): DependencyResolutionResult[] {
    const startTime = Date.now();
    const results: DependencyResolutionResult[] = [];

    for (const dependency of dependencies) {
      const result = this.resolveDependency(
        dependency,
        availableStores,
        options,
      );
      results.push(result);
    }

    // Update statistics
    this.updateStats(results, Date.now() - startTime);

    return results;
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(
    snippets: (TextSnippet | EnhancedSnippet)[],
    availableStores: StoreSnippetMap,
    options: DependencyResolverOptions = {},
  ): CircularDependencyResult {
    const { maxResolutionDepth = 50 } = options;

    const dependencyChains = new Map<string, string[]>();
    const cycles: string[][] = [];
    const affectedSnippets: string[] = [];

    // Build dependency graph
    for (const snippet of snippets) {
      const dependencies = this.extractDependencies(snippet);
      dependencyChains.set(snippet.id, dependencies);
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (snippetId: string, path: string[]): boolean => {
      if (recursionStack.has(snippetId)) {
        // Found a cycle
        const cycleStart = path.indexOf(snippetId);
        const cycle = path.slice(cycleStart);
        cycle.push(snippetId); // Complete the cycle
        cycles.push(cycle);
        affectedSnippets.push(...cycle);
        return true;
      }

      if (visited.has(snippetId) || path.length > maxResolutionDepth) {
        return false;
      }

      visited.add(snippetId);
      recursionStack.add(snippetId);

      const dependencies = dependencyChains.get(snippetId) || [];
      for (const dep of dependencies) {
        const parsed = this.parseDependency(dep);
        if (parsed.isValid) {
          if (detectCycle(parsed.id, [...path, snippetId])) {
            return true;
          }
        }
      }

      recursionStack.delete(snippetId);
      return false;
    };

    // Check each snippet for cycles
    for (const snippet of snippets) {
      if (!visited.has(snippet.id)) {
        detectCycle(snippet.id, []);
      }
    }

    return {
      hasCircularDependencies: cycles.length > 0,
      cycles,
      affectedSnippets: [...new Set(affectedSnippets)],
      dependencyChains,
    };
  }

  /**
   * Convert legacy dependencies to unified format
   */
  convertToUnifiedFormat(
    dependencies: string[],
    currentStoreName: string,
    snippetLookup: Map<string, string> = new Map(),
  ): string[] {
    return dependencies.map((dep) => {
      // If already in unified format, return as-is
      if (SnippetDependencyResolver.DEPENDENCY_FORMAT_REGEX.test(dep)) {
        return dep;
      }

      // Handle legacy formats
      if (dep.startsWith(";")) {
        // Legacy trigger format: ";greeting"
        const trigger = dep;
        const id =
          snippetLookup.get(trigger) ||
          `legacy-${trigger.replace(";", "")}-${Date.now()}`;
        return this.formatDependency(currentStoreName, trigger, id);
      }

      // Handle other legacy formats
      // Assume it's a snippet ID if no other format matches
      const trigger = `;${dep}`;
      return this.formatDependency(currentStoreName, trigger, dep);
    });
  }

  /**
   * Extract dependencies from a snippet
   */
  extractDependencies(snippet: TextSnippet | EnhancedSnippet): string[] {
    // Check for EnhancedSnippet dependencies
    if (
      "snipDependencies" in snippet &&
      Array.isArray(snippet.snipDependencies)
    ) {
      return snippet.snipDependencies;
    }

    // Check for TextSnippet dependencies (if they exist)
    if (
      "dependencies" in snippet &&
      Array.isArray((snippet as any).dependencies)
    ) {
      return (snippet as any).dependencies;
    }

    // No dependencies found
    return [];
  }

  /**
   * Update snippet dependencies
   */
  updateSnippetDependencies(
    snippet: TextSnippet | EnhancedSnippet,
    dependencies: string[],
  ): TextSnippet | EnhancedSnippet {
    const updatedSnippet = { ...snippet };

    // Update EnhancedSnippet dependencies
    if ("snipDependencies" in updatedSnippet) {
      updatedSnippet.snipDependencies = dependencies;
    } else {
      // Add snipDependencies to TextSnippet
      (updatedSnippet as any).snipDependencies = dependencies;
    }

    // Update timestamps
    const now = new Date();
    if ("updatedAt" in updatedSnippet) {
      updatedSnippet.updatedAt = now;
    }
    if ("lastModified" in updatedSnippet) {
      updatedSnippet.lastModified = now;
    }

    return updatedSnippet;
  }

  /**
   * Get statistics from last operation
   */
  getLastStats(): DependencyStats | null {
    return this.lastStats;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.resolutionCache.clear();
    this.validationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    resolutionCacheSize: number;
    validationCacheSize: number;
  } {
    return {
      resolutionCacheSize: this.resolutionCache.size,
      validationCacheSize: this.validationCache.size,
    };
  }

  /**
   * Update statistics
   */
  private updateStats(
    results: DependencyResolutionResult[],
    processingTimeMs: number,
  ): void {
    const validDependencies = results.filter(
      (r) => r.dependency.isValid,
    ).length;
    const invalidDependencies = results.filter(
      (r) => !r.dependency.isValid,
    ).length;
    const resolvedDependencies = results.filter((r) => r.resolved).length;
    const unresolvedDependencies = results.filter((r) => !r.resolved).length;
    const storesReferenced = new Set(results.map((r) => r.dependency.storeName))
      .size;

    this.lastStats = {
      totalDependencies: results.length,
      validDependencies,
      invalidDependencies,
      resolvedDependencies,
      unresolvedDependencies,
      circularDependencies: 0, // Updated by circular dependency detection
      storesReferenced,
      maxDependencyDepth: 0, // TODO: Implement depth calculation
      processingTimeMs,
    };
  }
}

/**
 * Global instance for easy access
 */
let globalResolver: SnippetDependencyResolver | null = null;

/**
 * Get or create the global resolver instance
 */
export function getSnippetDependencyResolver(): SnippetDependencyResolver {
  if (!globalResolver) {
    globalResolver = new SnippetDependencyResolver();
  }
  return globalResolver;
}

/**
 * Parse a dependency string (convenience function)
 */
export function parseDependency(dependencyString: string): ParsedDependency {
  return getSnippetDependencyResolver().parseDependency(dependencyString);
}

/**
 * Format a dependency from components (convenience function)
 */
export function formatDependency(
  storeName: string,
  trigger: string,
  id: string,
): string {
  return getSnippetDependencyResolver().formatDependency(
    storeName,
    trigger,
    id,
  );
}

/**
 * Validate dependencies (convenience function)
 */
export function validateDependencies(
  dependencies: string[],
  availableStores: StoreSnippetMap,
  options?: DependencyResolverOptions,
): DependencyValidationResult {
  return getSnippetDependencyResolver().validateDependencies(
    dependencies,
    availableStores,
    options,
  );
}

/**
 * Resolve dependencies (convenience function)
 */
export function resolveDependencies(
  dependencies: string[],
  availableStores: StoreSnippetMap,
  options?: DependencyResolverOptions,
): DependencyResolutionResult[] {
  return getSnippetDependencyResolver().resolveDependencies(
    dependencies,
    availableStores,
    options,
  );
}
