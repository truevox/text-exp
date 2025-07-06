/**
 * Folder Picker Component for Options Page
 * Handles Google Drive folder selection with navigation and breadcrumb support
 */

import { SettingsMessages } from "../../shared/messaging.js";
import type { ConfiguredScopedSource } from "../../shared/types.js";
import type { OptionsElements } from "../utils/dom-elements.js";

export interface FolderItem {
  id: string;
  name: string;
  parentId?: string;
  isFolder: boolean;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export type StatusCallback = (
  message: string,
  type: "success" | "error" | "warning" | "info",
) => void;

export class FolderPickerComponent {
  private elements: OptionsElements;
  private showStatus: StatusCallback;

  // Folder picker state
  private currentFolderScope: "personal" | "department" | "org" | null = null;
  private selectedFolder: { id: string; name: string } | null = null;
  private availableFolders: FolderItem[] = [];
  private currentParentId: string = "root";
  private breadcrumbPath: BreadcrumbItem[] = [];

  constructor(elements: OptionsElements, showStatus: StatusCallback) {
    this.elements = elements;
    this.showStatus = showStatus;
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for folder picker
   */
  private initializeEventListeners(): void {
    // Close button
    this.elements.closeFolderPickerButton.addEventListener("click", () => {
      this.closeFolderPicker();
    });

    // Cancel button
    this.elements.cancelFolderPickerButton.addEventListener("click", () => {
      this.closeFolderPicker();
    });

    // Confirm button
    this.elements.confirmFolderPickerButton.addEventListener("click", () => {
      this.confirmFolderSelection();
    });

    // Create folder button
    this.elements.createFolderButton.addEventListener("click", () => {
      this.handleCreateFolder();
    });

    // Modal background click to close
    this.elements.folderPickerModal.addEventListener("click", (e) => {
      if (e.target === this.elements.folderPickerModal) {
        this.closeFolderPicker();
      }
    });

    // Escape key to close
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        this.elements.folderPickerModal.style.display === "flex"
      ) {
        this.closeFolderPicker();
      }
    });
  }

  /**
   * Handle folder selection for a given scope
   */
  async handleSelectFolder(
    scope: "personal" | "department" | "org",
    cloudProvider: string,
  ): Promise<void> {
    try {
      if (cloudProvider === "local") {
        this.showStatus("Please select a cloud provider first.", "warning");
        return;
      }

      if (cloudProvider !== "google-drive") {
        this.showStatus(
          "Folder picker is currently only available for Google Drive.",
          "warning",
        );
        return;
      }

      // Store the current scope for use in confirmation
      this.currentFolderScope = scope;

      // Open the folder picker modal
      await this.openFolderPicker();
    } catch (error) {
      console.error(`Failed to open folder picker for ${scope}:`, error);
      this.showStatus(
        `Failed to open folder picker: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Open the folder picker modal and load available folders
   */
  private async openFolderPicker(): Promise<void> {
    // Reset state
    this.selectedFolder = null;
    this.availableFolders = [];
    this.currentParentId = "root";
    this.breadcrumbPath = [{ id: "root", name: "My Drive" }];

    // Show loading state
    this.showFolderPickerLoading();
    this.elements.folderPickerModal.style.display = "flex";

    // Update breadcrumb
    this.updateBreadcrumb();

    try {
      // Load folders from Google Drive
      await this.loadAvailableFolders();
    } catch (error) {
      console.error("Failed to load folders:", error);
      this.showFolderPickerError(
        `Failed to load folders: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Load available folders from Google Drive
   */
  private async loadAvailableFolders(parentId?: string): Promise<void> {
    try {
      // Call the background script to get folders without auto-selecting
      const response = await chrome.runtime.sendMessage({
        type: "GET_GOOGLE_DRIVE_FOLDERS",
        parentId: parentId || this.currentParentId,
      });

      if (response.success) {
        this.availableFolders = response.data;
        this.renderFolderList();
      } else {
        throw new Error(response.error || "Failed to fetch folders");
      }
    } catch (error) {
      throw new Error(
        `Failed to load Google Drive folders: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Render the list of folders in the modal
   */
  private renderFolderList(): void {
    this.hideFolderPickerLoading();

    if (this.availableFolders.length === 0) {
      this.elements.folderPickerList.innerHTML =
        '<p class="no-folders">No folders found. You can create a new folder.</p>';
    } else {
      const folderItems = this.availableFolders
        .map(
          (folder) => `
        <div class="folder-item navigable" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
          <span class="folder-icon">📁</span>
          <div class="folder-details">
            <div class="folder-name">${folder.name}</div>
            <div class="folder-path">ID: ${folder.id}</div>
          </div>
          <div class="folder-actions">
            <button class="folder-action-button navigate-button" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
              Open →
            </button>
            <button class="folder-action-button select-button" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
              Select
            </button>
          </div>
        </div>
      `,
        )
        .join("");

      this.elements.folderPickerList.innerHTML = folderItems;

      // Add click listeners to navigate buttons
      this.elements.folderPickerList
        .querySelectorAll(".navigate-button")
        .forEach((button) => {
          button.addEventListener("click", (e) => {
            e.stopPropagation();
            const folderId = button.getAttribute("data-folder-id")!;
            const folderName = button.getAttribute("data-folder-name")!;
            this.navigateToFolder(folderId, folderName);
          });
        });

      // Add click listeners to select buttons
      this.elements.folderPickerList
        .querySelectorAll(".select-button")
        .forEach((button) => {
          button.addEventListener("click", (e) => {
            e.stopPropagation();
            const folderElement = button.closest(".folder-item") as HTMLElement;
            this.selectFolderItem(folderElement);
          });
        });

      // Add double-click listeners to folder items for navigation
      this.elements.folderPickerList
        .querySelectorAll(".folder-item")
        .forEach((item) => {
          item.addEventListener("dblclick", () => {
            const folderId = item.getAttribute("data-folder-id")!;
            const folderName = item.getAttribute("data-folder-name")!;
            this.navigateToFolder(folderId, folderName);
          });
        });
    }

    this.elements.folderPickerList.style.display = "block";
  }

  /**
   * Handle folder item selection
   */
  private selectFolderItem(element: HTMLElement): void {
    // Remove previous selection
    this.elements.folderPickerList
      .querySelectorAll(".folder-item")
      .forEach((item) => {
        item.classList.remove("selected");
      });

    // Select current item
    element.classList.add("selected");

    // Store selected folder
    this.selectedFolder = {
      id: element.getAttribute("data-folder-id")!,
      name: element.getAttribute("data-folder-name")!,
    };

    // Enable confirm button
    this.elements.confirmFolderPickerButton.disabled = false;
  }

  /**
   * Confirm folder selection and save to settings
   */
  private async confirmFolderSelection(): Promise<void> {
    if (!this.selectedFolder || !this.currentFolderScope) {
      return;
    }

    try {
      const scope = this.currentFolderScope;
      const folder = this.selectedFolder;

      // Ask for custom display name
      const customDisplayName = prompt(
        `Enter a display name for your ${scope} snippets:`,
        folder.name,
      );
      const finalDisplayName = customDisplayName || folder.name;

      // Create configured source
      const newConfiguredSource: ConfiguredScopedSource = {
        provider: "google-drive", // Hardcoded since folder picker only works with Google Drive
        scope: scope,
        folderId: folder.id,
        displayName: finalDisplayName,
      };

      // Get current settings to update
      const currentSettings = await SettingsMessages.getSettings();
      const updatedConfiguredSources =
        currentSettings.configuredSources?.filter((s) => s.scope !== scope) ||
        [];
      updatedConfiguredSources.push(newConfiguredSource);

      await SettingsMessages.updateSettings({
        configuredSources: updatedConfiguredSources,
      });

      // Update UI
      this.updateFolderInputDisplay(scope, finalDisplayName);

      // Close modal and show success
      this.closeFolderPicker();
      this.showStatus(
        `Folder selected for ${scope}: ${finalDisplayName}`,
        "success",
      );
    } catch (error) {
      console.error("Failed to save folder selection:", error);
      this.showStatus(
        `Failed to save folder selection: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  }

  /**
   * Update the folder input display with selected folder
   */
  private updateFolderInputDisplay(
    scope: "personal" | "department" | "org",
    displayName: string,
  ): void {
    switch (scope) {
      case "personal":
        this.elements.personalFolderIdInput.value = displayName;
        break;
      case "department":
        this.elements.departmentFolderIdInput.value = displayName;
        break;
      case "org":
        this.elements.organizationFolderIdInput.value = displayName;
        break;
    }
  }

  /**
   * Handle creating a new folder
   */
  private async handleCreateFolder(): Promise<void> {
    const folderName = prompt(
      "Enter a name for the new folder:",
      "PuffPuffPaste Snippets",
    );
    if (!folderName) {
      return;
    }

    try {
      this.showFolderPickerLoading();

      // Call background script to create folder
      const response = await chrome.runtime.sendMessage({
        type: "CREATE_GOOGLE_DRIVE_FOLDER",
        folderName: folderName,
        parentId: this.currentParentId,
      });

      if (response.success) {
        // Add new folder to available folders and refresh list
        this.availableFolders.unshift(response.data);
        this.renderFolderList();
        this.showStatus(`Created folder: ${folderName}`, "success");
      } else {
        throw new Error(response.error || "Failed to create folder");
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
      this.showFolderPickerError(
        `Failed to create folder: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Close the folder picker modal
   */
  private closeFolderPicker(): void {
    this.elements.folderPickerModal.style.display = "none";
    this.selectedFolder = null;
    this.currentFolderScope = null;
    this.availableFolders = [];
    this.elements.confirmFolderPickerButton.disabled = true;

    // Reset modal state
    this.hideFolderPickerError();
    this.hideFolderPickerLoading();
    this.elements.folderPickerList.style.display = "none";
  }

  /**
   * Navigate to a folder
   */
  private async navigateToFolder(
    folderId: string,
    folderName: string,
  ): Promise<void> {
    try {
      // Update current state
      this.currentParentId = folderId;
      this.breadcrumbPath.push({ id: folderId, name: folderName });

      // Show loading
      this.showFolderPickerLoading();

      // Update breadcrumb
      this.updateBreadcrumb();

      // Load folders in the new directory
      await this.loadAvailableFolders();
    } catch (error) {
      console.error("Failed to navigate to folder:", error);
      this.showFolderPickerError(
        `Failed to open folder: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Navigate to a breadcrumb folder
   */
  private async navigateToBreadcrumbFolder(folderId: string): Promise<void> {
    try {
      // Find the index of this folder in breadcrumb
      const index = this.breadcrumbPath.findIndex(
        (item) => item.id === folderId,
      );
      if (index === -1) return;

      // Update state
      this.currentParentId = folderId;
      this.breadcrumbPath = this.breadcrumbPath.slice(0, index + 1);

      // Show loading
      this.showFolderPickerLoading();

      // Update breadcrumb
      this.updateBreadcrumb();

      // Load folders in the selected directory
      await this.loadAvailableFolders();
    } catch (error) {
      console.error("Failed to navigate to breadcrumb folder:", error);
      this.showFolderPickerError(
        `Failed to navigate: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update breadcrumb navigation
   */
  private updateBreadcrumb(): void {
    const breadcrumbItems = this.breadcrumbPath
      .map((item, index) => {
        const isLast = index === this.breadcrumbPath.length - 1;
        return `<span class="breadcrumb-item ${isLast ? "current" : ""}" data-folder-id="${item.id}">
        ${index === 0 ? "📁" : ""} ${item.name}
      </span>`;
      })
      .join("");

    this.elements.folderBreadcrumb.innerHTML = breadcrumbItems;

    // Add click listeners to breadcrumb items
    this.elements.folderBreadcrumb
      .querySelectorAll(".breadcrumb-item:not(.current)")
      .forEach((item) => {
        item.addEventListener("click", () => {
          const folderId = item.getAttribute("data-folder-id")!;
          this.navigateToBreadcrumbFolder(folderId);
        });
      });
  }

  /**
   * Show folder picker loading state
   */
  private showFolderPickerLoading(): void {
    this.elements.folderPickerLoading.style.display = "block";
    this.elements.folderPickerList.style.display = "none";
    this.hideFolderPickerError();
  }

  /**
   * Hide folder picker loading state
   */
  private hideFolderPickerLoading(): void {
    this.elements.folderPickerLoading.style.display = "none";
  }

  /**
   * Show folder picker error message
   */
  private showFolderPickerError(message: string): void {
    this.elements.folderPickerError.textContent = message;
    this.elements.folderPickerError.style.display = "block";
    this.hideFolderPickerLoading();
    this.elements.folderPickerList.style.display = "none";
  }

  /**
   * Hide folder picker error message
   */
  private hideFolderPickerError(): void {
    this.elements.folderPickerError.style.display = "none";
  }

  /**
   * Get current folder selection state
   */
  getSelectionState(): {
    scope: "personal" | "department" | "org" | null;
    folder: { id: string; name: string } | null;
  } {
    return {
      scope: this.currentFolderScope,
      folder: this.selectedFolder,
    };
  }

  /**
   * Check if folder picker is currently open
   */
  isOpen(): boolean {
    return this.elements.folderPickerModal.style.display === "flex";
  }

  /**
   * Reset folder picker state
   */
  reset(): void {
    this.closeFolderPicker();
  }
}
