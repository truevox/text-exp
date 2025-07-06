/**
 * Global Toggle Component for Options Page
 * Handles global toggle functionality including shortcut management and status display
 */

import type { OptionsElements } from "../utils/dom-elements.js";

export type StatusCallback = (
  message: string,
  type: "success" | "error" | "warning" | "info",
) => void;
export type SettingsCallback = () => Promise<void>;

export class GlobalToggleComponent {
  private elements: OptionsElements;
  private showStatus: StatusCallback;
  private saveSettings: SettingsCallback;

  constructor(
    elements: OptionsElements,
    showStatus: StatusCallback,
    saveSettings: SettingsCallback,
  ) {
    this.elements = elements;
    this.showStatus = showStatus;
    this.saveSettings = saveSettings;
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for global toggle
   */
  private initializeEventListeners(): void {
    // Global toggle enabled/disabled
    this.elements.globalToggleEnabledCheckbox.addEventListener("change", () => {
      this.updateGlobalToggleStatus();
      this.saveSettings();
    });

    // Edit shortcut button
    this.elements.editShortcutButton.addEventListener("click", () =>
      this.handleEditShortcut(),
    );

    // Shortcut capture
    this.elements.globalToggleShortcut.addEventListener("keydown", (e) =>
      this.handleShortcutCapture(e),
    );

    // Handle blur to save shortcut when user clicks away
    this.elements.globalToggleShortcut.addEventListener("blur", () => {
      if (!this.elements.globalToggleShortcut.readOnly) {
        this.finishEditingShortcut();
      }
    });

    // Handle Enter key to save shortcut
    this.elements.globalToggleShortcut.addEventListener("keyup", (e) => {
      if (e.key === "Enter" && !this.elements.globalToggleShortcut.readOnly) {
        this.finishEditingShortcut();
      }
    });
  }

  /**
   * Update global toggle status display
   */
  updateGlobalToggleStatus(): void {
    const isEnabled = this.elements.globalToggleEnabledCheckbox.checked;
    const statusBadge =
      this.elements.globalToggleStatus.querySelector(".status-badge");

    if (statusBadge) {
      statusBadge.textContent = isEnabled ? "Active" : "Disabled";
      statusBadge.className = `status-badge ${isEnabled ? "enabled" : "disabled"}`;
    }

    // Update shortcut input state based on enabled status
    this.updateShortcutInputState();
  }

  /**
   * Update shortcut input state based on global toggle enabled status
   */
  private updateShortcutInputState(): void {
    const isEnabled = this.elements.globalToggleEnabledCheckbox.checked;
    const isEditing = !this.elements.globalToggleShortcut.readOnly;

    // Disable shortcut editing if global toggle is disabled
    if (!isEnabled && !isEditing) {
      this.elements.globalToggleShortcut.disabled = true;
      this.elements.editShortcutButton.disabled = true;
    } else {
      this.elements.globalToggleShortcut.disabled = false;
      this.elements.editShortcutButton.disabled = false;
    }
  }

  /**
   * Handle edit shortcut button click
   */
  private handleEditShortcut(): void {
    const isEditing = this.elements.globalToggleShortcut.readOnly;

    if (isEditing) {
      // Start editing
      this.startEditingShortcut();
    } else {
      // Finish editing
      this.finishEditingShortcut();
    }
  }

  /**
   * Start editing shortcut
   */
  private startEditingShortcut(): void {
    // Enable editing
    this.elements.globalToggleShortcut.readOnly = false;
    this.elements.globalToggleShortcut.focus();
    this.elements.globalToggleShortcut.select();
    this.elements.shortcutHelp.style.display = "block";

    // Update button
    this.updateEditButton("save");

    // Show instructions
    this.showStatus(
      "Press the key combination you want to use for the global toggle shortcut",
      "info",
    );
  }

  /**
   * Finish editing shortcut
   */
  private finishEditingShortcut(): void {
    // Validate shortcut before saving
    const shortcut = this.elements.globalToggleShortcut.value;
    if (shortcut && !this.validateShortcut(shortcut)) {
      this.showStatus(
        "Invalid shortcut. Please use a combination with at least one modifier key.",
        "error",
      );
      return;
    }

    // Save and disable editing
    this.elements.globalToggleShortcut.readOnly = true;
    this.elements.shortcutHelp.style.display = "none";

    // Update button
    this.updateEditButton("edit");

    // Save settings
    this.saveSettings();

    // Show success message if shortcut was set
    if (shortcut) {
      this.showStatus(`Global toggle shortcut set to: ${shortcut}`, "success");
    }
  }

  /**
   * Update edit button appearance
   */
  private updateEditButton(mode: "edit" | "save"): void {
    const buttonIcon =
      this.elements.editShortcutButton.querySelector(".button-icon");
    const buttonText =
      this.elements.editShortcutButton.querySelector(".button-text");

    if (mode === "save") {
      if (buttonIcon) buttonIcon.textContent = "💾";
      if (buttonText) buttonText.textContent = "Save";
      this.elements.editShortcutButton.title = "Save shortcut";
    } else {
      if (buttonIcon) buttonIcon.textContent = "✏️";
      if (buttonText) buttonText.textContent = "Edit";
      this.elements.editShortcutButton.title = "Edit shortcut";
    }
  }

  /**
   * Handle shortcut capture during editing
   */
  private handleShortcutCapture(event: KeyboardEvent): void {
    if (this.elements.globalToggleShortcut.readOnly) return;

    event.preventDefault();

    const modifiers: string[] = [];
    const key = event.key;

    // Capture modifiers
    if (event.ctrlKey) modifiers.push("Ctrl");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    if (event.metaKey)
      modifiers.push(navigator.platform.includes("Mac") ? "Cmd" : "Meta");

    // Don't capture modifier keys alone
    if (["Control", "Alt", "Shift", "Meta"].includes(key)) return;

    // Special handling for Escape key
    if (key === "Escape") {
      this.cancelEditingShortcut();
      return;
    }

    // Build shortcut string
    let shortcut = "";
    if (modifiers.length > 0) {
      shortcut = modifiers.join("+") + "+" + key.toUpperCase();
    } else {
      shortcut = key.toUpperCase();
    }

    // Validate shortcut (require at least one modifier)
    if (modifiers.length === 0) {
      this.showStatus(
        "Shortcut must include at least one modifier key (Ctrl, Alt, Shift, or Meta)",
        "error",
      );
      return;
    }

    // Update input value
    this.elements.globalToggleShortcut.value = shortcut;

    // Auto-finish editing after capturing a valid shortcut
    setTimeout(() => {
      this.finishEditingShortcut();
    }, 100);
  }

  /**
   * Cancel editing shortcut
   */
  private cancelEditingShortcut(): void {
    // Restore original value
    this.elements.globalToggleShortcut.readOnly = true;
    this.elements.shortcutHelp.style.display = "none";

    // Update button
    this.updateEditButton("edit");

    this.showStatus("Shortcut editing cancelled", "info");
  }

  /**
   * Validate shortcut format
   */
  private validateShortcut(shortcut: string): boolean {
    if (!shortcut) return true; // Empty shortcut is valid (disables global toggle)

    // Check for modifier keys
    const hasModifier = /^(Ctrl|Alt|Shift|Cmd|Meta)\+/.test(shortcut);

    // Check basic format
    const isValidFormat = /^([A-Z][a-z]*\+)*[A-Z]+$/i.test(shortcut);

    return hasModifier && isValidFormat;
  }

  /**
   * Set global toggle enabled state
   */
  setEnabled(enabled: boolean): void {
    this.elements.globalToggleEnabledCheckbox.checked = enabled;
    this.updateGlobalToggleStatus();
  }

  /**
   * Set global toggle shortcut
   */
  setShortcut(shortcut: string): void {
    this.elements.globalToggleShortcut.value = shortcut;
  }

  /**
   * Get current global toggle enabled state
   */
  isEnabled(): boolean {
    return this.elements.globalToggleEnabledCheckbox.checked;
  }

  /**
   * Get current global toggle shortcut
   */
  getShortcut(): string {
    return this.elements.globalToggleShortcut.value;
  }

  /**
   * Check if shortcut is currently being edited
   */
  isEditingShortcut(): boolean {
    return !this.elements.globalToggleShortcut.readOnly;
  }

  /**
   * Reset global toggle to default state
   */
  reset(): void {
    this.setEnabled(true);
    this.setShortcut("Ctrl+Shift+T");
    this.updateGlobalToggleStatus();
  }

  /**
   * Update UI with settings values
   */
  updateFromSettings(
    globalToggleEnabled: boolean,
    globalToggleShortcut: string,
  ): void {
    this.setEnabled(globalToggleEnabled);
    this.setShortcut(globalToggleShortcut);
  }

  /**
   * Get suggested shortcuts
   */
  getSuggestedShortcuts(): string[] {
    return [
      "Ctrl+Shift+T",
      "Ctrl+Alt+T",
      "Alt+Shift+T",
      "Ctrl+Shift+E",
      "Ctrl+Alt+E",
      "Alt+Shift+E",
    ];
  }

  /**
   * Test if a shortcut conflicts with common browser shortcuts
   */
  hasShortcutConflict(shortcut: string): {
    hasConflict: boolean;
    conflictWith?: string;
  } {
    const commonShortcuts = {
      "Ctrl+T": "New Tab",
      "Ctrl+W": "Close Tab",
      "Ctrl+N": "New Window",
      "Ctrl+R": "Reload",
      "Ctrl+F": "Find",
      "Ctrl+L": "Address Bar",
      "Ctrl+D": "Bookmark",
      "Ctrl+S": "Save",
      "Ctrl+P": "Print",
      "Alt+F4": "Close Window",
      F5: "Reload",
      F11: "Fullscreen",
      F12: "Developer Tools",
    };

    const conflictWith =
      commonShortcuts[shortcut as keyof typeof commonShortcuts];

    return {
      hasConflict: !!conflictWith,
      conflictWith,
    };
  }

  /**
   * Show shortcut suggestions
   */
  showShortcutSuggestions(): void {
    const suggestions = this.getSuggestedShortcuts();
    const message = `Suggested shortcuts: ${suggestions.join(", ")}`;
    this.showStatus(message, "info");
  }
}
