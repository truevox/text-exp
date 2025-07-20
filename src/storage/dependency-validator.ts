/**
 * Dependency Validation System
 * High-level validation orchestrator for snippet dependencies
 * Uses SnippetDependencyResolver as foundation for comprehensive validation
 */

import type { TextSnippet } from "../shared/types.js";
import type { EnhancedSnippet } from "../types/snippet-formats.js";
import type { StoreSnippetMap } from "./snippet-dependency-resolver.js";

// ============================================================================
// VALIDATION INTERFACES
// ============================================================================

/**
 * Error types for dependency validation
 */
export type ValidationErrorType =
  | "MISSING_STORE"
  | "MISSING_SNIPPET"
  | "CIRCULAR_DEPENDENCY"
  | "INVALID_FORMAT"
  | "PERMISSION_DENIED"
  | "NETWORK_ERROR"
  | "VALIDATION_TIMEOUT";

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = "ERROR" | "WARNING" | "INFO";

/**
 * Individual validation error details
 */
export interface ValidationError {
  type: ValidationErrorType;
  dependency: string;
  message: string;
  severity: ValidationSeverity;
  suggestions?: string[];
  affectedSnippets?: string[];
  resolutionPath?: string[];
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  message: string;
  dependency: string;
  suggestion?: string;
  severity: "WARNING" | "INFO";
}

/**
 * Circular dependency information
 */
export interface CircularDependencyInfo {
  cycle: string[];
  affectedSnippets: string[];
  breakSuggestions: string[];
}

/**
 * Performance metrics for validation operations
 */
export interface ValidationMetrics {
  totalValidationTime: number;
  dependenciesValidated: number;
  storesAccessed: number;
  cacheHits: number;
  cacheMisses: number;
  circularDependencyChecks: number;
  maxValidationDepth: number;
}

/**
 * Configuration options for validation
 */
export interface ValidationOptions {
  /** Whether to validate store existence */
  validateStoreExistence?: boolean;

  /** Whether to validate snippet existence */
  validateSnippetExistence?: boolean;

  /** Whether to detect circular dependencies */
  detectCircularDependencies?: boolean;

  /** Maximum validation depth to prevent infinite loops */
  maxValidationDepth?: number;

  /** Whether to enable caching for performance */
  enableCaching?: boolean;

  /** Whether to generate helpful suggestions */
  generateSuggestions?: boolean;

  /** Whether to generate warnings for non-critical issues */
  generateWarnings?: boolean;

  /** Timeout for validation operations in milliseconds */
  validationTimeout?: number;

  /** Whether to perform deep validation (recursive dependency checking) */
  deepValidation?: boolean;
}

/**
 * Context information for validation operations
 */
export interface ValidationContext {
  /** Available stores for validation */
  availableStores: StoreSnippetMap;

  /** Current store being validated (for relative dependency resolution) */
  currentStore: string;

  /** Validation configuration options */
  validationOptions: ValidationOptions;

  /** User ID for permission checks */
  userId?: string;

  /** Current validation depth (for recursive validation) */
  currentDepth?: number;

  /** Validation session ID for tracking */
  sessionId?: string;
}

/**
 * Result of validation operation
 */
export interface ValidationResult {
  /** Whether validation passed without errors */
  isValid: boolean;

  /** List of validation errors */
  errors: ValidationError[];

  /** List of validation warnings */
  warnings: ValidationWarning[];

  /** Circular dependency information */
  circularDependencies: CircularDependencyInfo[];

  /** Successfully validated dependencies */
  validatedDependencies: string[];

  /** Performance metrics */
  performanceMetrics: ValidationMetrics;

  /** Validation context used */
  context: ValidationContext;

  /** Validation timestamp */
  timestamp: Date;
}

/**
 * Result of store-wide validation
 */
export interface StoreValidationResult {
  /** Store ID that was validated */
  storeId: string;

  /** Overall validation result */
  isValid: boolean;

  /** Individual snippet validation results */
  snippetResults: Map<string, ValidationResult>;

  /** Store-wide issues */
  storeErrors: ValidationError[];

  /** Store-wide warnings */
  storeWarnings: ValidationWarning[];

  /** Overall performance metrics */
  performanceMetrics: ValidationMetrics;

  /** Validation timestamp */
  timestamp: Date;
}

/**
 * Validation hook for integration with storage workflows
 */
export interface ValidationHook {
  /** Hook name for identification */
  name: string;

  /** Hook priority (lower = higher priority) */
  priority: number;

  /** Pre-validation hook */
  preValidation?: (
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ) => Promise<boolean>;

  /** Post-validation hook */
  postValidation?: (
    result: ValidationResult,
    context: ValidationContext,
  ) => Promise<void>;

  /** Error handling hook */
  onError?: (
    error: ValidationError,
    context: ValidationContext,
  ) => Promise<void>;
}

/**
 * Validation statistics for monitoring
 */
export interface ValidationStats {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  cacheHitRate: number;
  mostCommonErrors: Map<ValidationErrorType, number>;
  validationsByStore: Map<string, number>;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default validation options
 */
export const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  validateStoreExistence: true,
  validateSnippetExistence: true,
  detectCircularDependencies: true,
  maxValidationDepth: 50,
  enableCaching: true,
  generateSuggestions: true,
  generateWarnings: true,
  validationTimeout: 30000, // 30 seconds
  deepValidation: true,
};

/**
 * Performance-optimized validation options
 */
export const FAST_VALIDATION_OPTIONS: ValidationOptions = {
  validateStoreExistence: true,
  validateSnippetExistence: false,
  detectCircularDependencies: false,
  maxValidationDepth: 10,
  enableCaching: true,
  generateSuggestions: false,
  generateWarnings: false,
  validationTimeout: 5000, // 5 seconds
  deepValidation: false,
};

/**
 * Comprehensive validation options for critical operations
 */
export const THOROUGH_VALIDATION_OPTIONS: ValidationOptions = {
  validateStoreExistence: true,
  validateSnippetExistence: true,
  detectCircularDependencies: true,
  maxValidationDepth: 100,
  enableCaching: true,
  generateSuggestions: true,
  generateWarnings: true,
  validationTimeout: 60000, // 60 seconds
  deepValidation: true,
};

// ============================================================================
// DEPENDENCY VALIDATOR IMPLEMENTATION
// ============================================================================

import {
  SnippetDependencyResolver,
  type DependencyValidationResult,
  type CircularDependencyResult,
  type DependencyResolutionResult,
} from "./snippet-dependency-resolver.js";

/**
 * High-level dependency validation orchestrator
 * Uses SnippetDependencyResolver as foundation for comprehensive validation
 */
export class DependencyValidator {
  private resolver: SnippetDependencyResolver;
  private validationCache = new Map<string, ValidationResult>();
  private storeValidationCache = new Map<string, StoreValidationResult>();
  private validationHooks: ValidationHook[] = [];
  private validationStats: ValidationStats;

  constructor(resolver?: SnippetDependencyResolver) {
    this.resolver = resolver || new SnippetDependencyResolver();
    this.validationStats = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      cacheHitRate: 0,
      mostCommonErrors: new Map(),
      validationsByStore: new Map(),
    };
  }

  /**
   * Validate a single snippet's dependencies
   */
  async validateSnippet(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const sessionId = context.sessionId || `validation-${Date.now()}`;

    // Check cache first
    const cacheKey = this.generateCacheKey(snippet, context);
    if (
      context.validationOptions.enableCaching &&
      this.validationCache.has(cacheKey)
    ) {
      return this.validationCache.get(cacheKey)!;
    }

    // Execute pre-validation hooks
    for (const hook of this.validationHooks.filter((h) => h.preValidation)) {
      const shouldContinue = await hook.preValidation!(snippet, context);
      if (!shouldContinue) {
        return this.createValidationResult(
          false,
          [],
          [],
          [],
          [],
          context,
          startTime,
        );
      }
    }

    // Extract dependencies from snippet
    const dependencies = this.resolver.extractDependencies(snippet);

    if (dependencies.length === 0) {
      // No dependencies - validation passes
      const result = this.createValidationResult(
        true,
        [],
        [],
        [],
        dependencies,
        context,
        startTime,
      );
      this.cacheResult(cacheKey, result, context);
      return result;
    }

    // Validate dependencies using resolver
    const resolverResult = this.resolver.validateDependencies(
      dependencies,
      context.availableStores,
      {
        validateStoreExistence:
          context.validationOptions.validateStoreExistence,
        validateSnippetExistence:
          context.validationOptions.validateSnippetExistence,
        generateWarnings: context.validationOptions.generateWarnings,
      },
    );

    // Safety net: If resolver incorrectly validates missing stores as valid, catch them here
    if (
      resolverResult.isValid &&
      context.validationOptions.validateStoreExistence
    ) {
      const availableStoreIds = Object.keys(context.availableStores);

      for (const dependency of dependencies) {
        const storeId = dependency.split(":")[0];

        if (storeId && !availableStoreIds.includes(storeId)) {
          const error: ValidationError = {
            type: "MISSING_STORE",
            dependency,
            message: `Store "${storeId}" does not exist`,
            severity: "ERROR",
          };

          return this.createValidationResult(
            false,
            [error],
            [],
            [],
            [],
            context,
            startTime,
          );
        }
      }
    }

    // Convert resolver result to validation result
    let validationResult = this.convertResolverResult(
      resolverResult,
      context,
      startTime,
    );

    // Perform circular dependency detection if enabled
    if (context.validationOptions.detectCircularDependencies) {
      const circularResult = await this.detectCircularDependencies(
        snippet,
        context,
      );
      validationResult = this.mergeCircularDependencyResult(
        validationResult,
        circularResult,
      );
    }

    // Perform deep validation if enabled
    if (
      context.validationOptions.deepValidation &&
      (context.currentDepth || 0) <
        (context.validationOptions.maxValidationDepth || 10)
    ) {
      validationResult = await this.performDeepValidation(
        validationResult,
        context,
      );
    }

    // Generate suggestions if enabled
    if (context.validationOptions.generateSuggestions) {
      validationResult = this.generateSuggestions(validationResult, context);
    }

    // Execute post-validation hooks
    for (const hook of this.validationHooks.filter((h) => h.postValidation)) {
      await hook.postValidation!(validationResult, context);
    }

    // Cache result and update statistics
    this.cacheResult(cacheKey, validationResult, context);
    this.updateValidationStats(validationResult, startTime);

    return validationResult;
  }

  /**
   * Validate all snippets in a store
   */
  async validateStore(
    storeId: string,
    context: ValidationContext,
  ): Promise<StoreValidationResult> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `store-${storeId}-${JSON.stringify(context.validationOptions)}`;
    if (
      context.validationOptions.enableCaching &&
      this.storeValidationCache.has(cacheKey)
    ) {
      return this.storeValidationCache.get(cacheKey)!;
    }

    const store = context.availableStores[storeId];
    if (!store) {
      return {
        storeId,
        isValid: false,
        snippetResults: new Map(),
        storeErrors: [
          {
            type: "MISSING_STORE",
            dependency: storeId,
            message: `Store "${storeId}" does not exist`,
            severity: "ERROR",
          },
        ],
        storeWarnings: [],
        performanceMetrics: this.createPerformanceMetrics(
          startTime,
          0,
          1,
          0,
          0,
          0,
          0,
        ),
        timestamp: new Date(),
      };
    }

    // Validate each snippet in the store
    const snippetResults = new Map<string, ValidationResult>();
    const storeErrors: ValidationError[] = [];
    const storeWarnings: ValidationWarning[] = [];
    let totalDependenciesValidated = 0;

    for (const snippet of store.snippets) {
      const snippetContext = {
        ...context,
        currentStore: storeId,
        currentDepth: 0,
      };

      try {
        const result = await this.validateSnippet(snippet, snippetContext);
        snippetResults.set(snippet.id, result);
        totalDependenciesValidated += result.validatedDependencies.length;

        // Collect store-wide errors and warnings
        storeErrors.push(...result.errors);
        storeWarnings.push(...result.warnings);
      } catch (error) {
        const validationError: ValidationError = {
          type: "VALIDATION_TIMEOUT",
          dependency: snippet.id,
          message: `Validation failed for snippet "${snippet.id}": ${(error as Error).message}`,
          severity: "ERROR",
          affectedSnippets: [snippet.id],
        };
        storeErrors.push(validationError);
      }
    }

    // Create store validation result
    const result: StoreValidationResult = {
      storeId,
      isValid: storeErrors.length === 0,
      snippetResults,
      storeErrors,
      storeWarnings,
      performanceMetrics: this.createPerformanceMetrics(
        startTime,
        totalDependenciesValidated,
        1,
        0,
        0,
        0,
        0,
      ),
      timestamp: new Date(),
    };

    // Cache result
    if (context.validationOptions.enableCaching) {
      this.storeValidationCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Detect circular dependencies for a snippet
   */
  private async detectCircularDependencies(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<CircularDependencyResult> {
    const snippetsToCheck = [snippet];

    // Add related snippets for comprehensive checking
    const store = context.availableStores[context.currentStore];
    if (store && context.validationOptions.deepValidation) {
      snippetsToCheck.push(...store.snippets);
    }

    return this.resolver.detectCircularDependencies(
      snippetsToCheck,
      context.availableStores,
      {
        maxResolutionDepth: context.validationOptions.maxValidationDepth,
      },
    );
  }

  /**
   * Perform deep validation by recursively validating dependencies
   */
  private async performDeepValidation(
    result: ValidationResult,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    const deepErrors: ValidationError[] = [];
    const deepWarnings: ValidationWarning[] = [];

    // Recursively validate each dependency
    for (const dependency of result.validatedDependencies) {
      const resolvedDep = this.resolver.resolveDependency(
        dependency,
        context.availableStores,
      );

      if (resolvedDep.resolved && resolvedDep.snippet) {
        const deepContext = {
          ...context,
          currentDepth: (context.currentDepth || 0) + 1,
          sessionId: context.sessionId,
        };

        try {
          const deepResult = await this.validateSnippet(
            resolvedDep.snippet,
            deepContext,
          );
          deepErrors.push(...deepResult.errors);
          deepWarnings.push(...deepResult.warnings);
        } catch (error) {
          deepErrors.push({
            type: "VALIDATION_TIMEOUT",
            dependency,
            message: `Deep validation failed for dependency "${dependency}": ${(error as Error).message}`,
            severity: "ERROR",
          });
        }
      }
    }

    return {
      ...result,
      errors: [...result.errors, ...deepErrors],
      warnings: [...result.warnings, ...deepWarnings],
      isValid: result.isValid && deepErrors.length === 0,
    };
  }

  /**
   * Generate helpful suggestions for validation errors
   */
  private generateSuggestions(
    result: ValidationResult,
    context: ValidationContext,
  ): ValidationResult {
    const updatedErrors = result.errors.map((error) => {
      const suggestions: string[] = [];

      switch (error.type) {
        case "MISSING_STORE":
          suggestions.push(`Check if store "${error.dependency}" exists`);
          suggestions.push("Verify store configuration");
          suggestions.push("Check network connectivity if using remote stores");
          break;

        case "MISSING_SNIPPET":
          suggestions.push(`Create snippet with ID "${error.dependency}"`);
          suggestions.push("Check if snippet was deleted or moved");
          suggestions.push("Verify snippet ID spelling");
          break;

        case "CIRCULAR_DEPENDENCY":
          suggestions.push("Break the circular dependency chain");
          suggestions.push("Consider refactoring snippet dependencies");
          suggestions.push("Use conditional dependencies if appropriate");
          break;

        case "INVALID_FORMAT":
          suggestions.push('Use format: "store-name:trigger:id"');
          suggestions.push("Check for typos in dependency string");
          suggestions.push("Verify dependency format documentation");
          break;

        default:
          suggestions.push("Check dependency configuration");
          suggestions.push("Verify all referenced snippets exist");
      }

      return {
        ...error,
        suggestions,
      };
    });

    return {
      ...result,
      errors: updatedErrors,
    };
  }

  /**
   * Helper methods for result conversion and caching
   */
  private convertResolverResult(
    resolverResult: DependencyValidationResult,
    context: ValidationContext,
    startTime: number,
  ): ValidationResult {
    const errors: ValidationError[] = resolverResult.errors.map((error) => ({
      type: this.mapErrorType(error),
      dependency: error,
      message: error,
      severity: "ERROR" as ValidationSeverity,
    }));

    const warnings: ValidationWarning[] = resolverResult.warnings.map(
      (warning) => ({
        message: warning,
        dependency: warning,
        severity: "WARNING",
      }),
    );

    return this.createValidationResult(
      resolverResult.isValid,
      errors,
      warnings,
      [],
      resolverResult.validDependencies.map((dep) => dep.original),
      context,
      startTime,
    );
  }

  private mapErrorType(error: string): ValidationErrorType {
    if (error.includes("does not exist")) return "MISSING_STORE";
    if (error.includes("not found")) return "MISSING_SNIPPET";
    if (error.includes("format")) return "INVALID_FORMAT";
    return "VALIDATION_TIMEOUT";
  }

  private mergeCircularDependencyResult(
    result: ValidationResult,
    circularResult: CircularDependencyResult,
  ): ValidationResult {
    const circularErrors: ValidationError[] = circularResult.cycles.map(
      (cycle) => ({
        type: "CIRCULAR_DEPENDENCY",
        dependency: cycle.join(" → "),
        message: `Circular dependency detected: ${cycle.join(" → ")}`,
        severity: "ERROR" as ValidationSeverity,
        affectedSnippets: cycle,
      }),
    );

    const circularInfo: CircularDependencyInfo[] = circularResult.cycles.map(
      (cycle) => ({
        cycle,
        affectedSnippets: cycle,
        breakSuggestions: [
          `Break dependency between ${cycle[0]} and ${cycle[1]}`,
        ],
      }),
    );

    return {
      ...result,
      errors: [...result.errors, ...circularErrors],
      circularDependencies: [...result.circularDependencies, ...circularInfo],
      isValid: result.isValid && !circularResult.hasCircularDependencies,
    };
  }

  private createValidationResult(
    isValid: boolean,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    circularDependencies: CircularDependencyInfo[],
    validatedDependencies: string[],
    context: ValidationContext,
    startTime: number,
  ): ValidationResult {
    return {
      isValid,
      errors,
      warnings,
      circularDependencies,
      validatedDependencies,
      performanceMetrics: this.createPerformanceMetrics(
        startTime,
        validatedDependencies.length,
        1,
        0,
        0,
        0,
        0,
      ),
      context,
      timestamp: new Date(),
    };
  }

  private createPerformanceMetrics(
    startTime: number,
    dependenciesValidated: number,
    storesAccessed: number,
    cacheHits: number,
    cacheMisses: number,
    circularDependencyChecks: number,
    maxValidationDepth: number,
  ): ValidationMetrics {
    return {
      totalValidationTime: Date.now() - startTime,
      dependenciesValidated,
      storesAccessed,
      cacheHits,
      cacheMisses,
      circularDependencyChecks,
      maxValidationDepth,
    };
  }

  private generateCacheKey(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): string {
    const optionsHash = JSON.stringify(context.validationOptions);
    const storeHash = Object.keys(context.availableStores).sort().join(",");
    return `${snippet.id}-${optionsHash}-${storeHash}`;
  }

  private cacheResult(
    cacheKey: string,
    result: ValidationResult,
    context: ValidationContext,
  ): void {
    if (context.validationOptions.enableCaching) {
      this.validationCache.set(cacheKey, result);
    }
  }

  private updateValidationStats(
    result: ValidationResult,
    startTime: number,
  ): void {
    this.validationStats.totalValidations++;
    if (result.isValid) {
      this.validationStats.successfulValidations++;
    } else {
      this.validationStats.failedValidations++;
    }

    // Update average validation time
    const validationTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms for statistics
    this.validationStats.averageValidationTime =
      (this.validationStats.averageValidationTime *
        (this.validationStats.totalValidations - 1) +
        validationTime) /
      this.validationStats.totalValidations;

    // Update error statistics
    for (const error of result.errors) {
      const currentCount =
        this.validationStats.mostCommonErrors.get(error.type) || 0;
      this.validationStats.mostCommonErrors.set(error.type, currentCount + 1);
    }
  }

  /**
   * Public API methods for hooks and statistics
   */
  addValidationHook(hook: ValidationHook): void {
    this.validationHooks.push(hook);
    this.validationHooks.sort((a, b) => a.priority - b.priority);
  }

  removeValidationHook(name: string): void {
    this.validationHooks = this.validationHooks.filter(
      (hook) => hook.name !== name,
    );
  }

  getValidationStats(): ValidationStats {
    return { ...this.validationStats };
  }

  clearCache(): void {
    this.validationCache.clear();
    this.storeValidationCache.clear();
  }

  getCacheStats(): {
    validationCacheSize: number;
    storeValidationCacheSize: number;
  } {
    return {
      validationCacheSize: this.validationCache.size,
      storeValidationCacheSize: this.storeValidationCache.size,
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Global validator instance
 */
let globalValidator: DependencyValidator | null = null;

/**
 * Get or create the global validator instance
 */
export function getDependencyValidator(): DependencyValidator {
  if (!globalValidator) {
    globalValidator = new DependencyValidator();
  }
  return globalValidator;
}

/**
 * Validate a single snippet (convenience function)
 */
export async function validateSnippet(
  snippet: TextSnippet | EnhancedSnippet,
  context: ValidationContext,
): Promise<ValidationResult> {
  return getDependencyValidator().validateSnippet(snippet, context);
}

/**
 * Validate entire store (convenience function)
 */
export async function validateStore(
  storeId: string,
  context: ValidationContext,
): Promise<StoreValidationResult> {
  return getDependencyValidator().validateStore(storeId, context);
}

// ============================================================================
// WORKFLOW INTEGRATION POINTS
// ============================================================================

/**
 * Validation integration for snippet creation workflow
 */
export interface SnippetCreationValidation {
  /** Validate snippet before creation */
  validateBeforeCreation(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<ValidationResult>;

  /** Validate snippet after creation (for consistency checks) */
  validateAfterCreation(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<ValidationResult>;

  /** Handle validation errors during creation */
  handleCreationValidationErrors(
    errors: ValidationError[],
    context: ValidationContext,
  ): Promise<void>;
}

/**
 * Validation integration for snippet editing workflow
 */
export interface SnippetEditingValidation {
  /** Validate snippet before editing */
  validateBeforeEdit(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<ValidationResult>;

  /** Validate snippet during editing (real-time validation) */
  validateDuringEdit(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<ValidationResult>;

  /** Validate snippet after editing */
  validateAfterEdit(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<ValidationResult>;

  /** Handle validation errors during editing */
  handleEditingValidationErrors(
    errors: ValidationError[],
    context: ValidationContext,
  ): Promise<void>;
}

/**
 * Validation integration for storage operations
 */
export interface StorageOperationValidation {
  /** Validate before saving to storage */
  validateBeforeSave(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<ValidationResult>;

  /** Validate after loading from storage */
  validateAfterLoad(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<ValidationResult>;

  /** Validate store consistency */
  validateStoreConsistency(
    storeId: string,
    context: ValidationContext,
  ): Promise<StoreValidationResult>;

  /** Handle storage validation errors */
  handleStorageValidationErrors(
    errors: ValidationError[],
    context: ValidationContext,
  ): Promise<void>;
}

/**
 * User-friendly error reporting for validation issues
 */
export interface ValidationErrorReporter {
  /** Format error message for display to user */
  formatErrorMessage(error: ValidationError): string;

  /** Generate user-friendly error summary */
  generateErrorSummary(errors: ValidationError[]): string;

  /** Create actionable error suggestions */
  createActionableSuggestions(errors: ValidationError[]): string[];

  /** Report validation progress to user */
  reportValidationProgress(progress: ValidationProgress): void;
}

/**
 * Validation progress information
 */
export interface ValidationProgress {
  /** Current validation step */
  currentStep: string;

  /** Total steps in validation */
  totalSteps: number;

  /** Current step number */
  currentStepNumber: number;

  /** Validation progress percentage */
  progressPercentage: number;

  /** Estimated time remaining */
  estimatedTimeRemaining?: number;

  /** Current snippet being validated */
  currentSnippet?: string;
}

/**
 * Workflow integration manager for validation
 */
export class ValidationWorkflowManager {
  private validator: DependencyValidator;
  private errorReporter: ValidationErrorReporter;
  private validationTriggers: Map<string, ValidationTrigger> = new Map();

  constructor(
    validator?: DependencyValidator,
    errorReporter?: ValidationErrorReporter,
  ) {
    this.validator = validator || getDependencyValidator();
    this.errorReporter = errorReporter || new DefaultValidationErrorReporter();
  }

  /**
   * Snippet creation workflow integration
   */
  async integrateSnippetCreation(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<SnippetCreationResult> {
    const startTime = Date.now();

    try {
      // Pre-creation validation
      const validationResult = await this.validator.validateSnippet(
        snippet,
        context,
      );

      if (!validationResult.isValid) {
        await this.errorReporter.reportValidationProgress({
          currentStep: "Pre-creation validation failed",
          totalSteps: 3,
          currentStepNumber: 1,
          progressPercentage: 33,
          currentSnippet: snippet.id,
        });

        return {
          success: false,
          snippet: null,
          validationResult,
          errors: validationResult.errors,
          processingTime: Date.now() - startTime,
        };
      }

      // Trigger validation hooks
      await this.triggerValidationHooks("snippet-creation", snippet, context);

      // Post-creation validation (simulate snippet creation)
      const postValidationResult = await this.validator.validateSnippet(
        snippet,
        context,
      );

      await this.errorReporter.reportValidationProgress({
        currentStep: "Creation validation completed",
        totalSteps: 3,
        currentStepNumber: 3,
        progressPercentage: 100,
        currentSnippet: snippet.id,
      });

      return {
        success: true,
        snippet,
        validationResult: postValidationResult,
        errors: [],
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      const validationError: ValidationError = {
        type: "VALIDATION_TIMEOUT",
        dependency: snippet.id,
        message: `Snippet creation validation failed: ${(error as Error).message}`,
        severity: "ERROR",
      };

      return {
        success: false,
        snippet: null,
        validationResult: null,
        errors: [validationError],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Snippet editing workflow integration
   */
  async integrateSnippetEditing(
    originalSnippet: TextSnippet | EnhancedSnippet,
    editedSnippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<SnippetEditingResult> {
    const startTime = Date.now();

    try {
      // Pre-edit validation
      const preEditValidation = await this.validator.validateSnippet(
        originalSnippet,
        context,
      );

      // During-edit validation
      const duringEditValidation = await this.validator.validateSnippet(
        editedSnippet,
        context,
      );

      if (!duringEditValidation.isValid) {
        return {
          success: false,
          originalSnippet,
          editedSnippet: null,
          validationResult: duringEditValidation,
          errors: duringEditValidation.errors,
          processingTime: Date.now() - startTime,
        };
      }

      // Trigger validation hooks
      await this.triggerValidationHooks(
        "snippet-editing",
        editedSnippet,
        context,
      );

      // Post-edit validation
      const postEditValidation = await this.validator.validateSnippet(
        editedSnippet,
        context,
      );

      return {
        success: true,
        originalSnippet,
        editedSnippet,
        validationResult: postEditValidation,
        errors: [],
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      const validationError: ValidationError = {
        type: "VALIDATION_TIMEOUT",
        dependency: editedSnippet.id,
        message: `Snippet editing validation failed: ${(error as Error).message}`,
        severity: "ERROR",
      };

      return {
        success: false,
        originalSnippet,
        editedSnippet: null,
        validationResult: null,
        errors: [validationError],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Storage operation workflow integration
   */
  async integrateStorageOperation(
    operation: StorageOperation,
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<StorageOperationResult> {
    const startTime = Date.now();

    try {
      let validationResult: ValidationResult;

      switch (operation) {
        case "save":
          validationResult = await this.validator.validateSnippet(
            snippet,
            context,
          );
          break;
        case "load":
          validationResult = await this.validator.validateSnippet(
            snippet,
            context,
          );
          break;
        case "delete":
          // Validate dependencies before deletion
          validationResult = await this.validateDependenciesBeforeDeletion(
            snippet,
            context,
          );
          break;
        default:
          throw new Error(`Unknown storage operation: ${operation}`);
      }

      // Trigger validation hooks
      await this.triggerValidationHooks(
        `storage-${operation}`,
        snippet,
        context,
      );

      return {
        success: validationResult.isValid,
        operation,
        snippet: validationResult.isValid ? snippet : null,
        validationResult,
        errors: validationResult.errors,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      const validationError: ValidationError = {
        type: "VALIDATION_TIMEOUT",
        dependency: snippet.id,
        message: `Storage operation validation failed: ${(error as Error).message}`,
        severity: "ERROR",
      };

      return {
        success: false,
        operation,
        snippet: null,
        validationResult: null,
        errors: [validationError],
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Add validation trigger for specific events
   */
  addValidationTrigger(eventName: string, trigger: ValidationTrigger): void {
    this.validationTriggers.set(eventName, trigger);
  }

  /**
   * Remove validation trigger
   */
  removeValidationTrigger(eventName: string): void {
    this.validationTriggers.delete(eventName);
  }

  /**
   * Trigger validation hooks for specific events
   */
  private async triggerValidationHooks(
    eventName: string,
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<void> {
    const trigger = this.validationTriggers.get(eventName);
    if (trigger) {
      await trigger.execute(snippet, context);
    }
  }

  /**
   * Validate dependencies before snippet deletion
   */
  private async validateDependenciesBeforeDeletion(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    // Check if other snippets depend on this snippet
    const dependentSnippets: string[] = [];

    for (const [storeId, store] of Object.entries(context.availableStores)) {
      for (const otherSnippet of store.snippets) {
        if (otherSnippet.id !== snippet.id) {
          const dependencies =
            this.validator["resolver"].extractDependencies(otherSnippet);
          const dependsOnTarget = dependencies.some((dep) => {
            const parsed = this.validator["resolver"].parseDependency(dep);
            return parsed.isValid && parsed.id === snippet.id;
          });

          if (dependsOnTarget) {
            dependentSnippets.push(otherSnippet.id);
          }
        }
      }
    }

    if (dependentSnippets.length > 0) {
      const error: ValidationError = {
        type: "MISSING_SNIPPET",
        dependency: snippet.id,
        message: `Cannot delete snippet "${snippet.id}" - it is referenced by other snippets`,
        severity: "ERROR",
        affectedSnippets: dependentSnippets,
        suggestions: [
          "Remove dependencies from other snippets first",
          "Use a different snippet ID",
          "Update dependent snippets to use alternative dependencies",
        ],
      };

      return {
        isValid: false,
        errors: [error],
        warnings: [],
        circularDependencies: [],
        validatedDependencies: [],
        performanceMetrics: {
          totalValidationTime: 0,
          dependenciesValidated: 0,
          storesAccessed: Object.keys(context.availableStores).length,
          cacheHits: 0,
          cacheMisses: 0,
          circularDependencyChecks: 0,
          maxValidationDepth: 1,
        },
        context,
        timestamp: new Date(),
      };
    }

    // No dependencies found - deletion is safe
    return {
      isValid: true,
      errors: [],
      warnings: [],
      circularDependencies: [],
      validatedDependencies: [],
      performanceMetrics: {
        totalValidationTime: 0,
        dependenciesValidated: 0,
        storesAccessed: Object.keys(context.availableStores).length,
        cacheHits: 0,
        cacheMisses: 0,
        circularDependencyChecks: 0,
        maxValidationDepth: 1,
      },
      context,
      timestamp: new Date(),
    };
  }
}

/**
 * Default validation error reporter implementation
 */
export class DefaultValidationErrorReporter implements ValidationErrorReporter {
  formatErrorMessage(error: ValidationError): string {
    const emoji = this.getErrorEmoji(error.type);
    return `${emoji} ${error.message}`;
  }

  generateErrorSummary(errors: ValidationError[]): string {
    if (errors.length === 0) return "✅ All validations passed";

    const errorsByType = new Map<ValidationErrorType, number>();
    for (const error of errors) {
      errorsByType.set(error.type, (errorsByType.get(error.type) || 0) + 1);
    }

    const summaryParts = Array.from(errorsByType.entries()).map(
      ([type, count]) => {
        const emoji = this.getErrorEmoji(type);
        return `${emoji} ${count} ${type.toLowerCase().replace("_", " ")} error${count > 1 ? "s" : ""}`;
      },
    );

    return `❌ Validation failed: ${summaryParts.join(", ")}`;
  }

  createActionableSuggestions(errors: ValidationError[]): string[] {
    const suggestions = new Set<string>();

    for (const error of errors) {
      if (error.suggestions) {
        error.suggestions.forEach((suggestion) => suggestions.add(suggestion));
      }
    }

    return Array.from(suggestions);
  }

  async reportValidationProgress(progress: ValidationProgress): Promise<void> {
    // Default implementation - log to console
    console.log(
      `[${progress.currentStepNumber}/${progress.totalSteps}] ${progress.currentStep} (${progress.progressPercentage}%)`,
    );
  }

  private getErrorEmoji(type: ValidationErrorType): string {
    switch (type) {
      case "MISSING_STORE":
        return "🏪";
      case "MISSING_SNIPPET":
        return "📄";
      case "CIRCULAR_DEPENDENCY":
        return "🔄";
      case "INVALID_FORMAT":
        return "📝";
      case "PERMISSION_DENIED":
        return "🔒";
      case "NETWORK_ERROR":
        return "🌐";
      case "VALIDATION_TIMEOUT":
        return "⏱️";
      default:
        return "❌";
    }
  }
}

// ============================================================================
// WORKFLOW INTEGRATION TYPES
// ============================================================================

export type StorageOperation = "save" | "load" | "delete";

export interface ValidationTrigger {
  execute(
    snippet: TextSnippet | EnhancedSnippet,
    context: ValidationContext,
  ): Promise<void>;
}

export interface SnippetCreationResult {
  success: boolean;
  snippet: TextSnippet | EnhancedSnippet | null;
  validationResult: ValidationResult | null;
  errors: ValidationError[];
  processingTime: number;
}

export interface SnippetEditingResult {
  success: boolean;
  originalSnippet: TextSnippet | EnhancedSnippet;
  editedSnippet: TextSnippet | EnhancedSnippet | null;
  validationResult: ValidationResult | null;
  errors: ValidationError[];
  processingTime: number;
}

export interface StorageOperationResult {
  success: boolean;
  operation: StorageOperation;
  snippet: TextSnippet | EnhancedSnippet | null;
  validationResult: ValidationResult | null;
  errors: ValidationError[];
  processingTime: number;
}

// ============================================================================
// GLOBAL WORKFLOW INTEGRATION
// ============================================================================

/**
 * Global workflow manager instance
 */
let globalWorkflowManager: ValidationWorkflowManager | null = null;

/**
 * Get or create the global workflow manager
 */
export function getValidationWorkflowManager(): ValidationWorkflowManager {
  if (!globalWorkflowManager) {
    globalWorkflowManager = new ValidationWorkflowManager();
  }
  return globalWorkflowManager;
}

/**
 * Integrate validation into snippet creation workflow (convenience function)
 */
export async function integrateSnippetCreation(
  snippet: TextSnippet | EnhancedSnippet,
  context: ValidationContext,
): Promise<SnippetCreationResult> {
  return getValidationWorkflowManager().integrateSnippetCreation(
    snippet,
    context,
  );
}

/**
 * Integrate validation into snippet editing workflow (convenience function)
 */
export async function integrateSnippetEditing(
  originalSnippet: TextSnippet | EnhancedSnippet,
  editedSnippet: TextSnippet | EnhancedSnippet,
  context: ValidationContext,
): Promise<SnippetEditingResult> {
  return getValidationWorkflowManager().integrateSnippetEditing(
    originalSnippet,
    editedSnippet,
    context,
  );
}

/**
 * Integrate validation into storage operations (convenience function)
 */
export async function integrateStorageOperation(
  operation: StorageOperation,
  snippet: TextSnippet | EnhancedSnippet,
  context: ValidationContext,
): Promise<StorageOperationResult> {
  return getValidationWorkflowManager().integrateStorageOperation(
    operation,
    snippet,
    context,
  );
}
