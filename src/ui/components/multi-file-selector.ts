/**
 * Multi-File Selection Interface for Snippet Creation
 * Allows users to create a snippet and save it to multiple JSON stores
 */

import type {
  PriorityTier,
  TierStorageSchema,
} from "../../types/snippet-formats.js";
import type { TextSnippet } from "../../shared/types.js";

export interface MultiFileSelection {
  tierName: PriorityTier;
  storeFileName: string;
  displayName: string;
  priority: number;
  isSelected: boolean;
  isDefault: boolean;
  isDriveFile: boolean;
  fileId?: string;
  conflictResolution?: "overwrite" | "skip" | "merge";
}

export interface MultiFileSelectionOptions {
  availableStores: { [tier: string]: TierStoreInfo[] };
  defaultSelections?: MultiFileSelection[];
  allowConflictResolution?: boolean;
  maxSelections?: number;
  onSelectionChange?: (selections: MultiFileSelection[]) => void;
  onValidationError?: (errors: string[]) => void;
}

export interface TierStoreInfo {
  fileName: string;
  displayName: string;
  snippetCount: number;
  lastModified: string;
  isDefault?: boolean;
  isLocal?: boolean;
  isDriveFile?: boolean;
  fileId?: string;
}

export interface MultiFileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  conflictingTriggers?: { [storeFileName: string]: string[] };
}

/**
 * Multi-file selection component for snippet creation
 */
export class MultiFileSelector {
  private container: HTMLElement | null = null;
  private options: MultiFileSelectionOptions;
  private selections: MultiFileSelection[] = [];
  private isInitialized = false;
  private validationErrors: string[] = [];

  constructor(options: MultiFileSelectionOptions) {
    this.options = {
      allowConflictResolution: true,
      maxSelections: 10,
      ...options,
    };

    this.initializeSelections();
  }

  /**
   * Initialize the multi-file selector
   */
  async init(container: HTMLElement): Promise<void> {
    if (this.isInitialized) {
      throw new Error("Multi-file selector already initialized");
    }

    this.container = container;
    this.createInterface();
    this.setupEventHandlers();
    this.updateSelectionSummary();
    this.isInitialized = true;
  }

  /**
   * Initialize selections from available stores
   */
  private initializeSelections(): void {
    this.selections = [];

    // Create selections for all available stores
    Object.entries(this.options.availableStores).forEach(([tier, stores]) => {
      stores.forEach((store) => {
        const selection: MultiFileSelection = {
          tierName: tier as PriorityTier,
          storeFileName: store.fileName,
          displayName: store.displayName,
          priority: this.getDefaultPriorityForTier(tier as PriorityTier),
          isSelected: store.isDefault || false,
          isDefault: store.isDefault || false,
          isDriveFile: store.isDriveFile || false,
          fileId: store.fileId,
          conflictResolution: "overwrite",
        };

        this.selections.push(selection);
      });
    });

    // Apply default selections if provided
    if (this.options.defaultSelections) {
      this.options.defaultSelections.forEach((defaultSelection) => {
        const existing = this.selections.find(
          (s) =>
            s.tierName === defaultSelection.tierName &&
            s.storeFileName === defaultSelection.storeFileName,
        );
        if (existing) {
          Object.assign(existing, defaultSelection);
        }
      });
    }
  }

  /**
   * Get default priority for a tier
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
   * Create the multi-file selection interface
   */
  private createInterface(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="multi-file-selector">
        <div class="selector-header">
          <h3 class="selector-title">Select Target Stores</h3>
          <p class="selector-description">
            Choose which JSON stores to save this snippet to. You can save to multiple stores 
            across different tiers with different priorities.
          </p>
        </div>

        <div class="selection-controls">
          <div class="control-group">
            <button type="button" class="btn btn-sm btn-secondary" data-action="select-all">
              Select All
            </button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="select-none">
              Select None
            </button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="select-defaults">
              Select Defaults
            </button>
          </div>
          
          <div class="selection-summary">
            <span class="selection-count">0 stores selected</span>
            <span class="selection-tiers"></span>
          </div>
        </div>

        <div class="store-grid">
          ${this.renderStoreGrid()}
        </div>

        <div class="advanced-options" style="display: none;">
          <h4>Advanced Options</h4>
          
          <div class="option-group">
            <label class="checkbox-label">
              <input type="checkbox" id="enable-conflict-resolution" checked>
              Enable conflict resolution for duplicate triggers
            </label>
          </div>

          <div class="option-group">
            <label class="checkbox-label">
              <input type="checkbox" id="auto-priority-spacing">
              Automatically space priorities across tiers
            </label>
          </div>
        </div>

        <div class="selector-actions">
          <button type="button" class="btn btn-secondary" data-action="toggle-advanced">
            Advanced Options
          </button>
          <button type="button" class="btn btn-secondary" data-action="preview">
            Preview Changes
          </button>
        </div>

        <div class="validation-messages" style="display: none;">
          <!-- Validation messages will appear here -->
        </div>
      </div>
    `;
  }

  /**
   * Render the store grid
   */
  private renderStoreGrid(): string {
    const tierOrder: PriorityTier[] = ["personal", "team", "org"];

    return tierOrder
      .map((tier) => {
        const tierStores = this.selections.filter((s) => s.tierName === tier);
        if (tierStores.length === 0) return "";

        return `
        <div class="tier-section">
          <h4 class="tier-title">${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier</h4>
          <div class="stores-list">
            ${tierStores.map((store) => this.renderStoreCard(store)).join("")}
          </div>
        </div>
      `;
      })
      .join("");
  }

  /**
   * Render a single store card
   */
  private renderStoreCard(store: MultiFileSelection): string {
    const storageTypeIcon = store.isDriveFile
      ? '<span class="storage-icon drive-icon">☁️</span>'
      : '<span class="storage-icon local-icon">💾</span>';

    const defaultBadge = store.isDefault
      ? '<span class="default-badge">Default</span>'
      : "";

    return `
      <div class="store-card ${store.isSelected ? "selected" : ""}" 
           data-tier="${store.tierName}" 
           data-store="${store.storeFileName}">
        
        <div class="store-header">
          <label class="store-checkbox">
            <input type="checkbox" 
                   ${store.isSelected ? "checked" : ""} 
                   data-tier="${store.tierName}"
                   data-store="${store.storeFileName}">
            <span class="checkmark"></span>
          </label>
          
          <div class="store-info">
            <div class="store-name">
              ${storageTypeIcon}
              ${store.displayName}
              ${defaultBadge}
            </div>
            <div class="store-filename">${store.storeFileName}</div>
          </div>
        </div>

        <div class="store-details ${store.isSelected ? "visible" : "hidden"}">
          <div class="detail-row">
            <label for="priority-${store.tierName}-${store.storeFileName}">Priority:</label>
            <input type="number" 
                   id="priority-${store.tierName}-${store.storeFileName}"
                   value="${store.priority}" 
                   min="1" 
                   max="1000"
                   class="priority-input"
                   data-tier="${store.tierName}"
                   data-store="${store.storeFileName}">
          </div>

          ${
            this.options.allowConflictResolution
              ? `
            <div class="detail-row">
              <label for="conflict-${store.tierName}-${store.storeFileName}">If trigger exists:</label>
              <select id="conflict-${store.tierName}-${store.storeFileName}"
                      class="conflict-select"
                      data-tier="${store.tierName}"
                      data-store="${store.storeFileName}">
                <option value="overwrite" ${store.conflictResolution === "overwrite" ? "selected" : ""}>
                  Overwrite existing
                </option>
                <option value="skip" ${store.conflictResolution === "skip" ? "selected" : ""}>
                  Skip if exists
                </option>
                <option value="merge" ${store.conflictResolution === "merge" ? "selected" : ""}>
                  Merge with existing
                </option>
              </select>
            </div>
          `
              : ""
          }

          <div class="store-metadata">
            <small class="metadata-item">
              📁 ${store.storeFileName}
            </small>
            ${
              store.isDriveFile
                ? `
              <small class="metadata-item">
                🔗 Google Drive
              </small>
            `
                : `
              <small class="metadata-item">
                💻 Local Storage
              </small>
            `
            }
          </div>
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

      if (
        target.type === "checkbox" &&
        target.dataset.tier &&
        target.dataset.store
      ) {
        this.handleStoreSelection(
          target.dataset.tier as PriorityTier,
          target.dataset.store,
          target.checked,
        );
      }

      if (
        target.type === "number" &&
        target.classList.contains("priority-input")
      ) {
        this.handlePriorityChange(
          target.dataset.tier as PriorityTier,
          target.dataset.store!,
          parseInt(target.value),
        );
      }

      if (target.classList.contains("conflict-select")) {
        this.handleConflictResolutionChange(
          target.dataset.tier as PriorityTier,
          target.dataset.store!,
          target.value as "overwrite" | "skip" | "merge",
        );
      }
    });

    // Action buttons
    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;

      if (action) {
        e.preventDefault();
        this.handleAction(action);
      }
    });

    // Advanced options toggle
    const advancedToggle = this.container.querySelector(
      '[data-action="toggle-advanced"]',
    );
    if (advancedToggle) {
      advancedToggle.addEventListener("click", () => {
        this.toggleAdvancedOptions();
      });
    }
  }

  /**
   * Handle store selection change
   */
  private handleStoreSelection(
    tier: PriorityTier,
    storeFileName: string,
    isSelected: boolean,
  ): void {
    const selection = this.selections.find(
      (s) => s.tierName === tier && s.storeFileName === storeFileName,
    );

    if (selection) {
      selection.isSelected = isSelected;
      this.updateStoreCardVisibility(tier, storeFileName, isSelected);
      this.updateSelectionSummary();
      this.validateSelections();

      if (this.options.onSelectionChange) {
        this.options.onSelectionChange(this.getSelectedStores());
      }
    }
  }

  /**
   * Handle priority change
   */
  private handlePriorityChange(
    tier: PriorityTier,
    storeFileName: string,
    priority: number,
  ): void {
    const selection = this.selections.find(
      (s) => s.tierName === tier && s.storeFileName === storeFileName,
    );

    if (selection) {
      selection.priority = priority;
      this.validateSelections();

      if (this.options.onSelectionChange) {
        this.options.onSelectionChange(this.getSelectedStores());
      }
    }
  }

  /**
   * Handle conflict resolution change
   */
  private handleConflictResolutionChange(
    tier: PriorityTier,
    storeFileName: string,
    resolution: "overwrite" | "skip" | "merge",
  ): void {
    const selection = this.selections.find(
      (s) => s.tierName === tier && s.storeFileName === storeFileName,
    );

    if (selection) {
      selection.conflictResolution = resolution;

      if (this.options.onSelectionChange) {
        this.options.onSelectionChange(this.getSelectedStores());
      }
    }
  }

  /**
   * Handle action button clicks
   */
  private handleAction(action: string): void {
    switch (action) {
      case "select-all":
        this.selectAll();
        break;
      case "select-none":
        this.selectNone();
        break;
      case "select-defaults":
        this.selectDefaults();
        break;
      case "toggle-advanced":
        this.toggleAdvancedOptions();
        break;
      case "preview":
        this.showPreview();
        break;
    }
  }

  /**
   * Select all stores
   */
  private selectAll(): void {
    this.selections.forEach((selection) => {
      selection.isSelected = true;
    });
    this.updateInterface();
  }

  /**
   * Select no stores
   */
  private selectNone(): void {
    this.selections.forEach((selection) => {
      selection.isSelected = false;
    });
    this.updateInterface();
  }

  /**
   * Select default stores only
   */
  private selectDefaults(): void {
    this.selections.forEach((selection) => {
      selection.isSelected = selection.isDefault;
    });
    this.updateInterface();
  }

  /**
   * Toggle advanced options visibility
   */
  private toggleAdvancedOptions(): void {
    const advancedSection = this.container?.querySelector(
      ".advanced-options",
    ) as HTMLElement;
    if (advancedSection) {
      const isVisible = advancedSection.style.display !== "none";
      advancedSection.style.display = isVisible ? "none" : "block";

      const toggleButton = this.container?.querySelector(
        '[data-action="toggle-advanced"]',
      ) as HTMLElement;
      if (toggleButton) {
        toggleButton.textContent = isVisible
          ? "Advanced Options"
          : "Hide Advanced";
      }
    }
  }

  /**
   * Show preview of changes
   */
  private showPreview(): void {
    const selectedStores = this.getSelectedStores();
    console.log("📋 Preview of selected stores:", selectedStores);

    // Here you would show a modal or expand a section with preview
    alert(
      `Preview: Will save to ${selectedStores.length} stores:\n${selectedStores
        .map(
          (s) => `- ${s.displayName} (${s.tierName}, priority: ${s.priority})`,
        )
        .join("\n")}`,
    );
  }

  /**
   * Update store card visibility
   */
  private updateStoreCardVisibility(
    tier: PriorityTier,
    storeFileName: string,
    isVisible: boolean,
  ): void {
    const storeCard = this.container?.querySelector(
      `[data-tier="${tier}"][data-store="${storeFileName}"]`,
    ) as HTMLElement;

    if (storeCard) {
      const details = storeCard.querySelector(".store-details") as HTMLElement;
      if (details) {
        details.classList.toggle("visible", isVisible);
        details.classList.toggle("hidden", !isVisible);
      }

      storeCard.classList.toggle("selected", isVisible);
    }
  }

  /**
   * Update selection summary
   */
  private updateSelectionSummary(): void {
    const selectedStores = this.getSelectedStores();
    const countElement = this.container?.querySelector(".selection-count");
    const tiersElement = this.container?.querySelector(".selection-tiers");

    if (countElement) {
      countElement.textContent = `${selectedStores.length} store${selectedStores.length !== 1 ? "s" : ""} selected`;
    }

    if (tiersElement) {
      const tierCounts = selectedStores.reduce(
        (acc, store) => {
          acc[store.tierName] = (acc[store.tierName] || 0) + 1;
          return acc;
        },
        {} as Record<PriorityTier, number>,
      );

      const tierSummary = Object.entries(tierCounts)
        .map(([tier, count]) => `${tier}: ${count}`)
        .join(", ");

      tiersElement.textContent = tierSummary ? `(${tierSummary})` : "";
    }
  }

  /**
   * Update the entire interface
   */
  private updateInterface(): void {
    if (!this.container) return;

    // Update checkboxes
    this.selections.forEach((selection) => {
      const checkbox = this.container?.querySelector(
        `input[type="checkbox"][data-tier="${selection.tierName}"][data-store="${selection.storeFileName}"]`,
      ) as HTMLInputElement;

      if (checkbox) {
        checkbox.checked = selection.isSelected;
      }

      this.updateStoreCardVisibility(
        selection.tierName,
        selection.storeFileName,
        selection.isSelected,
      );
    });

    this.updateSelectionSummary();
    this.validateSelections();

    if (this.options.onSelectionChange) {
      this.options.onSelectionChange(this.getSelectedStores());
    }
  }

  /**
   * Validate current selections
   */
  private validateSelections(): MultiFileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const selectedStores = this.getSelectedStores();

    // Check if at least one store is selected
    if (selectedStores.length === 0) {
      errors.push("At least one store must be selected");
    }

    // Check maximum selections
    if (
      this.options.maxSelections &&
      selectedStores.length > this.options.maxSelections
    ) {
      errors.push(
        `Maximum ${this.options.maxSelections} stores can be selected`,
      );
    }

    // Check for duplicate priorities within the same tier
    const tierPriorities = selectedStores.reduce(
      (acc, store) => {
        if (!acc[store.tierName]) acc[store.tierName] = [];
        acc[store.tierName].push(store.priority);
        return acc;
      },
      {} as Record<PriorityTier, number[]>,
    );

    Object.entries(tierPriorities).forEach(([tier, priorities]) => {
      const duplicates = priorities.filter(
        (priority, index) => priorities.indexOf(priority) !== index,
      );
      if (duplicates.length > 0) {
        warnings.push(
          `Duplicate priorities in ${tier} tier: ${duplicates.join(", ")}`,
        );
      }
    });

    // Check for invalid priorities
    selectedStores.forEach((store) => {
      if (store.priority < 0 || store.priority > 1000) {
        errors.push(
          `Priority for ${store.displayName} must be between 0 and 1000 (0 = highest)`,
        );
      }
    });

    this.validationErrors = errors;
    this.displayValidationMessages(errors, warnings);

    if (this.options.onValidationError && errors.length > 0) {
      this.options.onValidationError(errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Display validation messages
   */
  private displayValidationMessages(
    errors: string[],
    warnings: string[],
  ): void {
    const messagesContainer = this.container?.querySelector(
      ".validation-messages",
    ) as HTMLElement;
    if (!messagesContainer) return;

    if (errors.length === 0 && warnings.length === 0) {
      messagesContainer.style.display = "none";
      return;
    }

    messagesContainer.innerHTML = `
      ${
        errors.length > 0
          ? `
        <div class="validation-errors">
          <h4>Please fix the following errors:</h4>
          <ul>
            ${errors.map((error) => `<li>${error}</li>`).join("")}
          </ul>
        </div>
      `
          : ""
      }
      
      ${
        warnings.length > 0
          ? `
        <div class="validation-warnings">
          <h4>Warnings:</h4>
          <ul>
            ${warnings.map((warning) => `<li>${warning}</li>`).join("")}
          </ul>
        </div>
      `
          : ""
      }
    `;

    messagesContainer.style.display = "block";
  }

  /**
   * Get selected stores
   */
  getSelectedStores(): MultiFileSelection[] {
    return this.selections.filter((s) => s.isSelected);
  }

  /**
   * Get all selections
   */
  getAllSelections(): MultiFileSelection[] {
    return [...this.selections];
  }

  /**
   * Set selections programmatically
   */
  setSelections(selections: MultiFileSelection[]): void {
    this.selections = selections;
    this.updateInterface();
  }

  /**
   * Check if selections are valid
   */
  isValid(): boolean {
    return this.validateSelections().isValid;
  }

  /**
   * Get validation errors
   */
  getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }

    this.selections = [];
    this.isInitialized = false;
  }
}

/**
 * Create a multi-file selector with default configuration
 */
export function createMultiFileSelector(
  container: HTMLElement,
  options: MultiFileSelectionOptions,
): MultiFileSelector {
  const selector = new MultiFileSelector(options);
  selector.init(container);
  return selector;
}
