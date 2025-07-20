/**
 * Snippet Editor Component
 * Provides a complete interface for editing snippets with TinyMCE integration
 */

import {
  TinyMCEWrapper,
  createSnippetEditor,
} from "../../editor/tinymce-wrapper.js";
import type { TextSnippet } from "../../shared/types.js";
import type {
  SnippetMeta,
  EnhancedSnippet,
  VariableDef,
} from "../../types/snippet-formats.js";
import type {
  PriorityTier,
  TierStorageSchema,
} from "../../types/snippet-formats.js";
import {
  MultiFileSelector,
  type MultiFileSelection,
  type TierStoreInfo,
} from "./multi-file-selector.js";

export interface SnippetEditorOptions {
  snippet?: TextSnippet | EnhancedSnippet;
  mode?: "create" | "edit";
  allowedTiers?: PriorityTier[];
  availableStores?: { [tier: string]: TierStoreInfo[] };
  enableMultiFileSelection?: boolean;
  onSave?: (
    snippet: TextSnippet | EnhancedSnippet,
    targetStores?: MultiFileSelection[],
  ) => Promise<void>;
  onCancel?: () => void;
  onValidationError?: (errors: string[]) => void;
  compact?: boolean;
  supportAllFields?: boolean; // Enable comprehensive field support
}

export interface SnippetValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Complete snippet editing interface with TinyMCE editor
 */
export class SnippetEditor {
  private container: HTMLElement | null = null;
  private editor: TinyMCEWrapper | null = null;
  private multiFileSelector: MultiFileSelector | null = null;
  private formElements: {
    triggerInput?: HTMLInputElement;
    titleInput?: HTMLInputElement;
    descriptionInput?: HTMLTextAreaElement;
    tierSelect?: HTMLSelectElement;
    storeSelect?: HTMLSelectElement;
    priorityInput?: HTMLInputElement;
    contentTypeSelect?: HTMLSelectElement;
    editorContainer?: HTMLElement;
    variablesContainer?: HTMLElement;
    previewContainer?: HTMLElement;
    multiFileSelectorContainer?: HTMLElement;
    // Enhanced fields
    snipDependenciesInput?: HTMLInputElement;
    tagsInput?: HTMLInputElement;
    imagesContainer?: HTMLElement;
    createdByInput?: HTMLInputElement;
    updatedByInput?: HTMLInputElement;
    idInput?: HTMLInputElement;
  } = {};

  private currentSnippet: TextSnippet | EnhancedSnippet | null = null;
  private options: SnippetEditorOptions;
  private isInitialized = false;
  private isDirty = false;
  private validationErrors: string[] = [];
  private selectedTargetStores: MultiFileSelection[] = [];

  constructor(options: SnippetEditorOptions = {}) {
    this.options = {
      mode: "create",
      allowedTiers: ["personal", "team", "org"],
      availableStores: {},
      enableMultiFileSelection: false,
      compact: false,
      supportAllFields: false,
      ...options,
    };

    if (options.snippet) {
      this.currentSnippet = { ...options.snippet };
    }
  }

  /**
   * Initialize the snippet editor in the specified container
   */
  async init(container: HTMLElement): Promise<void> {
    if (this.isInitialized) {
      throw new Error("Snippet editor already initialized");
    }

    this.container = container;
    this.createEditorInterface();
    await this.initializeTinyMCE();

    if (this.options.enableMultiFileSelection) {
      await this.initializeMultiFileSelector();
    }

    this.setupEventHandlers();
    this.loadSnippetData();
    this.isInitialized = true;
  }

  /**
   * Create the complete editor interface
   */
  private createEditorInterface(): void {
    if (!this.container) return;

    const isEdit = this.options.mode === "edit";
    const isCompact = this.options.compact;

    this.container.innerHTML = `
      <div class="snippet-editor ${isCompact ? "compact" : ""}">
        <div class="editor-header">
          <h2 class="editor-title">
            ${isEdit ? "Edit Snippet" : "Create New Snippet"}
          </h2>
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
          <!-- Basic Information Section -->
          <div class="form-section">
            <h3 class="section-title">Basic Information</h3>
            
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
                <div class="form-help">The text that will trigger this snippet expansion</div>
              </div>
              
              <div class="form-group">
                <label for="snippet-title">Title</label>
                <input 
                  type="text" 
                  id="snippet-title" 
                  name="title"
                  placeholder="Brief description of the snippet"
                  autocomplete="off"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="snippet-description">Description</label>
              <textarea 
                id="snippet-description" 
                name="description"
                rows="2"
                placeholder="Optional detailed description"
              ></textarea>
            </div>

            ${
              this.options.supportAllFields
                ? `
            <div class="form-row">
              <div class="form-group">
                <label for="snippet-id">ID</label>
                <input 
                  type="text" 
                  id="snippet-id" 
                  name="id"
                  placeholder="Auto-generated if empty"
                  autocomplete="off"
                />
                <div class="form-help">Unique identifier for this snippet</div>
              </div>
              
              <div class="form-group">
                <label for="snippet-tags">Tags</label>
                <input 
                  type="text" 
                  id="snippet-tags" 
                  name="tags"
                  placeholder="tag1, tag2, tag3"
                  autocomplete="off"
                />
                <div class="form-help">Comma-separated tags for categorization</div>
              </div>
            </div>

            <div class="form-group">
              <label for="snip-dependencies">Dependencies</label>
              <input 
                type="text" 
                id="snip-dependencies" 
                name="snipDependencies"
                placeholder="store:trigger:id, store:trigger:id"
                autocomplete="off"
              />
              <div class="form-help">Dependencies in format: store-name:trigger:id</div>
            </div>
            `
                : ""
            }
          </div>

          <!-- Organization Section -->
          <div class="form-section">
            <h3 class="section-title">Organization</h3>
            
            ${
              this.options.enableMultiFileSelection
                ? ""
                : `
              <div class="form-row">
                <div class="form-group required">
                  <label for="snippet-tier">Tier</label>
                  <select id="snippet-tier" name="tier" required>
                    ${
                      this.options.allowedTiers
                        ?.map(
                          (tier) =>
                            `<option value="${tier}">${tier.charAt(0).toUpperCase() + tier.slice(1)}</option>`,
                        )
                        .join("") || ""
                    }
                  </select>
                  <div class="form-help">Choose the appropriate tier for this snippet</div>
                </div>
                
                <div class="form-group required">
                  <label for="snippet-store">Store</label>
                  <select id="snippet-store" name="store" required>
                    <option value="">Select a store...</option>
                  </select>
                  <div class="form-help">Choose which JSON store to save this snippet to</div>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="snippet-priority">Priority</label>
                  <input 
                    type="number" 
                    id="snippet-priority" 
                    name="priority"
                    min="1"
                    max="1000"
                    value="100"
                  />
                  <div class="form-help">Higher numbers have higher priority (1-1000)</div>
                </div>
              </div>
            `
            }
            
            ${
              this.options.enableMultiFileSelection
                ? `
              <div class="multi-file-section">
                <div class="form-help">
                  This snippet will be saved to multiple stores. Use the interface below to select target stores and configure priorities.
                </div>
                <div id="multi-file-selector-container">
                  <!-- Multi-file selector will be initialized here -->
                </div>
              </div>
            `
                : ""
            }
          </div>

          <!-- Content Section -->
          <div class="form-section">
            <h3 class="section-title">Content</h3>
            
            <div class="form-group">
              <label for="content-type">Content Type</label>
              <select id="content-type" name="contentType">
                <option value="html">HTML (Rich Text)</option>
                <option value="plaintext">Plain Text</option>
                <option value="markdown">Markdown</option>
                <option value="latex">LaTeX</option>
                <option value="html+KaTeX">HTML with KaTeX</option>
              </select>
            </div>

            <div class="form-group editor-group required">
              <label for="snippet-content">Content</label>
              <div id="tinymce-container" class="editor-container"></div>
              <div class="editor-toolbar">
                <button type="button" class="btn btn-sm" data-action="insert-variable">
                  Insert Variable
                </button>
                <button type="button" class="btn btn-sm" data-action="preview">
                  Preview
                </button>
                <button type="button" class="btn btn-sm" data-action="test">
                  Test Expansion
                </button>
              </div>
            </div>
          </div>

          ${
            this.options.supportAllFields
              ? `
          <!-- Images Section -->
          <div class="form-section">
            <h3 class="section-title">Images</h3>
            <div id="images-container">
              <div class="form-help">
                Images referenced in your content will appear here. You can add Drive file IDs or data URIs.
              </div>
              <div class="image-upload-area">
                <button type="button" class="btn btn-sm" data-action="add-image">
                  Add Image Reference
                </button>
              </div>
            </div>
          </div>

          <!-- Metadata Section -->
          <div class="form-section">
            <h3 class="section-title">Metadata</h3>
            <div class="form-row">
              <div class="form-group">
                <label for="created-by">Created By</label>
                <input 
                  type="text" 
                  id="created-by" 
                  name="createdBy"
                  placeholder="Author name or email"
                  autocomplete="off"
                />
              </div>
              
              <div class="form-group">
                <label for="updated-by">Updated By</label>
                <input 
                  type="text" 
                  id="updated-by" 
                  name="updatedBy"
                  placeholder="Last editor name or email"
                  autocomplete="off"
                />
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>Created At</label>
                <input type="text" readonly class="readonly-field" id="created-at-display" />
              </div>
              
              <div class="form-group">
                <label>Updated At</label>
                <input type="text" readonly class="readonly-field" id="updated-at-display" />
              </div>
            </div>
          </div>
          `
              : ""
          }

          <!-- Variables Section -->
          <div class="form-section" id="variables-section" style="display: none;">
            <h3 class="section-title">Variables</h3>
            <div id="variables-container">
              <div class="form-help">
                Variables detected in your content will appear here for documentation.
              </div>
            </div>
          </div>

          <!-- Preview Section -->
          <div class="form-section" id="preview-section" style="display: none;">
            <h3 class="section-title">Preview</h3>
            <div id="preview-container" class="preview-content">
              <!-- Preview content will be rendered here -->
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
    this.formElements = {
      triggerInput: this.container.querySelector(
        "#snippet-trigger",
      ) as HTMLInputElement,
      titleInput: this.container.querySelector(
        "#snippet-title",
      ) as HTMLInputElement,
      descriptionInput: this.container.querySelector(
        "#snippet-description",
      ) as HTMLTextAreaElement,
      tierSelect: this.container.querySelector(
        "#snippet-tier",
      ) as HTMLSelectElement,
      storeSelect: this.container.querySelector(
        "#snippet-store",
      ) as HTMLSelectElement,
      priorityInput: this.container.querySelector(
        "#snippet-priority",
      ) as HTMLInputElement,
      contentTypeSelect: this.container.querySelector(
        "#content-type",
      ) as HTMLSelectElement,
      editorContainer: this.container.querySelector(
        "#tinymce-container",
      ) as HTMLElement,
      variablesContainer: this.container.querySelector(
        "#variables-container",
      ) as HTMLElement,
      previewContainer: this.container.querySelector(
        "#preview-container",
      ) as HTMLElement,
      multiFileSelectorContainer: this.container.querySelector(
        "#multi-file-selector-container",
      ) as HTMLElement,
      // Enhanced fields
      snipDependenciesInput: this.container.querySelector(
        "#snip-dependencies",
      ) as HTMLInputElement,
      tagsInput: this.container.querySelector(
        "#snippet-tags",
      ) as HTMLInputElement,
      imagesContainer: this.container.querySelector(
        "#images-container",
      ) as HTMLElement,
      createdByInput: this.container.querySelector(
        "#created-by",
      ) as HTMLInputElement,
      updatedByInput: this.container.querySelector(
        "#updated-by",
      ) as HTMLInputElement,
      idInput: this.container.querySelector("#snippet-id") as HTMLInputElement,
    };
  }

  /**
   * Initialize TinyMCE editor
   */
  private async initializeTinyMCE(): Promise<void> {
    if (!this.formElements.editorContainer) return;

    const initialContent = this.currentSnippet?.content || "";

    this.editor = createSnippetEditor(this.formElements.editorContainer, {
      config: {
        height: this.options.compact ? 200 : 300,
      },
      events: {
        onContentChange: (content) => {
          this.handleContentChange(content);
        },
        onFocus: () => {
          this.formElements.editorContainer?.classList.add("focused");
        },
        onBlur: () => {
          this.formElements.editorContainer?.classList.remove("focused");
        },
      },
      autoFocus: this.options.mode === "create",
    });

    await this.editor.init(this.formElements.editorContainer, initialContent);
  }

  /**
   * Initialize multi-file selector
   */
  private async initializeMultiFileSelector(): Promise<void> {
    if (
      !this.formElements.multiFileSelectorContainer ||
      !this.options.availableStores
    ) {
      return;
    }

    this.multiFileSelector = new MultiFileSelector({
      availableStores: this.options.availableStores,
      allowConflictResolution: true,
      maxSelections: 5,
      onSelectionChange: (selections) => {
        this.selectedTargetStores = selections;
        this.isDirty = true;
        this.validateForm();
      },
      onValidationError: (errors) => {
        this.validationErrors = [...this.validationErrors, ...errors];
        if (this.options.onValidationError) {
          this.options.onValidationError(this.validationErrors);
        }
      },
    });

    await this.multiFileSelector.init(
      this.formElements.multiFileSelectorContainer,
    );
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
        this.validateForm();
      });
    });

    // Action button handlers
    const actionButtons = this.container.querySelectorAll("[data-action]");
    actionButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const action = (button as HTMLElement).dataset.action;
        this.handleAction(action || "");
      });
    });

    // Content type change handler
    if (this.formElements.contentTypeSelect) {
      this.formElements.contentTypeSelect.addEventListener("change", () => {
        this.handleContentTypeChange();
      });
    }

    // Trigger input validation
    if (this.formElements.triggerInput) {
      this.formElements.triggerInput.addEventListener("blur", () => {
        this.validateTrigger();
      });
    }

    // Tier selection change handler
    if (this.formElements.tierSelect) {
      this.formElements.tierSelect.addEventListener("change", () => {
        this.handleTierChange();
      });
    }
  }

  /**
   * Load snippet data into form fields
   */
  private loadSnippetData(): void {
    if (!this.currentSnippet) return;

    const snippet = this.currentSnippet;

    // Basic fields
    if (this.formElements.triggerInput)
      this.formElements.triggerInput.value = snippet.trigger || "";
    if (this.formElements.titleInput) this.formElements.titleInput.value = "";
    if (this.formElements.descriptionInput)
      this.formElements.descriptionInput.value = snippet.description || "";
    if (this.formElements.tierSelect)
      this.formElements.tierSelect.value = snippet.scope || "personal";
    if (this.formElements.priorityInput)
      this.formElements.priorityInput.value = String(
        (snippet as any).priority || 100,
      );
    if (this.formElements.contentTypeSelect)
      this.formElements.contentTypeSelect.value = snippet.contentType || "html";

    // Enhanced fields (if supportAllFields is enabled)
    if (this.options.supportAllFields) {
      // ID field
      if (this.formElements.idInput)
        this.formElements.idInput.value = snippet.id || "";

      // Tags field
      if (this.formElements.tagsInput && "tags" in snippet) {
        const tags = (snippet as EnhancedSnippet).tags || [];
        this.formElements.tagsInput.value = tags.join(", ");
      }

      // Dependencies field
      if (
        this.formElements.snipDependenciesInput &&
        "snipDependencies" in snippet
      ) {
        const deps = (snippet as EnhancedSnippet).snipDependencies || [];
        this.formElements.snipDependenciesInput.value = deps.join(", ");
      }

      // Metadata fields
      if (this.formElements.createdByInput && "createdBy" in snippet) {
        this.formElements.createdByInput.value =
          (snippet as EnhancedSnippet).createdBy || "";
      }
      if (this.formElements.updatedByInput && "updatedBy" in snippet) {
        this.formElements.updatedByInput.value =
          (snippet as EnhancedSnippet).updatedBy || "";
      }

      // Timestamp display fields
      const createdAtDisplay = this.container?.querySelector(
        "#created-at-display",
      ) as HTMLInputElement;
      const updatedAtDisplay = this.container?.querySelector(
        "#updated-at-display",
      ) as HTMLInputElement;

      if (createdAtDisplay && "createdAt" in snippet) {
        const createdAt =
          (snippet as EnhancedSnippet).createdAt || snippet.createdAt;
        createdAtDisplay.value =
          typeof createdAt === "string"
            ? createdAt
            : createdAt?.toISOString() || "";
      }
      if (updatedAtDisplay && "updatedAt" in snippet) {
        const updatedAt =
          (snippet as EnhancedSnippet).updatedAt || snippet.updatedAt;
        updatedAtDisplay.value =
          typeof updatedAt === "string"
            ? updatedAt
            : updatedAt?.toISOString() || "";
      }

      // Load images if present
      if ("images" in snippet) {
        this.loadImagesData((snippet as EnhancedSnippet).images || []);
      }
    }

    // Update store options based on tier selection
    this.handleTierChange();
  }

  /**
   * Handle content changes in the editor
   */
  private handleContentChange(content: string): void {
    this.isDirty = true;
    this.extractAndDisplayVariables(content);
    this.validateContent(content);
  }

  /**
   * Handle content type changes
   */
  private handleContentTypeChange(): void {
    const contentType = this.formElements.contentTypeSelect?.value;

    // Update editor configuration based on content type
    if (this.editor && contentType) {
      // This would involve reconfiguring the editor for different content types
      console.log("🔧 Content type changed to:", contentType);
    }
  }

  /**
   * Handle tier selection changes
   */
  private handleTierChange(): void {
    const selectedTier = this.formElements.tierSelect?.value as PriorityTier;
    if (!selectedTier || !this.formElements.storeSelect) return;

    const availableStores = this.options.availableStores?.[selectedTier] || [];

    // Clear existing options
    this.formElements.storeSelect.innerHTML =
      '<option value="">Select a store...</option>';

    // Add store options for selected tier
    availableStores.forEach((store) => {
      const option = document.createElement("option");
      option.value = store.fileName;

      // Format display name with additional info
      const displayText = this.formatStoreDisplayName(store);
      option.textContent = displayText;

      // Set default selection
      if (store.isDefault) {
        option.selected = true;
      }

      this.formElements.storeSelect?.appendChild(option);
    });

    // Add option to create new store
    if (availableStores.length > 0) {
      const newStoreOption = document.createElement("option");
      newStoreOption.value = "_new_store";
      newStoreOption.textContent = "+ Create new store...";
      this.formElements.storeSelect?.appendChild(newStoreOption);
    }
  }

  /**
   * Format store display name with metadata
   */
  private formatStoreDisplayName(store: TierStoreInfo): string {
    let displayName = store.displayName;

    // Add snippet count
    displayName += ` (${store.snippetCount} snippets)`;

    // Add storage type indicator
    if (store.isDriveFile) {
      displayName += " [Drive]";
    } else if (store.isLocal) {
      displayName += " [Local]";
    }

    // Add default indicator
    if (store.isDefault) {
      displayName += " *";
    }

    return displayName;
  }

  /**
   * Handle action button clicks
   */
  private async handleAction(action: string): Promise<void> {
    switch (action) {
      case "save":
        await this.handleSave();
        break;
      case "cancel":
        this.handleCancel();
        break;
      case "insert-variable":
        this.insertVariable();
        break;
      case "preview":
        this.togglePreview();
        break;
      case "test":
        await this.testExpansion();
        break;
      case "add-image":
        this.addImageReference();
        break;
    }
  }

  /**
   * Save the snippet
   */
  private async handleSave(): Promise<void> {
    const validation = this.validateForm();
    if (!validation.isValid) {
      this.displayValidationErrors(validation.errors);
      return;
    }

    const snippetData = this.collectFormData();
    if (!snippetData) return;

    try {
      if (this.options.onSave) {
        const targetStores = this.options.enableMultiFileSelection
          ? this.selectedTargetStores
          : undefined;
        await this.options.onSave(snippetData, targetStores);
      }
      this.isDirty = false;
    } catch (error) {
      console.error("❌ Failed to save snippet:", error);
      this.displayValidationErrors([
        "Failed to save snippet. Please try again.",
      ]);
    }
  }

  /**
   * Cancel editing
   */
  private handleCancel(): void {
    if (this.isDirty) {
      const confirmed = confirm(
        "You have unsaved changes. Are you sure you want to cancel?",
      );
      if (!confirmed) return;
    }

    if (this.options.onCancel) {
      this.options.onCancel();
    }
  }

  /**
   * Insert a variable placeholder
   */
  private insertVariable(): void {
    if (!this.editor) return;

    const variableName = prompt("Enter variable name:");
    if (variableName) {
      this.editor.insertContent(`\${${variableName}}`);
    }
  }

  /**
   * Toggle preview display
   */
  private togglePreview(): void {
    const previewSection = this.container?.querySelector(
      "#preview-section",
    ) as HTMLElement;
    if (!previewSection) return;

    const isVisible = previewSection.style.display !== "none";

    if (isVisible) {
      previewSection.style.display = "none";
    } else {
      this.updatePreview();
      previewSection.style.display = "block";
    }
  }

  /**
   * Test snippet expansion
   */
  private async testExpansion(): Promise<void> {
    const snippetData = this.collectFormData();
    if (!snippetData) return;

    // This would integrate with the trigger processor for testing
    console.log("🧪 Testing snippet expansion:", snippetData);
    alert("Test expansion functionality would be implemented here");
  }

  /**
   * Add image reference
   */
  private addImageReference(): void {
    const imageUrl = prompt("Enter image URL or Drive file ID:");
    if (imageUrl && this.formElements.imagesContainer) {
      this.addImageToList(imageUrl);
    }
  }

  /**
   * Add image to the images list
   */
  private addImageToList(imageUrl: string): void {
    if (!this.formElements.imagesContainer) return;

    const imageItem = document.createElement("div");
    imageItem.className = "image-item";
    imageItem.innerHTML = `
      <div class="image-info">
        <code>${imageUrl}</code>
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.parentElement.remove()">
          Remove
        </button>
      </div>
    `;

    const uploadArea =
      this.formElements.imagesContainer.querySelector(".image-upload-area");
    if (uploadArea) {
      uploadArea.parentElement?.insertBefore(imageItem, uploadArea);
    }
  }

  /**
   * Load images data into the images container
   */
  private loadImagesData(images: string[]): void {
    if (!this.formElements.imagesContainer) return;

    // Clear existing images
    const existingImages =
      this.formElements.imagesContainer.querySelectorAll(".image-item");
    existingImages.forEach((img) => img.remove());

    // Add each image
    images.forEach((imageUrl) => {
      this.addImageToList(imageUrl);
    });
  }

  /**
   * Collect images from the UI
   */
  private collectImages(): string[] {
    if (!this.formElements.imagesContainer) return [];

    const imageItems =
      this.formElements.imagesContainer.querySelectorAll(".image-item code");
    return Array.from(imageItems)
      .map((item) => item.textContent || "")
      .filter((url) => url.trim() !== "");
  }

  /**
   * Collect form data into snippet object
   */
  private collectFormData(): TextSnippet | EnhancedSnippet | null {
    if (!this.editor) return null;

    const trigger = this.formElements.triggerInput?.value?.trim();
    const title = this.formElements.titleInput?.value?.trim();
    const description = this.formElements.descriptionInput?.value?.trim();
    const tier = this.formElements.tierSelect?.value as PriorityTier;
    const store = this.formElements.storeSelect?.value;
    const priority = parseInt(this.formElements.priorityInput?.value || "100");
    const contentType = this.formElements.contentTypeSelect
      ?.value as SnippetMeta["contentType"];
    const content = this.editor.getContent();

    if (
      !trigger ||
      !content ||
      (!this.options.enableMultiFileSelection && (!tier || !store))
    )
      return null;

    if (this.options.supportAllFields) {
      // Create EnhancedSnippet with all fields
      const id =
        this.formElements.idInput?.value?.trim() ||
        this.currentSnippet?.id ||
        `snippet_${Date.now()}`;

      const tags =
        this.formElements.tagsInput?.value
          ?.split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0) || [];

      const snipDependencies =
        this.formElements.snipDependenciesInput?.value
          ?.split(",")
          .map((dep) => dep.trim())
          .filter((dep) => dep.length > 0) || [];

      const images = this.collectImages();

      const createdBy = this.formElements.createdByInput?.value?.trim() || "";
      const updatedBy = this.formElements.updatedByInput?.value?.trim() || "";

      const now = new Date().toISOString();
      const createdAt =
        this.currentSnippet && "createdAt" in this.currentSnippet
          ? typeof this.currentSnippet.createdAt === "string"
            ? this.currentSnippet.createdAt
            : this.currentSnippet.createdAt.toISOString()
          : now;

      const snippet: EnhancedSnippet = {
        id,
        trigger,
        content,
        contentType: contentType || "html",
        snipDependencies,
        description: description || "",
        scope: tier || "personal",
        variables: this.extractVariables(content).map((name) => ({
          name,
          prompt: name, // Use name as default prompt
        })),
        images,
        tags,
        createdAt,
        createdBy,
        updatedAt: now,
        updatedBy,
      };

      return snippet;
    } else {
      // Create standard TextSnippet
      const snippet: TextSnippet = {
        id: this.currentSnippet?.id || `snippet_${Date.now()}`,
        trigger,
        content,
        description: description || undefined,
        scope: tier as any, // Map tier to scope
        priority,
        contentType: (contentType === "html" ? "html" : "text") as any,
        createdAt: this.currentSnippet?.createdAt
          ? new Date(this.currentSnippet.createdAt)
          : new Date(),
        updatedAt: new Date(),
        lastUsed: (this.currentSnippet as any)?.lastUsed,
        usageCount: (this.currentSnippet as any)?.usageCount || 0,
        variables: this.extractVariables(content).map((name) => ({
          name,
          placeholder: name,
        })),
        // Add store selection to snippet metadata
        storeFileName: store,
      };

      return snippet;
    }
  }

  /**
   * Extract variables from content
   */
  private extractVariables(content: string): string[] {
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
   * Extract and display variables from content
   */
  private extractAndDisplayVariables(content: string): void {
    const variables = this.extractVariables(content);
    const variablesSection = this.container?.querySelector(
      "#variables-section",
    ) as HTMLElement;

    if (!variablesSection || !this.formElements.variablesContainer) return;

    if (variables.length === 0) {
      variablesSection.style.display = "none";
      return;
    }

    variablesSection.style.display = "block";
    this.formElements.variablesContainer.innerHTML = `
      <div class="variables-list">
        ${variables
          .map(
            (variable) => `
          <div class="variable-item">
            <code>\${${variable}}</code>
            <small>This variable will be prompted when the snippet is used</small>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  /**
   * Update preview content
   */
  private updatePreview(): void {
    if (!this.editor || !this.formElements.previewContainer) return;

    const content = this.editor.getContent();
    this.formElements.previewContainer.innerHTML = content;
  }

  /**
   * Validate the entire form
   */
  private validateForm(): SnippetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate trigger
    const trigger = this.formElements.triggerInput?.value?.trim();
    if (!trigger) {
      errors.push("Trigger is required");
    } else if (trigger.length < 2) {
      errors.push("Trigger must be at least 2 characters");
    }

    // Validate organization (tier/store or multi-file selection)
    if (this.options.enableMultiFileSelection) {
      // Validate multi-file selection
      if (this.selectedTargetStores.length === 0) {
        errors.push("At least one target store must be selected");
      }

      // Validate each selected store
      this.selectedTargetStores.forEach((store) => {
        if (store.priority < 1 || store.priority > 1000) {
          errors.push(
            `Priority for ${store.displayName} must be between 1 and 1000`,
          );
        }
      });
    } else {
      // Validate single tier/store selection
      const tier = this.formElements.tierSelect?.value;
      if (!tier) {
        errors.push("Tier is required");
      }

      const store = this.formElements.storeSelect?.value;
      if (!store) {
        errors.push("Store is required");
      }
    }

    // Validate content
    const content = this.editor?.getContent()?.trim();
    if (!content) {
      errors.push("Content is required");
    }

    // Validate priority
    const priority = parseInt(this.formElements.priorityInput?.value || "100");
    if (isNaN(priority) || priority < 1 || priority > 1000) {
      errors.push("Priority must be between 1 and 1000");
    }

    this.validationErrors = errors;
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate trigger input
   */
  private validateTrigger(): void {
    const trigger = this.formElements.triggerInput?.value?.trim();
    const triggerInput = this.formElements.triggerInput;

    if (!triggerInput) return;

    if (!trigger) {
      triggerInput.classList.add("error");
      triggerInput.title = "Trigger is required";
    } else if (trigger.length < 2) {
      triggerInput.classList.add("error");
      triggerInput.title = "Trigger must be at least 2 characters";
    } else {
      triggerInput.classList.remove("error");
      triggerInput.title = "";
    }
  }

  /**
   * Validate content
   */
  private validateContent(content: string): void {
    const editorContainer = this.formElements.editorContainer;
    if (!editorContainer) return;

    if (!content.trim()) {
      editorContainer.classList.add("error");
    } else {
      editorContainer.classList.remove("error");
    }
  }

  /**
   * Display validation errors
   */
  private displayValidationErrors(errors: string[]): void {
    const messagesContainer = this.container?.querySelector(
      "#validation-messages",
    ) as HTMLElement;
    if (!messagesContainer) return;

    if (errors.length === 0) {
      messagesContainer.style.display = "none";
      return;
    }

    messagesContainer.innerHTML = `
      <div class="validation-error">
        <h4>Please fix the following errors:</h4>
        <ul>
          ${errors.map((error) => `<li>${error}</li>`).join("")}
        </ul>
      </div>
    `;
    messagesContainer.style.display = "block";
  }

  /**
   * Get current snippet data
   */
  getSnippetData(): TextSnippet | EnhancedSnippet | null {
    return this.collectFormData();
  }

  /**
   * Check if form has unsaved changes
   */
  isDirtyForm(): boolean {
    return this.isDirty;
  }

  /**
   * Get selected target stores (for multi-file mode)
   */
  getSelectedTargetStores(): MultiFileSelection[] {
    return [...this.selectedTargetStores];
  }

  /**
   * Set selected target stores (for multi-file mode)
   */
  setSelectedTargetStores(stores: MultiFileSelection[]): void {
    if (this.multiFileSelector) {
      this.selectedTargetStores = stores;
      this.multiFileSelector.setSelections(stores);
    }
  }

  /**
   * Check if multi-file selection is enabled
   */
  isMultiFileMode(): boolean {
    return this.options.enableMultiFileSelection || false;
  }

  /**
   * Destroy the editor and clean up
   */
  async destroy(): Promise<void> {
    if (this.editor) {
      await this.editor.destroy();
      this.editor = null;
    }

    if (this.multiFileSelector) {
      this.multiFileSelector.destroy();
      this.multiFileSelector = null;
    }

    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }

    this.formElements = {};
    this.currentSnippet = null;
    this.selectedTargetStores = [];
    this.isInitialized = false;
    this.isDirty = false;
  }
}

/**
 * Create a snippet editor with default configuration
 */
export function createSnippetEditorComponent(
  container: HTMLElement,
  options: SnippetEditorOptions = {},
): SnippetEditor {
  const editor = new SnippetEditor(options);
  editor.init(container);
  return editor;
}
