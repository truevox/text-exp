/**
 * Tests for MultiFormatSyncService
 */

// @ts-nocheck - Disable strict type checking for complex Jest mocking
import { MultiFormatSyncService } from "../../src/background/multi-format-sync-service.js";
import type { CloudAdapter } from "../../src/shared/types.js";

describe("MultiFormatSyncService", () => {
  let service: MultiFormatSyncService;
  let mockAdapter: CloudAdapter;

  beforeEach(() => {
    service = new MultiFormatSyncService();

    // Mock basic cloud adapter
    mockAdapter = {
      provider: "google-drive",
      authenticate: jest.fn(),
      uploadSnippets: jest.fn(),
      downloadSnippets: jest.fn().mockResolvedValue([
        {
          id: "1",
          trigger: "test",
          content: "test content",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      deleteSnippets: jest.fn(),
      getLastSyncTime: jest.fn(),
      hasLocalChanges: jest.fn(),
    };
  });

  describe("downloadSnippetsWithFormats", () => {
    it("should use original method for adapters without file discovery", async () => {
      const snippets = await service.downloadSnippetsWithFormats(
        mockAdapter,
        "folder123",
      );

      expect(mockAdapter.downloadSnippets).toHaveBeenCalledWith("folder123");
      expect(snippets).toHaveLength(1);
      expect(snippets[0].trigger).toBe("test");
    });

    it("should use multi-format discovery for enhanced adapters", async () => {
      // Enhance the mock adapter with file discovery
      const enhancedAdapter = {
        ...mockAdapter,
        listFiles: jest.fn().mockResolvedValue([
          { id: "file1", name: "snippets.json", mimeType: "application/json" },
          { id: "file2", name: "personal.md", mimeType: "text/markdown" },
          { id: "file3", name: "team.txt", mimeType: "text/plain" },
        ]),
        downloadFileContent: jest.fn().mockResolvedValueOnce(
          JSON.stringify([
            {
              id: "1",
              trigger: "json1",
              content: "From JSON",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]),
        ).mockResolvedValueOnce(`---
id: "2"
trigger: "md1"
createdAt: "2023-01-01"
updatedAt: "2023-01-01"
---
# Markdown content`).mockResolvedValueOnce(`---
id: "3"
trigger: "txt1"
createdAt: "2023-01-01"
updatedAt: "2023-01-01"
---
Plain text content`),
      };

      const snippets = await service.downloadSnippetsWithFormats(
        enhancedAdapter,
        "folder123",
      );

      expect(enhancedAdapter.listFiles).toHaveBeenCalledWith("folder123");
      expect(enhancedAdapter.downloadFileContent).toHaveBeenCalledTimes(3);
      expect(snippets).toHaveLength(3);

      const triggers = snippets.map((s) => s.trigger);
      expect(triggers).toContain("json1");
      expect(triggers).toContain("md1");
      expect(triggers).toContain("txt1");
    });

    it("should filter out non-snippet files", async () => {
      const enhancedAdapter = {
        ...mockAdapter,
        listFiles: jest.fn().mockResolvedValue([
          { id: "file1", name: "snippets.json", mimeType: "application/json" },
          {
            id: "file2",
            name: "document.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
          { id: "file3", name: "image.png", mimeType: "image/png" },
          { id: "file4", name: "personal.md", mimeType: "text/markdown" },
        ]),
        downloadFileContent: jest.fn().mockResolvedValueOnce(
          JSON.stringify([
            {
              id: "1",
              trigger: "json1",
              content: "From JSON",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]),
        ).mockResolvedValueOnce(`---
id: "2"
trigger: "md1"
createdAt: "2023-01-01"
updatedAt: "2023-01-01"
---
# Markdown content`),
      };

      const snippets = await service.downloadSnippetsWithFormats(
        enhancedAdapter,
        "folder123",
      );

      // Should only download the 2 snippet files (snippets.json and personal.md)
      expect(enhancedAdapter.downloadFileContent).toHaveBeenCalledTimes(2);
      expect(snippets).toHaveLength(2);
    });

    it("should handle errors gracefully and continue with other files", async () => {
      const enhancedAdapter = {
        ...mockAdapter,
        listFiles: jest.fn().mockResolvedValue([
          { id: "file1", name: "snippets.json", mimeType: "application/json" },
          { id: "file2", name: "broken.md", mimeType: "text/markdown" },
          { id: "file3", name: "working.txt", mimeType: "text/plain" },
        ]),
        downloadFileContent: jest
          .fn()
          .mockResolvedValueOnce(
            JSON.stringify([
              {
                id: "1",
                trigger: "json1",
                content: "From JSON",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]),
          )
          .mockRejectedValueOnce(new Error("File corrupted"))
          .mockResolvedValueOnce(`---
id: "3"
trigger: "txt1"
createdAt: "2023-01-01"
updatedAt: "2023-01-01"
---
Working content`),
      };

      const snippets = await service.downloadSnippetsWithFormats(
        enhancedAdapter,
        "folder123",
      );

      // Should get snippets from the working files despite one failure
      expect(snippets).toHaveLength(2);
      expect(snippets.map((s) => s.trigger)).toEqual(["json1", "txt1"]);
    });
  });

  describe("isSnippetFile", () => {
    it("should identify snippet files by extension", () => {
      expect(service["isSnippetFile"]("test.json")).toBe(true);
      expect(service["isSnippetFile"]("test.txt")).toBe(true);
      expect(service["isSnippetFile"]("test.md")).toBe(true);
      expect(service["isSnippetFile"]("test.html")).toBe(true);
      expect(service["isSnippetFile"]("test.tex")).toBe(true);
    });

    it("should identify snippet files by name patterns", () => {
      expect(service["isSnippetFile"]("snippets")).toBe(true);
      expect(service["isSnippetFile"]("snippet-collection")).toBe(true);
      expect(service["isSnippetFile"]("text-expander")).toBe(true);
      expect(service["isSnippetFile"]("templates")).toBe(true);
    });

    it("should reject non-snippet files", () => {
      expect(service["isSnippetFile"]("document.docx")).toBe(false);
      expect(service["isSnippetFile"]("image.png")).toBe(false);
      expect(service["isSnippetFile"]("video.mp4")).toBe(false);
      expect(service["isSnippetFile"]("executable.exe")).toBe(false);
      expect(service["isSnippetFile"]("thumbs.db")).toBe(false);
      expect(service["isSnippetFile"](".ds_store")).toBe(false);
    });

    it("should allow files without extensions (blacklist approach)", () => {
      expect(service["isSnippetFile"]("random-file")).toBe(true);
      expect(service["isSnippetFile"]("my-snippets")).toBe(true);
      expect(service["isSnippetFile"]("notes")).toBe(true);
      expect(service["isSnippetFile"]("README")).toBe(true);
    });
  });

  describe("supportsMultiFormat", () => {
    it("should detect adapters with file discovery capabilities", () => {
      const enhancedAdapter = {
        ...mockAdapter,
        listFiles: jest.fn(),
        downloadFileContent: jest.fn(),
      };

      expect(service.supportsMultiFormat(enhancedAdapter)).toBe(true);
      expect(service.supportsMultiFormat(mockAdapter)).toBe(false);
    });
  });

  describe("getCommonTextFormats", () => {
    it("should return common text-based file formats", () => {
      const formats = service.getCommonTextFormats();

      expect(formats).toContain(".json");
      expect(formats).toContain(".txt");
      expect(formats).toContain(".md");
      expect(formats).toContain(".html");
      expect(formats).toContain(".tex");
      expect(formats.length).toBeGreaterThan(5); // More formats now supported
    });
  });
});
