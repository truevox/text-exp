/**
 * Legacy Migrator for PuffPuffPaste
 * Migrates from current file-per-snippet to priority-tier JSON architecture
 * Works within drive.file scope limitations
 */

import type {
  EnhancedSnippet,
  PriorityTier,
  TierStorageSchema,
} from "../types/snippet-formats.js";
import type { TextSnippet } from "../shared/types.js";
import { JsonSerializer } from "../storage/json-serializer.js";
import { ExtensionStorage } from "../shared/storage.js";

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  tiersCreated: PriorityTier[];
  backupCreated: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Migration options
 */
export interface MigrationOptions {
  createBackup: boolean;
  preserveOriginalFiles: boolean;
  defaultTier: PriorityTier;
  dryRun: boolean;
}

/**
 * Tier assignment rules
 */
interface TierRule {
  condition: (snippet: EnhancedSnippet) => boolean;
  tier: PriorityTier;
  priority: number; // Higher number = higher priority rule
}

/**
 * Handles migration from legacy storage to priority-tier architecture
 */
export class LegacyMigrator {
  private static readonly MIGRATION_VERSION = "1.0.0";
  private static readonly BACKUP_KEY = "pre_migration_backup";

  /**
   * Perform complete migration from legacy to tier-based system
   */
  static async migrate(
    options: MigrationOptions = {
      createBackup: true,
      preserveOriginalFiles: false,
      defaultTier: "personal",
      dryRun: false,
    },
  ): Promise<MigrationResult> {
    console.log("🚀 Starting legacy migration to priority-tier system...");

    try {
      // Step 1: Load existing snippets
      const existingSnippets = await ExtensionStorage.getSnippets();
      console.log(
        `📋 Found ${existingSnippets.length} existing snippets to migrate`,
      );

      if (existingSnippets.length === 0) {
        return {
          success: true,
          migratedCount: 0,
          tiersCreated: [],
          backupCreated: false,
        };
      }

      // Step 2: Create backup if requested
      let backupCreated = false;
      if (options.createBackup && !options.dryRun) {
        await this.createBackup(existingSnippets);
        backupCreated = true;
        console.log("✅ Backup created successfully");
      }

      // Step 3: Convert legacy snippets to enhanced snippets
      const enhancedSnippets = this.convertToEnhancedSnippets(existingSnippets);
      console.log(
        `🔄 Converted ${enhancedSnippets.length} snippets to enhanced format`,
      );

      // Step 4: Assign snippets to tiers
      const tierAssignments = this.assignToTiers(
        enhancedSnippets,
        options.defaultTier,
      );
      console.log(
        "📁 Tier assignments:",
        Object.keys(tierAssignments).map(
          (tier) =>
            `${tier}: ${tierAssignments[tier as PriorityTier].length} snippets`,
        ),
      );

      // Step 5: Create tier schemas
      const tierSchemas = this.createTierSchemas(tierAssignments);

      if (options.dryRun) {
        console.log("🔍 Dry run complete - no changes made");
        return {
          success: true,
          migratedCount: enhancedSnippets.length,
          tiersCreated: Object.keys(tierAssignments) as PriorityTier[],
          backupCreated: false,
        };
      }

      // Step 6: Save tier files (this is where we work within drive.file scope)
      const tiersCreated = await this.saveTierSchemas(tierSchemas);
      console.log(`💾 Saved ${tiersCreated.length} tier files`);

      // Step 7: Update storage system to use new format
      await this.updateStorageToTierBased(tierSchemas);
      console.log("🔄 Storage system updated to tier-based format");

      return {
        success: true,
        migratedCount: enhancedSnippets.length,
        tiersCreated,
        backupCreated,
      };
    } catch (error) {
      console.error("❌ Migration failed:", error);
      return {
        success: false,
        migratedCount: 0,
        tiersCreated: [],
        backupCreated: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Convert legacy TextSnippet to EnhancedSnippet
   */
  private static convertToEnhancedSnippets(
    legacySnippets: TextSnippet[],
  ): EnhancedSnippet[] {
    return legacySnippets.map((legacy) => {
      const now = new Date().toISOString();

      // Determine content type from existing content
      const contentType = this.detectContentType(legacy.content);

      // Extract variables from content (look for {variable} patterns)
      const variables = this.extractVariables(legacy.content);

      const enhanced: EnhancedSnippet = {
        id: legacy.id,
        trigger: legacy.trigger,
        content: legacy.content,
        contentType,
        snipDependencies: [], // Legacy didn't have dependencies
        description:
          legacy.description || `Migrated snippet: ${legacy.trigger}`,
        scope: "personal", // Will be assigned properly later
        priority: 0, // Default priority for migrated snippets
        variables,
        images: [], // Extract from content if needed
        tags: legacy.tags || [],
        createdAt: legacy.createdAt ? legacy.createdAt.toISOString() : now,
        createdBy: "migration",
        updatedAt: legacy.updatedAt ? legacy.updatedAt.toISOString() : now,
        updatedBy: "migration",
      };

      return enhanced;
    });
  }

  /**
   * Detect content type from snippet content
   */
  private static detectContentType(
    content: string,
  ): "html" | "plaintext" | "latex" {
    // Simple heuristic-based detection
    if (content.includes("<") && content.includes(">")) {
      return "html";
    }
    if (
      content.includes("\\") &&
      (content.includes("\\begin") || content.includes("\\end"))
    ) {
      return "latex";
    }
    return "plaintext";
  }

  /**
   * Extract variables from snippet content
   */
  private static extractVariables(content: string): any[] {
    const variableRegex = /\{([^}]+)\}/g;
    const variables: any[] = [];
    const found = new Set<string>();

    let match;
    while ((match = variableRegex.exec(content)) !== null) {
      const varName = match[1];
      if (!found.has(varName)) {
        found.add(varName);
        variables.push({
          name: varName,
          prompt: `Enter value for ${varName}:`,
        });
      }
    }

    return variables;
  }

  /**
   * Assign snippets to tiers based on rules
   */
  private static assignToTiers(
    snippets: EnhancedSnippet[],
    defaultTier: PriorityTier,
  ): Record<PriorityTier, EnhancedSnippet[]> {
    const assignments: Record<PriorityTier, EnhancedSnippet[]> = {
      personal: [],
      team: [],
      org: [],
    };

    // Define tier assignment rules (can be extended)
    const rules: TierRule[] = [
      {
        condition: (s) =>
          (s.tags?.includes("team") ?? false) ||
          (s.description?.toLowerCase().includes("team") ?? false),
        tier: "team",
        priority: 2,
      },
      {
        condition: (s) =>
          (s.tags?.includes("org") ?? false) ||
          (s.tags?.includes("organization") ?? false) ||
          (s.description?.toLowerCase().includes("organization") ?? false),
        tier: "org",
        priority: 3,
      },
      {
        condition: () => true, // Default rule
        tier: defaultTier,
        priority: 1,
      },
    ];

    for (const snippet of snippets) {
      // Find the highest priority matching rule
      const matchingRule = rules
        .filter((rule) => rule.condition(snippet))
        .sort((a, b) => b.priority - a.priority)[0];

      const assignedTier = matchingRule?.tier || defaultTier;

      // Update snippet scope to match assigned tier
      snippet.scope = assignedTier;
      assignments[assignedTier].push(snippet);
    }

    return assignments;
  }

  /**
   * Create tier storage schemas
   */
  private static createTierSchemas(
    tierAssignments: Record<PriorityTier, EnhancedSnippet[]>,
  ): TierStorageSchema[] {
    const schemas: TierStorageSchema[] = [];

    for (const [tier, snippets] of Object.entries(tierAssignments) as [
      PriorityTier,
      EnhancedSnippet[],
    ][]) {
      if (snippets.length > 0) {
        const schema = JsonSerializer.createEmptySchema(tier, "migration");
        schema.snippets = snippets;
        schema.metadata.modified = new Date().toISOString();
        schema.metadata.description = `Migrated ${tier} snippets (${snippets.length} total)`;

        schemas.push(schema);
      }
    }

    return schemas;
  }

  /**
   * Save tier schemas to storage (works within drive.file scope)
   */
  private static async saveTierSchemas(
    schemas: TierStorageSchema[],
  ): Promise<PriorityTier[]> {
    const savedTiers: PriorityTier[] = [];

    for (const schema of schemas) {
      try {
        // For now, save to local storage - will be synced to drive.file later
        const serialized = JsonSerializer.serialize(schema);
        const key = `tier_${schema.tier}`;

        // Save to chrome storage (will be picked up by drive sync)
        await chrome.storage.local.set({ [key]: serialized });

        savedTiers.push(schema.tier);
        console.log(
          `💾 Saved ${schema.tier} tier with ${schema.snippets.length} snippets`,
        );
      } catch (error) {
        console.error(`Failed to save ${schema.tier} tier:`, error);
        throw error;
      }
    }

    return savedTiers;
  }

  /**
   * Update storage system to use tier-based format
   */
  private static async updateStorageToTierBased(
    schemas: TierStorageSchema[],
  ): Promise<void> {
    // Mark migration as complete
    await chrome.storage.local.set({
      migration_completed: true,
      migration_version: this.MIGRATION_VERSION,
      migration_date: new Date().toISOString(),
      tier_count: schemas.length,
    });

    console.log("✅ Migration metadata saved");
  }

  /**
   * Create backup of existing snippets
   */
  private static async createBackup(snippets: TextSnippet[]): Promise<void> {
    const backup = {
      version: this.MIGRATION_VERSION,
      created: new Date().toISOString(),
      snippets,
      count: snippets.length,
    };

    await chrome.storage.local.set({
      [this.BACKUP_KEY]: JSON.stringify(backup),
    });
  }

  /**
   * Restore from backup (rollback migration)
   */
  static async rollback(): Promise<MigrationResult> {
    try {
      console.log("🔄 Rolling back migration...");

      // Get backup
      const result = await chrome.storage.local.get(this.BACKUP_KEY);
      const backupData = result[this.BACKUP_KEY];

      if (!backupData) {
        throw new Error("No backup found");
      }

      const backup = JSON.parse(backupData);
      const snippets: TextSnippet[] = backup.snippets;

      // Restore original snippets
      await ExtensionStorage.setSnippets(snippets);

      // Clear migration flags
      await chrome.storage.local.remove([
        "migration_completed",
        "migration_version",
        "migration_date",
        "tier_count",
        "tier_personal",
        "tier_team",
        "tier_org",
      ]);

      console.log(
        `✅ Rollback complete - restored ${snippets.length} snippets`,
      );

      return {
        success: true,
        migratedCount: snippets.length,
        tiersCreated: [],
        backupCreated: false,
      };
    } catch (error) {
      console.error("❌ Rollback failed:", error);
      return {
        success: false,
        migratedCount: 0,
        tiersCreated: [],
        backupCreated: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if migration is needed
   */
  static async isMigrationNeeded(): Promise<boolean> {
    const result = await chrome.storage.local.get("migration_completed");
    return !result.migration_completed;
  }

  /**
   * Get migration status
   */
  static async getMigrationStatus(): Promise<{
    completed: boolean;
    version?: string;
    date?: string;
    tierCount?: number;
    hasBackup: boolean;
  }> {
    const result = await chrome.storage.local.get([
      "migration_completed",
      "migration_version",
      "migration_date",
      "tier_count",
      this.BACKUP_KEY,
    ]);

    return {
      completed: !!result.migration_completed,
      version: result.migration_version,
      date: result.migration_date,
      tierCount: result.tier_count,
      hasBackup: !!result[this.BACKUP_KEY],
    };
  }
}
