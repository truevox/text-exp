import { LocalFilesystemAdapter } from "../../src/background/cloud-adapters/local-filesystem-adapter";

describe("LocalFilesystemAdapter Integration", () => {
  beforeEach(() => {
    new LocalFilesystemAdapter();
  });

  test("should initialize adapter", () => {
    const adapter = new LocalFilesystemAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.provider).toBe("local-filesystem");
  });
});
