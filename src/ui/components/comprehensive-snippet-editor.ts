/**
 * Comprehensive Snippet Editor Component
 * Provides full editing support for TierStorageSchema with SimpleEditor integration
 * Supports editing single snippets from multi-snippet JSON stores
 */

import { SimpleEditor } from "../../editor/simple-editor.js";
import type {
  TierStorageSchema,
  EnhancedSnippet,
  PriorityTier,
  VariableDef,
} from "../../types/snippet-formats.js";
import type { StoreSnippetInfo } from "./multi-store-editor.js";

export interface ComprehensiveSnippetEditorOptions {
  tierData: TierStorageSchema;
  mode: "create" | "edit";
  snippetId?: string;
  enableContentTypeConversion?: boolean;
  validateDependencies?: boolean;
  onSave?: (result: SnippetEditResult) => Promise<void>;
  onError?: (error: Error) => void;
  onContentChange?: (content: string) => void;
  autoFocus?: boolean;
  compact?: boolean;
  // Multi-store support
  availableStores?: StoreSnippetInfo[];
  showStoreSelector?: boolean;
  defaultSelectedStores?: string[]; // Store IDs to select by default
}

export interface SnippetEditResult {
  success: boolean;
  snippet: EnhancedSnippet;
  updatedTierData: TierStorageSchema;
  selectedStores?: string[]; // Store IDs selected for saving
  errors?: string[];
  warnings?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Content type conversion utilities
 */
const ContentConverter = {
  htmlToPlaintext: (html: string): string => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  },

  htmlToMarkdown: (html: string): string => {
    // Basic HTML to Markdown conversion
    return html
      .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
      .replace(/<b>(.*?)<\/b>/g, "**$1**")
      .replace(/<em>(.*?)<\/em>/g, "*$1*")
      .replace(/<i>(.*?)<\/i>/g, "*$1*")
      .replace(/<p>(.*?)<\/p>/g, "$1\n\n")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]*>/g, "")
      .trim();
  },

  markdownToHtml: (markdown: string): string => {
    // Basic Markdown to HTML conversion
    return markdown
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^(.*)$/, "<p>$1</p>");
  },

  plaintextToHtml: (text: string): string => {
    return `<p>${text.replace(/\n/g, "<br>")}</p>`;
  },
};

/**
 * Comprehensive snippet editor with full TierStorageSchema support
 */
export class ComprehensiveSnippetEditor {
  private container: HTMLElement | null = null;
  private editor: SimpleEditor | null = null;
  private currentSnippet: EnhancedSnippet | null = null;
  private originalTierData: TierStorageSchema;
  private options: ComprehensiveSnippetEditorOptions;
  private isInitialized = false;
  private isDirty = false;
  private validationErrors: string[] = [];
  private selectedStores: Set<string> = new Set(); // Track selected stores

  // Form elements cache
  private formElements: {
    triggerInput?: HTMLInputElement;
    descriptionInput?: HTMLTextAreaElement;
    contentTypeSelect?: HTMLSelectElement;
    scopeSelect?: HTMLSelectElement;
    tagsInput?: HTMLInputElement;
    editorContainer?: HTMLElement;
    variablesContainer?: HTMLElement;
    dependenciesContainer?: HTMLElement;
    imagesContainer?: HTMLElement;
    createdByInput?: HTMLInputElement;
    updatedByInput?: HTMLInputElement;
  } = {};

  constructor(options: ComprehensiveSnippetEditorOptions) {
    this.options = {
      enableContentTypeConversion: true,
      validateDependencies: true,
      autoFocus: false,
      compact: false,
      showStoreSelector: false,
      defaultSelectedStores: [],
      ...options,
    };

    this.originalTierData = JSON.parse(JSON.stringify(options.tierData));

    // Initialize selected stores
    if (
      this.options.defaultSelectedStores &&
      this.options.defaultSelectedStores.length > 0
    ) {
      this.options.defaultSelectedStores.forEach((storeId) =>
        this.selectedStores.add(storeId),
      );
    }

    if (options.mode === "edit" && options.snippetId) {
      const snippet = this.findSnippetById(options.snippetId);
      if (!snippet) {
        throw new Error(`Snippet with ID '${options.snippetId}' not found`);
      }
      this.currentSnippet = JSON.parse(JSON.stringify(snippet));
    } else if (options.mode === "create") {
      this.currentSnippet = this.createEmptySnippet();
    }
  }

  /**
   * Initialize the editor in the specified container
   */
  async init(container: HTMLElement): Promise<void> {
    if (this.isInitialized) {
      throw new Error("Editor already initialized");
    }

    this.container = container;
    this.createEditorInterface();
    await this.initializeSimpleEditor();
    this.setupEventHandlers();
    this.loadSnippetData();
    this.isInitialized = true;
  }

  /**
   * Create the comprehensive editor interface
   */
  private createEditorInterface(): void {
    if (!this.container || !this.currentSnippet) return;

    const isEdit = this.options.mode === "edit";
    const isCompact = this.options.compact;

    this.container.innerHTML = `
      <div class="comprehensive-snippet-editor ${isCompact ? "compact" : ""}">
        <div class="editor-header">
          <h2 class="editor-title">
            ${isEdit ? "Edit Snippet" : "Create New Snippet"}
          </h2>
          <div class="editor-tier-info">
            ${
              this.options.showStoreSelector &&
              this.options.availableStores &&
              this.options.availableStores.length > 0
                ? this.renderStoreSelector()
                : `
            <span class="tier-badge tier-${this.originalTierData.tier}">
              ${this.originalTierData.tier.toUpperCase()} Tier
            </span>
            <span class="snippet-count">
              ${this.originalTierData.snippets.length} snippet${this.originalTierData.snippets.length !== 1 ? "s" : ""} in store
            </span>`
            }
          </div>
          <div class="editor-actions">
            <button type="button" class="btn btn-secondary" data-action="cancel">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" data-action="save">
              ${isEdit ? "Update" : "Create"} Snippet
            </button>
          </div>
        </div>

        <form class="editor-form" novalidate>
          <!-- Core Fields Section -->
          <div class="form-section">
            <h3 class="section-title">Core Fields</h3>
            
            <div class="form-row">
              <div class="form-group required">
                <label for="snippet-trigger">Trigger</label>
                <input 
                  type="text" 
                  id="snippet-trigger" 
                  name="trigger"
                  placeholder="e.g., ;hello"
                  required
                  autocomplete="off"
                />
                <div class="form-help">The text that triggers this snippet expansion</div>
              </div>
              
              <div class="form-group">
                <label for="snippet-content-type">Content Type</label>
                <select id="snippet-content-type" name="contentType">
                  <option value="html">HTML (Rich Text)</option>
                  <option value="plaintext">Plain Text</option>
                  <option value="markdown">Markdown</option>
                  <option value="latex">LaTeX</option>
                  <option value="html+KaTeX">HTML + KaTeX</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="snippet-description">Description</label>
              <textarea 
                id="snippet-description" 
                name="description"
                rows="2"
                placeholder="Brief description of what this snippet does"
              ></textarea>
            </div>
          </div>

          <!-- Content Section -->
          <div class="form-section">
            <h3 class="section-title">Content</h3>
            
            <div class="form-group editor-group required">
              <label for="snippet-content">Snippet Content</label>
              <textarea id="snippet-content-editor" class="editor-textarea" rows="8" placeholder="Enter your snippet content here..."></textarea>
              <div class="editor-toolbar">
                <button type="button" class="btn btn-sm" data-action="insert-variable">
                  Insert Variable
                </button>
                <button type="button" class="btn btn-sm" data-action="preview-content">
                  Preview
                </button>
                <button type="button" class="btn btn-sm" data-action="convert-content">
                  Convert Content Type
                </button>
              </div>
            </div>
          </div>

          <!-- Organization Section -->
          <div class="form-section">
            <h3 class="section-title">Organization & Metadata</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label for="snippet-scope">Scope</label>
                <select id="snippet-scope" name="scope">
                  <option value="personal">Personal</option>
                  <option value="team">Team</option>
                  <option value="org">Organization</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="snippet-tags">Tags</label>
                <input 
                  type="text" 
                  id="snippet-tags" 
                  name="tags"
                  placeholder="comma, separated, tags"
                />
                <div class="form-help">Comma-separated tags for categorization</div>
              </div>
            </div>
          </div>

          <!-- Variables Section -->
          <div class="form-section">
            <h3 class="section-title">Variables</h3>
            <div id="variables-container">
              <div class="variables-list">
                <!-- Variable definitions will be populated here -->
              </div>
              <button type="button" class="btn btn-sm btn-secondary" data-action="add-variable">
                Add Variable
              </button>
            </div>
          </div>

          <!-- Dependencies Section -->
          <div class="form-section">
            <h3 class="section-title">Dependencies</h3>
            <div id="dependencies-container">
              <div class="dependencies-list">
                <!-- Dependencies will be populated here -->
              </div>
              <div class="dependency-controls">
                <input type="text" placeholder="Enter snippet trigger (e.g., ;hello)" class="dependency-input">
                <button type="button" class="btn btn-sm btn-secondary" data-action="add-dependency">
                  Add Dependency
                </button>
              </div>
              <div class="form-help">Snippets that this snippet depends on</div>
            </div>
          </div>

          <!-- Images Section -->
          <div class="form-section">
            <h3 class="section-title">Images</h3>
            <div id="images-container">
              <div class="images-list">
                <!-- Image references will be populated here -->
              </div>
              <div class="image-controls">
                <input type="text" placeholder="Enter image URL or file ID" class="image-input">
                <button type="button" class="btn btn-sm btn-secondary" data-action="add-image">
                  Add Image
                </button>
              </div>
              <div class="form-help">Image URLs or file IDs referenced in content</div>
            </div>
          </div>

          <!-- Audit Section -->
          <div class="form-section">
            <h3 class="section-title">Audit Information</h3>
            
            <div class="form-row">
              <div class="form-group">
                <label for="snippet-created-by">Created By</label>
                <input 
                  type="text" 
                  id="snippet-created-by" 
                  name="createdBy"
                  placeholder="Creator username or email"
                />
              </div>
              
              <div class="form-group">
                <label for="snippet-updated-by">Updated By</label>
                <input 
                  type="text" 
                  id="snippet-updated-by" 
                  name="updatedBy"
                  placeholder="Last editor username or email"
                />
              </div>
            </div>

            <div class="audit-timestamps">
              <div class="timestamp-info">
                <strong>Created:</strong> ${this.currentSnippet.createdAt}
              </div>
              <div class="timestamp-info">
                <strong>Last Updated:</strong> ${this.currentSnippet.updatedAt}
              </div>
            </div>
          </div>

          <!-- Validation Messages -->
          <div id="validation-messages" class="validation-messages" style="display: none;">
            <!-- Validation errors and warnings will appear here -->
          </div>
        </form>
      </div>
    `;

    // Cache form elements
    this.cacheFormElements();
  }

  /**
   * Cache form elements for efficient access
   */
  private cacheFormElements(): void {
    if (!this.container) return;

    this.formElements = {
      triggerInput: this.container.querySelector(
        "#snippet-trigger",
      ) as HTMLInputElement,
      descriptionInput: this.container.querySelector(
        "#snippet-description",
      ) as HTMLTextAreaElement,
      contentTypeSelect: this.container.querySelector(
        "#snippet-content-type",
      ) as HTMLSelectElement,
      scopeSelect: this.container.querySelector(
        "#snippet-scope",
      ) as HTMLSelectElement,
      tagsInput: this.container.querySelector(
        "#snippet-tags",
      ) as HTMLInputElement,
      contentEditor: this.container.querySelector(
        "#snippet-content-editor",
      ) as HTMLTextAreaElement,
      variablesContainer: this.container.querySelector(
        "#variables-container",
      ) as HTMLElement,
      dependenciesContainer: this.container.querySelector(
        "#dependencies-container",
      ) as HTMLElement,
      imagesContainer: this.container.querySelector(
        "#images-container",
      ) as HTMLElement,
      createdByInput: this.container.querySelector(
        "#snippet-created-by",
      ) as HTMLInputElement,
      updatedByInput: this.container.querySelector(
        "#snippet-updated-by",
      ) as HTMLInputElement,
    };
  }

  /**
   * Initialize simple textarea editor
   */
  private async initializeSimpleEditor(): Promise<void> {
    if (!this.formElements.contentEditor || !this.currentSnippet) return;

    const initialContent = this.currentSnippet.content || "";

    // Set initial content
    this.formElements.contentEditor.value = initialContent;

    // Setup event listeners for the textarea
    this.formElements.contentEditor.addEventListener("input", (e) => {
      const target = e.target as HTMLTextAreaElement;
      this.handleContentChange(target.value);
    });

    this.formElements.contentEditor.addEventListener("focus", () => {
      this.formElements.contentEditor?.classList.add("focused");
    });

    this.formElements.contentEditor.addEventListener("blur", () => {
      this.formElements.contentEditor?.classList.remove("focused");
    });

    if (this.options.autoFocus) {
      this.formElements.contentEditor.focus();
    }

    // Create a simple editor object for compatibility
    this.editor = {
      isReady: () => true,
      getContent: () => this.formElements.contentEditor?.value || "",
      setContent: (content: string) => {
        if (this.formElements.contentEditor) {
          this.formElements.contentEditor.value = content;
        }
      },
      destroy: async () => {
        // Simple cleanup if needed
      },
    };
  }

  /**
   * Setup event handlers for form elements
   */
  private setupEventHandlers(): void {
    if (!this.container) return;

    // Form input change handlers
    const inputs = this.container.querySelectorAll("input, select, textarea");
    inputs.forEach((input) => {
      input.addEventListener("input", () => {
        this.isDirty = true;
        this.validate();
      });
    });

    // Store selector checkbox handlers
    if (this.options.showStoreSelector) {
      this.container.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        if (target.type === "checkbox" && target.dataset.storeId) {
          this.handleStoreSelectionChange(
            target.dataset.storeId,
            target.checked,
          );
        }
      });
    }

    // Action button handlers
    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;

      if (action) {
        e.preventDefault();
        this.handleAction(action);
      }
    });

    // Content type change handler
    if (this.formElements.contentTypeSelect) {
      this.formElements.contentTypeSelect.addEventListener("change", () => {
        this.handleContentTypeChange();
      });
    }
  }

  /**
   * Load snippet data into form fields
   */
  private loadSnippetData(): void {
    if (!this.currentSnippet) return;

    const snippet = this.currentSnippet;

    if (this.formElements.triggerInput)
      this.formElements.triggerInput.value = snippet.trigger;
    if (this.formElements.descriptionInput)
      this.formElements.descriptionInput.value = snippet.description || "";
    if (this.formElements.contentTypeSelect)
      this.formElements.contentTypeSelect.value = snippet.contentType;
    if (this.formElements.scopeSelect)
      this.formElements.scopeSelect.value = snippet.scope;
    if (this.formElements.tagsInput)
      this.formElements.tagsInput.value = snippet.tags.join(", ");
    if (this.formElements.createdByInput)
      this.formElements.createdByInput.value = snippet.createdBy;
    if (this.formElements.updatedByInput)
      this.formElements.updatedByInput.value = snippet.updatedBy;

    this.updateVariablesDisplay();
    this.updateDependenciesDisplay();
    this.updateImagesDisplay();
  }

  /**
   * Handle content changes in the editor
   */
  private handleContentChange(content: string): void {
    this.isDirty = true;

    if (this.options.onContentChange) {
      this.options.onContentChange(content);
    }

    // Auto-extract variables from content
    this.extractAndSyncVariables(content);
    this.validate();
  }

  /**
   * Handle content type changes with optional conversion
   */
  private handleContentTypeChange(): void {
    if (!this.editor || !this.formElements.contentTypeSelect) return;

    const newContentType = this.formElements.contentTypeSelect.value;
    const currentContent = this.editor.getContent();

    if (this.options.enableContentTypeConversion && currentContent.trim()) {
      const converted = this.convertContent(
        currentContent,
        this.currentSnippet?.contentType || "html",
        newContentType as any,
      );

      if (converted !== currentContent) {
        this.editor.setContent(converted);
      }
    }

    if (this.currentSnippet) {
      this.currentSnippet.contentType = newContentType as any;
    }

    this.isDirty = true;
  }

  /**
   * Convert content between different types
   */
  private convertContent(
    content: string,
    fromType: string,
    toType: string,
  ): string {
    if (fromType === toType) return content;

    try {
      switch (`${fromType}->${toType}`) {
        case "html->plaintext":
          return ContentConverter.htmlToPlaintext(content);
        case "html->markdown":
          return ContentConverter.htmlToMarkdown(content);
        case "markdown->html":
          return ContentConverter.markdownToHtml(content);
        case "plaintext->html":
          return ContentConverter.plaintextToHtml(content);
        default:
          // For unsupported conversions, return as-is
          return content;
      }
    } catch (error) {
      console.warn("Content conversion failed:", error);
      return content;
    }
  }

  /**
   * Handle action button clicks
   */
  private async handleAction(action: string): Promise<void> {
    switch (action) {
      case "save":
        await this.save();
        break;
      case "cancel":
        this.handleCancel();
        break;
      case "insert-variable":
        this.insertVariable();
        break;
      case "preview-content":
        this.previewContent();
        break;
      case "convert-content":
        this.showContentTypeConversionDialog();
        break;
      case "add-variable":
        this.showAddVariableDialog();
        break;
      case "add-image":
        this.handleAddImageClick();
        break;
      case "add-dependency":
        this.addDependency();
        break;
      // Store selector actions
      case "select-all-stores":
        this.selectAllStores();
        break;
      case "select-writable-stores":
        this.selectWritableStores();
        break;
      case "clear-store-selection":
        this.clearStoreSelection();
        break;
      default:
        console.warn(`Unknown action: ${action}`);
        break;
    }
  }

  /**
   * Extract variables from content and sync with variables list
   */
  private extractAndSyncVariables(content: string): void {
    const extractedVars = this.extractVariablesFromText(content);

    if (!this.currentSnippet) return;

    // Add new variables found in content
    extractedVars.forEach((varName) => {
      const exists = this.currentSnippet!.variables.some(
        (v) => v.name === varName,
      );
      if (!exists) {
        this.currentSnippet!.variables.push({
          name: varName,
          prompt: `Enter value for ${varName}`,
        });
      }
    });

    // Remove variables no longer in content
    this.currentSnippet.variables = this.currentSnippet.variables.filter((v) =>
      extractedVars.includes(v.name),
    );

    this.updateVariablesDisplay();
  }

  /**
   * Extract variable names from content
   */
  extractVariables(): string[] {
    const content = this.getContent();
    return this.extractVariablesFromText(content);
  }

  private extractVariablesFromText(content: string): string[] {
    const variablePattern = /\$\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const varName = match[1].trim();
      if (varName && !variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }

  /**
   * Update variables display
   */
  private updateVariablesDisplay(): void {
    if (!this.currentSnippet || !this.formElements.variablesContainer) return;

    const variablesList =
      this.formElements.variablesContainer.querySelector(".variables-list");
    if (!variablesList) return;

    if (this.currentSnippet.variables.length === 0) {
      variablesList.innerHTML = `
        <div class="empty-state">
          <p>No variables defined. Variables in your content will appear here automatically.</p>
          <p>Use <code>\${variable_name}</code> syntax in your content to create variables.</p>
        </div>
      `;
      return;
    }

    variablesList.innerHTML = this.currentSnippet.variables
      .map(
        (variable, index) => `
      <div class="variable-item" data-index="${index}">
        <div class="variable-header">
          <code class="variable-name">\${${variable.name}}</code>
          <button type="button" class="btn btn-sm btn-danger" data-action="remove-variable" data-index="${index}">
            Remove
          </button>
        </div>
        <div class="variable-details">
          <input 
            type="text" 
            placeholder="Prompt text for this variable"
            value="${variable.prompt}"
            class="variable-prompt"
            data-index="${index}"
          />
        </div>
      </div>
    `,
      )
      .join("");

    // Add event listeners for variable controls
    variablesList.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.action === "remove-variable") {
        const index = parseInt(target.dataset.index || "0");
        this.removeVariable(this.currentSnippet!.variables[index].name);
      }
    });

    variablesList.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains("variable-prompt")) {
        const index = parseInt(target.dataset.index || "0");
        this.currentSnippet!.variables[index].prompt = target.value;
        this.isDirty = true;
      }
    });
  }

  /**
   * Update dependencies display
   */
  private updateDependenciesDisplay(): void {
    if (!this.currentSnippet || !this.formElements.dependenciesContainer)
      return;

    const dependenciesList =
      this.formElements.dependenciesContainer.querySelector(
        ".dependencies-list",
      );
    if (!dependenciesList) return;

    if (this.currentSnippet.snipDependencies.length === 0) {
      dependenciesList.innerHTML = `
        <div class="empty-state">
          <p>No dependencies defined.</p>
        </div>
      `;
      return;
    }

    dependenciesList.innerHTML = this.currentSnippet.snipDependencies
      .map(
        (dep, index) => `
      <div class="dependency-item" data-index="${index}">
        <code class="dependency-trigger">${dep}</code>
        <button type="button" class="btn btn-sm btn-danger" data-action="remove-dependency" data-index="${index}">
          Remove
        </button>
      </div>
    `,
      )
      .join("");

    // Add event listeners
    dependenciesList.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.action === "remove-dependency") {
        const index = parseInt(target.dataset.index || "0");
        this.removeSnipDependency(this.currentSnippet!.snipDependencies[index]);
      }
    });
  }

  /**
   * Update images display
   */
  private updateImagesDisplay(): void {
    if (!this.currentSnippet || !this.formElements.imagesContainer) return;

    const imagesList =
      this.formElements.imagesContainer.querySelector(".images-list");
    if (!imagesList) return;

    if (this.currentSnippet.images.length === 0) {
      imagesList.innerHTML = `
        <div class="empty-state">
          <p>No images referenced.</p>
        </div>
      `;
      return;
    }

    imagesList.innerHTML = this.currentSnippet.images
      .map(
        (img, index) => `
      <div class="image-item" data-index="${index}">
        <span class="image-url">${img}</span>
        <button type="button" class="btn btn-sm btn-danger" data-action="remove-image" data-index="${index}">
          Remove
        </button>
      </div>
    `,
      )
      .join("");

    // Add event listeners
    imagesList.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.action === "remove-image") {
        const index = parseInt(target.dataset.index || "0");
        this.removeImage(this.currentSnippet!.images[index]);
      }
    });
  }

  /**
   * Find snippet by ID in tier data
   */
  private findSnippetById(id: string): EnhancedSnippet | null {
    return this.originalTierData.snippets.find((s) => s.id === id) || null;
  }

  /**
   * Create empty snippet for new creation
   */
  private createEmptySnippet(): EnhancedSnippet {
    const now = new Date().toISOString();
    return {
      id: `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      trigger: "",
      content: "",
      contentType: "html",
      snipDependencies: [],
      description: "",
      scope: this.originalTierData.tier,
      variables: [],
      images: [],
      tags: [],
      createdAt: now,
      createdBy: "",
      updatedAt: now,
      updatedBy: "",
    };
  }

  /**
   * Validate the form and return results
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.currentSnippet) {
      errors.push("No snippet data available");
      return { isValid: false, errors, warnings };
    }

    // Validate trigger
    const trigger = this.getTrigger();
    if (!trigger) {
      errors.push("Trigger is required");
    } else if (trigger.length < 2) {
      errors.push("Trigger must be at least 2 characters");
    } else if (/\s/.test(trigger)) {
      errors.push("Trigger cannot contain spaces");
    }

    // Validate content
    const content = this.getContent();
    if (!content || !content.trim()) {
      errors.push("Content is required");
    }

    // Validate dependencies if enabled
    if (this.options.validateDependencies) {
      const dependencyErrors = this.validateDependencies();
      errors.push(...dependencyErrors);
    }

    // Validate variables
    const variableErrors = this.validateVariables();
    errors.push(...variableErrors);

    this.validationErrors = errors;
    this.displayValidationMessages(errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate dependencies
   */
  private validateDependencies(): string[] {
    const errors: string[] = [];

    if (!this.currentSnippet) return errors;

    const availableTriggers = this.originalTierData.snippets.map(
      (s) => s.trigger,
    );

    for (const dep of this.currentSnippet.snipDependencies) {
      if (!availableTriggers.includes(dep)) {
        errors.push(`Dependency '${dep}' not found in tier`);
      }
    }

    // Check for circular dependencies
    if (this.hasCircularDependencies()) {
      errors.push("Circular dependency detected");
    }

    return errors;
  }

  /**
   * Check for circular dependencies
   */
  private hasCircularDependencies(): boolean {
    if (!this.currentSnippet) return false;

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (trigger: string): boolean => {
      if (recursionStack.has(trigger)) return true;
      if (visited.has(trigger)) return false;

      visited.add(trigger);
      recursionStack.add(trigger);

      const snippet = this.originalTierData.snippets.find(
        (s) => s.trigger === trigger,
      );
      if (snippet) {
        for (const dep of snippet.snipDependencies) {
          if (hasCycle(dep)) return true;
        }
      }

      recursionStack.delete(trigger);
      return false;
    };

    return hasCycle(this.currentSnippet.trigger);
  }

  /**
   * Validate variables
   */
  private validateVariables(): string[] {
    const errors: string[] = [];

    if (!this.currentSnippet) return errors;

    for (const variable of this.currentSnippet.variables) {
      if (!variable.name) {
        errors.push("Variable name cannot be empty");
      } else if (/\s/.test(variable.name)) {
        errors.push("Variable name cannot contain spaces");
      } else if (!/^[a-zA-Z]/.test(variable.name)) {
        errors.push("Variable name must start with a letter");
      }
    }

    return errors;
  }

  /**
   * Display validation messages
   */
  private displayValidationMessages(
    errors: string[],
    warnings: string[],
  ): void {
    const messagesContainer = this.container?.querySelector(
      "#validation-messages",
    ) as HTMLElement;
    if (!messagesContainer) return;

    if (errors.length === 0 && warnings.length === 0) {
      messagesContainer.style.display = "none";
      return;
    }

    messagesContainer.innerHTML = `
      ${
        errors.length > 0
          ? `
        <div class="validation-errors">
          <h4>Please fix the following errors:</h4>
          <ul>
            ${errors.map((error) => `<li>${error}</li>`).join("")}
          </ul>
        </div>
      `
          : ""
      }
      
      ${
        warnings.length > 0
          ? `
        <div class="validation-warnings">
          <h4>Warnings:</h4>
          <ul>
            ${warnings.map((warning) => `<li>${warning}</li>`).join("")}
          </ul>
        </div>
      `
          : ""
      }
    `;

    messagesContainer.style.display = "block";
  }

  /**
   * Save the snippet and return result
   */
  async save(): Promise<SnippetEditResult> {
    try {
      const validation = this.validate();
      if (!validation.isValid) {
        return {
          success: false,
          snippet: this.currentSnippet!,
          updatedTierData: this.originalTierData,
          errors: validation.errors,
          warnings: validation.warnings,
        };
      }

      // Update current snippet with form data
      this.updateSnippetFromForm();

      // Create updated tier data
      const updatedTierData = this.createUpdatedTierData();

      const selectedStoresArray = this.options.showStoreSelector
        ? Array.from(this.selectedStores)
        : undefined;

      // DEBUG: Log selected stores at save time
      console.log("🔍 [EDITOR-DEBUG] Creating save result:", {
        showStoreSelector: this.options.showStoreSelector,
        selectedStoresSet: this.selectedStores,
        selectedStoresArray: selectedStoresArray,
        selectedStoresCount: selectedStoresArray?.length || 0,
      });

      const result: SnippetEditResult = {
        success: true,
        snippet: this.currentSnippet!,
        updatedTierData,
        selectedStores: selectedStoresArray,
        errors: [],
        warnings: validation.warnings,
      };

      if (this.options.onSave) {
        await this.options.onSave(result);
      }

      this.isDirty = false;
      return result;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";

      if (this.options.onError) {
        this.options.onError(error as Error);
      }

      return {
        success: false,
        snippet: this.currentSnippet!,
        updatedTierData: this.originalTierData,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Update snippet with current form data
   */
  private updateSnippetFromForm(): void {
    if (!this.currentSnippet) return;

    console.log("🔍 [SNIPPET-DEBUG] Updating snippet from form data...");
    console.log("🔍 [SNIPPET-DEBUG] Editor exists:", !!this.editor);
    console.log("🔍 [SNIPPET-DEBUG] Editor is ready:", this.editor?.isReady());

    const trigger = this.getTrigger();
    const content = this.getContent();
    const description = this.getDescription();

    console.log("🔍 [SNIPPET-DEBUG] Form values extracted:");
    console.log("  - Trigger:", trigger);
    console.log(
      "  - Content:",
      content ? `"${content.substring(0, 100)}..."` : "(empty/undefined)",
    );
    console.log("  - Content length:", content?.length || 0);
    console.log("  - Description:", description);

    this.currentSnippet.trigger = trigger;
    this.currentSnippet.content = content;
    this.currentSnippet.description = description;
    this.currentSnippet.contentType = this.getContentType() as any;
    this.currentSnippet.scope = this.getScope();
    this.currentSnippet.tags = this.getTags();
    this.currentSnippet.createdBy =
      this.formElements.createdByInput?.value || this.currentSnippet.createdBy;
    this.currentSnippet.updatedBy =
      this.formElements.updatedByInput?.value || this.currentSnippet.updatedBy;
    this.currentSnippet.updatedAt = new Date().toISOString();

    console.log("🔍 [SNIPPET-DEBUG] Final snippet data:");
    console.log("  - ID:", this.currentSnippet.id);
    console.log("  - Trigger:", this.currentSnippet.trigger);
    console.log(
      "  - Content:",
      this.currentSnippet.content
        ? `"${this.currentSnippet.content.substring(0, 100)}..."`
        : "(empty/undefined)",
    );
    console.log(
      "  - Content length:",
      this.currentSnippet.content?.length || 0,
    );
  }

  /**
   * Create updated tier data with the current snippet
   */
  private createUpdatedTierData(): TierStorageSchema {
    const updatedTierData = JSON.parse(JSON.stringify(this.originalTierData));

    if (this.options.mode === "create") {
      // Add new snippet
      updatedTierData.snippets.push(this.currentSnippet!);
    } else {
      // Update existing snippet
      const index = updatedTierData.snippets.findIndex(
        (s: any) => s.id === this.currentSnippet!.id,
      );
      if (index !== -1) {
        updatedTierData.snippets[index] = this.currentSnippet!;
      }
    }

    // Update metadata
    updatedTierData.metadata.modified = new Date().toISOString();

    return updatedTierData;
  }

  /**
   * Handle cancel action
   */
  private handleCancel(): void {
    if (this.isDirty) {
      const confirmed = confirm(
        "You have unsaved changes. Are you sure you want to cancel?",
      );
      if (!confirmed) return;
    }

    // Implement cancel logic (close modal, redirect, etc.)
    this.container?.dispatchEvent(new CustomEvent("cancel"));
  }

  /**
   * Insert variable placeholder
   */
  private insertVariable(): void {
    if (!this.editor) return;

    const variableName = prompt("Enter variable name:");
    if (variableName && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(variableName)) {
      this.editor.insertContent(`\${${variableName}}`);
    } else if (variableName) {
      alert(
        "Variable name must start with a letter and contain only letters, numbers, and underscores.",
      );
    }
  }

  /**
   * Preview content
   */
  private previewContent(): void {
    const content = this.getContent();

    // Create preview window
    const previewWindow = window.open("", "preview", "width=600,height=400");
    if (previewWindow) {
      previewWindow.document.write(`
        <html>
          <head><title>Snippet Preview</title></head>
          <body>
            <h2>Preview: ${this.getTrigger()}</h2>
            <div>${content}</div>
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  }

  /**
   * Show content type conversion dialog
   */
  private showContentTypeConversionDialog(): void {
    // This would open a modal for content conversion options
    alert("Content type conversion dialog would open here");
  }

  /**
   * Show add variable dialog
   */
  private showAddVariableDialog(): void {
    const name = window.prompt("Variable name:");
    const promptText = name ? window.prompt("Prompt text:") : null;

    if (name && promptText) {
      this.addVariable({ name, prompt: promptText });
    }
  }

  /**
   * Add dependency
   */
  private addDependency(): void {
    const input = this.formElements.dependenciesContainer?.querySelector(
      ".dependency-input",
    ) as HTMLInputElement;
    if (input && input.value.trim()) {
      this.addSnipDependency(input.value.trim());
      input.value = "";
    }
  }

  /**
   * Handle add image button click - reads from input and adds image
   */
  private handleAddImageClick(): void {
    const input = this.formElements.imagesContainer?.querySelector(
      ".image-input",
    ) as HTMLInputElement;
    if (input && input.value.trim()) {
      this.addImage(input.value.trim());
      input.value = "";
    }
  }

  // Public API methods for programmatic access

  getTrigger(): string {
    return this.formElements.triggerInput?.value.trim() || "";
  }

  setTrigger(trigger: string): void {
    if (this.formElements.triggerInput) {
      this.formElements.triggerInput.value = trigger;
      this.isDirty = true;
    }
  }

  getContent(): string {
    console.log("🔍 [CONTENT-DEBUG] getContent() called");
    console.log("🔍 [CONTENT-DEBUG] Editor exists:", !!this.editor);
    console.log("🔍 [CONTENT-DEBUG] Editor is ready:", this.editor?.isReady());

    const content = this.editor?.getContent() || "";
    console.log(
      "🔍 [CONTENT-DEBUG] Editor returned content:",
      content ? `"${content.substring(0, 100)}..."` : "(empty/undefined)",
    );
    console.log("🔍 [CONTENT-DEBUG] Content length:", content.length);

    return content;
  }

  setContent(content: string): void {
    if (this.editor) {
      this.editor.setContent(content);
      this.isDirty = true;
    }
  }

  getDescription(): string {
    return this.formElements.descriptionInput?.value.trim() || "";
  }

  setDescription(description: string): void {
    if (this.formElements.descriptionInput) {
      this.formElements.descriptionInput.value = description;
      this.isDirty = true;
    }
  }

  getContentType(): string {
    return this.formElements.contentTypeSelect?.value || "html";
  }

  setContentType(contentType: string): void {
    const validTypes = ["html", "plaintext", "markdown", "latex", "html+KaTeX"];
    if (!validTypes.includes(contentType)) {
      throw new Error("Invalid content type");
    }

    if (this.formElements.contentTypeSelect) {
      this.formElements.contentTypeSelect.value = contentType;
      this.handleContentTypeChange();
    }
  }

  getScope(): PriorityTier {
    return (this.formElements.scopeSelect?.value as PriorityTier) || "personal";
  }

  setScope(scope: PriorityTier): void {
    if (this.formElements.scopeSelect) {
      this.formElements.scopeSelect.value = scope;
      this.isDirty = true;
    }
  }

  getTags(): string[] {
    const tagsStr = this.formElements.tagsInput?.value.trim() || "";
    return tagsStr
      ? tagsStr
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag)
      : [];
  }

  setTags(tags: string[]): void {
    if (this.formElements.tagsInput) {
      this.formElements.tagsInput.value = tags.join(", ");
      this.isDirty = true;
    }
  }

  addTag(tag: string): void {
    const currentTags = this.getTags();
    if (!currentTags.includes(tag)) {
      this.setTags([...currentTags, tag]);
    }
  }

  removeTag(tag: string): void {
    const currentTags = this.getTags();
    this.setTags(currentTags.filter((t) => t !== tag));
  }

  getVariables(): VariableDef[] {
    return this.currentSnippet?.variables || [];
  }

  addVariable(variable: VariableDef): void {
    if (!this.currentSnippet) return;

    // Validate variable name
    if (!variable.name) {
      throw new Error("Variable name cannot be empty");
    }
    if (/\s/.test(variable.name)) {
      throw new Error("Variable name cannot contain spaces");
    }
    if (!/^[a-zA-Z]/.test(variable.name)) {
      throw new Error("Variable name must start with a letter");
    }

    // Check for duplicates
    const exists = this.currentSnippet.variables.some(
      (v) => v.name === variable.name,
    );
    if (!exists) {
      this.currentSnippet.variables.push(variable);
      this.updateVariablesDisplay();
      this.isDirty = true;
    }
  }

  updateVariable(name: string, variable: VariableDef): void {
    if (!this.currentSnippet) return;

    const index = this.currentSnippet.variables.findIndex(
      (v) => v.name === name,
    );
    if (index !== -1) {
      this.currentSnippet.variables[index] = variable;
      this.updateVariablesDisplay();
      this.isDirty = true;
    }
  }

  removeVariable(name: string): void {
    if (!this.currentSnippet) return;

    this.currentSnippet.variables = this.currentSnippet.variables.filter(
      (v) => v.name !== name,
    );
    this.updateVariablesDisplay();
    this.isDirty = true;
  }

  getSnipDependencies(): string[] {
    return this.currentSnippet?.snipDependencies || [];
  }

  addSnipDependency(trigger: string): void {
    if (!this.currentSnippet) return;

    if (!this.currentSnippet.snipDependencies.includes(trigger)) {
      this.currentSnippet.snipDependencies.push(trigger);
      this.updateDependenciesDisplay();
      this.isDirty = true;
    }
  }

  removeSnipDependency(trigger: string): void {
    if (!this.currentSnippet) return;

    this.currentSnippet.snipDependencies =
      this.currentSnippet.snipDependencies.filter((dep) => dep !== trigger);
    this.updateDependenciesDisplay();
    this.isDirty = true;
  }

  getImages(): string[] {
    return this.currentSnippet?.images || [];
  }

  addImage(imageUrl: string): void {
    if (!this.currentSnippet) return;

    if (!this.currentSnippet.images.includes(imageUrl)) {
      this.currentSnippet.images.push(imageUrl);
      this.updateImagesDisplay();
      this.isDirty = true;
    }
  }

  removeImage(imageUrl: string): void {
    if (!this.currentSnippet) return;

    this.currentSnippet.images = this.currentSnippet.images.filter(
      (img) => img !== imageUrl,
    );
    this.updateImagesDisplay();
    this.isDirty = true;
  }

  getCurrentSnippet(): EnhancedSnippet | null {
    return this.currentSnippet;
  }

  getSimpleEditor(): SimpleEditor | null {
    return this.editor;
  }

  /**
   * Render the multi-store selector interface
   */
  private renderStoreSelector(): string {
    if (
      !this.options.availableStores ||
      this.options.availableStores.length === 0
    ) {
      return `<span class="no-stores">No stores available</span>`;
    }

    const selectedCount = this.selectedStores.size;
    const totalCount = this.options.availableStores.length;

    return `
      <div class="store-selector" style="border: 1px solid #ddd; border-radius: 6px; padding: 16px; background: white; margin: 8px 0;">
        <div class="store-selector-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: #333;">Select Target Stores</h4>
          <div class="store-selector-summary" style="font-size: 13px; color: #0066cc; font-weight: 500; background: #f0f8ff; padding: 2px 8px; border-radius: 12px;">
            ${selectedCount} of ${totalCount} selected
          </div>
        </div>
        <div class="store-checkboxes" style="max-height: 140px; overflow-y: auto; margin-bottom: 12px;">
          ${this.options.availableStores
            .map(
              (store) => `
            <label class="store-checkbox" data-store-id="${store.storeId}" style="display: block; padding: 8px; cursor: pointer; margin: 2px 0; border-radius: 4px; border: 1px solid #f0f0f0; background: #fafafa;">
              <input 
                type="checkbox" 
                value="${store.storeId}"
                ${this.selectedStores.has(store.storeId) ? "checked" : ""}
                data-store-id="${store.storeId}"
                style="margin-right: 12px; transform: scale(1.2); accent-color: #0066cc;"
              />
              <div class="store-info" style="display: inline-block; vertical-align: top;">
                <div class="store-name" style="font-weight: 600; font-size: 14px; color: #333; margin-bottom: 3px;">${store.displayName}</div>
                <div class="store-details" style="font-size: 12px; color: #666; margin-top: 3px;">
                  <span class="store-tier" style="text-transform: capitalize; margin-right: 12px; color: #0066cc; font-weight: 500; background: #f0f8ff; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${store.tierName}</span>
                  <span class="store-count" style="margin-right: 12px; color: #666;">${store.snippetCount} snippets</span>
                  ${store.isReadOnly ? '<span class="read-only-badge" style="background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500;">Read-only</span>' : ""}
                </div>
              </div>
            </label>
          `,
            )
            .join("")}
        </div>
        <div class="store-selector-actions" style="display: flex; gap: 8px;">
          <button type="button" class="btn-small btn-secondary" data-action="select-all-stores" style="padding: 6px 12px; font-size: 12px; border: 1px solid #0066cc; background: #f0f8ff; color: #0066cc; border-radius: 4px; cursor: pointer; font-weight: 500;">Select All</button>
          <button type="button" class="btn-small btn-secondary" data-action="select-writable-stores" style="padding: 6px 12px; font-size: 12px; border: 1px solid #0066cc; background: #f0f8ff; color: #0066cc; border-radius: 4px; cursor: pointer; font-weight: 500;">Writable Only</button>
          <button type="button" class="btn-small btn-secondary" data-action="clear-store-selection" style="padding: 6px 12px; font-size: 12px; border: 1px solid #999; background: #f8f8f8; color: #666; border-radius: 4px; cursor: pointer; font-weight: 500;">Clear</button>
        </div>
      </div>
    `;
  }

  /**
   * Handle individual store selection change
   */
  private handleStoreSelectionChange(
    storeId: string,
    isSelected: boolean,
  ): void {
    console.log("🔍 [STORE-DEBUG] Updating store selection:", {
      storeId,
      isSelected,
      currentSelectedStores: Array.from(this.selectedStores),
    });

    if (isSelected) {
      this.selectedStores.add(storeId);
    } else {
      this.selectedStores.delete(storeId);
    }

    console.log(
      "🔍 [STORE-DEBUG] Updated selected stores:",
      Array.from(this.selectedStores),
    );

    this.updateStoreSelectorSummary();
    this.isDirty = true;
  }

  /**
   * Select all available stores
   */
  private selectAllStores(): void {
    if (!this.options.availableStores) return;

    this.options.availableStores.forEach((store) => {
      this.selectedStores.add(store.storeId);
    });
    this.updateStoreCheckboxes();
    this.updateStoreSelectorSummary();
    this.isDirty = true;
  }

  /**
   * Select only writable stores
   */
  private selectWritableStores(): void {
    if (!this.options.availableStores) return;

    this.selectedStores.clear();
    this.options.availableStores.forEach((store) => {
      if (!store.isReadOnly) {
        this.selectedStores.add(store.storeId);
      }
    });
    this.updateStoreCheckboxes();
    this.updateStoreSelectorSummary();
    this.isDirty = true;
  }

  /**
   * Clear all store selections
   */
  private clearStoreSelection(): void {
    this.selectedStores.clear();
    this.updateStoreCheckboxes();
    this.updateStoreSelectorSummary();
    this.isDirty = true;
  }

  /**
   * Update store checkboxes to reflect current selection
   */
  private updateStoreCheckboxes(): void {
    if (!this.container) return;

    const checkboxes = this.container.querySelectorAll(
      '.store-selector input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      const storeId = checkbox.dataset.storeId;
      if (storeId) {
        checkbox.checked = this.selectedStores.has(storeId);
      }
    });
  }

  /**
   * Update the store selector summary
   */
  private updateStoreSelectorSummary(): void {
    if (!this.container || !this.options.availableStores) return;

    const summaryElement = this.container.querySelector(
      ".store-selector-summary",
    );
    if (summaryElement) {
      const selectedCount = this.selectedStores.size;
      const totalCount = this.options.availableStores.length;
      summaryElement.textContent = `${selectedCount} of ${totalCount} stores selected`;
    }
  }

  /**
   * Destroy the editor and clean up resources
   */
  async destroy(): Promise<void> {
    if (this.editor) {
      await this.editor.destroy();
      this.editor = null;
    }

    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }

    this.formElements = {};
    this.currentSnippet = null;
    this.isInitialized = false;
    this.isDirty = false;
  }
}
