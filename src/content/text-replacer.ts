/**
 * Text Replacement for Text Expansion
 * Handles the actual replacement of trigger text with expanded content
 */

import type { ReplacementContext } from '../shared/types.js';

/**
 * Handles text replacement in various input types
 */
export class TextReplacer {
  
  /**
   * Replace text in the given context
   */
  replaceText(context: ReplacementContext, newText: string): void {
    const { element, startOffset, endOffset } = context;
    
    try {
      if (this.isFormInput(element)) {
        this.replaceInFormInput(element as HTMLInputElement | HTMLTextAreaElement, startOffset, endOffset, newText);
      } else if (this.isContentEditable(element)) {
        this.replaceInContentEditable(element, startOffset, endOffset, newText);
      } else {
        console.warn('Unsupported element type for text replacement');
      }
      
      // Trigger input event to notify other scripts
      this.triggerInputEvent(element);
      
    } catch (error) {
      console.error('Error replacing text:', error);
    }
  }

  /**
   * Replace text in form inputs (input, textarea)
   */
  private replaceInFormInput(
    element: HTMLInputElement | HTMLTextAreaElement,
    startOffset: number,
    endOffset: number,
    newText: string
  ): void {
    const currentValue = element.value;
    const beforeText = currentValue.substring(0, startOffset);
    const afterText = currentValue.substring(endOffset);
    
    // Create new value
    const newValue = beforeText + newText + afterText;
    
    // Update the input value
    element.value = newValue;
    
    // Set cursor position after the inserted text
    const newCursorPosition = startOffset + newText.length;
    element.setSelectionRange(newCursorPosition, newCursorPosition);
    
    // Focus the element to ensure cursor is visible
    element.focus();
  }

  /**
   * Replace text in contenteditable elements
   */
  private replaceInContentEditable(
    element: HTMLElement,
    startOffset: number,
    endOffset: number,
    newText: string
  ): void {
    const selection = window.getSelection();
    if (!selection) return;
    
    // Create a range for the text to replace
    const range = this.createRangeFromOffsets(element, startOffset, endOffset);
    if (!range) return;
    
    // Select the range
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Replace the selected text
    if (selection.rangeCount > 0) {
      const selectedRange = selection.getRangeAt(0);
      selectedRange.deleteContents();
      
      // Insert new text
      const textNode = document.createTextNode(newText);
      selectedRange.insertNode(textNode);
      
      // Position cursor after inserted text
      selectedRange.setStartAfter(textNode);
      selectedRange.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  }

  /**
   * Create a range from text offsets in a contenteditable element
   */
  private createRangeFromOffsets(element: HTMLElement, startOffset: number, endOffset: number): Range | null {
    const range = document.createRange();
    let currentOffset = 0;
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let startNode: Node | null = null;
    let endNode: Node | null = null;
    let startNodeOffset = 0;
    let endNodeOffset = 0;
    
    let node;
    while (node = walker.nextNode()) {
      const nodeLength = node.textContent?.length || 0;
      
      // Find start position
      if (!startNode && currentOffset + nodeLength >= startOffset) {
        startNode = node;
        startNodeOffset = startOffset - currentOffset;
      }
      
      // Find end position
      if (!endNode && currentOffset + nodeLength >= endOffset) {
        endNode = node;
        endNodeOffset = endOffset - currentOffset;
        break;
      }
      
      currentOffset += nodeLength;
    }
    
    if (startNode && endNode) {
      try {
        range.setStart(startNode, startNodeOffset);
        range.setEnd(endNode, endNodeOffset);
        return range;
      } catch (error) {
        console.error('Error creating range:', error);
        return null;
      }
    }
    
    return null;
  }

  /**
   * Insert text at cursor position
   */
  insertTextAtCursor(element: HTMLElement, text: string): void {
    if (this.isFormInput(element)) {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      const cursorPosition = input.selectionStart || 0;
      const currentValue = input.value;
      
      const newValue = currentValue.substring(0, cursorPosition) + text + currentValue.substring(cursorPosition);
      input.value = newValue;
      
      // Set cursor after inserted text
      const newPosition = cursorPosition + text.length;
      input.setSelectionRange(newPosition, newPosition);
      
    } else if (this.isContentEditable(element)) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        // Move cursor after inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    this.triggerInputEvent(element);
  }

  /**
   * Replace selected text
   */
  replaceSelectedText(element: HTMLElement, newText: string): void {
    if (this.isFormInput(element)) {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      
      const currentValue = input.value;
      const newValue = currentValue.substring(0, start) + newText + currentValue.substring(end);
      input.value = newValue;
      
      // Set cursor after replacement
      const newPosition = start + newText.length;
      input.setSelectionRange(newPosition, newPosition);
      
    } else if (this.isContentEditable(element)) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const textNode = document.createTextNode(newText);
        range.insertNode(textNode);
        
        // Move cursor after replacement
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    this.triggerInputEvent(element);
  }

  /**
   * Get selected text from element
   */
  getSelectedText(element: HTMLElement): string {
    if (this.isFormInput(element)) {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      return input.value.substring(start, end);
    } else if (this.isContentEditable(element)) {
      const selection = window.getSelection();
      return selection ? selection.toString() : '';
    }
    return '';
  }

  /**
   * Check if element is a form input
   */
  private isFormInput(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea';
  }

  /**
   * Check if element is contenteditable
   */
  private isContentEditable(element: HTMLElement): boolean {
    return element.contentEditable === 'true';
  }

  /**
   * Trigger input event to notify other scripts of changes
   */
  private triggerInputEvent(element: HTMLElement): void {
    try {
      // Create and dispatch input event
      const inputEvent = new Event('input', {
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(inputEvent);
      
      // Also trigger change event for form inputs
      if (this.isFormInput(element)) {
        const changeEvent = new Event('change', {
          bubbles: true,
          cancelable: true
        });
        element.dispatchEvent(changeEvent);
      }
    } catch (error) {
      console.error('Error triggering input event:', error);
    }
  }

  /**
   * Undo last replacement (if possible)
   */
  undoLastReplacement(element: HTMLElement): void {
    // This would require keeping track of replacement history
    // For now, just trigger undo via keyboard shortcut simulation
    if (document.activeElement === element) {
      // Simulate Ctrl+Z
      const undoEvent = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(undoEvent);
    }
  }

  /**
   * Clear all text in element
   */
  clearText(element: HTMLElement): void {
    if (this.isFormInput(element)) {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      input.value = '';
      input.setSelectionRange(0, 0);
    } else if (this.isContentEditable(element)) {
      element.textContent = '';
      // Set cursor to beginning
      const range = document.createRange();
      const selection = window.getSelection();
      if (selection) {
        range.setStart(element, 0);
        range.setEnd(element, 0);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    this.triggerInputEvent(element);
  }

  /**
   * Get cursor position in element
   */
  getCursorPosition(element: HTMLElement): number {
    if (this.isFormInput(element)) {
      return (element as HTMLInputElement | HTMLTextAreaElement).selectionStart || 0;
    } else if (this.isContentEditable(element)) {
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
   * Set cursor position in element
   */
  setCursorPosition(element: HTMLElement, position: number): void {
    if (this.isFormInput(element)) {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      input.setSelectionRange(position, position);
    } else if (this.isContentEditable(element)) {
      const range = document.createRange();
      const selection = window.getSelection();
      
      if (!selection) return;
      
      let currentPosition = 0;
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        const nodeLength = node.textContent?.length || 0;
        if (currentPosition + nodeLength >= position) {
          range.setStart(node, position - currentPosition);
          range.setEnd(node, position - currentPosition);
          break;
        }
        currentPosition += nodeLength;
      }
      
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}