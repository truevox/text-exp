/**
 * Tests for Expansion Usage Logger
 * Comprehensive testing including integration scenarios and error handling
 */

import {
  ExpansionUsageLogger,
  type ExpansionUsageContext,
  type UsageTrackingResult,
  DEFAULT_EXPANSION_USAGE_CONFIG,
  getExpansionUsageLogger,
  logExpansionUsage,
} from "../../src/content/expansion-usage-logger";
import { TextSnippet } from "../../src/shared/types";

// Mock the dependencies
jest.mock("../../src/storage/global-usage-tracker");
jest.mock("../../src/storage/secondary-store-usage-tracker");

describe("ExpansionUsageLogger - Phase 3 Task 4", () => {
  let logger: ExpansionUsageLogger;
  let mockGlobalTracker: any;
  let mockSecondaryTracker: any;

  // Mock snippet data
  const mockSnippet: TextSnippet = {
    id: "test-snippet-1",
    trigger: "!hello",
    content: "Hello, world!",
    contentType: "text",
    scope: "personal",
    description: "Test greeting snippet",
    variables: [],
    tags: ["greeting", "test"],
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    storeFileName: "personal.json",
    sourceFolder: "test-folder",
    fileHash: "abc123",
    usageCount: 5,
    lastUsed: new Date("2024-01-01T12:00:00.000Z"),
    priority: 1,
  };

  const mockSnippetWithoutStore: TextSnippet = {
    ...mockSnippet,
    id: "test-snippet-2",
    trigger: "!goodbye",
    content: "Goodbye!",
    storeFileName: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock navigator.userAgent
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Test Browser)",
      writable: true,
      configurable: true,
    });

    // Mock performance.now
    global.performance = {
      now: jest.fn(() => 1000),
    } as any;

    // Mock window.location
    (window.location as any).href = "https://example.com";

    // Set up mock trackers
    mockGlobalTracker = {
      initialize: jest.fn().mockResolvedValue(undefined),
      trackUsage: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
    };

    mockSecondaryTracker = {
      initialize: jest.fn().mockResolvedValue(undefined),
      trackUsage: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
    };

    // Mock the constructor imports
    const {
      GlobalUsageTracker,
    } = require("../../src/storage/global-usage-tracker");
    const {
      SecondaryStoreUsageTracker,
    } = require("../../src/storage/secondary-store-usage-tracker");

    GlobalUsageTracker.mockImplementation(() => mockGlobalTracker);
    SecondaryStoreUsageTracker.mockImplementation(() => mockSecondaryTracker);

    logger = new ExpansionUsageLogger();
  });

  afterEach(async () => {
    if (logger) {
      await logger.dispose();
    }
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      expect(logger).toBeDefined();
      expect(logger["config"]).toEqual(DEFAULT_EXPANSION_USAGE_CONFIG);
    });

    it("should initialize with custom config", () => {
      const customConfig = {
        ...DEFAULT_EXPANSION_USAGE_CONFIG,
        enabled: false,
        maxTrackingTimeoutMs: 200,
      };

      const customLogger = new ExpansionUsageLogger(customConfig);
      expect(customLogger["config"]).toEqual(customConfig);
    });

    it("should initialize trackers on first use", async () => {
      const context = ExpansionUsageLogger.createContext(mockSnippet, true);

      await logger.logUsage(context);

      expect(mockGlobalTracker.initialize).toHaveBeenCalledTimes(1);
    });

    it("should not initialize multiple times", async () => {
      const context = ExpansionUsageLogger.createContext(mockSnippet, true);

      await logger.logUsage(context);
      await logger.logUsage(context);

      expect(mockGlobalTracker.initialize).toHaveBeenCalledTimes(1);
    });

    it("should handle initialization errors gracefully", async () => {
      mockGlobalTracker.initialize.mockRejectedValue(new Error("Init failed"));

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await logger.logUsage(context);

      expect(result.errors).toContain("Initialization failed: Init failed");
      expect(result.globalTrackingSuccess).toBe(false);
    });
  });

  describe("Usage Logging", () => {
    beforeEach(async () => {
      await logger.initialize();
    });

    it("should log usage for successful expansion", async () => {
      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await logger.logUsage(context);

      expect(result.globalTrackingSuccess).toBe(true);
      expect(result.perStoreTrackingSuccess).toBe(true);
      expect(result.errors).toHaveLength(0);

      expect(mockGlobalTracker.trackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockSnippet.id,
          trigger: mockSnippet.trigger,
          content: mockSnippet.content,
        }),
        expect.objectContaining({
          context: "expansion_unknown",
          success: true,
        }),
      );

      expect(mockSecondaryTracker.trackUsage).toHaveBeenCalledWith(
        mockSnippet,
        expect.objectContaining({
          context: "expansion_unknown",
          success: true,
        }),
      );
    });

    it("should log usage for failed expansion", async () => {
      const context = ExpansionUsageLogger.createContext(
        mockSnippet,
        false,
        "Expansion failed",
      );
      const result = await logger.logUsage(context);

      expect(result.globalTrackingSuccess).toBe(true);
      expect(result.perStoreTrackingSuccess).toBe(true);

      expect(mockGlobalTracker.trackUsage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          success: false,
          errorMessage: "Expansion failed",
        }),
      );
    });

    it("should handle snippet without store file", async () => {
      const context = ExpansionUsageLogger.createContext(
        mockSnippetWithoutStore,
        true,
      );
      const result = await logger.logUsage(context);

      expect(result.globalTrackingSuccess).toBe(true);
      expect(result.perStoreTrackingSuccess).toBe(false);
      expect(result.errors).toContain(
        "Per-store tracking failed: No store file name available",
      );
    });

    it("should handle global tracking failure", async () => {
      mockGlobalTracker.trackUsage.mockRejectedValue(
        new Error("Global tracking failed"),
      );

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await logger.logUsage(context);

      expect(result.globalTrackingSuccess).toBe(false);
      expect(result.perStoreTrackingSuccess).toBe(true);
      expect(result.errors).toContain(
        "Global tracking failed: Global tracking failed",
      );
    });

    it("should handle per-store tracking failure", async () => {
      mockSecondaryTracker.trackUsage.mockRejectedValue(
        new Error("Store tracking failed"),
      );

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await logger.logUsage(context);

      expect(result.globalTrackingSuccess).toBe(true);
      expect(result.perStoreTrackingSuccess).toBe(false);
      expect(result.errors).toContain(
        "Per-store tracking failed: Store tracking failed",
      );
    });

    it("should handle tracking timeout", async () => {
      const timeoutLogger = new ExpansionUsageLogger({
        ...DEFAULT_EXPANSION_USAGE_CONFIG,
        maxTrackingTimeoutMs: 10, // Very short timeout
      });

      mockGlobalTracker.trackUsage.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 50)),
      );

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await timeoutLogger.logUsage(context);

      expect(result.errors).toContain("Usage tracking timed out");

      await timeoutLogger.dispose();
    });

    it("should skip tracking when disabled", async () => {
      const disabledLogger = new ExpansionUsageLogger({
        ...DEFAULT_EXPANSION_USAGE_CONFIG,
        enabled: false,
      });

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await disabledLogger.logUsage(context);

      expect(result.globalTrackingSuccess).toBe(false);
      expect(result.perStoreTrackingSuccess).toBe(false);
      expect(mockGlobalTracker.trackUsage).not.toHaveBeenCalled();
      expect(mockSecondaryTracker.trackUsage).not.toHaveBeenCalled();

      await disabledLogger.dispose();
    });
  });

  describe("Context Creation", () => {
    it("should create context with minimal data", () => {
      const context = ExpansionUsageLogger.createContext(mockSnippet, true);

      expect(context).toMatchObject({
        snippet: mockSnippet,
        success: true,
        timestamp: expect.any(Date),
        userAgent: "Mozilla/5.0 (Test Browser)",
        url: expect.any(String),
      });
    });

    it("should create context with additional data", () => {
      const additionalData = {
        targetElement: "textarea",
        url: "https://custom.com",
        userAgent: "Custom Agent",
      };

      const context = ExpansionUsageLogger.createContext(
        mockSnippet,
        true,
        undefined,
        additionalData,
      );

      expect(context).toMatchObject({
        snippet: mockSnippet,
        success: true,
        targetElement: "textarea",
        url: "https://custom.com",
        userAgent: "Custom Agent",
      });
    });

    it("should create context with error message", () => {
      const context = ExpansionUsageLogger.createContext(
        mockSnippet,
        false,
        "Test error",
      );

      expect(context).toMatchObject({
        snippet: mockSnippet,
        success: false,
        errorMessage: "Test error",
      });
    });
  });

  describe("Performance Monitoring", () => {
    it("should collect performance metrics when enabled", async () => {
      const performanceLogger = new ExpansionUsageLogger({
        ...DEFAULT_EXPANSION_USAGE_CONFIG,
        enablePerformanceMonitoring: true,
      });

      await performanceLogger.initialize();

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await performanceLogger.logUsage(context);

      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics?.totalDuration).toBeGreaterThanOrEqual(
        0,
      );

      await performanceLogger.dispose();
    });

    it("should not collect performance metrics when disabled", async () => {
      const performanceLogger = new ExpansionUsageLogger({
        ...DEFAULT_EXPANSION_USAGE_CONFIG,
        enablePerformanceMonitoring: false,
      });

      await performanceLogger.initialize();

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await performanceLogger.logUsage(context);

      expect(result.performanceMetrics).toBeUndefined();

      await performanceLogger.dispose();
    });
  });

  describe("Store Management", () => {
    it("should create and cache per-store trackers", async () => {
      const snippet1 = { ...mockSnippet, storeFileName: "store1.json" };
      const snippet2 = { ...mockSnippet, storeFileName: "store2.json" };
      const snippet3 = { ...mockSnippet, storeFileName: "store1.json" };

      await logger.initialize();

      await logger.logUsage(ExpansionUsageLogger.createContext(snippet1, true));
      await logger.logUsage(ExpansionUsageLogger.createContext(snippet2, true));
      await logger.logUsage(ExpansionUsageLogger.createContext(snippet3, true));

      // Should create 2 trackers (store1.json and store2.json)
      expect(logger["perStoreTrackers"].size).toBe(2);

      // store1.json should be reused for snippet3
      expect(mockSecondaryTracker.initialize).toHaveBeenCalledTimes(2);
    });

    it("should handle store tracker initialization failure", async () => {
      mockSecondaryTracker.initialize.mockRejectedValue(
        new Error("Store init failed"),
      );

      await logger.initialize();

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await logger.logUsage(context);

      expect(result.perStoreTrackingSuccess).toBe(false);
      expect(result.errors).toContain(
        "Per-store tracking failed: Store init failed",
      );
    });
  });

  describe("Global Singleton", () => {
    it("should return same instance from getExpansionUsageLogger", () => {
      const logger1 = getExpansionUsageLogger();
      const logger2 = getExpansionUsageLogger();

      expect(logger1).toBe(logger2);
    });

    it("should accept config on first call", () => {
      // Reset the singleton for this test
      const expansionUsageLogger = require("../../src/content/expansion-usage-logger");
      expansionUsageLogger.globalExpansionUsageLogger = null;

      const customConfig = {
        ...DEFAULT_EXPANSION_USAGE_CONFIG,
        enabled: false,
      };

      const logger1 = getExpansionUsageLogger(customConfig);
      expect(logger1["config"]).toEqual(customConfig);
    });
  });

  describe("Helper Functions", () => {
    it("should log usage with helper function", async () => {
      // Reset singleton to use our mocked version
      const expansionUsageLogger = require("../../src/content/expansion-usage-logger");
      expansionUsageLogger.globalExpansionUsageLogger = null;

      const result = await logExpansionUsage(mockSnippet, true);

      expect(result).toBeDefined();
      expect(mockGlobalTracker.trackUsage).toHaveBeenCalled();
      expect(mockSecondaryTracker.trackUsage).toHaveBeenCalled();
    });

    it("should log usage with additional data", async () => {
      // Reset singleton to use our mocked version
      const expansionUsageLogger = require("../../src/content/expansion-usage-logger");
      expansionUsageLogger.globalExpansionUsageLogger = null;

      const additionalData = {
        targetElement: "input",
        url: "https://test.com",
        userAgent: "Test Agent",
      };

      const result = await logExpansionUsage(
        mockSnippet,
        true,
        undefined,
        additionalData,
      );

      expect(result).toBeDefined();
      expect(mockGlobalTracker.trackUsage).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          context: "expansion_input",
          url: "https://test.com",
          userAgent: "Test Agent",
        }),
      );
    });
  });

  describe("Resource Management", () => {
    it("should dispose resources properly", async () => {
      await logger.initialize();

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      await logger.logUsage(context);

      await logger.dispose();

      expect(mockGlobalTracker.dispose).toHaveBeenCalledTimes(1);
      expect(mockSecondaryTracker.dispose).toHaveBeenCalledTimes(1);
      expect(logger["isInitialized"]).toBe(false);
    });

    it("should handle disposal errors gracefully", async () => {
      mockGlobalTracker.dispose.mockRejectedValue(new Error("Disposal failed"));

      await logger.initialize();

      // Should not throw
      await expect(logger.dispose()).resolves.toBeUndefined();
    });

    it("should get usage statistics", async () => {
      await logger.initialize();

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      await logger.logUsage(context);

      const stats = await logger.getUsageStatistics();

      expect(stats).toEqual({
        globalTrackerInitialized: true,
        perStoreTrackersCount: 1,
        totalTrackingOperations: 0,
      });
    });
  });

  describe("Error Isolation", () => {
    it("should isolate tracking errors from expansion", async () => {
      mockGlobalTracker.trackUsage.mockRejectedValue(
        new Error("Tracking error"),
      );
      mockSecondaryTracker.trackUsage.mockRejectedValue(
        new Error("Store error"),
      );

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);

      // Should not throw despite tracking errors
      await expect(logger.logUsage(context)).resolves.toBeDefined();
    });

    it("should continue partial tracking on individual failures", async () => {
      mockGlobalTracker.trackUsage.mockRejectedValue(
        new Error("Global failed"),
      );

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      const result = await logger.logUsage(context);

      expect(result.globalTrackingSuccess).toBe(false);
      expect(result.perStoreTrackingSuccess).toBe(true);
      expect(result.errors).toContain("Global tracking failed: Global failed");
    });
  });

  describe("Enhanced Snippet Conversion", () => {
    it("should convert TextSnippet to EnhancedSnippet format", async () => {
      await logger.initialize();

      const context = ExpansionUsageLogger.createContext(mockSnippet, true);
      await logger.logUsage(context);

      expect(mockGlobalTracker.trackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockSnippet.id,
          trigger: mockSnippet.trigger,
          content: mockSnippet.content,
          contentType: mockSnippet.contentType,
          scope: mockSnippet.scope,
          description: mockSnippet.description,
          snipDependencies: [],
          variables: mockSnippet.variables,
          images: [],
          tags: mockSnippet.tags,
          createdAt: mockSnippet.createdAt.toISOString(),
          updatedAt: mockSnippet.updatedAt.toISOString(),
          createdBy: "unknown",
          updatedBy: "unknown",
        }),
        expect.any(Object),
      );
    });

    it("should handle snippets with missing optional fields", async () => {
      const minimalSnippet: TextSnippet = {
        id: "minimal",
        trigger: "!min",
        content: "Minimal content",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await logger.initialize();

      const context = ExpansionUsageLogger.createContext(minimalSnippet, true);
      await logger.logUsage(context);

      expect(mockGlobalTracker.trackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "minimal",
          trigger: "!min",
          content: "Minimal content",
          contentType: "text",
          scope: "personal",
          description: "",
          variables: [],
          tags: [],
        }),
        expect.any(Object),
      );
    });
  });
});
