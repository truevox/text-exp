/**
 * Usage Tracker Service
 * Handles snippet usage tracking, priority-based sorting, and cyclic tabbing
 */

import { TextSnippet } from "../shared/types.js";
import { ExtensionStorage } from "../shared/storage.js";

export interface UsageStatistics {
  totalSnippets: number;
  totalUsage: number;
  averageUsage: number;
  mostUsedSnippet: TextSnippet | null;
  leastUsedSnippet: TextSnippet | null;
}

export class UsageTracker {
  private currentCycleIndex = 0;
  private currentTrigger: string | null = null;

  /**
   * Track usage of a snippet by incrementing count and updating timestamp
   */
  async trackUsage(snippet: TextSnippet): Promise<void> {
    // Update usage count
    snippet.usageCount = (snippet.usageCount || 0) + 1;

    // Update last used timestamp
    snippet.lastUsed = new Date();

    // Update the snippet's updatedAt timestamp
    snippet.updatedAt = new Date();

    // Persist the usage data
    await this.saveUsageData(snippet);
  }

  /**
   * Sort snippets by priority (0 = highest) then by usage count (descending)
   */
  sortByPriorityAndUsage(snippets: TextSnippet[]): TextSnippet[] {
    return [...snippets].sort((a, b) => {
      // First sort by priority (0 = highest priority, so ascending order)
      const priorityA = a.priority || 999; // Default to low priority if not set
      const priorityB = b.priority || 999;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If priorities are equal, sort by usage count (descending)
      const usageA = a.usageCount || 0;
      const usageB = b.usageCount || 0;

      return usageB - usageA;
    });
  }

  /**
   * Get all snippets that match a given trigger
   */
  getMatchingSnippets(snippets: TextSnippet[], trigger: string): TextSnippet[] {
    const matchingSnippets = snippets.filter(
      (snippet) => snippet.trigger === trigger,
    );

    // Sort by priority and usage before returning
    return this.sortByPriorityAndUsage(matchingSnippets);
  }

  /**
   * Cycle to the next snippet in the matching list
   */
  cycleToNext(matchingSnippets: TextSnippet[]): TextSnippet {
    if (matchingSnippets.length === 0) {
      throw new Error("No matching snippets to cycle through");
    }

    // Move to next index
    this.currentCycleIndex =
      (this.currentCycleIndex + 1) % matchingSnippets.length;

    return matchingSnippets[this.currentCycleIndex];
  }

  /**
   * Get the current cycle index
   */
  getCurrentCycleIndex(): number {
    return this.currentCycleIndex;
  }

  /**
   * Start a new cycle (reset index to 0)
   */
  startNewCycle(): void {
    this.currentCycleIndex = 0;
    this.currentTrigger = null;
  }

  /**
   * Set the current trigger and reset cycle if it's different
   */
  setCurrentTrigger(trigger: string): void {
    if (this.currentTrigger !== trigger) {
      this.currentTrigger = trigger;
      this.startNewCycle();
    }
  }

  /**
   * Calculate usage statistics for a set of snippets
   */
  getUsageStatistics(snippets: TextSnippet[]): UsageStatistics {
    if (snippets.length === 0) {
      return {
        totalSnippets: 0,
        totalUsage: 0,
        averageUsage: 0,
        mostUsedSnippet: null,
        leastUsedSnippet: null,
      };
    }

    const snippetsWithUsage = snippets.filter(
      (s) => s.usageCount !== undefined,
    );
    const totalUsage = snippetsWithUsage.reduce(
      (sum, snippet) => sum + (snippet.usageCount || 0),
      0,
    );

    // Find most and least used snippets
    const sortedByUsage = [...snippetsWithUsage].sort(
      (a, b) => (b.usageCount || 0) - (a.usageCount || 0),
    );

    return {
      totalSnippets: snippets.length,
      totalUsage,
      averageUsage:
        snippetsWithUsage.length > 0
          ? totalUsage / snippetsWithUsage.length
          : 0,
      mostUsedSnippet: sortedByUsage[0] || null,
      leastUsedSnippet: sortedByUsage[sortedByUsage.length - 1] || null,
    };
  }

  /**
   * Save usage data to storage
   */
  async saveUsageData(snippet: TextSnippet): Promise<void> {
    try {
      // Get all current snippets
      const allSnippets = await ExtensionStorage.getSnippets();

      // Find and update the snippet
      const snippetIndex = allSnippets.findIndex((s) => s.id === snippet.id);
      if (snippetIndex !== -1) {
        allSnippets[snippetIndex] = snippet;

        // Save back to storage
        await ExtensionStorage.setSnippets(allSnippets);
      }
    } catch (error) {
      console.error("Failed to save usage data:", error);
    }
  }

  /**
   * Get the current snippet being cycled through
   */
  getCurrentSnippet(matchingSnippets: TextSnippet[]): TextSnippet | null {
    if (
      matchingSnippets.length === 0 ||
      this.currentCycleIndex >= matchingSnippets.length
    ) {
      return null;
    }

    return matchingSnippets[this.currentCycleIndex];
  }

  /**
   * Get snippets sorted by recent usage
   */
  getRecentlyUsedSnippets(
    snippets: TextSnippet[],
    limit: number = 10,
  ): TextSnippet[] {
    return snippets
      .filter((snippet) => snippet.lastUsed)
      .sort((a, b) => {
        const timeA = a.lastUsed?.getTime() || 0;
        const timeB = b.lastUsed?.getTime() || 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  }

  /**
   * Get the most frequently used snippets
   */
  getMostUsedSnippets(
    snippets: TextSnippet[],
    limit: number = 10,
  ): TextSnippet[] {
    return snippets
      .filter((snippet) => snippet.usageCount && snippet.usageCount > 0)
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }
}
