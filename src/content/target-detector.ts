/**
 * Advanced Target Surface Detection System
 * Identifies different types of input fields and editors for optimal paste strategies
 */

export interface TargetSurface {
  type: TargetSurfaceType;
  element: HTMLElement;
  context: TargetContext;
  capabilities: TargetCapabilities;
  metadata: TargetMetadata;
}

export type TargetSurfaceType =
  | "plaintext-input"
  | "plaintext-textarea"
  | "contenteditable"
  | "tinymce-editor"
  | "gmail-composer"
  | "google-docs-editor"
  | "rich-text-editor"
  | "code-editor"
  | "markdown-editor"
  | "unknown";

export interface TargetContext {
  domain: string;
  url: string;
  pageTitle: string;
  isFramed: boolean;
  parentApplication?: string;
}

export interface TargetCapabilities {
  supportsHTML: boolean;
  supportsMarkdown: boolean;
  supportsPlainText: boolean;
  supportsImages: boolean;
  supportsLinks: boolean;
  supportsFormatting: boolean;
  supportsLists: boolean;
  supportsTables: boolean;
  maxLength?: number;
  allowedTags?: string[];
  customPasteHandler?: boolean;
}

export interface TargetMetadata {
  editorName?: string;
  editorVersion?: string;
  framework?: string;
  customAttributes?: Record<string, string>;
  detectionConfidence: number; // 0-1 scale
  detectionMethod: string;
  timestamp: number;
}

export interface DetectionRule {
  name: string;
  priority: number;
  selector: string;
  condition: (element: HTMLElement) => boolean;
  extractor: (element: HTMLElement) => Partial<TargetSurface>;
}

/**
 * Advanced target surface detector
 * Uses multiple detection strategies to identify optimal paste targets
 */
export class TargetDetector {
  private detectionRules: DetectionRule[] = [];
  private lastDetection: TargetSurface | null = null;
  private detectionCache = new Map<HTMLElement, TargetSurface>();
  private observers: MutationObserver[] = [];

  constructor() {
    this.initializeDetectionRules();
    this.setupDOMObserver();
  }

  /**
   * Initialize detection rules ordered by priority
   */
  private initializeDetectionRules(): void {
    this.detectionRules = [
      // Gmail Composer (highest priority)
      {
        name: "gmail-composer",
        priority: 100,
        selector: 'div[contenteditable="true"][role="textbox"]',
        condition: (element) => {
          return (
            (window.location.hostname.includes("mail.google.com") &&
              element.getAttribute("aria-label")?.includes("Message Body")) ||
            element
              .closest('[role="main"]')
              ?.querySelector("[data-subject]") !== null
          );
        },
        extractor: (element) => ({
          type: "gmail-composer",
          capabilities: {
            supportsHTML: true,
            supportsMarkdown: false,
            supportsPlainText: true,
            supportsImages: true,
            supportsLinks: true,
            supportsFormatting: true,
            supportsLists: true,
            supportsTables: true,
            customPasteHandler: true,
          },
          metadata: {
            editorName: "Gmail Composer",
            framework: "gmail",
            detectionMethod: "gmail-composer-rule",
            detectionConfidence: 0.95,
            timestamp: Date.now(),
          },
        }),
      },

      // Google Docs Editor
      {
        name: "google-docs-editor",
        priority: 92,
        selector:
          '[role="document"], .kix-appview-editor, .docs-texteventtarget-iframe',
        condition: (element) => {
          return (
            window.location.hostname === "docs.google.com" &&
            window.location.pathname.includes("/document/") &&
            (element.closest('[role="document"]') !== null ||
              element.closest(".kix-appview-editor") !== null ||
              element.closest(".docs-texteventtarget-iframe") !== null ||
              element.classList.contains("kix-cursor-caret") ||
              element.classList.contains("kix-selection-overlay"))
          );
        },
        extractor: (element) => ({
          type: "google-docs-editor",
          capabilities: {
            supportsHTML: true,
            supportsMarkdown: false,
            supportsPlainText: true,
            supportsImages: true,
            supportsLinks: true,
            supportsFormatting: true,
            supportsLists: true,
            supportsTables: true,
            customPasteHandler: true,
          },
          metadata: {
            editorName: "Google Docs",
            framework: "google-docs",
            detectionMethod: "google-docs-editor-rule",
            detectionConfidence: 0.96,
            timestamp: Date.now(),
          },
        }),
      },

      // TinyMCE Editor
      {
        name: "tinymce-editor",
        priority: 90,
        selector: 'iframe[id*="mce_"], div[id*="mce_"], .mce-content-body',
        condition: (element) => {
          return (
            element.closest(".mce-tinymce") !== null ||
            element.getAttribute("id")?.includes("mce_") ||
            element.classList.contains("mce-content-body") ||
            (window as any).tinymce !== undefined
          );
        },
        extractor: (element) => {
          const version = this.detectTinyMCEVersion();
          return {
            type: "tinymce-editor",
            capabilities: {
              supportsHTML: true,
              supportsMarkdown: false,
              supportsPlainText: true,
              supportsImages: true,
              supportsLinks: true,
              supportsFormatting: true,
              supportsLists: true,
              supportsTables: true,
              customPasteHandler: true,
            },
            metadata: {
              editorName: "TinyMCE",
              editorVersion: version,
              framework: "tinymce",
              detectionMethod: "tinymce-editor-rule",
              detectionConfidence: 0.9,
              timestamp: Date.now(),
            },
          };
        },
      },

      // Rich Text Editors (CKEditor, Quill, etc.)
      {
        name: "rich-text-editor",
        priority: 80,
        selector:
          ".ql-editor, .cke_wysiwyg_frame, .cke_contents, .ProseMirror, .fr-element",
        condition: (element) => {
          return (
            element.classList.contains("ql-editor") || // Quill
            element.classList.contains("cke_wysiwyg_frame") || // CKEditor
            element.classList.contains("ProseMirror") || // ProseMirror
            element.classList.contains("fr-element") || // Froala
            element.closest(".ql-container, .cke_contents, .ProseMirror") !==
              null
          );
        },
        extractor: (element) => {
          const editorName = this.detectRichTextEditorName(element);
          return {
            type: "rich-text-editor",
            capabilities: {
              supportsHTML: true,
              supportsMarkdown: false,
              supportsPlainText: true,
              supportsImages: true,
              supportsLinks: true,
              supportsFormatting: true,
              supportsLists: true,
              supportsTables: true,
              customPasteHandler: true,
            },
            metadata: {
              editorName,
              framework: editorName.toLowerCase(),
              detectionMethod: "rich-text-editor-rule",
              detectionConfidence: 0.85,
              timestamp: Date.now(),
            },
          };
        },
      },

      // Code Editors
      {
        name: "code-editor",
        priority: 70,
        selector: ".CodeMirror, .monaco-editor, .ace_editor",
        condition: (element) => {
          return (
            element.classList.contains("CodeMirror") ||
            element.classList.contains("monaco-editor") ||
            element.classList.contains("ace_editor") ||
            element.closest(".CodeMirror, .monaco-editor, .ace_editor") !== null
          );
        },
        extractor: (element) => {
          const editorName = this.detectCodeEditorName(element);
          return {
            type: "code-editor",
            capabilities: {
              supportsHTML: false,
              supportsMarkdown: false,
              supportsPlainText: true,
              supportsImages: false,
              supportsLinks: false,
              supportsFormatting: false,
              supportsLists: false,
              supportsTables: false,
              customPasteHandler: true,
            },
            metadata: {
              editorName,
              framework: editorName.toLowerCase(),
              detectionMethod: "code-editor-rule",
              detectionConfidence: 0.9,
              timestamp: Date.now(),
            },
          };
        },
      },

      // Markdown Editors
      {
        name: "markdown-editor",
        priority: 75,
        selector: ".markdown-editor, .md-editor, [data-markdown]",
        condition: (element) => {
          return (
            element.classList.contains("markdown-editor") ||
            element.classList.contains("md-editor") ||
            element.hasAttribute("data-markdown") ||
            element.closest(".markdown-editor, .md-editor, [data-markdown]") !==
              null
          );
        },
        extractor: (element) => ({
          type: "markdown-editor",
          capabilities: {
            supportsHTML: false,
            supportsMarkdown: true,
            supportsPlainText: true,
            supportsImages: true,
            supportsLinks: true,
            supportsFormatting: true,
            supportsLists: true,
            supportsTables: true,
            customPasteHandler: false,
          },
          metadata: {
            editorName: "Markdown Editor",
            framework: "markdown",
            detectionMethod: "markdown-editor-rule",
            detectionConfidence: 0.8,
            timestamp: Date.now(),
          },
        }),
      },

      // Generic ContentEditable
      {
        name: "contenteditable",
        priority: 60,
        selector: '[contenteditable="true"]',
        condition: (element) => {
          return (
            element.getAttribute("contenteditable") === "true" &&
            !element.closest(".mce-tinymce, .ql-container, .cke_contents")
          );
        },
        extractor: (element) => ({
          type: "contenteditable",
          capabilities: {
            supportsHTML: true,
            supportsMarkdown: false,
            supportsPlainText: true,
            supportsImages: true,
            supportsLinks: true,
            supportsFormatting: true,
            supportsLists: true,
            supportsTables: false,
            customPasteHandler: false,
          },
          metadata: {
            editorName: "ContentEditable",
            framework: "native",
            detectionMethod: "contenteditable-rule",
            detectionConfidence: 0.7,
            timestamp: Date.now(),
          },
        }),
      },

      // Textarea
      {
        name: "textarea",
        priority: 40,
        selector: "textarea",
        condition: (element) => element.tagName === "TEXTAREA",
        extractor: (element) => {
          const textarea = element as HTMLTextAreaElement;
          return {
            type: "plaintext-textarea",
            capabilities: {
              supportsHTML: false,
              supportsMarkdown: false,
              supportsPlainText: true,
              supportsImages: false,
              supportsLinks: false,
              supportsFormatting: false,
              supportsLists: false,
              supportsTables: false,
              maxLength:
                textarea.maxLength > 0 ? textarea.maxLength : undefined,
              customPasteHandler: false,
            },
            metadata: {
              editorName: "Textarea",
              framework: "native",
              detectionMethod: "textarea-rule",
              detectionConfidence: 0.9,
              timestamp: Date.now(),
            },
          };
        },
      },

      // Text Input
      {
        name: "text-input",
        priority: 30,
        selector:
          'input[type="text"], input[type="email"], input[type="search"], input[type="url"]',
        condition: (element) => {
          const input = element as HTMLInputElement;
          return ["text", "email", "search", "url"].includes(input.type);
        },
        extractor: (element) => {
          const input = element as HTMLInputElement;
          return {
            type: "plaintext-input",
            capabilities: {
              supportsHTML: false,
              supportsMarkdown: false,
              supportsPlainText: true,
              supportsImages: false,
              supportsLinks: false,
              supportsFormatting: false,
              supportsLists: false,
              supportsTables: false,
              maxLength: input.maxLength > 0 ? input.maxLength : undefined,
              customPasteHandler: false,
            },
            metadata: {
              editorName: "Text Input",
              framework: "native",
              detectionMethod: "text-input-rule",
              detectionConfidence: 0.95,
              timestamp: Date.now(),
            },
          };
        },
      },
    ];

    // Sort by priority (highest first)
    this.detectionRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Detect target surface at the given element or current focus
   */
  detectTargetSurface(element?: HTMLElement): TargetSurface | null {
    const targetElement = element || (document.activeElement as HTMLElement);

    if (!targetElement) {
      return null;
    }

    // Check cache first
    if (this.detectionCache.has(targetElement)) {
      return this.detectionCache.get(targetElement)!;
    }

    // Try each detection rule
    for (const rule of this.detectionRules) {
      const matchedElement = targetElement.closest(
        rule.selector,
      ) as HTMLElement;
      if (matchedElement && rule.condition(matchedElement)) {
        const surface = this.buildTargetSurface(matchedElement, rule);
        this.detectionCache.set(targetElement, surface);
        this.lastDetection = surface;
        return surface;
      }
    }

    // Fallback to unknown type
    const fallbackSurface = this.buildFallbackSurface(targetElement);
    this.detectionCache.set(targetElement, fallbackSurface);
    return fallbackSurface;
  }

  /**
   * Build complete target surface object
   */
  private buildTargetSurface(
    element: HTMLElement,
    rule: DetectionRule,
  ): TargetSurface {
    const baseData = rule.extractor(element);

    return {
      type: baseData.type || "unknown",
      element,
      context: {
        domain: window.location.hostname,
        url: window.location.href,
        pageTitle: document.title,
        isFramed: window.self !== window.top,
        parentApplication: this.detectParentApplication(),
      },
      capabilities: {
        supportsHTML: false,
        supportsMarkdown: false,
        supportsPlainText: true,
        supportsImages: false,
        supportsLinks: false,
        supportsFormatting: false,
        supportsLists: false,
        supportsTables: false,
        customPasteHandler: false,
        ...baseData.capabilities,
      },
      metadata: {
        detectionConfidence: 0.5,
        detectionMethod: "unknown",
        timestamp: Date.now(),
        ...baseData.metadata,
      },
    };
  }

  /**
   * Build fallback surface for unknown elements
   */
  private buildFallbackSurface(element: HTMLElement): TargetSurface {
    return {
      type: "unknown",
      element,
      context: {
        domain: window.location.hostname,
        url: window.location.href,
        pageTitle: document.title,
        isFramed: window.self !== window.top,
        parentApplication: this.detectParentApplication(),
      },
      capabilities: {
        supportsHTML: false,
        supportsMarkdown: false,
        supportsPlainText: true,
        supportsImages: false,
        supportsLinks: false,
        supportsFormatting: false,
        supportsLists: false,
        supportsTables: false,
        customPasteHandler: false,
      },
      metadata: {
        detectionConfidence: 0.1,
        detectionMethod: "fallback",
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Detect TinyMCE version
   */
  private detectTinyMCEVersion(): string | undefined {
    const tinymce = (window as any).tinymce;
    if (tinymce?.majorVersion) {
      return `${tinymce.majorVersion}.${tinymce.minorVersion || 0}`;
    }
    return undefined;
  }

  /**
   * Detect rich text editor name
   */
  private detectRichTextEditorName(element: HTMLElement): string {
    if (
      element.classList.contains("ql-editor") ||
      element.closest(".ql-container")
    ) {
      return "Quill";
    }
    if (
      element.classList.contains("cke_wysiwyg_frame") ||
      element.closest(".cke_contents")
    ) {
      return "CKEditor";
    }
    if (element.classList.contains("ProseMirror")) {
      return "ProseMirror";
    }
    if (element.classList.contains("fr-element")) {
      return "Froala";
    }
    return "Rich Text Editor";
  }

  /**
   * Detect code editor name
   */
  private detectCodeEditorName(element: HTMLElement): string {
    if (
      element.classList.contains("CodeMirror") ||
      element.closest(".CodeMirror")
    ) {
      return "CodeMirror";
    }
    if (element.classList.contains("monaco-editor")) {
      return "Monaco";
    }
    if (element.classList.contains("ace_editor")) {
      return "Ace";
    }
    return "Code Editor";
  }

  /**
   * Detect parent application context
   */
  private detectParentApplication(): string | undefined {
    const hostname = window.location.hostname;

    if (hostname.includes("mail.google.com")) return "Gmail";
    if (hostname.includes("docs.google.com")) return "Google Docs";
    if (hostname.includes("github.com")) return "GitHub";
    if (hostname.includes("stackoverflow.com")) return "Stack Overflow";
    if (hostname.includes("reddit.com")) return "Reddit";
    if (hostname.includes("twitter.com") || hostname.includes("x.com"))
      return "Twitter/X";
    if (hostname.includes("facebook.com")) return "Facebook";
    if (hostname.includes("linkedin.com")) return "LinkedIn";
    if (hostname.includes("notion.so")) return "Notion";
    if (hostname.includes("slack.com")) return "Slack";
    if (hostname.includes("discord.com")) return "Discord";

    return undefined;
  }

  /**
   * Setup DOM observer for dynamic content
   */
  private setupDOMObserver(): void {
    const observer = new MutationObserver((mutations) => {
      let shouldClearCache = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          // Check if any added nodes might be editors
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement;
              if (this.isLikelyEditor(element)) {
                shouldClearCache = true;
                break;
              }
            }
          }
        }
      }

      if (shouldClearCache) {
        this.clearCache();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.observers.push(observer);
  }

  /**
   * Check if element is likely an editor
   */
  private isLikelyEditor(element: HTMLElement): boolean {
    return (
      element.matches(
        'textarea, input[type="text"], [contenteditable="true"]',
      ) ||
      element.querySelector(
        'textarea, input[type="text"], [contenteditable="true"]',
      ) !== null ||
      element.classList.contains("mce-tinymce") ||
      element.classList.contains("ql-container") ||
      element.classList.contains("CodeMirror")
    );
  }

  /**
   * Get the last detected surface
   */
  getLastDetection(): TargetSurface | null {
    return this.lastDetection;
  }

  /**
   * Clear detection cache
   */
  clearCache(): void {
    this.detectionCache.clear();
  }

  /**
   * Get detection statistics
   */
  getDetectionStats(): {
    cacheSize: number;
    lastDetectionTime: number | null;
    lastDetectionType: TargetSurfaceType | null;
  } {
    return {
      cacheSize: this.detectionCache.size,
      lastDetectionTime: this.lastDetection?.metadata.timestamp || null,
      lastDetectionType: this.lastDetection?.type || null,
    };
  }

  /**
   * Add custom detection rule
   */
  addDetectionRule(rule: DetectionRule): void {
    this.detectionRules.push(rule);
    this.detectionRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clean up observers
   */
  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    this.detectionCache.clear();
  }
}

/**
 * Global target detector instance
 */
export const targetDetector = new TargetDetector();

/**
 * Utility function to detect current target surface
 */
export function detectCurrentTarget(): TargetSurface | null {
  return targetDetector.detectTargetSurface();
}

/**
 * Utility function to check if target supports specific capability
 */
export function targetSupports(
  capability: keyof TargetCapabilities,
  target?: TargetSurface,
): boolean {
  const surface = target || detectCurrentTarget();
  return surface?.capabilities[capability] === true;
}
