/**
 * Simple local editor for PuffPuffPaste extension
 * No external dependencies - works with Chrome extension CSP
 */

export interface SimpleEditorConfig {
  height?: string;
  placeholder?: string;
  enableFormatting?: boolean;
  enableMarkdown?: boolean;
  autoResize?: boolean;
}

export interface SimpleEditorEvents {
  onContentChange?: (content: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface SimpleEditorOptions {
  config?: Partial<SimpleEditorConfig>;
  events?: SimpleEditorEvents;
  autoFocus?: boolean;
  debounceDelay?: number;
}

/**
 * Simple local editor component with basic formatting
 */
export class SimpleEditor {
  private container: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private toolbar: HTMLElement | null = null;
  private isInitialized = false;
  private isDestroyed = false;
  private contentChangeTimeout: number | null = null;

  private readonly options: SimpleEditorOptions;
  private readonly defaultConfig: SimpleEditorConfig = {
    height: '300px',
    placeholder: 'Enter your snippet content...',
    enableFormatting: true,
    enableMarkdown: true,
    autoResize: false
  };

  constructor(options: SimpleEditorOptions = {}) {
    this.options = {
      debounceDelay: 300,
      autoFocus: false,
      ...options,
    };
  }

  /**
   * Initialize editor in the specified container
   */
  async init(
    container: HTMLElement,
    initialContent: string = "",
  ): Promise<SimpleEditor> {
    if (this.isDestroyed) {
      throw new Error("Editor has been destroyed");
    }

    if (this.isInitialized) {
      await this.destroy();
    }

    this.container = container;

    // Merge configuration
    const config: SimpleEditorConfig = {
      ...this.defaultConfig,
      ...this.options.config,
    };

    // Create editor HTML structure
    this.createEditorStructure(config);

    // Set initial content
    if (initialContent && this.textarea) {
      this.textarea.value = initialContent;
    }

    this.setupEventHandlers();
    this.isInitialized = true;

    if (this.options.autoFocus && this.textarea) {
      this.textarea.focus();
    }

    return this;
  }

  /**
   * Create the editor HTML structure
   */
  private createEditorStructure(config: SimpleEditorConfig): void {
    if (!this.container) return;

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'simple-editor-wrapper';
    wrapper.style.cssText = `
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create toolbar if formatting is enabled
    if (config.enableFormatting) {
      this.toolbar = this.createToolbar();
      wrapper.appendChild(this.toolbar);
    }

    // Create textarea
    this.textarea = document.createElement('textarea');
    this.textarea.placeholder = config.placeholder || '';
    this.textarea.style.cssText = `
      width: 100%;
      height: ${config.height};
      border: none;
      outline: none;
      padding: 12px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      resize: ${config.autoResize ? 'vertical' : 'none'};
      background: transparent;
      box-sizing: border-box;
    `;

    wrapper.appendChild(this.textarea);
    this.container.appendChild(wrapper);
  }

  /**
   * Create formatting toolbar
   */
  private createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'simple-editor-toolbar';
    toolbar.style.cssText = `
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
      border-radius: 4px 4px 0 0;
      flex-wrap: wrap;
    `;

    // Formatting buttons
    const buttons = [
      { label: 'B', title: 'Bold', action: () => this.wrapSelection('**', '**') },
      { label: 'I', title: 'Italic', action: () => this.wrapSelection('*', '*') },
      { label: 'U', title: 'Underline', action: () => this.wrapSelection('<u>', '</u>') },
      { label: 'Code', title: 'Code', action: () => this.wrapSelection('`', '`') },
      { label: 'Link', title: 'Link', action: () => this.insertLink() },
      { label: '•', title: 'Bullet List', action: () => this.insertBulletList() },
      { label: '1.', title: 'Numbered List', action: () => this.insertNumberedList() },
      { label: '${', title: 'Variable', action: () => this.insertVariable() },
    ];

    buttons.forEach(button => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = button.label;
      btn.title = button.title;
      btn.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        font-weight: ${button.label === 'B' ? 'bold' : button.label === 'I' ? 'italic' : 'normal'};
        text-decoration: ${button.label === 'U' ? 'underline' : 'none'};
      `;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f0f0f0';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#fff';
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        button.action();
        this.textarea?.focus();
      });

      toolbar.appendChild(btn);
    });

    return toolbar;
  }

  /**
   * Wrap selected text with prefix and suffix
   */
  private wrapSelection(prefix: string, suffix: string): void {
    if (!this.textarea) return;

    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const selectedText = this.textarea.value.substring(start, end);
    const replacement = `${prefix}${selectedText || 'text'}${suffix}`;

    this.textarea.setRangeText(replacement, start, end);
    
    // Select the wrapped text
    const newStart = start + prefix.length;
    const newEnd = newStart + (selectedText || 'text').length;
    this.textarea.setSelectionRange(newStart, newEnd);

    this.triggerContentChange();
  }

  /**
   * Insert a link
   */
  private insertLink(): void {
    if (!this.textarea) return;

    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const selectedText = this.textarea.value.substring(start, end);
    
    const linkText = selectedText || 'link text';
    const url = 'https://example.com';
    const replacement = `[${linkText}](${url})`;

    this.textarea.setRangeText(replacement, start, end);
    
    // Select the URL for easy editing
    const urlStart = start + linkText.length + 3; // After "[text]("
    const urlEnd = urlStart + url.length;
    this.textarea.setSelectionRange(urlStart, urlEnd);

    this.triggerContentChange();
  }

  /**
   * Insert bullet list
   */
  private insertBulletList(): void {
    this.insertAtCursor('- ');
  }

  /**
   * Insert numbered list
   */
  private insertNumberedList(): void {
    this.insertAtCursor('1. ');
  }

  /**
   * Insert variable placeholder
   */
  private insertVariable(): void {
    if (!this.textarea) return;

    const start = this.textarea.selectionStart;
    const replacement = '${variable_name}';

    this.textarea.setRangeText(replacement, start, start);
    
    // Select the variable name for easy editing
    const nameStart = start + 2; // After "${"
    const nameEnd = nameStart + 'variable_name'.length;
    this.textarea.setSelectionRange(nameStart, nameEnd);

    this.triggerContentChange();
  }

  /**
   * Insert text at cursor position
   */
  private insertAtCursor(text: string): void {
    if (!this.textarea) return;

    const start = this.textarea.selectionStart;
    this.textarea.setRangeText(text, start, start);
    this.textarea.setSelectionRange(start + text.length, start + text.length);
    this.triggerContentChange();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.textarea) return;

    // Content change with debouncing
    this.textarea.addEventListener('input', () => {
      if (this.contentChangeTimeout) {
        window.clearTimeout(this.contentChangeTimeout);
      }

      this.contentChangeTimeout = window.setTimeout(() => {
        if (this.options.events?.onContentChange && this.textarea) {
          this.options.events.onContentChange(this.textarea.value);
        }
      }, this.options.debounceDelay);
    });

    // Focus and blur events
    this.textarea.addEventListener('focus', () => {
      if (this.options.events?.onFocus) {
        this.options.events.onFocus();
      }
    });

    this.textarea.addEventListener('blur', () => {
      if (this.options.events?.onBlur) {
        this.options.events.onBlur();
      }
    });

    // Keyboard shortcuts
    this.textarea.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });

    // Tab handling for better UX
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.insertAtCursor('  '); // Two spaces for indentation
      }
    });
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyboardShortcuts(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          this.wrapSelection('**', '**');
          break;
        case 'i':
          e.preventDefault();
          this.wrapSelection('*', '*');
          break;
        case 'u':
          e.preventDefault();
          this.wrapSelection('<u>', '</u>');
          break;
        case 'k':
          e.preventDefault();
          this.insertLink();
          break;
      }
    }

    // Variable shortcut: Ctrl+Shift+$
    if (e.ctrlKey && e.shiftKey && e.key === '$') {
      e.preventDefault();
      this.insertVariable();
    }
  }

  /**
   * Trigger content change event
   */
  private triggerContentChange(): void {
    if (this.options.events?.onContentChange && this.textarea) {
      this.options.events.onContentChange(this.textarea.value);
    }
  }

  /**
   * Get current editor content
   */
  getContent(): string {
    console.log('🔍 [SIMPLE-EDITOR-DEBUG] getContent() called');
    console.log('🔍 [SIMPLE-EDITOR-DEBUG] Textarea exists:', !!this.textarea);
    console.log('🔍 [SIMPLE-EDITOR-DEBUG] Is initialized:', this.isInitialized);
    
    const content = this.textarea?.value || '';
    console.log('🔍 [SIMPLE-EDITOR-DEBUG] Textarea value:', content ? `"${content.substring(0, 100)}..."` : '(empty/undefined)');
    console.log('🔍 [SIMPLE-EDITOR-DEBUG] Content length:', content.length);
    
    return content;
  }

  /**
   * Set editor content
   */
  setContent(content: string): void {
    if (this.textarea) {
      this.textarea.value = content;
      this.triggerContentChange();
    }
  }

  /**
   * Focus the editor
   */
  focus(): void {
    if (this.textarea) {
      this.textarea.focus();
    }
  }

  /**
   * Check if editor has focus
   */
  hasFocus(): boolean {
    return document.activeElement === this.textarea;
  }

  /**
   * Enable/disable editor
   */
  setEnabled(enabled: boolean): void {
    if (this.textarea) {
      this.textarea.disabled = !enabled;
    }
    if (this.toolbar) {
      const buttons = this.toolbar.querySelectorAll('button');
      buttons.forEach(btn => {
        (btn as HTMLButtonElement).disabled = !enabled;
      });
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

    if (this.container && this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    this.textarea = null;
    this.toolbar = null;
    this.container = null;
    this.isInitialized = false;
  }

  /**
   * Mark editor as destroyed (prevents reuse)
   */
  markDestroyed(): void {
    this.isDestroyed = true;
  }

  /**
   * Check if editor is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.textarea !== null;
  }
}

/**
 * Create a snippet editor with PuffPuffPaste-specific configuration
 */
export function createSnippetEditor(options: SimpleEditorOptions = {}): SimpleEditor {
  const defaultOptions: SimpleEditorOptions = {
    config: {
      placeholder: "Enter your snippet content here...",
      height: '300px',
      enableFormatting: true,
      enableMarkdown: true,
      autoResize: false
    },
    autoFocus: true,
    debounceDelay: 300,
    ...options,
  };

  return new SimpleEditor(defaultOptions);
}