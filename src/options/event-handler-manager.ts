/**
 * Event Handler Manager for Options Page
 * Manages all event listeners and user interactions
 */

import type { OptionsElements } from "./utils/dom-elements.js";
import type { UICallbacks } from "./options-ui.js";

export class EventHandlerManager {
  private elements: OptionsElements;
  private callbacks: UICallbacks;

  constructor(elements: OptionsElements, callbacks: UICallbacks) {
    this.elements = elements;
    this.callbacks = callbacks;
  }

  /**
   * Setup all event listeners
   */
  setupEventListeners(): void {
    this.setupInitialEvents();
    this.setupGeneralSettingsEvents();
    this.setupGlobalToggleEvents();
    this.setupCloudSettingsEvents();
    this.setupScopedFolderEvents();
    this.setupCloudActionEvents();
    this.setupCollaborationEvents();
    this.setupDataManagementEvents();
    this.setupAdvancedEvents();
    this.setupHeaderActionEvents();
    this.setupStatusEvents();
    this.setupFooterEvents();
    this.setupFolderPickerEvents();
    this.setupNavigationEvents();
  }

  /**
   * Setup initial setup events
   */
  private setupInitialEvents(): void {
    this.elements.getStartedButton.addEventListener("click", () =>
      this.callbacks.onGetStarted(),
    );
  }

  /**
   * Setup general settings events
   */
  private setupGeneralSettingsEvents(): void {
    this.elements.enabledCheckbox.addEventListener("change", () =>
      this.callbacks.onSettingsChange(),
    );
    this.elements.caseSensitiveCheckbox.addEventListener("change", () =>
      this.callbacks.onSettingsChange(),
    );
    this.elements.notificationsCheckbox.addEventListener("change", () =>
      this.callbacks.onSettingsChange(),
    );

    this.elements.triggerDelaySlider.addEventListener("input", () => {
      this.updateTriggerDelayValue();
      this.callbacks.onSettingsChange();
    });
  }

  /**
   * Setup global toggle events
   */
  private setupGlobalToggleEvents(): void {
    this.elements.globalToggleEnabledCheckbox.addEventListener("change", () => {
      this.updateGlobalToggleStatus();
      this.callbacks.onSettingsChange();
    });

    this.elements.editShortcutButton.addEventListener("click", () =>
      this.callbacks.onEditShortcut(),
    );

    this.elements.globalToggleShortcut.addEventListener("keydown", (e) =>
      this.handleShortcutCapture(e),
    );
  }

  /**
   * Setup cloud settings events
   */
  private setupCloudSettingsEvents(): void {
    this.elements.cloudProviderSelect.addEventListener("change", () =>
      this.callbacks.onProviderChange(),
    );
    this.elements.autoSyncCheckbox.addEventListener("change", () =>
      this.callbacks.onSettingsChange(),
    );

    this.elements.syncIntervalSlider.addEventListener("input", () => {
      this.updateSyncIntervalValue();
      this.callbacks.onSettingsChange();
    });
  }

  /**
   * Setup scoped folder selection events
   */
  private setupScopedFolderEvents(): void {
    this.elements.selectPersonalFolderButton.addEventListener("click", () =>
      this.callbacks.onSelectFolder("personal"),
    );
    this.elements.selectDepartmentFolderButton.addEventListener("click", () =>
      this.callbacks.onSelectFolder("department"),
    );
    this.elements.selectOrganizationFolderButton.addEventListener("click", () =>
      this.callbacks.onSelectFolder("org"),
    );
  }

  /**
   * Setup cloud action events
   */
  private setupCloudActionEvents(): void {
    this.elements.connectButton.addEventListener("click", () =>
      this.callbacks.onConnect(),
    );
    this.elements.syncNowButton.addEventListener("click", () =>
      this.callbacks.onSyncNow(),
    );
    this.elements.forceUploadButton.addEventListener("click", () =>
      this.callbacks.onForceUpload(),
    );
    this.elements.forceDownloadButton.addEventListener("click", () =>
      this.callbacks.onForceDownload(),
    );
  }

  /**
   * Setup collaboration events
   */
  private setupCollaborationEvents(): void {
    this.elements.sharedSnippetsCheckbox.addEventListener("change", () =>
      this.callbacks.onSettingsChange(),
    );
  }

  /**
   * Setup data management events
   */
  private setupDataManagementEvents(): void {
    this.elements.cleanupStorageButton.addEventListener("click", () =>
      this.callbacks.onCleanupStorage(),
    );
    this.elements.clearLocalButton.addEventListener("click", () =>
      this.callbacks.onClearLocal(),
    );
    this.elements.resetAllButton.addEventListener("click", () =>
      this.callbacks.onResetAll(),
    );
  }

  /**
   * Setup advanced settings events
   */
  private setupAdvancedEvents(): void {
    this.elements.debugCheckbox.addEventListener("change", () =>
      this.callbacks.onSettingsChange(),
    );
    this.elements.viewLogsButton.addEventListener("click", () =>
      this.callbacks.onViewLogs(),
    );
  }

  /**
   * Setup header action events
   */
  private setupHeaderActionEvents(): void {
    this.elements.exportButton.addEventListener("click", () =>
      this.callbacks.onExport(),
    );
    this.elements.importButton.addEventListener("click", () =>
      this.callbacks.onImport(),
    );
    this.elements.importFileInput.addEventListener("change", () =>
      this.callbacks.onFileImport(),
    );
  }

  /**
   * Setup status banner events
   */
  private setupStatusEvents(): void {
    this.elements.statusClose.addEventListener("click", () =>
      this.hideStatus(),
    );
  }

  /**
   * Setup footer link events
   */
  private setupFooterEvents(): void {
    this.elements.helpLink.addEventListener("click", (e) =>
      this.handleExternalLink(e, "help"),
    );
    this.elements.feedbackLink.addEventListener("click", (e) =>
      this.handleExternalLink(e, "feedback"),
    );
    this.elements.privacyLink.addEventListener("click", (e) =>
      this.handleExternalLink(e, "privacy"),
    );
  }

  /**
   * Setup folder picker modal events
   */
  private setupFolderPickerEvents(): void {
    this.elements.closeFolderPickerButton.addEventListener("click", () =>
      this.callbacks.onCloseFolderPicker(),
    );
    this.elements.cancelFolderPickerButton.addEventListener("click", () =>
      this.callbacks.onCloseFolderPicker(),
    );
    this.elements.confirmFolderPickerButton.addEventListener("click", () =>
      this.callbacks.onConfirmFolderSelection(),
    );
    this.elements.createFolderButton.addEventListener("click", () =>
      this.callbacks.onCreateFolder(),
    );

    // Close modal on backdrop click
    this.elements.folderPickerModal.addEventListener("click", (e) => {
      if (e.target === this.elements.folderPickerModal) {
        this.callbacks.onCloseFolderPicker();
      }
    });
  }

  /**
   * Setup navigation events
   */
  private setupNavigationEvents(): void {
    // Handle window hash changes for anchor navigation
    window.addEventListener("hashchange", () => this.handleAnchorNavigation());

    // Handle initial hash on page load
    if (window.location.hash) {
      setTimeout(() => this.handleAnchorNavigation(), 100);
    }
  }

  /**
   * Update trigger delay display value
   */
  private updateTriggerDelayValue(): void {
    const value = parseInt(this.elements.triggerDelaySlider.value);
    if (this.elements.triggerDelayValue) {
      this.elements.triggerDelayValue.textContent = `${value}ms`;
    }
  }

  /**
   * Update global toggle status display
   */
  private updateGlobalToggleStatus(): void {
    const isEnabled = this.elements.globalToggleEnabledCheckbox.checked;
    const statusBadge =
      this.elements.globalToggleStatus.querySelector(".status-badge");

    if (statusBadge) {
      statusBadge.textContent = isEnabled ? "Active" : "Disabled";
      statusBadge.className = `status-badge ${isEnabled ? "enabled" : "disabled"}`;
    }
  }

  /**
   * Update sync interval display value
   */
  private updateSyncIntervalValue(): void {
    const value = parseInt(this.elements.syncIntervalSlider.value);
    if (this.elements.syncIntervalValue) {
      this.elements.syncIntervalValue.textContent = `${value} minutes`;
    }
  }

  /**
   * Handle shortcut key capture for global toggle
   */
  private handleShortcutCapture(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Cmd");

    if (e.key && !["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      parts.push(e.key.toUpperCase());
    }

    const shortcut = parts.join("+");
    if (shortcut.includes("+") && parts.length > 1) {
      this.elements.globalToggleShortcut.value = shortcut;
      this.callbacks.onSettingsChange();
    }
  }

  /**
   * Hide status banner
   */
  private hideStatus(): void {
    this.elements.statusBanner.classList.add("hidden");
  }

  /**
   * Handle external link clicks
   */
  private handleExternalLink(e: Event, type: string): void {
    e.preventDefault();

    const urls = {
      help: "https://github.com/marvinbentley/puffpuffpaste/wiki",
      feedback: "https://github.com/marvinbentley/puffpuffpaste/issues",
      privacy:
        "https://github.com/marvinbentley/puffpuffpaste/blob/main/PRIVACY.md",
    };

    const url = urls[type as keyof typeof urls];
    if (url) {
      chrome.tabs.create({ url });
    }
  }

  /**
   * Handle anchor navigation for section links
   */
  private handleAnchorNavigation(): void {
    const hash = window.location.hash.substring(1);
    if (hash) {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  }
}
