/**
 * Multi-Store Editor Component
 * Implements same-screen store selection with duplicate detection
 * Allows editing duplicates across multiple stores simultaneously
 */

import type {
  SnippetScope,
  SnippetPriority,
  EnhancedSnippet,
  NumericPriorityStorageSchema,
  TierStorageSchema, // Legacy support
} from "../../types/snippet-formats.js";
import type { TextSnippet } from "../../shared/types.js";
import {
  MultiFileSelector,
  type MultiFileSelection,
  type TierStoreInfo,
} from "./multi-file-selector.js";

export interface StoreSnippetInfo {
  storeId: string;
  storeName: string;
  displayName: string;
  scope: SnippetScope; // Simplified scope instead of tier names
  priority: SnippetPriority; // Numeric priority (0 = highest, FILO ordering)
  snippetCount: number;
  isReadOnly: boolean;
  isDriveFile: boolean;
  fileId?: string;
  lastModified: string;
  snippets: (TextSnippet | EnhancedSnippet)[];
}

export interface DuplicateSnippetGroup {
  trigger: string;
  snippetId: string;
  duplicates: {
    storeId: string;
    storeName: string;
    displayName: string;
    snippet: TextSnippet | EnhancedSnippet;
    isReadOnly: boolean;
    conflictResolution: "keep" | "update" | "delete";
  }[];
}

export interface MultiStoreEditorOptions {
  stores: StoreSnippetInfo[];
  currentSnippet?: TextSnippet | EnhancedSnippet;
  enableDuplicateDetection?: boolean;
  enableCrossStoreEditing?: boolean;
  showReadOnlyStores?: boolean;
  onStoreSelectionChange?: (selectedStores: string[]) => void;
  onDuplicateResolution?: (duplicates: DuplicateSnippetGroup[]) => void;
  onSnippetUpdate?: (
    storeId: string,
    snippet: TextSnippet | EnhancedSnippet,
  ) => void;
  onValidationError?: (errors: string[]) => void;
}

export interface MultiStoreValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  duplicateGroups: DuplicateSnippetGroup[];
}

/**
 * Multi-store editor with duplicate detection and management
 */
export class MultiStoreEditor {
  private container: HTMLElement | null = null;
  private options: MultiStoreEditorOptions;
  private selectedStores: Set<string> = new Set();
  private duplicateGroups: DuplicateSnippetGroup[] = [];
  private isInitialized = false;
  private validationErrors: string[] = [];
  private multiFileSelector: MultiFileSelector | null = null;

  constructor(options: MultiStoreEditorOptions) {
    this.options = {
      enableDuplicateDetection: true,
      enableCrossStoreEditing: true,
      showReadOnlyStores: true,
      ...options,
    };
  }

  /**
   * Initialize the multi-store editor
   */
  async init(container: HTMLElement): Promise<void> {
    if (this.isInitialized) {
      throw new Error("Multi-store editor already initialized");
    }

    this.container = container;
    this.createInterface();
    this.setupEventHandlers();

    if (this.options.enableDuplicateDetection) {
      this.detectDuplicates();
    }

    this.updateStoreDisplay();
    this.isInitialized = true;
  }

  /**
   * Create the multi-store editor interface
   */
  private createInterface(): void {
    if (!this.container) return;

    const hasCurrentSnippet = !!this.options.currentSnippet;
    const duplicateCount = this.duplicateGroups.length;

    this.container.innerHTML = `
      <div class="multi-store-editor">
        <div class="editor-header">
          <h3 class="editor-title">Multi-Store Management</h3>
          <p class="editor-description">
            ${
              hasCurrentSnippet
                ? "Manage this snippet across multiple stores and resolve duplicates."
                : "Select stores to work with and manage duplicates across all stores."
            }
          </p>
        </div>

        <!-- Store Selection Section -->
        <div class="store-selection-section">
          <h4 class="section-title">
            Available Stores
            <span class="store-count">(${this.options.stores.length} total)</span>
          </h4>
          
          <div class="selection-controls">
            <button type="button" class="btn btn-sm btn-secondary" data-action="select-all-stores">
              Select All
            </button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="select-writable-only">
              Writable Only
            </button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="clear-selection">
              Clear Selection
            </button>
          </div>

          <div class="stores-grid">
            ${this.renderStoresGrid()}
          </div>
        </div>

        <!-- Duplicate Detection Section -->
        ${
          this.options.enableDuplicateDetection
            ? `
        <div class="duplicate-detection-section">
          <h4 class="section-title">
            Duplicate Detection
            <span class="duplicate-count ${duplicateCount > 0 ? "has-duplicates" : ""}">
              (${duplicateCount} duplicate${duplicateCount !== 1 ? "s" : ""} found)
            </span>
          </h4>
          
          <div class="detection-controls">
            <button type="button" class="btn btn-sm btn-primary" data-action="scan-duplicates">
              Scan for Duplicates
            </button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="toggle-detection-settings">
              Detection Settings
            </button>
          </div>

          <div class="detection-settings" style="display: none;">
            <div class="settings-group">
              <label class="checkbox-label">
                <input type="checkbox" id="detect-by-trigger" checked>
                Detect by trigger text
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="detect-by-content" checked>
                Detect by content similarity
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="detect-by-id">
                Detect by snippet ID
              </label>
            </div>
          </div>

          <div class="duplicates-list">
            ${this.renderDuplicatesList()}
          </div>
        </div>
        `
            : ""
        }

        <!-- Cross-Store Editing Section -->
        ${
          this.options.enableCrossStoreEditing && hasCurrentSnippet
            ? `
        <div class="cross-store-editing-section">
          <h4 class="section-title">Cross-Store Editing</h4>
          
          <div class="current-snippet-info">
            <div class="snippet-preview">
              <strong>Trigger:</strong> ${this.options.currentSnippet?.trigger || "N/A"}
              <br>
              <strong>Content:</strong> ${this.getContentPreview(this.options.currentSnippet?.content || "")}
            </div>
          </div>

          <div class="editing-controls">
            <button type="button" class="btn btn-primary" data-action="apply-to-selected">
              Apply to Selected Stores
            </button>
            <button type="button" class="btn btn-secondary" data-action="preview-changes">
              Preview Changes
            </button>
          </div>
        </div>
        `
            : ""
        }

        <!-- Actions Section -->
        <div class="editor-actions">
          <div class="action-group">
            <button type="button" class="btn btn-secondary" data-action="export-selection">
              Export Selection
            </button>
            <button type="button" class="btn btn-secondary" data-action="import-snippets">
              Import Snippets
            </button>
          </div>
          
          <div class="action-group">
            <button type="button" class="btn btn-primary" data-action="save-changes">
              Save Changes
            </button>
            <button type="button" class="btn btn-secondary" data-action="cancel">
              Cancel
            </button>
          </div>
        </div>

        <!-- Validation Messages -->
        <div class="validation-messages" style="display: none;">
          <!-- Validation messages will appear here -->
        </div>
      </div>
    `;
  }

  /**
   * Render the stores grid
   */
  private renderStoresGrid(): string {
    const groupedStores = this.groupStoresByTier();

    return Object.entries(groupedStores)
      .map(([tier, stores]) => {
        if (stores.length === 0) return "";

        return `
          <div class="tier-group">
            <h5 class="tier-title">${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier</h5>
            <div class="stores-list">
              ${stores.map((store) => this.renderStoreCard(store)).join("")}
            </div>
          </div>
        `;
      })
      .join("");
  }

  /**
   * Group stores by tier
   */
  private groupStoresByTier(): Record<string, StoreSnippetInfo[]> {
    return this.options.stores.reduce(
      (acc, store) => {
        const tier = store.tierName;
        if (!acc[tier]) acc[tier] = [];
        acc[tier].push(store);
        return acc;
      },
      {} as Record<string, StoreSnippetInfo[]>,
    );
  }

  /**
   * Render a single store card
   */
  private renderStoreCard(store: StoreSnippetInfo): string {
    const isSelected = this.selectedStores.has(store.storeId);
    const storageIcon = store.isDriveFile ? "☁️" : "💾";
    const readOnlyBadge = store.isReadOnly
      ? '<span class="readonly-badge">Read-only</span>'
      : "";
    const duplicateCount = this.getDuplicateCountForStore(store.storeId);

    return `
      <div class="store-card ${isSelected ? "selected" : ""} ${store.isReadOnly ? "readonly" : ""}" 
           data-store-id="${store.storeId}">
        
        <div class="store-header">
          <label class="store-checkbox">
            <input type="checkbox" 
                   ${isSelected ? "checked" : ""} 
                   ${store.isReadOnly && !this.options.showReadOnlyStores ? "disabled" : ""}
                   data-store-id="${store.storeId}">
            <span class="checkmark"></span>
          </label>
          
          <div class="store-info">
            <div class="store-name">
              <span class="storage-icon">${storageIcon}</span>
              ${store.displayName}
              ${readOnlyBadge}
            </div>
            <div class="store-filename">${store.storeName}</div>
          </div>
        </div>

        <div class="store-details">
          <div class="detail-item">
            <span class="detail-label">Snippets:</span>
            <span class="detail-value">${store.snippetCount}</span>
          </div>
          
          ${
            duplicateCount > 0
              ? `
          <div class="detail-item duplicate-info">
            <span class="detail-label">Duplicates:</span>
            <span class="detail-value warning">${duplicateCount}</span>
          </div>
          `
              : ""
          }
          
          <div class="detail-item">
            <span class="detail-label">Last Modified:</span>
            <span class="detail-value">${this.formatDate(store.lastModified)}</span>
          </div>
          
          <div class="detail-item">
            <span class="detail-label">Storage:</span>
            <span class="detail-value">${store.isDriveFile ? "Google Drive" : "Local"}</span>
          </div>
        </div>

        <div class="store-actions">
          <button type="button" class="btn btn-xs btn-secondary" 
                  data-action="preview-store" 
                  data-store-id="${store.storeId}">
            Preview
          </button>
          
          ${
            !store.isReadOnly
              ? `
          <button type="button" class="btn btn-xs btn-primary" 
                  data-action="edit-store" 
                  data-store-id="${store.storeId}">
            Edit
          </button>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * Render the duplicates list
   */
  private renderDuplicatesList(): string {
    if (this.duplicateGroups.length === 0) {
      return '<div class="no-duplicates">No duplicates found across selected stores.</div>';
    }

    return this.duplicateGroups
      .map((group) => this.renderDuplicateGroup(group))
      .join("");
  }

  /**
   * Render a single duplicate group
   */
  private renderDuplicateGroup(group: DuplicateSnippetGroup): string {
    return `
      <div class="duplicate-group" data-trigger="${group.trigger}">
        <div class="duplicate-header">
          <h5 class="duplicate-trigger">Trigger: "${group.trigger}"</h5>
          <span class="duplicate-count">${group.duplicates.length} duplicates</span>
        </div>
        
        <div class="duplicate-items">
          ${group.duplicates
            .map((duplicate, index) =>
              this.renderDuplicateItem(duplicate, index, group.trigger),
            )
            .join("")}
        </div>
        
        <div class="duplicate-actions">
          <button type="button" class="btn btn-xs btn-primary" 
                  data-action="resolve-duplicate" 
                  data-trigger="${group.trigger}">
            Resolve Duplicates
          </button>
          <button type="button" class="btn btn-xs btn-secondary" 
                  data-action="merge-duplicates" 
                  data-trigger="${group.trigger}">
            Merge All
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render a single duplicate item
   */
  private renderDuplicateItem(
    duplicate: DuplicateSnippetGroup["duplicates"][0],
    index: number,
    trigger: string,
  ): string {
    const contentPreview = this.getContentPreview(duplicate.snippet.content);
    const isReadOnly = duplicate.isReadOnly;

    return `
      <div class="duplicate-item ${isReadOnly ? "readonly" : ""}" 
           data-store-id="${duplicate.storeId}"
           data-trigger="${trigger}"
           data-index="${index}">
        
        <div class="duplicate-info">
          <div class="store-name">
            <strong>${duplicate.displayName}</strong>
            ${isReadOnly ? '<span class="readonly-badge">Read-only</span>' : ""}
          </div>
          <div class="content-preview">${contentPreview}</div>
          <div class="metadata">
            ID: ${duplicate.snippet.id} | 
            ${duplicate.snippet.updatedAt ? `Updated: ${this.formatDate(duplicate.snippet.updatedAt)}` : "No update date"}
          </div>
        </div>

        <div class="duplicate-controls">
          <select class="resolution-select" 
                  data-store-id="${duplicate.storeId}"
                  data-trigger="${trigger}">
            <option value="keep" ${duplicate.conflictResolution === "keep" ? "selected" : ""}>
              Keep
            </option>
            <option value="update" ${duplicate.conflictResolution === "update" ? "selected" : ""}>
              Update
            </option>
            <option value="delete" ${duplicate.conflictResolution === "delete" ? "selected" : ""}>
              Delete
            </option>
          </select>
          
          ${
            !isReadOnly
              ? `
          <button type="button" class="btn btn-xs btn-secondary" 
                  data-action="edit-duplicate" 
                  data-store-id="${duplicate.storeId}"
                  data-trigger="${trigger}">
            Edit
          </button>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.container) return;

    // Store selection checkboxes
    this.container.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;

      if (target.type === "checkbox" && target.dataset.storeId) {
        this.handleStoreSelection(target.dataset.storeId, target.checked);
      }

      if (target.classList.contains("resolution-select")) {
        this.handleDuplicateResolution(
          target.dataset.storeId!,
          target.dataset.trigger!,
          target.value as "keep" | "update" | "delete",
        );
      }
    });

    // Action buttons
    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;

      if (action) {
        e.preventDefault();
        this.handleAction(action, target.dataset);
      }
    });
  }

  /**
   * Handle store selection
   */
  private handleStoreSelection(storeId: string, isSelected: boolean): void {
    if (isSelected) {
      this.selectedStores.add(storeId);
    } else {
      this.selectedStores.delete(storeId);
    }

    this.updateStoreCardVisibility(storeId, isSelected);
    this.updateSelectionSummary();

    if (this.options.enableDuplicateDetection) {
      this.detectDuplicates();
    }

    if (this.options.onStoreSelectionChange) {
      this.options.onStoreSelectionChange(Array.from(this.selectedStores));
    }
  }

  /**
   * Handle duplicate resolution selection
   */
  private handleDuplicateResolution(
    storeId: string,
    trigger: string,
    resolution: "keep" | "update" | "delete",
  ): void {
    const group = this.duplicateGroups.find((g) => g.trigger === trigger);
    if (group) {
      const duplicate = group.duplicates.find((d) => d.storeId === storeId);
      if (duplicate) {
        duplicate.conflictResolution = resolution;

        if (this.options.onDuplicateResolution) {
          this.options.onDuplicateResolution(this.duplicateGroups);
        }
      }
    }
  }

  /**
   * Handle action button clicks
   */
  private handleAction(action: string, dataset: DOMStringMap): void {
    switch (action) {
      case "select-all-stores":
        this.selectAllStores();
        break;
      case "select-writable-only":
        this.selectWritableStores();
        break;
      case "clear-selection":
        this.clearSelection();
        break;
      case "scan-duplicates":
        this.detectDuplicates();
        break;
      case "toggle-detection-settings":
        this.toggleDetectionSettings();
        break;
      case "apply-to-selected":
        this.applyToSelectedStores();
        break;
      case "preview-changes":
        this.previewChanges();
        break;
      case "resolve-duplicate":
        this.resolveDuplicate(dataset.trigger!);
        break;
      case "merge-duplicates":
        this.mergeDuplicates(dataset.trigger!);
        break;
      case "preview-store":
        this.previewStore(dataset.storeId!);
        break;
      case "edit-store":
        this.editStore(dataset.storeId!);
        break;
      case "save-changes":
        this.saveChanges();
        break;
      case "cancel":
        this.cancel();
        break;
    }
  }

  /**
   * Detect duplicates across selected stores
   */
  private detectDuplicates(): void {
    this.duplicateGroups = [];

    if (this.selectedStores.size === 0) {
      this.updateDuplicatesDisplay();
      return;
    }

    const selectedStoreData = this.options.stores.filter((store) =>
      this.selectedStores.has(store.storeId),
    );

    // Group snippets by trigger
    const triggerGroups: Record<string, DuplicateSnippetGroup["duplicates"]> =
      {};

    selectedStoreData.forEach((store) => {
      store.snippets.forEach((snippet) => {
        const trigger = snippet.trigger;
        if (!triggerGroups[trigger]) {
          triggerGroups[trigger] = [];
        }

        triggerGroups[trigger].push({
          storeId: store.storeId,
          storeName: store.storeName,
          displayName: store.displayName,
          snippet,
          isReadOnly: store.isReadOnly,
          conflictResolution: "keep",
        });
      });
    });

    // Find duplicates (triggers that appear in multiple stores)
    Object.entries(triggerGroups).forEach(([trigger, duplicates]) => {
      if (duplicates.length > 1) {
        this.duplicateGroups.push({
          trigger,
          snippetId: duplicates[0].snippet.id,
          duplicates,
        });
      }
    });

    this.updateDuplicatesDisplay();
  }

  /**
   * Update the duplicates display
   */
  private updateDuplicatesDisplay(): void {
    const duplicatesList = this.container?.querySelector(".duplicates-list");
    const duplicateCount = this.container?.querySelector(".duplicate-count");

    if (duplicatesList) {
      duplicatesList.innerHTML = this.renderDuplicatesList();
    }

    if (duplicateCount) {
      const count = this.duplicateGroups.length;
      duplicateCount.textContent = `(${count} duplicate${count !== 1 ? "s" : ""} found)`;
      duplicateCount.classList.toggle("has-duplicates", count > 0);
    }
  }

  /**
   * Get content preview (truncated)
   */
  private getContentPreview(content: string): string {
    if (!content) return "No content";

    // Remove HTML tags and truncate
    const plainText = content.replace(/<[^>]*>/g, "");
    return plainText.length > 100
      ? plainText.substring(0, 100) + "..."
      : plainText;
  }

  /**
   * Format date string
   */
  private formatDate(dateString: string | Date): string {
    try {
      const date =
        typeof dateString === "string" ? new Date(dateString) : dateString;

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return "Unknown";
      }

      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    } catch {
      return "Unknown";
    }
  }

  /**
   * Get duplicate count for a specific store
   */
  private getDuplicateCountForStore(storeId: string): number {
    return this.duplicateGroups.reduce((count, group) => {
      return (
        count + (group.duplicates.some((d) => d.storeId === storeId) ? 1 : 0)
      );
    }, 0);
  }

  /**
   * Select all stores
   */
  private selectAllStores(): void {
    this.options.stores.forEach((store) => {
      this.selectedStores.add(store.storeId);
    });
    this.updateStoreDisplay();
  }

  /**
   * Select only writable stores
   */
  private selectWritableStores(): void {
    this.selectedStores.clear();
    this.options.stores.forEach((store) => {
      if (!store.isReadOnly) {
        this.selectedStores.add(store.storeId);
      }
    });
    this.updateStoreDisplay();
  }

  /**
   * Clear selection
   */
  private clearSelection(): void {
    this.selectedStores.clear();
    this.updateStoreDisplay();
  }

  /**
   * Update store display
   */
  private updateStoreDisplay(): void {
    if (!this.container) return;

    // Update checkboxes
    this.selectedStores.forEach((storeId) => {
      const checkbox = this.container?.querySelector(
        `input[data-store-id="${storeId}"]`,
      ) as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = true;
      }
      this.updateStoreCardVisibility(storeId, true);
    });

    // Update selection summary
    this.updateSelectionSummary();

    // Refresh duplicate detection
    if (this.options.enableDuplicateDetection) {
      this.detectDuplicates();
    }
  }

  /**
   * Update store card visibility
   */
  private updateStoreCardVisibility(
    storeId: string,
    isSelected: boolean,
  ): void {
    const storeCard = this.container?.querySelector(
      `[data-store-id="${storeId}"]`,
    );
    if (storeCard) {
      storeCard.classList.toggle("selected", isSelected);
    }
  }

  /**
   * Update selection summary
   */
  private updateSelectionSummary(): void {
    // This would update any selection summary UI elements
    if (this.options.onStoreSelectionChange) {
      this.options.onStoreSelectionChange(Array.from(this.selectedStores));
    }
  }

  /**
   * Toggle detection settings
   */
  private toggleDetectionSettings(): void {
    const settingsPanel = this.container?.querySelector(
      ".detection-settings",
    ) as HTMLElement;
    if (settingsPanel) {
      const isVisible = settingsPanel.style.display !== "none";
      settingsPanel.style.display = isVisible ? "none" : "block";
    }
  }

  /**
   * Apply current snippet to selected stores
   */
  private applyToSelectedStores(): void {
    if (!this.options.currentSnippet) return;

    const selectedStoreIds = Array.from(this.selectedStores);
    console.log("🔄 Applying snippet to stores:", selectedStoreIds);

    selectedStoreIds.forEach((storeId) => {
      if (this.options.onSnippetUpdate) {
        this.options.onSnippetUpdate(storeId, this.options.currentSnippet!);
      }
    });
  }

  /**
   * Preview changes
   */
  private previewChanges(): void {
    console.log("👀 Previewing changes...");
    alert("Preview functionality would show a modal with pending changes");
  }

  /**
   * Resolve duplicate
   */
  private resolveDuplicate(trigger: string): void {
    console.log("🔧 Resolving duplicate for trigger:", trigger);
    // Implementation would handle duplicate resolution logic
  }

  /**
   * Merge duplicates
   */
  private mergeDuplicates(trigger: string): void {
    console.log("🔀 Merging duplicates for trigger:", trigger);
    // Implementation would handle duplicate merging logic
  }

  /**
   * Preview store
   */
  private previewStore(storeId: string): void {
    console.log("👀 Previewing store:", storeId);
    // Implementation would show store preview
  }

  /**
   * Edit store
   */
  private editStore(storeId: string): void {
    console.log("✏️ Editing store:", storeId);
    // Implementation would open store editor
  }

  /**
   * Save changes
   */
  private saveChanges(): void {
    console.log("💾 Saving changes...");
    // Implementation would save all changes
  }

  /**
   * Cancel editing
   */
  private cancel(): void {
    console.log("🚫 Cancelling...");
    // Implementation would reset or close editor
  }

  /**
   * Get selected store IDs
   */
  getSelectedStores(): string[] {
    return Array.from(this.selectedStores);
  }

  /**
   * Get duplicate groups
   */
  getDuplicateGroups(): DuplicateSnippetGroup[] {
    return [...this.duplicateGroups];
  }

  /**
   * Validate the current state
   */
  validate(): MultiStoreValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if any stores are selected
    if (this.selectedStores.size === 0) {
      errors.push("At least one store must be selected");
    }

    // Check for unresolved duplicates
    const unresolvedDuplicates = this.duplicateGroups.filter((group) =>
      group.duplicates.some((d) => d.conflictResolution === "keep"),
    );

    if (unresolvedDuplicates.length > 0) {
      warnings.push(
        `${unresolvedDuplicates.length} duplicate group(s) have unresolved conflicts`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      duplicateGroups: this.duplicateGroups,
    };
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }

    this.selectedStores.clear();
    this.duplicateGroups = [];
    this.isInitialized = false;
  }
}

/**
 * Create a multi-store editor with default configuration
 */
export function createMultiStoreEditor(
  container: HTMLElement,
  options: MultiStoreEditorOptions,
): MultiStoreEditor {
  const editor = new MultiStoreEditor(options);
  editor.init(container);
  return editor;
}
