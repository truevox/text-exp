/**
 * Multi-Store Editor Tests
 * Tests for same-screen store selection with duplicate detection
 */

import {
  MultiStoreEditor,
  type StoreSnippetInfo,
  type DuplicateSnippetGroup,
} from "../../src/ui/components/multi-store-editor";
import type { TextSnippet } from "../../src/shared/types";
import type { EnhancedSnippet } from "../../src/types/snippet-formats";

// Mock DOM environment
const mockContainer = {
  innerHTML: "",
  querySelector: jest.fn(),
  addEventListener: jest.fn(),
  classList: {
    toggle: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
  },
} as any;

describe("MultiStoreEditor", () => {
  let editor: MultiStoreEditor;
  let mockStores: StoreSnippetInfo[];
  let mockSnippets: TextSnippet[];

  beforeEach(() => {
    // Create mock snippets
    mockSnippets = [
      {
        id: "snippet1",
        trigger: ";hello",
        content: "Hello, World!",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "snippet2",
        trigger: ";team",
        content: "Hello, Team!",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "snippet3",
        trigger: ";goodbye",
        content: "Goodbye!",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Create mock stores
    mockStores = [
      {
        storeId: "store1",
        storeName: "personal.json",
        displayName: "Personal Store",
        tierName: "personal",
        snippetCount: 2,
        isReadOnly: false,
        isDriveFile: true,
        fileId: "drive_file_1",
        lastModified: "2023-01-01T00:00:00Z",
        snippets: [mockSnippets[0], mockSnippets[2]],
      },
      {
        storeId: "store2",
        storeName: "team.json",
        displayName: "Team Store",
        tierName: "team",
        snippetCount: 1,
        isReadOnly: false,
        isDriveFile: true,
        fileId: "drive_file_2",
        lastModified: "2023-01-02T00:00:00Z",
        snippets: [mockSnippets[1]],
      },
      {
        storeId: "store3",
        storeName: "readonly.json",
        displayName: "Read-Only Store",
        tierName: "org",
        snippetCount: 1,
        isReadOnly: true,
        isDriveFile: false,
        lastModified: "2023-01-03T00:00:00Z",
        snippets: [mockSnippets[0]], // Duplicate trigger
      },
    ];

    // Reset mocks
    jest.clearAllMocks();
    mockContainer.innerHTML = "";
    mockContainer.querySelector.mockReturnValue(null);
  });

  describe("Constructor and Initialization", () => {
    test("should create editor with default options", () => {
      editor = new MultiStoreEditor({
        stores: mockStores,
      });

      expect(editor).toBeDefined();
      expect(editor.getSelectedStores()).toEqual([]);
      expect(editor.getDuplicateGroups()).toEqual([]);
    });

    test("should create editor with custom options", () => {
      const mockOnStoreChange = jest.fn();
      const mockOnDuplicateResolution = jest.fn();

      editor = new MultiStoreEditor({
        stores: mockStores,
        enableDuplicateDetection: false,
        enableCrossStoreEditing: false,
        showReadOnlyStores: false,
        onStoreSelectionChange: mockOnStoreChange,
        onDuplicateResolution: mockOnDuplicateResolution,
      });

      expect(editor).toBeDefined();
    });

    test("should initialize with current snippet", () => {
      const currentSnippet: TextSnippet = {
        id: "current",
        trigger: ";test",
        content: "Test content",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      editor = new MultiStoreEditor({
        stores: mockStores,
        currentSnippet,
      });

      expect(editor).toBeDefined();
    });

    test("should throw error when initializing twice", async () => {
      editor = new MultiStoreEditor({
        stores: mockStores,
      });

      await editor.init(mockContainer);

      await expect(editor.init(mockContainer)).rejects.toThrow(
        "Multi-store editor already initialized",
      );
    });
  });

  describe("Store Selection", () => {
    beforeEach(async () => {
      editor = new MultiStoreEditor({
        stores: mockStores,
      });
      await editor.init(mockContainer);
    });

    test("should track selected stores", () => {
      expect(editor.getSelectedStores()).toEqual([]);

      // Simulate store selection
      editor["handleStoreSelection"]("store1", true);
      expect(editor.getSelectedStores()).toEqual(["store1"]);

      editor["handleStoreSelection"]("store2", true);
      expect(editor.getSelectedStores()).toEqual(["store1", "store2"]);

      editor["handleStoreSelection"]("store1", false);
      expect(editor.getSelectedStores()).toEqual(["store2"]);
    });

    test("should call onStoreSelectionChange callback", () => {
      const mockCallback = jest.fn();
      editor = new MultiStoreEditor({
        stores: mockStores,
        onStoreSelectionChange: mockCallback,
      });

      editor["handleStoreSelection"]("store1", true);
      expect(mockCallback).toHaveBeenCalledWith(["store1"]);

      editor["handleStoreSelection"]("store2", true);
      expect(mockCallback).toHaveBeenCalledWith(["store1", "store2"]);
    });

    test("should select all stores", () => {
      editor["selectAllStores"]();
      expect(editor.getSelectedStores()).toEqual([
        "store1",
        "store2",
        "store3",
      ]);
    });

    test("should select only writable stores", () => {
      editor["selectWritableStores"]();
      expect(editor.getSelectedStores()).toEqual(["store1", "store2"]);
    });

    test("should clear selection", () => {
      editor["selectAllStores"]();
      expect(editor.getSelectedStores()).toEqual([
        "store1",
        "store2",
        "store3",
      ]);

      editor["clearSelection"]();
      expect(editor.getSelectedStores()).toEqual([]);
    });
  });

  describe("Duplicate Detection", () => {
    beforeEach(async () => {
      editor = new MultiStoreEditor({
        stores: mockStores,
        enableDuplicateDetection: true,
      });
      await editor.init(mockContainer);
    });

    test("should detect no duplicates with no stores selected", () => {
      editor["detectDuplicates"]();
      expect(editor.getDuplicateGroups()).toEqual([]);
    });

    test("should detect duplicates across selected stores", () => {
      // Select stores with duplicate triggers
      editor["handleStoreSelection"]("store1", true);
      editor["handleStoreSelection"]("store3", true);

      editor["detectDuplicates"]();

      const duplicates = editor.getDuplicateGroups();
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].trigger).toBe(";hello");
      expect(duplicates[0].duplicates).toHaveLength(2);
    });

    test("should not detect duplicates with unique triggers", () => {
      editor["handleStoreSelection"]("store1", true);
      editor["handleStoreSelection"]("store2", true);

      editor["detectDuplicates"]();

      const duplicates = editor.getDuplicateGroups();
      expect(duplicates).toHaveLength(0);
    });

    test("should handle duplicate resolution", () => {
      editor["handleStoreSelection"]("store1", true);
      editor["handleStoreSelection"]("store3", true);
      editor["detectDuplicates"]();

      const duplicates = editor.getDuplicateGroups();
      expect(duplicates[0].duplicates[0].conflictResolution).toBe("keep");

      editor["handleDuplicateResolution"]("store1", ";hello", "update");

      const updatedDuplicates = editor.getDuplicateGroups();
      const store1Duplicate = updatedDuplicates[0].duplicates.find(
        (d) => d.storeId === "store1",
      );
      expect(store1Duplicate?.conflictResolution).toBe("update");
    });

    test("should call onDuplicateResolution callback", () => {
      const mockCallback = jest.fn();
      editor = new MultiStoreEditor({
        stores: mockStores,
        onDuplicateResolution: mockCallback,
      });

      editor["handleStoreSelection"]("store1", true);
      editor["handleStoreSelection"]("store3", true);
      editor["detectDuplicates"]();

      editor["handleDuplicateResolution"]("store1", ";hello", "update");

      expect(mockCallback).toHaveBeenCalledWith(editor.getDuplicateGroups());
    });
  });

  describe("Cross-Store Editing", () => {
    beforeEach(async () => {
      const currentSnippet: TextSnippet = {
        id: "current",
        trigger: ";test",
        content: "Test content",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      editor = new MultiStoreEditor({
        stores: mockStores,
        currentSnippet,
        enableCrossStoreEditing: true,
      });
      await editor.init(mockContainer);
    });

    test("should apply snippet to selected stores", () => {
      const mockCallback = jest.fn();
      editor = new MultiStoreEditor({
        stores: mockStores,
        currentSnippet: mockSnippets[0],
        onSnippetUpdate: mockCallback,
      });

      editor["handleStoreSelection"]("store1", true);
      editor["handleStoreSelection"]("store2", true);

      editor["applyToSelectedStores"]();

      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(mockCallback).toHaveBeenCalledWith("store1", mockSnippets[0]);
      expect(mockCallback).toHaveBeenCalledWith("store2", mockSnippets[0]);
    });

    test("should not apply without current snippet", () => {
      const mockUpdateCallback = jest.fn();
      editor = new MultiStoreEditor({
        stores: mockStores,
        onSnippetUpdate: mockUpdateCallback,
      });

      editor["handleStoreSelection"]("store1", true);
      editor["applyToSelectedStores"]();

      // Should not call callback without current snippet
      expect(mockUpdateCallback).not.toHaveBeenCalled();
    });
  });

  describe("Validation", () => {
    beforeEach(async () => {
      editor = new MultiStoreEditor({
        stores: mockStores,
      });
      await editor.init(mockContainer);
    });

    test("should validate with no stores selected", () => {
      const result = editor.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("At least one store must be selected");
    });

    test("should validate with stores selected", () => {
      editor["handleStoreSelection"]("store1", true);

      const result = editor.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("should warn about unresolved duplicates", () => {
      editor["handleStoreSelection"]("store1", true);
      editor["handleStoreSelection"]("store3", true);
      editor["detectDuplicates"]();

      const result = editor.validate();
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "1 duplicate group(s) have unresolved conflicts",
      );
    });
  });

  describe("Action Handling", () => {
    beforeEach(async () => {
      editor = new MultiStoreEditor({
        stores: mockStores,
      });
      await editor.init(mockContainer);
    });

    test("should handle select-all-stores action", () => {
      editor["handleAction"]("select-all-stores", {});
      expect(editor.getSelectedStores()).toEqual([
        "store1",
        "store2",
        "store3",
      ]);
    });

    test("should handle select-writable-only action", () => {
      editor["handleAction"]("select-writable-only", {});
      expect(editor.getSelectedStores()).toEqual(["store1", "store2"]);
    });

    test("should handle clear-selection action", () => {
      editor["selectAllStores"]();
      editor["handleAction"]("clear-selection", {});
      expect(editor.getSelectedStores()).toEqual([]);
    });

    test("should handle scan-duplicates action", () => {
      const detectDuplicatesSpy = jest.spyOn(editor as any, "detectDuplicates");
      editor["handleAction"]("scan-duplicates", {});
      expect(detectDuplicatesSpy).toHaveBeenCalled();
    });

    test("should handle apply-to-selected action", () => {
      const applyToSelectedSpy = jest.spyOn(
        editor as any,
        "applyToSelectedStores",
      );
      editor["handleAction"]("apply-to-selected", {});
      expect(applyToSelectedSpy).toHaveBeenCalled();
    });
  });

  describe("Utility Methods", () => {
    beforeEach(async () => {
      editor = new MultiStoreEditor({
        stores: mockStores,
      });
      await editor.init(mockContainer);
    });

    test("should get content preview", () => {
      const longContent =
        "This is a very long content that should be truncated when displayed as a preview because it exceeds the maximum length limit set for previews";
      const shortContent = "Short content";

      const longPreview = editor["getContentPreview"](longContent);
      const shortPreview = editor["getContentPreview"](shortContent);

      expect(longPreview).toContain("...");
      expect(longPreview.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(shortPreview).toBe(shortContent);
    });

    test("should get content preview with HTML", () => {
      const htmlContent = "<p>This is <strong>HTML</strong> content</p>";
      const preview = editor["getContentPreview"](htmlContent);

      expect(preview).toBe("This is HTML content");
      expect(preview).not.toContain("<");
      expect(preview).not.toContain(">");
    });

    test("should format dates correctly", () => {
      const dateString = "2023-01-01T12:00:00Z";
      const dateObj = new Date(dateString);

      const formattedString = editor["formatDate"](dateString);
      const formattedObj = editor["formatDate"](dateObj);

      expect(formattedString).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(formattedObj).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    test("should handle invalid dates gracefully", () => {
      const invalidDate = "invalid-date";
      const formatted = editor["formatDate"](invalidDate);

      expect(formatted).toBe("Unknown");
    });

    test("should get duplicate count for store", () => {
      editor["handleStoreSelection"]("store1", true);
      editor["handleStoreSelection"]("store3", true);
      editor["detectDuplicates"]();

      const store1Count = editor["getDuplicateCountForStore"]("store1");
      const store2Count = editor["getDuplicateCountForStore"]("store2");
      const store3Count = editor["getDuplicateCountForStore"]("store3");

      expect(store1Count).toBe(1);
      expect(store2Count).toBe(0);
      expect(store3Count).toBe(1);
    });

    test("should group stores by tier", () => {
      const grouped = editor["groupStoresByTier"]();

      expect(grouped).toHaveProperty("personal");
      expect(grouped).toHaveProperty("team");
      expect(grouped).toHaveProperty("org");
      expect(grouped.personal).toHaveLength(1);
      expect(grouped.team).toHaveLength(1);
      expect(grouped.org).toHaveLength(1);
    });
  });

  describe("Enhanced Snippet Support", () => {
    test("should handle EnhancedSnippet with additional fields", async () => {
      const enhancedSnippet: EnhancedSnippet = {
        id: "enhanced1",
        trigger: ";enhanced",
        content: "<p>Enhanced content</p>",
        contentType: "html",
        snipDependencies: ["store1:;hello:snippet1"],
        description: "Enhanced snippet description",
        scope: "personal",
        variables: [{ name: "name", prompt: "Enter name" }],
        images: ["image1.jpg"],
        tags: ["enhanced", "test"],
        createdAt: "2023-01-01T00:00:00Z",
        createdBy: "user1",
        updatedAt: "2023-01-01T00:00:00Z",
        updatedBy: "user1",
      };

      const storeWithEnhanced: StoreSnippetInfo = {
        storeId: "enhanced_store",
        storeName: "enhanced.json",
        displayName: "Enhanced Store",
        tierName: "personal",
        snippetCount: 1,
        isReadOnly: false,
        isDriveFile: true,
        lastModified: "2023-01-01T00:00:00Z",
        snippets: [enhancedSnippet],
      };

      editor = new MultiStoreEditor({
        stores: [storeWithEnhanced],
        currentSnippet: enhancedSnippet,
      });

      await editor.init(mockContainer);

      expect(editor).toBeDefined();
      expect(editor.getSelectedStores()).toEqual([]);
    });
  });

  describe("Cleanup", () => {
    beforeEach(async () => {
      editor = new MultiStoreEditor({
        stores: mockStores,
      });
      await editor.init(mockContainer);
    });

    test("should destroy editor properly", () => {
      editor["selectAllStores"]();
      editor["detectDuplicates"]();

      expect(editor.getSelectedStores()).toHaveLength(3);
      expect(editor.getDuplicateGroups()).toHaveLength(1);

      editor.destroy();

      expect(editor.getSelectedStores()).toHaveLength(0);
      expect(editor.getDuplicateGroups()).toHaveLength(0);
      expect(mockContainer.innerHTML).toBe("");
    });
  });
});

describe("Multi-Store Editor Integration", () => {
  test("should handle complex multi-store scenario", async () => {
    const complexStores: StoreSnippetInfo[] = [
      {
        storeId: "personal",
        storeName: "personal.json",
        displayName: "Personal",
        tierName: "personal",
        snippetCount: 3,
        isReadOnly: false,
        isDriveFile: true,
        lastModified: "2023-01-01T00:00:00Z",
        snippets: [
          {
            id: "1",
            trigger: ";hello",
            content: "Hello Personal",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "2",
            trigger: ";bye",
            content: "Bye Personal",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "3",
            trigger: ";test",
            content: "Test Personal",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
      {
        storeId: "team",
        storeName: "team.json",
        displayName: "Team",
        tierName: "team",
        snippetCount: 2,
        isReadOnly: false,
        isDriveFile: true,
        lastModified: "2023-01-02T00:00:00Z",
        snippets: [
          {
            id: "4",
            trigger: ";hello",
            content: "Hello Team",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "5",
            trigger: ";test",
            content: "Test Team",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
      {
        storeId: "org",
        storeName: "org.json",
        displayName: "Organization",
        tierName: "org",
        snippetCount: 1,
        isReadOnly: true,
        isDriveFile: false,
        lastModified: "2023-01-03T00:00:00Z",
        snippets: [
          {
            id: "6",
            trigger: ";hello",
            content: "Hello Organization",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ];

    const callbacks = {
      onStoreSelectionChange: jest.fn(),
      onDuplicateResolution: jest.fn(),
      onSnippetUpdate: jest.fn(),
    };

    const editor = new MultiStoreEditor({
      stores: complexStores,
      ...callbacks,
    });

    const mockContainer = {
      innerHTML: "",
      querySelector: jest.fn().mockReturnValue(null),
      addEventListener: jest.fn(),
    } as any;
    await editor.init(mockContainer);

    // Select all stores
    editor["selectAllStores"]();
    expect(editor.getSelectedStores()).toHaveLength(3);
    expect(callbacks.onStoreSelectionChange).toHaveBeenCalledWith([
      "personal",
      "team",
      "org",
    ]);

    // Detect duplicates
    editor["detectDuplicates"]();
    const duplicates = editor.getDuplicateGroups();
    expect(duplicates).toHaveLength(2); // ;hello and ;test appear in multiple stores

    // Resolve duplicates
    editor["handleDuplicateResolution"]("personal", ";hello", "update");
    expect(callbacks.onDuplicateResolution).toHaveBeenCalled();

    // Validate
    const validation = editor.validate();
    expect(validation.isValid).toBe(true);
    expect(validation.warnings).toHaveLength(1); // Unresolved duplicates warning

    // Apply to selected stores
    const testSnippet: TextSnippet = {
      id: "new",
      trigger: ";new",
      content: "New content",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Recreate editor with current snippet
    await editor.destroy();
    const editorWithSnippet = new MultiStoreEditor({
      stores: complexStores,
      currentSnippet: testSnippet,
      ...callbacks,
    });
    await editorWithSnippet.init(mockContainer);
    
    // Select stores and apply
    editorWithSnippet["handleStoreSelection"]("personal", true);
    editorWithSnippet["handleStoreSelection"]("team", true);
    editorWithSnippet["handleStoreSelection"]("org", true);
    editorWithSnippet["applyToSelectedStores"]();

    expect(callbacks.onSnippetUpdate).toHaveBeenCalledTimes(3);
    expect(callbacks.onSnippetUpdate).toHaveBeenCalledWith(
      "personal",
      testSnippet,
    );
    expect(callbacks.onSnippetUpdate).toHaveBeenCalledWith("team", testSnippet);
    expect(callbacks.onSnippetUpdate).toHaveBeenCalledWith("org", testSnippet);
  });
});
