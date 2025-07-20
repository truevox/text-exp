/**
 * Expansion Usage Logger for PuffPuffPaste
 *
 * Provides real-time usage tracking during snippet expansion.
 * Integrates with both global and secondary store usage trackers
 * for comprehensive usage analytics.
 *
 * Key Features:
 * - Dual-tracking system (global + per-store databases)
 * - Non-blocking async operations to prevent expansion delays
 * - Error isolation - tracking failures won't break expansion
 * - Performance optimization with minimal latency impact
 * - Integration with existing TextSnippet and store management
 */

import { TextSnippet } from "../shared/types";
import { GlobalUsageTracker } from "../storage/global-usage-tracker";
import { SecondaryStoreUsageTracker } from "../storage/secondary-store-usage-tracker";

/**
 * Configuration for expansion usage logging
 */
export interface ExpansionUsageLoggerConfig {
  /** Enable/disable usage tracking entirely */
  enabled: boolean;
  /** Enable global usage tracking (appdata store) */
  enableGlobalTracking: boolean;
  /** Enable per-store usage tracking */
  enablePerStoreTracking: boolean;
  /** Maximum time to wait for tracking operations (ms) */
  maxTrackingTimeoutMs: number;
  /** Enable debug logging */
  enableDebugLogging: boolean;
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean;
}

/**
 * Default configuration for expansion usage logging
 */
export const DEFAULT_EXPANSION_USAGE_CONFIG: ExpansionUsageLoggerConfig = {
  enabled: true,
  enableGlobalTracking: true,
  enablePerStoreTracking: true,
  maxTrackingTimeoutMs: 100, // 100ms timeout to prevent delays
  enableDebugLogging: false,
  enablePerformanceMonitoring: true,
};

/**
 * Usage logging context for expansion events
 */
export interface ExpansionUsageContext {
  /** The snippet being expanded */
  snippet: TextSnippet;
  /** Timestamp of the expansion */
  timestamp: Date;
  /** Browser context information */
  userAgent?: string;
  /** URL where expansion occurred */
  url?: string;
  /** Target element type */
  targetElement?: string;
  /** Success status */
  success: boolean;
  /** Error message if expansion failed */
  errorMessage?: string;
  /** Performance timing information */
  performanceData?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

/**
 * Result of usage tracking operation
 */
export interface UsageTrackingResult {
  /** Whether global tracking succeeded */
  globalTrackingSuccess: boolean;
  /** Whether per-store tracking succeeded */
  perStoreTrackingSuccess: boolean;
  /** Any errors that occurred */
  errors: string[];
  /** Performance metrics */
  performanceMetrics?: {
    totalDuration: number;
    globalTrackingDuration: number;
    perStoreTrackingDuration: number;
  };
}

/**
 * Expansion Usage Logger
 *
 * Handles real-time usage tracking during snippet expansion with
 * dual-tracking support and error isolation.
 */
export class ExpansionUsageLogger {
  private config: ExpansionUsageLoggerConfig;
  private globalTracker: GlobalUsageTracker | null = null;
  private perStoreTrackers: Map<string, SecondaryStoreUsageTracker> = new Map();
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(
    config: ExpansionUsageLoggerConfig = DEFAULT_EXPANSION_USAGE_CONFIG,
  ) {
    this.config = { ...DEFAULT_EXPANSION_USAGE_CONFIG, ...config };
  }

  /**
   * Initialize the usage logger
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    await this.initializationPromise;
  }

  /**
   * Perform the actual initialization
   */
  private async performInitialization(): Promise<void> {
    try {
      if (this.config.enableDebugLogging) {
        console.log("🔧 Initializing ExpansionUsageLogger");
      }

      // Initialize global tracker if enabled
      if (this.config.enableGlobalTracking) {
        this.globalTracker = new GlobalUsageTracker();
        await this.globalTracker.initialize();
      }

      this.isInitialized = true;

      if (this.config.enableDebugLogging) {
        console.log("✅ ExpansionUsageLogger initialized successfully");
      }
    } catch (error) {
      console.error("❌ Failed to initialize ExpansionUsageLogger:", error);
      throw error;
    }
  }

  /**
   * Log usage for a snippet expansion
   *
   * This is the main entry point called during snippet expansion.
   * It performs dual-tracking (global + per-store) with error isolation.
   *
   * @param context - The expansion context
   * @returns Promise<UsageTrackingResult> - The tracking result
   */
  async logUsage(context: ExpansionUsageContext): Promise<UsageTrackingResult> {
    const startTime = performance.now();
    const result: UsageTrackingResult = {
      globalTrackingSuccess: false,
      perStoreTrackingSuccess: false,
      errors: [],
    };

    // Early return if tracking is disabled
    if (!this.config.enabled) {
      return result;
    }

    // Ensure initialization
    try {
      await this.initialize();
    } catch (error) {
      result.errors.push(`Initialization failed: ${(error as Error).message}`);
      return result;
    }

    // Create tracking promises for parallel execution
    const trackingPromises: Promise<void>[] = [];

    // Global tracking
    if (this.config.enableGlobalTracking && this.globalTracker) {
      trackingPromises.push(this.trackGlobalUsage(context, result));
    }

    // Per-store tracking
    if (this.config.enablePerStoreTracking) {
      trackingPromises.push(this.trackPerStoreUsage(context, result));
    }

    // Execute all tracking operations with timeout
    try {
      await Promise.race([
        Promise.allSettled(trackingPromises),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Tracking timeout")),
            this.config.maxTrackingTimeoutMs,
          ),
        ),
      ]);
    } catch (error) {
      if ((error as Error).message === "Tracking timeout") {
        result.errors.push("Usage tracking timed out");
      } else {
        result.errors.push(`Tracking failed: ${(error as Error).message}`);
      }
    }

    // Add performance metrics if enabled
    if (this.config.enablePerformanceMonitoring) {
      const endTime = performance.now();
      result.performanceMetrics = {
        totalDuration: endTime - startTime,
        globalTrackingDuration: 0, // Updated in tracking methods
        perStoreTrackingDuration: 0, // Updated in tracking methods
      };
    }

    return result;
  }

  /**
   * Track usage in the global tracker
   */
  private async trackGlobalUsage(
    context: ExpansionUsageContext,
    result: UsageTrackingResult,
  ): Promise<void> {
    const startTime = performance.now();

    try {
      if (!this.globalTracker) {
        throw new Error("Global tracker not initialized");
      }

      // Convert TextSnippet to EnhancedSnippet format expected by global tracker
      const enhancedSnippet = this.convertToEnhancedSnippet(context.snippet);

      await this.globalTracker.trackUsage(
        enhancedSnippet,
        `expansion_${context.targetElement || "unknown"}`,
      );

      result.globalTrackingSuccess = true;

      if (this.config.enableDebugLogging) {
        console.log(
          "✅ Global usage tracking succeeded for:",
          context.snippet.trigger,
        );
      }
    } catch (error) {
      result.errors.push(`Global tracking failed: ${(error as Error).message}`);

      if (this.config.enableDebugLogging) {
        console.error("❌ Global usage tracking failed:", error);
      }
    } finally {
      if (
        this.config.enablePerformanceMonitoring &&
        result.performanceMetrics
      ) {
        result.performanceMetrics.globalTrackingDuration =
          performance.now() - startTime;
      }
    }
  }

  /**
   * Track usage in the per-store tracker
   */
  private async trackPerStoreUsage(
    context: ExpansionUsageContext,
    result: UsageTrackingResult,
  ): Promise<void> {
    const startTime = performance.now();

    try {
      const storeFileName = context.snippet.storeFileName;
      if (!storeFileName) {
        throw new Error("No store file name available");
      }

      // Get or create per-store tracker
      let tracker = this.perStoreTrackers.get(storeFileName);
      if (!tracker) {
        tracker = new SecondaryStoreUsageTracker(storeFileName, storeFileName);
        await tracker.initialize();
        this.perStoreTrackers.set(storeFileName, tracker);
      }

      await tracker.trackUsage(
        context.snippet,
        `expansion_${context.targetElement || "unknown"}`,
      );

      result.perStoreTrackingSuccess = true;

      if (this.config.enableDebugLogging) {
        console.log(
          "✅ Per-store usage tracking succeeded for:",
          context.snippet.trigger,
        );
      }
    } catch (error) {
      result.errors.push(
        `Per-store tracking failed: ${(error as Error).message}`,
      );

      if (this.config.enableDebugLogging) {
        console.error("❌ Per-store usage tracking failed:", error);
      }
    } finally {
      if (
        this.config.enablePerformanceMonitoring &&
        result.performanceMetrics
      ) {
        result.performanceMetrics.perStoreTrackingDuration =
          performance.now() - startTime;
      }
    }
  }

  /**
   * Convert TextSnippet to EnhancedSnippet format
   */
  private convertToEnhancedSnippet(snippet: TextSnippet): any {
    return {
      id: snippet.id,
      trigger: snippet.trigger,
      content: snippet.content,
      contentType: snippet.contentType || "text",
      scope: snippet.scope || "personal",
      description: snippet.description || "",
      snipDependencies: [],
      variables: snippet.variables || [],
      images: [],
      tags: snippet.tags || [],
      createdAt: snippet.createdAt.toISOString(),
      updatedAt: snippet.updatedAt.toISOString(),
      createdBy: "unknown",
      updatedBy: "unknown",
    };
  }

  /**
   * Create expansion usage context from snippet and additional data
   */
  static createContext(
    snippet: TextSnippet,
    success: boolean,
    errorMessage?: string,
    additionalData?: {
      targetElement?: string;
      url?: string;
      userAgent?: string;
    },
  ): ExpansionUsageContext {
    return {
      snippet,
      timestamp: new Date(),
      success,
      errorMessage,
      userAgent: additionalData?.userAgent || navigator.userAgent,
      url: additionalData?.url || window.location.href,
      targetElement: additionalData?.targetElement,
    };
  }

  /**
   * Get usage statistics for debugging
   */
  async getUsageStatistics(): Promise<{
    globalTrackerInitialized: boolean;
    perStoreTrackersCount: number;
    totalTrackingOperations: number;
  }> {
    return {
      globalTrackerInitialized: this.globalTracker !== null,
      perStoreTrackersCount: this.perStoreTrackers.size,
      totalTrackingOperations: 0, // Would need to implement tracking counter
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    try {
      // Dispose global tracker
      if (this.globalTracker) {
        await this.globalTracker.dispose();
        this.globalTracker = null;
      }

      // Dispose per-store trackers
      for (const [storeFileName, tracker] of this.perStoreTrackers) {
        await tracker.dispose();
      }
      this.perStoreTrackers.clear();

      this.isInitialized = false;
      this.initializationPromise = null;

      if (this.config.enableDebugLogging) {
        console.log("🧹 ExpansionUsageLogger disposed");
      }
    } catch (error) {
      console.error("❌ Error disposing ExpansionUsageLogger:", error);
    }
  }
}

/**
 * Singleton instance for global usage
 */
export let globalExpansionUsageLogger: ExpansionUsageLogger | null = null;

/**
 * Get or create the global expansion usage logger
 */
export function getExpansionUsageLogger(
  config?: ExpansionUsageLoggerConfig,
): ExpansionUsageLogger {
  if (!globalExpansionUsageLogger) {
    globalExpansionUsageLogger = new ExpansionUsageLogger(config);
  }
  return globalExpansionUsageLogger;
}

/**
 * Helper function to log usage with minimal boilerplate
 */
export async function logExpansionUsage(
  snippet: TextSnippet,
  success: boolean,
  errorMessage?: string,
  additionalData?: {
    targetElement?: string;
    url?: string;
    userAgent?: string;
    dependencyChain?: string;
  },
): Promise<UsageTrackingResult> {
  const logger = getExpansionUsageLogger();
  const context = ExpansionUsageLogger.createContext(
    snippet,
    success,
    errorMessage,
    additionalData,
  );

  return logger.logUsage(context);
}
