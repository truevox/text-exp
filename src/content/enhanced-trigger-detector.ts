/**
 * Enhanced Trigger Detection System with Ultra Performance Optimizations
 *
 * Key optimizations:
 * 1. Static character set validation with O(1) lookup
 * 2. Optimized trie traversal with early termination
 * 3. Efficient prefix scanning with memoization hints
 * 4. Reduced memory allocations in hot paths
 * 5. Better cache locality in data structures
 * 6. Constraint-based delimiter detection (space/tab/newline = auto-reset)
 */

export interface Snippet {
  trigger: string;
  content: string;
}

export enum TriggerState {
  IDLE = "idle",
  TYPING = "typing",
  COMPLETE = "complete",
  AMBIGUOUS = "ambiguous",
  NO_MATCH = "no_match",
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

export interface TriggerDetectorOptions {
  maxTriggerLength?: number; // Default 20, configurable for performance
  caseSensitive?: boolean; // Default true
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
  private options: Required<TriggerDetectorOptions>;

  // Static character validation for ultra-fast O(1) lookup
  // Trigger chars: A-Za-z0-9,./;'[]`~!@#$%^&*()_+-=
  private static readonly TRIGGER_CHAR_SET = new Set([
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    ",",
    ".",
    "/",
    ";",
    "'",
    "[",
    "]",
    "\\",
    "`",
    "~",
    "!",
    "@",
    "#",
    "$",
    "%",
    "^",
    "&",
    "*",
    "(",
    ")",
    "_",
    "+",
    "-",
    "=",
  ]);

  // Simplified delimiter detection: anything not in trigger set is a delimiter
  // Primary delimiters that trigger immediate evaluation: space, tab, newline
  private static readonly PRIMARY_DELIMITERS = new Set([" ", "\t", "\n", "\r"]);

  // Performance optimizations
  private maxTriggerLength = 0;
  private readonly triggerStartsMap = new Map<string, number[]>(); // prefix char -> positions cache

  // Reusable objects to avoid allocations
  private readonly reuseableMatch: TriggerMatch = {
    isMatch: false,
    state: TriggerState.IDLE,
  };

  constructor(
    snippets: Snippet[],
    prefix: string = ";",
    options: TriggerDetectorOptions = {},
  ) {
    this.prefix = prefix;
    this.snippets = [...snippets];
    this.root = this.createNode();

    // Set default options
    this.options = {
      maxTriggerLength: options.maxTriggerLength ?? 20,
      caseSensitive: options.caseSensitive ?? true,
    };

    // Compute max trigger length (constrained by options)
    for (const snippet of snippets) {
      this.maxTriggerLength = Math.max(
        this.maxTriggerLength,
        Math.min(snippet.trigger.length, this.options.maxTriggerLength),
      );
    }

    this.buildOptimizedTrie();
  }

  // Ultra-fast static character validation
  private static isValidTriggerChar(char: string): boolean {
    return EnhancedTriggerDetector.TRIGGER_CHAR_SET.has(char);
  }

  // Fast delimiter detection using constraint knowledge
  private static isPrimaryDelimiter(char: string): boolean {
    return EnhancedTriggerDetector.PRIMARY_DELIMITERS.has(char);
  }

  // Any character not in trigger set is a delimiter
  private static isDelimiter(char: string): boolean {
    return !EnhancedTriggerDetector.TRIGGER_CHAR_SET.has(char);
  }

  // Case-sensitive/insensitive character normalization
  private normalizeChar(char: string): string {
    return this.options.caseSensitive ? char : char.toLowerCase();
  }

  // Case-sensitive/insensitive string normalization
  private normalizeString(str: string): string {
    return this.options.caseSensitive ? str : str.toLowerCase();
  }

  // Configuration methods
  getOptions(): Required<TriggerDetectorOptions> {
    return { ...this.options };
  }

  getMaxTriggerLength(): number {
    return this.options.maxTriggerLength;
  }

  updateOptions(newOptions: Partial<TriggerDetectorOptions>): void {
    const optionsChanged =
      (newOptions.caseSensitive !== undefined &&
        newOptions.caseSensitive !== this.options.caseSensitive) ||
      (newOptions.maxTriggerLength !== undefined &&
        newOptions.maxTriggerLength !== this.options.maxTriggerLength);

    this.options = {
      ...this.options,
      ...newOptions,
    };

    // Rebuild trie if case sensitivity changed
    if (optionsChanged) {
      this.maxTriggerLength = 0;
      for (const snippet of this.snippets) {
        this.maxTriggerLength = Math.max(
          this.maxTriggerLength,
          Math.min(snippet.trigger.length, this.options.maxTriggerLength),
        );
      }
      this.buildOptimizedTrie();
    }
  }

  private createNode(): EnhancedTrieNode {
    return {
      children: new Map(),
      isEnd: false,
      completionCount: 0,
      hasChildren: false,
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
    const trigger = this.normalizeString(snippet.trigger);

    for (const char of trigger) {
      const normalizedChar = this.normalizeChar(char);
      if (!node.children.has(normalizedChar)) {
        node.children.set(normalizedChar, this.createNode());
      }
      node = node.children.get(normalizedChar)!;
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

    const textUpToCursor =
      cursorPosition !== undefined ? input.substring(0, cursorPosition) : input;

    const result = this.processInputOptimized(textUpToCursor);

    // DEBUG: Log trigger detection attempts
    if (result.isMatch) {
      console.log(
        `🎯 [TRIGGER-DEBUG] Match found for input "${textUpToCursor}": "${result.trigger}"`,
      );
    } else if (result.potentialTrigger) {
      console.log(
        `🤔 [TRIGGER-DEBUG] Potential trigger detected: "${result.potentialTrigger}" (state: ${result.state})`,
      );
    }

    return result;
  }

  private processInputOptimized(input: string): TriggerMatch {
    // For long inputs, search more broadly but still optimize
    // For non-prefixed triggers, we need to search more broadly since they can appear anywhere
    const searchStart =
      input.length > 100
        ? Math.max(0, input.length - Math.max(this.maxTriggerLength * 2, 600))
        : 0;

    // Try to find triggers with prefix first
    const prefixIndex = input.lastIndexOf(this.prefix);
    if (prefixIndex !== -1) {
      const triggerStart = this.findOptimizedTriggerStart(input, searchStart);
      if (triggerStart !== -1) {
        const prefixedResult = this.matchFromPosition(input, triggerStart);
        if (
          prefixedResult.isMatch ||
          prefixedResult.state !== TriggerState.IDLE
        ) {
          return prefixedResult;
        }
      }
    }

    // Only check for non-prefixed triggers if no valid prefixed trigger was found
    // AND there's no prefix character that would indicate intent for a prefixed trigger
    const lastPrefixPos = input.lastIndexOf(this.prefix);
    const shouldCheckNonPrefixed =
      lastPrefixPos === -1 ||
      lastPrefixPos < input.length - this.maxTriggerLength;

    if (shouldCheckNonPrefixed) {
      const nonPrefixedResult = this.findNonPrefixedTrigger(input, searchStart);
      if (
        nonPrefixedResult.isMatch ||
        nonPrefixedResult.state !== TriggerState.IDLE
      ) {
        return nonPrefixedResult;
      }
    }

    return this.createMatch(false, TriggerState.IDLE);
  }

  private findOptimizedTriggerStart(
    input: string,
    searchStart: number,
  ): number {
    // Scan backwards from cursor for efficiency (most recent trigger)
    for (let i = input.length - 1; i >= searchStart; i--) {
      if (input[i] === this.prefix) {
        // Validate prefix context (must be at start or after delimiter)
        if (i === 0 || EnhancedTriggerDetector.isDelimiter(input[i - 1])) {
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
    // We scan until we find a delimiter that's not part of any valid trigger
    while (
      triggerEnd < input.length &&
      triggerEnd - triggerStart <= this.maxTriggerLength
    ) {
      const char = input[triggerEnd];

      // Check if this character could be part of a trigger
      // Only stop if it's a delimiter AND it's not part of any valid trigger pattern
      if (EnhancedTriggerDetector.isDelimiter(char)) {
        const potentialTrigger = input.slice(triggerStart, triggerEnd + 1);

        // Check if any snippet has this potential trigger as a prefix (case-aware)
        const normalizedPotentialTrigger =
          this.normalizeString(potentialTrigger);
        const hasMatchingTrigger = this.snippets.some((snippet) => {
          const normalizedTrigger = this.normalizeString(snippet.trigger);
          return (
            normalizedTrigger.startsWith(normalizedPotentialTrigger) ||
            normalizedTrigger === normalizedPotentialTrigger
          );
        });

        if (!hasMatchingTrigger) {
          hasDelimiter = true;
          break;
        }
      }

      triggerEnd++;
    }

    const triggerText = input.slice(triggerStart, triggerEnd);
    if (triggerText.length <= 1) {
      // Just the prefix
      return this.createMatch(false, TriggerState.IDLE);
    }

    return this.performOptimizedMatching(
      triggerText,
      triggerStart,
      hasDelimiter,
    );
  }

  private performOptimizedMatching(
    triggerText: string,
    startPos: number,
    hasDelimiter: boolean,
  ): TriggerMatch {
    let node = this.root;

    // Fast trie traversal with fail-fast (case-aware)
    for (let i = 0; i < triggerText.length; i++) {
      const char = this.normalizeChar(triggerText[i]);
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
        matchEnd: startPos + node.trigger!.length,
      });
    }

    // Handle ambiguous/partial matches
    if (node.isEnd) {
      if (node.hasChildren && !hasDelimiter) {
        // Ambiguous: could be complete or continue (only if no delimiter)
        const completions = this.getCompletionsFast(node);
        return this.createMatch(false, TriggerState.AMBIGUOUS, {
          potentialTrigger: triggerText,
          possibleCompletions: completions,
        });
      } else {
        // Complete but no delimiter yet - should still be a valid match
        return this.createMatch(true, TriggerState.COMPLETE, {
          trigger: node.trigger!,
          content: node.content!,
          matchEnd: startPos + node.trigger!.length,
        });
      }
    }

    // Still typing
    return this.createMatch(false, TriggerState.TYPING, {
      potentialTrigger: triggerText,
    });
  }

  /**
   * Find non-prefixed triggers by checking word boundaries
   */
  private findNonPrefixedTrigger(
    input: string,
    searchStart: number,
  ): TriggerMatch {
    // Find word boundaries from the end of input backwards
    // This ensures we find the rightmost (most recent) trigger first
    for (let end = input.length; end > searchStart; end--) {
      // Check all possible starting positions for this ending position
      for (
        let start = Math.max(searchStart, end - this.maxTriggerLength);
        start < end;
        start++
      ) {
        // Verify proper word boundaries for this potential trigger
        const beforeChar = start > 0 ? input[start - 1] : null;
        const afterChar = end < input.length ? input[end] : null;

        // Must be at start of input or after a delimiter
        // With static character constraint, this is much simpler
        if (
          beforeChar !== null &&
          EnhancedTriggerDetector.isValidTriggerChar(beforeChar)
        ) {
          continue;
        }

        const potentialTrigger = input.slice(start, end);

        // Check if this could be a valid trigger (exact match or partial match, case-aware)
        const normalizedPotentialTrigger =
          this.normalizeString(potentialTrigger);
        const exactMatch = this.snippets.find((snippet) => {
          const normalizedTrigger = this.normalizeString(snippet.trigger);
          return (
            !snippet.trigger.startsWith(this.prefix) &&
            normalizedTrigger === normalizedPotentialTrigger
          );
        });

        const partialMatch = this.snippets.find((snippet) => {
          const normalizedTrigger = this.normalizeString(snippet.trigger);
          return (
            !snippet.trigger.startsWith(this.prefix) &&
            normalizedTrigger.startsWith(normalizedPotentialTrigger) &&
            normalizedTrigger !== normalizedPotentialTrigger
          );
        });

        if (!exactMatch && !partialMatch) {
          continue; // Not a valid trigger or partial trigger
        }

        // For exact matches, check proper end boundaries
        if (exactMatch && afterChar !== null) {
          // Special handling for triggers ending with punctuation
          if (
            potentialTrigger.endsWith("!") ||
            potentialTrigger.endsWith("?") ||
            potentialTrigger.endsWith(":") ||
            potentialTrigger.endsWith(".")
          ) {
            // For triggers ending with punctuation, next char must be whitespace or different punctuation
            // But NOT the same punctuation (e.g., gg!! should not match gg!)
            if (
              afterChar === potentialTrigger.charAt(potentialTrigger.length - 1)
            ) {
              continue; // Same punctuation repeated
            }
            if (
              !EnhancedTriggerDetector.isPrimaryDelimiter(afterChar) &&
              EnhancedTriggerDetector.isValidTriggerChar(afterChar)
            ) {
              continue;
            }
          } else {
            // For regular triggers, must not be followed by valid trigger characters
            if (EnhancedTriggerDetector.isValidTriggerChar(afterChar)) {
              continue;
            }
          }
        }

        // Check if this matches any non-prefixed trigger
        const isAtEnd = end === input.length;
        const matchResult = this.matchNonPrefixedTrigger(
          potentialTrigger,
          start,
          isAtEnd,
        );
        if (matchResult.isMatch || matchResult.state !== TriggerState.IDLE) {
          return matchResult;
        }
      }
    }

    return this.createMatch(false, TriggerState.IDLE);
  }

  /**
   * Check if a word matches a non-prefixed trigger
   */
  private matchNonPrefixedTrigger(
    wordText: string,
    startPos: number,
    isAtEnd: boolean,
  ): TriggerMatch {
    // Look for exact matches in our snippets that don't start with prefix (case-aware)
    const normalizedWordText = this.normalizeString(wordText);
    for (const snippet of this.snippets) {
      const normalizedTrigger = this.normalizeString(snippet.trigger);
      if (
        !snippet.trigger.startsWith(this.prefix) &&
        normalizedTrigger === normalizedWordText
      ) {
        // For non-prefixed triggers, we complete when:
        // 1. We're at the end of the input (isAtEnd = true), OR
        // 2. The word is followed by a delimiter (isAtEnd = false means delimiter found)
        return this.createMatch(true, TriggerState.COMPLETE, {
          trigger: snippet.trigger,
          content: snippet.content,
          matchEnd: startPos + snippet.trigger.length,
        });
      }
    }

    // Check for partial matches - only when we're at the end (still typing, case-aware)
    if (isAtEnd) {
      for (const snippet of this.snippets) {
        const normalizedTrigger = this.normalizeString(snippet.trigger);
        if (
          !snippet.trigger.startsWith(this.prefix) &&
          normalizedTrigger.startsWith(normalizedWordText)
        ) {
          return this.createMatch(false, TriggerState.TYPING, {
            potentialTrigger: wordText,
          });
        }
      }
    }

    return this.createMatch(false, TriggerState.IDLE);
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

  private collectCompletions(
    node: EnhancedTrieNode,
    completions: string[],
  ): void {
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
  private createMatch(
    isMatch: boolean,
    state: TriggerState,
    extra?: Partial<TriggerMatch>,
  ): TriggerMatch {
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
      totalNodes: this.calculateNodeCount(),
    };
  }

  private calculateTrieDepth(): number {
    const calculateDepth = (
      node: EnhancedTrieNode,
      currentDepth: number = 0,
    ): number => {
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

    // DEBUG: Log triggers being registered
    console.log(
      `🔍 [TRIGGER-DEBUG] Registering ${newSnippets.length} triggers in detector:`,
    );
    newSnippets.forEach((snippet, index) => {
      console.log(
        `  🎯 Trigger ${index + 1}: "${snippet.trigger}" (${(snippet as any).source || "unknown"})`,
      );
    });

    // Specific debug for our test triggers
    const eataTrigger = newSnippets.find((s) => s.trigger === ";eata");
    const ponyTrigger = newSnippets.find((s) => s.trigger === ";pony");

    if (eataTrigger) {
      console.log(`✅ [TRIGGER-REGISTER] ;eata registered in detector:`, {
        id: (eataTrigger as any).id,
        trigger: eataTrigger.trigger,
        content: eataTrigger.content?.substring(0, 30) + "...",
        source: (eataTrigger as any).source,
      });
    } else {
      console.warn(`❌ [TRIGGER-REGISTER] ;eata NOT registered in detector`);
    }

    if (ponyTrigger) {
      console.log(`✅ [TRIGGER-REGISTER] ;pony registered in detector:`, {
        id: (ponyTrigger as any).id,
        trigger: ponyTrigger.trigger,
        content: ponyTrigger.content?.substring(0, 30) + "...",
        source: (ponyTrigger as any).source,
      });
    } else {
      console.warn(`❌ [TRIGGER-REGISTER] ;pony NOT registered in detector`);
    }

    // Recompute optimization data (character validation is now static)
    this.maxTriggerLength = 0;

    for (const snippet of newSnippets) {
      this.maxTriggerLength = Math.max(
        this.maxTriggerLength,
        snippet.trigger.length,
      );
    }

    this.buildOptimizedTrie();

    // DEBUG: Verify trie construction for our test triggers
    if (eataTrigger) {
      const eataTriggerTest = this.processInput(";eata ");
      console.log(`🔍 [TRIE-TEST] ;eata trigger test result:`, eataTriggerTest);
    }

    if (ponyTrigger) {
      const ponyTriggerTest = this.processInput(";pony ");
      console.log(`🔍 [TRIE-TEST] ;pony trigger test result:`, ponyTriggerTest);
    }
  }

  getPrefix(): string {
    return this.prefix;
  }

  getLoadedSnippetsCount(): number {
    return this.snippets.length;
  }
}
