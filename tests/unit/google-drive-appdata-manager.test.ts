/**
 * Te// Mock global fetch
const mockFetch = jest.fn();riveAppDataManager
 * Focus on drive.appdata scope compliance and restricted file access
 */

import { GoogleDriveAppDataManager } from "../../src/background/cloud-adapters/google-drive-appdata-manager";
import type { CloudCredentials } from "../../src/shared/types";
import type { TierStorageSchema } from "../../src/types/snippet-formats";

// Mock the auth service
jest.mock(
  "../../src/background/cloud-adapters/google-drive/auth-service",
  () => ({
    GoogleDriveAuthService: {
      validateCredentials: jest.fn().mockResolvedValue({ isValid: true }),
      getAuthHeaders: jest.fn().mockReturnValue({
        Authorization: "Bearer mock_access_token",
      }),
    },
  }),
);

// Mock fetch globally
global.fetch = jest.fn();

describe("GoogleDriveAppDataManager", () => {
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

    // Auth service is already mocked
  });

  describe("uploadToAppData", () => {
    it("should upload allowed files to appdata", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      const mockUploadResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123" }),
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any);

      await GoogleDriveAppDataManager.uploadToAppData(
        mockCredentials,
        "puffpuffpaste-config.json",
        JSON.stringify({ test: "data" }),
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("appDataFolder"),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockCredentials.accessToken}`,
          },
        }),
      );
    });

    it("should update existing files in appdata", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [{ id: "existing123" }] }),
      };
      const mockUpdateResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "existing123" }),
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockUpdateResponse as any);

      await GoogleDriveAppDataManager.uploadToAppData(
        mockCredentials,
        "puffpuffpaste-config.json",
        JSON.stringify({ updated: "data" }),
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("files/existing123"),
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });

    it("should reject unauthorized file names", async () => {
      await expect(
        GoogleDriveAppDataManager.uploadToAppData(
          mockCredentials,
          "unauthorized-file.json",
          "content",
        ),
      ).rejects.toThrow(
        "File unauthorized-file.json is not allowed in appdata",
      );
    });

    it("should handle upload errors", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      const mockUploadResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("Permission denied"),
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any);

      await expect(
        GoogleDriveAppDataManager.uploadToAppData(
          mockCredentials,
          "puffpuffpaste-config.json",
          "content",
        ),
      ).rejects.toThrow(
        "Failed to upload puffpuffpaste-config.json to appdata",
      );
    });

    it("should accept all allowed file names", async () => {
      const allowedFiles = [
        "puffpuffpaste-config.json",
        "priority-0-snippets.json",
        "puffpuffpaste-preferences.json",
      ];

      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      const mockUploadResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123" }),
      };

      for (const fileName of allowedFiles) {
        mockFetch
          .mockResolvedValueOnce(mockSearchResponse as any)
          .mockResolvedValueOnce(mockUploadResponse as any);

        await expect(
          GoogleDriveAppDataManager.uploadToAppData(
            mockCredentials,
            fileName,
            "content",
          ),
        ).resolves.not.toThrow();
      }
    });
  });

  describe("downloadFromAppData", () => {
    it("should download allowed files from appdata", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [{ id: "file123" }] }),
      };
      const mockDownloadResponse = {
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ test: "data" })),
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockDownloadResponse as any);

      const result = await GoogleDriveAppDataManager.downloadFromAppData(
        mockCredentials,
        "puffpuffpaste-config.json",
      );

      expect(result).toBe(JSON.stringify({ test: "data" }));
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("files/file123?alt=media"),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockCredentials.accessToken}`,
          },
        }),
      );
    });

    it("should reject unauthorized file names", async () => {
      await expect(
        GoogleDriveAppDataManager.downloadFromAppData(
          mockCredentials,
          "unauthorized-file.json",
        ),
      ).rejects.toThrow(
        "File unauthorized-file.json is not allowed in appdata",
      );
    });

    it("should handle file not found", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };

      mockFetch.mockResolvedValueOnce(mockSearchResponse as any);

      await expect(
        GoogleDriveAppDataManager.downloadFromAppData(
          mockCredentials,
          "puffpuffpaste-config.json",
        ),
      ).rejects.toThrow("File puffpuffpaste-config.json not found in appdata");
    });

    it("should handle download errors", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [{ id: "file123" }] }),
      };
      const mockDownloadResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockDownloadResponse as any);

      await expect(
        GoogleDriveAppDataManager.downloadFromAppData(
          mockCredentials,
          "puffpuffpaste-config.json",
        ),
      ).rejects.toThrow("Failed to download appdata file content: Forbidden");
    });
  });

  describe("storeUserConfiguration", () => {
    it("should store user configuration", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      const mockUploadResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "config123" }),
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any);

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
          selectedFiles: ["file1", "file2"],
          permissions: { file1: "read" as const, file2: "write" as const },
        },
        lastSync: new Date().toISOString(),
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };

      await GoogleDriveAppDataManager.storeUserConfiguration(
        mockCredentials,
        config,
      );

      // Verify the configuration was serialized and uploaded
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("upload/drive/v3/files"),
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        }),
      );
    });
  });

  describe("getUserConfiguration", () => {
    it("should retrieve user configuration", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [{ id: "config123" }] }),
      };
      const mockConfig = {
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
      const mockDownloadResponse = {
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockConfig)),
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockDownloadResponse as any);

      const result =
        await GoogleDriveAppDataManager.getUserConfiguration(mockCredentials);

      expect(result).toEqual(mockConfig);
    });

    it("should return null if no configuration found", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };

      mockFetch.mockResolvedValueOnce(mockSearchResponse as any);

      const result =
        await GoogleDriveAppDataManager.getUserConfiguration(mockCredentials);

      expect(result).toBeNull();
    });
  });

  describe("storePriorityZeroSnippets", () => {
    it("should store Priority #0 snippets", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      const mockUploadResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "snippets123" }),
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockUploadResponse as any);

      const snippetStore: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal", // Changed from "priority-0" to valid PriorityTier
        snippets: [
          {
            id: "snippet1",
            trigger: "test",
            content: "Test content",
            snipDependencies: [],
            contentType: "html",
            description: "Test snippet",
            scope: "personal",
            variables: [],
            images: [],
            tags: [],
            createdAt: new Date().toISOString(), // Changed to ISO string
            createdBy: "test-user",
            updatedAt: new Date().toISOString(), // Changed to ISO string
            updatedBy: "test-user",
          },
        ],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "test-user",
        },
      };

      await GoogleDriveAppDataManager.storePriorityZeroSnippets(
        mockCredentials,
        snippetStore,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("upload/drive/v3/files"),
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        }),
      );
    });
  });

  describe("getPriorityZeroSnippets", () => {
    it("should retrieve Priority #0 snippets", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [{ id: "snippets123" }] }),
      };
      const mockSnippets: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "personal", // Changed from "priority-0" to valid PriorityTier
        snippets: [
          {
            id: "snippet1",
            trigger: "test",
            content: "Test content",
            snipDependencies: [],
            contentType: "html",
            description: "Test snippet",
            scope: "personal",
            variables: [],
            images: [],
            tags: [],
            createdAt: new Date().toISOString(), // Changed to ISO string
            createdBy: "test-user",
            updatedAt: new Date().toISOString(), // Changed to ISO string
            updatedBy: "test-user",
          },
        ],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "test-user",
        },
      };
      const mockDownloadResponse = {
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockSnippets)),
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockDownloadResponse as any);

      const result =
        await GoogleDriveAppDataManager.getPriorityZeroSnippets(
          mockCredentials,
        );

      expect(result).toEqual(mockSnippets);
    });

    it("should return null if no snippets found", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };

      mockFetch.mockResolvedValueOnce(mockSearchResponse as any);

      const result =
        await GoogleDriveAppDataManager.getPriorityZeroSnippets(
          mockCredentials,
        );

      expect(result).toBeNull();
    });
  });

  describe("listAppDataFiles", () => {
    it("should list all files in appdata", async () => {
      const mockListResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            files: [
              {
                id: "file1",
                name: "puffpuffpaste-config.json",
                modifiedTime: "2023-01-01T00:00:00Z",
              },
              {
                id: "file2",
                name: "priority-0-snippets.json",
                modifiedTime: "2023-01-02T00:00:00Z",
              },
            ],
          }),
      };
      const mockContentResponse1 = {
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ config: "data" })),
      };
      const mockContentResponse2 = {
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ snippets: [] })),
      };

      mockFetch
        .mockResolvedValueOnce(mockListResponse as any)
        .mockResolvedValueOnce(mockContentResponse1 as any)
        .mockResolvedValueOnce(mockContentResponse2 as any);

      const result =
        await GoogleDriveAppDataManager.listAppDataFiles(mockCredentials);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "puffpuffpaste-config.json",
        content: JSON.stringify({ config: "data" }),
        lastModified: "2023-01-01T00:00:00Z",
      });
      expect(result[1]).toEqual({
        name: "priority-0-snippets.json",
        content: JSON.stringify({ snippets: [] }),
        lastModified: "2023-01-02T00:00:00Z",
      });
    });

    it("should handle files that cannot be read", async () => {
      const mockListResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            files: [
              {
                id: "file1",
                name: "puffpuffpaste-config.json",
                modifiedTime: "2023-01-01T00:00:00Z",
              },
              {
                id: "file2",
                name: "corrupted-file.json",
                modifiedTime: "2023-01-02T00:00:00Z",
              },
            ],
          }),
      };
      const mockContentResponse1 = {
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ config: "data" })),
      };
      const mockContentResponse2 = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
      };

      mockFetch
        .mockResolvedValueOnce(mockListResponse as any)
        .mockResolvedValueOnce(mockContentResponse1 as any)
        .mockResolvedValueOnce(mockContentResponse2 as any);

      const result =
        await GoogleDriveAppDataManager.listAppDataFiles(mockCredentials);

      expect(result).toHaveLength(1); // Only the readable file
      expect(result[0].name).toBe("puffpuffpaste-config.json");
    });
  });

  describe("deleteFromAppData", () => {
    it("should delete allowed files from appdata", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [{ id: "file123" }] }),
      };
      const mockDeleteResponse = {
        ok: true,
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockDeleteResponse as any);

      await GoogleDriveAppDataManager.deleteFromAppData(
        mockCredentials,
        "puffpuffpaste-config.json",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("files/file123"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should reject unauthorized file names", async () => {
      await expect(
        GoogleDriveAppDataManager.deleteFromAppData(
          mockCredentials,
          "unauthorized-file.json",
        ),
      ).rejects.toThrow(
        "File unauthorized-file.json is not allowed in appdata",
      );
    });

    it("should handle file not found gracefully", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };

      mockFetch.mockResolvedValueOnce(mockSearchResponse as any);

      await expect(
        GoogleDriveAppDataManager.deleteFromAppData(
          mockCredentials,
          "puffpuffpaste-config.json",
        ),
      ).resolves.not.toThrow();
    });
  });

  describe("migrateLegacyPreferences", () => {
    it("should migrate legacy preferences to new format", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [{ id: "legacy123" }] }),
      };
      const mockConfigSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }), // No existing config, so will create new
      };
      const mockLegacyPrefs = {
        triggerDelay: 150,
        caseSensitive: true,
        enableSharedSnippets: false,
        autoSync: false,
        syncInterval: 600,
        showNotifications: false,
      };
      const mockDownloadResponse = {
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockLegacyPrefs)),
      };
      const mockUploadResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "config123" }),
      };

      mockFetch
        .mockResolvedValueOnce(mockSearchResponse as any)
        .mockResolvedValueOnce(mockDownloadResponse as any)
        .mockResolvedValueOnce(mockConfigSearchResponse as any) // For new config search - no files found
        .mockResolvedValueOnce(mockUploadResponse as any);

      await GoogleDriveAppDataManager.migrateLegacyPreferences(mockCredentials);

      // Verify the new config was uploaded
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("upload/drive/v3/files"),
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        }),
      );
    });

    it("should handle case where no legacy preferences exist", async () => {
      const mockSearchResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };

      mockFetch.mockResolvedValueOnce(mockSearchResponse as any);

      await expect(
        GoogleDriveAppDataManager.migrateLegacyPreferences(mockCredentials),
      ).resolves.not.toThrow();
    });
  });

  describe("createDefaultUserConfiguration", () => {
    it("should create default configuration", () => {
      const config = GoogleDriveAppDataManager.createDefaultUserConfiguration();

      expect(config.version).toBe("1.0.0");
      expect(config.settings).toEqual({
        triggerDelay: 100,
        caseSensitive: false,
        enableSharedSnippets: true,
        autoSync: true,
        syncInterval: 300,
        showNotifications: true,
      });
      expect(config.preferredStores).toEqual({
        personalDefault: "personal.json",
        teamDefault: "team.json",
        orgDefault: "org.json",
      });
      expect(config.driveFiles).toEqual({
        selectedFiles: [],
        permissions: {},
      });
      expect(config.lastSync).toBeDefined();
      expect(config.created).toBeDefined();
      expect(config.modified).toBeDefined();
    });
  });

  describe("Drive AppData Scope Compliance", () => {
    it("should only access appdata folder", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveAppDataManager.listAppDataFiles(mockCredentials);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("spaces=appDataFolder"),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockCredentials.accessToken}`,
          },
        }),
      );
    });

    it("should not access regular drive files", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveAppDataManager.listAppDataFiles(mockCredentials);

      // Verify no calls to regular drive endpoints
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("drive/v3/files?q="),
        expect.anything(),
      );
    });

    it("should enforce file name restrictions", () => {
      const allowedFiles = [
        "puffpuffpaste-config.json",
        "priority-0-snippets.json",
        "puffpuffpaste-preferences.json",
      ];

      const forbiddenFiles = [
        "malicious-file.json",
        "user-data.json",
        "config.json",
        "snippets.json",
        "preferences.json",
      ];

      // Test that allowed files pass validation
      allowedFiles.forEach((fileName) => {
        expect(() =>
          (GoogleDriveAppDataManager as any).validateFileName(fileName),
        ).not.toThrow();
      });

      // Test that forbidden files are rejected
      forbiddenFiles.forEach((fileName) => {
        expect(() =>
          (GoogleDriveAppDataManager as any).validateFileName(fileName),
        ).toThrow();
      });
    });
  });
});
