import { LocalFilesystemAdapter } from "../../src/background/cloud-adapters/local-filesystem-adapter";

describe("LocalFilesystemAdapter Integration", () => {
  beforeEach(() => {
    new LocalFilesystemAdapter();
    // Mock File System Access API calls here if running in a non-browser environment
  });

  test.skip("should select a folder and persist handle", async () => {
    // Mock window.showDirectoryPicker
    // const mockHandle = { name: 'test-folder', queryPermission: jest.fn().mockResolvedValue('granted'), requestPermission: jest.fn().mockResolvedValue('granted') };
    // jest.spyOn(window, 'showDirectoryPicker').mockResolvedValue(mockHandle as any);
    // const handle = await adapter.selectFolder();
    // expect(handle).toBe(mockHandle);
    // expect(await adapter.isAuthenticated()).toBe(true);
  });

  test.skip("should upload and download snippets", async () => {
    // Requires a selected folder
    // const mockSnippets: TextSnippet[] = [
    //   { id: '1', trigger: ';test', content: 'Test content', createdAt: new Date(), updatedAt: new Date() }
    // ];
    // await adapter.uploadSnippets(mockSnippets);
    // const downloadedSnippets = await adapter.downloadSnippets();
    // expect(downloadedSnippets).toEqual(mockSnippets);
  });

  test.skip("should handle changes based on file modification time", async () => {
    // Simulate file changes and check listChanges
  });

  test.skip("should handle errors gracefully", async () => {
    // Test error scenarios
  });
});
