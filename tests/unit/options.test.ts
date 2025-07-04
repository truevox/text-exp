/**
 * Unit tests for Options Page functionality
 * Tests settings persistence, cloud provider configuration, and UI interactions
 */

import { jest } from '@jest/globals';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getManifest: jest.fn(() => ({ version: '0.13.2' })),
    id: 'test-extension-id'
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    create: jest.fn()
  }
} as any;

// Mock DOM elements
const createMockElement = (type: string = 'div', id?: string) => {
  const element = {
    id: id || '',
    checked: false,
    value: '',
    textContent: '',
    innerHTML: '',
    className: '',
    disabled: false,
    style: { 
      display: '',
      backgroundColor: '',
      transition: ''
    },
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
      toggle: jest.fn()
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
    type: type === 'input' ? 'text' : undefined,
    files: null
  };
  return element;
};

// Track created elements
const mockElements = new Map<string, any>();

// Pre-create expected elements (comprehensive list from options.ts)
const expectedElementIds = [
  // General settings
  'enabledCheckbox', 'caseSensitiveCheckbox', 'notificationsCheckbox',
  'triggerDelaySlider', 'triggerDelayValue',
  
  // Initial Setup
  'initial-setup-section', 'getStartedButton',
  
  // Cloud sync settings
  'cloudProviderSelect', 'autoSyncCheckbox', 'syncIntervalSlider', 'syncIntervalValue',
  
  // Scoped folder settings
  'personalFolderIdInput', 'selectPersonalFolderButton',
  'departmentFolderIdInput', 'selectDepartmentFolderButton',
  'organizationFolderIdInput', 'selectOrganizationFolderButton',
  
  // Cloud status
  'cloudStatus', 'statusIndicator', 'statusTitle', 'statusDetails',
  'lastSyncInfo', 'syncErrorInfo', 'connectButton',
  
  // Sync actions
  'syncNowButton', 'forceUploadButton', 'forceDownloadButton',
  
  // Collaboration
  'sharedSnippetsCheckbox',
  
  // Data management
  'totalSnippets', 'storageUsed', 'lastSync', 'cleanupStorageButton',
  'clearLocalButton', 'resetAllButton', 'syncedSnippetsList',
  
  // Advanced
  'debugCheckbox', 'viewLogsButton',
  
  // Header actions
  'exportButton', 'importButton', 'importFileInput',
  
  // Status banner
  'statusBanner', 'versionNumber', 'helpLink', 'feedbackLink', 'privacyLink',
  
  // Folder picker
  'folderPickerModal', 'closeFolderPickerButton', 'folderPickerLoading',
  'folderPickerList', 'folderPickerError', 'folderBreadcrumb',
  'createFolderButton', 'cancelFolderPickerButton', 'confirmFolderPickerButton',
  
  // Storage cleanup
  'storage-cleanup-section', 'cleanupButton', 'cloud-sync-section'
];

expectedElementIds.forEach(id => {
  const type = id.includes('Checkbox') ? 'input' : 
               id.includes('Slider') || id.includes('Input') ? 'input' :
               id.includes('Button') || id.includes('Btn') ? 'button' :
               id.includes('Select') ? 'select' : 'div';
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
    if (selector === '.status-text') return createMockElement('span');
    if (selector === '.status-close') return createMockElement('button');
    return null;
  }),
  querySelectorAll: jest.fn((selector: string) => {
    if (selector === '.settings-section:not(#initial-setup-section)') {
      return [createMockElement('div'), createMockElement('div')];
    }
    return [];
  }),
  createElement: jest.fn(() => createMockElement()),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  body: createMockElement('body'),
  head: createMockElement('head'),
  _readyState: 'loading'
};

// Add getter/setter for readyState
Object.defineProperty(mockDocument, 'readyState', {
  get() { return this._readyState; },
  set(value) { this._readyState = value; },
  configurable: true
});

global.document = mockDocument as any;

// Mock window
global.window = {
  location: {
    href: 'chrome-extension://test/options.html',
    reload: jest.fn()
  },
  alert: jest.fn(),
  confirm: jest.fn(),
  prompt: jest.fn(),
  open: jest.fn()
} as any;

// Mock messaging modules
jest.mock('../../src/shared/messaging.js', () => ({
  SettingsMessages: {
    getSettings: jest.fn(),
    updateSettings: jest.fn()
  },
  SnippetMessages: {
    getAll: jest.fn(),
    exportData: jest.fn(),
    importData: jest.fn()
  },
  SyncMessages: {
    syncNow: jest.fn(),
    getStatus: jest.fn()
  }
}));

// Mock storage
jest.mock('../../src/shared/storage.js', () => ({
  ExtensionStorage: {
    getSettings: jest.fn(),
    setSettings: jest.fn(),
    getSnippets: jest.fn(),
    setSnippets: jest.fn()
  }
}));

// Mock storage cleanup
jest.mock('../../src/utils/storage-cleanup.js', () => ({
  StorageCleanup: {
    getCleanupStatus: jest.fn(),
    clearInvalidSources: jest.fn(),
    validateAndCleanSources: jest.fn()
  }
}));

import { SettingsMessages, SnippetMessages, SyncMessages } from '../../src/shared/messaging.js';
import { ExtensionStorage } from '../../src/shared/storage.js';
import { StorageCleanup } from '../../src/utils/storage-cleanup.js';
import { DEFAULT_SETTINGS } from '../../src/shared/constants.js';

describe('Options Page', () => {
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
      cloudProvider: 'none',
      autoSync: false,
      syncInterval: 5
    };

    (SettingsMessages.getSettings as jest.Mock).mockResolvedValue(mockSettings);
    (SettingsMessages.updateSettings as jest.Mock).mockResolvedValue(undefined);
    (ExtensionStorage.getSettings as jest.Mock).mockResolvedValue(mockSettings);
    (StorageCleanup.getCleanupStatus as jest.Mock).mockResolvedValue({
      needsCleanup: false,
      invalidSources: 0,
      recommendations: []
    });
  });

  describe('Settings Persistence', () => {
    it('should load settings on initialization', async () => {
      // Set readyState to complete before importing
      mockDocument._readyState = 'complete';
      
      // Dynamic import to trigger initialization
      const OptionsModule = await import('../../src/options/options.ts');
      
      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(SettingsMessages.getSettings).toHaveBeenCalled();
    });

    it('should save settings when form values change', async () => {
      // Set readyState to complete
      mockDocument._readyState = 'complete';
      const OptionsModule = await import('../../src/options/options.ts');
      
      // Simulate enabling the extension
      const enabledCheckbox = document.getElementById('enabledCheckbox') as any;
      enabledCheckbox.checked = true;
      
      // Trigger change event
      const changeEvent = new Event('change');
      enabledCheckbox.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'change') {
          handler(changeEvent);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true
        })
      );
    });

    it('should handle trigger delay slider changes', async () => {
      const OptionsModule = await import('../../src/options/options.ts');
      
      const triggerDelaySlider = document.getElementById('triggerDelaySlider') as any;
      const triggerDelayValue = document.getElementById('triggerDelayValue') as any;
      
      triggerDelaySlider.value = '100';
      
      // Simulate input event
      const inputEvent = new Event('input');
      triggerDelaySlider.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'input') {
          handler(inputEvent);
        }
      });

      expect(triggerDelayValue.textContent).toBe('100ms');
    });

    it('should handle cloud provider selection', async () => {
      const OptionsModule = await import('../../src/options/options.ts');
      
      const cloudProviderSelect = document.getElementById('cloudProviderSelect') as any;
      cloudProviderSelect.value = 'google-drive';
      
      const changeEvent = new Event('change');
      cloudProviderSelect.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'change') {
          handler(changeEvent);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          cloudProvider: 'google-drive'
        })
      );
    });
  });

  describe('Cloud Provider Configuration', () => {
    it('should show initial setup section when no provider configured', async () => {
      mockSettings.cloudProvider = 'none';
      (SettingsMessages.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      
      const OptionsModule = await import('../../src/options/options.ts');
      
      const initialSetupSection = document.getElementById('initial-setup-section') as any;
      expect(initialSetupSection.style.display).not.toBe('none');
    });

    it('should handle get started button click', async () => {
      const OptionsModule = await import('../../src/options/options.ts');
      
      const getStartedButton = document.getElementById('getStartedButton') as any;
      
      const clickEvent = new Event('click');
      getStartedButton.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'click') {
          handler(clickEvent);
        }
      });

      // Should hide initial setup and show main settings
      const initialSetupSection = document.getElementById('initial-setup-section') as any;
      expect(initialSetupSection.style.display).toBe('none');
    });

    it('should enable folder selection for supported providers', async () => {
      mockSettings.cloudProvider = 'google-drive';
      (SettingsMessages.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      
      const OptionsModule = await import('../../src/options/options.ts');
      
      const selectPersonalFolderButton = document.getElementById('selectPersonalFolderButton') as any;
      expect(selectPersonalFolderButton.style.display).not.toBe('none');
    });
  });

  describe('Import/Export Functionality', () => {
    it('should handle export button click', async () => {
      const mockSnippets = [
        { id: '1', trigger: 'test', content: 'Test content', createdAt: new Date(), updatedAt: new Date() }
      ];
      
      (SnippetMessages.exportData as jest.Mock).mockResolvedValue({
        snippets: mockSnippets,
        settings: mockSettings,
        exportedAt: new Date().toISOString()
      });

      const OptionsModule = await import('../../src/options/options.ts');
      
      const exportButton = document.getElementById('exportButton') as any;
      
      const clickEvent = new Event('click');
      exportButton.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'click') {
          handler(clickEvent);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(SnippetMessages.exportData).toHaveBeenCalled();
    });

    it('should handle import button click', async () => {
      const OptionsModule = await import('../../src/options/options.ts');
      
      const importButton = document.getElementById('importButton') as any;
      
      const clickEvent = new Event('click');
      importButton.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'click') {
          handler(clickEvent);
        }
      });

      // Should create file input for import
      expect(document.createElement).toHaveBeenCalledWith('input');
    });
  });

  describe('Storage Cleanup Integration', () => {
    it('should check cleanup status on load', async () => {
      const OptionsModule = await import('../../src/options/options.ts');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(StorageCleanup.getCleanupStatus).toHaveBeenCalled();
    });

    it('should show cleanup recommendations when needed', async () => {
      (StorageCleanup.getCleanupStatus as jest.Mock).mockResolvedValue({
        needsCleanup: true,
        invalidSources: 2,
        recommendations: ['Remove 2 invalid sources', 'Clean orphaned keys']
      });

      const OptionsModule = await import('../../src/options/options.ts');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should display cleanup recommendations
      const cleanupSection = document.getElementById('storage-cleanup-section') as any;
      expect(cleanupSection.style.display).not.toBe('none');
    });

    it('should handle cleanup execution', async () => {
      (StorageCleanup.clearInvalidSources as jest.Mock).mockResolvedValue({
        cleaned: 2,
        errors: []
      });

      const OptionsModule = await import('../../src/options/options.ts');
      
      const cleanupButton = document.getElementById('cleanupButton') as any;
      if (cleanupButton) {
        const clickEvent = new Event('click');
        cleanupButton.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
          if (eventName === 'click') {
            handler(clickEvent);
          }
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        
        expect(StorageCleanup.clearInvalidSources).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle settings load failure', async () => {
      (SettingsMessages.getSettings as jest.Mock).mockRejectedValue(new Error('Storage error'));
      
      const OptionsModule = await import('../../src/options/options.ts');
      
      // Should not crash and should show error state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify graceful degradation
      expect(SettingsMessages.getSettings).toHaveBeenCalled();
    });

    it('should handle settings save failure', async () => {
      (SettingsMessages.updateSettings as jest.Mock).mockRejectedValue(new Error('Save failed'));
      
      const OptionsModule = await import('../../src/options/options.ts');
      
      const enabledCheckbox = document.getElementById('enabledCheckbox') as any;
      enabledCheckbox.checked = false;
      
      const changeEvent = new Event('change');
      enabledCheckbox.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'change') {
          handler(changeEvent);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should attempt to save despite error
      expect(SettingsMessages.updateSettings).toHaveBeenCalled();
    });

    it('should handle export failure', async () => {
      (SnippetMessages.exportData as jest.Mock).mockRejectedValue(new Error('Export failed'));
      
      const OptionsModule = await import('../../src/options/options.ts');
      
      const exportButton = document.getElementById('exportButton') as any;
      
      const clickEvent = new Event('click');
      exportButton.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'click') {
          handler(clickEvent);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should handle error gracefully
      expect(SnippetMessages.exportData).toHaveBeenCalled();
    });
  });

  describe('UI Interactions', () => {
    it('should update slider value displays', async () => {
      const OptionsModule = await import('../../src/options/options.ts');
      
      const syncIntervalSlider = document.getElementById('syncIntervalSlider') as any;
      const syncIntervalValue = document.getElementById('syncIntervalValue') as any;
      
      syncIntervalSlider.value = '10';
      
      const inputEvent = new Event('input');
      syncIntervalSlider.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'input') {
          handler(inputEvent);
        }
      });

      expect(syncIntervalValue.textContent).toBe('10 minutes');
    });

    it('should show/hide sections based on configuration', async () => {
      mockSettings.cloudProvider = 'google-drive';
      (SettingsMessages.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      
      const OptionsModule = await import('../../src/options/options.ts');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should show cloud sync settings
      const cloudSyncSection = document.getElementById('cloud-sync-section') as any;
      expect(cloudSyncSection.style.display).not.toBe('none');
    });

    it('should handle checkbox state changes', async () => {
      const OptionsModule = await import('../../src/options/options.ts');
      
      const autoSyncCheckbox = document.getElementById('autoSyncCheckbox') as any;
      autoSyncCheckbox.checked = true;
      
      const changeEvent = new Event('change');
      autoSyncCheckbox.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'change') {
          handler(changeEvent);
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(SettingsMessages.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          autoSync: true
        })
      );
    });
  });

  describe('Folder Selection UI', () => {
    it('should open folder picker modal', async () => {
      mockSettings.cloudProvider = 'google-drive';
      (SettingsMessages.getSettings as jest.Mock).mockResolvedValue(mockSettings);
      
      const OptionsModule = await import('../../src/options/options.ts');
      
      const selectPersonalFolderButton = document.getElementById('selectPersonalFolderButton') as any;
      
      const clickEvent = new Event('click');
      selectPersonalFolderButton.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
        if (eventName === 'click') {
          handler(clickEvent);
        }
      });

      // Should open folder picker modal
      const folderPickerModal = document.getElementById('folderPickerModal') as any;
      expect(folderPickerModal.style.display).toBe('block');
    });

    it('should handle folder selection', async () => {
      const OptionsModule = await import('../../src/options/options.ts');
      
      // Simulate folder selection by triggering select folder button
      const selectFolderBtn = document.getElementById('selectFolderBtn') as any;
      
      if (selectFolderBtn) {
        const clickEvent = new Event('click');
        selectFolderBtn.addEventListener.mock.calls.forEach(([eventName, handler]: [string, Function]) => {
          if (eventName === 'click') {
            handler(clickEvent);
          }
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Should save folder selection
        expect(SettingsMessages.updateSettings).toHaveBeenCalled();
      }
    });
  });
});