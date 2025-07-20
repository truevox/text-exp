/**
 * Integration tests for Google Drive scope compliance
 * Ensures the system works correctly with reduced permissions
 */

import { GoogleDriveAdapter } from "../../src/background/cloud-adapters/google-drive-adapter";
import { GoogleDriveFilePickerService } from "../../src/background/cloud-adapters/google-drive/file-picker-service";
import { GoogleDriveAppDataManager } from "../../src/background/cloud-adapters/google-drive-appdata-manager";
import { GoogleDriveAuthService } from "../../src/background/cloud-adapters/google-drive/auth-service";
import type { CloudCredentials } from "../../src/shared/types";

// Mock Chrome APIs
global.chrome = {
  runtime: {
    getManifest: jest.fn(() => ({
      oauth2: {
        client_id:
          "1037463573947-mjb7i96il5j0b2ul3ou7c1vld0b0q96a.apps.googleusercontent.com",
        scopes: [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/drive.appdata",
        ],
      },
    })),
  },
  identity: {
    getAuthToken: jest.fn(),
    clearAllCachedAuthTokens: jest
      .fn()
      .mockImplementation((callback) => callback()),
  },
} as any;

global.fetch = jest.fn();

// Mock GoogleDriveAuthService.validateCredentials to always succeed
jest.mock(
  "../../src/background/cloud-adapters/google-drive/auth-service",
  () => ({
    GoogleDriveAuthService: {
      validateCredentials: jest.fn().mockResolvedValue({ isValid: true }),
      getAuthHeaders: jest.fn().mockReturnValue({
        Authorization: "Bearer mock_token",
        "Content-Type": "application/json",
      }),
    },
  }),
);

describe("Google Drive Scope Compliance Integration", () => {
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

    // Default mock setup for most tests
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "file123", name: "test.json" }),
    } as any);
  });

  describe("OAuth2 Scope Validation", () => {
    it("should only request drive.file and drive.appdata scopes", () => {
      const manifest = chrome.runtime.getManifest();
      const requestedScopes = manifest.oauth2?.scopes;

      expect(requestedScopes).toEqual([
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.appdata",
      ]);

      // Should not request full drive scope
      expect(requestedScopes).not.toContain(
        "https://www.googleapis.com/auth/drive",
      );
    });

    it("should validate that no forbidden scopes are requested", () => {
      const manifest = chrome.runtime.getManifest();
      const requestedScopes = manifest.oauth2?.scopes;

      const forbiddenScopes = [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive.metadata",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
      ];

      forbiddenScopes.forEach((scope) => {
        expect(requestedScopes).not.toContain(scope);
      });
    });
  });

  describe("File Picker Service Compliance", () => {
    it("should only access user-selected or created files", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      // Verify only file creation endpoints are called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("upload/drive/v3/files"),
        expect.objectContaining({ method: "POST" }),
      );

      // Verify no folder browsing endpoints are called
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringMatching(/files\?q=.*folder/),
        expect.anything(),
      );
    });

    it("should not attempt to list all user files", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      // Should not call general file listing endpoints
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringMatching(/files\?q=(?!.*appDataFolder)/),
        expect.anything(),
      );
    });

    it("should validate file permissions correctly", async () => {
      const mockFileInfoResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.json",
            mimeType: "application/json",
            permissions: [{ role: "owner" }],
          }),
      };
      mockFetch.mockResolvedValue(mockFileInfoResponse as any);

      const result =
        await GoogleDriveFilePickerService.validateSnippetStoreFile(
          mockCredentials,
          "file123",
        );

      expect(result.isValid).toBe(true);
      expect(result.canWrite).toBe(true);
    });
  });

  describe("AppData Manager Compliance", () => {
    it("should only access appdata folder", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveAppDataManager.listAppDataFiles(mockCredentials);

      // Verify only appdata endpoints are called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("spaces=appDataFolder"),
        expect.anything(),
      );
    });

    it("should enforce allowed file name restrictions", async () => {
      const allowedFiles = [
        "puffpuffpaste-config.json",
        "priority-0-snippets.json",
        "puffpuffpaste-preferences.json",
      ];

      const forbiddenFiles = [
        "any-other-file.json",
        "user-data.json",
        "config.json",
        "snippets.json",
      ];

      // Test allowed files
      for (const fileName of allowedFiles) {
        const mockResponse = {
          ok: true,
          json: () => Promise.resolve({ files: [] }),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await expect(
          GoogleDriveAppDataManager.uploadToAppData(
            mockCredentials,
            fileName,
            "content",
          ),
        ).resolves.not.toThrow();
      }

      // Test forbidden files
      for (const fileName of forbiddenFiles) {
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

  describe("Complete Workflow Integration", () => {
    it("should complete file selection and setup workflow", async () => {
      const adapter = new GoogleDriveAdapter();

      // Setup mock responses for the workflow
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "file123", name: "personal.json" }),
        } as any) // Create file
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "file123",
              name: "personal.json",
              mimeType: "application/json",
              permissions: [{ role: "owner" }],
            }),
        } as any) // Validate file
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve("{}"),
        } as any) // Test access
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "file123",
              name: "personal.json",
              mimeType: "application/json",
              permissions: [{ role: "owner" }],
            }),
        } as any) // Second validate
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ files: [] }),
        } as any) // Config search
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "config123" }),
        } as any); // Config upload

      await adapter.initialize(mockCredentials);

      // Step 1: Create snippet store file
      const createdFile = await adapter.createSnippetStoreFile("personal");
      expect(createdFile.fileId).toBe("file123");

      // Step 2: Validate the file
      const validation = await adapter.validateSnippetStoreFile("file123");
      expect(validation.isValid).toBe(true);

      // Step 3: Test access
      const access = await adapter.testFileAccess("file123");
      expect(access.canRead).toBe(true);

      // Step 4: Store configuration in appdata
      const config = {
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
          selectedFiles: ["file123"],
          permissions: { file123: "write" },
        },
        lastSync: new Date().toISOString(),
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };

      await adapter.storeUserConfiguration(config);

      // Verify all operations completed successfully
      expect(mockFetch).toHaveBeenCalledTimes(8);
    });

    it("should handle permission errors gracefully", async () => {
      const adapter = new GoogleDriveAdapter();

      // Mock permission denied response for file creation
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("Permission denied"),
      } as any);

      await adapter.initialize(mockCredentials);

      await expect(adapter.createSnippetStoreFile("personal")).rejects.toThrow(
        "Permission denied",
      );
    });

    it("should work with read-only file access", async () => {
      const mockFileInfoResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "readonly.json",
            mimeType: "application/json",
            permissions: [{ role: "reader" }],
          }),
      };
      const mockAccessResponse = {
        ok: true,
        text: () => Promise.resolve("{}"),
      };

      mockFetch
        .mockResolvedValueOnce(mockFileInfoResponse as any)
        .mockResolvedValueOnce(mockAccessResponse as any)
        .mockResolvedValueOnce(mockFileInfoResponse as any);

      const result =
        await GoogleDriveFilePickerService.validateSnippetStoreFile(
          mockCredentials,
          "file123",
        );

      expect(result.isValid).toBe(true);
      expect(result.canWrite).toBe(false);
    });
  });

  describe("Error Handling and Fallbacks", () => {
    it("should handle network errors gracefully", async () => {
      // Completely reset and reconfigure the mock for this specific test
      mockFetch.mockReset();
      mockFetch.mockImplementation((url) => {
        if (
          typeof url === "string" &&
          url.includes("www.googleapis.com/upload/drive/v3/files")
        ) {
          return Promise.reject(new Error("Network error"));
        }
        // Return successful response for any other calls
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "file123", name: "test.json" }),
        } as any);
      });

      await expect(
        GoogleDriveFilePickerService.createSnippetStoreFile(mockCredentials, {
          name: "test.json",
        }),
      ).rejects.toThrow("Network error");
    });

    it("should handle invalid authentication", async () => {
      const mockAuthError = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      };

      mockFetch.mockResolvedValue(mockAuthError as any);

      await expect(
        GoogleDriveFilePickerService.getFileInfo(mockCredentials, "file123"),
      ).rejects.toThrow("Failed to get file info: Unauthorized");
    });

    it("should handle quota exceeded errors", async () => {
      // Mock quota error for the appdata search call
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: () => Promise.resolve("Quota exceeded"),
      } as any);

      await expect(
        GoogleDriveAppDataManager.uploadToAppData(
          mockCredentials,
          "puffpuffpaste-config.json",
          "content",
        ),
      ).rejects.toThrow(
        "Failed to upload puffpuffpaste-config.json to appdata: Failed to search appdata: Too Many Requests",
      );
    });

    it("should handle file not found errors", async () => {
      const mockNotFoundError = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };

      mockFetch.mockResolvedValue(mockNotFoundError as any);

      await expect(
        GoogleDriveFilePickerService.getFileInfo(
          mockCredentials,
          "nonexistent",
        ),
      ).rejects.toThrow("Failed to get file info: Not Found");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle multiple concurrent file operations", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          GoogleDriveFilePickerService.createSnippetStoreFile(mockCredentials, {
            name: `test${i}.json`,
          }),
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it("should efficiently handle large configuration objects", async () => {
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
          selectedFiles: Array.from({ length: 1000 }, (_, i) => `file${i}`),
          permissions: Object.fromEntries(
            Array.from({ length: 1000 }, (_, i) => [
              `file${i}`,
              "write" as const,
            ]),
          ) as Record<string, "read" | "write">,
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

      await expect(
        GoogleDriveAppDataManager.storeUserConfiguration(
          mockCredentials,
          largeConfig,
        ),
      ).resolves.not.toThrow();
    });
  });

  describe("Security Validations", () => {
    it("should not expose sensitive data in API calls", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json", content: JSON.stringify({ secret: "sensitive" }) },
      );

      // Verify the request doesn't contain sensitive data in headers
      const calls = mockFetch.mock.calls;
      calls.forEach((call) => {
        const [, options] = call;
        if (options && options.headers) {
          const authHeader = (options.headers as any).Authorization;
          expect(authHeader).toBe(`Bearer ${mockCredentials.accessToken}`);
          expect(authHeader).not.toContain("refresh_token");
          expect(authHeader).not.toContain("client_secret");
        }
      });
    });

    it("should validate file content for security", async () => {
      const maliciousContent = {
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } },
        normalData: "safe content",
      };

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Should not throw error but should handle safely
      await expect(
        GoogleDriveAppDataManager.uploadToAppData(
          mockCredentials,
          "puffpuffpaste-config.json",
          JSON.stringify(maliciousContent),
        ),
      ).resolves.not.toThrow();
    });
  });
});
