/**
 * LaTeX Preview Renderer with MathJax Integration
 * Provides real-time LaTeX rendering for mathematical expressions
 */

export interface LaTeXRenderOptions {
  inline?: boolean;
  displayMode?: boolean;
  throwOnError?: boolean;
  errorColor?: string;
  macros?: Record<string, string>;
  delimiters?: Array<{
    left: string;
    right: string;
    display: boolean;
  }>;
}

export interface LaTeXRenderResult {
  success: boolean;
  html: string;
  errors?: string[];
  warnings?: string[];
}

/**
 * LaTeX Preview Renderer using MathJax
 */
export class LaTeXPreviewRenderer {
  private mathjax: any = null;
  private isLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  private readonly defaultOptions: LaTeXRenderOptions = {
    inline: false,
    displayMode: true,
    throwOnError: false,
    errorColor: "#cc0000",
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
    ],
    macros: {
      "\\RR": "\\mathbb{R}",
      "\\CC": "\\mathbb{C}",
      "\\NN": "\\mathbb{N}",
      "\\ZZ": "\\mathbb{Z}",
      "\\QQ": "\\mathbb{Q}",
    },
  };

  /**
   * Load MathJax library dynamically
   */
  async loadMathJax(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.initializeMathJax();
    return this.loadingPromise;
  }

  /**
   * Initialize MathJax with configuration
   */
  private async initializeMathJax(): Promise<void> {
    try {
      // Configure MathJax before loading
      (window as any).MathJax = {
        tex: {
          inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"],
          ],
          displayMath: [
            ["$$", "$$"],
            ["\\[", "\\]"],
          ],
          processEscapes: true,
          processEnvironments: true,
          macros: this.defaultOptions.macros,
        },
        options: {
          skipHtmlTags: ["script", "noscript", "style", "textarea", "pre"],
          ignoreHtmlClass: "tex2jax_ignore",
          processHtmlClass: "tex2jax_process",
        },
        startup: {
          ready: () => {
            console.log("📐 MathJax loaded and ready");
            this.isLoaded = true;
          },
        },
      };

      // Load MathJax from CDN
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
      script.async = true;

      await new Promise<void>((resolve, reject) => {
        script.onload = () => {
          this.mathjax = (window as any).MathJax;
          this.isLoaded = true;
          resolve();
        };
        script.onerror = () => {
          reject(new Error("Failed to load MathJax"));
        };
        document.head.appendChild(script);
      });

      console.log("✅ MathJax successfully loaded");
    } catch (error) {
      console.error("❌ Failed to load MathJax:", error);
      this.isLoaded = false;
      throw error;
    }
  }

  /**
   * Render LaTeX content to HTML with math expressions
   */
  async renderLaTeX(
    content: string,
    options: Partial<LaTeXRenderOptions> = {},
  ): Promise<LaTeXRenderResult> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Ensure MathJax is loaded
      await this.loadMathJax();

      if (!this.mathjax) {
        return this.fallbackRender(content);
      }

      // Convert LaTeX text formatting to HTML
      let htmlContent = this.convertLaTeXToHTML(content);

      // Create a temporary container for MathJax processing
      const container = document.createElement("div");
      container.innerHTML = htmlContent;
      container.style.visibility = "hidden";
      container.style.position = "absolute";
      container.style.top = "-9999px";
      document.body.appendChild(container);

      try {
        // Process math expressions with MathJax
        await this.mathjax.typesetPromise([container]);

        // Get the rendered HTML
        const renderedHTML = container.innerHTML;

        // Clean up
        document.body.removeChild(container);

        return {
          success: true,
          html: renderedHTML,
          warnings: [],
        };
      } catch (mathError) {
        // Clean up on error
        document.body.removeChild(container);

        console.warn("⚠️ MathJax rendering error:", mathError);
        return {
          success: false,
          html: this.convertLaTeXToHTML(content),
          errors: [`Math rendering error: ${(mathError as Error).message}`],
        };
      }
    } catch (error) {
      console.error("❌ LaTeX rendering failed:", error);
      return this.fallbackRender(content);
    }
  }

  /**
   * Convert LaTeX text formatting to HTML (non-math elements)
   */
  private convertLaTeXToHTML(content: string): string {
    return (
      content
        // Text formatting
        .replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>")
        .replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>")
        .replace(/\\texttt\{([^}]*)\}/g, "<code>$1</code>")
        .replace(/\\underline\{([^}]*)\}/g, "<u>$1</u>")
        .replace(
          /\\textsc\{([^}]*)\}/g,
          '<span style="font-variant: small-caps">$1</span>',
        )

        // Sections
        .replace(/\\section\{([^}]*)\}/g, "<h1>$1</h1>")
        .replace(/\\subsection\{([^}]*)\}/g, "<h2>$1</h2>")
        .replace(/\\subsubsection\{([^}]*)\}/g, "<h3>$1</h3>")

        // Lists
        .replace(/\\begin\{itemize\}/g, "<ul>")
        .replace(/\\end\{itemize\}/g, "</ul>")
        .replace(/\\begin\{enumerate\}/g, "<ol>")
        .replace(/\\end\{enumerate\}/g, "</ol>")
        .replace(/\\item\s*/g, "<li>")

        // Line breaks and spacing
        .replace(/\\\\\s*/g, "<br>")
        .replace(/\\par\s*/g, "</p><p>")
        .replace(/\\newpage/g, '<div style="page-break-before: always;"></div>')

        // Quotes
        .replace(/``([^']*)''/g, '"$1"')
        .replace(/`([^']*)'/g, "'$1'")

        // Special characters (that aren't math)
        .replace(/\\&/g, "&amp;")
        .replace(/\\%/g, "%")
        .replace(/\\#/g, "#")

        // Wrap in paragraph if not already structured
        .replace(/^(?!<[h1-6]|<p|<ul|<ol|<div)/gm, "<p>")
        .replace(/(?<!<\/[h1-6]>|<\/p>|<\/ul>|<\/ol>|<\/div>)$/gm, "</p>")

        // Clean up empty paragraphs
        .replace(/<p>\s*<\/p>/g, "")
        .replace(/<p>(\s*<[h1-6])/g, "$1")
        .replace(/(<\/[h1-6]>)\s*<\/p>/g, "$1")
    );
  }

  /**
   * Fallback rendering without MathJax
   */
  private fallbackRender(content: string): LaTeXRenderResult {
    const htmlContent = this.convertLaTeXToHTML(content)
      // Simple math expression handling (fallback)
      .replace(/\$\$([^$]+)\$\$/g, '<em class="math-display">$1</em>')
      .replace(/\$([^$]+)\$/g, '<em class="math-inline">$1</em>')
      .replace(/\\([a-zA-Z]+)/g, '<span class="latex-command">\\$1</span>');

    return {
      success: true,
      html: `<div class="latex-preview-fallback">
        <div class="fallback-notice">
          <small>⚠️ LaTeX Preview (MathJax unavailable - simplified rendering)</small>
        </div>
        ${htmlContent}
      </div>`,
      warnings: ["MathJax not available, using simplified rendering"],
    };
  }

  /**
   * Extract math expressions from content
   */
  extractMathExpressions(content: string): Array<{
    expression: string;
    type: "inline" | "display";
    start: number;
    end: number;
  }> {
    const expressions: Array<{
      expression: string;
      type: "inline" | "display";
      start: number;
      end: number;
    }> = [];

    const delimiters = this.defaultOptions.delimiters!;

    for (const delimiter of delimiters) {
      const pattern = new RegExp(
        `\\${delimiter.left}(.*?)\\${delimiter.right}`,
        "gs",
      );
      let match;

      while ((match = pattern.exec(content)) !== null) {
        expressions.push({
          expression: match[1],
          type: delimiter.display ? "display" : "inline",
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Sort by position
    return expressions.sort((a, b) => a.start - b.start);
  }

  /**
   * Validate LaTeX math syntax
   */
  async validateMath(expression: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    try {
      await this.loadMathJax();

      if (!this.mathjax) {
        return {
          isValid: true,
          errors: ["MathJax not available for validation"],
        };
      }

      // Create a test container
      const testContainer = document.createElement("div");
      testContainer.innerHTML = `$$${expression}$$`;
      testContainer.style.display = "none";
      document.body.appendChild(testContainer);

      try {
        await this.mathjax.typesetPromise([testContainer]);
        document.body.removeChild(testContainer);
        return { isValid: true, errors: [] };
      } catch (error) {
        document.body.removeChild(testContainer);
        return {
          isValid: false,
          errors: [(error as Error).message || "Invalid math expression"],
        };
      }
    } catch (error) {
      return {
        isValid: false,
        errors: ["Failed to validate math expression"],
      };
    }
  }

  /**
   * Get MathJax loading status
   */
  isReady(): boolean {
    return this.isLoaded && this.mathjax !== null;
  }

  /**
   * Preload MathJax for better performance
   */
  async preload(): Promise<void> {
    if (!this.isLoaded) {
      await this.loadMathJax();
    }
  }

  /**
   * Clear MathJax cache (useful for development)
   */
  clearCache(): void {
    if (this.mathjax?.startup?.document?.clear) {
      this.mathjax.startup.document.clear();
    }
  }
}

/**
 * Utility function to create a LaTeX preview renderer
 */
export function createLaTeXRenderer(
  options: Partial<LaTeXRenderOptions> = {},
): LaTeXPreviewRenderer {
  return new LaTeXPreviewRenderer();
}

/**
 * Quick render function for simple LaTeX content
 */
export async function renderLaTeX(
  content: string,
  options: Partial<LaTeXRenderOptions> = {},
): Promise<LaTeXRenderResult> {
  const renderer = new LaTeXPreviewRenderer();
  return renderer.renderLaTeX(content, options);
}
