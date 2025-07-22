/**
 * Paste Strategy Manager
 * Coordinates all paste strategies and selects the best one for each target
 */

import {
  BasePasteStrategy,
  PasteContent,
  PasteResult,
  PasteOptions,
} from "./base-strategy.js";
import { PlaintextPasteStrategy } from "./plaintext-strategy.js";
import { GmailPasteStrategy } from "./gmail-strategy.js";
import { GoogleDocsPasteStrategy } from "./google-docs-strategy.js";
import { FallbackPasteStrategy } from "./fallback-strategy.js";
import type { TargetSurface } from "../target-detector.js";

export interface PasteStrategyScore {
  strategy: BasePasteStrategy;
  confidence: number;
  canHandle: boolean;
}

export interface PasteManagerOptions {
  enableLogging?: boolean;
  fallbackDelay?: number;
  maxRetries?: number;
  defaultOptions?: Partial<PasteOptions>;
}

export interface PasteManagerResult extends PasteResult {
  strategyUsed: string;
  confidence: number;
  attemptedStrategies: string[];
  totalTime: number;
}

/**
 * Manages all paste strategies and selects the best one for each target
 */
export class PasteManager {
  private strategies: BasePasteStrategy[] = [];
  private options: PasteManagerOptions;
  private lastResult: PasteManagerResult | null = null;

  constructor(options: PasteManagerOptions = {}) {
    this.options = {
      enableLogging: false,
      fallbackDelay: 100,
      maxRetries: 3,
      defaultOptions: {
        preserveFormatting: true,
        convertToMarkdown: false,
        stripStyles: false,
        simulateTyping: false,
        insertAtCursor: true,
      },
      ...options,
    };

    this.initializeStrategies();
  }

  /**
   * Initialize all paste strategies
   */
  private initializeStrategies(): void {
    this.strategies = [
      new GmailPasteStrategy(),
      new GoogleDocsPasteStrategy(),
      new PlaintextPasteStrategy(),
      new FallbackPasteStrategy(),
    ];

    // Sort by priority (highest first)
    this.strategies.sort((a, b) => b.priority - a.priority);

    this.log(
      "Initialized paste strategies",
      this.strategies.map((s) => ({ name: s.name, priority: s.priority })),
    );
  }

  /**
   * Execute paste operation using the best strategy
   */
  async executePaste(
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions = {},
  ): Promise<PasteManagerResult> {
    const startTime = Date.now();
    const mergedOptions = { ...this.options.defaultOptions, ...options };
    const attemptedStrategies: string[] = [];

    this.log("Starting paste operation", {
      target: target.type,
      content: content.text?.substring(0, 100),
    });

    try {
      // Get ranked strategies for this target
      const rankedStrategies = this.getRankedStrategies(target);

      if (rankedStrategies.length === 0) {
        throw new Error("No suitable paste strategy found");
      }

      // Try each strategy in order of confidence
      for (const { strategy, confidence } of rankedStrategies) {
        attemptedStrategies.push(strategy.name);

        try {
          this.log(
            `Trying strategy: ${strategy.name} (confidence: ${confidence})`,
          );

          // Transform content for this strategy
          const transformedContent = await strategy.transformContent(
            content,
            target,
            mergedOptions,
          );

          // Execute paste with retry logic
          const result = await this.executeWithRetry(
            strategy,
            transformedContent,
            target,
            mergedOptions,
          );

          if (result.success) {
            const managerResult: PasteManagerResult = {
              ...result,
              strategyUsed: strategy.name,
              confidence,
              attemptedStrategies,
              totalTime: Date.now() - startTime,
            };

            this.lastResult = managerResult;
            this.log(`Paste successful with ${strategy.name}`, managerResult);
            return managerResult;
          }

          this.log(`Strategy ${strategy.name} failed:`, result.error);
        } catch (error) {
          this.log(`Strategy ${strategy.name} threw error:`, error);
        }

        // Add delay before trying next strategy
        if (this.options.fallbackDelay && this.options.fallbackDelay > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.fallbackDelay),
          );
        }
      }

      // All strategies failed
      const failureResult: PasteManagerResult = {
        success: false,
        method: "direct",
        transformations: [],
        error: "All paste strategies failed",
        strategyUsed: "none",
        confidence: 0,
        attemptedStrategies,
        totalTime: Date.now() - startTime,
      };

      this.lastResult = failureResult;
      this.log("All paste strategies failed", failureResult);
      return failureResult;
    } catch (error) {
      const errorResult: PasteManagerResult = {
        success: false,
        method: "direct",
        transformations: [],
        error: error instanceof Error ? error.message : "Unknown error",
        strategyUsed: "none",
        confidence: 0,
        attemptedStrategies,
        totalTime: Date.now() - startTime,
      };

      this.lastResult = errorResult;
      this.log("Paste operation error:", error);
      return errorResult;
    }
  }

  /**
   * Execute strategy with retry logic
   */
  private async executeWithRetry(
    strategy: BasePasteStrategy,
    content: PasteContent,
    target: TargetSurface,
    options: PasteOptions,
  ): Promise<PasteResult> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= this.options.maxRetries!; attempt++) {
      try {
        const result = await strategy.executePaste(content, target, options);

        if (result.success) {
          return result;
        }

        lastError = result.error;

        // Don't retry if it's a validation error
        if (
          lastError?.includes("validation") ||
          lastError?.includes("not supported")
        ) {
          break;
        }

        this.log(`Attempt ${attempt} failed, retrying...`, lastError);

        // Short delay between retries
        if (attempt < this.options.maxRetries!) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown error";
        this.log(`Attempt ${attempt} threw error:`, error);
      }
    }

    return {
      success: false,
      method: "direct",
      transformations: [],
      error: lastError || "All retry attempts failed",
    };
  }

  /**
   * Get ranked strategies for a target
   */
  private getRankedStrategies(target: TargetSurface): PasteStrategyScore[] {
    const scores: PasteStrategyScore[] = [];

    for (const strategy of this.strategies) {
      const canHandle = strategy.canHandle(target);
      const confidence = strategy.getConfidence(target);

      scores.push({
        strategy,
        confidence,
        canHandle,
      });
    }

    // Filter to only strategies that can handle this target
    const applicableStrategies = scores.filter((score) => score.canHandle);

    // Sort by confidence (highest first)
    applicableStrategies.sort((a, b) => b.confidence - a.confidence);

    return applicableStrategies;
  }

  /**
   * Get the best strategy for a target (without executing)
   */
  getBestStrategy(target: TargetSurface): BasePasteStrategy | null {
    const ranked = this.getRankedStrategies(target);
    return ranked.length > 0 ? ranked[0].strategy : null;
  }

  /**
   * Get all strategies that can handle a target
   */
  getApplicableStrategies(target: TargetSurface): PasteStrategyScore[] {
    return this.getRankedStrategies(target);
  }

  /**
   * Add a custom strategy
   */
  addStrategy(strategy: BasePasteStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => b.priority - a.priority);
    this.log("Added custom strategy", {
      name: strategy.name,
      priority: strategy.priority,
    });
  }

  /**
   * Remove a strategy by name
   */
  removeStrategy(name: string): boolean {
    const index = this.strategies.findIndex((s) => s.name === name);
    if (index >= 0) {
      this.strategies.splice(index, 1);
      this.log("Removed strategy", name);
      return true;
    }
    return false;
  }

  /**
   * Get all registered strategies
   */
  getStrategies(): BasePasteStrategy[] {
    return [...this.strategies];
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: string): BasePasteStrategy | null {
    return this.strategies.find((s) => s.name === name) || null;
  }

  /**
   * Update manager options
   */
  updateOptions(options: Partial<PasteManagerOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get last paste result
   */
  getLastResult(): PasteManagerResult | null {
    return this.lastResult;
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    totalStrategies: number;
    strategiesByPriority: Array<{ name: string; priority: number }>;
    lastResult: PasteManagerResult | null;
    options: PasteManagerOptions;
  } {
    return {
      totalStrategies: this.strategies.length,
      strategiesByPriority: this.strategies.map((s) => ({
        name: s.name,
        priority: s.priority,
      })),
      lastResult: this.lastResult,
      options: this.options,
    };
  }

  /**
   * Test a strategy against a target without executing
   */
  testStrategy(
    strategyName: string,
    target: TargetSurface,
  ): {
    canHandle: boolean;
    confidence: number;
    strategy: BasePasteStrategy | null;
  } {
    const strategy = this.getStrategy(strategyName);

    if (!strategy) {
      return {
        canHandle: false,
        confidence: 0,
        strategy: null,
      };
    }

    return {
      canHandle: strategy.canHandle(target),
      confidence: strategy.getConfidence(target),
      strategy,
    };
  }

  /**
   * Clear cached results
   */
  clearCache(): void {
    this.lastResult = null;
  }

  /**
   * Log message if logging is enabled
   */
  private log(message: string, ...args: any[]): void {
    if (this.options.enableLogging) {
      console.log(`[PasteManager] ${message}`, ...args);
    }
  }
}

/**
 * Global paste manager instance
 */
export const pasteManager = new PasteManager({
  enableLogging: true, // Enable logging to debug paste issues
});

/**
 * Utility function to execute paste operation
 */
export async function executePasteOperation(
  content: PasteContent,
  target: TargetSurface,
  options: PasteOptions = {},
): Promise<PasteManagerResult> {
  return pasteManager.executePaste(content, target, options);
}
