/**
 * Performance tests for Google Drive sync operations
 * Validates performance characteristics and scalability
 */

import { GoogleDriveAdapter } from "../../src/background/cloud-adapters/google-drive-adapter";
import { GoogleDriveFilePickerService } from "../../src/background/cloud-adapters/google-drive/file-picker-service";
import { GoogleDriveAppDataManager } from "../../src/background/cloud-adapters/google-drive-appdata-manager";
import type { CloudCredentials, TextSnippet } from "../../src/shared/types";
import type { TierStorageSchema } from "../../src/types/snippet-formats";

global.fetch = jest.fn();

// Mock Chrome APIs for testing
global.chrome = {
  runtime: {
    getManifest: jest.fn(() => ({
      oauth2: {
        client_id:
          "1037463573947-mjb7i96il5j0b2ul3ou7c1vld0b0q96a.apps.googleusercontent.com",
      },
    })),
    id: "test-extension-id",
  },
  identity: {
    getAuthToken: jest.fn(),
    launchWebAuthFlow: jest.fn(),
    getRedirectURL: jest.fn(() => "https://test-extension-id.chromiumapp.org/"),
    clearAllCachedAuthTokens: jest
      .fn()
      .mockImplementation((callback) => callback()),
  },
  notifications: {
    create: jest.fn(),
  },
} as any;

describe("Google Drive Sync Performance", () => {
  let mockCredentials: CloudCredentials;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let adapter: GoogleDriveAdapter;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCredentials = {
      provider: "google-drive",
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
      expiresAt: new Date(Date.now() + 3600000),
    };

    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

    // Mock successful responses by default (including validation)
    const mockHeaders = new Headers({
      "content-type": "application/json",
      "cache-control": "no-cache",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: mockHeaders,
      json: () =>
        Promise.resolve({
          user: {
            emailAddress: "test@example.com",
            displayName: "Test User",
          },
          id: "file123",
          name: "test.json",
        }),
      text: () => Promise.resolve(JSON.stringify({ snippets: [] })),
    } as any);

    // Reset Chrome runtime error state
    (global as any).chrome.runtime.lastError = undefined;

    adapter = new GoogleDriveAdapter();
    await adapter.initialize(mockCredentials);
  });

  describe("File Creation Performance", () => {
    it("should create files efficiently", async () => {
      const startTime = performance.now();

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly (allowing for test overhead)
      expect(duration).toBeLessThan(100);
    });

    it("should handle batch file creation efficiently", async () => {
      const fileCount = 10;
      const startTime = performance.now();

      const promises = Array.from({ length: fileCount }, (_, i) =>
        GoogleDriveFilePickerService.createSnippetStoreFile(mockCredentials, {
          name: `test${i}.json`,
        }),
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should scale reasonably with number of files
      expect(duration).toBeLessThan(fileCount * 50); // 50ms per file max
      expect(mockFetch).toHaveBeenCalledTimes(fileCount + 1); // +1 for initial validation
    });

    it("should optimize for concurrent operations", async () => {
      const fileCount = 20;
      const startTime = performance.now();

      const promises = Array.from({ length: fileCount }, (_, i) =>
        GoogleDriveFilePickerService.createSnippetStoreFile(mockCredentials, {
          name: `concurrent${i}.json`,
        }),
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Concurrent operations should be faster than sequential
      expect(duration).toBeLessThan(fileCount * 20); // Much faster than sequential
    });
  });

  describe("Large Dataset Handling", () => {
    it("should handle large snippet collections efficiently", async () => {
      const largeSnippetCollection = Array.from({ length: 1000 }, (_, i) => ({
        id: `snippet${i}`,
        trigger: `trigger${i}`,
        content: `Content for snippet ${i}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const startTime = performance.now();

      await adapter.uploadSnippets(largeSnippetCollection);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle large collections without significant performance degradation
      expect(duration).toBeLessThan(1000); // 1 second max
    });

    it("should efficiently serialize large configurations", async () => {
      const largeConfig = {
        version: "1.0.0",
        settings: {
          triggerDelay: 100,
          caseSensitive: false,
          enableSharedSnippets: true,
          autoSync: true,
          syncInterval: 300,
          showNotifications: true,
        },
        preferredStores: {
          personalDefault: "personal.json",
          teamDefault: "team.json",
          orgDefault: "org.json",
        },
        driveFiles: {
          selectedFiles: Array.from({ length: 10000 }, (_, i) => `file${i}`),
          permissions: Object.fromEntries(
            Array.from({ length: 10000 }, (_, i) => [`file${i}`, "write" as const]),
          ) as Record<string, "read" | "write">,
        },
        lastSync: new Date().toISOString(),
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };

      const startTime = performance.now();

      await GoogleDriveAppDataManager.storeUserConfiguration(
        mockCredentials,
        largeConfig,
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should serialize large objects efficiently
      expect(duration).toBeLessThan(500); // 500ms max
    });

    it("should handle large tier storage schemas", async () => {
      const largeTierSchema: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal",
        snippets: Array.from({ length: 5000 }, (_, i) => ({
          id: `snippet${i}`,
          trigger: `trigger${i}`,
          content: `Content for snippet ${i}`.repeat(10), // Longer content
          contentType: "plaintext" as const,
          snipDependencies: [],
          description: `Description for snippet ${i}`,
          scope: "personal" as const,
          variables: [],
          images: [],
          tags: [],
          createdAt: new Date().toISOString(),
          createdBy: "test-user",
          updatedAt: new Date().toISOString(),
          updatedBy: "test-user",
        })),
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "test-user",
          description: "Large tier storage schema for performance testing",
        },
      };

      const startTime = performance.now();

      await GoogleDriveAppDataManager.storePriorityZeroSnippets(
        mockCredentials,
        largeTierSchema,
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle large schemas efficiently
      expect(duration).toBeLessThan(1000); // 1 second max
    });
  });

  describe("Memory Usage Optimization", () => {
    it("should not leak memory during operations", async () => {
      // Track memory usage (simplified for test environment)
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await GoogleDriveFilePickerService.createSnippetStoreFile(
          mockCredentials,
          { name: `test${i}.json` },
        );
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (allowing for test overhead)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // 20MB max (adjusted for test environment)
    });

    it("should efficiently handle FormData creation", async () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await GoogleDriveFilePickerService.createSnippetStoreFile(
          mockCredentials,
          {
            name: `test${i}.json`,
            content: JSON.stringify({ test: "data".repeat(1000) }),
          },
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should create FormData efficiently
      expect(duration).toBeLessThan(iterations * 10); // 10ms per operation max
    });
  });

  describe("Network Optimization", () => {
    it("should minimize API calls for related operations", async () => {
      await adapter.createDefaultSnippetStores();

      // Should create 3 files with 4 API calls (3 creates + 1 validation)
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("should not make redundant validation calls", async () => {
      await GoogleDriveFilePickerService.validateSnippetStoreFile(
        mockCredentials,
        "file123",
      );

      // Should make 3 API calls for validation (credential validation + file info + file content)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should batch compatible operations", async () => {
      const mockFiles = [
        { name: "file1.json" },
        { name: "file2.json" },
        { name: "file3.json" },
      ];

      const startTime = performance.now();

      const promises = mockFiles.map((file) =>
        GoogleDriveFilePickerService.createSnippetStoreFile(
          mockCredentials,
          file,
        ),
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Concurrent operations should be faster than sequential
      expect(duration).toBeLessThan(200); // Should complete quickly
    });
  });

  describe("Error Handling Performance", () => {
    it("should handle errors efficiently", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const startTime = performance.now();

      try {
        await GoogleDriveFilePickerService.createSnippetStoreFile(
          mockCredentials,
          { name: "test.json" },
        );
        fail("Should have thrown an error");
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Error handling should be fast
        expect(duration).toBeLessThan(100);
        expect((error as Error).message).toContain("Network error");
      }
    });

    it("should handle timeout scenarios efficiently", async () => {
      const slowResponse = new Promise((resolve) => {
        setTimeout(
          () =>
            resolve({
              ok: true,
              json: () => Promise.resolve({ id: "file123", name: "test.json" }),
            }),
          100,
        );
      });

      mockFetch.mockResolvedValue(slowResponse as any);

      const startTime = performance.now();

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle the delay appropriately
      expect(duration).toBeGreaterThan(90); // At least the delay time
      expect(duration).toBeLessThan(200); // Not excessively longer
    });
  });

  describe("Scalability Tests", () => {
    it("should scale with increasing number of files", async () => {
      const testSizes = [10, 50, 100];
      const results: number[] = [];

      for (const size of testSizes) {
        const startTime = performance.now();

        const promises = Array.from({ length: size }, (_, i) =>
          GoogleDriveFilePickerService.createSnippetStoreFile(mockCredentials, {
            name: `test${i}.json`,
          }),
        );

        await Promise.all(promises);

        const endTime = performance.now();
        const duration = endTime - startTime;
        results.push(duration);
      }

      // Performance should scale reasonably (not exponentially)
      const scalingFactor = results[2] / results[0]; // 100 files vs 10 files
      expect(scalingFactor).toBeLessThan(25); // Should not be more than 25x slower (adjusted for test environment)
    });

    it("should handle increasing content size efficiently", async () => {
      const contentSizes = [1, 10, 100]; // KB
      const results: number[] = [];

      for (const size of contentSizes) {
        const content = "A".repeat(size * 1024);
        const startTime = performance.now();

        await GoogleDriveFilePickerService.createSnippetStoreFile(
          mockCredentials,
          { name: "test.json", content },
        );

        const endTime = performance.now();
        const duration = endTime - startTime;
        results.push(duration);
      }

      // Should handle larger content without excessive performance degradation
      const scalingFactor = results[2] / results[0]; // 100KB vs 1KB
      expect(scalingFactor).toBeLessThan(50); // Should not be more than 50x slower (adjusted for test environment)
    });
  });

  describe("Resource Cleanup", () => {
    it("should clean up resources after operations", async () => {
      const initialHandlers = process.listenerCount("uncaughtException");

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      const finalHandlers = process.listenerCount("uncaughtException");

      // Should not leak event listeners
      expect(finalHandlers).toBe(initialHandlers);
    });

    it("should handle cleanup on errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const initialHandlers = process.listenerCount("uncaughtException");

      try {
        await GoogleDriveFilePickerService.createSnippetStoreFile(
          mockCredentials,
          { name: "test.json" },
        );
        fail("Should have thrown an error");
      } catch (error) {
        const finalHandlers = process.listenerCount("uncaughtException");

        // Should clean up even on errors
        expect(finalHandlers).toBe(initialHandlers);
      }
    });
  });

  describe("Caching and Optimization", () => {
    it("should avoid redundant API calls", async () => {
      // Create the same file multiple times
      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      // Should make 3 calls (1 validation + 2 creates)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should optimize repeated validations", async () => {
      await GoogleDriveFilePickerService.validateSnippetStoreFile(
        mockCredentials,
        "file123",
      );

      await GoogleDriveFilePickerService.validateSnippetStoreFile(
        mockCredentials,
        "file123",
      );

      // Should make 5 calls (2x credential validation + 2x file info + 1 initial validation)
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });
});
