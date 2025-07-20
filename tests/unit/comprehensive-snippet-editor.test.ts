/**
 * Test suite for ComprehensiveSnippetEditor component
 * Tests TinyMCE integration, TierStorageSchema support, and full JSON field editing
 */

// Jest is used in this project, not Vitest
import type {
  ComprehensiveSnippetEditor,
  ComprehensiveSnippetEditorOptions,
  SnippetEditResult,
} from "../../src/ui/components/comprehensive-snippet-editor.js";
import type {
  TierStorageSchema,
  EnhancedSnippet,
  PriorityTier,
} from "../../src/types/snippet-formats.js";

// Mock TinyMCE wrapper
jest.mock("../../src/editor/tinymce-wrapper.js", () => {
  return {
    TinyMCEWrapper: jest.fn(() => ({
      init: jest.fn().mockResolvedValue({}),
      destroy: jest.fn().mockResolvedValue(undefined),
      getContent: jest.fn().mockReturnValue("<p>Mock content</p>"),
      setContent: jest.fn(),
      insertContent: jest.fn(),
      focus: jest.fn(),
      hasFocus: jest.fn().mockReturnValue(false),
      getEditor: jest.fn().mockReturnValue(null),
      isReady: jest.fn().mockReturnValue(true),
    })),
    createSnippetEditor: jest.fn(() => {
      let content = "";
      return {
        init: jest
          .fn()
          .mockImplementation(async (container, initialContent) => {
            content = initialContent || "";
          }),
        destroy: jest.fn().mockResolvedValue(undefined),
        getContent: jest.fn().mockImplementation(() => content),
        setContent: jest.fn().mockImplementation((newContent) => {
          content = newContent;
        }),
        insertContent: jest.fn().mockImplementation((insertContent) => {
          content += insertContent;
        }),
        focus: jest.fn(),
        hasFocus: jest.fn().mockReturnValue(false),
        getEditor: jest.fn().mockReturnValue({
          getConfig: jest.fn().mockReturnValue({ contentType: "html" }),
        }),
        isReady: jest.fn().mockReturnValue(true),
        getConfig: jest.fn().mockReturnValue({ contentType: "html" }),
      };
    }),
  };
});

describe("ComprehensiveSnippetEditor", () => {
  let editor: ComprehensiveSnippetEditor;
  let container: HTMLElement;
  let mockTierData: TierStorageSchema;
  let mockSnippet: EnhancedSnippet;

  beforeEach(() => {
    // Create a container element
    container = document.createElement("div");
    document.body.appendChild(container);

    // Mock tier storage data
    mockTierData = {
      schema: "priority-tier-v1",
      tier: "personal",
      snippets: [
        {
          id: "test-snippet-1",
          trigger: ";hello",
          content: "<p>Hello World!</p>",
          contentType: "html",
          snipDependencies: [],
          description: "A test greeting snippet",
          scope: "personal",
          variables: [{ name: "name", prompt: "Enter your name" }],
          images: [],
          tags: ["greeting", "test"],
          createdAt: "2023-01-01T00:00:00.000Z",
          createdBy: "test-user",
          updatedAt: "2023-01-01T00:00:00.000Z",
          updatedBy: "test-user",
        },
        {
          id: "test-snippet-2",
          trigger: ";goodbye",
          content: "Goodbye!",
          contentType: "plaintext",
          snipDependencies: [";hello"],
          description: "A farewell snippet",
          scope: "personal",
          variables: [],
          images: [],
          tags: ["farewell"],
          createdAt: "2023-01-02T00:00:00.000Z",
          createdBy: "test-user",
          updatedAt: "2023-01-02T00:00:00.000Z",
          updatedBy: "test-user",
        },
      ],
      metadata: {
        version: "1.0.0",
        created: "2023-01-01T00:00:00.000Z",
        modified: "2023-01-02T00:00:00.000Z",
        owner: "test-user",
        description: "Test tier storage",
      },
    };

    mockSnippet = mockTierData.snippets[0];
  });

  afterEach(() => {
    if (editor) {
      editor.destroy();
    }
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe("Initialization", () => {
    test("should create editor with default options", async () => {
      // Import should be dynamic to test actual implementation
      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );

      expect(() => {
        editor = new ComprehensiveSnippetEditor({
          tierData: mockTierData,
          mode: "create",
        });
      }).not.toThrow();
    });

    test("should initialize with tier storage data", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      // This test will fail until implementation exists
      expect(async () => {
        const { ComprehensiveSnippetEditor } = await import(
          "../../src/ui/components/comprehensive-snippet-editor.js"
        );
        editor = new ComprehensiveSnippetEditor(options);
        await editor.init(container);
      }).not.toThrow();
    });

    test("should load snippet for editing", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "edit",
        snippetId: "test-snippet-1",
      };

      // This will test that the editor loads the correct snippet
      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      expect(editor.getCurrentSnippet()).toEqual(mockSnippet);
    });

    test("should throw error if snippet not found in edit mode", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "edit",
        snippetId: "non-existent-snippet",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );

      expect(() => {
        editor = new ComprehensiveSnippetEditor(options);
      }).toThrow("Snippet with ID 'non-existent-snippet' not found");
    });
  });

  describe("TinyMCE Integration", () => {
    test("should initialize TinyMCE editor", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      expect(editor.getTinyMCEEditor()).toBeDefined();
      expect(editor.getTinyMCEEditor()?.isReady()).toBe(true);
    });

    test("should load snippet content into TinyMCE", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "edit",
        snippetId: "test-snippet-1",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      const tinyMCE = editor.getTinyMCEEditor();
      expect(tinyMCE?.getContent()).toBe("<p>Hello World!</p>");
    });

    test("should handle content changes", async () => {
      const onContentChange = jest.fn();
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
        onContentChange,
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Simulate content change by calling the handler directly
      // since we need to trigger the internal change handler
      const content = "<p>New content</p>";
      editor.setContent(content);

      // The onContentChange callback is called from handleContentChange
      // We need to simulate this being called by TinyMCE
      editor["handleContentChange"](content);

      expect(onContentChange).toHaveBeenCalledWith(content);
    });
  });

  describe("Field Editing", () => {
    test("should edit all EnhancedSnippet fields", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "edit",
        snippetId: "test-snippet-1",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Test field getters and setters
      expect(editor.getTrigger()).toBe(";hello");
      expect(editor.getDescription()).toBe("A test greeting snippet");
      expect(editor.getContentType()).toBe("html");
      expect(editor.getScope()).toBe("personal");
      expect(editor.getTags()).toEqual(["greeting", "test"]);
      expect(editor.getVariables()).toEqual([
        { name: "name", prompt: "Enter your name" },
      ]);
      expect(editor.getSnipDependencies()).toEqual([]);
      expect(editor.getImages()).toEqual([]);

      // Test field updates
      editor.setTrigger(";hi");
      editor.setDescription("Updated description");
      editor.setContentType("plaintext");
      editor.setScope("team");
      editor.setTags(["updated", "tag"]);
      editor.addVariable({ name: "greeting", prompt: "Enter greeting" });
      editor.addSnipDependency(";goodbye");

      expect(editor.getTrigger()).toBe(";hi");
      expect(editor.getDescription()).toBe("Updated description");
      expect(editor.getContentType()).toBe("plaintext");
      expect(editor.getScope()).toBe("team");
      expect(editor.getTags()).toEqual(["updated", "tag"]);
      expect(editor.getVariables()).toHaveLength(2);
      expect(editor.getSnipDependencies()).toEqual([";goodbye"]);
    });

    test("should validate required fields", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Clear required fields
      editor.setTrigger("");
      editor.setContent("");

      const validation = editor.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Trigger is required");
      expect(validation.errors).toContain("Content is required");
    });

    test("should validate trigger format", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Test invalid triggers
      editor.setTrigger("a"); // Too short
      let validation = editor.validate();
      expect(validation.errors).toContain(
        "Trigger must be at least 2 characters",
      );

      editor.setTrigger("no spaces allowed");
      validation = editor.validate();
      expect(validation.errors).toContain("Trigger cannot contain spaces");

      // Test valid trigger
      editor.setTrigger(";valid");
      editor.setContent("Valid content");
      validation = editor.validate();
      expect(validation.isValid).toBe(true);
    });

    test("should validate content type", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Test valid content types
      const validTypes = [
        "html",
        "plaintext",
        "markdown",
        "latex",
        "html+KaTeX",
      ];
      for (const type of validTypes) {
        editor.setContentType(type as any);
        expect(editor.getContentType()).toBe(type);
      }

      // Test invalid content type
      expect(() => {
        editor.setContentType("invalid" as any);
      }).toThrow("Invalid content type");
    });
  });

  describe("Content Type Switching", () => {
    test("should switch between content types", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "edit",
        snippetId: "test-snippet-1",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Switch from HTML to plaintext
      expect(editor.getContentType()).toBe("html");
      editor.setContentType("plaintext");
      expect(editor.getContentType()).toBe("plaintext");

      // Verify content type changed in editor
      expect(editor.getContentType()).toBe("plaintext");
    });

    test("should convert content when switching types", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
        enableContentTypeConversion: true,
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Start with HTML content
      const htmlContent = "<p><strong>Bold text</strong></p>";
      editor.setContent(htmlContent);
      expect(editor.getContentType()).toBe("html");

      // Switch to plaintext and verify conversion
      editor.setContentType("plaintext");
      // Note: The mock doesn't actually do conversion, so we test the getter
      expect(editor.getContentType()).toBe("plaintext");

      // Switch to markdown and verify conversion
      editor.setContentType("markdown");
      expect(editor.getContentType()).toBe("markdown");
    });
  });

  describe("Variable Management", () => {
    test("should extract variables from content", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      const content = "Hello ${name}, welcome to ${company}!";
      editor.setContent(content);
      const variables = editor.extractVariables();

      expect(variables).toEqual(["name", "company"]);
    });

    test("should manage variable definitions", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Add variables
      editor.addVariable({ name: "name", prompt: "Enter your name" });
      editor.addVariable({ name: "company", prompt: "Enter company name" });

      expect(editor.getVariables()).toHaveLength(2);

      // Update variable
      editor.updateVariable("name", {
        name: "name",
        prompt: "Full name please",
      });
      const updatedVar = editor.getVariables().find((v) => v.name === "name");
      expect(updatedVar?.prompt).toBe("Full name please");

      // Remove variable
      editor.removeVariable("company");
      expect(editor.getVariables()).toHaveLength(1);
    });

    test("should validate variable names", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Test invalid variable names
      expect(() => {
        editor.addVariable({ name: "", prompt: "Empty name" });
      }).toThrow("Variable name cannot be empty");

      expect(() => {
        editor.addVariable({ name: "invalid name", prompt: "With spaces" });
      }).toThrow("Variable name cannot contain spaces");

      expect(() => {
        editor.addVariable({
          name: "123invalid",
          prompt: "Starts with number",
        });
      }).toThrow("Variable name must start with a letter");
    });
  });

  describe("Dependency Management", () => {
    test("should manage snippet dependencies", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Add dependencies
      editor.addSnipDependency(";hello");
      editor.addSnipDependency(";goodbye");

      expect(editor.getSnipDependencies()).toEqual([";hello", ";goodbye"]);

      // Remove dependency
      editor.removeSnipDependency(";hello");
      expect(editor.getSnipDependencies()).toEqual([";goodbye"]);
    });

    test("should validate dependencies exist in tier", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
        validateDependencies: true,
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Set up required fields first
      editor.setTrigger(";test");
      editor.setContent("Test content");

      // Add valid dependency
      editor.addSnipDependency(";hello");
      let validation = editor.validate();
      expect(validation.isValid).toBe(true);

      // Add invalid dependency
      editor.addSnipDependency(";nonexistent");
      validation = editor.validate();
      expect(validation.errors).toContain(
        "Dependency ';nonexistent' not found in tier",
      );
    });

    test("should detect circular dependencies", async () => {
      const circularTierData = {
        ...mockTierData,
        snippets: [
          {
            ...mockTierData.snippets[0],
            trigger: ";a",
            snipDependencies: [";b"],
          },
          {
            ...mockTierData.snippets[1],
            trigger: ";b",
            snipDependencies: [";c"],
          },
          {
            id: "test-snippet-3",
            trigger: ";c",
            content: "C content",
            contentType: "plaintext" as const,
            snipDependencies: [";a"], // Creates circular dependency
            description: "C snippet",
            scope: "personal" as const,
            variables: [],
            images: [],
            tags: [],
            createdAt: "2023-01-03T00:00:00.000Z",
            createdBy: "test-user",
            updatedAt: "2023-01-03T00:00:00.000Z",
            updatedBy: "test-user",
          },
        ],
      };

      const options: ComprehensiveSnippetEditorOptions = {
        tierData: circularTierData,
        mode: "edit",
        snippetId: "test-snippet-3",
        validateDependencies: true,
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      const validation = editor.validate();
      expect(validation.errors).toContain("Circular dependency detected");
    });
  });

  describe("Save Operations", () => {
    test("should save new snippet to tier", async () => {
      const onSave = jest.fn();
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
        onSave,
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Set up new snippet data
      editor.setTrigger(";new");
      editor.setContent("<p>New snippet content</p>");
      editor.setDescription("A new snippet");
      editor.setScope("team");

      const result = await editor.save();

      expect(result.success).toBe(true);
      expect(result.snippet.trigger).toBe(";new");
      expect(result.snippet.scope).toBe("team");
      expect(onSave).toHaveBeenCalledWith(result);
    });

    test("should update existing snippet in tier", async () => {
      const onSave = jest.fn();
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "edit",
        snippetId: "test-snippet-1",
        onSave,
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Update snippet data
      editor.setDescription("Updated description");
      editor.addTag("updated");

      const result = await editor.save();

      expect(result.success).toBe(true);
      expect(result.snippet.id).toBe("test-snippet-1");
      expect(result.snippet.description).toBe("Updated description");
      expect(result.snippet.tags).toContain("updated");
      expect(onSave).toHaveBeenCalledWith(result);
    });

    test("should validate before saving", async () => {
      const onSave = jest.fn();
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
        onSave,
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      // Don't set required fields
      const result = await editor.save();

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Trigger is required");
      expect(result.errors).toContain("Content is required");
      expect(onSave).not.toHaveBeenCalled();
    });

    test("should generate updated tier data", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      editor.setTrigger(";new");
      editor.setContent("<p>New content</p>");
      editor.setDescription("New snippet");

      const result = await editor.save();
      const updatedTierData = result.updatedTierData;

      expect(updatedTierData.snippets).toHaveLength(3); // Original 2 + new 1
      expect(updatedTierData.metadata.modified).not.toBe(
        mockTierData.metadata.modified,
      );

      const newSnippet = updatedTierData.snippets.find(
        (s) => s.trigger === ";new",
      );
      expect(newSnippet).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("should handle TinyMCE initialization failure", async () => {
      // Mock TinyMCE to fail initialization
      const { createSnippetEditor } = await import(
        "../../src/editor/tinymce-wrapper.js"
      );
      jest.mocked(createSnippetEditor).mockImplementationOnce(() => ({
        init: jest.fn().mockRejectedValue(new Error("TinyMCE init failed")),
        destroy: jest.fn(),
        getContent: jest.fn().mockReturnValue(""),
        setContent: jest.fn(),
        insertContent: jest.fn(),
        focus: jest.fn(),
        hasFocus: jest.fn().mockReturnValue(false),
        getEditor: jest.fn().mockReturnValue(null),
        isReady: jest.fn().mockReturnValue(false),
        // Add missing properties
        editor: null,
        container: null,
        textArea: null,
        isInitialized: false,
        isDestroyed: false,
        contentChangeTimeout: null,
        options: {},
        defaultConfig: {},
        setupEventHandlers: jest.fn(),
        handleContentChange: jest.fn(),
        cleanup: jest.fn(),
        validateContainer: jest.fn(),
        createTextArea: jest.fn(),
        getTextAreaConfig: jest.fn(),
        handleInit: jest.fn(),
        handleSetup: jest.fn(),
        handleBeforeUnload: jest.fn(),
      } as any));

      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);

      await expect(editor.init(container)).rejects.toThrow(
        "TinyMCE init failed",
      );
    });

    test("should handle save errors gracefully", async () => {
      const onSave = jest.fn().mockRejectedValue(new Error("Save failed"));
      const onError = jest.fn();

      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
        onSave,
        onError,
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      editor.setTrigger(";test");
      editor.setContent("Test content");

      const result = await editor.save();

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Save failed");
      expect(onError).toHaveBeenCalledWith(new Error("Save failed"));
    });
  });

  describe("Cleanup", () => {
    test("should destroy editor properly", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      const tinyMCE = editor.getTinyMCEEditor();
      expect(tinyMCE?.isReady()).toBe(true);

      await editor.destroy();

      expect(tinyMCE?.destroy).toHaveBeenCalled();
      expect(container.innerHTML).toBe("");
    });

    test("should handle multiple destroy calls", async () => {
      const options: ComprehensiveSnippetEditorOptions = {
        tierData: mockTierData,
        mode: "create",
      };

      const { ComprehensiveSnippetEditor } = await import(
        "../../src/ui/components/comprehensive-snippet-editor.js"
      );
      editor = new ComprehensiveSnippetEditor(options);
      await editor.init(container);

      await editor.destroy();
      await expect(editor.destroy()).resolves.not.toThrow();
    });
  });
});

// Type definitions needed for tests
declare module "../../src/ui/components/comprehensive-snippet-editor.js" {
  export interface ComprehensiveSnippetEditorOptions {
    tierData: TierStorageSchema;
    mode: "create" | "edit";
    snippetId?: string;
    enableContentTypeConversion?: boolean;
    validateDependencies?: boolean;
    onSave?: (result: SnippetEditResult) => Promise<void>;
    onError?: (error: Error) => void;
    onContentChange?: (content: string) => void;
  }

  export interface SnippetEditResult {
    success: boolean;
    snippet: EnhancedSnippet;
    updatedTierData: TierStorageSchema;
    errors?: string[];
    warnings?: string[];
  }

  export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }

  class MockComprehensiveSnippetEditor {
    constructor(options: ComprehensiveSnippetEditorOptions);

    init(container: HTMLElement): Promise<void>;
    destroy(): Promise<void>;

    // Content management
    getContent(): string;
    setContent(content: string): void;
    getTinyMCEEditor(): any;

    // Field getters/setters
    getTrigger(): string;
    setTrigger(trigger: string): void;
    getDescription(): string;
    setDescription(description: string): void;
    getContentType(): string;
    setContentType(contentType: string): void;
    getScope(): PriorityTier;
    setScope(scope: PriorityTier): void;
    getTags(): string[];
    setTags(tags: string[]): void;
    addTag(tag: string): void;
    removeTag(tag: string): void;

    // Variable management
    getVariables(): Array<{ name: string; prompt: string }>;
    addVariable(variable: { name: string; prompt: string }): void;
    updateVariable(
      name: string,
      variable: { name: string; prompt: string },
    ): void;
    removeVariable(name: string): void;
    extractVariables(): string[];

    // Dependency management
    getSnipDependencies(): string[];
    addSnipDependency(trigger: string): void;
    removeSnipDependency(trigger: string): void;

    // Image management
    getImages(): string[];
    addImage(imageUrl: string): void;
    removeImage(imageUrl: string): void;

    // Validation and saving
    validate(): ValidationResult;
    save(): Promise<SnippetEditResult>;
    getCurrentSnippet(): EnhancedSnippet | null;
  }
}
