/**
 * Trigger detection system using trie data structure
 * Handles overlapping triggers, context awareness, and efficient matching
 */

export interface Snippet {
  trigger: string;
  content: string;
}

export enum TriggerState {
  IDLE = 'idle',
  TYPING = 'typing',
  COMPLETE = 'complete',
  AMBIGUOUS = 'ambiguous',
  NO_MATCH = 'no_match'
}

export interface TriggerMatch {
  isMatch: boolean;
  trigger?: string;
  content?: string;
  matchEnd?: number;
  state: TriggerState;
  potentialTrigger?: string;
  possibleCompletions?: string[];
}

interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
  content?: string;
  trigger?: string;
}

export class TriggerDetector {
  private root: TrieNode;
  private prefix: string;
  private snippets: Snippet[];
  private delimiters = new Set([' ', '\t', '\n', '.', ',', '!', '?', ';', ':', '(', ')', '[', ']']);

  constructor(snippets: Snippet[], prefix: string = ';') {
    this.prefix = prefix;
    this.snippets = [...snippets];
    this.root = { children: new Map(), isEnd: false };
    this.buildTrie();
  }

  private buildTrie(): void {
    this.root = { children: new Map(), isEnd: false };
    
    for (const snippet of this.snippets) {
      let node = this.root;
      const trigger = snippet.trigger;
      
      for (const char of trigger) {
        if (!node.children.has(char)) {
          node.children.set(char, { children: new Map(), isEnd: false });
        }
        node = node.children.get(char)!;
      }
      
      node.isEnd = true;
      node.content = snippet.content;
      node.trigger = trigger;
    }
  }

  getPrefix(): string {
    return this.prefix;
  }

  getLoadedSnippetsCount(): number {
    return this.snippets.length;
  }

  processInput(input: string, cursorPosition?: number): TriggerMatch {
    // If no cursor position provided, check from beginning
    if (cursorPosition === undefined) {
      return this.processInputWithContext(input, 0);
    }
    
    // Look for trigger at or before cursor position
    const textUpToCursor = input.substring(0, cursorPosition);
    return this.processInputWithContext(textUpToCursor, 0);
  }

  processInputWithContext(input: string, contextStart: number): TriggerMatch {
    if (!input) {
      return { isMatch: false, state: TriggerState.IDLE };
    }

    const triggerStart = this.findTriggerStart(input, contextStart);
    if (triggerStart === -1) {
      return { isMatch: false, state: TriggerState.IDLE };
    }

    // Extract trigger and check if there's a delimiter
    let triggerEnd = triggerStart;
    let hasDelimiter = false;
    
    // Find the end of the trigger (including delimiter if present)
    // Start from triggerStart + 1 to skip the prefix character
    triggerEnd = triggerStart + 1;
    while (triggerEnd < input.length) {
      if (this.delimiters.has(input[triggerEnd])) {
        hasDelimiter = true;
        break;
      }
      triggerEnd++;
    }
    
    const triggerText = input.slice(triggerStart, triggerEnd);
    
    if (!triggerText) {
      return { isMatch: false, state: TriggerState.IDLE };
    }
    return this.matchTriggerWithDelimiter(triggerText, triggerStart, hasDelimiter);
  }

  private findTriggerStart(input: string, contextStart: number): number {
    for (let i = Math.max(0, contextStart); i < input.length; i++) {
      if (input[i] === this.prefix) {
        if (i === 0 || this.delimiters.has(input[i - 1])) {
          return i;
        }
      }
    }
    return -1;
  }

  private extractTriggerText(input: string, start: number): string {
    let end = start;
    
    while (end < input.length && !this.delimiters.has(input[end])) {
      end++;
    }
    
    return input.slice(start, end);
  }

  private matchTriggerWithDelimiter(triggerText: string, startPos: number, hasDelimiter: boolean): TriggerMatch {
    let node = this.root;
    
    // Traverse the trie to see if we can match the trigger
    for (const char of triggerText) {
      if (!node.children.has(char)) {
        return { isMatch: false, state: TriggerState.NO_MATCH };
      }
      node = node.children.get(char)!;
    }
    
    // If we have a delimiter, we can match immediately if this is a valid trigger
    if (hasDelimiter) {
      if (node.isEnd) {
        return {
          isMatch: true,
          trigger: node.trigger!,
          content: node.content!,
          matchEnd: startPos + node.trigger!.length,
          state: TriggerState.COMPLETE
        };
      } else {
        return { isMatch: false, state: TriggerState.NO_MATCH };
      }
    }
    
    // No delimiter - check state
    if (node.isEnd) {
      // This is a complete trigger, but check for longer possibilities
      const possibleCompletions = this.findPossibleCompletions(node);
      
      if (possibleCompletions.length > 0) {
        return {
          isMatch: false,
          state: TriggerState.AMBIGUOUS,
          potentialTrigger: triggerText,
          possibleCompletions
        };
      } else {
        return {
          isMatch: false,
          state: TriggerState.COMPLETE,
          potentialTrigger: triggerText
        };
      }
    }
    
    // Still typing
    return {
      isMatch: false,
      state: TriggerState.TYPING,
      potentialTrigger: triggerText
    };
  }

  private findPossibleCompletions(node: TrieNode): string[] {
    const completions: string[] = [];
    
    const traverse = (currentNode: TrieNode, path: string) => {
      if (currentNode.isEnd && currentNode.trigger) {
        completions.push(currentNode.trigger);
      }
      
      for (const [char, childNode] of currentNode.children) {
        traverse(childNode, path + char);
      }
    };
    
    for (const [char, childNode] of node.children) {
      traverse(childNode, char);
    }
    
    return completions;
  }

  reset(): void {
    // Reset any internal state if needed
  }

  getCurrentState(): { state: TriggerState } {
    return { state: TriggerState.IDLE };
  }

  updateSnippets(newSnippets: Snippet[]): void {
    this.snippets = [...newSnippets];
    this.buildTrie();
  }

}