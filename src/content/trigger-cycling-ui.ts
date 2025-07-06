/**
 * Trigger Cycling UI - Visual overlay for cycling through trigger matches
 * Provides a visual preview above the cursor showing available options
 */

export interface CyclingOption {
  trigger: string;
  content: string;
  description?: string;
}

export class TriggerCyclingUI {
  private overlay: HTMLElement | null = null;
  private options: CyclingOption[] = [];
  private currentIndex = 0;
  private targetElement: HTMLElement | null = null;
  private cursorPosition: { x: number; y: number } | null = null;

  /**
   * Show the cycling UI with available options
   */
  show(
    options: CyclingOption[],
    targetElement: HTMLElement,
    cursorPosition: { x: number; y: number },
  ): void {
    this.options = options;
    this.currentIndex = 0;
    this.targetElement = targetElement;
    this.cursorPosition = cursorPosition;

    this.createOverlay();
    this.updateDisplay();
  }

  /**
   * Cycle to the next option
   */
  cycleNext(): CyclingOption {
    this.currentIndex = (this.currentIndex + 1) % this.options.length;
    this.updateDisplay();
    return this.options[this.currentIndex];
  }

  /**
   * Cycle to the previous option
   */
  cyclePrevious(): CyclingOption {
    this.currentIndex =
      this.currentIndex === 0 ? this.options.length - 1 : this.currentIndex - 1;
    this.updateDisplay();
    return this.options[this.currentIndex];
  }

  /**
   * Get the currently selected option
   */
  getCurrentOption(): CyclingOption | null {
    return this.options[this.currentIndex] || null;
  }

  /**
   * Hide and clean up the cycling UI
   */
  hide(): void {
    if (this.overlay) {
      document.body.removeChild(this.overlay);
      this.overlay = null;
    }
    this.options = [];
    this.currentIndex = 0;
    this.targetElement = null;
    this.cursorPosition = null;
  }

  /**
   * Check if the cycling UI is currently visible
   */
  isVisible(): boolean {
    return this.overlay !== null;
  }

  /**
   * Create the visual overlay element
   */
  private createOverlay(): void {
    // Remove existing overlay if present
    if (this.overlay) {
      this.hide();
    }

    this.overlay = document.createElement("div");
    this.overlay.className = "puffpuffpaste-cycling-ui";
    this.overlay.style.cssText = `
      position: fixed;
      z-index: 999999;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      border-radius: 8px;
      padding: 8px 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      user-select: none;
    `;

    // Position the overlay above the cursor
    if (this.cursorPosition) {
      // Add some offset to position above the cursor
      const offsetY = 30; // pixels above cursor
      this.overlay.style.left = `${this.cursorPosition.x}px`;
      this.overlay.style.top = `${this.cursorPosition.y - offsetY}px`;
    }

    document.body.appendChild(this.overlay);
  }

  /**
   * Update the display content
   */
  private updateDisplay(): void {
    if (!this.overlay || this.options.length === 0) {
      return;
    }

    const current = this.options[this.currentIndex];
    const nextOptions = this.getNextOptions();

    this.overlay.innerHTML = `
      <div style="margin-bottom: 4px; font-weight: 600; color: #4CAF50;">
        ▶ ${this.escapeHtml(current.trigger)}
      </div>
      <div style="margin-bottom: 8px; color: #E0E0E0; font-size: 12px;">
        ${this.escapeHtml(this.truncateContent(current.content, 50))}
      </div>
      ${
        nextOptions.length > 0
          ? `
        <div style="border-top: 1px solid #444; padding-top: 6px; margin-top: 6px;">
          <div style="color: #BBB; font-size: 11px; margin-bottom: 4px;">
            Press Tab for more options:
          </div>
          ${nextOptions
            .map(
              (option) => `
            <div style="color: #999; font-size: 11px; margin-left: 8px;">
              • ${this.escapeHtml(option.trigger)} → ${this.escapeHtml(this.truncateContent(option.content, 30))}
            </div>
          `,
            )
            .join("")}
        </div>
      `
          : ""
      }
      <div style="border-top: 1px solid #444; padding-top: 4px; margin-top: 6px; color: #888; font-size: 10px;">
        Tab to cycle • Any other key to expand
      </div>
    `;
  }

  /**
   * Get the next few options for preview
   */
  private getNextOptions(): CyclingOption[] {
    if (this.options.length <= 1) {
      return [];
    }

    const previewCount = Math.min(3, this.options.length - 1);
    const nextOptions: CyclingOption[] = [];

    for (let i = 1; i <= previewCount; i++) {
      const index = (this.currentIndex + i) % this.options.length;
      nextOptions.push(this.options[index]);
    }

    return nextOptions;
  }

  /**
   * Truncate content for display
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + "...";
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update position based on current cursor location
   */
  updatePosition(cursorPosition: { x: number; y: number }): void {
    this.cursorPosition = cursorPosition;
    if (this.overlay) {
      const offsetY = 30;
      this.overlay.style.left = `${cursorPosition.x}px`;
      this.overlay.style.top = `${cursorPosition.y - offsetY}px`;
    }
  }

  /**
   * Get cursor position within an element
   */
  static getCursorPosition(
    element: HTMLElement,
  ): { x: number; y: number } | null {
    if (
      element.tagName.toLowerCase() === "input" ||
      element.tagName.toLowerCase() === "textarea"
    ) {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      const rect = input.getBoundingClientRect();

      // For input/textarea, approximate position based on text size and cursor
      const style = window.getComputedStyle(input);
      const fontSize = parseInt(style.fontSize, 10);
      const padding = parseInt(style.paddingLeft, 10);

      // Simple approximation - for more accuracy, would need to measure text
      const charWidth = fontSize * 0.6; // Rough estimate
      const cursorPos = input.selectionStart || 0;
      const text = input.value.substring(0, cursorPos);
      const lastLineStart = text.lastIndexOf("\n") + 1;
      const charsOnLine = text.length - lastLineStart;

      return {
        x: rect.left + padding + charsOnLine * charWidth,
        y: rect.top + fontSize + parseInt(style.paddingTop, 10),
      };
    } else if (element.contentEditable === "true") {
      // For contenteditable, use selection range
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        return {
          x: rect.left,
          y: rect.top,
        };
      }
    }

    return null;
  }
}
