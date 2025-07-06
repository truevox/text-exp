/**
 * Placeholder and Variable Handler for Text Expansion
 * Handles dynamic placeholders and variable prompts in snippets
 */

import type { TextSnippet, SnippetVariable } from "../shared/types.js";
import { EXPANSION_CONFIG, UI_CONFIG } from "../shared/constants.js";

/**
 * Handles variable placeholders and user prompts
 */
export class PlaceholderHandler {
  private modalContainer: HTMLElement | null = null;

  /**
   * Replace variables in text content
   */
  replaceVariables(content: string, variables: Record<string, string>): string {
    let result = content;

    // Replace variable placeholders {{variable}}
    result = result.replace(
      EXPANSION_CONFIG.VARIABLE_PATTERN,
      (match, variableName) => {
        return variables[variableName] || match;
      },
    );

    // Replace built-in placeholders
    result = this.replaceBuiltInPlaceholders(result);

    return result;
  }

  /**
   * Replace built-in placeholders like date, time, etc.
   */
  private replaceBuiltInPlaceholders(content: string): string {
    const now = new Date();

    const placeholders: Record<string, string> = {
      "[[date]]": now.toLocaleDateString(),
      "[[time]]": now.toLocaleTimeString(),
      "[[datetime]]": now.toLocaleString(),
      "[[year]]": now.getFullYear().toString(),
      "[[month]]": (now.getMonth() + 1).toString().padStart(2, "0"),
      "[[day]]": now.getDate().toString().padStart(2, "0"),
      "[[weekday]]": now.toLocaleDateString("en-US", { weekday: "long" }),
      "[[url]]": window.location.href,
      "[[domain]]": window.location.hostname,
      "[[title]]": document.title,
    };

    let result = content;
    for (const [placeholder, value] of Object.entries(placeholders)) {
      result = result.replace(
        new RegExp(placeholder.replace(/[[\]]/g, "\\$&"), "g"),
        value,
      );
    }

    return result;
  }

  /**
   * Prompt user for variable values
   */
  async promptForVariables(
    snippet: TextSnippet,
  ): Promise<Record<string, string>> {
    if (!snippet.variables || snippet.variables.length === 0) {
      return {};
    }

    return new Promise((resolve, reject) => {
      this.showVariableModal(
        snippet.variables!,
        (variables) => {
          resolve(variables);
        },
        () => {
          reject(new Error("Variable prompt cancelled"));
        },
      );
    });
  }

  /**
   * Show modal for variable input
   */
  private showVariableModal(
    variables: SnippetVariable[],
    onSubmit: (values: Record<string, string>) => void,
    onCancel: () => void,
  ): void {
    // Create modal container
    this.modalContainer = this.createModalContainer();

    // Create modal content
    const modal = this.createVariableModal(variables, onSubmit, onCancel);
    this.modalContainer.appendChild(modal);

    // Add to document
    document.body.appendChild(this.modalContainer);

    // Focus first input
    const firstInput = modal.querySelector("input") as HTMLInputElement;
    if (firstInput) {
      firstInput.focus();
    }
  }

  /**
   * Create modal container
   */
  private createModalContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = "text-expander-modal-overlay";
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Close on overlay click
    container.addEventListener("click", (e) => {
      if (e.target === container) {
        this.closeModal();
      }
    });

    return container;
  }

  /**
   * Create variable input modal
   */
  private createVariableModal(
    variables: SnippetVariable[],
    onSubmit: (values: Record<string, string>) => void,
    onCancel: () => void,
  ): HTMLElement {
    const modal = document.createElement("div");
    modal.className = "text-expander-variable-modal";
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 20px;
      min-width: ${UI_CONFIG.VARIABLE_MODAL_WIDTH}px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    `;

    // Title
    const title = document.createElement("h3");
    title.textContent = "Enter Variable Values";
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    `;
    modal.appendChild(title);

    // Form
    const form = document.createElement("form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const values = this.collectFormValues(form, variables);
      onSubmit(values);
      this.closeModal();
    });

    // Add variable inputs
    variables.forEach((variable, index) => {
      const fieldContainer = this.createVariableField(variable, index === 0);
      form.appendChild(fieldContainer);
    });

    // Buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 16px;
    `;

    const cancelButton = this.createButton("Cancel", "secondary", () => {
      onCancel();
      this.closeModal();
    });

    const submitButton = this.createButton("Insert", "primary", () => {
      form.dispatchEvent(new Event("submit"));
    });
    submitButton.type = "submit";

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(submitButton);

    form.appendChild(buttonContainer);
    modal.appendChild(form);

    // Handle escape key
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        onCancel();
        this.closeModal();
      }
    });

    return modal;
  }

  /**
   * Create variable input field
   */
  private createVariableField(
    variable: SnippetVariable,
    autoFocus = false,
  ): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      margin-bottom: 12px;
    `;

    const label = document.createElement("label");
    label.textContent = variable.name;
    label.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #555;
      font-size: 13px;
    `;

    let input: HTMLElement;

    if (variable.type === "choice" && variable.choices) {
      // Dropdown for choices
      const select = document.createElement("select");
      select.name = variable.name;
      select.style.cssText = this.getInputStyles();

      // Add empty option if not required
      if (!variable.required) {
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "-- Select --";
        select.appendChild(emptyOption);
      }

      // Add choice options
      variable.choices.forEach((choice) => {
        const option = document.createElement("option");
        option.value = choice;
        option.textContent = choice;
        if (choice === variable.defaultValue) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      input = select;
    } else {
      // Text input
      const textInput = document.createElement("input");
      textInput.type =
        variable.type === "number"
          ? "number"
          : variable.type === "date"
            ? "date"
            : "text";
      textInput.name = variable.name;
      textInput.placeholder = variable.placeholder || `Enter ${variable.name}`;
      textInput.value = variable.defaultValue || "";
      textInput.required = variable.required || false;
      textInput.style.cssText = this.getInputStyles();

      if (autoFocus) {
        textInput.autofocus = true;
      }

      input = textInput;
    }

    container.appendChild(label);
    container.appendChild(input);

    return container;
  }

  /**
   * Get common input styles
   */
  private getInputStyles(): string {
    return `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    `;
  }

  /**
   * Create button element
   */
  private createButton(
    text: string,
    type: "primary" | "secondary",
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = text;
    button.type = "button";
    button.addEventListener("click", onClick);

    const isPrimary = type === "primary";
    button.style.cssText = `
      padding: 8px 16px;
      border: 1px solid ${isPrimary ? "#007bff" : "#ddd"};
      background: ${isPrimary ? "#007bff" : "white"};
      color: ${isPrimary ? "white" : "#333"};
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      min-width: 70px;
    `;

    return button;
  }

  /**
   * Collect form values
   */
  private collectFormValues(
    form: HTMLFormElement,
    variables: SnippetVariable[],
  ): Record<string, string> {
    const values: Record<string, string> = {};

    variables.forEach((variable) => {
      const input = form.querySelector(`[name="${variable.name}"]`) as
        | HTMLInputElement
        | HTMLSelectElement;
      if (input) {
        values[variable.name] = input.value || variable.defaultValue || "";
      }
    });

    return values;
  }

  /**
   * Close modal
   */
  private closeModal(): void {
    if (this.modalContainer) {
      document.body.removeChild(this.modalContainer);
      this.modalContainer = null;
    }
  }

  /**
   * Extract variables from content
   */
  extractVariables(content: string): string[] {
    const variables: string[] = [];
    const matches = content.matchAll(EXPANSION_CONFIG.VARIABLE_PATTERN);

    for (const match of matches) {
      if (match[1] && !variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Validate variable values
   */
  validateVariables(
    variables: SnippetVariable[],
    values: Record<string, string>,
  ): string[] {
    const errors: string[] = [];

    variables.forEach((variable) => {
      const value = values[variable.name];

      if (variable.required && (!value || value.trim() === "")) {
        errors.push(`${variable.name} is required`);
      }

      if (variable.type === "number" && value && isNaN(Number(value))) {
        errors.push(`${variable.name} must be a number`);
      }

      if (variable.choices && value && !variable.choices.includes(value)) {
        errors.push(
          `${variable.name} must be one of: ${variable.choices.join(", ")}`,
        );
      }
    });

    return errors;
  }

  /**
   * Preview text with variables
   */
  previewWithVariables(
    content: string,
    values: Record<string, string>,
  ): string {
    return this.replaceVariables(content, values);
  }
}
