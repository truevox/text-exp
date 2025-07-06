import { GoogleDriveAdapter } from "../../src/background/cloud-adapters/google-drive-adapter";
import { TextSnippet } from "../../src/shared/types";

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
  },
  notifications: {
    create: jest.fn(),
  },
} as any;

// Mock fetch for Google API calls
global.fetch = jest.fn();

describe("GoogleDriveAdapter Integration", () => {
  let adapter: GoogleDriveAdapter;
  const mockAccessToken = "mock_access_token_12345";

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new GoogleDriveAdapter();
  });

  describe("Authentication", () => {
    it("should authenticate using Chrome identity API", async () => {
      // Mock successful Chrome identity authentication
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          callback(mockAccessToken);
        },
      );

      const credentials = await adapter.authenticate();

      expect(credentials).toBeDefined();
      expect(credentials.provider).toBe("google-drive");
      expect(credentials.accessToken).toBe(mockAccessToken);
      expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
        {
          interactive: true,
          scopes: ["https://www.googleapis.com/auth/drive"],
        },
        expect.any(Function),
      );
    });

    it("should handle Chrome identity authentication failure", async () => {
      // Mock Chrome identity error
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          chrome.runtime.lastError = { message: "User denied access" };
          callback(null);
        },
      );

      // Mock fallback OAuth flow
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          chrome.runtime.lastError = undefined; // Clear error for fallback
          callback(
            "https://test-extension-id.chromiumapp.org/#access_token=fallback_token_123&expires_in=3600",
          );
        },
      );

      const credentials = await adapter.authenticate();

      expect(credentials).toBeDefined();
      expect(credentials.accessToken).toBe("fallback_token_123");
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalled();
    });

    it("should handle complete authentication failure", async () => {
      // Mock Chrome identity failure
      (chrome.identity.getAuthToken as jest.Mock).mockImplementation(
        (options, callback) => {
          chrome.runtime.lastError = { message: "Network error" };
          callback(null);
        },
      );

      // Mock OAuth flow failure
      (chrome.identity.launchWebAuthFlow as jest.Mock).mockImplementation(
        (options, callback) => {
          chrome.runtime.lastError = { message: "Authentication cancelled" };
          callback(null);
        },
      );

      await expect(adapter.authenticate()).rejects.toThrow(
        "Authentication cancelled",
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
        trigger: ";email",
        content: "test@example.com",
        createdAt: new Date("2023-01-02"),
        updatedAt: new Date("2023-01-02"),
      },
    ];

    beforeEach(async () => {
      // Set up authenticated adapter
      adapter["credentials"] = {
        provider: "google-drive",
        accessToken: mockAccessToken,
      };
    });

    it("should upload snippets to Google Drive", async () => {
      // Mock successful file creation
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "mock-file-id" }),
      });

      await adapter.uploadSnippets(testSnippets);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("upload/drive/v3/files"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        }),
      );
    });

    it("should download snippets from Google Drive", async () => {
      // Mock finding snippets file
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              files: [
                { id: "mock-file-id", name: "text-expander-snippets.json" },
              ],
            }),
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
      expect(downloadedSnippets[1].trigger).toBe(";email");

      // Verify API calls
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("drive/v3/files"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        }),
      );
    });

    it("should handle folder-specific downloads", async () => {
      const testFolderId = "test-folder-123";

      // Mock finding snippets file in specific folder
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              files: [
                { id: "folder-file-id", name: "text-expander-snippets.json" },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify([testSnippets[0]])),
        });

      const downloadedSnippets = await adapter.downloadSnippets(testFolderId);

      expect(downloadedSnippets).toHaveLength(1);
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(
          encodeURIComponent(`'${testFolderId}' in parents`),
        ),
        expect.any(Object),
      );
    });

    it("should return empty array when no snippets file exists", async () => {
      // Mock no files found
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: [] }),
      });

      const downloadedSnippets = await adapter.downloadSnippets();

      expect(downloadedSnippets).toEqual([]);
    });

    it("should handle API errors gracefully", async () => {
      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("Insufficient permissions"),
      });

      await expect(adapter.downloadSnippets()).rejects.toThrow(
        "Failed to search files: Forbidden",
      );
    });
  });

  describe("Folder Operations", () => {
    beforeEach(async () => {
      // Set up authenticated adapter
      adapter["credentials"] = {
        provider: "google-drive",
        accessToken: mockAccessToken,
      };
    });

    it("should list folders in Google Drive", async () => {
      const mockFolders = [
        { id: "folder-1", name: "My Snippets", parents: ["root"] },
        { id: "folder-2", name: "Work Snippets", parents: ["root"] },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: mockFolders }),
      });

      const folders = await adapter.getFolders();

      expect(folders).toHaveLength(2);
      expect(folders[0].name).toBe("My Snippets");
      expect(folders[0].isFolder).toBe(true);
      expect(folders[1].name).toBe("Work Snippets");
    });

    it("should create new folder", async () => {
      const newFolderName = "Test Snippets";

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ id: "new-folder-id", name: newFolderName }),
      });

      const createdFolder = await adapter.createFolder(newFolderName);

      expect(createdFolder.id).toBe("new-folder-id");
      expect(createdFolder.name).toBe(newFolderName);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("drive/v3/files"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(
            '"mimeType":"application/vnd.google-apps.folder"',
          ),
        }),
      );
    });

    it("should select folder for snippets", async () => {
      const mockFolders = [{ id: "folder-1", name: "PuffPuffPaste Snippets" }];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: mockFolders }),
      });

      const selection = await adapter.selectFolder();

      expect(selection.folderId).toBe("folder-1");
      expect(selection.folderName).toBe("PuffPuffPaste Snippets");
    });
  });

  describe("Connectivity and Validation", () => {
    beforeEach(async () => {
      adapter["credentials"] = {
        provider: "google-drive",
        accessToken: mockAccessToken,
      };
    });

    it("should validate credentials successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ access_token: mockAccessToken }),
      });

      const isValid = await adapter["validateCredentials"]();
      expect(isValid).toBe(true);
    });

    it("should detect invalid credentials", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const isValid = await adapter["validateCredentials"]();
      expect(isValid).toBe(false);
    });

    it("should check connectivity", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ user: { emailAddress: "test@gmail.com" } }),
      });

      const isConnected = await adapter["checkConnectivity"]();
      expect(isConnected).toBe(true);
    });

    it("should handle network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const isConnected = await adapter["checkConnectivity"]();
      expect(isConnected).toBe(false);
    });
  });

  describe("Multi-format File Discovery", () => {
    beforeEach(async () => {
      adapter["credentials"] = {
        provider: "google-drive",
        accessToken: mockAccessToken,
      };
    });

    it("should list files with metadata for multi-format support", async () => {
      const mockFiles = [
        {
          id: "file-1",
          name: "snippets.json",
          mimeType: "application/json",
          modifiedTime: "2023-01-01T10:00:00Z",
        },
        {
          id: "file-2",
          name: "personal.md",
          mimeType: "text/markdown",
          modifiedTime: "2023-01-02T10:00:00Z",
        },
        {
          id: "file-3",
          name: "work.txt",
          mimeType: "text/plain",
          modifiedTime: "2023-01-03T10:00:00Z",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ files: mockFiles }),
      });

      const files = await adapter.listFiles("test-folder-id");

      expect(files).toHaveLength(3);
      expect(files[0].name).toBe("snippets.json");
      expect(files[0].mimeType).toBe("application/json");
      expect(files[1].name).toBe("personal.md");
      expect(files[2].name).toBe("work.txt");
    });

    it("should download file content by ID for multi-format parsing", async () => {
      const fileContent =
        '---\nid: "test"\ntrigger: "hello"\n---\nHello World!';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(fileContent),
      });

      const content = await adapter.downloadFileContent("test-file-id");

      expect(content).toBe(fileContent);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/drive/v3/files/test-file-id?alt=media",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        }),
      );
    });
  });
});
