/**
 * Default Store Initializer
 * Handles automatic initialization of appdata store for new users
 * Uses OAuth-compliant drive.appdata scope only
 */

import { GoogleDriveAppDataManager } from "./cloud-adapters/google-drive-appdata-manager.js";
import { ExtensionStorage } from "../shared/storage.js";
import type { CloudCredentials } from "../shared/types.js";
import type {
  TierStorageSchema,
  EnhancedSnippet,
} from "../types/snippet-formats.js";

export interface DefaultStoreConfig {
  autoInitialize: boolean;
  createWelcomeSnippets: boolean;
  enableUsageTracking: boolean;
}

const DEFAULT_CONFIG: DefaultStoreConfig = {
  autoInitialize: true,
  createWelcomeSnippets: true,
  enableUsageTracking: true,
};

/**
 * Service for initializing the default appdata store for new users
 */
export class DefaultStoreInitializer {
  private static instance: DefaultStoreInitializer | null = null;
  private config: DefaultStoreConfig;
  private initialized: boolean = false;

  private constructor(config: Partial<DefaultStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    config?: Partial<DefaultStoreConfig>,
  ): DefaultStoreInitializer {
    if (!DefaultStoreInitializer.instance) {
      DefaultStoreInitializer.instance = new DefaultStoreInitializer(config);
    }
    return DefaultStoreInitializer.instance;
  }

  /**
   * Initialize default appdata store for new users
   */
  async initializeDefaultStore(
    credentials: CloudCredentials,
  ): Promise<boolean> {
    if (!this.config.autoInitialize) {
      console.log("📭 Default store auto-initialization disabled");
      return false;
    }

    console.log("🎯 Initializing default appdata store for new user...");

    try {
      // Check if appdata store already exists
      const existingStore = await this.checkExistingAppdataStore(credentials);
      if (existingStore) {
        console.log(
          "✅ Default appdata store already exists, skipping initialization",
        );
        await this.markDefaultStoreInitialized();
        return true;
      }

      // Create default appdata store
      const defaultStore = await this.createDefaultAppdataStore(credentials);
      console.log("✅ Created default appdata store:", defaultStore.tier);

      // Mark as initialized to prevent future runs
      await this.markDefaultStoreInitialized();

      // Update extension settings to include appdata store
      await this.updateExtensionSettings();

      console.log("🎉 Default store initialization complete");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize default store:", error);
      throw new Error(
        `Default store initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if appdata store already exists
   */
  private async checkExistingAppdataStore(
    credentials: CloudCredentials,
  ): Promise<TierStorageSchema | null> {
    try {
      console.log("🔍 Checking for existing appdata store...");
      const existingStore =
        await GoogleDriveAppDataManager.getPriorityZeroSnippets(credentials);

      if (existingStore) {
        console.log("📋 Found existing appdata store:", {
          tier: existingStore.tier,
          snippetCount: existingStore.snippets.length,
          version: existingStore.version,
          created: existingStore.metadata?.created,
        });
      }

      return existingStore;
    } catch (error) {
      console.log("📭 No existing appdata store found");
      return null;
    }
  }

  /**
   * Create default appdata store with welcome snippets
   */
  private async createDefaultAppdataStore(
    credentials: CloudCredentials,
  ): Promise<TierStorageSchema> {
    console.log("📝 Creating default appdata store...");

    const defaultStore: TierStorageSchema = {
      schema: "priority-tier-v1",
      version: "1.0.0",
      tier: "priority-0",
      description: "Default snippet store (highest priority)",
      snippets: this.config.createWelcomeSnippets
        ? this.createWelcomeSnippets()
        : [],
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        totalSnippets: this.config.createWelcomeSnippets ? 3 : 0,
        lastUsed: null,
        isDefault: true,
        autoCreated: true,
      },
      settings: {
        allowDuplicates: false,
        sortOrder: "priority",
        defaultPriority: 100,
        syncEnabled: true,
        usageTracking: this.config.enableUsageTracking,
      },
    };

    // Store in appdata
    await GoogleDriveAppDataManager.storePriorityZeroSnippets(
      credentials,
      defaultStore,
    );

    console.log("✅ Default appdata store created successfully");
    return defaultStore;
  }

  /**
   * Create welcome snippets for new users
   */
  private createWelcomeSnippets(): EnhancedSnippet[] {
    const now = new Date().toISOString();
    const welcomeSnippets = [
      {
        id: `welcome-${Date.now()}-1`,
        trigger: ";hello",
        content: "Hello! Welcome to PuffPuffPaste! 👋",
        contentType: "html" as const,
        snipDependencies: [],
        description: "Welcome greeting snippet",
        scope: "personal" as const,
        priority: 0, // Highest priority for welcome snippets
        variables: [],
        images: [],
        tags: ["welcome", "greeting"],
        createdAt: now,
        createdBy: "system",
        updatedAt: now,
        updatedBy: "system",
      },
      {
        id: `welcome-${Date.now()}-2`,
        trigger: ";email",
        content: "${email}",
        contentType: "html" as const,
        snipDependencies: [],
        description: "Your email address",
        scope: "personal" as const,
        priority: 1, // High priority for personal info
        variables: [
          {
            name: "email",
            prompt: "Enter your email address:",
            defaultValue: "",
          },
        ],
        images: [],
        tags: ["personal", "variable"],
        createdAt: now,
        createdBy: "system",
        updatedAt: now,
        updatedBy: "system",
      },
      {
        id: `welcome-${Date.now()}-3`,
        trigger: ";signature",
        content: "Best regards,<br>${name}<br>${title}",
        contentType: "html" as const,
        snipDependencies: [],
        description: "Email signature template",
        scope: "personal" as const,
        priority: 2, // Medium priority for signatures
        variables: [
          {
            name: "name",
            prompt: "Your name:",
            defaultValue: "",
          },
          {
            name: "title",
            prompt: "Your title/position:",
            defaultValue: "",
          },
        ],
        images: [],
        tags: ["signature", "email", "template"],
        createdAt: now,
        createdBy: "system",
        updatedAt: now,
        updatedBy: "system",
      },
    ];

    console.log(`📝 Created ${welcomeSnippets.length} welcome snippets`);
    return welcomeSnippets;
  }

  /**
   * Mark default store as initialized in extension storage
   */
  private async markDefaultStoreInitialized(): Promise<void> {
    try {
      const settings = await ExtensionStorage.getSettings();
      settings.defaultStoreInitialized = true;
      settings.appdataStoreEnabled = true;
      await ExtensionStorage.setSettings(settings);
      this.initialized = true;
      console.log("✅ Marked default store as initialized");
    } catch (error) {
      console.error("❌ Failed to mark default store as initialized:", error);
    }
  }

  /**
   * Update extension settings to include appdata store in sync sources
   */
  private async updateExtensionSettings(): Promise<void> {
    try {
      const settings = await ExtensionStorage.getSettings();

      // Ensure appdata store is included in configured sources
      if (!settings.configuredSources) {
        settings.configuredSources = [];
      }

      // Check if appdata source already exists
      const hasAppdataSource = settings.configuredSources.some(
        (source) =>
          source.scope === "priority-0" &&
          source.folderId === "appdata-priority-0",
      );

      if (!hasAppdataSource) {
        settings.configuredSources.unshift({
          provider: "google-drive",
          scope: "priority-0",
          folderId: "appdata-priority-0",
          displayName: "Default Store (Personal)",
        });

        await ExtensionStorage.setSettings(settings);
        console.log("✅ Added appdata store to configured sources");
      }
    } catch (error) {
      console.error("❌ Failed to update extension settings:", error);
    }
  }

  /**
   * Check if default store initialization is needed
   */
  async needsInitialization(): Promise<boolean> {
    try {
      const settings = await ExtensionStorage.getSettings();
      return !settings.defaultStoreInitialized && this.config.autoInitialize;
    } catch (error) {
      console.error("❌ Failed to check initialization status:", error);
      return false;
    }
  }

  /**
   * Get default store status information
   */
  async getDefaultStoreStatus(): Promise<{
    initialized: boolean;
    appdataStoreExists: boolean;
    hasWelcomeSnippets: boolean;
    snippetCount: number;
  }> {
    try {
      const settings = await ExtensionStorage.getSettings();
      const credentials = await ExtensionStorage.getCloudCredentials();

      const status = {
        initialized: settings.defaultStoreInitialized || false,
        appdataStoreExists: false,
        hasWelcomeSnippets: false,
        snippetCount: 0,
      };

      if (credentials) {
        const appdataStore =
          await GoogleDriveAppDataManager.getPriorityZeroSnippets(credentials);
        if (appdataStore) {
          status.appdataStoreExists = true;
          status.snippetCount = appdataStore.snippets.length;
          status.hasWelcomeSnippets = appdataStore.snippets.some(
            (snippet) => snippet.metadata?.isWelcome,
          );
        }
      }

      return status;
    } catch (error) {
      console.error("❌ Failed to get default store status:", error);
      return {
        initialized: false,
        appdataStoreExists: false,
        hasWelcomeSnippets: false,
        snippetCount: 0,
      };
    }
  }

  /**
   * Reset default store (for testing or troubleshooting)
   */
  async resetDefaultStore(credentials: CloudCredentials): Promise<void> {
    console.log("🔄 Resetting default store...");

    try {
      // Delete appdata store
      await GoogleDriveAppDataManager.deleteFromAppData(
        credentials,
        "priority-0-snippets.json",
      );

      // Reset extension settings
      const settings = await ExtensionStorage.getSettings();
      settings.defaultStoreInitialized = false;
      settings.appdataStoreEnabled = false;

      // Remove appdata source from configured sources
      if (settings.configuredSources) {
        settings.configuredSources = settings.configuredSources.filter(
          (source) =>
            !(
              source.scope === "priority-0" &&
              source.folderId === "appdata-priority-0"
            ),
        );
      }

      await ExtensionStorage.setSettings(settings);
      this.initialized = false;

      console.log("✅ Default store reset complete");
    } catch (error) {
      console.error("❌ Failed to reset default store:", error);
      throw error;
    }
  }
}
