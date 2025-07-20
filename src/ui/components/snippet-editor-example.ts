/**
 * Example usage of the enhanced snippet editor with priority picker UI
 * Demonstrates how to initialize the editor with available stores
 */

import { SnippetEditor, SnippetEditorOptions } from "./snippet-editor.js";
import type {
  TierStoreInfo,
  MultiFileSelection,
} from "./multi-file-selector.js";
import type { TextSnippet } from "../../shared/types.js";
import type {
  PriorityTier,
  EnhancedSnippet,
} from "../../types/snippet-formats.js";

/**
 * Example implementation showing how to use the enhanced snippet editor
 */
export class SnippetEditorExample {
  private editor: SnippetEditor | null = null;
  private container: HTMLElement | null = null;

  /**
   * Initialize the snippet editor with mock data
   */
  async init(containerElement: HTMLElement): Promise<void> {
    this.container = containerElement;

    // Mock available stores for each tier
    const availableStores: { [tier: string]: TierStoreInfo[] } = {
      personal: [
        {
          fileName: "personal-work.json",
          displayName: "Work Snippets",
          snippetCount: 45,
          lastModified: new Date().toISOString(),
          isDefault: true,
          isLocal: true,
          isDriveFile: false,
        },
        {
          fileName: "personal-dev.json",
          displayName: "Development",
          snippetCount: 23,
          lastModified: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          isDefault: false,
          isLocal: false,
          isDriveFile: true,
          fileId: "drive-file-id-123",
        },
        {
          fileName: "personal-templates.json",
          displayName: "Email Templates",
          snippetCount: 12,
          lastModified: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          isDefault: false,
          isLocal: true,
          isDriveFile: false,
        },
      ],
      team: [
        {
          fileName: "team-shared.json",
          displayName: "Shared Team Snippets",
          snippetCount: 78,
          lastModified: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
          isDefault: true,
          isLocal: false,
          isDriveFile: true,
          fileId: "team-drive-file-456",
        },
        {
          fileName: "team-marketing.json",
          displayName: "Marketing Templates",
          snippetCount: 34,
          lastModified: new Date(Date.now() - 14400000).toISOString(), // 4 hours ago
          isDefault: false,
          isLocal: false,
          isDriveFile: true,
          fileId: "marketing-drive-file-789",
        },
      ],
      org: [
        {
          fileName: "org-policies.json",
          displayName: "Company Policies",
          snippetCount: 56,
          lastModified: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          isDefault: true,
          isLocal: false,
          isDriveFile: true,
          fileId: "org-policies-file-abc",
        },
        {
          fileName: "org-legal.json",
          displayName: "Legal Templates",
          snippetCount: 19,
          lastModified: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          isDefault: false,
          isLocal: false,
          isDriveFile: true,
          fileId: "legal-templates-def",
        },
      ],
    };

    // Create editor options
    const options: SnippetEditorOptions = {
      mode: "create",
      allowedTiers: ["personal", "team", "org"],
      availableStores,
      onSave: this.handleSave.bind(this),
      onCancel: this.handleCancel.bind(this),
      onValidationError: this.handleValidationError.bind(this),
      compact: false,
    };

    // Initialize the editor
    this.editor = new SnippetEditor(options);
    await this.editor.init(containerElement);

    console.log("✅ Snippet editor initialized with priority picker UI");
  }

  /**
   * Initialize editor for editing an existing snippet
   */
  async initForEdit(
    containerElement: HTMLElement,
    snippet: TextSnippet,
  ): Promise<void> {
    this.container = containerElement;

    // Mock available stores (same as above)
    const availableStores: { [tier: string]: TierStoreInfo[] } = {
      personal: [
        {
          fileName: "personal-work.json",
          displayName: "Work Snippets",
          snippetCount: 45,
          lastModified: new Date().toISOString(),
          isDefault: true,
          isLocal: true,
          isDriveFile: false,
        },
      ],
      team: [
        {
          fileName: "team-shared.json",
          displayName: "Shared Team Snippets",
          snippetCount: 78,
          lastModified: new Date().toISOString(),
          isDefault: true,
          isLocal: false,
          isDriveFile: true,
          fileId: "team-drive-file-456",
        },
      ],
      org: [
        {
          fileName: "org-policies.json",
          displayName: "Company Policies",
          snippetCount: 56,
          lastModified: new Date().toISOString(),
          isDefault: true,
          isLocal: false,
          isDriveFile: true,
          fileId: "org-policies-file-abc",
        },
      ],
    };

    const options: SnippetEditorOptions = {
      mode: "edit",
      snippet,
      allowedTiers: ["personal", "team", "org"],
      availableStores,
      onSave: this.handleSave.bind(this),
      onCancel: this.handleCancel.bind(this),
      onValidationError: this.handleValidationError.bind(this),
    };

    this.editor = new SnippetEditor(options);
    await this.editor.init(containerElement);

    console.log("✅ Snippet editor initialized for editing:", snippet.trigger);
  }

  /**
   * Handle snippet save
   */
  private async handleSave(
    snippet: TextSnippet | EnhancedSnippet,
    targetStores?: MultiFileSelection[],
  ): Promise<void> {
    try {
      console.log("💾 Saving snippet:", {
        trigger: snippet.trigger,
        tier: snippet.scope,
        contentType: snippet.contentType,
        targetStores: targetStores?.length || 0,
      });

      // Here you would integrate with your actual snippet storage system
      // For example, using the PriorityTierManager to save to the correct store

      // Mock save operation
      await this.mockSaveSnippet(snippet);

      // Show success message
      this.showNotification("Snippet saved successfully!", "success");

      // Close editor or navigate away
      this.cleanup();
    } catch (error) {
      console.error("❌ Failed to save snippet:", error);
      this.showNotification(
        "Failed to save snippet. Please try again.",
        "error",
      );
    }
  }

  /**
   * Handle editor cancel
   */
  private handleCancel(): void {
    console.log("🚫 Editor cancelled");
    this.cleanup();
  }

  /**
   * Handle validation errors
   */
  private handleValidationError(errors: string[]): void {
    console.log("⚠️ Validation errors:", errors);
    this.showNotification(
      `Please fix the following errors: ${errors.join(", ")}`,
      "error",
    );
  }

  /**
   * Mock save operation
   */
  private async mockSaveSnippet(
    snippet: TextSnippet | EnhancedSnippet,
  ): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock validation
    if (!snippet.trigger || !snippet.content) {
      throw new Error("Invalid snippet data");
    }

    // Mock saving to the selected store
    console.log(`📁 Saving snippet with tier: ${snippet.scope}`);

    // Here you would:
    // 1. Load the selected store file
    // 2. Add/update the snippet
    // 3. Save the store file
    // 4. Update local cache
    // 5. Sync to cloud if needed
  }

  /**
   * Show notification to user
   */
  private showNotification(
    message: string,
    type: "success" | "error" | "info" = "info",
  ): void {
    // Mock notification system
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideInRight 0.3s ease;
      background: ${type === "success" ? "#4caf50" : type === "error" ? "#f44336" : "#2196f3"};
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Cleanup editor resources
   */
  private async cleanup(): Promise<void> {
    if (this.editor) {
      await this.editor.destroy();
      this.editor = null;
    }

    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }
  }

  /**
   * Get current snippet data from editor
   */
  getCurrentSnippet(): TextSnippet | EnhancedSnippet | null {
    return this.editor?.getSnippetData() || null;
  }

  /**
   * Check if editor has unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.editor?.isDirtyForm() || false;
  }
}

/**
 * Example usage function
 */
export async function initializeSnippetEditor(): Promise<void> {
  const container = document.getElementById("snippet-editor-container");
  if (!container) {
    console.error("❌ Container element not found");
    return;
  }

  const example = new SnippetEditorExample();
  await example.init(container);
}

/**
 * Example usage for editing existing snippet
 */
export async function editExistingSnippet(snippet: TextSnippet): Promise<void> {
  const container = document.getElementById("snippet-editor-container");
  if (!container) {
    console.error("❌ Container element not found");
    return;
  }

  const example = new SnippetEditorExample();
  await example.initForEdit(container, snippet);
}

/**
 * Demo function to show different tier configurations
 */
export function createTierConfigurationDemo(): {
  [tier: string]: TierStoreInfo[];
} {
  return {
    personal: [
      {
        fileName: "personal-default.json",
        displayName: "My Snippets",
        snippetCount: 25,
        lastModified: new Date().toISOString(),
        isDefault: true,
        isLocal: true,
        isDriveFile: false,
      },
      {
        fileName: "personal-coding.json",
        displayName: "Code Templates",
        snippetCount: 40,
        lastModified: new Date(Date.now() - 3600000).toISOString(),
        isDefault: false,
        isLocal: false,
        isDriveFile: true,
        fileId: "coding-templates-123",
      },
    ],
    team: [
      {
        fileName: "team-engineering.json",
        displayName: "Engineering Team",
        snippetCount: 67,
        lastModified: new Date(Date.now() - 7200000).toISOString(),
        isDefault: true,
        isLocal: false,
        isDriveFile: true,
        fileId: "engineering-team-456",
      },
    ],
    org: [
      {
        fileName: "org-company-wide.json",
        displayName: "Company Templates",
        snippetCount: 89,
        lastModified: new Date(Date.now() - 86400000).toISOString(),
        isDefault: true,
        isLocal: false,
        isDriveFile: true,
        fileId: "company-wide-789",
      },
    ],
  };
}
