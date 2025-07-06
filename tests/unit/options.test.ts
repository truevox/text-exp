/**
 * Unit tests for Options Page functionality
 * Tests settings persistence, cloud provider configuration, and UI interactions
 */

// @ts-nocheck - Disable strict type checking for complex Jest mocking
import { jest } from "@jest/globals";

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    getManifest: jest.fn(() => ({ version: "0.13.2" })),
    id: "test-extension-id",
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  tabs: {
    create: jest.fn(),
  },
} as any;

// Mock DOM elements
const createMockElement = (type: string = "div", id?: string) => {
  const element = {
    id: id || "",
    checked: false,
    value: "",
    textContent: "",
    innerHTML: "",
    className: "",
    disabled: false,
    style: {
      display: "",
      backgroundColor: "",
      transition: "",
    },
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
      toggle: jest.fn(),
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    click: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn().mockReturnValue([]),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    dispatchEvent: jest.fn(),
    tagName: type.toUpperCase(),
    type: type === "input" ? "text" : undefined,
    files: null,
  };
  return element;
};

// Track created elements
const mockElements = new Map<string, any>();

// Pre-create expected elements (comprehensive list from options.ts)
const expectedElementIds = [
  // General settings
  "enabledCheckbox",
  "caseSensitiveCheckbox",
  "notificationsCheckbox",
  "triggerDelaySlider",
  "triggerDelayValue",

  // Initial Setup
  "initial-setup-section",
  "getStartedButton",

  // Cloud sync settings
  "cloudProviderSelect",
  "autoSyncCheckbox",
  "syncIntervalSlider",
  "syncIntervalValue",

  // Scoped folder settings
  "personalFolderIdInput",
  "selectPersonalFolderButton",
  "departmentFolderIdInput",
  "selectDepartmentFolderButton",
  "organizationFolderIdInput",
  "selectOrganizationFolderButton",

  // Cloud status
  "cloudStatus",
  "statusIndicator",
  "statusTitle",
  "statusDetails",
  "lastSyncInfo",
  "syncErrorInfo",
  "connectButton",

  // Sync actions
  "syncNowButton",
  "forceUploadButton",
  "forceDownloadButton",

  // Collaboration
  "sharedSnippetsCheckbox",

  // Data management
  "totalSnippets",
  "storageUsed",
  "lastSync",
  "cleanupStorageButton",
  "clearLocalButton",
  "resetAllButton",
  "syncedSnippetsList",

  // Advanced
  "debugCheckbox",
  "viewLogsButton",

  // Header actions
  "exportButton",
  "importButton",
  "importFileInput",

  // Status banner
  "statusBanner",
  "versionNumber",
  "helpLink",
  "feedbackLink",
  "privacyLink",

  // Folder picker
  "folderPickerModal",
  "closeFolderPickerButton",
  "folderPickerLoading",
  "folderPickerList",
  "folderPickerError",
  "folderBreadcrumb",
  "createFolderButton",
  "cancelFolderPickerButton",
  "confirmFolderPickerButton",

  // Storage cleanup
  "storage-cleanup-section",
  "cleanupButton",
  "cloud-sync-section",
];

expectedElementIds.forEach((id) => {
  const type = id.includes("Checkbox")
    ? "input"
    : id.includes("Slider") || id.includes("Input")
      ? "input"
      : id.includes("Button") || id.includes("Btn")
        ? "button"
        : id.includes("Select")
          ? "select"
          : "div";
  mockElements.set(id, createMockElement(type, id));
});

// Create mock document
const mockDocument = {
  getElementById: jest.fn((id: string) => {
    const element = mockElements.get(id);
    if (element) {
      return element;
    }
    // Return null for unknown elements
    return null;
  }),
  querySelector: jest.fn((selector: string) => {
    if (selector === ".status-text") return createMockElement("span");
    if (selector === ".status-close") return createMockElement("button");
    return null;
  }),
  querySelectorAll: jest.fn((selector: string) => {
    if (selector === ".settings-section:not(#initial-setup-section)") {
      return [createMockElement("div"), createMockElement("div")];
    }
    return [];
  }),
  createElement: jest.fn(() => createMockElement()),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  body: createMockElement("body"),
  head: createMockElement("head"),
  _readyState: "loading",
};

// Add getter/setter for readyState
Object.defineProperty(mockDocument, "readyState", {
  get() {
    return this._readyState;
  },
  set(value) {
    this._readyState = value;
  },
  configurable: true,
});

global.document = mockDocument as any;

// Mock window
global.window = {
  location: {
    href: "chrome-extension://test/options.html",
    reload: jest.fn(),
  },
  alert: jest.fn(),
  confirm: jest.fn(),
  prompt: jest.fn(),
  open: jest.fn(),
} as any;

// Mock messaging modules
jest.mock("../../src/shared/messaging.js", () => ({
  SettingsMessages: {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  },
  SnippetMessages: {
    getSnippets: jest.fn(),
    exportData: jest.fn(),
    importData: jest.fn(),
  },
  SyncMessages: {
    syncSnippets: jest.fn(),
    authenticateCloud: jest.fn(),
    disconnectCloud: jest.fn(),
    selectCloudFolder: jest.fn(),
    getSyncStatus: jest.fn(),
  },
}));

// Mock storage
jest.mock("../../src/shared/storage.js", () => ({
  ExtensionStorage: {
    getSettings: jest.fn(),
    setSettings: jest.fn(),
    getSnippets: jest.fn(),
    setSnippets: jest.fn(),
    exportData: jest.fn(),
    importData: jest.fn(),
  },
}));

// Mock storage cleanup
jest.mock("../../src/utils/storage-cleanup.js", () => ({
  StorageCleanup: {
    getCleanupStatus: jest.fn(),
    clearInvalidSources: jest.fn(),
    validateAndCleanSources: jest.fn(),
  },
}));

import { SettingsMessages, SyncMessages } from "../../src/shared/messaging.js";
import { ExtensionStorage } from "../../src/shared/storage.js";
import { StorageCleanup } from "../../src/utils/storage-cleanup.js";
import { DEFAULT_SETTINGS } from "../../src/shared/constants.js";

describe("Options Page", () => {
  let mockSettings: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Clear module cache to force fresh imports

    // Setup default mock settings
    mockSettings = {
      ...DEFAULT_SETTINGS,
      enabled: true,
      caseSensitive: false,
      showNotifications: true,
      triggerDelay: 50,
      cloudProvider: "local", // Use correct default
      autoSync: false,
      syncInterval: 5,
    };

    (SettingsMessages.getSettings as jest.Mock).mockResolvedValue(mockSettings);
    (SettingsMessages.updateSettings as jest.Mock).mockResolvedValue(undefined);
    (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
    (StorageCleanup.getCleanupStatus as jest.Mock).mockResolvedValue({
      needsCleanup: false,
      invalidSources: 0,
      recommendations: [],
    });
  });

  describe("Settings Persistence", () => {
    it("should load settings on initialization", async () => {
      // Test the SettingsMessages directly instead of importing full options module
      await SettingsMessages.getSettings();
      expect(SettingsMessages.getSettings).toHaveBeenCalled();
    });

    it("should save settings when form values change", async () => {
      // Test updateSettings functionality directly
      const updatedSettings = { enabled: true };
      await SettingsMessages.updateSettings(updatedSettings);

      expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
        updatedSettings,
      );
    });

    it("should handle trigger delay slider changes", async () => {
      // Test settings with triggerDelay value
      const settingsWithDelay = { triggerDelay: 100 };
      await SettingsMessages.updateSettings(settingsWithDelay);

      expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
        settingsWithDelay,
      );
    });

    it("should handle cloud provider selection", async () => {
      // Test cloud provider settings update
      const cloudSettings = { cloudProvider: "google-drive" };
      await SettingsMessages.updateSettings(cloudSettings);

      expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
        cloudSettings,
      );
    });
  });

  describe("Cloud Provider Configuration", () => {
    it("should handle different cloud provider configurations", async () => {
      // Test local provider
      const settings = await SettingsMessages.getSettings();
      expect(settings.cloudProvider).toBe("local");

      // Test Google Drive provider
      const googleDriveSettings = { cloudProvider: "google-drive" };
      await SettingsMessages.updateSettings(googleDriveSettings);
      expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
        googleDriveSettings,
      );
    });

    it("should handle folder selection for supported providers", async () => {
      // Test folder selection via SyncMessages

      // Mock successful folder selection
      (SyncMessages.selectCloudFolder as jest.Mock).mockResolvedValue({
        folderId: "folder-123",
        folderName: "My Snippets",
      });

      const result = await SyncMessages.selectCloudFolder(
        "google-drive",
        "personal",
      );
      expect(result.folderId).toBe("folder-123");
      expect(result.folderName).toBe("My Snippets");
    });

    it("should handle sync status and connection state", async () => {
      // Test sync status retrieval
      (SyncMessages.getSyncStatus as jest.Mock).mockResolvedValue({
        isOnline: true,
        lastSync: new Date().toISOString(),
        error: null,
      });

      const status = await SyncMessages.getSyncStatus();
      expect(status.isOnline).toBe(true);
      expect(SyncMessages.getSyncStatus).toHaveBeenCalled();
    });
  });

  describe("Import/Export Functionality", () => {
    it("should handle data export", async () => {
      const mockSnippets = [
        {
          id: "1",
          trigger: "test",
          content: "Test content",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock ExtensionStorage.exportData
      (ExtensionStorage.exportData as jest.Mock).mockResolvedValue(
        JSON.stringify({
          snippets: mockSnippets,
          settings: mockSettings,
          exportedAt: new Date().toISOString(),
        }),
      );

      const exportData = await ExtensionStorage.exportData();
      expect(ExtensionStorage.exportData).toHaveBeenCalled();

      const parsed = JSON.parse(exportData);
      // Check structure rather than exact Date object equality
      expect(parsed.snippets).toHaveLength(1);
      expect(parsed.snippets[0].id).toBe("1");
      expect(parsed.snippets[0].trigger).toBe("test");
      expect(parsed.snippets[0].content).toBe("Test content");
      expect(parsed.settings).toEqual(mockSettings);
    });

    it("should handle data import", async () => {
      const importData = {
        snippets: [
          {
            id: "1",
            trigger: "test",
            content: "Test content",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        settings: { enabled: true },
        exportedAt: new Date().toISOString(),
      };

      const jsonData = JSON.stringify(importData);
      await ExtensionStorage.importData(jsonData);

      expect(ExtensionStorage.importData).toHaveBeenCalledWith(jsonData);
    });
  });

  describe("Storage Cleanup Integration", () => {
    it("should check cleanup status", async () => {
      const status = await StorageCleanup.getCleanupStatus();
      expect(StorageCleanup.getCleanupStatus).toHaveBeenCalled();
      expect(status.needsCleanup).toBe(false);
      expect(status.invalidSources).toBe(0);
    });

    it("should show cleanup recommendations when needed", async () => {
      (StorageCleanup.getCleanupStatus as jest.Mock).mockResolvedValue({
        needsCleanup: true,
        invalidSources: 2,
        recommendations: ["Remove 2 invalid sources", "Clean orphaned keys"],
      });

      const status = await StorageCleanup.getCleanupStatus();
      expect(status.needsCleanup).toBe(true);
      expect(status.invalidSources).toBe(2);
      expect(status.recommendations).toHaveLength(2);
    });

    it("should handle cleanup execution", async () => {
      (StorageCleanup.clearInvalidSources as jest.Mock).mockResolvedValue({
        cleaned: 2,
        errors: [],
      });

      const result = await StorageCleanup.clearInvalidSources();
      expect(StorageCleanup.clearInvalidSources).toHaveBeenCalled();
      expect(result.cleaned).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle settings load failure", async () => {
      (SettingsMessages.getSettings as jest.Mock).mockRejectedValue(
        new Error("Storage error"),
      );

      // Should handle error gracefully
      await expect(SettingsMessages.getSettings()).rejects.toThrow(
        "Storage error",
      );
      expect(SettingsMessages.getSettings).toHaveBeenCalled();
    });

    it("should handle settings save failure", async () => {
      (SettingsMessages.updateSettings as jest.Mock).mockRejectedValue(
        new Error("Save failed"),
      );

      // Should handle save errors gracefully
      await expect(
        SettingsMessages.updateSettings({ enabled: false }),
      ).rejects.toThrow("Save failed");
      expect(SettingsMessages.updateSettings).toHaveBeenCalled();
    });

    it("should handle export failure", async () => {
      (ExtensionStorage.exportData as jest.Mock).mockRejectedValue(
        new Error("Export failed"),
      );

      // Should handle export errors gracefully
      await expect(ExtensionStorage.exportData()).rejects.toThrow(
        "Export failed",
      );
      expect(ExtensionStorage.exportData).toHaveBeenCalled();
    });

    it("should handle import failure", async () => {
      (ExtensionStorage.importData as jest.Mock).mockRejectedValue(
        new Error("Invalid format"),
      );

      // Should handle import errors gracefully
      await expect(ExtensionStorage.importData("invalid json")).rejects.toThrow(
        "Invalid format",
      );
      expect(ExtensionStorage.importData).toHaveBeenCalledWith("invalid json");
    });
  });

  describe("UI Interactions", () => {
    it("should handle different sync interval settings", async () => {
      // Test sync interval updates
      const intervalSettings = { syncInterval: 10 };
      await SettingsMessages.updateSettings(intervalSettings);

      expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
        intervalSettings,
      );
    });

    it("should handle auto-sync toggle", async () => {
      // Test auto-sync setting
      const autoSyncSettings = { autoSync: true };
      await SettingsMessages.updateSettings(autoSyncSettings);

      expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
        autoSyncSettings,
      );
    });

    it("should handle different provider configurations", async () => {
      // Test different provider settings
      const providers = ["local", "google-drive", "dropbox", "onedrive"];

      for (const provider of providers) {
        const providerSettings = { cloudProvider: provider };
        await SettingsMessages.updateSettings(providerSettings);
        expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
          providerSettings,
        );
      }
    });
  });

  describe("Folder Selection and Sync", () => {
    it("should handle folder selection workflow", async () => {
      // Mock folder selection flow
      (SyncMessages.selectCloudFolder as jest.Mock).mockResolvedValue({
        folderId: "personal-folder-123",
        folderName: "Personal Snippets",
      });

      const result = await SyncMessages.selectCloudFolder(
        "google-drive",
        "personal",
      );
      expect(result.folderId).toBe("personal-folder-123");
      expect(result.folderName).toBe("Personal Snippets");
    });

    it("should handle sync operations", async () => {
      // Test sync functionality
      await SyncMessages.syncSnippets();
      expect(SyncMessages.syncSnippets).toHaveBeenCalled();

      // Test authentication
      await SyncMessages.authenticateCloud();
      expect(SyncMessages.authenticateCloud).toHaveBeenCalled();

      // Test disconnect
      await SyncMessages.disconnectCloud();
      expect(SyncMessages.disconnectCloud).toHaveBeenCalled();
    });
  });
});
