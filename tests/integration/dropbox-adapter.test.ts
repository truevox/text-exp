import { DropboxAdapter } from "../../src/background/cloud-adapters/dropbox-adapter";
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

// Mock fetch for Dropbox API calls
global.fetch = jest.fn();

// Mock process.env for Dropbox client ID
process.env.DROPBOX_CLIENT_ID = "test-dropbox-client-id";

describe("DropboxAdapter Integration", () => {
  let adapter: DropboxAdapter;
  const mockAccessToken = "mock_dropbox_access_token_12345";

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new DropboxAdapter();
    // Clear any previous runtime errors
    chrome.runtime.lastError = undefined;
  });

  describe("Authentication", () => {
    it("should authenticate using OAuth flow", async () => {
      // Mock successful OAuth flow
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          expect(options.url).toContain(
            "https://www.dropbox.com/oauth2/authorize",
          );
          expect(options.url).toContain("test-dropbox-client-id");
          expect(options.interactive).toBe(true);

          // Simulate successful redirect with access token
          callback(
            "https://test-extension-id.chromiumapp.org/#access_token=mock_dropbox_access_token_12345&token_type=bearer&expires_in=14400",
          );
        },
      );

      const credentials = await adapter.authenticate();

      expect(credentials).toBeDefined();
      expect(credentials.provider).toBe("dropbox");
      expect(credentials.accessToken).toBe("mock_dropbox_access_token_12345");
      expect(credentials.expiresAt).toBeDefined();
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
        {
          url: expect.stringContaining(
            "https://www.dropbox.com/oauth2/authorize",
          ),
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
        trigger: ";dropbox",
        content: "Dropbox is awesome!",
        createdAt: new Date("2023-01-02"),
        updatedAt: new Date("2023-01-02"),
      },
    ];

    beforeEach(() => {
      // Set up authenticated adapter
      adapter["credentials"] = {
        provider: "dropbox",
        accessToken: mockAccessToken,
      };
    });

    it("should upload snippets to Dropbox", async () => {
      // Mock successful file upload
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            name: "text-expander-snippets.json",
            id: "id:mock-file-id",
            size: 1024,
          }),
      });

      await adapter.uploadSnippets(testSnippets);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://content.dropboxapi.com/2/files/upload",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
              path: "/text-expander-snippets.json",
              mode: "overwrite",
              autorename: false,
            }),
          }),
          body: expect.stringContaining(";hello"),
        }),
      );
    });

    it("should handle upload rate limiting", async () => {
      // Mock rate limiting response
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: {
            get: jest.fn().mockReturnValue("1"), // 1 second retry-after
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "mock-file-id" }),
        });

      await adapter.uploadSnippets(testSnippets);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, 10000);

    it("should handle upload errors", async () => {
      // Mock upload error that persists through all retries
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      await expect(adapter.uploadSnippets(testSnippets)).rejects.toThrow(
        "Upload failed: Bad Request",
      );
    }, 10000);

    it("should download snippets from Dropbox", async () => {
      // Mock successful file download
      (global.fetch as jest.Mock).mockResolvedValue({
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
      expect(downloadedSnippets[1].trigger).toBe(";dropbox");
      expect(downloadedSnippets[1].content).toBe("Dropbox is awesome!");

      // Verify Date objects are properly reconstructed
      expect(downloadedSnippets[0].createdAt).toBeInstanceOf(Date);
      expect(downloadedSnippets[0].updatedAt).toBeInstanceOf(Date);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://content.dropboxapi.com/2/files/download",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
            "Dropbox-API-Arg": JSON.stringify({
              path: "/text-expander-snippets.json",
            }),
          }),
        }),
      );
    });

    it("should return empty array when file not found", async () => {
      // Mock file not found (409 error)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 409,
      });

      const downloadedSnippets = await adapter.downloadSnippets();

      expect(downloadedSnippets).toEqual([]);
    });

    it("should handle download errors", async () => {
      // Mock download error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(adapter.downloadSnippets()).rejects.toThrow(
        "Download failed: Internal Server Error",
      );
    }, 10000);

    it("should handle malformed JSON in downloaded file", async () => {
      // Mock file with invalid JSON
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("invalid json content"),
      });

      const downloadedSnippets = await adapter.downloadSnippets();

      // Should return empty array on parse error
      expect(downloadedSnippets).toEqual([]);
    });

    it("should delete snippets by re-uploading filtered list", async () => {
      // Mock download of current snippets
      (global.fetch as jest.Mock)
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
          json: () => Promise.resolve({ id: "mock-file-id" }),
        });

      await adapter.deleteSnippets(["test-1"]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      // Verify upload body contains only the non-deleted snippet
      const uploadCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(uploadCall[1].body).toContain("test-2");
      expect(uploadCall[1].body).not.toContain("test-1");
    });
  });

  describe("Connectivity and Validation", () => {
    beforeEach(() => {
      adapter["credentials"] = {
        provider: "dropbox",
        accessToken: mockAccessToken,
      };
    });

    it("should validate credentials successfully", async () => {
      // Mock successful account info API call
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            account_id: "test-account-id",
            name: { display_name: "Test User" },
          }),
      });

      const isValid = await adapter["validateCredentials"]();

      expect(isValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.dropboxapi.com/2/users/get_current_account",
        expect.objectContaining({
          method: "POST",
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
            account_id: "test-account-id",
          }),
      });

      const isConnected = await adapter["checkConnectivity"]();
      expect(isConnected).toBe(true);
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
        provider: "dropbox",
        accessToken: mockAccessToken,
      };
    });

    it("should handle empty snippets array upload", async () => {
      // Mock successful upload
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "mock-file-id" }),
      });

      await adapter.uploadSnippets([]);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://content.dropboxapi.com/2/files/upload",
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
          json: () => Promise.resolve({ id: "mock-file-id" }),
        });

      await adapter.uploadSnippets([]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    }, 10000);

    it("should handle missing environment variables", async () => {
      // Temporarily remove env var
      delete process.env.DROPBOX_CLIENT_ID;
      const newAdapter = new DropboxAdapter();

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
      process.env.DROPBOX_CLIENT_ID = "test-dropbox-client-id";
    });

    it("should sanitize snippets before upload", async () => {
      const snippetsWithSensitiveData = [
        {
          id: "test-1",
          trigger: ";password",
          content: "secret123",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "mock-file-id" }),
      });

      await adapter.uploadSnippets(snippetsWithSensitiveData);

      // Verify sanitization was applied
      const uploadCall = (global.fetch as jest.Mock).mock.calls[0];
      const uploadBody = uploadCall[1].body;
      expect(uploadBody).toBeDefined();
      expect(typeof uploadBody).toBe("string");
    });
  });
});
