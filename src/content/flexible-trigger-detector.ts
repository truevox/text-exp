/**
 * Flexible Trigger Detection System
 * Supports ANY string as a trigger - no prefix assumptions
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
  maxTriggerLength?: number; // Default 10, configurable for performance
  caseSensitive?: boolean; // Default true
}

export class FlexibleTriggerDetector {
  private snippets: Snippet[];
  private options: Required<TriggerDetectorOptions>;
  private delimiters = new Set([
    " ",
    "\t",
    "\n",
    ".",
    ",",
    "!",
    "?",
    ";",
    ":",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
  ]);

  constructor(snippets: Snippet[], options: TriggerDetectorOptions = {}) {
    this.snippets = [...snippets];
    this.options = {
      maxTriggerLength: options.maxTriggerLength ?? 10,
      caseSensitive: options.caseSensitive ?? true,
    };

    // Filter out triggers that are too long
    this.snippets = this.snippets.filter(
      (s) => s.trigger.length <= this.options.maxTriggerLength,
    );
  }

  processInput(input: string, cursorPosition?: number): TriggerMatch {
    if (!input) {
      return { isMatch: false, state: TriggerState.IDLE };
    }

    const textToProcess =
      cursorPosition !== undefined ? input.substring(0, cursorPosition) : input;

    // Scan input from right to left to find the most recent trigger
    for (let i = textToProcess.length - 1; i >= 0; i--) {
      // Check if we're at a valid trigger start position
      if (!this.isValidTriggerStart(textToProcess, i)) {
        continue;
      }

      // Try to match any stored trigger at this position
      const result = this.matchTriggersAtPosition(textToProcess, i);
      if (result.isMatch || result.state !== TriggerState.IDLE) {
        return result;
      }
    }

    return { isMatch: false, state: TriggerState.IDLE };
  }

  private isValidTriggerStart(input: string, position: number): boolean {
    // Trigger can start at beginning of input or after a delimiter
    return position === 0 || this.delimiters.has(input[position - 1]);
  }

  private matchTriggersAtPosition(
    input: string,
    startPos: number,
  ): TriggerMatch {
    const remainingLength = input.length - startPos;
    const maxLength = Math.min(remainingLength, this.options.maxTriggerLength);

    // Check for exact matches first
    for (const snippet of this.snippets) {
      const trigger = snippet.trigger;
      if (trigger.length <= maxLength) {
        const candidate = input.substr(startPos, trigger.length);
        const matches = this.options.caseSensitive
          ? candidate === trigger
          : candidate.toLowerCase() === trigger.toLowerCase();

        if (matches) {
          const endPos = startPos + trigger.length;

          // Check if followed by delimiter or end of input
          if (endPos >= input.length || this.delimiters.has(input[endPos])) {
            return {
              isMatch: true,
              trigger: trigger,
              content: snippet.content,
              matchEnd: endPos,
              state: TriggerState.COMPLETE,
            };
          }
        }
      }
    }

    // Check for partial matches (typing state)
    const typedText = this.extractTypedText(input, startPos);
    if (typedText.length > 0) {
      const possibleMatches = this.findPossibleMatches(typedText);

      if (possibleMatches.length > 0) {
        // Check if any match is exact
        const exactMatch = possibleMatches.find((trigger) =>
          this.options.caseSensitive
            ? trigger === typedText
            : trigger.toLowerCase() === typedText.toLowerCase(),
        );

        if (exactMatch) {
          return {
            isMatch: false,
            state: TriggerState.COMPLETE,
            potentialTrigger: typedText,
          };
        } else if (possibleMatches.length === 1) {
          return {
            isMatch: false,
            state: TriggerState.TYPING,
            potentialTrigger: typedText,
            possibleCompletions: possibleMatches,
          };
        } else {
          return {
            isMatch: false,
            state: TriggerState.AMBIGUOUS,
            potentialTrigger: typedText,
            possibleCompletions: possibleMatches,
          };
        }
      }
    }

    return { isMatch: false, state: TriggerState.IDLE };
  }

  private extractTypedText(input: string, startPos: number): string {
    let endPos = startPos;
    while (endPos < input.length && !this.delimiters.has(input[endPos])) {
      endPos++;
    }
    return input.substring(startPos, endPos);
  }

  private findPossibleMatches(typedText: string): string[] {
    const matches: string[] = [];

    for (const snippet of this.snippets) {
      const trigger = snippet.trigger;
      const startsWithTyped = this.options.caseSensitive
        ? trigger.startsWith(typedText)
        : trigger.toLowerCase().startsWith(typedText.toLowerCase());

      if (startsWithTyped) {
        matches.push(trigger);
      }
    }

    return matches;
  }

  // Interface compatibility methods
  getPrefix(): string {
    return ""; // No prefix in flexible system
  }

  getLoadedSnippetsCount(): number {
    return this.snippets.length;
  }

  reset(): void {
    // Reset any cached state if needed
  }

  getCurrentState(): { state: TriggerState } {
    return { state: TriggerState.IDLE };
  }

  updateSnippets(newSnippets: Snippet[]): void {
    this.snippets = [...newSnippets].filter(
      (s) => s.trigger.length <= this.options.maxTriggerLength,
    );
  }

  // New methods for configuration
  getMaxTriggerLength(): number {
    return this.options.maxTriggerLength;
  }

  updateOptions(options: Partial<TriggerDetectorOptions>): void {
    this.options = { ...this.options, ...options };
    // Re-filter snippets if max length changed
    if (options.maxTriggerLength !== undefined) {
      this.snippets = this.snippets.filter(
        (s) => s.trigger.length <= this.options.maxTriggerLength,
      );
    }
  }
}
