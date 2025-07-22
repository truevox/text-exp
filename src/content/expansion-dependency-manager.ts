/**
 * Expansion Dependency Manager
 * Handles dependency resolution during text expansion
 * Integrates with SnippetDependencyResolver for recursive dependency resolution
 */

import type { TextSnippet } from "../shared/types.js";
import type { EnhancedSnippet } from "../types/snippet-formats.js";
import type { StoreSnippetMap } from "../storage/snippet-dependency-resolver.js";
import { logExpansionUsage } from "./expansion-usage-logger.js";

// ============================================================================
// EXPANSION DEPENDENCY INTERFACES
// ============================================================================

/**
 * Context for dependency resolution during expansion
 */
export interface DependencyResolutionContext {
  /** Root snippet being expanded */
  rootSnippet: TextSnippet | EnhancedSnippet;

  /** Available stores for resolution */
  availableStores: StoreSnippetMap;

  /** Maximum recursion depth to prevent infinite loops */
  maxDepth: number;

  /** Current recursion depth */
  currentDepth: number;

  /** Whether to enable caching for performance */
  enableCaching: boolean;

  /** User ID for permission checks */
  userId?: string;

  /** Session ID for tracking */
  sessionId?: string;

  /** Performance optimization settings */
  performanceSettings: DependencyPerformanceSettings;

  /** Error handling configuration */
  errorHandling: DependencyErrorHandling;

  /** Variable resolution context */
  variableContext: VariableResolutionContext;
}

/**
 * Performance optimization settings for dependency resolution
 */
export interface DependencyPerformanceSettings {
  /** Maximum number of dependencies to resolve in parallel */
  maxParallelResolutions: number;

  /** Timeout for individual dependency resolution in milliseconds */
  resolutionTimeout: number;

  /** Whether to use lazy loading for dependencies */
  lazyLoading: boolean;

  /** Cache settings */
  cacheSettings: DependencyCacheSettings;

  /** Performance monitoring settings */
  monitoringSettings: DependencyMonitoringSettings;
}

/**
 * Cache settings for dependency resolution
 */
export interface DependencyCacheSettings {
  /** Whether to cache resolved dependencies */
  enableCache: boolean;

  /** Cache TTL in milliseconds */
  cacheTtl: number;

  /** Maximum cache size */
  maxCacheSize: number;

  /** Cache eviction strategy */
  evictionStrategy: "LRU" | "LFU" | "FIFO";
}

/**
 * Performance monitoring settings
 */
export interface DependencyMonitoringSettings {
  /** Whether to collect performance metrics */
  collectMetrics: boolean;

  /** Whether to log performance warnings */
  logPerformanceWarnings: boolean;

  /** Performance warning thresholds */
  warningThresholds: DependencyPerformanceThresholds;
}

/**
 * Performance warning thresholds
 */
export interface DependencyPerformanceThresholds {
  /** Maximum resolution time in milliseconds */
  maxResolutionTime: number;

  /** Maximum dependency depth */
  maxDependencyDepth: number;

  /** Maximum number of dependencies */
  maxDependencyCount: number;

  /** Maximum memory usage in bytes */
  maxMemoryUsage: number;
}

/**
 * Error handling configuration for dependency resolution
 */
export interface DependencyErrorHandling {
  /** How to handle missing dependencies */
  missingDependencyStrategy: "FAIL" | "WARN" | "IGNORE" | "PLACEHOLDER";

  /** How to handle circular dependencies */
  circularDependencyStrategy: "FAIL" | "WARN" | "BREAK" | "IGNORE";

  /** How to handle permission denied errors */
  permissionDeniedStrategy: "FAIL" | "WARN" | "FALLBACK" | "IGNORE";

  /** How to handle recursion depth exceeded errors */
  recursionStrategy: "FAIL" | "WARN" | "BREAK" | "IGNORE";

  /** How to handle network errors */
  networkErrorStrategy: "FAIL" | "WARN" | "RETRY" | "FALLBACK";

  /** Maximum retry attempts */
  maxRetryAttempts: number;

  /** Retry delay in milliseconds */
  retryDelay: number;

  /** Fallback content for failed resolutions */
  fallbackContent: string;

  /** Whether to collect error statistics */
  collectErrorStats: boolean;
}

/**
 * Variable resolution context for dependency expansion
 */
export interface VariableResolutionContext {
  /** Current variable values */
  variables: Map<string, string>;

  /** Variable resolution mode */
  resolutionMode: "PROMPT" | "DEFAULT" | "CONTEXT" | "INTERACTIVE";

  /** Default variable values */
  defaultValues: Map<string, string>;

  /** Variable resolution callbacks */
  resolutionCallbacks: Map<string, VariableResolutionCallback>;

  /** Variable validation rules */
  validationRules: Map<string, VariableValidationRule>;
}

/**
 * Callback for variable resolution
 */
export interface VariableResolutionCallback {
  /** Variable name */
  variableName: string;

  /** Resolution function */
  resolve: (context: VariableResolutionContext) => Promise<string>;

  /** Validation function */
  validate?: (value: string) => boolean;

  /** Error message for validation failure */
  errorMessage?: string;
}

/**
 * Validation rule for variables
 */
export interface VariableValidationRule {
  /** Variable name */
  variableName: string;

  /** Validation pattern */
  pattern?: RegExp;

  /** Minimum length */
  minLength?: number;

  /** Maximum length */
  maxLength?: number;

  /** Required flag */
  required?: boolean;

  /** Custom validation function */
  customValidator?: (value: string) => boolean;

  /** Error message */
  errorMessage?: string;
}

/**
 * Resolved dependency information
 */
export interface ResolvedDependency {
  /** Original dependency string */
  originalDependency: string;

  /** Resolved snippet */
  resolvedSnippet: TextSnippet | EnhancedSnippet;

  /** Resolved content with variables expanded */
  resolvedContent: string;

  /** Nested dependencies */
  nestedDependencies: ResolvedDependency[];

  /** Resolution path (for debugging) */
  resolutionPath: string[];

  /** Resolution depth */
  resolutionDepth: number;

  /** Resolution metadata */
  metadata: DependencyResolutionMetadata;

  /** Resolution timestamp */
  timestamp: Date;
}

/**
 * Metadata for dependency resolution
 */
export interface DependencyResolutionMetadata {
  /** Source store */
  sourceStore: string;

  /** Resolution time in milliseconds */
  resolutionTime: number;

  /** Whether resolved from cache */
  fromCache: boolean;

  /** Number of variables resolved */
  variablesResolved: number;

  /** Number of nested dependencies */
  nestedDependencyCount: number;

  /** Resolution method used */
  resolutionMethod: "DIRECT" | "RECURSIVE" | "LAZY" | "PARALLEL";

  /** Warning messages */
  warnings: string[];
}

/**
 * Result of expansion with dependencies
 */
export interface ExpansionResult {
  /** Whether expansion was successful */
  success: boolean;

  /** Final expanded content */
  expandedContent: string;

  /** Original snippet */
  originalSnippet: TextSnippet | EnhancedSnippet;

  /** All resolved dependencies */
  resolvedDependencies: ResolvedDependency[];

  /** Variables used in expansion */
  variablesUsed: Map<string, string>;

  /** Expansion errors */
  errors: ExpansionError[];

  /** Expansion warnings */
  warnings: ExpansionWarning[];

  /** Performance metrics */
  performanceMetrics: ExpansionPerformanceMetrics;

  /** Expansion context */
  context: DependencyResolutionContext;

  /** Expansion timestamp */
  timestamp: Date;
}

/**
 * Expansion error details
 */
export interface ExpansionError {
  /** Error type */
  type: ExpansionErrorType;

  /** Error message */
  message: string;

  /** Dependency that caused the error */
  dependency?: string;

  /** Snippet that caused the error */
  snippet?: string;

  /** Error severity */
  severity: "CRITICAL" | "ERROR" | "WARNING" | "INFO";

  /** Error stack trace */
  stackTrace?: string;

  /** Resolution path when error occurred */
  resolutionPath?: string[];

  /** Suggested fixes */
  suggestions?: string[];

  /** Error code for programmatic handling */
  errorCode?: string;

  /** Timestamp when error occurred */
  timestamp?: number;
}

/**
 * Expansion error types
 */
export type ExpansionErrorType =
  | "MISSING_DEPENDENCY"
  | "CIRCULAR_DEPENDENCY"
  | "PERMISSION_DENIED"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "INVALID_FORMAT"
  | "VARIABLE_RESOLUTION_FAILED"
  | "RECURSIVE_LIMIT_EXCEEDED"
  | "CACHE_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Expansion warning details
 */
export interface ExpansionWarning {
  /** Warning message */
  message: string;

  /** Dependency that caused the warning */
  dependency?: string;

  /** Warning type */
  type: "PERFORMANCE" | "COMPATIBILITY" | "DEPRECATION" | "BEST_PRACTICE";

  /** Suggested action */
  suggestion?: string;
}

/**
 * Performance metrics for expansion
 */
export interface ExpansionPerformanceMetrics {
  /** Total expansion time in milliseconds */
  totalExpansionTime: number;

  /** Dependency resolution time */
  dependencyResolutionTime: number;

  /** Variable resolution time */
  variableResolutionTime: number;

  /** Content generation time */
  contentGenerationTime: number;

  /** Number of dependencies resolved */
  dependenciesResolved: number;

  /** Number of variables resolved */
  variablesResolved: number;

  /** Maximum dependency depth reached */
  maxDependencyDepth: number;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Memory usage peak in bytes */
  memoryUsagePeak: number;

  /** Network requests made */
  networkRequests: number;
}

/**
 * Expansion strategy configuration
 */
export interface ExpansionStrategy {
  /** Strategy name */
  name: string;

  /** Strategy description */
  description: string;

  /** Whether to resolve dependencies recursively */
  recursive: boolean;

  /** Whether to resolve dependencies in parallel */
  parallel: boolean;

  /** Whether to use lazy loading */
  lazy: boolean;

  /** Maximum concurrency for parallel resolution */
  maxConcurrency: number;

  /** Priority for strategy selection */
  priority: number;

  /** Strategy-specific options */
  options: Record<string, any>;
}

/**
 * Expansion hook for extensibility
 */
export interface ExpansionHook {
  /** Hook name */
  name: string;

  /** Hook priority */
  priority: number;

  /** Pre-expansion hook */
  preExpansion?: (context: DependencyResolutionContext) => Promise<boolean>;

  /** Post-expansion hook */
  postExpansion?: (result: ExpansionResult) => Promise<void>;

  /** Dependency resolution hook */
  onDependencyResolved?: (dependency: ResolvedDependency) => Promise<void>;

  /** Error handling hook */
  onError?: (error: ExpansionError) => Promise<void>;

  /** Variable resolution hook */
  onVariableResolved?: (variable: string, value: string) => Promise<void>;
}

/**
 * Expansion cache entry
 */
export interface ExpansionCacheEntry {
  /** Cache key */
  key: string;

  /** Cached expansion result */
  result: ExpansionResult;

  /** Cache timestamp */
  timestamp: Date;

  /** Cache TTL */
  ttl: number;

  /** Cache metadata */
  metadata: ExpansionCacheMetadata;
}

/**
 * Expansion cache metadata
 */
export interface ExpansionCacheMetadata {
  /** Hit count */
  hitCount: number;

  /** Last access time */
  lastAccess: Date;

  /** Cache size in bytes */
  size: number;

  /** Cache tags */
  tags: string[];

  /** Cache dependencies */
  dependencies: string[];
}

/**
 * Expansion statistics
 */
export interface ExpansionStats {
  /** Total expansions performed */
  totalExpansions: number;

  /** Successful expansions */
  successfulExpansions: number;

  /** Failed expansions */
  failedExpansions: number;

  /** Average expansion time */
  averageExpansionTime: number;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Most common errors */
  mostCommonErrors: Map<ExpansionErrorType, number>;

  /** Performance statistics */
  performanceStats: ExpansionPerformanceStats;
}

/**
 * Performance statistics for expansion
 */
export interface ExpansionPerformanceStats {
  /** Average dependency resolution time */
  averageDependencyResolutionTime: number;

  /** Average variable resolution time */
  averageVariableResolutionTime: number;

  /** Average memory usage */
  averageMemoryUsage: number;

  /** Peak memory usage */
  peakMemoryUsage: number;

  /** Average network requests */
  averageNetworkRequests: number;

  /** Performance percentiles */
  performancePercentiles: Map<number, number>;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default performance settings
 */
export const DEFAULT_PERFORMANCE_SETTINGS: DependencyPerformanceSettings = {
  maxParallelResolutions: 10,
  resolutionTimeout: 30000,
  lazyLoading: true,
  cacheSettings: {
    enableCache: true,
    cacheTtl: 300000, // 5 minutes
    maxCacheSize: 1000,
    evictionStrategy: "LRU",
  },
  monitoringSettings: {
    collectMetrics: true,
    logPerformanceWarnings: true,
    warningThresholds: {
      maxResolutionTime: 5000,
      maxDependencyDepth: 20,
      maxDependencyCount: 100,
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB
    },
  },
};

/**
 * Default error handling configuration
 */
export const DEFAULT_ERROR_HANDLING: DependencyErrorHandling = {
  missingDependencyStrategy: "WARN",
  circularDependencyStrategy: "WARN",
  permissionDeniedStrategy: "WARN",
  recursionStrategy: "WARN",
  networkErrorStrategy: "RETRY",
  maxRetryAttempts: 3,
  retryDelay: 1000,
  fallbackContent: "[Dependency not available]",
  collectErrorStats: true,
};

/**
 * Default variable resolution context
 */
export const DEFAULT_VARIABLE_CONTEXT: VariableResolutionContext = {
  variables: new Map(),
  resolutionMode: "PROMPT",
  defaultValues: new Map(),
  resolutionCallbacks: new Map(),
  validationRules: new Map(),
};

/**
 * Default dependency resolution context
 */
export const DEFAULT_RESOLUTION_CONTEXT: Omit<
  DependencyResolutionContext,
  "rootSnippet" | "availableStores"
> = {
  maxDepth: 50,
  currentDepth: 0,
  enableCaching: true,
  performanceSettings: DEFAULT_PERFORMANCE_SETTINGS,
  errorHandling: DEFAULT_ERROR_HANDLING,
  variableContext: DEFAULT_VARIABLE_CONTEXT,
};

/**
 * Performance-optimized resolution context
 */
export const FAST_RESOLUTION_CONTEXT: Omit<
  DependencyResolutionContext,
  "rootSnippet" | "availableStores"
> = {
  maxDepth: 10,
  currentDepth: 0,
  enableCaching: true,
  performanceSettings: {
    ...DEFAULT_PERFORMANCE_SETTINGS,
    maxParallelResolutions: 20,
    resolutionTimeout: 5000,
    lazyLoading: false,
  },
  errorHandling: {
    ...DEFAULT_ERROR_HANDLING,
    missingDependencyStrategy: "PLACEHOLDER",
    circularDependencyStrategy: "BREAK",
    maxRetryAttempts: 1,
  },
  variableContext: {
    ...DEFAULT_VARIABLE_CONTEXT,
    resolutionMode: "DEFAULT",
  },
};

/**
 * Comprehensive resolution context
 */
export const THOROUGH_RESOLUTION_CONTEXT: Omit<
  DependencyResolutionContext,
  "rootSnippet" | "availableStores"
> = {
  maxDepth: 100,
  currentDepth: 0,
  enableCaching: true,
  performanceSettings: {
    ...DEFAULT_PERFORMANCE_SETTINGS,
    maxParallelResolutions: 5,
    resolutionTimeout: 60000,
    lazyLoading: false,
    monitoringSettings: {
      ...DEFAULT_PERFORMANCE_SETTINGS.monitoringSettings,
      warningThresholds: {
        maxResolutionTime: 30000,
        maxDependencyDepth: 50,
        maxDependencyCount: 500,
        maxMemoryUsage: 200 * 1024 * 1024, // 200MB
      },
    },
  },
  errorHandling: {
    ...DEFAULT_ERROR_HANDLING,
    missingDependencyStrategy: "FAIL",
    circularDependencyStrategy: "FAIL",
    maxRetryAttempts: 5,
    retryDelay: 2000,
  },
  variableContext: {
    ...DEFAULT_VARIABLE_CONTEXT,
    resolutionMode: "INTERACTIVE",
  },
};

/**
 * Common expansion strategies
 */
export const EXPANSION_STRATEGIES: Record<string, ExpansionStrategy> = {
  BASIC: {
    name: "Basic",
    description: "Simple recursive expansion",
    recursive: true,
    parallel: false,
    lazy: false,
    maxConcurrency: 1,
    priority: 1,
    options: {},
  },
  PARALLEL: {
    name: "Parallel",
    description: "Parallel dependency resolution",
    recursive: true,
    parallel: true,
    lazy: false,
    maxConcurrency: 10,
    priority: 2,
    options: {},
  },
  LAZY: {
    name: "Lazy",
    description: "Lazy loading with on-demand resolution",
    recursive: true,
    parallel: false,
    lazy: true,
    maxConcurrency: 1,
    priority: 3,
    options: {},
  },
  HYBRID: {
    name: "Hybrid",
    description: "Combination of parallel and lazy strategies",
    recursive: true,
    parallel: true,
    lazy: true,
    maxConcurrency: 5,
    priority: 4,
    options: {},
  },
};

// ============================================================================
// EXPANSION DEPENDENCY MANAGER IMPLEMENTATION
// ============================================================================

import {
  SnippetDependencyResolver,
  type DependencyResolutionResult,
  type CircularDependencyResult,
  getSnippetDependencyResolver,
} from "../storage/snippet-dependency-resolver.js";

import {
  DependencyValidator,
  type ValidationContext,
  type ValidationResult,
  getDependencyValidator,
} from "../storage/dependency-validator.js";

/**
 * Main class for managing dependency resolution during expansion
 */
export class ExpansionDependencyManager {
  private resolver: SnippetDependencyResolver;
  private validator: DependencyValidator;
  private cache = new Map<string, ExpansionCacheEntry>();
  private hooks: ExpansionHook[] = [];
  private stats: ExpansionStats;
  private activeResolutions = new Map<
    string,
    Promise<ResolvedDependency | null>
  >();
  private currentExpansionErrors: ExpansionError[] = [];

  constructor(
    resolver?: SnippetDependencyResolver,
    validator?: DependencyValidator,
  ) {
    this.resolver = resolver || getSnippetDependencyResolver();
    this.validator = validator || getDependencyValidator();
    this.stats = {
      totalExpansions: 0,
      successfulExpansions: 0,
      failedExpansions: 0,
      averageExpansionTime: 0,
      cacheHitRate: 0,
      mostCommonErrors: new Map(),
      performanceStats: {
        averageDependencyResolutionTime: 0,
        averageVariableResolutionTime: 0,
        averageMemoryUsage: 0,
        peakMemoryUsage: 0,
        averageNetworkRequests: 0,
        performancePercentiles: new Map(),
      },
    };
  }

  /**
   * Expand snippet with dependency resolution
   */
  async expandWithDependencies(
    snippet: TextSnippet | EnhancedSnippet,
    context: DependencyResolutionContext,
  ): Promise<ExpansionResult> {
    const startTime = Date.now();
    const sessionId = context.sessionId || `expansion-${Date.now()}`;

    // Reset errors for this expansion
    this.currentExpansionErrors = [];

    try {
      // Validate snippet data
      if (!snippet || !snippet.content || typeof snippet.content !== "string") {
        return this.createErrorResult(
          "INVALID_FORMAT",
          "Snippet content is missing or invalid",
          snippet,
          context,
          startTime,
        );
      }

      // Execute pre-expansion hooks
      for (const hook of this.hooks.filter((h) => h.preExpansion)) {
        const shouldContinue = await hook.preExpansion!(context);
        if (!shouldContinue) {
          return this.createErrorResult(
            "UNKNOWN_ERROR",
            "Expansion cancelled by pre-expansion hook",
            snippet,
            context,
            startTime,
          );
        }
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(snippet, context);
      if (context.enableCaching && this.cache.has(cacheKey)) {
        const cachedEntry = this.cache.get(cacheKey)!;
        if (this.isCacheValid(cachedEntry)) {
          this.updateCacheStats(cachedEntry);
          return cachedEntry.result;
        }
      }

      // Resolve dependencies
      const resolvedDependencies = await this.resolveDependencies(
        snippet,
        context,
      );

      // Flatten nested dependencies to get all dependencies in the chain
      const allDependencies = this.flattenDependencies(resolvedDependencies);

      // Expand content with resolved dependencies
      const expandedContent = await this.expandContentWithDependencies(
        snippet,
        allDependencies,
        context,
      );

      // Create success result
      const result = this.createSuccessResult(
        expandedContent,
        snippet,
        allDependencies,
        context,
        startTime,
      );

      // Add any resolution errors to the result
      result.errors.push(...this.currentExpansionErrors);

      // Cache result
      if (context.enableCaching) {
        this.cacheResult(cacheKey, result, context);
      }

      // Execute post-expansion hooks
      for (const hook of this.hooks.filter((h) => h.postExpansion)) {
        await hook.postExpansion!(result);
      }

      // Update statistics
      this.updateStats(result, startTime);

      // Track usage for analytics (with error isolation)
      try {
        const originalSnippet = this.convertToTextSnippet(snippet);
        const dependencyChain = allDependencies
          .map((d) => {
            const parsedDep = this.resolver.parseDependency(
              d.originalDependency,
            );
            return parsedDep.isValid ? parsedDep.trigger : d.originalDependency;
          })
          .join(" → ");
        await logExpansionUsage(originalSnippet, true, undefined, {
          targetElement: "dependency-resolved",
          url: typeof window !== "undefined" ? window.location.href : "unknown",
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          dependencyChain,
        });
      } catch (trackingError) {
        // Usage tracking errors should not affect expansion
        console.warn(
          "⚠️ Dependency expansion usage tracking failed:",
          trackingError,
        );
      }

      return result;
    } catch (error) {
      // Track failed expansion usage for analytics (with error isolation)
      try {
        const originalSnippet = this.convertToTextSnippet(snippet);
        await logExpansionUsage(
          originalSnippet,
          false,
          `Dependency expansion failed: ${(error as Error).message}`,
          {
            targetElement: "dependency-resolved",
            url:
              typeof window !== "undefined" ? window.location.href : "unknown",
            userAgent:
              typeof navigator !== "undefined"
                ? navigator.userAgent
                : "unknown",
          },
        );
      } catch (trackingError) {
        // Usage tracking errors should not affect expansion
        console.warn(
          "⚠️ Failed dependency expansion usage tracking failed:",
          trackingError,
        );
      }

      // Determine error type based on error message
      let errorType: ExpansionErrorType = "UNKNOWN_ERROR";
      if ((error as Error).message.includes("Circular dependency")) {
        errorType = "CIRCULAR_DEPENDENCY";
      } else if ((error as Error).message.includes("Maximum recursion depth")) {
        errorType = "RECURSIVE_LIMIT_EXCEEDED";
      }

      return this.createErrorResult(
        errorType,
        `Expansion failed: ${(error as Error).message}`,
        snippet,
        context,
        startTime,
      );
    }
  }

  /**
   * Resolve dependencies recursively
   */
  async resolveDependencies(
    snippet: TextSnippet | EnhancedSnippet,
    context: DependencyResolutionContext,
    resolutionPath: string[] = [],
  ): Promise<ResolvedDependency[]> {
    const dependencies = this.resolver.extractDependencies(snippet);

    if (dependencies.length === 0) {
      return [];
    }

    // Check recursion depth
    if (context.currentDepth >= context.maxDepth) {
      throw new Error(`Maximum recursion depth ${context.maxDepth} exceeded`);
    }

    // Check for circular dependencies
    if (resolutionPath.includes(snippet.id)) {
      const circularError = new Error(
        `Circular dependency detected: ${resolutionPath.join(" -> ")} -> ${snippet.id}`,
      );

      // Add to global error tracking
      this.currentExpansionErrors.push({
        type: "CIRCULAR_DEPENDENCY",
        message: circularError.message,
        severity: "ERROR",
        errorCode: "EXP_CIRCULAR_DEPENDENCY",
        resolutionPath: resolutionPath,
      });

      if (context.errorHandling.circularDependencyStrategy === "FAIL") {
        throw circularError;
      }
      console.warn(`Warning: ${circularError.message}`);
      return [];
    }

    // Also check for circular dependencies in the snippet's dependencies
    const snippetDependencies = this.resolver.extractDependencies(snippet);
    for (const dep of snippetDependencies) {
      // Check if this dependency references any snippet in the resolution path
      const parsedDep = this.resolver.parseDependency(dep);
      if (!parsedDep.isValid) {
        // For simplified dependencies, try to find the snippet
        const foundSnippet = this.resolveByTrigger(dep, context);
        if (foundSnippet && resolutionPath.includes(foundSnippet.id)) {
          const circularError = new Error(
            `Circular dependency detected: ${resolutionPath.join(" -> ")} -> ${snippet.id} -> ${foundSnippet.id}`,
          );

          // Add to global error tracking
          this.currentExpansionErrors.push({
            type: "CIRCULAR_DEPENDENCY",
            message: circularError.message,
            severity: "ERROR",
            errorCode: "EXP_CIRCULAR_DEPENDENCY",
            resolutionPath: resolutionPath,
          });

          if (context.errorHandling.circularDependencyStrategy === "FAIL") {
            throw circularError;
          }
          console.warn(`Warning: ${circularError.message}`);
          return [];
        }
      } else {
        // Check if the dependency ID is in the resolution path
        if (resolutionPath.includes(parsedDep.id)) {
          const circularError = new Error(
            `Circular dependency detected: ${resolutionPath.join(" -> ")} -> ${snippet.id} -> ${parsedDep.id}`,
          );

          // Add to global error tracking
          this.currentExpansionErrors.push({
            type: "CIRCULAR_DEPENDENCY",
            message: circularError.message,
            severity: "ERROR",
            errorCode: "EXP_CIRCULAR_DEPENDENCY",
            resolutionPath: resolutionPath,
          });

          if (context.errorHandling.circularDependencyStrategy === "FAIL") {
            throw circularError;
          }
          console.warn(`Warning: ${circularError.message}`);
          return [];
        }
      }
    }

    // Resolve dependencies based on strategy
    return await this.resolveWithStrategy(
      dependencies,
      context,
      this.selectStrategy(context),
      [...resolutionPath, snippet.id],
    );
  }

  /**
   * Normalize dependencies to handle simplified formats
   */
  private normalizeDependencies(
    dependencies: string[],
    context: DependencyResolutionContext,
  ): string[] {
    return dependencies.map((dep) => {
      // If already in full format, return as-is
      if (dep.includes(":") && dep.split(":").length === 3) {
        return dep;
      }

      // Handle simplified trigger format like ";a"
      if (dep.startsWith(";")) {
        // Try to find the snippet by trigger in all available stores
        for (const [storeName, storeInfo] of Object.entries(
          context.availableStores,
        )) {
          const foundSnippet = storeInfo.snippets.find(
            (s) => s.trigger === dep,
          );
          if (foundSnippet) {
            return `${storeName}:${dep}:${foundSnippet.id}`;
          }
        }
        // If not found, use the first available store as fallback
        const firstStore = Object.keys(context.availableStores)[0];
        if (firstStore) {
          return `${firstStore}:${dep}:${dep.replace(";", "")}`;
        }
      }

      // Return as-is if we can't normalize it
      return dep;
    });
  }

  /**
   * Resolve dependencies with specific strategy
   */
  private async resolveWithStrategy(
    dependencies: string[],
    context: DependencyResolutionContext,
    strategy: ExpansionStrategy,
    resolutionPath: string[] = [],
  ): Promise<ResolvedDependency[]> {
    if (strategy.parallel) {
      return await this.resolveParallel(
        dependencies,
        context,
        strategy,
        resolutionPath,
      );
    } else {
      return await this.resolveSequential(
        dependencies,
        context,
        strategy,
        resolutionPath,
      );
    }
  }

  /**
   * Resolve dependencies in parallel
   */
  private async resolveParallel(
    dependencies: string[],
    context: DependencyResolutionContext,
    strategy: ExpansionStrategy,
    resolutionPath: string[] = [],
  ): Promise<ResolvedDependency[]> {
    const results: ResolvedDependency[] = [];
    const semaphore = new Semaphore(strategy.maxConcurrency);

    const promises = dependencies.map(async (dependency) => {
      await semaphore.acquire();
      try {
        return await this.resolveSingleDependency(
          dependency,
          context,
          resolutionPath,
        );
      } finally {
        semaphore.release();
      }
    });

    const resolvedResults = await Promise.allSettled(promises);

    for (const result of resolvedResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      } else if (result.status === "rejected") {
        // Handle individual dependency resolution failure
        this.handleDependencyResolutionError(result.reason, context);
      }
    }

    return results;
  }

  /**
   * Resolve dependencies sequentially
   */
  private async resolveSequential(
    dependencies: string[],
    context: DependencyResolutionContext,
    strategy: ExpansionStrategy,
    resolutionPath: string[] = [],
  ): Promise<ResolvedDependency[]> {
    const results: ResolvedDependency[] = [];

    for (const dependency of dependencies) {
      try {
        const resolved = await this.resolveSingleDependency(
          dependency,
          context,
          resolutionPath,
        );
        if (resolved) {
          results.push(resolved);
        }
      } catch (error) {
        this.handleDependencyResolutionError(error, context);
      }
    }

    return results;
  }

  /**
   * Resolve a single dependency
   */
  private async resolveSingleDependency(
    dependency: string,
    context: DependencyResolutionContext,
    resolutionPath: string[] = [],
  ): Promise<ResolvedDependency | null> {
    const startTime = Date.now();

    // Check if already being resolved (prevent duplicate work)
    if (this.activeResolutions.has(dependency)) {
      return await this.activeResolutions.get(dependency)!;
    }

    // Create resolution promise
    const resolutionPromise = this.performSingleDependencyResolution(
      dependency,
      context,
      startTime,
      resolutionPath,
    );

    this.activeResolutions.set(dependency, resolutionPromise);

    try {
      const result = await resolutionPromise;
      return result;
    } finally {
      this.activeResolutions.delete(dependency);
    }
  }

  /**
   * Perform actual single dependency resolution
   */
  private async performSingleDependencyResolution(
    dependency: string,
    context: DependencyResolutionContext,
    startTime: number,
    resolutionPath: string[] = [],
  ): Promise<ResolvedDependency | null> {
    // Parse dependency
    const parsedDependency = this.resolver.parseDependency(dependency);
    if (!parsedDependency.isValid) {
      // For simplified dependency formats like ";a", try to resolve directly
      const fallbackResult = this.resolveByTrigger(dependency, context);
      if (fallbackResult) {
        // Use the fallback result instead of failing
        const expandedContent = await this.expandVariables(
          fallbackResult.content,
          context.variableContext,
          fallbackResult,
        );

        // Resolve nested dependencies recursively
        const nestedContext: DependencyResolutionContext = {
          ...context,
          currentDepth: context.currentDepth + 1,
          rootSnippet: fallbackResult,
        };

        const nestedDependencies = await this.resolveDependencies(
          fallbackResult,
          nestedContext,
          resolutionPath,
        );

        // Create resolved dependency with simplified format
        const resolvedDependency: ResolvedDependency = {
          originalDependency: dependency,
          resolvedSnippet: fallbackResult,
          resolvedContent: expandedContent,
          nestedDependencies,
          resolutionPath: [dependency],
          resolutionDepth: context.currentDepth + 1,
          metadata: {
            sourceStore: this.getStoreNameFromResolution(
              dependency,
              fallbackResult,
              context,
            ),
            resolutionTime: Date.now() - startTime,
            fromCache: false,
            variablesResolved: this.countVariables(expandedContent),
            nestedDependencyCount: nestedDependencies.length,
            resolutionMethod: "DIRECT",
            warnings: [],
          },
          timestamp: new Date(),
        };

        return resolvedDependency;
      }

      this.handleDependencyError(
        "INVALID_FORMAT",
        `Invalid dependency format: ${dependency}`,
        dependency,
        context,
        this.currentExpansionErrors,
      );
      return null;
    }

    // Resolve dependency
    const resolutionResult = this.resolver.resolveDependency(
      dependency,
      context.availableStores,
    );

    if (!resolutionResult.resolved || !resolutionResult.snippet) {
      // If standard resolution failed, try to resolve by trigger directly
      const fallbackResult = this.resolveByTrigger(dependency, context);
      if (fallbackResult) {
        // Update the resolutionResult with the fallback
        resolutionResult.resolved = true;
        resolutionResult.snippet = fallbackResult;
      } else {
        this.handleDependencyError(
          "MISSING_DEPENDENCY",
          `Dependency not found: ${dependency}`,
          dependency,
          context,
          this.currentExpansionErrors,
        );
        return null;
      }
    }

    // Validate dependency
    const validationContext: ValidationContext = {
      availableStores: context.availableStores,
      currentStore: parsedDependency.storeName,
      validationOptions: {
        validateStoreExistence: true,
        validateSnippetExistence: true,
        detectCircularDependencies: true,
        maxValidationDepth: context.maxDepth,
        enableCaching: context.enableCaching,
      },
    };

    const validationResult = await this.validator.validateSnippet(
      resolutionResult.snippet,
      validationContext,
    );

    if (!validationResult.isValid) {
      // Handle validation errors
      for (const error of validationResult.errors) {
        this.handleDependencyError(
          this.mapValidationErrorType(error.type),
          error.message,
          dependency,
          context,
        );
      }
      return null;
    }

    // Resolve nested dependencies recursively
    const nestedContext: DependencyResolutionContext = {
      ...context,
      currentDepth: context.currentDepth + 1,
      rootSnippet: resolutionResult.snippet,
    };

    const nestedDependencies = await this.resolveDependencies(
      resolutionResult.snippet,
      nestedContext,
      resolutionPath,
    );

    // Expand content with variables
    const expandedContent = await this.expandVariables(
      resolutionResult.snippet.content,
      context.variableContext,
      resolutionResult.snippet,
    );

    // Create resolved dependency
    const resolvedDependency: ResolvedDependency = {
      originalDependency: dependency,
      resolvedSnippet: resolutionResult.snippet,
      resolvedContent: expandedContent,
      nestedDependencies,
      resolutionPath: [dependency],
      resolutionDepth: context.currentDepth + 1,
      metadata: {
        sourceStore: parsedDependency.isValid
          ? parsedDependency.storeName
          : this.getStoreNameFromResolution(
              dependency,
              resolutionResult.snippet,
              context,
            ),
        resolutionTime: Date.now() - startTime,
        fromCache: false,
        variablesResolved: this.countVariables(expandedContent),
        nestedDependencyCount: nestedDependencies.length,
        resolutionMethod: "RECURSIVE",
        warnings: [],
      },
      timestamp: new Date(),
    };

    // Execute dependency resolution hook
    for (const hook of this.hooks.filter((h) => h.onDependencyResolved)) {
      await hook.onDependencyResolved!(resolvedDependency);
    }

    return resolvedDependency;
  }

  /**
   * Expand content with resolved dependencies
   */
  private async expandContentWithDependencies(
    snippet: TextSnippet | EnhancedSnippet,
    resolvedDependencies: ResolvedDependency[],
    context: DependencyResolutionContext,
  ): Promise<string> {
    let expandedContent = snippet.content;

    // Replace dependency references with resolved content
    for (const dependency of resolvedDependencies) {
      // Extract the original trigger from the dependency
      const parsedDep = this.resolver.parseDependency(
        dependency.originalDependency,
      );
      const triggerToReplace = parsedDep.isValid
        ? parsedDep.trigger
        : dependency.originalDependency;

      // Replace all occurrences of the trigger with the resolved content
      expandedContent = expandedContent.replace(
        new RegExp(this.escapeRegExp(triggerToReplace), "g"),
        dependency.resolvedContent,
      );
    }

    // Expand variables
    expandedContent = await this.expandVariables(
      expandedContent,
      context.variableContext,
      snippet,
    );

    return expandedContent;
  }

  /**
   * Expand variables in content
   */
  private async expandVariables(
    content: string,
    variableContext: VariableResolutionContext,
    snippet?: TextSnippet | EnhancedSnippet,
  ): Promise<string> {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    let expandedContent = content;
    let match;

    // Build default values from snippet if available
    if (snippet && snippet.variables && snippet.variables.length > 0) {
      for (const variable of snippet.variables) {
        if (
          variable.defaultValue &&
          !variableContext.defaultValues.has(variable.name)
        ) {
          variableContext.defaultValues.set(
            variable.name,
            variable.defaultValue,
          );
        }
      }
    }

    // Reset the regex lastIndex to avoid issues with global regex
    variableRegex.lastIndex = 0;

    while ((match = variableRegex.exec(content)) !== null) {
      const variableName = match[1].trim();
      const variableValue = await this.resolveVariable(
        variableName,
        variableContext,
      );

      expandedContent = expandedContent.replace(match[0], variableValue);

      // Execute variable resolution hook
      for (const hook of this.hooks.filter((h) => h.onVariableResolved)) {
        await hook.onVariableResolved!(variableName, variableValue);
      }
    }

    return expandedContent;
  }

  /**
   * Resolve a single variable
   */
  private async resolveVariable(
    variableName: string,
    variableContext: VariableResolutionContext,
  ): Promise<string> {
    // Check for existing value
    if (variableContext.variables.has(variableName)) {
      return variableContext.variables.get(variableName)!;
    }

    // Check for custom resolution callback
    if (variableContext.resolutionCallbacks.has(variableName)) {
      const callback = variableContext.resolutionCallbacks.get(variableName)!;
      const resolvedValue = await callback.resolve(variableContext);

      // Validate resolved value
      if (callback.validate && !callback.validate(resolvedValue)) {
        throw new Error(
          callback.errorMessage || `Invalid value for variable ${variableName}`,
        );
      }

      return resolvedValue;
    }

    // Check for default value
    if (variableContext.defaultValues.has(variableName)) {
      return variableContext.defaultValues.get(variableName)!;
    }

    // Handle based on resolution mode
    switch (variableContext.resolutionMode) {
      case "PROMPT":
        return await this.promptForVariable(variableName, variableContext);
      case "DEFAULT":
        return `{{${variableName}}}`;
      case "CONTEXT":
        return await this.resolveFromContext(variableName, variableContext);
      case "INTERACTIVE":
        return await this.interactiveVariableResolution(
          variableName,
          variableContext,
        );
      default:
        return `{{${variableName}}}`;
    }
  }

  /**
   * Select appropriate expansion strategy
   */
  private selectStrategy(
    context: DependencyResolutionContext,
  ): ExpansionStrategy {
    // Simple strategy selection based on context
    if (context.performanceSettings.lazyLoading) {
      return EXPANSION_STRATEGIES.LAZY;
    }

    if (context.performanceSettings.maxParallelResolutions > 1) {
      return EXPANSION_STRATEGIES.PARALLEL;
    }

    return EXPANSION_STRATEGIES.BASIC;
  }

  /**
   * Handle dependency resolution errors
   */
  private handleDependencyError(
    type: ExpansionErrorType,
    message: string,
    dependency: string,
    context: DependencyResolutionContext,
    errors?: ExpansionError[],
  ): void {
    const error: ExpansionError = {
      type,
      message,
      dependency,
      severity: "ERROR",
      errorCode: `EXP_${type}`,
      suggestions: this.generateErrorSuggestions(type, dependency),
    };

    // Add to errors array if provided
    if (errors) {
      errors.push(error);
    }

    // Execute error hooks
    for (const hook of this.hooks.filter((h) => h.onError)) {
      hook.onError!(error);
    }

    // Apply error handling strategy
    switch (type) {
      case "MISSING_DEPENDENCY":
        this.handleMissingDependency(error, context);
        break;
      case "CIRCULAR_DEPENDENCY":
        this.handleCircularDependency(error, context);
        break;
      default:
        // Default error handling
        if (context.errorHandling.collectErrorStats) {
          this.updateErrorStats(type);
        }
        break;
    }
  }

  /**
   * Handle missing dependency based on strategy
   */
  private handleMissingDependency(
    error: ExpansionError,
    context: DependencyResolutionContext,
  ): void {
    switch (context.errorHandling.missingDependencyStrategy) {
      case "FAIL":
        throw new Error(error.message);
      case "WARN":
        console.warn(`Warning: ${error.message}`);
        break;
      case "IGNORE":
        // Silent ignore
        break;
      case "PLACEHOLDER":
        // Will be handled by content expansion
        break;
    }
  }

  /**
   * Handle circular dependency based on strategy
   */
  private handleCircularDependency(
    error: ExpansionError,
    context: DependencyResolutionContext,
  ): void {
    switch (context.errorHandling.circularDependencyStrategy) {
      case "FAIL":
        throw new Error(error.message);
      case "WARN":
        console.warn(`Warning: ${error.message}`);
        break;
      case "BREAK":
        // Break the circular chain
        break;
      case "IGNORE":
        // Silent ignore
        break;
    }
  }

  /**
   * Generate error suggestions based on error type
   */
  private generateErrorSuggestions(
    type: ExpansionErrorType,
    dependency: string,
  ): string[] {
    switch (type) {
      case "MISSING_DEPENDENCY":
        return [
          `Create snippet with dependency: ${dependency}`,
          "Check if dependency exists in available stores",
          "Verify dependency format: store-name:trigger:id",
        ];
      case "CIRCULAR_DEPENDENCY":
        return [
          "Break the circular dependency chain",
          "Refactor snippets to avoid circular references",
          "Use conditional dependencies",
        ];
      case "INVALID_FORMAT":
        return [
          "Use format: store-name:trigger:id",
          "Check for typos in dependency string",
          "Verify dependency syntax",
        ];
      default:
        return ["Check dependency configuration"];
    }
  }

  /**
   * Helper methods for result creation
   */
  private createSuccessResult(
    expandedContent: string,
    originalSnippet: TextSnippet | EnhancedSnippet,
    resolvedDependencies: ResolvedDependency[],
    context: DependencyResolutionContext,
    startTime: number,
  ): ExpansionResult {
    return {
      success: true,
      expandedContent,
      originalSnippet,
      resolvedDependencies,
      variablesUsed: new Map(), // TODO: Extract from expansion
      errors: [],
      warnings: [],
      performanceMetrics: this.calculatePerformanceMetrics(
        startTime,
        resolvedDependencies,
      ),
      context,
      timestamp: new Date(),
    };
  }

  private createErrorResult(
    errorType: ExpansionErrorType,
    message: string,
    originalSnippet: TextSnippet | EnhancedSnippet,
    context: DependencyResolutionContext,
    startTime: number,
  ): ExpansionResult {
    return {
      success: false,
      expandedContent: "",
      originalSnippet,
      resolvedDependencies: [],
      variablesUsed: new Map(),
      errors: [
        {
          type: errorType,
          message,
          severity: "ERROR",
          errorCode: `EXP_${errorType}`,
        },
      ],
      warnings: [],
      performanceMetrics: this.calculatePerformanceMetrics(startTime, []),
      context,
      timestamp: new Date(),
    };
  }

  private calculatePerformanceMetrics(
    startTime: number,
    resolvedDependencies: ResolvedDependency[],
  ): ExpansionPerformanceMetrics {
    const totalTime = Date.now() - startTime;
    const dependencyResolutionTime = resolvedDependencies.reduce(
      (sum, dep) => sum + dep.metadata.resolutionTime,
      0,
    );

    // Calculate maximum dependency depth
    const maxDependencyDepth =
      resolvedDependencies.length > 0
        ? Math.max(...resolvedDependencies.map((d) => d.resolutionDepth))
        : 0;

    // Count variables resolved
    const variablesResolved = resolvedDependencies.reduce(
      (sum, dep) => sum + dep.metadata.variablesResolved,
      0,
    );

    return {
      totalExpansionTime: Math.max(totalTime, 1), // Ensure at least 1ms
      dependencyResolutionTime,
      variableResolutionTime: 0, // TODO: Track variable resolution time
      contentGenerationTime: Math.max(totalTime - dependencyResolutionTime, 0),
      dependenciesResolved: resolvedDependencies.length,
      variablesResolved,
      maxDependencyDepth,
      cacheHitRate: 0, // TODO: Calculate cache hit rate
      memoryUsagePeak: 0, // TODO: Track memory usage
      networkRequests: 0, // TODO: Track network requests
    };
  }

  /**
   * Cache management methods
   */
  private generateCacheKey(
    snippet: TextSnippet | EnhancedSnippet,
    context: DependencyResolutionContext,
  ): string {
    const contextHash = JSON.stringify({
      maxDepth: context.maxDepth,
      currentDepth: context.currentDepth,
      variableContext: context.variableContext.variables,
      performanceSettings: context.performanceSettings,
    });

    return `${snippet.id}-${contextHash}`;
  }

  private isCacheValid(entry: ExpansionCacheEntry): boolean {
    const now = Date.now();
    return now - entry.timestamp.getTime() < entry.ttl;
  }

  private cacheResult(
    key: string,
    result: ExpansionResult,
    context: DependencyResolutionContext,
  ): void {
    const entry: ExpansionCacheEntry = {
      key,
      result,
      timestamp: new Date(),
      ttl: context.performanceSettings.cacheSettings.cacheTtl,
      metadata: {
        hitCount: 0,
        lastAccess: new Date(),
        size: JSON.stringify(result).length,
        tags: [],
        dependencies: result.resolvedDependencies.map(
          (d) => d.originalDependency,
        ),
      },
    };

    this.cache.set(key, entry);
    this.evictCacheIfNeeded(context);
  }

  private evictCacheIfNeeded(context: DependencyResolutionContext): void {
    const maxSize = context.performanceSettings.cacheSettings.maxCacheSize;
    if (this.cache.size <= maxSize) return;

    const strategy = context.performanceSettings.cacheSettings.evictionStrategy;

    switch (strategy) {
      case "LRU":
        this.evictLRU();
        break;
      case "LFU":
        this.evictLFU();
        break;
      case "FIFO":
        this.evictFIFO();
        break;
    }
  }

  private evictLRU(): void {
    let oldestEntry: ExpansionCacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (
        !oldestEntry ||
        entry.metadata.lastAccess < oldestEntry.metadata.lastAccess
      ) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private evictLFU(): void {
    let leastUsedEntry: ExpansionCacheEntry | null = null;
    let leastUsedKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (
        !leastUsedEntry ||
        entry.metadata.hitCount < leastUsedEntry.metadata.hitCount
      ) {
        leastUsedEntry = entry;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
    }
  }

  private evictFIFO(): void {
    let oldestEntry: ExpansionCacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (!oldestEntry || entry.timestamp < oldestEntry.timestamp) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private updateCacheStats(entry: ExpansionCacheEntry): void {
    entry.metadata.hitCount++;
    entry.metadata.lastAccess = new Date();
  }

  /**
   * Statistics and utility methods
   */
  private updateStats(result: ExpansionResult, startTime: number): void {
    this.stats.totalExpansions++;

    if (result.success) {
      this.stats.successfulExpansions++;
    } else {
      this.stats.failedExpansions++;

      // Update error statistics
      for (const error of result.errors) {
        this.updateErrorStats(error.type);
      }
    }

    // Update timing statistics
    const expansionTime = Date.now() - startTime;
    this.stats.averageExpansionTime =
      (this.stats.averageExpansionTime * (this.stats.totalExpansions - 1) +
        expansionTime) /
      this.stats.totalExpansions;
  }

  private updateErrorStats(errorType: ExpansionErrorType): void {
    const currentCount = this.stats.mostCommonErrors.get(errorType) || 0;
    this.stats.mostCommonErrors.set(errorType, currentCount + 1);
  }

  private mapValidationErrorType(validationType: string): ExpansionErrorType {
    switch (validationType) {
      case "MISSING_STORE":
      case "MISSING_SNIPPET":
        return "MISSING_DEPENDENCY";
      case "CIRCULAR_DEPENDENCY":
        return "CIRCULAR_DEPENDENCY";
      case "INVALID_FORMAT":
        return "INVALID_FORMAT";
      case "PERMISSION_DENIED":
        return "PERMISSION_DENIED";
      case "NETWORK_ERROR":
        return "NETWORK_ERROR";
      case "VALIDATION_TIMEOUT":
        return "TIMEOUT";
      default:
        return "UNKNOWN_ERROR";
    }
  }

  private countVariables(content: string): number {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const matches = content.match(variableRegex);
    return matches ? matches.length : 0;
  }

  private generateDependencyPlaceholder(
    dependency: ResolvedDependency,
  ): string {
    return `{{DEPENDENCY:${dependency.originalDependency}}}`;
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private resolveByTrigger(
    dependency: string,
    context: DependencyResolutionContext,
  ): TextSnippet | EnhancedSnippet | null {
    // Try to resolve by trigger directly if it's a simple trigger format
    const parsedDep = this.resolver.parseDependency(dependency);

    if (!parsedDep.isValid) {
      // If it looks like a simple trigger (e.g., ";a"), try to find it directly
      if (dependency.startsWith(";")) {
        for (const [storeName, storeInfo] of Object.entries(
          context.availableStores,
        )) {
          const foundSnippet = storeInfo.snippets.find(
            (s) => s.trigger === dependency,
          );
          if (foundSnippet) {
            return foundSnippet;
          }
        }
      }
      return null;
    }

    // If parsed successfully, try to find by ID or trigger
    for (const [storeName, storeInfo] of Object.entries(
      context.availableStores,
    )) {
      if (storeName === parsedDep.storeName) {
        // First try by ID
        let foundSnippet = storeInfo.snippets.find(
          (s) => s.id === parsedDep.id,
        );
        if (foundSnippet) {
          return foundSnippet;
        }

        // Then try by trigger
        foundSnippet = storeInfo.snippets.find(
          (s) => s.trigger === parsedDep.trigger,
        );
        if (foundSnippet) {
          return foundSnippet;
        }
      }
    }

    return null;
  }

  private getStoreNameFromResolution(
    dependency: string,
    snippet: TextSnippet | EnhancedSnippet,
    context: DependencyResolutionContext,
  ): string {
    // Find which store this snippet belongs to
    for (const [storeName, storeInfo] of Object.entries(
      context.availableStores,
    )) {
      if (storeInfo.snippets.some((s) => s.id === snippet.id)) {
        return storeInfo.storeId;
      }
    }
    return "unknown";
  }

  private flattenDependencies(
    dependencies: ResolvedDependency[],
  ): ResolvedDependency[] {
    const flattened: ResolvedDependency[] = [];
    const seen = new Set<string>();

    function flatten(deps: ResolvedDependency[]) {
      for (const dep of deps) {
        if (!seen.has(dep.originalDependency)) {
          seen.add(dep.originalDependency);
          flattened.push(dep);
          // Recursively flatten nested dependencies
          flatten(dep.nestedDependencies);
        }
      }
    }

    flatten(dependencies);
    return flattened;
  }

  private async promptForVariable(
    variableName: string,
    context: VariableResolutionContext,
  ): Promise<string> {
    // TODO: Implement actual prompting mechanism
    return `[Variable: ${variableName}]`;
  }

  private async resolveFromContext(
    variableName: string,
    context: VariableResolutionContext,
  ): Promise<string> {
    // TODO: Implement context-based resolution
    return `[Context: ${variableName}]`;
  }

  private async interactiveVariableResolution(
    variableName: string,
    context: VariableResolutionContext,
  ): Promise<string> {
    // TODO: Implement interactive resolution
    return `[Interactive: ${variableName}]`;
  }

  private handleDependencyResolutionError(
    error: any,
    context: DependencyResolutionContext,
  ): void {
    console.error("Dependency resolution error:", error);

    // Check if this is a circular dependency error and strategy is FAIL
    if (error.message && error.message.includes("Circular dependency")) {
      if (context.errorHandling?.circularDependencyStrategy === "FAIL") {
        // Re-throw the error to propagate it up and fail the expansion
        throw error;
      }
    }

    // Check if this is a recursion depth error and strategy is FAIL
    if (error.message && error.message.includes("Maximum recursion depth")) {
      if (context.errorHandling?.recursionStrategy === "FAIL") {
        // Re-throw the error to propagate it up and fail the expansion
        throw error;
      }
    }

    // For other errors or non-FAIL strategies, just add to current expansion errors
    this.currentExpansionErrors.push({
      type: (error as Error).message?.includes("Circular dependency")
        ? "CIRCULAR_DEPENDENCY"
        : "UNKNOWN_ERROR",
      message:
        (error as Error).message || "Unknown dependency resolution error",
      severity: "ERROR",
      errorCode: "DEPENDENCY_RESOLUTION_ERROR",
      timestamp: Date.now(),
    });
  }

  /**
   * Public API methods
   */
  addExpansionHook(hook: ExpansionHook): void {
    this.hooks.push(hook);
    this.hooks.sort((a, b) => a.priority - b.priority);
  }

  removeExpansionHook(name: string): void {
    this.hooks = this.hooks.filter((hook) => hook.name !== name);
  }

  getExpansionStats(): ExpansionStats {
    return { ...this.stats };
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { cacheSize: number; hitRate: number } {
    const totalHits = Array.from(this.cache.values()).reduce(
      (sum, entry) => sum + entry.metadata.hitCount,
      0,
    );
    const hitRate =
      this.stats.totalExpansions > 0
        ? totalHits / this.stats.totalExpansions
        : 0;

    return {
      cacheSize: this.cache.size,
      hitRate,
    };
  }

  /**
   * Convert snippet to TextSnippet format for usage tracking
   */
  private convertToTextSnippet(
    snippet: TextSnippet | EnhancedSnippet,
  ): TextSnippet {
    // If it's already a TextSnippet, return it
    if ("trigger" in snippet && "content" in snippet && "id" in snippet) {
      return snippet as TextSnippet;
    }

    // Convert EnhancedSnippet to TextSnippet format
    const enhanced = snippet as EnhancedSnippet;
    return {
      id: enhanced.id,
      trigger: enhanced.trigger,
      content: enhanced.content || "",
      contentType: enhanced.contentType,
      scope: enhanced.scope || "personal",
      description: enhanced.description || "",
      variables: (enhanced.variables || []).map((v) => ({
        name: v.name,
        placeholder: v.prompt || v.name,
        defaultValue: v.defaultValue,
        required: false,
        type: "text" as const,
      })),
      tags: enhanced.tags || [],
      createdAt: enhanced.createdAt ? new Date(enhanced.createdAt) : new Date(),
      updatedAt: enhanced.updatedAt ? new Date(enhanced.updatedAt) : new Date(),
    };
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!;
      this.permits--;
      resolve();
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Global expansion manager instance
 */
let globalExpansionManager: ExpansionDependencyManager | null = null;

/**
 * Get or create the global expansion manager
 */
export function getExpansionDependencyManager(): ExpansionDependencyManager {
  if (!globalExpansionManager) {
    globalExpansionManager = new ExpansionDependencyManager();
  }
  return globalExpansionManager;
}

/**
 * Expand snippet with dependencies (convenience function)
 */
export async function expandWithDependencies(
  snippet: TextSnippet | EnhancedSnippet,
  context: DependencyResolutionContext,
): Promise<ExpansionResult> {
  return getExpansionDependencyManager().expandWithDependencies(
    snippet,
    context,
  );
}

/**
 * Resolve dependencies for a snippet (convenience function)
 */
export async function resolveDependencies(
  snippet: TextSnippet | EnhancedSnippet,
  context: DependencyResolutionContext,
): Promise<ResolvedDependency[]> {
  return getExpansionDependencyManager().resolveDependencies(snippet, context);
}
