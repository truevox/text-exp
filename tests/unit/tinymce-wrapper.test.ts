/**
 * Tests for TinyMCE Wrapper Component
 */

import {
  TinyMCEWrapper,
  createSnippetEditor,
} from "../../src/editor/tinymce-wrapper";
import type {
  TinyMCEWrapperOptions,
  TinyMCEConfig,
} from "../../src/editor/tinymce-wrapper";

// Mock TinyMCE
const mockEditor = {
  init: jest.fn(),
  destroy: jest.fn(),
  getContent: jest.fn(),
  setContent: jest.fn(),
  insertContent: jest.fn(),
  focus: jest.fn(),
  hasFocus: jest.fn(),
  on: jest.fn(),
  addShortcut: jest.fn(),
  ui: {
    registry: {
      addMenuItem: jest.fn(),
    },
  },
};

const mockTinyMCE = {
  init: jest.fn().mockImplementation(async (config: any) => {
    // Simulate TinyMCE initialization by calling the callbacks
    if (config.setup) {
      config.setup(mockEditor);
    }
    if (config.init_instance_callback) {
      config.init_instance_callback(mockEditor);
    }
    return [mockEditor];
  }),
  default: {
    init: jest.fn().mockImplementation(async (config: any) => {
      // Simulate TinyMCE initialization by calling the callbacks
      if (config.setup) {
        config.setup(mockEditor);
      }
      if (config.init_instance_callback) {
        config.init_instance_callback(mockEditor);
      }
      return [mockEditor];
    }),
  },
};

// Mock dynamic imports
jest.mock("tinymce/tinymce", () => mockTinyMCE, { virtual: true });
jest.mock("tinymce/themes/silver", () => ({}), { virtual: true });
jest.mock("tinymce/models/dom", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/lists", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/link", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/image", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/charmap", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/preview", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/searchreplace", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/visualblocks", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/code", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/fullscreen", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/insertdatetime", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/media", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/table", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/help", () => ({}), { virtual: true });
jest.mock("tinymce/plugins/wordcount", () => ({}), { virtual: true });

describe("TinyMCEWrapper", () => {
  let container: HTMLElement;
  let wrapper: TinyMCEWrapper;

  beforeEach(() => {
    // Create container
    container = document.createElement("div");
    document.body.appendChild(container);

    // Reset mocks
    jest.clearAllMocks();
    mockEditor.getContent.mockReturnValue("<p>Test content</p>");
    mockEditor.hasFocus.mockReturnValue(false);
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.destroy();
    }
    document.body.removeChild(container);
  });

  describe("Constructor and Configuration", () => {
    it("should create wrapper with default options", () => {
      wrapper = new TinyMCEWrapper();
      expect(wrapper).toBeInstanceOf(TinyMCEWrapper);
      expect(wrapper.isReady()).toBe(false);
    });

    it("should create wrapper with custom options", () => {
      const options: TinyMCEWrapperOptions = {
        autoFocus: true,
        debounceDelay: 500,
        config: {
          height: 400,
          menubar: true,
        },
      };

      wrapper = new TinyMCEWrapper(options);
      expect(wrapper).toBeInstanceOf(TinyMCEWrapper);
    });

    it("should merge custom config with defaults", () => {
      const customConfig: Partial<TinyMCEConfig> = {
        height: 500,
        plugins: ["custom-plugin"],
      };

      wrapper = new TinyMCEWrapper({ config: customConfig });
      const config = wrapper.getConfig();

      expect(config?.height).toBe(500);
      expect(config?.plugins).toEqual(["custom-plugin"]);
    });
  });

  describe("Initialization", () => {
    it("should initialize TinyMCE editor successfully", async () => {
      wrapper = new TinyMCEWrapper();

      const editor = await wrapper.init(container, "Initial content");

      expect(mockTinyMCE.init).toHaveBeenCalled();
      expect(editor).toBe(mockEditor);
      expect(wrapper.isReady()).toBe(true);
    });

    it("should create textarea element in container", async () => {
      wrapper = new TinyMCEWrapper();

      await wrapper.init(container, "Test content");

      const textarea = container.querySelector("textarea");
      expect(textarea).toBeTruthy();
      expect(textarea?.value).toBe("Test content");
    });

    it("should allow re-initialization by destroying first", async () => {
      wrapper = new TinyMCEWrapper();
      await wrapper.init(container);

      // Should not throw - it destroys and re-initializes
      await expect(wrapper.init(container)).resolves.toBeDefined();
      expect(wrapper.isReady()).toBe(true);
    });

    it("should throw error if destroyed", async () => {
      wrapper = new TinyMCEWrapper();
      await wrapper.destroy();

      await expect(wrapper.init(container)).rejects.toThrow(
        "TinyMCE wrapper has been destroyed",
      );
    });

    it("should handle initialization failure", async () => {
      mockTinyMCE.init.mockResolvedValueOnce([]);
      wrapper = new TinyMCEWrapper();

      await expect(wrapper.init(container)).rejects.toThrow(
        "Failed to initialize TinyMCE editor",
      );
    });
  });

  describe("Event Handling", () => {
    beforeEach(async () => {
      wrapper = new TinyMCEWrapper({
        events: {
          onContentChange: jest.fn(),
          onFocus: jest.fn(),
          onBlur: jest.fn(),
          onInit: jest.fn(),
          onDestroy: jest.fn(),
        },
      });
      await wrapper.init(container);
    });

    it("should register event handlers during setup", () => {
      expect(mockEditor.on).toHaveBeenCalledWith(
        "input change keyup",
        expect.any(Function),
      );
      expect(mockEditor.on).toHaveBeenCalledWith("focus", expect.any(Function));
      expect(mockEditor.on).toHaveBeenCalledWith("blur", expect.any(Function));
    });

    it("should call onInit event after initialization", () => {
      const options = wrapper["options"] as any;
      expect(options.events?.onInit).toHaveBeenCalledWith(mockEditor);
    });

    it("should debounce content change events", (done) => {
      const options = wrapper["options"] as any;
      const onContentChange = options.events?.onContentChange;

      // Get the registered event handler
      const calls = mockEditor.on.mock.calls;
      const contentChangeCall = calls.find(
        (call) => call[0] === "input change keyup",
      );
      const contentChangeHandler = contentChangeCall?.[1];

      // Trigger multiple rapid changes
      contentChangeHandler?.();
      contentChangeHandler?.();
      contentChangeHandler?.();

      // Should only call once after debounce delay
      setTimeout(() => {
        expect(onContentChange).toHaveBeenCalledTimes(1);
        done();
      }, 350); // Default debounce is 300ms
    });

    it("should handle focus and blur events", () => {
      const options = wrapper["options"] as any;

      // Get the registered event handlers
      const calls = mockEditor.on.mock.calls;
      const focusCall = calls.find((call) => call[0] === "focus");
      const blurCall = calls.find((call) => call[0] === "blur");

      const focusHandler = focusCall?.[1];
      const blurHandler = blurCall?.[1];

      // Trigger focus
      focusHandler?.(mockEditor);
      expect(options.events?.onFocus).toHaveBeenCalledWith(mockEditor);

      // Trigger blur
      blurHandler?.(mockEditor);
      expect(options.events?.onBlur).toHaveBeenCalledWith(mockEditor);
    });
  });

  describe("Content Management", () => {
    beforeEach(async () => {
      wrapper = new TinyMCEWrapper();
      await wrapper.init(container);
    });

    it("should get content from editor", () => {
      mockEditor.getContent.mockReturnValue("<p>Current content</p>");

      const content = wrapper.getContent();

      expect(mockEditor.getContent).toHaveBeenCalled();
      expect(content).toBe("<p>Current content</p>");
    });

    it("should return empty string if no editor", () => {
      wrapper["editor"] = null;

      const content = wrapper.getContent();

      expect(content).toBe("");
    });

    it("should set content in editor", () => {
      const newContent = "<p>New content</p>";

      wrapper.setContent(newContent);

      expect(mockEditor.setContent).toHaveBeenCalledWith(newContent);
    });

    it("should throw error when setting content without editor", () => {
      wrapper["editor"] = null;

      expect(() => wrapper.setContent("content")).toThrow(
        "Editor not initialized",
      );
    });

    it("should insert content at cursor position", () => {
      const insertContent = "<strong>Bold text</strong>";

      wrapper.insertContent(insertContent);

      expect(mockEditor.insertContent).toHaveBeenCalledWith(insertContent);
    });

    it("should throw error when inserting content without editor", () => {
      wrapper["editor"] = null;

      expect(() => wrapper.insertContent("content")).toThrow(
        "Editor not initialized",
      );
    });
  });

  describe("Focus Management", () => {
    beforeEach(async () => {
      wrapper = new TinyMCEWrapper();
      await wrapper.init(container);
    });

    it("should focus the editor", () => {
      wrapper.focus();
      expect(mockEditor.focus).toHaveBeenCalled();
    });

    it("should check if editor has focus", () => {
      mockEditor.hasFocus.mockReturnValue(true);

      const hasFocus = wrapper.hasFocus();

      expect(mockEditor.hasFocus).toHaveBeenCalled();
      expect(hasFocus).toBe(true);
    });

    it("should return false when no editor", () => {
      wrapper["editor"] = null;

      const hasFocus = wrapper.hasFocus();

      expect(hasFocus).toBe(false);
    });
  });

  describe("Extension Customizations", () => {
    beforeEach(async () => {
      wrapper = new TinyMCEWrapper();
      await wrapper.init(container);
    });

    it("should add custom keyboard shortcuts", () => {
      expect(mockEditor.addShortcut).toHaveBeenCalledWith(
        "ctrl+shift+v",
        "Paste as plain text",
        expect.any(Function),
      );
      expect(mockEditor.addShortcut).toHaveBeenCalledWith(
        "ctrl+shift+dollar",
        "Insert variable placeholder",
        expect.any(Function),
      );
    });

    it("should add custom menu items", () => {
      expect(mockEditor.ui.registry.addMenuItem).toHaveBeenCalledWith(
        "insertVariable",
        expect.objectContaining({
          text: "Insert Variable",
          icon: "code-sample",
          onAction: expect.any(Function),
        }),
      );
    });

    it("should execute variable insertion shortcut", () => {
      // Mock prompt to return a variable name
      const originalPrompt = global.prompt;
      global.prompt = jest.fn().mockReturnValue("test_variable");

      // Mock getContent to return empty content (no existing variables)
      mockEditor.getContent.mockReturnValue("");

      // Get the registered shortcut handler
      const shortcutCalls = mockEditor.addShortcut.mock.calls;
      const variableShortcut = shortcutCalls.find(
        (call) => call[0] === "ctrl+shift+dollar",
      );
      const handler = variableShortcut?.[2];

      handler?.();

      expect(mockEditor.insertContent).toHaveBeenCalledWith("${test_variable}");

      // Restore original prompt
      global.prompt = originalPrompt;
    });
  });

  describe("Lifecycle Management", () => {
    it("should destroy editor and clean up resources", async () => {
      wrapper = new TinyMCEWrapper({
        events: {
          onDestroy: jest.fn(),
        },
      });

      await wrapper.init(container);

      await wrapper.destroy();

      expect(mockEditor.destroy).toHaveBeenCalled();
      expect(wrapper.getEditor()).toBeNull();
      expect(wrapper.isReady()).toBe(false);
    });

    it("should call onDestroy event when destroying", async () => {
      const onDestroy = jest.fn();
      wrapper = new TinyMCEWrapper({
        events: { onDestroy },
      });

      await wrapper.init(container);
      await wrapper.destroy();

      expect(onDestroy).toHaveBeenCalled();
    });

    it("should clean up DOM elements", async () => {
      wrapper = new TinyMCEWrapper();
      await wrapper.init(container);

      const textarea = container.querySelector("textarea");
      expect(textarea).toBeTruthy();

      await wrapper.destroy();

      const textareaAfter = container.querySelector("textarea");
      expect(textareaAfter).toBeNull();
    });

    it("should handle multiple destroy calls gracefully", async () => {
      wrapper = new TinyMCEWrapper();
      await wrapper.init(container);

      await wrapper.destroy();
      await wrapper.destroy(); // Should not throw

      expect(mockEditor.destroy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Configuration Updates", () => {
    beforeEach(() => {
      wrapper = new TinyMCEWrapper();
    });

    it("should update configuration before initialization", () => {
      const newConfig: Partial<TinyMCEConfig> = {
        height: 600,
        readonly: true,
      };

      wrapper.updateConfig(newConfig);

      const config = wrapper.getConfig();
      expect(config?.height).toBe(600);
      expect(config?.readonly).toBe(true);
    });

    it("should warn when updating config after initialization", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      await wrapper.init(container);
      wrapper.updateConfig({ height: 400 });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot update config after initialization"),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    it("should handle TinyMCE initialization failure", async () => {
      // Make the mock TinyMCE init function reject
      mockTinyMCE.init.mockRejectedValueOnce(new Error("TinyMCE init failed"));

      wrapper = new TinyMCEWrapper();

      await expect(wrapper.init(container)).rejects.toThrow(
        "TinyMCE init failed",
      );
    });

    it("should handle editor operations when editor is null", () => {
      wrapper = new TinyMCEWrapper();
      wrapper["editor"] = null;

      expect(wrapper.getContent()).toBe("");
      expect(wrapper.hasFocus()).toBe(false);
      expect(() => wrapper.focus()).not.toThrow();
    });
  });

  describe("Auto Focus", () => {
    it("should auto-focus when enabled", async () => {
      wrapper = new TinyMCEWrapper({ autoFocus: true });

      await wrapper.init(container);

      expect(mockEditor.focus).toHaveBeenCalled();
    });

    it("should not auto-focus when disabled", async () => {
      wrapper = new TinyMCEWrapper({ autoFocus: false });

      await wrapper.init(container);

      expect(mockEditor.focus).not.toHaveBeenCalled();
    });
  });
});

describe("createSnippetEditor", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should create snippet editor with default configuration", () => {
    const editor = createSnippetEditor(container);

    expect(editor).toBeInstanceOf(TinyMCEWrapper);

    const config = editor.getConfig();
    expect(config?.height).toBe(250);
    expect(config?.plugins).toEqual(["lists", "link", "code", "help"]);
  });

  it("should merge custom options with snippet defaults", () => {
    const editor = createSnippetEditor(container, {
      config: {
        height: 300,
        plugins: ["custom"],
      },
    });

    const config = editor.getConfig();
    expect(config?.height).toBe(300);
    expect(config?.plugins).toEqual(["custom"]);
  });

  it("should include variable placeholder styling", () => {
    const editor = createSnippetEditor(container);

    const config = editor.getConfig();
    expect(config?.content_style).toContain("variable-placeholder");
    expect(config?.content_style).toContain("background-color: #f0f0f0");
  });
});
