/**
 * TinyMCE wrapper for PuffPuffPaste extension
 * Provides extension-specific integration with TinyMCE editor
 */

import type { Editor as TinyMCEEditor } from "tinymce";

export interface TinyMCEConfig {
  selector?: string;
  target?: HTMLElement;
  height?: number | string;
  width?: number | string;
  menubar?: boolean;
  statusbar?: boolean;
  toolbar?: string | string[] | false;
  plugins?: string | string[];
  branding?: boolean;
  readonly?: boolean;
  inline?: boolean;
  content_style?: string;
  setup?: (editor: TinyMCEEditor) => void;
  init_instance_callback?: (editor: TinyMCEEditor) => void;
  content_css?: string | string[] | false;
  skin?: string | false;
  theme?: string;
}

export interface TinyMCEWrapperEvents {
  onContentChange?: (content: string, editor: TinyMCEEditor) => void;
  onFocus?: (editor: TinyMCEEditor) => void;
  onBlur?: (editor: TinyMCEEditor) => void;
  onInit?: (editor: TinyMCEEditor) => void;
  onDestroy?: () => void;
}

export interface TinyMCEWrapperOptions {
  config?: Partial<TinyMCEConfig>;
  events?: TinyMCEWrapperEvents;
  autoFocus?: boolean;
  debounceDelay?: number;
}

/**
 * Extension-specific TinyMCE wrapper component
 * Handles initialization, configuration, and lifecycle management
 */
export class TinyMCEWrapper {
  private editor: TinyMCEEditor | null = null;
  private container: HTMLElement | null = null;
  private textArea: HTMLTextAreaElement | null = null;
  private isInitialized = false;
  private isDestroyed = false;
  private contentChangeTimeout: number | null = null;

  private readonly options: TinyMCEWrapperOptions;
  private readonly defaultConfig: TinyMCEConfig = {
    height: 300,
    menubar: false,
    statusbar: false,
    branding: false,
    plugins: [
      "lists",
      "link",
      "image",
      "charmap",
      "preview",
      "searchreplace",
      "visualblocks",
      "code",
      "fullscreen",
      "insertdatetime",
      "media",
      "table",
      "help",
      "wordcount",
    ],
    toolbar:
      "undo redo | blocks | " +
      "bold italic forecolor | alignleft aligncenter " +
      "alignright alignjustify | bullist numlist outdent indent | " +
      "removeformat | help",
    content_style:
      "body { font-family: -apple-system, BlinkMacSystemFont, San Francisco, Segoe UI, Roboto, Helvetica Neue, sans-serif; font-size: 14px; }",
    skin: false,
    content_css: false,
  };

  constructor(options: TinyMCEWrapperOptions = {}) {
    this.options = {
      debounceDelay: 300,
      autoFocus: false,
      ...options,
    };
  }

  /**
   * Initialize TinyMCE editor in the specified container
   */
  async init(
    container: HTMLElement,
    initialContent: string = "",
  ): Promise<TinyMCEEditor> {
    if (this.isDestroyed) {
      throw new Error("TinyMCE wrapper has been destroyed");
    }

    if (this.isInitialized) {
      await this.destroy();
    }

    this.container = container;

    // Create textarea element for TinyMCE
    this.textArea = document.createElement("textarea");
    this.textArea.value = initialContent;
    this.textArea.style.width = "100%";
    this.textArea.style.height = "300px";

    container.appendChild(this.textArea);

    // Import TinyMCE dynamically
    const tinymce = await this.loadTinyMCE();

    // Merge configuration
    const config: TinyMCEConfig = {
      ...this.defaultConfig,
      ...this.options.config,
      target: this.textArea,
      setup: (editor: TinyMCEEditor) => {
        this.setupEditor(editor);
        if (this.options.config?.setup) {
          this.options.config.setup(editor);
        }
      },
      init_instance_callback: (editor: TinyMCEEditor) => {
        this.editor = editor;
        this.isInitialized = true;

        if (this.options.autoFocus) {
          editor.focus();
        }

        if (this.options.events?.onInit) {
          this.options.events.onInit(editor);
        }

        if (this.options.config?.init_instance_callback) {
          this.options.config.init_instance_callback(editor);
        }
      },
    };

    // Initialize TinyMCE
    const editors = await tinymce.init(config);

    if (editors && editors.length > 0) {
      return editors[0];
    }

    throw new Error("Failed to initialize TinyMCE editor");
  }

  /**
   * Setup editor event handlers and custom behavior
   */
  private setupEditor(editor: TinyMCEEditor): void {
    // Content change handler with debouncing
    editor.on("input change keyup", () => {
      if (this.contentChangeTimeout) {
        window.clearTimeout(this.contentChangeTimeout);
      }

      this.contentChangeTimeout = window.setTimeout(() => {
        if (this.options.events?.onContentChange && this.editor) {
          this.options.events.onContentChange(
            this.editor.getContent(),
            this.editor,
          );
        }
      }, this.options.debounceDelay);
    });

    // Focus and blur handlers
    editor.on("focus", () => {
      if (this.options.events?.onFocus) {
        this.options.events.onFocus(editor);
      }
    });

    editor.on("blur", () => {
      if (this.options.events?.onBlur) {
        this.options.events.onBlur(editor);
      }
    });

    // Extension-specific customizations
    this.addExtensionCustomizations(editor);
  }

  /**
   * Add PuffPuffPaste-specific customizations to the editor
   */
  private addExtensionCustomizations(editor: TinyMCEEditor): void {
    // Add custom keyboard shortcuts for snippet functionality
    editor.addShortcut("ctrl+shift+v", "Paste as plain text", () => {
      // This will be integrated with our paste strategies later
      console.log("🔧 Custom paste shortcut triggered");
    });

    // Add variable placeholder helper
    editor.addShortcut(
      "ctrl+shift+dollar",
      "Insert variable placeholder",
      () => {
        this.showVariableAutocomplete(editor);
      },
    );

    // Custom context menu items for snippet operations
    editor.ui.registry.addMenuItem("insertVariable", {
      text: "Insert Variable",
      icon: "code-sample",
      onAction: () => {
        this.showVariableAutocomplete(editor);
      },
    });

    // Add variable autocomplete on typing
    this.setupVariableAutocomplete(editor);
  }

  /**
   * Setup variable autocomplete functionality
   */
  private setupVariableAutocomplete(editor: TinyMCEEditor): void {
    let autocompleteActive = false;
    let currentVariables: string[] = [];

    // Extract variables from content
    const extractVariables = (): string[] => {
      const content = editor.getContent({ format: "text" });
      const variablePattern = /\$\{([^}]+)\}/g;
      const variables = new Set<string>();
      let match;

      while ((match = variablePattern.exec(content)) !== null) {
        const varName = match[1].trim();
        if (varName && !variables.has(varName)) {
          variables.add(varName);
        }
      }

      return Array.from(variables).sort();
    };

    // Show autocomplete when typing ${
    editor.on("keyup", (e: KeyboardEvent) => {
      const selection = editor.selection;
      const range = selection.getRng();

      if (!range.collapsed) return;

      const container = range.startContainer;
      const offset = range.startOffset;

      if (container.nodeType === Node.TEXT_NODE) {
        const text = container.textContent || "";
        const beforeCursor = text.substring(0, offset);

        // Check if we're starting a variable
        if (beforeCursor.endsWith("${")) {
          currentVariables = extractVariables();
          if (currentVariables.length > 0) {
            this.showVariableDropdown(editor, currentVariables);
            autocompleteActive = true;
          }
        } else if (autocompleteActive) {
          // Check if we're still in a variable context
          const lastDollarBrace = beforeCursor.lastIndexOf("${");
          const lastCloseBrace = beforeCursor.lastIndexOf("}");

          if (lastDollarBrace > lastCloseBrace) {
            // Still in variable context, update suggestions
            const partial = beforeCursor.substring(lastDollarBrace + 2);
            const filteredVars = currentVariables.filter((v) =>
              v.toLowerCase().includes(partial.toLowerCase()),
            );

            if (filteredVars.length > 0) {
              this.updateVariableDropdown(editor, filteredVars, partial);
            } else {
              this.hideVariableDropdown();
              autocompleteActive = false;
            }
          } else {
            this.hideVariableDropdown();
            autocompleteActive = false;
          }
        }
      }
    });

    // Hide autocomplete on escape or click outside
    editor.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" && autocompleteActive) {
        this.hideVariableDropdown();
        autocompleteActive = false;
        e.preventDefault();
      }
    });

    editor.on("click", () => {
      if (autocompleteActive) {
        this.hideVariableDropdown();
        autocompleteActive = false;
      }
    });
  }

  /**
   * Show variable autocomplete dropdown
   */
  private showVariableDropdown(
    editor: TinyMCEEditor,
    variables: string[],
  ): void {
    this.hideVariableDropdown(); // Clear any existing dropdown

    const dropdown = document.createElement("div");
    dropdown.id = "variable-autocomplete";
    dropdown.className = "variable-autocomplete-dropdown";
    dropdown.innerHTML = `
      <div class="autocomplete-header">
        <small>Variables (${variables.length})</small>
      </div>
      ${variables
        .map(
          (variable, index) => `
        <div class="autocomplete-item" data-variable="${variable}" data-index="${index}">
          <code>\${${variable}}</code>
        </div>
      `,
        )
        .join("")}
      <div class="autocomplete-footer">
        <small>↑↓ navigate, Enter to select, Esc to cancel</small>
      </div>
    `;

    // Position dropdown near cursor
    const editorContainer = editor.getContainer();
    const editorRect = editorContainer.getBoundingClientRect();

    dropdown.style.position = "absolute";
    dropdown.style.top = `${editorRect.bottom + 5}px`;
    dropdown.style.left = `${editorRect.left}px`;
    dropdown.style.zIndex = "10000";

    document.body.appendChild(dropdown);

    // Add click handlers
    dropdown.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const item = target.closest(".autocomplete-item") as HTMLElement;
      if (item) {
        const variable = item.dataset.variable;
        if (variable) {
          this.insertVariableAtCursor(editor, variable);
          this.hideVariableDropdown();
        }
      }
    });
  }

  /**
   * Update variable dropdown with filtered results
   */
  private updateVariableDropdown(
    editor: TinyMCEEditor,
    variables: string[],
    partial: string,
  ): void {
    const dropdown = document.getElementById("variable-autocomplete");
    if (!dropdown) return;

    const header = dropdown.querySelector(".autocomplete-header");
    const footer = dropdown.querySelector(".autocomplete-footer");

    if (header) {
      header.innerHTML = `<small>Variables (${variables.length}) - "${partial}"</small>`;
    }

    // Remove existing items
    const existingItems = dropdown.querySelectorAll(".autocomplete-item");
    existingItems.forEach((item) => item.remove());

    // Add filtered items
    const itemsHTML = variables
      .map(
        (variable, index) => `
      <div class="autocomplete-item" data-variable="${variable}" data-index="${index}">
        <code>\${${variable}}</code>
      </div>
    `,
      )
      .join("");

    if (footer) {
      footer.insertAdjacentHTML("beforebegin", itemsHTML);
    }
  }

  /**
   * Hide variable autocomplete dropdown
   */
  private hideVariableDropdown(): void {
    const dropdown = document.getElementById("variable-autocomplete");
    if (dropdown) {
      dropdown.remove();
    }
  }

  /**
   * Show variable autocomplete dialog
   */
  private showVariableAutocomplete(editor: TinyMCEEditor): void {
    const content = editor.getContent({ format: "text" });
    const variablePattern = /\$\{([^}]+)\}/g;
    const existingVariables = new Set<string>();
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const varName = match[1].trim();
      if (varName) {
        existingVariables.add(varName);
      }
    }

    const variableList = Array.from(existingVariables).sort();

    if (variableList.length > 0) {
      // Show selection dialog with existing variables
      const variableName = this.showVariableSelectionDialog(variableList);
      if (variableName) {
        editor.insertContent(`\${${variableName}}`);
      }
    } else {
      // Prompt for new variable name
      const variableName = prompt("Enter variable name:");
      if (variableName && variableName.trim()) {
        editor.insertContent(`\${${variableName.trim()}}`);
      }
    }
  }

  /**
   * Show variable selection dialog
   */
  private showVariableSelectionDialog(variables: string[]): string | null {
    const options = [
      "Create new variable...",
      ...variables.map((v) => `Existing: ${v}`),
    ];

    const choice = prompt(
      `Select a variable:\n${options.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}\n\nEnter number or new variable name:`,
    );

    if (!choice) return null;

    const choiceNum = parseInt(choice);
    if (choiceNum === 1) {
      // Create new variable
      const newVar = prompt("Enter new variable name:");
      return newVar?.trim() || null;
    } else if (choiceNum > 1 && choiceNum <= variables.length + 1) {
      // Use existing variable
      return variables[choiceNum - 2];
    } else {
      // Treat as new variable name
      return choice.trim() || null;
    }
  }

  /**
   * Insert variable at current cursor position
   */
  private insertVariableAtCursor(
    editor: TinyMCEEditor,
    variableName: string,
  ): void {
    const selection = editor.selection;
    const range = selection.getRng();

    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const container = range.startContainer;
      const text = container.textContent || "";
      const offset = range.startOffset;

      // Find the ${ before cursor
      const beforeCursor = text.substring(0, offset);
      const dollarBraceIndex = beforeCursor.lastIndexOf("${");

      if (dollarBraceIndex !== -1) {
        // Replace from ${ to cursor with complete variable
        const beforeVar = text.substring(0, dollarBraceIndex);
        const afterCursor = text.substring(offset);
        const newText = `${beforeVar}\${${variableName}}${afterCursor}`;

        container.textContent = newText;

        // Position cursor after the variable
        const newOffset = dollarBraceIndex + variableName.length + 3; // ${varname}
        range.setStart(container, newOffset);
        range.setEnd(container, newOffset);
        selection.setRng(range);
      } else {
        // Just insert the variable
        editor.insertContent(`\${${variableName}}`);
      }
    } else {
      // Fallback to simple insertion
      editor.insertContent(`\${${variableName}}`);
    }
  }

  /**
   * Load TinyMCE module dynamically
   */
  private async loadTinyMCE(): Promise<any> {
    try {
      // Import TinyMCE
      const tinymce = await import("tinymce/tinymce");

      // Import theme and plugins
      await import("tinymce/themes/silver");
      await import("tinymce/models/dom");

      // Import commonly used plugins
      await import("tinymce/plugins/lists");
      await import("tinymce/plugins/link");
      await import("tinymce/plugins/image");
      await import("tinymce/plugins/charmap");
      await import("tinymce/plugins/preview");
      await import("tinymce/plugins/searchreplace");
      await import("tinymce/plugins/visualblocks");
      await import("tinymce/plugins/code");
      await import("tinymce/plugins/fullscreen");
      await import("tinymce/plugins/insertdatetime");
      await import("tinymce/plugins/media");
      await import("tinymce/plugins/table");
      await import("tinymce/plugins/help");
      await import("tinymce/plugins/wordcount");

      return tinymce.default;
    } catch (error) {
      console.error("❌ Failed to load TinyMCE:", error);
      throw new Error("Failed to load TinyMCE modules");
    }
  }

  /**
   * Get current editor content
   */
  getContent(): string {
    if (!this.editor) {
      return "";
    }
    return this.editor.getContent();
  }

  /**
   * Set editor content
   */
  setContent(content: string): void {
    if (!this.editor) {
      throw new Error("Editor not initialized");
    }
    this.editor.setContent(content);
  }

  /**
   * Insert content at cursor position
   */
  insertContent(content: string): void {
    if (!this.editor) {
      throw new Error("Editor not initialized");
    }
    this.editor.insertContent(content);
  }

  /**
   * Focus the editor
   */
  focus(): void {
    if (this.editor) {
      this.editor.focus();
    }
  }

  /**
   * Check if editor is focused
   */
  hasFocus(): boolean {
    return this.editor?.hasFocus() ?? false;
  }

  /**
   * Get the underlying TinyMCE editor instance
   */
  getEditor(): TinyMCEEditor | null {
    return this.editor;
  }

  /**
   * Check if editor is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.editor !== null;
  }

  /**
   * Destroy the editor and clean up resources
   */
  async destroy(): Promise<void> {
    if (this.contentChangeTimeout) {
      window.clearTimeout(this.contentChangeTimeout);
      this.contentChangeTimeout = null;
    }

    if (this.editor) {
      await this.editor.destroy();
      this.editor = null;
    }

    if (this.textArea && this.container) {
      this.container.removeChild(this.textArea);
      this.textArea = null;
    }

    this.container = null;
    this.isInitialized = false;
    this.isDestroyed = true;

    if (this.options.events?.onDestroy) {
      this.options.events.onDestroy();
    }
  }

  /**
   * Update editor configuration
   */
  updateConfig(newConfig: Partial<TinyMCEConfig>): void {
    if (this.isInitialized) {
      console.warn(
        "⚠️ Cannot update config after initialization. Destroy and reinitialize to apply changes.",
      );
      return;
    }

    this.options.config = {
      ...this.options.config,
      ...newConfig,
    };
  }

  /**
   * Get current editor configuration
   */
  getConfig(): Partial<TinyMCEConfig> | undefined {
    return this.options.config;
  }
}

/**
 * Utility function to create a TinyMCE wrapper with common extension settings
 */
export function createSnippetEditor(
  container: HTMLElement,
  options: Partial<TinyMCEWrapperOptions> = {},
): TinyMCEWrapper {
  const defaultSnippetEditorConfig: Partial<TinyMCEConfig> = {
    height: 250,
    toolbar:
      "undo redo | bold italic | forecolor backcolor | " +
      "bullist numlist | link | code | insertVariable",
    plugins: ["lists", "link", "code", "help"],
    content_style: `
      body { 
        font-family: -apple-system, BlinkMacSystemFont, San Francisco, Segoe UI, Roboto, Helvetica Neue, sans-serif; 
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        padding: 8px;
      }
      .variable-placeholder {
        background-color: #f0f0f0;
        border: 1px dashed #ccc;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: monospace;
        color: #666;
      }
    `,
  };

  return new TinyMCEWrapper({
    ...options,
    config: {
      ...defaultSnippetEditorConfig,
      ...options.config,
    },
  });
}
