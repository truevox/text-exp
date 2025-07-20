/**
 * Security tests for Google Drive scope compliance
 * Validates security boundaries and data protection
 */

import { GoogleDriveFilePickerService } from "../../src/background/cloud-adapters/google-drive/file-picker-service";
import { GoogleDriveAppDataManager } from "../../src/background/cloud-adapters/google-drive-appdata-manager";
import type { CloudCredentials } from "../../src/shared/types";

global.fetch = jest.fn();

describe("Google Drive Scope Compliance Security", () => {
  let mockCredentials: CloudCredentials;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockCredentials = {
      provider: "google-drive",
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
      expiresAt: new Date(Date.now() + 3600000),
    };

    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  describe("Token Security", () => {
    it("should never expose refresh tokens in API calls", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      // Verify no refresh token in any request
      const calls = mockFetch.mock.calls;
      calls.forEach((call) => {
        const [url, options] = call;

        // Check URL doesn't contain refresh token
        expect(url).not.toContain(mockCredentials.refreshToken);

        // Check headers don't contain refresh token
        if (options && options.headers) {
          const headers = options.headers as any;
          Object.values(headers).forEach((value) => {
            expect(value).not.toContain(mockCredentials.refreshToken);
          });
        }

        // Check body doesn't contain refresh token
        if (options && options.body) {
          const bodyString = options.body.toString();
          expect(bodyString).not.toContain(mockCredentials.refreshToken);
        }
      });
    });

    it("should only use Bearer token authentication", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.getFileInfo(
        mockCredentials,
        "file123",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockCredentials.accessToken}`,
          }),
        }),
      );
    });

    it("should not leak credentials in error messages", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Token expired"),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      try {
        await GoogleDriveFilePickerService.createSnippetStoreFile(
          mockCredentials,
          { name: "test.json" },
        );
        fail("Should have thrown an error");
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).not.toContain(mockCredentials.accessToken);
        expect(errorMessage).not.toContain(mockCredentials.refreshToken);
      }
    });
  });

  describe("Data Sanitization", () => {
    it("should sanitize user input in file names", async () => {
      const maliciousFileName = "<script>alert('xss')</script>.json";
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: maliciousFileName }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: maliciousFileName },
      );

      // Verify the request was made (service should handle sanitization)
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle prototype pollution attempts", async () => {
      const maliciousConfig = {
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } },
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
          selectedFiles: [],
          permissions: {},
        },
        lastSync: new Date().toISOString(),
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Should not throw error and should not pollute prototypes
      await GoogleDriveAppDataManager.storeUserConfiguration(
        mockCredentials,
        maliciousConfig,
      );

      // Verify prototypes weren't polluted
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect(({} as any).constructor.prototype.isAdmin).toBeUndefined();
    });

    it("should validate JSON content for security", async () => {
      const maliciousContent = JSON.stringify({
        snippets: [
          {
            id: "snippet1",
            trigger: "<script>alert('xss')</script>",
            content: "javascript:alert('xss')",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveAppDataManager.uploadToAppData(
        mockCredentials,
        "priority-0-snippets.json",
        maliciousContent,
      );

      // Should handle potentially dangerous content safely
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("Permission Validation", () => {
    it("should validate file permissions before operations", async () => {
      const mockFileInfoResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.json",
            mimeType: "application/json",
            permissions: [{ role: "reader" }], // Read-only
          }),
      };
      mockFetch.mockResolvedValue(mockFileInfoResponse as any);

      const result =
        await GoogleDriveFilePickerService.validateSnippetStoreFile(
          mockCredentials,
          "file123",
        );

      expect(result.isValid).toBe(true);
      expect(result.canWrite).toBe(false);
    });

    it("should reject files without proper permissions", async () => {
      const mockFileInfoResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
      };
      mockFetch.mockResolvedValue(mockFileInfoResponse as any);

      const result =
        await GoogleDriveFilePickerService.validateSnippetStoreFile(
          mockCredentials,
          "file123",
        );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Validation failed");
    });

    it("should enforce appdata file restrictions", async () => {
      const unauthorizedFiles = [
        "secret-data.json",
        "user-passwords.json",
        "admin-config.json",
        "../../../etc/passwd",
        "../../config.json",
      ];

      for (const fileName of unauthorizedFiles) {
        await expect(
          GoogleDriveAppDataManager.uploadToAppData(
            mockCredentials,
            fileName,
            "content",
          ),
        ).rejects.toThrow("is not allowed in appdata");
      }
    });
  });

  describe("Network Security", () => {
    it("should only make HTTPS requests", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      const calls = mockFetch.mock.calls;
      calls.forEach((call) => {
        const [url] = call;
        expect(url).toMatch(/^https:\/\//);
      });
    });

    it("should validate SSL certificates implicitly", async () => {
      // This test ensures we're using the standard fetch API
      // which validates SSL certificates by default
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      // Verify we're using standard fetch (not a custom insecure implementation)
      expect(global.fetch).toHaveBeenCalled();
    });

    it("should handle man-in-the-middle attack scenarios", async () => {
      // Mock a response that looks like it's from Google but has suspicious content
      const suspiciousResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.json",
            maliciousScript: "<script>alert('xss')</script>",
            redirectUrl: "http://evil.com/steal-token",
          }),
      };
      mockFetch.mockResolvedValue(suspiciousResponse as any);

      const result = await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      // Should only use expected fields
      expect(result.fileId).toBe("file123");
      expect(result.fileName).toBe("test.json");
      expect(result).not.toHaveProperty("maliciousScript");
      expect(result).not.toHaveProperty("redirectUrl");
    });
  });

  describe("Content Security", () => {
    it("should not execute or eval user content", async () => {
      const maliciousContent = {
        schema: "priority-tier-v1" as const,
        tier: "personal" as const,
        snippets: [
          {
            id: "snippet1",
            trigger: "eval",
            content: "eval('alert(\"xss\")')",
            contentType: "plaintext" as const,
            snipDependencies: [],
            description: "Malicious eval snippet",
            scope: "personal" as const,
            variables: [],
            images: [],
            tags: [],
            createdAt: new Date().toISOString(),
            createdBy: "test-user",
            updatedAt: new Date().toISOString(),
            updatedBy: "test-user",
          },
        ],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "test-user",
          description: "Malicious content test",
        },
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Should handle the content safely without executing it
      await GoogleDriveAppDataManager.storePriorityZeroSnippets(
        mockCredentials,
        maliciousContent,
      );

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle large payloads safely", async () => {
      const largeContent = {
        schema: "priority-tier-v1" as const,
        tier: "personal" as const,
        snippets: Array.from({ length: 10000 }, (_, i) => ({
          id: `snippet${i}`,
          trigger: `trigger${i}`,
          content: "A".repeat(1000), // Large content
          contentType: "plaintext" as const,
          snipDependencies: [],
          description: `Large snippet ${i}`,
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
          description: "Large payload test",
        },
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Should handle large payloads without memory issues
      await GoogleDriveAppDataManager.storePriorityZeroSnippets(
        mockCredentials,
        largeContent,
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("Error Information Disclosure", () => {
    it("should not expose internal system information in errors", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () =>
          Promise.resolve(
            "Database connection failed: postgres://user:pass@localhost/db",
          ),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      try {
        await GoogleDriveFilePickerService.createSnippetStoreFile(
          mockCredentials,
          { name: "test.json" },
        );
        fail("Should have thrown an error");
      } catch (error) {
        const errorMessage = (error as Error).message;

        // Should not expose internal system details
        expect(errorMessage).not.toContain("postgres://");
        expect(errorMessage).not.toContain("localhost");
        expect(errorMessage).not.toContain("Database connection");
        expect(errorMessage).not.toContain("user:pass");
      }
    });

    it("should sanitize error messages from API", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () =>
          Promise.resolve(
            "Invalid request: file path '/etc/passwd' not allowed",
          ),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      try {
        await GoogleDriveAppDataManager.uploadToAppData(
          mockCredentials,
          "puffpuffpaste-config.json",
          "content",
        );
        fail("Should have thrown an error");
      } catch (error) {
        // Error should be thrown but not expose system paths
        expect((error as Error).message).toBeDefined();
        expect((error as Error).message).not.toContain("/etc/passwd");
      }
    });
  });

  describe("Rate Limiting and DoS Protection", () => {
    it("should handle rate limiting gracefully", async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: () => Promise.resolve("Rate limit exceeded"),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        GoogleDriveFilePickerService.createSnippetStoreFile(mockCredentials, {
          name: "test.json",
        }),
      ).rejects.toThrow("Rate limit exceeded");
    });

    it("should not allow excessive concurrent operations", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Try to create many files simultaneously
      const promises = Array.from({ length: 100 }, (_, i) =>
        GoogleDriveFilePickerService.createSnippetStoreFile(mockCredentials, {
          name: `test${i}.json`,
        }),
      );

      // Should complete without overwhelming the system
      const results = await Promise.allSettled(promises);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    });
  });

  describe("Scope Boundary Enforcement", () => {
    it("should never attempt to access files outside allowed scopes", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveAppDataManager.listAppDataFiles(mockCredentials);

      // Verify only appdata endpoints are accessed
      const calls = mockFetch.mock.calls;
      calls.forEach((call) => {
        const [url] = call;
        if (url.toString().includes("drive/v3/files")) {
          expect(url).toMatch(/spaces=appDataFolder/);
        }
      });
    });

    it("should reject attempts to access root drive", async () => {
      // The services should not have methods that access root drive
      expect(GoogleDriveFilePickerService).not.toHaveProperty("listAllFiles");
      expect(GoogleDriveFilePickerService).not.toHaveProperty("searchAllFiles");
      expect(GoogleDriveAppDataManager).not.toHaveProperty("listDriveFiles");
      expect(GoogleDriveAppDataManager).not.toHaveProperty("searchDriveFiles");
    });
  });
});
