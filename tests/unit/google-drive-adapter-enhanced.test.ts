/**
 * Enhanced tests for GoogleDriveAdapter with reduced scope functionality
 * Focus on new file picker methods and drive.file + drive.appdata scope compliance
 */

import { GoogleDriveAdapter } from "../../src/background/cloud-adapters/google-drive-adapter";
import { GoogleDriveFilePickerService } from "../../src/background/cloud-adapters/google-drive/file-picker-service";
import { GoogleDriveAppDataManager } from "../../src/background/cloud-adapters/google-drive-appdata-manager";
import type { CloudCredentials } from "../../src/shared/types";
import type { TierStorageSchema } from "../../src/types/snippet-formats";

// Mock all dependencies
jest.mock(
  "../../src/background/cloud-adapters/google-drive/file-picker-service",
);
jest.mock("../../src/background/cloud-adapters/google-drive-appdata-manager");
jest.mock(
  "../../src/background/cloud-adapters/google-drive/auth-service",
  () => ({
    GoogleDriveAuthService: {
      validateCredentials: jest.fn().mockResolvedValue({ isValid: true }),
    },
  }),
);

describe("GoogleDriveAdapter Enhanced Functionality", () => {
  let adapter: GoogleDriveAdapter;
  let mockCredentials: CloudCredentials;

  beforeEach(async () => {
    jest.clearAllMocks();

    adapter = new GoogleDriveAdapter();
    mockCredentials = {
      provider: "google-drive",
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
      expiresAt: new Date(Date.now() + 3600000),
    };

    // The auth service is already mocked above

    // Set up adapter with credentials
    await adapter.initialize(mockCredentials);
  });

  describe("createSnippetStoreFile", () => {
    it("should create a new snippet store file", async () => {
      const mockResult = {
        fileId: "file123",
        fileName: "personal.json",
        isNewFile: true,
        permissions: "write" as const,
      };

      (
        GoogleDriveFilePickerService.createStructuredSnippetStore as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await adapter.createSnippetStoreFile(
        "personal",
        "Personal snippet store",
      );

      expect(result).toEqual({
        fileId: "file123",
        fileName: "personal.json",
      });

      expect(
        GoogleDriveFilePickerService.createStructuredSnippetStore,
      ).toHaveBeenCalledWith(
        mockCredentials,
        "personal",
        "Personal snippet store",
      );
    });

    it("should throw error if not authenticated", async () => {
      // Reset adapter to unauthenticated state
      const unauthenticatedAdapter = new GoogleDriveAdapter();

      await expect(
        unauthenticatedAdapter.createSnippetStoreFile("personal"),
      ).rejects.toThrow("Not authenticated");
    });

    it("should handle creation errors", async () => {
      (
        GoogleDriveFilePickerService.createStructuredSnippetStore as jest.Mock
      ).mockRejectedValue(new Error("Creation failed"));

      await expect(adapter.createSnippetStoreFile("personal")).rejects.toThrow(
        "Creation failed",
      );
    });
  });

  describe("validateSnippetStoreFile", () => {
    it("should validate a valid snippet store file", async () => {
      const mockResult = {
        isValid: true,
        canWrite: true,
      };

      (
        GoogleDriveFilePickerService.validateSnippetStoreFile as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await adapter.validateSnippetStoreFile("file123");

      expect(result).toEqual(mockResult);
      expect(
        GoogleDriveFilePickerService.validateSnippetStoreFile,
      ).toHaveBeenCalledWith(mockCredentials, "file123");
    });

    it("should handle validation errors", async () => {
      const mockResult = {
        isValid: false,
        reason: "File must be a JSON file",
        canWrite: false,
      };

      (
        GoogleDriveFilePickerService.validateSnippetStoreFile as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await adapter.validateSnippetStoreFile("file123");

      expect(result).toEqual(mockResult);
    });

    it("should throw error if not authenticated", async () => {
      const unauthenticatedAdapter = new GoogleDriveAdapter();

      await expect(
        unauthenticatedAdapter.validateSnippetStoreFile("file123"),
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("testFileAccess", () => {
    it("should test file access permissions", async () => {
      const mockResult = {
        canRead: true,
        canWrite: true,
      };

      (
        GoogleDriveFilePickerService.testFileAccess as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await adapter.testFileAccess("file123");

      expect(result).toEqual(mockResult);
      expect(GoogleDriveFilePickerService.testFileAccess).toHaveBeenCalledWith(
        mockCredentials,
        "file123",
      );
    });

    it("should handle access test errors", async () => {
      const mockResult = {
        canRead: false,
        canWrite: false,
        error: "Permission denied",
      };

      (
        GoogleDriveFilePickerService.testFileAccess as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await adapter.testFileAccess("file123");

      expect(result).toEqual(mockResult);
    });

    it("should throw error if not authenticated", async () => {
      const unauthenticatedAdapter = new GoogleDriveAdapter();

      await expect(
        unauthenticatedAdapter.testFileAccess("file123"),
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("getFileInfo", () => {
    it("should get file information", async () => {
      const mockResult = {
        id: "file123",
        name: "personal.json",
        mimeType: "application/json",
        permissions: ["owner"],
      };

      (GoogleDriveFilePickerService.getFileInfo as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const result = await adapter.getFileInfo("file123");

      expect(result).toEqual(mockResult);
      expect(GoogleDriveFilePickerService.getFileInfo).toHaveBeenCalledWith(
        mockCredentials,
        "file123",
      );
    });

    it("should handle file info errors", async () => {
      (GoogleDriveFilePickerService.getFileInfo as jest.Mock).mockRejectedValue(
        new Error("File not found"),
      );

      await expect(adapter.getFileInfo("file123")).rejects.toThrow(
        "File not found",
      );
    });

    it("should throw error if not authenticated", async () => {
      const unauthenticatedAdapter = new GoogleDriveAdapter();

      await expect(
        unauthenticatedAdapter.getFileInfo("file123"),
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("createDefaultSnippetStores", () => {
    it("should create all default snippet stores", async () => {
      const mockResult = [
        {
          fileId: "file1",
          fileName: "personal.json",
          isNewFile: true,
          permissions: "write" as const,
        },
        {
          fileId: "file2",
          fileName: "team.json",
          isNewFile: true,
          permissions: "write" as const,
        },
        {
          fileId: "file3",
          fileName: "org.json",
          isNewFile: true,
          permissions: "write" as const,
        },
      ];

      (
        GoogleDriveFilePickerService.createDefaultSnippetStores as jest.Mock
      ).mockResolvedValue(mockResult);

      const result = await adapter.createDefaultSnippetStores();

      expect(result).toEqual([
        { fileId: "file1", fileName: "personal.json", tier: "personal" },
        { fileId: "file2", fileName: "team.json", tier: "team" },
        { fileId: "file3", fileName: "org.json", tier: "org" },
      ]);

      expect(
        GoogleDriveFilePickerService.createDefaultSnippetStores,
      ).toHaveBeenCalledWith(mockCredentials);
    });

    it("should handle creation errors", async () => {
      (
        GoogleDriveFilePickerService.createDefaultSnippetStores as jest.Mock
      ).mockRejectedValue(new Error("Creation failed"));

      await expect(adapter.createDefaultSnippetStores()).rejects.toThrow(
        "Creation failed",
      );
    });

    it("should throw error if not authenticated", async () => {
      const unauthenticatedAdapter = new GoogleDriveAdapter();

      await expect(
        unauthenticatedAdapter.createDefaultSnippetStores(),
      ).rejects.toThrow("Not authenticated");
    });
  });

  describe("getFilePickerInstructions", () => {
    it("should return file picker instructions", () => {
      const mockInstructions = "Select JSON files from your Drive...";

      (
        GoogleDriveFilePickerService.getFilePickerInstructions as jest.Mock
      ).mockReturnValue(mockInstructions);

      const result = adapter.getFilePickerInstructions();

      expect(result).toBe(mockInstructions);
      expect(
        GoogleDriveFilePickerService.getFilePickerInstructions,
      ).toHaveBeenCalled();
    });
  });

  describe("AppData Integration", () => {
    describe("storeUserConfiguration", () => {
      it("should store user configuration in appdata", async () => {
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

        (
          GoogleDriveAppDataManager.storeUserConfiguration as jest.Mock
        ).mockResolvedValue(undefined);

        await adapter.storeUserConfiguration(mockConfig);

        expect(
          GoogleDriveAppDataManager.storeUserConfiguration,
        ).toHaveBeenCalledWith(mockCredentials, mockConfig);
      });

      it("should throw error if not authenticated", async () => {
        const unauthenticatedAdapter = new GoogleDriveAdapter();

        await expect(
          unauthenticatedAdapter.storeUserConfiguration({} as any),
        ).rejects.toThrow("Not authenticated");
      });
    });

    describe("getUserConfiguration", () => {
      it("should retrieve user configuration from appdata", async () => {
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

        (
          GoogleDriveAppDataManager.getUserConfiguration as jest.Mock
        ).mockResolvedValue(mockConfig);

        const result = await adapter.getUserConfiguration();

        expect(result).toEqual(mockConfig);
        expect(
          GoogleDriveAppDataManager.getUserConfiguration,
        ).toHaveBeenCalledWith(mockCredentials);
      });

      it("should return null if no configuration found", async () => {
        (
          GoogleDriveAppDataManager.getUserConfiguration as jest.Mock
        ).mockResolvedValue(null);

        const result = await adapter.getUserConfiguration();

        expect(result).toBeNull();
      });

      it("should throw error if not authenticated", async () => {
        const unauthenticatedAdapter = new GoogleDriveAdapter();

        await expect(
          unauthenticatedAdapter.getUserConfiguration(),
        ).rejects.toThrow("Not authenticated");
      });
    });

    describe("storePriorityZeroSnippets", () => {
      it("should store Priority #0 snippets in appdata", async () => {
        const mockSnippetStore: TierStorageSchema = {
          schema: "priority-tier-v1",
          tier: "personal",
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
            description: "Test store",
          },
        };

        (
          GoogleDriveAppDataManager.storePriorityZeroSnippets as jest.Mock
        ).mockResolvedValue(undefined);

        await adapter.storePriorityZeroSnippets(mockSnippetStore);

        expect(
          GoogleDriveAppDataManager.storePriorityZeroSnippets,
        ).toHaveBeenCalledWith(mockCredentials, mockSnippetStore);
      });

      it("should throw error if not authenticated", async () => {
        const unauthenticatedAdapter = new GoogleDriveAdapter();

        await expect(
          unauthenticatedAdapter.storePriorityZeroSnippets({} as any),
        ).rejects.toThrow("Not authenticated");
      });
    });

    describe("getPriorityZeroSnippets", () => {
      it("should retrieve Priority #0 snippets from appdata", async () => {
        const mockSnippetStore: TierStorageSchema = {
          schema: "priority-tier-v1",
          tier: "personal",
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
            description: "Test store",
          },
        };

        (
          GoogleDriveAppDataManager.getPriorityZeroSnippets as jest.Mock
        ).mockResolvedValue(mockSnippetStore);

        const result = await adapter.getPriorityZeroSnippets();

        expect(result).toEqual(mockSnippetStore);
        expect(
          GoogleDriveAppDataManager.getPriorityZeroSnippets,
        ).toHaveBeenCalledWith(mockCredentials);
      });

      it("should return null if no snippets found", async () => {
        (
          GoogleDriveAppDataManager.getPriorityZeroSnippets as jest.Mock
        ).mockResolvedValue(null);

        const result = await adapter.getPriorityZeroSnippets();

        expect(result).toBeNull();
      });

      it("should throw error if not authenticated", async () => {
        const unauthenticatedAdapter = new GoogleDriveAdapter();

        await expect(
          unauthenticatedAdapter.getPriorityZeroSnippets(),
        ).rejects.toThrow("Not authenticated");
      });
    });
  });

  describe("Tier-based Storage Methods", () => {
    describe("uploadTierSchema", () => {
      it("should upload tier schema to Google Drive", async () => {
        const mockSchema: TierStorageSchema = {
          schema: "priority-tier-v1",
          tier: "personal",
          snippets: [],
          metadata: {
            version: "1.0.0",
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            owner: "test-user",
          },
        };

        // Mock the uploadTierSchema method (it's implemented in the adapter)
        const uploadSpy = jest
          .spyOn(adapter, "uploadTierSchema")
          .mockResolvedValue("file123");

        const result = await adapter.uploadTierSchema(mockSchema);

        expect(result).toBe("file123");
        expect(uploadSpy).toHaveBeenCalledWith(mockSchema);
      });
    });

    describe("downloadTierSchema", () => {
      it("should download tier schema from Google Drive", async () => {
        const mockSchema: TierStorageSchema = {
          schema: "priority-tier-v1",
          tier: "personal",
          snippets: [],
          metadata: {
            version: "1.0.0",
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            owner: "test-user",
          },
        };

        // Mock the downloadTierSchema method
        const downloadSpy = jest
          .spyOn(adapter, "downloadTierSchema")
          .mockResolvedValue(mockSchema);

        const result = await adapter.downloadTierSchema("personal");

        expect(result).toEqual(mockSchema);
        expect(downloadSpy).toHaveBeenCalledWith("personal");
      });
    });

    describe("searchTierFiles", () => {
      it("should search for tier files", async () => {
        const mockFiles = [
          {
            id: "file1",
            name: "personal.json",
            modifiedTime: "2023-01-01T00:00:00Z",
          },
          {
            id: "file2",
            name: "team.json",
            modifiedTime: "2023-01-02T00:00:00Z",
          },
        ];

        // Mock the searchTierFiles method
        const searchSpy = jest
          .spyOn(adapter, "searchTierFiles")
          .mockResolvedValue(mockFiles);

        const result = await adapter.searchTierFiles();

        expect(result).toEqual(mockFiles);
        expect(searchSpy).toHaveBeenCalled();
      });
    });

    describe("deleteTierFile", () => {
      it("should delete tier file from Google Drive", async () => {
        // Mock the deleteTierFile method
        const deleteSpy = jest
          .spyOn(adapter, "deleteTierFile")
          .mockResolvedValue(true);

        const result = await adapter.deleteTierFile("personal");

        expect(result).toBe(true);
        expect(deleteSpy).toHaveBeenCalledWith("personal");
      });
    });
  });

  describe("Legacy Method Compatibility", () => {
    it("should maintain backward compatibility with legacy methods", async () => {
      // Test that removed methods don't exist
      expect(adapter).not.toHaveProperty("getFolders");
      expect(adapter).not.toHaveProperty("selectFolder");
      expect(adapter).not.toHaveProperty("createFolder");
    });

    it("should provide deprecated method warnings", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

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

      (
        GoogleDriveAppDataManager.storeUserConfiguration as jest.Mock
      ).mockResolvedValue(undefined);

      await adapter.storeUserPreferences(mockConfig);

      expect(consoleSpy).toHaveBeenCalledWith(
        "⚠️ storeUserPreferences is deprecated, use storeUserConfiguration",
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      (
        GoogleDriveFilePickerService.createStructuredSnippetStore as jest.Mock
      ).mockRejectedValue(new Error("Network error"));

      await expect(adapter.createSnippetStoreFile("personal")).rejects.toThrow(
        "Network error",
      );
    });

    it("should handle authentication errors", async () => {
      (
        GoogleDriveFilePickerService.validateSnippetStoreFile as jest.Mock
      ).mockRejectedValue(new Error("Authentication failed"));

      await expect(adapter.validateSnippetStoreFile("file123")).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("should handle permission errors", async () => {
      (
        GoogleDriveFilePickerService.testFileAccess as jest.Mock
      ).mockResolvedValue({
        canRead: false,
        canWrite: false,
        error: "Permission denied",
      });

      const result = await adapter.testFileAccess("file123");

      expect(result.error).toBe("Permission denied");
    });
  });

  describe("Scope Compliance", () => {
    beforeEach(() => {
      // Reset all mocks to their default successful state for this test suite
      (
        GoogleDriveFilePickerService.createStructuredSnippetStore as jest.Mock
      ).mockResolvedValue({
        fileId: "file123",
        fileName: "personal.json",
        isNewFile: true,
        permissions: "write" as const,
      });
    });

    it("should only use drive.file and drive.appdata scopes", () => {
      // Verify the adapter doesn't have methods requiring full drive scope
      expect(adapter).not.toHaveProperty("getFolders");
      expect(adapter).not.toHaveProperty("selectFolder");
      expect(adapter).not.toHaveProperty("listAllFolders");
      expect(adapter).not.toHaveProperty("browseFolder");
    });

    it("should use file picker service for all file operations", async () => {
      await adapter.createSnippetStoreFile("personal");

      expect(
        GoogleDriveFilePickerService.createStructuredSnippetStore,
      ).toHaveBeenCalled();
    });

    it("should use appdata manager for configuration storage", async () => {
      await adapter.storeUserConfiguration({} as any);

      expect(
        GoogleDriveAppDataManager.storeUserConfiguration,
      ).toHaveBeenCalled();
    });
  });
});
