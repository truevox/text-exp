/**
 * Tests for File Selector Component
 */

import { FileSelector } from "../../src/ui/components/file-selector";
import { GoogleDriveAdapter } from "../../src/background/cloud-adapters/google-drive-adapter";
import type { CloudCredentials } from "../../src/shared/types";

// Mock the GoogleDriveAdapter
jest.mock("../../src/background/cloud-adapters/google-drive-adapter");

describe("FileSelector", () => {
  let fileSelector: FileSelector;
  let mockAdapter: jest.Mocked<GoogleDriveAdapter>;
  let container: HTMLElement;
  let mockCredentials: CloudCredentials;

  beforeEach(() => {
    // Create a mock container
    container = document.createElement("div");
    document.body.appendChild(container);

    // Create mock credentials
    mockCredentials = {
      provider: "google-drive",
      accessToken: "mock_access_token",
      refreshToken: "mock_refresh_token",
      expiresAt: new Date(Date.now() + 3600000),
    };

    // Create mock adapter
    mockAdapter = {
      createSnippetStoreFile: jest.fn(),
      initialize: jest.fn(),
      provider: "google-drive",
    } as any;

    // Create file selector
    fileSelector = new FileSelector(mockAdapter, container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe("render", () => {
    it("should render the file selector interface", async () => {
      await fileSelector.render();

      expect(container.querySelector(".file-selector")).toBeTruthy();
      expect(container.querySelector(".file-selector-header")).toBeTruthy();
      expect(container.querySelector(".tier-selectors")).toBeTruthy();
      expect(container.querySelector(".file-selector-actions")).toBeTruthy();
    });

    it("should render tier selectors for personal, team, and org", async () => {
      await fileSelector.render();

      expect(container.querySelector('[data-tier="personal"]')).toBeTruthy();
      expect(container.querySelector('[data-tier="team"]')).toBeTruthy();
      expect(container.querySelector('[data-tier="org"]')).toBeTruthy();
    });

    it("should show privacy-focused messaging", async () => {
      await fileSelector.render();

      const header = container.querySelector(".file-selector-header");
      expect(header?.textContent).toContain("Privacy First");
      expect(header?.textContent).toContain("minimal permissions");
    });

    it("should have action buttons with updated labels", async () => {
      await fileSelector.render();

      const aboutButton = container.querySelector("#scan-existing-files");
      const createButton = container.querySelector("#create-new-files");
      const saveButton = container.querySelector("#save-selections");

      expect(aboutButton?.textContent).toContain("About File Selection");
      expect(createButton?.textContent).toContain("Create Required Files");
      expect(saveButton?.textContent).toContain("Save Selections");
    });
  });

  describe("file creation", () => {
    it("should create a new file for a tier", async () => {
      mockAdapter.createSnippetStoreFile.mockResolvedValue({
        fileId: "file123",
        fileName: "personal.json",
      });

      await fileSelector.render();

      // Simulate creating a file for personal tier
      const createButton = container.querySelector(
        '[data-action="create"][data-tier="personal"]',
      ) as HTMLButtonElement;
      expect(createButton).toBeTruthy();

      createButton.click();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockAdapter.createSnippetStoreFile).toHaveBeenCalledWith(
        "personal",
        "Personal Snippets - Created by PuffPuffPaste",
      );
    });

    it("should handle file creation errors", async () => {
      mockAdapter.createSnippetStoreFile.mockRejectedValue(
        new Error("Creation failed"),
      );

      await fileSelector.render();

      const createButton = container.querySelector(
        '[data-action="create"][data-tier="personal"]',
      ) as HTMLButtonElement;
      createButton.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const statusMessage = container.querySelector("#status-message");
      expect(statusMessage?.textContent).toContain("Creation failed");
      expect(statusMessage?.className).toContain("error");
    });
  });

  describe("file selection workflow", () => {
    it("should show information about manual file selection", async () => {
      await fileSelector.render();

      // Mock window.confirm to return true
      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);

      const selectButton = container.querySelector(
        '[data-action="select"][data-tier="personal"]',
      ) as HTMLButtonElement;
      selectButton.click();

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining("Please select your Personal Snippets file"),
      );

      confirmSpy.mockRestore();
    });

    it("should show privacy information when about button is clicked", async () => {
      await fileSelector.render();

      // Mock window.alert
      const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

      const aboutButton = container.querySelector(
        "#scan-existing-files",
      ) as HTMLButtonElement;
      aboutButton.click();

      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining("privacy and security improvements"),
      );

      alertSpy.mockRestore();
    });
  });

  describe("create all missing files", () => {
    it("should create only missing required files", async () => {
      mockAdapter.createSnippetStoreFile.mockResolvedValue({
        fileId: "file123",
        fileName: "personal.json",
      });

      await fileSelector.render();

      const createAllButton = container.querySelector(
        "#create-new-files",
      ) as HTMLButtonElement;
      createAllButton.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should only create personal file (required)
      expect(mockAdapter.createSnippetStoreFile).toHaveBeenCalledTimes(1);
      expect(mockAdapter.createSnippetStoreFile).toHaveBeenCalledWith(
        "personal",
        "Personal Snippets - Created by PuffPuffPaste",
      );
    });

    it("should handle no missing files", async () => {
      await fileSelector.render();

      // Pre-select personal tier
      const personalSelection = {
        tier: "personal" as const,
        fileId: "existing123",
        fileName: "personal.json",
        selected: true,
      };

      (fileSelector as any).selections.set("personal", personalSelection);

      const createAllButton = container.querySelector(
        "#create-new-files",
      ) as HTMLButtonElement;
      createAllButton.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockAdapter.createSnippetStoreFile).not.toHaveBeenCalled();

      const statusMessage = container.querySelector("#status-message");
      expect(statusMessage?.textContent).toContain(
        "All required files already exist",
      );
    });
  });

  describe("save selections", () => {
    it("should save selections to chrome storage", async () => {
      // Mock chrome.storage.local.set
      const mockSet = jest.fn().mockResolvedValue(undefined);
      global.chrome = {
        storage: {
          local: {
            set: mockSet,
          },
        },
      } as any;

      await fileSelector.render();

      // Add a selection
      const selection = {
        tier: "personal" as const,
        fileId: "file123",
        fileName: "personal.json",
        selected: true,
      };

      (fileSelector as any).selections.set("personal", selection);
      (fileSelector as any).updateSaveButton();

      const saveButton = container.querySelector(
        "#save-selections",
      ) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(false);

      saveButton.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSet).toHaveBeenCalledWith({
        tier_file_selections: [selection],
        tier_selection_date: expect.any(String),
      });
    });

    it("should dispatch custom event when selections are saved", async () => {
      // Mock chrome.storage.local.set
      global.chrome = {
        storage: {
          local: {
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      } as any;

      await fileSelector.render();

      // Add a selection
      const selection = {
        tier: "personal" as const,
        fileId: "file123",
        fileName: "personal.json",
        selected: true,
      };

      (fileSelector as any).selections.set("personal", selection);
      (fileSelector as any).updateSaveButton();

      // Listen for custom event
      const eventSpy = jest.fn();
      window.addEventListener("tier-files-selected", eventSpy);

      const saveButton = container.querySelector(
        "#save-selections",
      ) as HTMLButtonElement;
      saveButton.click();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: [selection],
        }),
      );

      window.removeEventListener("tier-files-selected", eventSpy);
    });
  });

  describe("getSelections", () => {
    it("should return current selections", async () => {
      await fileSelector.render();

      const selection = {
        tier: "personal" as const,
        fileId: "file123",
        fileName: "personal.json",
        selected: true,
      };

      (fileSelector as any).selections.set("personal", selection);

      const selections = fileSelector.getSelections();
      expect(selections).toEqual([selection]);
    });
  });
});
