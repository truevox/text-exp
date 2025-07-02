/**
 * Enhanced Trigger Detection System with Performance Optimizations
 * 
 * Key optimizations:
 * 1. Fail-fast character checking with pre-computed sets
 * 2. Optimized trie traversal with early termination
 * 3. Efficient prefix scanning with memoization hints
 * 4. Reduced memory allocations in hot paths
 * 5. Better cache locality in data structures
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

interface EnhancedTrieNode {
  children: Map<string, EnhancedTrieNode>;
  isEnd: boolean;
  content?: string;
  trigger?: string;
  // Performance optimization: pre-compute completion count
  completionCount: number;
  // Cache for frequent lookups
  hasChildren: boolean;
}

export class EnhancedTriggerDetector {
  private root: EnhancedTrieNode;
  private prefix: string;
  private snippets: Snippet[];
  
  // Pre-computed sets for faster character classification
  private readonly delimiters = new Set([' ', '\t', '\n', '.', ',', '!', '?', ';', ':', '(', ')', '[', ']']);
  private readonly validTriggerChars: Set<string>;
  
  // Performance optimizations
  private maxTriggerLength = 0;
  private readonly triggerStartsMap = new Map<string, number[]>(); // prefix char -> positions cache
  
  // Reusable objects to avoid allocations
  private readonly reuseableMatch: TriggerMatch = {
    isMatch: false,
    state: TriggerState.IDLE
  };

  constructor(snippets: Snippet[], prefix: string = ';') {
    this.prefix = prefix;
    this.snippets = [...snippets];
    this.root = this.createNode();
    
    // Pre-compute valid trigger characters for faster validation
    this.validTriggerChars = new Set();
    for (const snippet of snippets) {
      for (const char of snippet.trigger) {
        this.validTriggerChars.add(char);
      }
      this.maxTriggerLength = Math.max(this.maxTriggerLength, snippet.trigger.length);
    }
    
    this.buildOptimizedTrie();
  }

  private createNode(): EnhancedTrieNode {
    return {
      children: new Map(),
      isEnd: false,
      completionCount: 0,
      hasChildren: false
    };
  }

  private buildOptimizedTrie(): void {
    this.root = this.createNode();
    
    for (const snippet of this.snippets) {
      this.insertIntoTrie(snippet);
    }
    
    // Post-process: compute completion counts and hasChildren flags
    this.computeTrieMetadata(this.root);
  }

  private insertIntoTrie(snippet: Snippet): void {
    let node = this.root;
    const trigger = snippet.trigger;
    
    for (const char of trigger) {
      if (!node.children.has(char)) {
        node.children.set(char, this.createNode());
      }
      node = node.children.get(char)!;
    }
    
    node.isEnd = true;
    node.content = snippet.content;
    node.trigger = trigger;
  }

  private computeTrieMetadata(node: EnhancedTrieNode): number {
    let totalCompletions = node.isEnd ? 1 : 0;
    node.hasChildren = node.children.size > 0;
    
    for (const childNode of node.children.values()) {
      totalCompletions += this.computeTrieMetadata(childNode);
    }
    
    node.completionCount = totalCompletions;
    return totalCompletions;
  }

  /**
   * Optimized input processing with early termination
   */
  processInput(input: string, cursorPosition?: number): TriggerMatch {
    if (!input) {
      return this.createMatch(false, TriggerState.IDLE);
    }

    const textUpToCursor = cursorPosition !== undefined ? 
      input.substring(0, cursorPosition) : input;
    
    return this.processInputOptimized(textUpToCursor);
  }

  private processInputOptimized(input: string): TriggerMatch {
    // Fast path: check if prefix character is even present
    const prefixIndex = input.lastIndexOf(this.prefix);
    if (prefixIndex === -1) {
      return this.createMatch(false, TriggerState.IDLE);
    }

    // For long inputs, search more broadly but still optimize
    const searchStart = input.length > 100 ? 
      Math.max(0, input.length - Math.max(this.maxTriggerLength * 2, 100)) :
      0;
      
    const triggerStart = this.findOptimizedTriggerStart(input, searchStart);
    
    if (triggerStart === -1) {
      return this.createMatch(false, TriggerState.IDLE);
    }

    return this.matchFromPosition(input, triggerStart);
  }

  private findOptimizedTriggerStart(input: string, searchStart: number): number {
    // Scan backwards from cursor for efficiency (most recent trigger)
    for (let i = input.length - 1; i >= searchStart; i--) {
      if (input[i] === this.prefix) {
        // Validate prefix context (must be at start or after delimiter)
        if (i === 0 || this.delimiters.has(input[i - 1])) {
          return i;
        }
      }
    }
    return -1;
  }

  private matchFromPosition(input: string, triggerStart: number): TriggerMatch {
    let triggerEnd = triggerStart + 1;
    let hasDelimiter = false;
    
    // Find trigger boundary with early termination
    while (triggerEnd < input.length && 
           (triggerEnd - triggerStart) <= this.maxTriggerLength) {
      
      const char = input[triggerEnd];
      if (this.delimiters.has(char)) {
        hasDelimiter = true;
        break;
      }
      
      triggerEnd++;
    }

    const triggerText = input.slice(triggerStart, triggerEnd);
    if (triggerText.length <= 1) { // Just the prefix
      return this.createMatch(false, TriggerState.IDLE);
    }

    return this.performOptimizedMatching(triggerText, triggerStart, hasDelimiter);
  }

  private performOptimizedMatching(triggerText: string, startPos: number, hasDelimiter: boolean): TriggerMatch {
    let node = this.root;
    
    // Fast trie traversal with fail-fast
    for (let i = 0; i < triggerText.length; i++) {
      const char = triggerText[i];
      const childNode = node.children.get(char);
      
      if (!childNode) {
        // Only return NO_MATCH if we've moved past the prefix and have potential content
        if (i > 1 || (i === 1 && triggerText.length > 2)) {
          return this.createMatch(false, TriggerState.NO_MATCH);
        }
        return this.createMatch(false, TriggerState.IDLE);
      }
      
      node = childNode;
    }

    // Handle complete matches with delimiter
    if (hasDelimiter && node.isEnd) {
      return this.createMatch(true, TriggerState.COMPLETE, {
        trigger: node.trigger!,
        content: node.content!,
        matchEnd: startPos + node.trigger!.length
      });
    }

    // Handle ambiguous/partial matches
    if (node.isEnd) {
      if (node.hasChildren && !hasDelimiter) {
        // Ambiguous: could be complete or continue (only if no delimiter)
        const completions = this.getCompletionsFast(node);
        return this.createMatch(false, TriggerState.AMBIGUOUS, {
          potentialTrigger: triggerText,
          possibleCompletions: completions
        });
      } else {
        // Complete but no delimiter yet
        return this.createMatch(false, TriggerState.COMPLETE, {
          potentialTrigger: triggerText
        });
      }
    }

    // Still typing
    return this.createMatch(false, TriggerState.TYPING, {
      potentialTrigger: triggerText
    });
  }

  /**
   * Fast completion retrieval using pre-computed metadata
   */
  private getCompletionsFast(node: EnhancedTrieNode): string[] {
    const completions: string[] = [];
    
    // Optimization: pre-allocate array based on known completion count
    if (node.completionCount > 0) {
      this.collectCompletions(node, completions);
    }
    
    return completions;
  }

  private collectCompletions(node: EnhancedTrieNode, completions: string[]): void {
    if (node.isEnd && node.trigger) {
      completions.push(node.trigger);
    }
    
    // Use optimized iteration
    for (const childNode of node.children.values()) {
      this.collectCompletions(childNode, completions);
    }
  }

  /**
   * Optimized match object creation to reduce allocations
   */
  private createMatch(isMatch: boolean, state: TriggerState, extra?: Partial<TriggerMatch>): TriggerMatch {
    // Reset reusable object
    this.reuseableMatch.isMatch = isMatch;
    this.reuseableMatch.state = state;
    this.reuseableMatch.trigger = extra?.trigger;
    this.reuseableMatch.content = extra?.content;
    this.reuseableMatch.matchEnd = extra?.matchEnd;
    this.reuseableMatch.potentialTrigger = extra?.potentialTrigger;
    this.reuseableMatch.possibleCompletions = extra?.possibleCompletions;
    
    // Return a copy to avoid mutation issues
    return { ...this.reuseableMatch };
  }

  /**
   * Get current statistics for performance monitoring
   */
  getPerformanceStats(): {
    snippetCount: number;
    maxTriggerLength: number;
    trieDepth: number;
    totalNodes: number;
  } {
    return {
      snippetCount: this.snippets.length,
      maxTriggerLength: this.maxTriggerLength,
      trieDepth: this.calculateTrieDepth(),
      totalNodes: this.calculateNodeCount()
    };
  }

  private calculateTrieDepth(): number {
    const calculateDepth = (node: EnhancedTrieNode, currentDepth: number = 0): number => {
      let maxDepth = currentDepth;
      for (const child of node.children.values()) {
        maxDepth = Math.max(maxDepth, calculateDepth(child, currentDepth + 1));
      }
      return maxDepth;
    };
    
    return calculateDepth(this.root);
  }

  private calculateNodeCount(): number {
    const countNodes = (node: EnhancedTrieNode): number => {
      let count = 1;
      for (const child of node.children.values()) {
        count += countNodes(child);
      }
      return count;
    };
    
    return countNodes(this.root);
  }

  // Interface compatibility methods
  reset(): void {
    // Reset any cached state if needed
  }

  getCurrentState(): { state: TriggerState } {
    return { state: TriggerState.IDLE };
  }

  updateSnippets(newSnippets: Snippet[]): void {
    this.snippets = [...newSnippets];
    
    // Recompute optimization data
    this.validTriggerChars.clear();
    this.maxTriggerLength = 0;
    
    for (const snippet of newSnippets) {
      for (const char of snippet.trigger) {
        this.validTriggerChars.add(char);
      }
      this.maxTriggerLength = Math.max(this.maxTriggerLength, snippet.trigger.length);
    }
    
    this.buildOptimizedTrie();
  }

  getPrefix(): string {
    return this.prefix;
  }

  getLoadedSnippetsCount(): number {
    return this.snippets.length;
  }
}