/**
 * DOM Elements Map for Options Page
 * Centralizes all DOM element references with proper typing
 */

export interface OptionsElements {
  // General settings
  enabledCheckbox: HTMLInputElement;
  caseSensitiveCheckbox: HTMLInputElement;
  notificationsCheckbox: HTMLInputElement;
  triggerDelaySlider: HTMLInputElement;
  triggerDelayValue: HTMLElement;

  // Global toggle settings
  globalToggleEnabledCheckbox: HTMLInputElement;
  globalToggleShortcut: HTMLInputElement;
  editShortcutButton: HTMLButtonElement;
  globalToggleStatus: HTMLElement;
  shortcutHelp: HTMLElement;

  // Initial Setup
  initialSetupSection: HTMLElement;
  getStartedButton: HTMLButtonElement;

  // Cloud sync settings
  cloudProviderSelect: HTMLSelectElement;
  autoSyncCheckbox: HTMLInputElement;
  syncIntervalSlider: HTMLInputElement;
  syncIntervalValue: HTMLElement;

  // Scoped folder settings
  personalFolderIdInput: HTMLInputElement;
  selectPersonalFolderButton: HTMLButtonElement;
  departmentFolderIdInput: HTMLInputElement;
  selectDepartmentFolderButton: HTMLButtonElement;
  organizationFolderIdInput: HTMLInputElement;
  selectOrganizationFolderButton: HTMLButtonElement;

  // Cloud status
  cloudStatus: HTMLElement;
  statusIndicator: HTMLElement;
  statusTitle: HTMLElement;
  statusDetails: HTMLElement;
  lastSyncInfo: HTMLElement;
  syncErrorInfo: HTMLElement;
  connectButton: HTMLButtonElement;

  // Sync actions
  syncNowButton: HTMLButtonElement;
  forceUploadButton: HTMLButtonElement;
  forceDownloadButton: HTMLButtonElement;

  // Collaboration
  sharedSnippetsCheckbox: HTMLInputElement;

  // Data management
  totalSnippets: HTMLElement;
  storageUsed: HTMLElement;
  lastSync: HTMLElement;
  cleanupStorageButton: HTMLButtonElement;
  clearLocalButton: HTMLButtonElement;
  resetAllButton: HTMLButtonElement;

  // Synced Snippets
  syncedSnippetsList: HTMLElement;

  // Advanced
  debugCheckbox: HTMLInputElement;
  viewLogsButton: HTMLButtonElement;

  // Header actions
  exportButton: HTMLButtonElement;
  importButton: HTMLButtonElement;
  importFileInput: HTMLInputElement;

  // Status banner
  statusBanner: HTMLElement;
  statusText: HTMLElement;
  statusClose: HTMLButtonElement;

  // Footer
  versionNumber: HTMLElement;
  helpLink: HTMLElement;
  feedbackLink: HTMLElement;
  privacyLink: HTMLElement;

  // Folder Picker Modal
  folderPickerModal: HTMLElement;
  closeFolderPickerButton: HTMLButtonElement;
  folderPickerLoading: HTMLElement;
  folderPickerList: HTMLElement;
  folderPickerError: HTMLElement;
  folderBreadcrumb: HTMLElement;
  createFolderButton: HTMLButtonElement;
  cancelFolderPickerButton: HTMLButtonElement;
  confirmFolderPickerButton: HTMLButtonElement;
}

/**
 * Initialize all DOM elements with proper error handling
 * @returns Initialized DOM elements map
 * @throws Error if required elements are missing
 */
export function initializeDOMElements(): OptionsElements {
  const elements: OptionsElements = {
    // General settings
    enabledCheckbox: document.getElementById(
      "enabledCheckbox",
    ) as HTMLInputElement,
    caseSensitiveCheckbox: document.getElementById(
      "caseSensitiveCheckbox",
    ) as HTMLInputElement,
    notificationsCheckbox: document.getElementById(
      "notificationsCheckbox",
    ) as HTMLInputElement,
    triggerDelaySlider: document.getElementById(
      "triggerDelaySlider",
    ) as HTMLInputElement,
    triggerDelayValue: document.getElementById(
      "triggerDelayValue",
    ) as HTMLElement,

    // Global toggle settings
    globalToggleEnabledCheckbox: document.getElementById(
      "globalToggleEnabledCheckbox",
    ) as HTMLInputElement,
    globalToggleShortcut: document.getElementById(
      "globalToggleShortcut",
    ) as HTMLInputElement,
    editShortcutButton: document.getElementById(
      "editShortcutButton",
    ) as HTMLButtonElement,
    globalToggleStatus: document.getElementById(
      "globalToggleStatus",
    ) as HTMLElement,
    shortcutHelp: document.getElementById("shortcutHelp") as HTMLElement,

    // Initial Setup
    initialSetupSection: document.getElementById(
      "initial-setup-section",
    ) as HTMLElement,
    getStartedButton: document.getElementById(
      "getStartedButton",
    ) as HTMLButtonElement,

    // Cloud sync settings
    cloudProviderSelect: document.getElementById(
      "cloudProviderSelect",
    ) as HTMLSelectElement,
    autoSyncCheckbox: document.getElementById(
      "autoSyncCheckbox",
    ) as HTMLInputElement,
    syncIntervalSlider: document.getElementById(
      "syncIntervalSlider",
    ) as HTMLInputElement,
    syncIntervalValue: document.getElementById(
      "syncIntervalValue",
    ) as HTMLElement,

    // Scoped folder settings
    personalFolderIdInput: document.getElementById(
      "personalFolderIdInput",
    ) as HTMLInputElement,
    selectPersonalFolderButton: document.getElementById(
      "selectPersonalFolderButton",
    ) as HTMLButtonElement,
    departmentFolderIdInput: document.getElementById(
      "departmentFolderIdInput",
    ) as HTMLInputElement,
    selectDepartmentFolderButton: document.getElementById(
      "selectDepartmentFolderButton",
    ) as HTMLButtonElement,
    organizationFolderIdInput: document.getElementById(
      "organizationFolderIdInput",
    ) as HTMLInputElement,
    selectOrganizationFolderButton: document.getElementById(
      "selectOrganizationFolderButton",
    ) as HTMLButtonElement,

    // Cloud status
    cloudStatus: document.getElementById("cloudStatus") as HTMLElement,
    statusIndicator: document.getElementById("statusIndicator") as HTMLElement,
    statusTitle: document.getElementById("statusTitle") as HTMLElement,
    statusDetails: document.getElementById("statusDetails") as HTMLElement,
    lastSyncInfo: document.getElementById("lastSyncInfo") as HTMLElement,
    syncErrorInfo: document.getElementById("syncErrorInfo") as HTMLElement,
    connectButton: document.getElementById(
      "connectButton",
    ) as HTMLButtonElement,

    // Sync actions
    syncNowButton: document.getElementById(
      "syncNowButton",
    ) as HTMLButtonElement,
    forceUploadButton: document.getElementById(
      "forceUploadButton",
    ) as HTMLButtonElement,
    forceDownloadButton: document.getElementById(
      "forceDownloadButton",
    ) as HTMLButtonElement,

    // Collaboration
    sharedSnippetsCheckbox: document.getElementById(
      "sharedSnippetsCheckbox",
    ) as HTMLInputElement,

    // Data management
    totalSnippets: document.getElementById("totalSnippets") as HTMLElement,
    storageUsed: document.getElementById("storageUsed") as HTMLElement,
    lastSync: document.getElementById("lastSync") as HTMLElement,
    cleanupStorageButton: document.getElementById(
      "cleanupStorageButton",
    ) as HTMLButtonElement,
    clearLocalButton: document.getElementById(
      "clearLocalButton",
    ) as HTMLButtonElement,
    resetAllButton: document.getElementById(
      "resetAllButton",
    ) as HTMLButtonElement,

    // Synced Snippets
    syncedSnippetsList: document.getElementById(
      "syncedSnippetsList",
    ) as HTMLElement,

    // Advanced
    debugCheckbox: document.getElementById("debugCheckbox") as HTMLInputElement,
    viewLogsButton: document.getElementById(
      "viewLogsButton",
    ) as HTMLButtonElement,

    // Header actions
    exportButton: document.getElementById("exportButton") as HTMLButtonElement,
    importButton: document.getElementById("importButton") as HTMLButtonElement,
    importFileInput: document.getElementById(
      "importFileInput",
    ) as HTMLInputElement,

    // Status banner
    statusBanner: document.getElementById("statusBanner") as HTMLElement,
    statusText: document.querySelector(".status-text") as HTMLElement,
    statusClose: document.querySelector(".status-close") as HTMLButtonElement,

    // Footer
    versionNumber: document.getElementById("versionNumber") as HTMLElement,
    helpLink: document.getElementById("helpLink") as HTMLElement,
    feedbackLink: document.getElementById("feedbackLink") as HTMLElement,
    privacyLink: document.getElementById("privacyLink") as HTMLElement,

    // Folder Picker Modal
    folderPickerModal: document.getElementById(
      "folderPickerModal",
    ) as HTMLElement,
    closeFolderPickerButton: document.getElementById(
      "closeFolderPickerButton",
    ) as HTMLButtonElement,
    folderPickerLoading: document.getElementById(
      "folderPickerLoading",
    ) as HTMLElement,
    folderPickerList: document.getElementById(
      "folderPickerList",
    ) as HTMLElement,
    folderPickerError: document.getElementById(
      "folderPickerError",
    ) as HTMLElement,
    folderBreadcrumb: document.getElementById(
      "folderBreadcrumb",
    ) as HTMLElement,
    createFolderButton: document.getElementById(
      "createFolderButton",
    ) as HTMLButtonElement,
    cancelFolderPickerButton: document.getElementById(
      "cancelFolderPickerButton",
    ) as HTMLButtonElement,
    confirmFolderPickerButton: document.getElementById(
      "confirmFolderPickerButton",
    ) as HTMLButtonElement,
  };

  // Validate that all critical elements exist
  const missingElements: string[] = [];

  Object.entries(elements).forEach(([key, element]) => {
    if (!element) {
      missingElements.push(key);
    }
  });

  if (missingElements.length > 0) {
    throw new Error(`Missing DOM elements: ${missingElements.join(", ")}`);
  }

  return elements;
}

/**
 * Utility function to check if DOM is ready
 * @returns Promise that resolves when DOM is ready
 */
export function waitForDOMReady(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => resolve());
    } else {
      resolve();
    }
  });
}
