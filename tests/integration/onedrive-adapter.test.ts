import { OneDriveAdapter } from "../../src/background/cloud-adapters/onedrive-adapter";
import { TextSnippet } from "../../src/shared/types";

// Mock Chrome APIs for testing
global.chrome = {
  runtime: {
    lastError: null,
    id: "test-extension-id",
  },
  identity: {
    getRedirectURL: jest.fn(() => "https://test-extension-id.chromiumapp.org/"),
    launchWebAuthFlow: jest.fn(),
  },
} as any;

// Mock fetch for OneDrive API calls
global.fetch = jest.fn();

// Mock process.env for OneDrive client ID
process.env.ONEDRIVE_CLIENT_ID = "test-onedrive-client-id";

describe("OneDriveAdapter Integration", () => {
  let adapter: OneDriveAdapter;
  const mockAccessToken = "mock_onedrive_access_token_12345";
  const mockFileId = "mock-file-id-123";

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new OneDriveAdapter();
    // Clear any previous runtime errors
    chrome.runtime.lastError = undefined;
  });

  describe("Authentication", () => {
    it("should authenticate using OAuth flow", async () => {
      // Mock successful OAuth flow
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          expect(options.url).toContain(
            "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
          );
          expect(options.url).toContain("test-onedrive-client-id");
          expect(options.url).toContain("Files.ReadWrite");
          expect(options.interactive).toBe(true);

          // Simulate successful redirect with access token
          callback(
            "https://test-extension-id.chromiumapp.org/#access_token=mock_onedrive_access_token_12345&token_type=bearer&expires_in=3600",
          );
        },
      );

      const credentials = await adapter.authenticate();

      expect(credentials).toBeDefined();
      expect(credentials.provider).toBe("onedrive");
      expect(credentials.accessToken).toBe("mock_onedrive_access_token_12345");
      expect(credentials.expiresAt).toBeDefined();
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
        {
          url: expect.stringContaining("https://login.microsoftonline.com"),
          interactive: true,
        },
        expect.any(Function),
      );
    });

    it("should handle OAuth cancellation", async () => {
      // Mock user cancellation
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          callback(null); // User cancelled
        },
      );

      await expect(adapter.authenticate()).rejects.toThrow(
        "Authentication cancelled",
      );
    });

    it("should handle OAuth errors", async () => {
      // Mock OAuth error
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          chrome.runtime.lastError = { message: "Network error occurred" };
          callback(null);
        },
      );

      await expect(adapter.authenticate()).rejects.toThrow(
        "Network error occurred",
      );
    });

    it("should handle malformed redirect URL", async () => {
      // Mock malformed redirect
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          callback(
            "https://test-extension-id.chromiumapp.org/#error=access_denied",
          );
        },
      );

      await expect(adapter.authenticate()).rejects.toThrow(
        "No access token received",
      );
    });
  });

  describe("File Operations", () => {
    const testSnippets: TextSnippet[] = [
      {
        id: "test-1",
        trigger: ";hello",
        content: "Hello World!",
        createdAt: new Date("2023-01-01"),
        updatedAt: new Date("2023-01-01"),
      },
      {
        id: "test-2",
        trigger: ";onedrive",
        content: "OneDrive is great!",
        createdAt: new Date("2023-01-02"),
        updatedAt: new Date("2023-01-02"),
      },
    ];

    beforeEach(() => {
      // Set up authenticated adapter
      adapter["credentials"] = {
        provider: "onedrive",
        accessToken: mockAccessToken,
      };
    });

    it("should upload snippets to OneDrive (create new file)", async () => {
      // Mock file creation
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: mockFileId,
            name: "text-expander-snippets.json",
            size: 1024,
          }),
      });

      await adapter.uploadSnippets(testSnippets);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://graph.microsoft.com/v1.0/me/drive/root:/text-expander-snippets.json:/content",
        ),
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining(";hello"),
        }),
      );
    });

    it("should upload snippets to OneDrive (update existing file)", async () => {
      // Set file ID to simulate existing file
      adapter["fileId"] = mockFileId;

      // Mock file update
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await adapter.uploadSnippets(testSnippets);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://graph.microsoft.com/v1.0/me/drive/items/${mockFileId}/content`,
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining(";hello"),
        }),
      );
    });

    it("should handle upload errors during file creation", async () => {
      // Mock upload error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      await expect(adapter.uploadSnippets(testSnippets)).rejects.toThrow(
        "Failed to create file: Bad Request",
      );
    }, 10000);

    it("should handle upload errors during file update", async () => {
      // Set file ID to simulate existing file
      adapter["fileId"] = mockFileId;

      // Mock upload error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(adapter.uploadSnippets(testSnippets)).rejects.toThrow(
        "Failed to update file: Internal Server Error",
      );
    }, 10000);

    it("should download snippets from OneDrive", async () => {
      // Mock finding file
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
        })
        // Mock downloading file content
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify(
                testSnippets.map((s) => ({
                  ...s,
                  createdAt: s.createdAt.toISOString(),
                  updatedAt: s.updatedAt.toISOString(),
                })),
              ),
            ),
        });

      const downloadedSnippets = await adapter.downloadSnippets();

      expect(downloadedSnippets).toHaveLength(2);
      expect(downloadedSnippets[0].trigger).toBe(";hello");
      expect(downloadedSnippets[0].content).toBe("Hello World!");
      expect(downloadedSnippets[1].trigger).toBe(";onedrive");
      expect(downloadedSnippets[1].content).toBe("OneDrive is great!");

      // Verify Date objects are properly reconstructed
      expect(downloadedSnippets[0].createdAt).toBeInstanceOf(Date);
      expect(downloadedSnippets[0].updatedAt).toBeInstanceOf(Date);

      // Verify API calls
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          "https://graph.microsoft.com/v1.0/me/drive/root:/text-expander-snippets.json",
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        }),
      );

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        `https://graph.microsoft.com/v1.0/me/drive/items/${mockFileId}/content`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        }),
      );
    });

    it("should return empty array when no snippets file exists", async () => {
      // Mock file not found (404 error)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const downloadedSnippets = await adapter.downloadSnippets();

      expect(downloadedSnippets).toEqual([]);
    });

    it("should handle download errors when finding file", async () => {
      // Mock file search error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(adapter.downloadSnippets()).rejects.toThrow(
        "Failed to find file: Internal Server Error",
      );
    }, 10000);

    it("should handle download errors when reading file content", async () => {
      // Mock finding file but error downloading content
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });

      await expect(adapter.downloadSnippets()).rejects.toThrow(
        "Failed to download file: Internal Server Error",
      );
    }, 10000);

    it("should handle malformed JSON in downloaded file", async () => {
      // Mock finding file and downloading invalid JSON
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve("invalid json content"),
        });

      const downloadedSnippets = await adapter.downloadSnippets();

      // Should return empty array on parse error
      expect(downloadedSnippets).toEqual([]);
    });

    it("should delete snippets by re-uploading filtered list", async () => {
      // Set file ID to simulate existing file
      adapter["fileId"] = mockFileId;

      // Mock download of current snippets
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () =>
            Promise.resolve(
              JSON.stringify(
                testSnippets.map((s) => ({
                  ...s,
                  createdAt: s.createdAt.toISOString(),
                  updatedAt: s.updatedAt.toISOString(),
                })),
              ),
            ),
        })
        // Mock upload of filtered snippets
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

      await adapter.deleteSnippets(["test-1"]);

      expect(global.fetch).toHaveBeenCalledTimes(3);
      // Verify upload body contains only the non-deleted snippet
      const uploadCall = (global.fetch as jest.Mock).mock.calls[2];
      expect(uploadCall[1].body).toContain("test-2");
      expect(uploadCall[1].body).not.toContain("test-1");
    });
  });

  describe("Connectivity and Validation", () => {
    beforeEach(() => {
      adapter["credentials"] = {
        provider: "onedrive",
        accessToken: mockAccessToken,
      };
    });

    it("should validate credentials successfully", async () => {
      // Mock successful user info API call
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "test-user-id",
            displayName: "Test User",
            mail: "test@example.com",
          }),
      });

      const isValid = await adapter["validateCredentials"]();

      expect(isValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/me",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should detect invalid credentials", async () => {
      // Mock invalid credentials response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const isValid = await adapter["validateCredentials"]();
      expect(isValid).toBe(false);
    });

    it("should handle validation network errors", async () => {
      // Mock network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const isValid = await adapter["validateCredentials"]();
      expect(isValid).toBe(false);
    });

    it("should check connectivity successfully", async () => {
      // Mock successful connectivity check
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "test-drive-id",
            owner: { user: { displayName: "Test User" } },
          }),
      });

      const isConnected = await adapter["checkConnectivity"]();
      expect(isConnected).toBe(true);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://graph.microsoft.com/v1.0/me/drive",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        }),
      );
    });

    it("should detect connectivity issues", async () => {
      // Mock connectivity failure
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error("Connection timeout"),
      );

      const isConnected = await adapter["checkConnectivity"]();
      expect(isConnected).toBe(false);
    });

    it("should handle missing credentials", async () => {
      // Remove credentials
      adapter["credentials"] = null;

      const isValid = await adapter["validateCredentials"]();
      expect(isValid).toBe(false);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    beforeEach(() => {
      adapter["credentials"] = {
        provider: "onedrive",
        accessToken: mockAccessToken,
      };
    });

    it("should handle empty snippets array upload", async () => {
      // Mock successful upload
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: mockFileId }),
      });

      await adapter.uploadSnippets([]);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://graph.microsoft.com/v1.0/me/drive/root:/text-expander-snippets.json:/content",
        ),
        expect.objectContaining({
          body: "[]",
        }),
      );
    });

    it("should retry operations on transient failures", async () => {
      // Mock transient failure followed by success
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
        });

      await adapter.uploadSnippets([]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, 10000);

    it("should handle missing environment variables", async () => {
      // Temporarily remove env var
      delete process.env.ONEDRIVE_CLIENT_ID;
      const newAdapter = new OneDriveAdapter();

      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          expect(options.url).toContain("client_id=");
          callback(
            "https://test-extension-id.chromiumapp.org/#access_token=test&expires_in=3600",
          );
        },
      );

      await newAdapter.authenticate();

      // Restore env var
      process.env.ONEDRIVE_CLIENT_ID = "test-onedrive-client-id";
    });

    it("should sanitize snippets before upload", async () => {
      const snippetsWithInvalidData = [
        {
          id: "test-1",
          trigger: ";valid",
          content: "Valid content",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "test-2",
          trigger: ";invalid",
          content: "Invalid content",
          createdAt: "not-a-date",
          updatedAt: "not-a-date",
        } as any,
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: mockFileId }),
      });

      await adapter.uploadSnippets(snippetsWithInvalidData);

      // Verify sanitization was applied
      const uploadCall = (global.fetch as jest.Mock).mock.calls[0];
      const uploadBody = uploadCall[1].body;
      expect(uploadBody).toBeDefined();
      expect(typeof uploadBody).toBe("string");

      // Should only contain valid snippet
      expect(uploadBody).toContain("valid");
      expect(uploadBody).not.toContain("invalid");
    });

    it("should handle file ID persistence across operations", async () => {
      const testSnippets = [
        {
          id: "test-1",
          trigger: ";hello",
          content: "Hello World!",
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
        {
          id: "test-2",
          trigger: ";onedrive",
          content: "OneDrive is great!",
          createdAt: new Date("2023-01-02"),
          updatedAt: new Date("2023-01-02"),
        },
      ];

      // Mock file creation
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: mockFileId }),
        })
        // Mock file update for second operation
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        });

      // First upload creates file
      await adapter.uploadSnippets([testSnippets[0]]);

      // Second upload should update existing file
      await adapter.uploadSnippets([testSnippets[1]]);

      // Verify first call was file creation
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(":/content"),
        expect.objectContaining({ method: "PUT" }),
      );

      // Verify second call was file update
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(`/items/${mockFileId}/content`),
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });
});
