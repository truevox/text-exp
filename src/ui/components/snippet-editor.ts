/**
 * Snippet Editor Component
 * Provides a complete interface for editing snippets with TinyMCE integration
 */

import { TinyMCEWrapper, createSnippetEditor } from '../../editor/tinymce-wrapper.js';
import type { TextSnippet } from '../../shared/types.js';
import type { SnippetMeta } from '../../types/snippet-formats.js';
import type { PriorityTier } from '../../types/snippet-formats.js';

export interface SnippetEditorOptions {
  snippet?: TextSnippet;
  mode?: 'create' | 'edit';
  allowedTiers?: PriorityTier[];
  onSave?: (snippet: TextSnippet) => Promise<void>;
  onCancel?: () => void;
  onValidationError?: (errors: string[]) => void;
  compact?: boolean;
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
  private formElements: {
    triggerInput?: HTMLInputElement;
    titleInput?: HTMLInputElement;
    descriptionInput?: HTMLTextAreaElement;
    tierSelect?: HTMLSelectElement;
    priorityInput?: HTMLInputElement;
    contentTypeSelect?: HTMLSelectElement;
    editorContainer?: HTMLElement;
    variablesContainer?: HTMLElement;
    previewContainer?: HTMLElement;
  } = {};
  
  private currentSnippet: TextSnippet | null = null;
  private options: SnippetEditorOptions;
  private isInitialized = false;
  private isDirty = false;
  private validationErrors: string[] = [];

  constructor(options: SnippetEditorOptions = {}) {
    this.options = {
      mode: 'create',
      allowedTiers: ['personal', 'team', 'org'],
      compact: false,
      ...options
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
      throw new Error('Snippet editor already initialized');
    }

    this.container = container;
    this.createEditorInterface();
    await this.initializeTinyMCE();
    this.setupEventHandlers();
    this.loadSnippetData();
    this.isInitialized = true;
  }

  /**
   * Create the complete editor interface
   */
  private createEditorInterface(): void {
    if (!this.container) return;

    const isEdit = this.options.mode === 'edit';
    const isCompact = this.options.compact;

    this.container.innerHTML = `
      <div class="snippet-editor ${isCompact ? 'compact' : ''}">
        <div class="editor-header">
          <h2 class="editor-title">
            ${isEdit ? 'Edit Snippet' : 'Create New Snippet'}
          </h2>
          <div class="editor-actions">
            <button type="button" class="btn btn-secondary" data-action="cancel">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" data-action="save">
              ${isEdit ? 'Update' : 'Create'} Snippet
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
          </div>

          <!-- Organization Section -->
          <div class="form-section">
            <h3 class="section-title">Organization</h3>
            
            <div class="form-row">
              <div class="form-group required">
                <label for="snippet-tier">Tier</label>
                <select id="snippet-tier" name="tier" required>
                  ${this.options.allowedTiers?.map(tier => 
                    `<option value="${tier}">${tier.charAt(0).toUpperCase() + tier.slice(1)}</option>`
                  ).join('') || ''}
                </select>
                <div class="form-help">Choose the appropriate tier for this snippet</div>
              </div>
              
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
          </div>

          <!-- Content Section -->
          <div class="form-section">
            <h3 class="section-title">Content</h3>
            
            <div class="form-group">
              <label for="content-type">Content Type</label>
              <select id="content-type" name="contentType">
                <option value="html">HTML (Rich Text)</option>
                <option value="plaintext">Plain Text</option>
                <option value="latex">LaTeX</option>
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
      triggerInput: this.container.querySelector('#snippet-trigger') as HTMLInputElement,
      titleInput: this.container.querySelector('#snippet-title') as HTMLInputElement,
      descriptionInput: this.container.querySelector('#snippet-description') as HTMLTextAreaElement,
      tierSelect: this.container.querySelector('#snippet-tier') as HTMLSelectElement,
      priorityInput: this.container.querySelector('#snippet-priority') as HTMLInputElement,
      contentTypeSelect: this.container.querySelector('#content-type') as HTMLSelectElement,
      editorContainer: this.container.querySelector('#tinymce-container') as HTMLElement,
      variablesContainer: this.container.querySelector('#variables-container') as HTMLElement,
      previewContainer: this.container.querySelector('#preview-container') as HTMLElement,
    };
  }

  /**
   * Initialize TinyMCE editor
   */
  private async initializeTinyMCE(): Promise<void> {
    if (!this.formElements.editorContainer) return;

    const initialContent = this.currentSnippet?.content || '';
    
    this.editor = createSnippetEditor(this.formElements.editorContainer, {
      config: {
        height: this.options.compact ? 200 : 300,
      },
      events: {
        onContentChange: (content) => {
          this.handleContentChange(content);
        },
        onFocus: () => {
          this.formElements.editorContainer?.classList.add('focused');
        },
        onBlur: () => {
          this.formElements.editorContainer?.classList.remove('focused');
        }
      },
      autoFocus: this.options.mode === 'create'
    });

    await this.editor.init(this.formElements.editorContainer, initialContent);
  }

  /**
   * Setup event handlers for form elements
   */
  private setupEventHandlers(): void {
    if (!this.container) return;

    // Form input change handlers
    const inputs = this.container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.isDirty = true;
        this.validateForm();
      });
    });

    // Action button handlers
    const actionButtons = this.container.querySelectorAll('[data-action]');
    actionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const action = (button as HTMLElement).dataset.action;
        this.handleAction(action || '');
      });
    });

    // Content type change handler
    if (this.formElements.contentTypeSelect) {
      this.formElements.contentTypeSelect.addEventListener('change', () => {
        this.handleContentTypeChange();
      });
    }

    // Trigger input validation
    if (this.formElements.triggerInput) {
      this.formElements.triggerInput.addEventListener('blur', () => {
        this.validateTrigger();
      });
    }
  }

  /**
   * Load snippet data into form fields
   */
  private loadSnippetData(): void {
    if (!this.currentSnippet) return;

    const { trigger, description, scope, priority, contentType } = this.currentSnippet;

    if (this.formElements.triggerInput) this.formElements.triggerInput.value = trigger || '';
    if (this.formElements.titleInput) this.formElements.titleInput.value = '';
    if (this.formElements.descriptionInput) this.formElements.descriptionInput.value = description || '';
    if (this.formElements.tierSelect) this.formElements.tierSelect.value = scope || 'personal';
    if (this.formElements.priorityInput) this.formElements.priorityInput.value = String(priority || 100);
    if (this.formElements.contentTypeSelect) this.formElements.contentTypeSelect.value = contentType || 'html';
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
      console.log('🔧 Content type changed to:', contentType);
    }
  }

  /**
   * Handle action button clicks
   */
  private async handleAction(action: string): Promise<void> {
    switch (action) {
      case 'save':
        await this.handleSave();
        break;
      case 'cancel':
        this.handleCancel();
        break;
      case 'insert-variable':
        this.insertVariable();
        break;
      case 'preview':
        this.togglePreview();
        break;
      case 'test':
        await this.testExpansion();
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
        await this.options.onSave(snippetData);
      }
      this.isDirty = false;
    } catch (error) {
      console.error('❌ Failed to save snippet:', error);
      this.displayValidationErrors(['Failed to save snippet. Please try again.']);
    }
  }

  /**
   * Cancel editing
   */
  private handleCancel(): void {
    if (this.isDirty) {
      const confirmed = confirm('You have unsaved changes. Are you sure you want to cancel?');
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

    const variableName = prompt('Enter variable name:');
    if (variableName) {
      this.editor.insertContent(`\${${variableName}}`);
    }
  }

  /**
   * Toggle preview display
   */
  private togglePreview(): void {
    const previewSection = this.container?.querySelector('#preview-section') as HTMLElement;
    if (!previewSection) return;

    const isVisible = previewSection.style.display !== 'none';
    
    if (isVisible) {
      previewSection.style.display = 'none';
    } else {
      this.updatePreview();
      previewSection.style.display = 'block';
    }
  }

  /**
   * Test snippet expansion
   */
  private async testExpansion(): Promise<void> {
    const snippetData = this.collectFormData();
    if (!snippetData) return;

    // This would integrate with the trigger processor for testing
    console.log('🧪 Testing snippet expansion:', snippetData);
    alert('Test expansion functionality would be implemented here');
  }

  /**
   * Collect form data into snippet object
   */
  private collectFormData(): TextSnippet | null {
    if (!this.editor) return null;

    const trigger = this.formElements.triggerInput?.value?.trim();
    const title = this.formElements.titleInput?.value?.trim();
    const description = this.formElements.descriptionInput?.value?.trim();
    const tier = this.formElements.tierSelect?.value as PriorityTier;
    const priority = parseInt(this.formElements.priorityInput?.value || '100');
    const contentType = this.formElements.contentTypeSelect?.value as SnippetMeta['contentType'];
    const content = this.editor.getContent();

    if (!trigger || !content) return null;

    const snippet: TextSnippet = {
      id: this.currentSnippet?.id || `snippet_${Date.now()}`,
      trigger,
      content,
      description: description || undefined,
      scope: tier as any, // Map tier to scope
      priority,
      contentType: (contentType === 'html' ? 'html' : 'text') as any,
      createdAt: this.currentSnippet?.createdAt || new Date(),
      updatedAt: new Date(),
      lastUsed: this.currentSnippet?.lastUsed,
      usageCount: this.currentSnippet?.usageCount || 0,
      variables: this.extractVariables(content).map(name => ({ name, placeholder: name }))
    };

    return snippet;
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
    const variablesSection = this.container?.querySelector('#variables-section') as HTMLElement;
    
    if (!variablesSection || !this.formElements.variablesContainer) return;

    if (variables.length === 0) {
      variablesSection.style.display = 'none';
      return;
    }

    variablesSection.style.display = 'block';
    this.formElements.variablesContainer.innerHTML = `
      <div class="variables-list">
        ${variables.map(variable => `
          <div class="variable-item">
            <code>\${${variable}}</code>
            <small>This variable will be prompted when the snippet is used</small>
          </div>
        `).join('')}
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
      errors.push('Trigger is required');
    } else if (trigger.length < 2) {
      errors.push('Trigger must be at least 2 characters');
    }

    // Validate content
    const content = this.editor?.getContent()?.trim();
    if (!content) {
      errors.push('Content is required');
    }

    // Validate priority
    const priority = parseInt(this.formElements.priorityInput?.value || '100');
    if (isNaN(priority) || priority < 1 || priority > 1000) {
      errors.push('Priority must be between 1 and 1000');
    }

    this.validationErrors = errors;
    return {
      isValid: errors.length === 0,
      errors,
      warnings
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
      triggerInput.classList.add('error');
      triggerInput.title = 'Trigger is required';
    } else if (trigger.length < 2) {
      triggerInput.classList.add('error');
      triggerInput.title = 'Trigger must be at least 2 characters';
    } else {
      triggerInput.classList.remove('error');
      triggerInput.title = '';
    }
  }

  /**
   * Validate content
   */
  private validateContent(content: string): void {
    const editorContainer = this.formElements.editorContainer;
    if (!editorContainer) return;

    if (!content.trim()) {
      editorContainer.classList.add('error');
    } else {
      editorContainer.classList.remove('error');
    }
  }

  /**
   * Display validation errors
   */
  private displayValidationErrors(errors: string[]): void {
    const messagesContainer = this.container?.querySelector('#validation-messages') as HTMLElement;
    if (!messagesContainer) return;

    if (errors.length === 0) {
      messagesContainer.style.display = 'none';
      return;
    }

    messagesContainer.innerHTML = `
      <div class="validation-error">
        <h4>Please fix the following errors:</h4>
        <ul>
          ${errors.map(error => `<li>${error}</li>`).join('')}
        </ul>
      </div>
    `;
    messagesContainer.style.display = 'block';
  }

  /**
   * Get current snippet data
   */
  getSnippetData(): TextSnippet | null {
    return this.collectFormData();
  }

  /**
   * Check if form has unsaved changes
   */
  isDirtyForm(): boolean {
    return this.isDirty;
  }

  /**
   * Destroy the editor and clean up
   */
  async destroy(): Promise<void> {
    if (this.editor) {
      await this.editor.destroy();
      this.editor = null;
    }

    if (this.container) {
      this.container.innerHTML = '';
      this.container = null;
    }

    this.formElements = {};
    this.currentSnippet = null;
    this.isInitialized = false;
    this.isDirty = false;
  }
}

/**
 * Create a snippet editor with default configuration
 */
export function createSnippetEditorComponent(
  container: HTMLElement,
  options: SnippetEditorOptions = {}
): SnippetEditor {
  const editor = new SnippetEditor(options);
  editor.init(container);
  return editor;
}