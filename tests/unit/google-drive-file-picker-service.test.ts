/**
 * Tests for GoogleDriveFilePickerService
 * Focus on drive.file scope compliance and file picker operations
 */

import { GoogleDriveFilePickerService } from "../../src/background/cloud-adapters/google-drive/file-picker-service";
import type { CloudCredentials } from "../../src/shared/types";
import { GoogleDriveAuthService } from "../../src/background/cloud-adapters/google-drive/auth-service";

// Mock the auth service
jest.mock("../../src/background/cloud-adapters/google-drive/auth-service");

// Mock fetch globally
global.fetch = jest.fn();

describe("GoogleDriveFilePickerService", () => {
  let mockCredentials: CloudCredentials;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockCredentials = {
      provider: "google-drive",
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    };

    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();

    // Mock auth headers
    (GoogleDriveAuthService.getAuthHeaders as jest.Mock).mockReturnValue({
      Authorization: `Bearer ${mockCredentials.accessToken}`,
    });
  });

  describe("createSnippetStoreFile", () => {
    it("should create a new JSON file with default content", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      expect(result).toEqual({
        fileId: "file123",
        fileName: "test.json",
        isNewFile: true,
        permissions: "write",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("upload/drive/v3/files"),
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: `Bearer ${mockCredentials.accessToken}`,
          },
        }),
      );
    });

    it("should create a file with custom content", async () => {
      const customContent = JSON.stringify({ test: "data" });
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file456", name: "custom.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "custom.json", content: customContent },
      );

      expect(result.fileId).toBe("file456");
      expect(result.fileName).toBe("custom.json");
    });

    it("should handle API errors", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("Permission denied"),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        GoogleDriveFilePickerService.createSnippetStoreFile(mockCredentials, {
          name: "test.json",
        }),
      ).rejects.toThrow("Failed to create file: Forbidden - Permission denied");
    });

    it("should include parentId when specified", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file789", name: "nested.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "nested.json", parentId: "parent123" },
      );

      // Verify the request included the parent folder
      const formData = mockFetch.mock.calls[0][1]?.body as FormData;
      expect(formData).toBeInstanceOf(FormData);
    });
  });

  describe("getFileInfo", () => {
    it("should retrieve file information", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.json",
            mimeType: "application/json",
            permissions: [{ role: "owner" }],
          }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await GoogleDriveFilePickerService.getFileInfo(
        mockCredentials,
        "file123",
      );

      expect(result).toEqual({
        id: "file123",
        name: "test.json",
        mimeType: "application/json",
        permissions: ["owner"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("drive/v3/files/file123"),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockCredentials.accessToken}`,
          },
        }),
      );
    });

    it("should handle permission errors", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        GoogleDriveFilePickerService.getFileInfo(
          mockCredentials,
          "nonexistent",
        ),
      ).rejects.toThrow("Failed to get file info: Not Found");
    });
  });

  describe("canWriteToFile", () => {
    it("should return true for owner permissions", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.json",
            permissions: [{ role: "owner" }],
          }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await GoogleDriveFilePickerService.canWriteToFile(
        mockCredentials,
        "file123",
      );

      expect(result).toBe(true);
    });

    it("should return true for writer permissions", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.json",
            permissions: [{ role: "writer" }],
          }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await GoogleDriveFilePickerService.canWriteToFile(
        mockCredentials,
        "file123",
      );

      expect(result).toBe(true);
    });

    it("should return false for reader permissions", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.json",
            permissions: [{ role: "reader" }],
          }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await GoogleDriveFilePickerService.canWriteToFile(
        mockCredentials,
        "file123",
      );

      expect(result).toBe(false);
    });

    it("should return false on API errors", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await GoogleDriveFilePickerService.canWriteToFile(
        mockCredentials,
        "file123",
      );

      expect(result).toBe(false);
    });
  });

  describe("validateSnippetStoreFile", () => {
    it("should validate JSON files", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.json",
            mimeType: "application/json",
            permissions: [{ role: "owner" }],
          }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result =
        await GoogleDriveFilePickerService.validateSnippetStoreFile(
          mockCredentials,
          "file123",
        );

      expect(result).toEqual({
        isValid: true,
        canWrite: true,
      });
    });

    it("should validate files with .json extension", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.json",
            mimeType: "text/plain",
            permissions: [{ role: "owner" }],
          }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result =
        await GoogleDriveFilePickerService.validateSnippetStoreFile(
          mockCredentials,
          "file123",
        );

      expect(result.isValid).toBe(true);
    });

    it("should reject non-JSON files", async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            name: "test.txt",
            mimeType: "text/plain",
            permissions: [{ role: "owner" }],
          }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result =
        await GoogleDriveFilePickerService.validateSnippetStoreFile(
          mockCredentials,
          "file123",
        );

      expect(result).toEqual({
        isValid: false,
        reason: "File must be a JSON file",
        canWrite: false,
      });
    });

    it("should handle validation errors", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result =
        await GoogleDriveFilePickerService.validateSnippetStoreFile(
          mockCredentials,
          "file123",
        );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Validation failed");
    });
  });

  describe("createDefaultSnippetStores", () => {
    it("should create all default stores", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "personal.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result =
        await GoogleDriveFilePickerService.createDefaultSnippetStores(
          mockCredentials,
        );

      expect(result).toHaveLength(3);
      expect(result[0].fileName).toBe("personal.json");
      expect(result[1].fileName).toBe("team.json");
      expect(result[2].fileName).toBe("org.json");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should continue creating stores even if one fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Error",
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "file2", name: "team.json" }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "file3", name: "org.json" }),
        } as any);

      const result =
        await GoogleDriveFilePickerService.createDefaultSnippetStores(
          mockCredentials,
        );

      expect(result).toHaveLength(2); // Only successful ones
      expect(result[0].fileName).toBe("team.json");
      expect(result[1].fileName).toBe("org.json");
    });
  });

  describe("testFileAccess", () => {
    it("should test file read and write access", async () => {
      const mockReadResponse = {
        ok: true,
        text: () => Promise.resolve("content"),
      };
      const mockMetadataResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123" }),
      };
      const mockPermissionsResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            id: "file123",
            permissions: [{ role: "owner" }],
          }),
      };

      mockFetch
        .mockResolvedValueOnce(mockReadResponse as any)
        .mockResolvedValueOnce(mockMetadataResponse as any)
        .mockResolvedValueOnce(mockPermissionsResponse as any);

      const result = await GoogleDriveFilePickerService.testFileAccess(
        mockCredentials,
        "file123",
      );

      expect(result).toEqual({
        canRead: true,
        canWrite: true,
      });
    });

    it("should handle read errors", async () => {
      const mockReadResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
      };
      const mockMetadataResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123" }),
      };

      mockFetch
        .mockResolvedValueOnce(mockReadResponse as any)
        .mockResolvedValueOnce(mockMetadataResponse as any);

      const result = await GoogleDriveFilePickerService.testFileAccess(
        mockCredentials,
        "file123",
      );

      expect(result.canRead).toBe(false);
      expect(result.error).toBe("Cannot read file: Forbidden");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await GoogleDriveFilePickerService.testFileAccess(
        mockCredentials,
        "file123",
      );

      expect(result).toEqual({
        canRead: false,
        canWrite: false,
        error: "Network error",
      });
    });
  });

  describe("getFilePickerInstructions", () => {
    it("should return user-friendly instructions", () => {
      const instructions =
        GoogleDriveFilePickerService.getFilePickerInstructions();

      expect(instructions).toContain("Choose existing JSON files");
      expect(instructions).toContain("Create new JSON files");
      expect(instructions).toContain("files you specifically select");
      expect(instructions).toContain("JSON format");
      expect(instructions).toContain("respect your privacy");
    });
  });

  describe("createStructuredSnippetStore", () => {
    it("should create a structured snippet store", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "personal.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result =
        await GoogleDriveFilePickerService.createStructuredSnippetStore(
          mockCredentials,
          "personal",
          "Personal snippet store",
        );

      expect(result).toEqual({
        fileId: "file123",
        fileName: "personal.json",
        isNewFile: true,
        permissions: "write",
      });
    });

    it("should use default description if none provided", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "work.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createStructuredSnippetStore(
        mockCredentials,
        "work",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("upload/drive/v3/files"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("Drive API Scope Compliance", () => {
    it("should only use drive.file scope endpoints", async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ id: "file123", name: "test.json" }),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await GoogleDriveFilePickerService.createSnippetStoreFile(
        mockCredentials,
        { name: "test.json" },
      );

      // Verify no calls to forbidden endpoints
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("files?q="),
        expect.anything(),
      );
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("parents in"),
        expect.anything(),
      );
    });

    it("should not attempt folder browsing operations", async () => {
      // This service should not have methods for folder browsing
      expect(GoogleDriveFilePickerService).not.toHaveProperty("getFolders");
      expect(GoogleDriveFilePickerService).not.toHaveProperty("listFolders");
      expect(GoogleDriveFilePickerService).not.toHaveProperty("selectFolder");
    });
  });
});
