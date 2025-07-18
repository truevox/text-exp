/**
 * Paste Manager Tests
 * Tests for paste strategy coordination and management
 */

import {
  PasteManager,
  pasteManager,
} from "../../../src/content/paste-strategies/paste-manager";
import { BasePasteStrategy } from "../../../src/content/paste-strategies/base-strategy";
import type {
  PasteContent,
  PasteResult,
  PasteOptions,
} from "../../../src/content/paste-strategies/base-strategy";
import type { TargetSurface } from "../../../src/content/target-detector";

// Mock strategies for testing
class MockHighPriorityStrategy extends BasePasteStrategy {
  readonly name = "mock-high-priority";
  readonly priority = 100;
  readonly supportedTargets = ["test-target"];

  canHandle(target: TargetSurface): boolean {
    return target.type === "test-target";
  }

  async transformContent(content: PasteContent): Promise<PasteContent> {
    return {
      ...content,
      metadata: {
        ...content.metadata,
        transformations: [
          ...(content.metadata?.transformations || []),
          "high-priority-transform",
        ],
      },
    };
  }

  async executePaste(): Promise<PasteResult> {
    if (this.shouldFail) {
      return this.createResult(false, "custom", [], "Mock failure");
    }
    return this.createResult(true, "custom", ["high-priority-transform"]);
  }

  getConfidence(): number {
    return 0.9;
  }

  shouldFail = false;
}

class MockLowPriorityStrategy extends BasePasteStrategy {
  readonly name = "mock-low-priority";
  readonly priority = 50;
  readonly supportedTargets = ["test-target"];

  canHandle(target: TargetSurface): boolean {
    return target.type === "test-target";
  }

  async transformContent(content: PasteContent): Promise<PasteContent> {
    return {
      ...content,
      metadata: {
        ...content.metadata,
        transformations: [
          ...(content.metadata?.transformations || []),
          "low-priority-transform",
        ],
      },
    };
  }

  async executePaste(): Promise<PasteResult> {
    return this.createResult(true, "custom", ["low-priority-transform"]);
  }

  getConfidence(): number {
    return 0.5;
  }
}

class MockUnsupportedStrategy extends BasePasteStrategy {
  readonly name = "mock-unsupported";
  readonly priority = 75;
  readonly supportedTargets = ["unsupported-target"];

  canHandle(target: TargetSurface): boolean {
    return target.type === "unsupported-target";
  }

  async transformContent(content: PasteContent): Promise<PasteContent> {
    return content;
  }

  async executePaste(): Promise<PasteResult> {
    return this.createResult(true, "custom", []);
  }

  getConfidence(): number {
    return 0.8;
  }
}

describe("PasteManager", () => {
  let manager: PasteManager;
  let mockTarget: TargetSurface;
  let mockUnsupportedTarget: TargetSurface;
  let mockContent: PasteContent;

  beforeEach(() => {
    manager = new PasteManager({
      enableLogging: false,
      fallbackDelay: 0, // No delay for faster tests
      maxRetries: 2,
    });

    mockTarget = {
      type: "test-target",
      element: {
        classList: {
          contains: jest.fn().mockReturnValue(false),
        },
        closest: jest.fn().mockReturnValue(null),
        id: "",
        tagName: "DIV",
      } as any,
      context: {
        domain: "test.com",
        url: "https://test.com/page",
        pageTitle: "Test Page",
        isFramed: false,
      },
      capabilities: {
        supportsHTML: true,
        supportsMarkdown: false,
        supportsPlainText: true,
        supportsImages: false,
        supportsLinks: true,
        supportsFormatting: true,
        supportsLists: false,
        supportsTables: false,
      },
      metadata: {
        editorName: "Test Editor",
        detectionConfidence: 0.9,
        detectionMethod: "test-rule",
      },
    };

    mockUnsupportedTarget = {
      ...mockTarget,
      type: "unsupported-target",
      element: {
        classList: {
          contains: jest.fn().mockReturnValue(false),
        },
        closest: jest.fn().mockReturnValue(null),
        id: "",
        tagName: "DIV",
      } as any,
    };

    mockContent = {
      text: "Test content",
      html: "<p>Test content</p>",
      metadata: {
        originalFormat: "html",
        transformations: [],
        timestamp: Date.now(),
      },
    };

    jest.clearAllMocks();
  });

  describe("Initialization", () => {
    test("should initialize with default options", () => {
      const defaultManager = new PasteManager();
      const stats = defaultManager.getStats();

      expect(stats.totalStrategies).toBeGreaterThan(0);
      expect(stats.options.enableLogging).toBe(false);
      expect(stats.options.fallbackDelay).toBe(100);
      expect(stats.options.maxRetries).toBe(3);
    });

    test("should initialize with custom options", () => {
      const customManager = new PasteManager({
        enableLogging: true,
        fallbackDelay: 50,
        maxRetries: 5,
        defaultOptions: {
          preserveFormatting: false,
          stripStyles: true,
        },
      });

      const stats = customManager.getStats();
      expect(stats.options.enableLogging).toBe(true);
      expect(stats.options.fallbackDelay).toBe(50);
      expect(stats.options.maxRetries).toBe(5);
      expect(stats.options.defaultOptions?.preserveFormatting).toBe(false);
      expect(stats.options.defaultOptions?.stripStyles).toBe(true);
    });

    test("should sort strategies by priority", () => {
      const stats = manager.getStats();
      const strategies = stats.strategiesByPriority;

      for (let i = 0; i < strategies.length - 1; i++) {
        expect(strategies[i].priority).toBeGreaterThanOrEqual(
          strategies[i + 1].priority,
        );
      }
    });
  });

  describe("Strategy Management", () => {
    test("should add custom strategy", () => {
      const customStrategy = new MockHighPriorityStrategy();
      const initialCount = manager.getStats().totalStrategies;

      manager.addStrategy(customStrategy);

      expect(manager.getStats().totalStrategies).toBe(initialCount + 1);
      expect(manager.getStrategy("mock-high-priority")).toBe(customStrategy);
    });

    test("should remove strategy by name", () => {
      const customStrategy = new MockHighPriorityStrategy();
      manager.addStrategy(customStrategy);

      const removed = manager.removeStrategy("mock-high-priority");

      expect(removed).toBe(true);
      expect(manager.getStrategy("mock-high-priority")).toBeNull();
    });

    test("should return false when removing non-existent strategy", () => {
      const removed = manager.removeStrategy("non-existent");
      expect(removed).toBe(false);
    });

    test("should get all strategies", () => {
      const strategies = manager.getStrategies();
      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
    });
  });

  describe("Strategy Selection", () => {
    test("should select best strategy based on confidence", () => {
      const highPriorityStrategy = new MockHighPriorityStrategy();
      const lowPriorityStrategy = new MockLowPriorityStrategy();

      manager.addStrategy(highPriorityStrategy);
      manager.addStrategy(lowPriorityStrategy);

      const bestStrategy = manager.getBestStrategy(mockTarget);

      expect(bestStrategy).toBe(highPriorityStrategy);
    });

    test("should return null when no strategy can handle target", () => {
      // Create a manager without fallback strategy for this test
      const noFallbackManager = new PasteManager({
        enableLogging: false,
        fallbackDelay: 0,
        maxRetries: 2,
      });

      // Remove fallback strategy
      noFallbackManager.removeStrategy("fallback-paste");

      const bestStrategy = noFallbackManager.getBestStrategy(
        mockUnsupportedTarget,
      );
      expect(bestStrategy).toBeNull();
    });

    test("should get all applicable strategies", () => {
      const highPriorityStrategy = new MockHighPriorityStrategy();
      const lowPriorityStrategy = new MockLowPriorityStrategy();
      const unsupportedStrategy = new MockUnsupportedStrategy();

      manager.addStrategy(highPriorityStrategy);
      manager.addStrategy(lowPriorityStrategy);
      manager.addStrategy(unsupportedStrategy);

      const applicableStrategies = manager.getApplicableStrategies(mockTarget);

      // Should include 2 mock strategies + fallback strategy (which handles everything)
      expect(applicableStrategies).toHaveLength(3);
      expect(applicableStrategies[0].strategy).toBe(highPriorityStrategy);
      expect(applicableStrategies[1].strategy).toBe(lowPriorityStrategy);
      expect(applicableStrategies[2].strategy.name).toBe("fallback-paste");
    });
  });

  describe("Paste Execution", () => {
    test("should execute paste with best strategy", async () => {
      const highPriorityStrategy = new MockHighPriorityStrategy();
      manager.addStrategy(highPriorityStrategy);

      const result = await manager.executePaste(mockContent, mockTarget, {});

      expect(result.success).toBe(true);
      expect(result.strategyUsed).toBe("mock-high-priority");
      expect(result.confidence).toBe(0.9);
      expect(result.attemptedStrategies).toEqual(["mock-high-priority"]);
    });

    test("should fallback to next strategy when first fails", async () => {
      const highPriorityStrategy = new MockHighPriorityStrategy();
      const lowPriorityStrategy = new MockLowPriorityStrategy();

      highPriorityStrategy.shouldFail = true;

      manager.addStrategy(highPriorityStrategy);
      manager.addStrategy(lowPriorityStrategy);

      const result = await manager.executePaste(mockContent, mockTarget, {});

      expect(result.success).toBe(true);
      expect(result.strategyUsed).toBe("mock-low-priority");
      expect(result.confidence).toBe(0.5);
      expect(result.attemptedStrategies).toEqual([
        "mock-high-priority",
        "mock-low-priority",
      ]);
    });

    test("should fail when no strategy can handle target", async () => {
      // Create a manager without fallback strategy for this test
      const noFallbackManager = new PasteManager({
        enableLogging: false,
        fallbackDelay: 0,
        maxRetries: 2,
      });

      // Remove fallback strategy
      noFallbackManager.removeStrategy("fallback-paste");

      const result = await noFallbackManager.executePaste(
        mockContent,
        mockUnsupportedTarget,
        {},
      );

      expect(result.success).toBe(false);
      expect(result.strategyUsed).toBe("none");
      expect(result.confidence).toBe(0);
      expect(result.error).toBe("No suitable paste strategy found");
    });

    test("should fail when all strategies fail", async () => {
      const highPriorityStrategy = new MockHighPriorityStrategy();
      const lowPriorityStrategy = new MockLowPriorityStrategy();

      highPriorityStrategy.shouldFail = true;
      // Mock low priority strategy to fail as well
      lowPriorityStrategy.executePaste = jest.fn().mockResolvedValue({
        success: false,
        method: "custom",
        transformations: [],
        error: "Mock failure",
      });

      manager.addStrategy(highPriorityStrategy);
      manager.addStrategy(lowPriorityStrategy);

      const result = await manager.executePaste(mockContent, mockTarget, {});

      expect(result.success).toBe(false);
      expect(result.strategyUsed).toBe("none");
      expect(result.error).toBe("All paste strategies failed");
    });

    test("should merge options correctly", async () => {
      const highPriorityStrategy = new MockHighPriorityStrategy();
      const transformContentSpy = jest.spyOn(
        highPriorityStrategy,
        "transformContent",
      );
      const executePasteSpy = jest.spyOn(highPriorityStrategy, "executePaste");

      manager.addStrategy(highPriorityStrategy);

      const customOptions: PasteOptions = {
        preserveFormatting: false,
        stripStyles: true,
      };

      await manager.executePaste(mockContent, mockTarget, customOptions);

      expect(transformContentSpy).toHaveBeenCalledWith(
        mockContent,
        mockTarget,
        expect.objectContaining(customOptions),
      );
      expect(executePasteSpy).toHaveBeenCalledWith(
        expect.any(Object),
        mockTarget,
        expect.objectContaining(customOptions),
      );
    });
  });

  describe("Retry Logic", () => {
    test("should retry failed paste attempts", async () => {
      const strategy = new MockHighPriorityStrategy();
      let callCount = 0;

      strategy.executePaste = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return strategy.createResult(
            false,
            "custom",
            [],
            "Temporary failure",
          );
        }
        return strategy.createResult(true, "custom", []);
      });

      manager.addStrategy(strategy);

      const result = await manager.executePaste(mockContent, mockTarget, {});

      expect(result.success).toBe(true);
      expect(strategy.executePaste).toHaveBeenCalledTimes(2);
    });

    test("should not retry validation errors", async () => {
      const strategy = new MockHighPriorityStrategy();

      strategy.executePaste = jest
        .fn()
        .mockResolvedValue(
          strategy.createResult(false, "custom", [], "validation error"),
        );

      // Create a manager without fallback strategy for this test
      const noFallbackManager = new PasteManager({
        enableLogging: false,
        fallbackDelay: 0,
        maxRetries: 2,
      });

      // Remove fallback strategy and add our test strategy
      noFallbackManager.removeStrategy("fallback-paste");
      noFallbackManager.addStrategy(strategy);

      const result = await noFallbackManager.executePaste(
        mockContent,
        mockTarget,
        {},
      );

      expect(result.success).toBe(false);
      expect(strategy.executePaste).toHaveBeenCalledTimes(1);
    });
  });

  describe("Statistics and Tracking", () => {
    test("should track last result", async () => {
      const strategy = new MockHighPriorityStrategy();
      manager.addStrategy(strategy);

      const result = await manager.executePaste(mockContent, mockTarget, {});

      expect(manager.getLastResult()).toEqual(result);
    });

    test("should provide comprehensive statistics", () => {
      const strategy = new MockHighPriorityStrategy();
      manager.addStrategy(strategy);

      const stats = manager.getStats();

      expect(stats).toHaveProperty("totalStrategies");
      expect(stats).toHaveProperty("strategiesByPriority");
      expect(stats).toHaveProperty("lastResult");
      expect(stats).toHaveProperty("options");
      expect(stats.totalStrategies).toBeGreaterThan(0);
    });

    test("should clear cache", () => {
      manager.clearCache();
      expect(manager.getLastResult()).toBeNull();
    });
  });

  describe("Strategy Testing", () => {
    test("should test strategy against target", () => {
      const strategy = new MockHighPriorityStrategy();
      manager.addStrategy(strategy);

      const testResult = manager.testStrategy("mock-high-priority", mockTarget);

      expect(testResult.canHandle).toBe(true);
      expect(testResult.confidence).toBe(0.9);
      expect(testResult.strategy).toBe(strategy);
    });

    test("should handle testing non-existent strategy", () => {
      const testResult = manager.testStrategy("non-existent", mockTarget);

      expect(testResult.canHandle).toBe(false);
      expect(testResult.confidence).toBe(0);
      expect(testResult.strategy).toBeNull();
    });
  });

  describe("Options Update", () => {
    test("should update manager options", () => {
      const newOptions = {
        enableLogging: true,
        fallbackDelay: 200,
        maxRetries: 5,
      };

      manager.updateOptions(newOptions);

      const stats = manager.getStats();
      expect(stats.options.enableLogging).toBe(true);
      expect(stats.options.fallbackDelay).toBe(200);
      expect(stats.options.maxRetries).toBe(5);
    });
  });

  describe("Global Instance", () => {
    test("should provide global paste manager instance", () => {
      expect(pasteManager).toBeInstanceOf(PasteManager);
    });
  });

  describe("Error Handling", () => {
    test("should handle strategy execution errors", async () => {
      const strategy = new MockHighPriorityStrategy();
      strategy.executePaste = jest
        .fn()
        .mockRejectedValue(new Error("Strategy error"));

      manager.addStrategy(strategy);

      const result = await manager.executePaste(mockContent, mockTarget, {});

      expect(result.success).toBe(false);
      expect(result.strategyUsed).toBe("none");
      expect(result.error).toBe("All paste strategies failed");
    });

    test("should handle content transformation errors", async () => {
      const strategy = new MockHighPriorityStrategy();
      strategy.transformContent = jest
        .fn()
        .mockRejectedValue(new Error("Transform error"));

      manager.addStrategy(strategy);

      const result = await manager.executePaste(mockContent, mockTarget, {});

      expect(result.success).toBe(false);
    });

    test("should handle general execution errors", async () => {
      const strategy = new MockHighPriorityStrategy();
      // Mock a general error during execution
      strategy.canHandle = jest.fn().mockImplementation(() => {
        throw new Error("General error");
      });

      manager.addStrategy(strategy);

      const result = await manager.executePaste(mockContent, mockTarget, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain("General error");
    });
  });
});
