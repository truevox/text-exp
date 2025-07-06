/**
 * DOM Utilities for Content Script
 * Provides utility functions for DOM element inspection and manipulation
 */

/**
 * Check if element is a text input that can be used for text expansion
 * Includes security checks to avoid sensitive fields
 */
export function isTextInput(element: HTMLElement): boolean {
  if (!element) return false;

  // Additional security checks for sensitive contexts
  const autocomplete = (
    element as HTMLInputElement
  ).autocomplete?.toLowerCase();
  if (
    autocomplete &&
    ["current-password", "new-password", "cc-number", "cc-csc"].includes(
      autocomplete,
    )
  ) {
    return false;
  }

  // Check for data-* attributes that might indicate sensitive fields
  const dataset = (element as HTMLElement).dataset;
  if (
    dataset &&
    (dataset.sensitive === "true" || dataset.password === "true")
  ) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();

  // Check for input elements
  if (tagName === "input") {
    const inputType = (element as HTMLInputElement).type.toLowerCase();

    // Explicitly exclude sensitive input types for security
    const excludedTypes = [
      "password",
      "hidden",
      "file",
      "submit",
      "button",
      "reset",
      "image",
      "checkbox",
      "radio",
    ];
    if (excludedTypes.includes(inputType)) {
      return false;
    }

    // Only allow safe text input types
    const allowedTypes = [
      "text",
      "email",
      "search",
      "url",
      "tel",
      "textarea",
    ];
    return allowedTypes.includes(inputType);
  }

  // Check for textarea
  if (tagName === "textarea") {
    return true;
  }

  // Check for contenteditable
  if (element.contentEditable === "true") {
    return true;
  }

  return false;
}

/**
 * Get text content from element
 */
export function getElementText(element: HTMLElement): string {
  if (
    element.tagName.toLowerCase() === "input" ||
    element.tagName.toLowerCase() === "textarea"
  ) {
    return (element as HTMLInputElement | HTMLTextAreaElement).value;
  } else if (element.contentEditable === "true") {
    return element.textContent || "";
  }
  return "";
}

/**
 * Get cursor position in element
 */
export function getCursorPosition(element: HTMLElement): number {
  if (
    element.tagName.toLowerCase() === "input" ||
    element.tagName.toLowerCase() === "textarea"
  ) {
    return (
      (element as HTMLInputElement | HTMLTextAreaElement).selectionStart || 0
    );
  } else if (element.contentEditable === "true") {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      return preCaretRange.toString().length;
    }
  }
  return 0;
}

/**
 * Check if element is content editable
 */
export function isContentEditable(element: HTMLElement): boolean {
  return element.contentEditable === "true" || element.contentEditable === "";
}

/**
 * Set cursor position in element
 */
export function setCursorPosition(element: HTMLElement, position: number): void {
  if (
    element.tagName.toLowerCase() === "input" ||
    element.tagName.toLowerCase() === "textarea"
  ) {
    const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
    inputElement.selectionStart = position;
    inputElement.selectionEnd = position;
  } else if (element.contentEditable === "true") {
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      const textNode = element.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        range.setStart(textNode, Math.min(position, textNode.textContent?.length || 0));
        range.setEnd(textNode, Math.min(position, textNode.textContent?.length || 0));
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }
}

/**
 * Check if element is focused
 */
export function isFocused(element: HTMLElement): boolean {
  return document.activeElement === element;
}

/**
 * Get the closest text input element (for delegation scenarios)
 */
export function getClosestTextInput(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element;
  while (current) {
    if (isTextInput(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}