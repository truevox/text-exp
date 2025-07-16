/**
 * File Selector Component for Priority-Tier Architecture
 * Allows users to select JSON files for snippet storage within drive.file scope
 */

import type { PriorityTier } from "../../types/snippet-formats.js";
import { GoogleDriveAdapter } from "../../background/cloud-adapters/google-drive-adapter.js";

/**
 * File selection result
 */
export interface FileSelectionResult {
  tier: PriorityTier;
  fileId: string;
  fileName: string;
  selected: boolean;
}

/**
 * File selector configuration
 */
export interface FileSelectorConfig {
  tier: PriorityTier;
  title: string;
  description: string;
  required: boolean;
  defaultFileName: string;
}

/**
 * File selector UI component for choosing snippet store files
 */
export class FileSelector {
  private adapter: GoogleDriveAdapter;
  private container: HTMLElement;
  private configs: FileSelectorConfig[];
  private selections: Map<PriorityTier, FileSelectionResult> = new Map();

  constructor(adapter: GoogleDriveAdapter, container: HTMLElement) {
    this.adapter = adapter;
    this.container = container;
    this.configs = [
      {
        tier: "personal",
        title: "Personal Snippets",
        description: "Your private snippet collection",
        required: true,
        defaultFileName: "personal.json",
      },
      {
        tier: "team",
        title: "Team Snippets",
        description: "Shared snippets for your team",
        required: false,
        defaultFileName: "team.json",
      },
      {
        tier: "org",
        title: "Organization Snippets",
        description: "Company-wide snippet templates",
        required: false,
        defaultFileName: "org.json",
      },
    ];
  }

  /**
   * Initialize and render the file selector interface
   */
  async render(): Promise<void> {
    this.container.innerHTML = `
      <div class="file-selector">
        <div class="file-selector-header">
          <h3>📁 Choose Your Snippet Files</h3>
          <p>Select JSON files in your Google Drive to store snippets by priority level.</p>
          <p><small><strong>Note:</strong> PuffPuffPaste can only access files you explicitly choose.</small></p>
        </div>
        
        <div class="tier-selectors">
          ${this.configs.map((config) => this.renderTierSelector(config)).join("")}
        </div>
        
        <div class="file-selector-actions">
          <button id="scan-existing-files" class="btn btn-secondary">
            🔍 Scan for Existing Files
          </button>
          <button id="create-new-files" class="btn btn-primary">
            ✨ Create New Files
          </button>
          <button id="save-selections" class="btn btn-success" disabled>
            💾 Save Selections
          </button>
        </div>
        
        <div class="file-selector-status">
          <div id="status-message" class="status-message"></div>
        </div>
      </div>
    `;

    this.attachEventListeners();
    await this.loadExistingSelections();
  }

  /**
   * Render tier selector for a specific tier
   */
  private renderTierSelector(config: FileSelectorConfig): string {
    const isRequired = config.required ? "required" : "";
    const requiredMark = config.required ? " *" : "";

    return `
      <div class="tier-selector" data-tier="${config.tier}">
        <div class="tier-header">
          <h4>${config.title}${requiredMark}</h4>
          <p>${config.description}</p>
        </div>
        
        <div class="file-selection">
          <div class="selected-file" id="selected-${config.tier}" style="display: none;">
            <div class="file-info">
              <span class="file-name"></span>
              <span class="file-id"></span>
            </div>
            <button class="btn btn-sm btn-outline" data-action="change" data-tier="${config.tier}">
              Change
            </button>
          </div>
          
          <div class="no-file-selected" id="no-file-${config.tier}">
            <button class="btn btn-outline" data-action="select" data-tier="${config.tier}">
              📁 Select ${config.defaultFileName}
            </button>
            <span class="or">or</span>
            <button class="btn btn-outline" data-action="create" data-tier="${config.tier}">
              ✨ Create New
            </button>
          </div>
        </div>
        
        <div class="tier-status ${isRequired}">
          ${config.required ? "<small>Required for PuffPuffPaste to work</small>" : "<small>Optional - enable for shared snippets</small>"}
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to the interface
   */
  private attachEventListeners(): void {
    // Tier-specific actions
    this.container.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      const tier = target.dataset.tier as PriorityTier;

      if (!action || !tier) return;

      switch (action) {
        case "select":
          await this.selectFileForTier(tier);
          break;
        case "create":
          await this.createFileForTier(tier);
          break;
        case "change":
          await this.changeFileForTier(tier);
          break;
      }
    });

    // Global actions
    document
      .getElementById("scan-existing-files")
      ?.addEventListener("click", () => this.scanForExistingFiles());

    document
      .getElementById("create-new-files")
      ?.addEventListener("click", () => this.createAllMissingFiles());

    document
      .getElementById("save-selections")
      ?.addEventListener("click", () => this.saveSelections());
  }

  /**
   * Select a file for a specific tier
   */
  private async selectFileForTier(tier: PriorityTier): Promise<void> {
    this.showStatus(`Searching for ${tier} snippet files...`, "info");

    try {
      // Search for existing tier files
      const files = await this.adapter.searchTierFiles();
      const config = this.configs.find((c) => c.tier === tier)!;

      // Look for the specific tier file
      const tierFile = files.find((f) => f.name === config.defaultFileName);

      if (tierFile) {
        // File found - confirm selection
        const confirmed = confirm(
          `Found existing ${config.title} file:\n\n` +
            `File: ${tierFile.name}\n` +
            `Modified: ${tierFile.modifiedTime ? new Date(tierFile.modifiedTime).toLocaleString() : "Unknown"}\n\n` +
            `Use this file for ${config.title}?`,
        );

        if (confirmed) {
          this.setTierSelection(tier, tierFile.id, tierFile.name);
          this.showStatus(
            `Selected ${tierFile.name} for ${config.title}`,
            "success",
          );
        }
      } else {
        // No file found - offer to create
        const shouldCreate = confirm(
          `No ${config.defaultFileName} found in your Google Drive.\n\n` +
            `Would you like to create a new ${config.title} file?`,
        );

        if (shouldCreate) {
          await this.createFileForTier(tier);
        }
      }
    } catch (error) {
      this.showStatus(`Error searching for files: ${error}`, "error");
    }
  }

  /**
   * Create a new file for a specific tier
   */
  private async createFileForTier(tier: PriorityTier): Promise<void> {
    this.showStatus(`Creating new ${tier} snippet file...`, "info");

    try {
      const config = this.configs.find((c) => c.tier === tier)!;

      // Create empty tier schema
      const emptySchema = {
        schema: "priority-tier-v1" as const,
        tier,
        snippets: [],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "user",
          description: `${config.title} - Created by PuffPuffPaste`,
        },
      };

      // Upload to Google Drive
      const fileId = await this.adapter.uploadTierSchema(emptySchema);

      this.setTierSelection(tier, fileId, config.defaultFileName);
      this.showStatus(
        `Created ${config.defaultFileName} for ${config.title}`,
        "success",
      );
    } catch (error) {
      this.showStatus(`Error creating file: ${error}`, "error");
    }
  }

  /**
   * Change the selected file for a tier
   */
  private async changeFileForTier(tier: PriorityTier): Promise<void> {
    // Clear current selection and show selection options
    this.clearTierSelection(tier);
    this.updateTierDisplay(tier);
  }

  /**
   * Scan for existing tier files automatically
   */
  private async scanForExistingFiles(): Promise<void> {
    this.showStatus(
      "Scanning Google Drive for existing snippet files...",
      "info",
    );

    try {
      const files = await this.adapter.searchTierFiles();
      let foundCount = 0;

      for (const config of this.configs) {
        const tierFile = files.find((f) => f.name === config.defaultFileName);
        if (tierFile && !this.selections.has(config.tier)) {
          this.setTierSelection(config.tier, tierFile.id, tierFile.name);
          foundCount++;
        }
      }

      if (foundCount > 0) {
        this.showStatus(
          `Found and selected ${foundCount} existing snippet files`,
          "success",
        );
      } else {
        this.showStatus("No existing snippet files found", "info");
      }
    } catch (error) {
      this.showStatus(`Error scanning files: ${error}`, "error");
    }
  }

  /**
   * Create all missing required files
   */
  private async createAllMissingFiles(): Promise<void> {
    this.showStatus("Creating missing snippet files...", "info");

    let createdCount = 0;

    for (const config of this.configs) {
      if (config.required && !this.selections.has(config.tier)) {
        try {
          await this.createFileForTier(config.tier);
          createdCount++;
        } catch (error) {
          console.error(`Failed to create ${config.tier} file:`, error);
        }
      }
    }

    if (createdCount > 0) {
      this.showStatus(`Created ${createdCount} new snippet files`, "success");
    } else {
      this.showStatus("All required files already exist", "info");
    }
  }

  /**
   * Save the current selections
   */
  private async saveSelections(): Promise<void> {
    this.showStatus("Saving file selections...", "info");

    try {
      const selections = Array.from(this.selections.values());

      // Store selections in extension storage
      await chrome.storage.local.set({
        tier_file_selections: selections,
        tier_selection_date: new Date().toISOString(),
      });

      this.showStatus("File selections saved successfully!", "success");

      // Dispatch event to notify other components
      window.dispatchEvent(
        new CustomEvent("tier-files-selected", {
          detail: selections,
        }),
      );
    } catch (error) {
      this.showStatus(`Error saving selections: ${error}`, "error");
    }
  }

  /**
   * Load existing selections from storage
   */
  private async loadExistingSelections(): Promise<void> {
    try {
      const result = await chrome.storage.local.get("tier_file_selections");
      const selections = result.tier_file_selections as FileSelectionResult[];

      if (selections) {
        for (const selection of selections) {
          if (selection.selected) {
            this.selections.set(selection.tier, selection);
            this.updateTierDisplay(selection.tier);
          }
        }
        this.updateSaveButton();
      }
    } catch (error) {
      console.error("Error loading existing selections:", error);
    }
  }

  /**
   * Set selection for a tier
   */
  private setTierSelection(
    tier: PriorityTier,
    fileId: string,
    fileName: string,
  ): void {
    this.selections.set(tier, {
      tier,
      fileId,
      fileName,
      selected: true,
    });

    this.updateTierDisplay(tier);
    this.updateSaveButton();
  }

  /**
   * Clear selection for a tier
   */
  private clearTierSelection(tier: PriorityTier): void {
    this.selections.delete(tier);
    this.updateTierDisplay(tier);
    this.updateSaveButton();
  }

  /**
   * Update the display for a specific tier
   */
  private updateTierDisplay(tier: PriorityTier): void {
    const selection = this.selections.get(tier);
    const selectedDiv = document.getElementById(`selected-${tier}`);
    const noFileDiv = document.getElementById(`no-file-${tier}`);

    if (selection && selectedDiv && noFileDiv) {
      // Show selected file
      selectedDiv.style.display = "block";
      noFileDiv.style.display = "none";

      const fileNameSpan = selectedDiv.querySelector(".file-name");
      const fileIdSpan = selectedDiv.querySelector(".file-id");

      if (fileNameSpan) fileNameSpan.textContent = selection.fileName;
      if (fileIdSpan)
        fileIdSpan.textContent = `ID: ${selection.fileId.substring(0, 12)}...`;
    } else if (selectedDiv && noFileDiv) {
      // Show no file selected
      selectedDiv.style.display = "none";
      noFileDiv.style.display = "block";
    }
  }

  /**
   * Update the save button state
   */
  private updateSaveButton(): void {
    const saveButton = document.getElementById(
      "save-selections",
    ) as HTMLButtonElement;
    if (!saveButton) return;

    // Check if all required tiers are selected
    const requiredTiers = this.configs
      .filter((c) => c.required)
      .map((c) => c.tier);
    const hasAllRequired = requiredTiers.every((tier) =>
      this.selections.has(tier),
    );

    saveButton.disabled = !hasAllRequired;
    saveButton.textContent = hasAllRequired
      ? "💾 Save Selections"
      : "💾 Select Required Files First";
  }

  /**
   * Show status message
   */
  private showStatus(
    message: string,
    type: "info" | "success" | "error",
  ): void {
    const statusElement = document.getElementById("status-message");
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;

    // Auto-clear after 5 seconds for non-error messages
    if (type !== "error") {
      setTimeout(() => {
        statusElement.textContent = "";
        statusElement.className = "status-message";
      }, 5000);
    }
  }

  /**
   * Get current selections
   */
  getSelections(): FileSelectionResult[] {
    return Array.from(this.selections.values());
  }
}
