/**
 * Quill wrapper for PuffPuffPaste extension
 * Provides extension-specific integration with Quill editor
 */

export interface QuillConfig {
  theme?: string;
  modules?: any;
  formats?: string[];
  placeholder?: string;
  readOnly?: boolean;
  bounds?: string | HTMLElement;
  debug?: string | boolean;
}

export interface QuillWrapperEvents {
  onContentChange?: (content: string, delta: any, source: string) => void;
  onSelectionChange?: (range: any, oldRange: any, source: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface QuillWrapperOptions {
  config?: Partial<QuillConfig>;
  events?: QuillWrapperEvents;
  autoFocus?: boolean;
  debounceDelay?: number;
}

/**
 * Extension-specific Quill wrapper component
 * Handles initialization, configuration, and lifecycle management
 */
export class QuillWrapper {
  private quill: any = null;
  private container: HTMLElement | null = null;
  private editorContainer: HTMLElement | null = null;
  private isInitialized = false;
  private isDestroyed = false;
  private contentChangeTimeout: number | null = null;

  private readonly options: QuillWrapperOptions;
  private readonly defaultConfig: QuillConfig = {
    theme: "snow",
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ indent: "-1" }, { indent: "+1" }],
        [{ align: [] }],
        ["link"],
        ["clean"],
      ],
    },
    formats: [
      "header",
      "bold",
      "italic",
      "underline",
      "strike",
      "color",
      "background",
      "list",
      "bullet",
      "indent",
      "align",
      "link",
    ],
    placeholder: "Enter your snippet content...",
  };

  constructor(options: QuillWrapperOptions = {}) {
    this.options = {
      debounceDelay: 300,
      autoFocus: false,
      ...options,
    };
  }

  /**
   * Initialize Quill editor in the specified container
   */
  async init(
    container: HTMLElement,
    initialContent: string = "",
  ): Promise<any> {
    if (this.isDestroyed) {
      throw new Error("Quill wrapper has been destroyed");
    }

    if (this.isInitialized) {
      await this.destroy();
    }

    this.container = container;

    // Create editor container
    this.editorContainer = document.createElement("div");
    this.editorContainer.style.height = "300px";
    this.editorContainer.style.background = "#fff";
    this.editorContainer.style.border = "1px solid #ccc";
    this.editorContainer.style.borderRadius = "4px";

    container.appendChild(this.editorContainer);

    // Import Quill dynamically
    const Quill = await this.loadQuill();

    // Merge configuration
    const config: QuillConfig = {
      ...this.defaultConfig,
      ...this.options.config,
    };

    // Initialize Quill
    this.quill = new Quill(this.editorContainer, config);

    // Set initial content
    if (initialContent) {
      if (initialContent.startsWith("<")) {
        // HTML content
        this.quill.root.innerHTML = initialContent;
      } else {
        // Plain text
        this.quill.setText(initialContent);
      }
    }

    this.setupEditor();
    this.isInitialized = true;

    if (this.options.autoFocus) {
      this.quill.focus();
    }

    return this.quill;
  }

  /**
   * Setup editor event handlers and custom behavior
   */
  private setupEditor(): void {
    if (!this.quill) return;

    // Content change handler with debouncing
    this.quill.on(
      "text-change",
      (delta: any, oldDelta: any, source: string) => {
        if (this.contentChangeTimeout) {
          window.clearTimeout(this.contentChangeTimeout);
        }

        this.contentChangeTimeout = window.setTimeout(() => {
          if (this.options.events?.onContentChange && this.quill) {
            this.options.events.onContentChange(
              this.getContent(),
              delta,
              source,
            );
          }
        }, this.options.debounceDelay);
      },
    );

    // Selection change handler
    this.quill.on(
      "selection-change",
      (range: any, oldRange: any, source: string) => {
        if (this.options.events?.onSelectionChange) {
          this.options.events.onSelectionChange(range, oldRange, source);
        }

        // Focus/blur events
        if (range) {
          if (this.options.events?.onFocus) {
            this.options.events.onFocus();
          }
        } else {
          if (this.options.events?.onBlur) {
            this.options.events.onBlur();
          }
        }
      },
    );

    // Extension-specific customizations
    this.addExtensionCustomizations();
  }

  /**
   * Add PuffPuffPaste-specific customizations to the editor
   */
  private addExtensionCustomizations(): void {
    if (!this.quill) return;

    // Add keyboard shortcuts for snippet functionality
    this.quill.keyboard.addBinding(
      {
        key: "V",
        ctrlKey: true,
        shiftKey: true,
      },
      () => {
        // Custom paste shortcut
        console.log("🔧 Custom paste shortcut triggered");
        return false; // Prevent default
      },
    );

    // Add variable placeholder helper
    this.quill.keyboard.addBinding(
      {
        key: "$",
        ctrlKey: true,
        shiftKey: true,
      },
      () => {
        this.insertVariablePlaceholder();
        return false;
      },
    );
  }

  /**
   * Insert a variable placeholder at current cursor position
   */
  private insertVariablePlaceholder(): void {
    if (!this.quill) return;

    const range = this.quill.getSelection();
    if (range) {
      this.quill.insertText(range.index, "${variable_name}", "user");
      this.quill.setSelection(range.index + 2, 13); // Select "variable_name"
    }
  }

  /**
   * Load Quill module dynamically
   */
  private async loadQuill(): Promise<any> {
    try {
      // For now, load from CDN since we can't npm install
      // This will work because Quill doesn't have CSP issues
      return new Promise((resolve, reject) => {
        if ((window as any).Quill) {
          resolve((window as any).Quill);
          return;
        }

        // Load CSS first
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href =
          "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css";
        document.head.appendChild(link);

        // Load JS
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js";

        script.onload = () => {
          if ((window as any).Quill) {
            resolve((window as any).Quill);
          } else {
            reject(new Error("Quill not available after script load"));
          }
        };

        script.onerror = () => {
          reject(new Error("Failed to load Quill from CDN"));
        };

        document.head.appendChild(script);
      });
    } catch (error) {
      console.error("❌ Failed to load Quill:", error);
      throw new Error("Failed to load Quill");
    }
  }

  /**
   * Get current editor content as HTML
   */
  getContent(): string {
    if (!this.quill) {
      return "";
    }
    return this.quill.root.innerHTML;
  }

  /**
   * Get current editor content as plain text
   */
  getText(): string {
    if (!this.quill) {
      return "";
    }
    return this.quill.getText();
  }

  /**
   * Set editor content
   */
  setContent(content: string): void {
    if (!this.quill) {
      throw new Error("Editor not initialized");
    }

    if (content.startsWith("<")) {
      // HTML content
      this.quill.root.innerHTML = content;
    } else {
      // Plain text
      this.quill.setText(content);
    }
  }

  /**
   * Focus the editor
   */
  focus(): void {
    if (this.quill) {
      this.quill.focus();
    }
  }

  /**
   * Check if editor has focus
   */
  hasFocus(): boolean {
    if (!this.quill) {
      return false;
    }
    return this.quill.hasFocus();
  }

  /**
   * Enable/disable editor
   */
  setEnabled(enabled: boolean): void {
    if (this.quill) {
      this.quill.enable(enabled);
    }
  }

  /**
   * Destroy the editor and cleanup
   */
  async destroy(): Promise<void> {
    if (this.contentChangeTimeout) {
      window.clearTimeout(this.contentChangeTimeout);
      this.contentChangeTimeout = null;
    }

    if (this.quill) {
      // Quill doesn't have a destroy method, just remove the container
      this.quill = null;
    }

    if (this.editorContainer && this.container) {
      this.container.removeChild(this.editorContainer);
      this.editorContainer = null;
    }

    this.container = null;
    this.isInitialized = false;

    if (this.options.events?.onDestroy) {
      this.options.events.onDestroy();
    }
  }

  /**
   * Mark wrapper as destroyed (prevents reuse)
   */
  markDestroyed(): void {
    this.isDestroyed = true;
  }

  /**
   * Check if editor is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.quill !== null;
  }
}

/**
 * Create a snippet editor with PuffPuffPaste-specific configuration
 */
export function createSnippetEditor(
  options: QuillWrapperOptions = {},
): QuillWrapper {
  const defaultOptions: QuillWrapperOptions = {
    config: {
      placeholder: "Enter your snippet content here...",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline"],
          [{ color: [] }],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link"],
          ["clean"],
        ],
      },
    },
    autoFocus: true,
    debounceDelay: 300,
    ...options,
  };

  return new QuillWrapper(defaultOptions);
}
