/**
 * Migration Scheduler
 * Handles automatic migration on first launch after updates
 */

import type { TextSnippet } from "../shared/types.js";
import type {
  PriorityTier,
  TierStorageSchema,
} from "../types/snippet-formats.js";

export interface MigrationStatus {
  isRequired: boolean;
  currentVersion: string;
  targetVersion: string;
  lastMigration?: string;
  pendingMigrations: string[];
}

export interface MigrationResult {
  success: boolean;
  migrationsRun: string[];
  errors: string[];
  warnings: string[];
  migratedSnippetsCount: number;
  duration: number;
}

export interface MigrationStep {
  id: string;
  version: string;
  description: string;
  execute: () => Promise<void>;
  rollback?: () => Promise<void>;
  validate?: () => Promise<boolean>;
}

/**
 * Migration scheduler for handling version updates
 */
export class MigrationScheduler {
  private currentVersion: string;
  private migrationSteps: MigrationStep[] = [];
  private storageKey = "migration-status";

  constructor(currentVersion: string) {
    this.currentVersion = currentVersion;
    this.registerMigrationSteps();
  }

  /**
   * Register all migration steps
   */
  private registerMigrationSteps(): void {
    // Migration from legacy format to tier-based architecture
    this.addMigrationStep({
      id: "tier-based-migration",
      version: "0.5.0",
      description:
        "Migrate snippets from file-per-snippet to tier-based JSON stores",
      execute: async () => {
        await this.migrateLegacySnippetsToTiers();
      },
      validate: async () => {
        return await this.validateTierMigration();
      },
    });

    // Migration for priority system
    this.addMigrationStep({
      id: "priority-system-migration",
      version: "0.5.1",
      description: "Add priority fields to existing snippets",
      execute: async () => {
        await this.addPriorityFieldsToSnippets();
      },
    });

    // Migration for enhanced metadata
    this.addMigrationStep({
      id: "enhanced-metadata-migration",
      version: "0.5.2",
      description: "Enhance snippet metadata with new required fields",
      execute: async () => {
        await this.enhanceSnippetMetadata();
      },
    });
  }

  /**
   * Add a migration step
   */
  addMigrationStep(step: MigrationStep): void {
    this.migrationSteps.push(step);
    // Sort by version
    this.migrationSteps.sort((a, b) =>
      this.compareVersions(a.version, b.version),
    );
  }

  /**
   * Check if migration is required
   */
  async checkMigrationRequired(): Promise<MigrationStatus> {
    const status = await this.getMigrationStatus();
    const pendingMigrations = this.getPendingMigrations(
      status.lastMigration || "0.0.0",
    );

    return {
      isRequired: pendingMigrations.length > 0,
      currentVersion: this.currentVersion,
      targetVersion: this.currentVersion,
      lastMigration: status.lastMigration,
      pendingMigrations: pendingMigrations.map((step) => step.id),
    };
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      migrationsRun: [],
      errors: [],
      warnings: [],
      migratedSnippetsCount: 0,
      duration: 0,
    };

    try {
      console.log("🔄 Starting migration process...");

      const status = await this.getMigrationStatus();
      const pendingMigrations = this.getPendingMigrations(
        status.lastMigration || "0.0.0",
      );

      if (pendingMigrations.length === 0) {
        console.log("✅ No migrations required");
        result.success = true;
        return result;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending migrations`);

      // Run each migration step
      for (const step of pendingMigrations) {
        try {
          console.log(`🔧 Running migration: ${step.description}`);

          // Validate pre-conditions if validator exists
          if (step.validate) {
            const isValid = await step.validate();
            if (!isValid) {
              throw new Error(`Pre-migration validation failed for ${step.id}`);
            }
          }

          // Execute migration
          await step.execute();

          // Update status
          await this.updateMigrationStatus(step.version);
          result.migrationsRun.push(step.id);

          console.log(`✅ Completed migration: ${step.id}`);
        } catch (error) {
          console.error(`❌ Migration failed: ${step.id}`, error);
          result.errors.push(
            `${step.id}: ${error instanceof Error ? error.message : String(error)}`,
          );

          // Attempt rollback if available
          if (step.rollback) {
            try {
              console.log(`🔄 Rolling back migration: ${step.id}`);
              await step.rollback();
              console.log(`✅ Rollback successful: ${step.id}`);
            } catch (rollbackError) {
              console.error(`❌ Rollback failed: ${step.id}`, rollbackError);
              result.errors.push(
                `Rollback failed for ${step.id}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
              );
            }
          }

          // Stop on first failure
          break;
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      if (result.success) {
        console.log(
          `✅ All migrations completed successfully in ${result.duration}ms`,
        );
      } else {
        console.log(
          `❌ Migration process failed with ${result.errors.length} errors`,
        );
      }
    } catch (error) {
      console.error("❌ Migration process crashed:", error);
      result.errors.push(
        `Migration process crashed: ${error instanceof Error ? error.message : String(error)}`,
      );
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Migrate legacy snippets to tier-based architecture
   */
  private async migrateLegacySnippetsToTiers(): Promise<void> {
    console.log("🔄 Migrating legacy snippets to tier-based architecture...");

    // Load existing snippets from Chrome storage
    const existingSnippets = await this.loadLegacySnippets();
    console.log(`📊 Found ${existingSnippets.length} legacy snippets`);

    if (existingSnippets.length === 0) {
      console.log("ℹ️ No legacy snippets found, skipping migration");
      return;
    }

    // Group snippets by scope/tier
    const snippetsByTier = this.groupSnippetsByTier(existingSnippets);

    // Create tier-based stores
    for (const [tier, snippets] of Object.entries(snippetsByTier)) {
      if (snippets.length === 0) continue;

      console.log(`📁 Migrating ${snippets.length} snippets to ${tier} tier`);

      const tierData: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: tier as PriorityTier,
        snippets: snippets.map((snippet) =>
          this.convertToEnhancedSnippet(snippet, tier as PriorityTier),
        ),
        metadata: {
          version: this.currentVersion,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "user",
          description: `Migrated ${tier} snippets from legacy format`,
        },
      };

      // Sort by priority (highest first)
      tierData.snippets.sort(
        (a, b) => (b as any).priority - (a as any).priority,
      );

      // Save to Chrome storage with new key
      const storageKey = `tier-${tier}`;
      await chrome.storage.local.set({ [storageKey]: tierData });
      console.log(
        `💾 Saved ${tier} tier with ${tierData.snippets.length} snippets`,
      );
    }

    // Create backup of legacy data before removal
    const backupKey = `legacy-backup-${Date.now()}`;
    await chrome.storage.local.set({ [backupKey]: existingSnippets });
    console.log(`💾 Created backup of legacy snippets: ${backupKey}`);

    // Remove legacy snippets key
    await chrome.storage.local.remove(["snippets"]);
    console.log("🗑️ Removed legacy snippets from storage");
  }

  /**
   * Load legacy snippets from Chrome storage
   */
  private async loadLegacySnippets(): Promise<TextSnippet[]> {
    const result = await chrome.storage.local.get(["snippets"]);
    return result.snippets || [];
  }

  /**
   * Group snippets by tier based on scope
   */
  private groupSnippetsByTier(
    snippets: TextSnippet[],
  ): Record<string, TextSnippet[]> {
    const groups: Record<string, TextSnippet[]> = {
      personal: [],
      team: [],
      org: [],
    };

    snippets.forEach((snippet) => {
      const tier = snippet.scope || "personal";
      if (groups[tier]) {
        groups[tier].push(snippet);
      } else {
        groups.personal.push(snippet); // Default to personal if unknown scope
      }
    });

    return groups;
  }

  /**
   * Convert TextSnippet to EnhancedSnippet format
   */
  private convertToEnhancedSnippet(
    snippet: TextSnippet,
    tier: PriorityTier,
  ): any {
    return {
      id: snippet.id,
      trigger: snippet.trigger,
      content: snippet.content,
      contentType: snippet.contentType === "html" ? "html" : "plaintext",
      snipDependencies: [],
      description: snippet.description || "",
      scope: tier,
      variables: (snippet.variables || []).map((v) => ({
        name: v.name,
        prompt: v.placeholder || v.name,
      })),
      images: [],
      tags: snippet.tags || [],
      createdAt: snippet.createdAt
        ? snippet.createdAt.toISOString()
        : new Date().toISOString(),
      createdBy: "user",
      updatedAt: snippet.updatedAt
        ? snippet.updatedAt.toISOString()
        : new Date().toISOString(),
      updatedBy: "user",
      priority: snippet.priority || this.getDefaultPriorityForTier(tier),
    };
  }

  /**
   * Get default priority for tier
   */
  private getDefaultPriorityForTier(tier: PriorityTier): number {
    switch (tier) {
      case "personal":
        return 100;
      case "team":
        return 200;
      case "org":
        return 300;
      default:
        return 100;
    }
  }

  /**
   * Add priority fields to existing snippets
   */
  private async addPriorityFieldsToSnippets(): Promise<void> {
    console.log("🔄 Adding priority fields to existing snippets...");

    const tiers: PriorityTier[] = ["personal", "team", "org"];

    for (const tier of tiers) {
      const storageKey = `tier-${tier}`;
      const result = await chrome.storage.local.get([storageKey]);
      const tierData = result[storageKey] as TierStorageSchema;

      if (!tierData) continue;

      let updated = false;
      tierData.snippets.forEach((snippet: any) => {
        if (typeof snippet.priority === "undefined") {
          snippet.priority = this.getDefaultPriorityForTier(tier);
          updated = true;
        }
      });

      if (updated) {
        // Re-sort by priority
        tierData.snippets.sort((a: any, b: any) => b.priority - a.priority);
        tierData.metadata.modified = new Date().toISOString();

        await chrome.storage.local.set({ [storageKey]: tierData });
        console.log(`✅ Updated priority fields for ${tier} tier`);
      }
    }
  }

  /**
   * Enhance snippet metadata with new required fields
   */
  private async enhanceSnippetMetadata(): Promise<void> {
    console.log("🔄 Enhancing snippet metadata...");

    const tiers: PriorityTier[] = ["personal", "team", "org"];

    for (const tier of tiers) {
      const storageKey = `tier-${tier}`;
      const result = await chrome.storage.local.get([storageKey]);
      const tierData = result[storageKey] as TierStorageSchema;

      if (!tierData) continue;

      let updated = false;
      tierData.snippets.forEach((snippet: any) => {
        // Ensure all required fields exist
        if (!snippet.snipDependencies) {
          snippet.snipDependencies = [];
          updated = true;
        }
        if (!snippet.variables) {
          snippet.variables = [];
          updated = true;
        }
        if (!snippet.images) {
          snippet.images = [];
          updated = true;
        }
        if (!snippet.tags) {
          snippet.tags = [];
          updated = true;
        }
        if (!snippet.createdBy) {
          snippet.createdBy = "user";
          updated = true;
        }
        if (!snippet.updatedBy) {
          snippet.updatedBy = "user";
          updated = true;
        }
      });

      if (updated) {
        tierData.metadata.modified = new Date().toISOString();
        await chrome.storage.local.set({ [storageKey]: tierData });
        console.log(`✅ Enhanced metadata for ${tier} tier`);
      }
    }
  }

  /**
   * Validate tier migration
   */
  private async validateTierMigration(): Promise<boolean> {
    try {
      // Check if tier-based stores exist
      const tiers: PriorityTier[] = ["personal", "team", "org"];
      let hasTierData = false;

      for (const tier of tiers) {
        const storageKey = `tier-${tier}`;
        const result = await chrome.storage.local.get([storageKey]);
        if (result[storageKey]) {
          hasTierData = true;
          break;
        }
      }

      // Check if legacy snippets still exist
      const legacyResult = await chrome.storage.local.get(["snippets"]);
      const hasLegacyData =
        legacyResult.snippets && legacyResult.snippets.length > 0;

      // Migration is valid if we have tier data or no legacy data
      return hasTierData || !hasLegacyData;
    } catch (error) {
      console.error("❌ Validation failed:", error);
      return false;
    }
  }

  /**
   * Get pending migrations based on last migration version
   */
  private getPendingMigrations(lastVersion: string): MigrationStep[] {
    return this.migrationSteps.filter(
      (step) =>
        this.compareVersions(step.version, lastVersion) > 0 &&
        this.compareVersions(step.version, this.currentVersion) <= 0,
    );
  }

  /**
   * Compare version strings (returns -1, 0, or 1)
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }

    return 0;
  }

  /**
   * Get migration status from storage
   */
  private async getMigrationStatus(): Promise<{ lastMigration?: string }> {
    const result = await chrome.storage.local.get([this.storageKey]);
    return result[this.storageKey] || {};
  }

  /**
   * Update migration status in storage
   */
  private async updateMigrationStatus(version: string): Promise<void> {
    const status = {
      lastMigration: version,
      lastRun: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [this.storageKey]: status });
  }

  /**
   * Reset migration status (for testing)
   */
  async resetMigrationStatus(): Promise<void> {
    await chrome.storage.local.remove([this.storageKey]);
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(): Promise<any> {
    return await this.getMigrationStatus();
  }
}

/**
 * Create migration scheduler with current version
 */
export function createMigrationScheduler(version: string): MigrationScheduler {
  return new MigrationScheduler(version);
}

/**
 * Run migrations on extension startup
 */
export async function runStartupMigrations(
  version: string,
): Promise<MigrationResult> {
  const scheduler = createMigrationScheduler(version);

  const status = await scheduler.checkMigrationRequired();
  if (!status.isRequired) {
    console.log("✅ No migrations required on startup");
    return {
      success: true,
      migrationsRun: [],
      errors: [],
      warnings: [],
      migratedSnippetsCount: 0,
      duration: 0,
    };
  }

  console.log(
    `🔄 Running ${status.pendingMigrations.length} pending migrations on startup`,
  );
  return await scheduler.runMigrations();
}
