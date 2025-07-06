/**
 * Settings Service for Options Page
 * Handles all settings-related operations including load, save, reset, and validation
 */

import { SettingsMessages } from "../../shared/messaging.js";
import type {
  ExtensionSettings,
  ConfiguredScopedSource,
} from "../../shared/types.js";
import { DEFAULT_SETTINGS } from "../../shared/constants.js";
import type { OptionsElements } from "../utils/dom-elements.js";

export class SettingsService {
  private settings: ExtensionSettings = DEFAULT_SETTINGS;
  private elements: OptionsElements;

  constructor(elements: OptionsElements) {
    this.elements = elements;
  }

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<ExtensionSettings> {
    try {
      this.settings = await SettingsMessages.getSettings();
      return this.settings;
    } catch (error) {
      console.error("Failed to load settings:", error);
      this.settings = DEFAULT_SETTINGS;
      return this.settings;
    }
  }

  /**
   * Save current settings from UI to storage
   */
  async saveSettings(): Promise<void> {
    try {
      const newSettings: Partial<ExtensionSettings> = {
        enabled: this.elements.enabledCheckbox.checked,
        caseSensitive: this.elements.caseSensitiveCheckbox.checked,
        showNotifications: this.elements.notificationsCheckbox.checked,
        triggerDelay: parseInt(this.elements.triggerDelaySlider.value),
        globalToggleEnabled: this.elements.globalToggleEnabledCheckbox.checked,
        globalToggleShortcut: this.elements.globalToggleShortcut.value,
        cloudProvider: this.elements.cloudProviderSelect.value as any,
        autoSync: this.elements.autoSyncCheckbox.checked,
        syncInterval: parseInt(this.elements.syncIntervalSlider.value),
        enableSharedSnippets: this.elements.sharedSnippetsCheckbox.checked,
      };

      await SettingsMessages.updateSettings(newSettings);
      this.settings = { ...this.settings, ...newSettings };
    } catch (error) {
      console.error("Failed to save settings:", error);
      throw new Error("Failed to save settings");
    }
  }

  /**
   * Update UI elements with current settings values
   */
  updateUI(): void {
    // General settings
    if (this.elements.enabledCheckbox)
      this.elements.enabledCheckbox.checked = this.settings.enabled;
    if (this.elements.caseSensitiveCheckbox)
      this.elements.caseSensitiveCheckbox.checked = this.settings.caseSensitive;
    if (this.elements.notificationsCheckbox)
      this.elements.notificationsCheckbox.checked =
        this.settings.showNotifications;
    if (this.elements.triggerDelaySlider)
      this.elements.triggerDelaySlider.value =
        this.settings.triggerDelay.toString();
    this.updateTriggerDelayValue();

    // Global toggle settings
    if (this.elements.globalToggleEnabledCheckbox)
      this.elements.globalToggleEnabledCheckbox.checked =
        this.settings.globalToggleEnabled;
    if (this.elements.globalToggleShortcut)
      this.elements.globalToggleShortcut.value =
        this.settings.globalToggleShortcut;
    this.updateGlobalToggleStatus();

    // Cloud settings
    if (this.elements.cloudProviderSelect)
      this.elements.cloudProviderSelect.value = this.settings.cloudProvider;
    if (this.elements.autoSyncCheckbox)
      this.elements.autoSyncCheckbox.checked = this.settings.autoSync;
    if (this.elements.syncIntervalSlider)
      this.elements.syncIntervalSlider.value =
        this.settings.syncInterval.toString();
    this.updateSyncIntervalValue();

    // Collaboration
    if (this.elements.sharedSnippetsCheckbox)
      this.elements.sharedSnippetsCheckbox.checked =
        this.settings.enableSharedSnippets;

    // Scoped folder settings - populate from configured sources
    this.updateScopedFolderInputs();
  }

  /**
   * Update scoped folder input displays
   */
  private updateScopedFolderInputs(): void {
    if (this.settings.configuredSources) {
      const personalSource = this.settings.configuredSources.find(
        (s) => s.scope === "personal",
      );
      if (this.elements.personalFolderIdInput && personalSource) {
        this.elements.personalFolderIdInput.value = personalSource.displayName;
      }

      const departmentSource = this.settings.configuredSources.find(
        (s) => s.scope === "department",
      );
      if (this.elements.departmentFolderIdInput && departmentSource) {
        this.elements.departmentFolderIdInput.value =
          departmentSource.displayName;
      }

      const organizationSource = this.settings.configuredSources.find(
        (s) => s.scope === "org",
      );
      if (this.elements.organizationFolderIdInput && organizationSource) {
        this.elements.organizationFolderIdInput.value =
          organizationSource.displayName;
      }
    }
  }

  /**
   * Reset all settings to defaults
   */
  async resetSettings(): Promise<void> {
    try {
      await SettingsMessages.updateSettings(DEFAULT_SETTINGS);
      this.settings = DEFAULT_SETTINGS;
    } catch (error) {
      console.error("Failed to reset settings:", error);
      throw new Error("Failed to reset settings");
    }
  }

  /**
   * Handle provider change and save settings
   */
  async handleProviderChange(): Promise<void> {
    await this.saveSettings();
  }

  /**
   * Update configured scoped source
   */
  async updateConfiguredSource(
    scope: "personal" | "department" | "org",
    source: ConfiguredScopedSource,
  ): Promise<void> {
    try {
      const currentSources = this.settings.configuredSources || [];
      const updatedSources = currentSources.filter((s) => s.scope !== scope);
      updatedSources.push(source);

      const newSettings: Partial<ExtensionSettings> = {
        configuredSources: updatedSources,
      };

      await SettingsMessages.updateSettings(newSettings);
      this.settings = { ...this.settings, ...newSettings };
    } catch (error) {
      console.error("Failed to update configured source:", error);
      throw new Error("Failed to update configured source");
    }
  }

  /**
   * Get current settings
   */
  getSettings(): ExtensionSettings {
    return this.settings;
  }

  /**
   * Update trigger delay display value
   */
  private updateTriggerDelayValue(): void {
    const value = parseInt(this.elements.triggerDelaySlider.value);
    this.elements.triggerDelayValue.textContent = `${value}ms`;
  }

  /**
   * Update sync interval display value
   */
  private updateSyncIntervalValue(): void {
    const value = parseInt(this.elements.syncIntervalSlider.value);
    this.elements.syncIntervalValue.textContent = `${value} minutes`;
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
   * Validate settings values
   */
  validateSettings(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate trigger delay
    const triggerDelay = parseInt(this.elements.triggerDelaySlider.value);
    if (isNaN(triggerDelay) || triggerDelay < 0 || triggerDelay > 5000) {
      errors.push("Trigger delay must be between 0 and 5000ms");
    }

    // Validate sync interval
    const syncInterval = parseInt(this.elements.syncIntervalSlider.value);
    if (isNaN(syncInterval) || syncInterval < 1 || syncInterval > 1440) {
      errors.push("Sync interval must be between 1 and 1440 minutes");
    }

    // Validate global toggle shortcut
    const shortcut = this.elements.globalToggleShortcut.value;
    if (shortcut && !/^(Ctrl|Alt|Shift|Meta)\+.+/.test(shortcut)) {
      errors.push(
        "Global toggle shortcut must include a modifier key (Ctrl, Alt, Shift, or Meta)",
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get export data for settings
   */
  getExportData(): Partial<ExtensionSettings> {
    // Export all settings except sensitive data
    const { ...exportableSettings } = this.settings;
    return exportableSettings;
  }

  /**
   * Import settings from data
   */
  async importSettings(
    importedSettings: Partial<ExtensionSettings>,
  ): Promise<void> {
    try {
      // Validate imported settings against schema
      const validatedSettings = this.validateImportedSettings(importedSettings);

      await SettingsMessages.updateSettings(validatedSettings);
      this.settings = { ...this.settings, ...validatedSettings };
    } catch (error) {
      console.error("Failed to import settings:", error);
      throw new Error("Failed to import settings");
    }
  }

  /**
   * Validate imported settings
   */
  private validateImportedSettings(
    importedSettings: Partial<ExtensionSettings>,
  ): Partial<ExtensionSettings> {
    const validatedSettings: Partial<ExtensionSettings> = {};

    // Validate and copy only known settings properties
    if (typeof importedSettings.enabled === "boolean") {
      validatedSettings.enabled = importedSettings.enabled;
    }
    if (typeof importedSettings.caseSensitive === "boolean") {
      validatedSettings.caseSensitive = importedSettings.caseSensitive;
    }
    if (typeof importedSettings.showNotifications === "boolean") {
      validatedSettings.showNotifications = importedSettings.showNotifications;
    }
    if (
      typeof importedSettings.triggerDelay === "number" &&
      importedSettings.triggerDelay >= 0 &&
      importedSettings.triggerDelay <= 5000
    ) {
      validatedSettings.triggerDelay = importedSettings.triggerDelay;
    }
    if (typeof importedSettings.globalToggleEnabled === "boolean") {
      validatedSettings.globalToggleEnabled =
        importedSettings.globalToggleEnabled;
    }
    if (typeof importedSettings.globalToggleShortcut === "string") {
      validatedSettings.globalToggleShortcut =
        importedSettings.globalToggleShortcut;
    }
    if (typeof importedSettings.cloudProvider === "string") {
      validatedSettings.cloudProvider = importedSettings.cloudProvider as any;
    }
    if (typeof importedSettings.autoSync === "boolean") {
      validatedSettings.autoSync = importedSettings.autoSync;
    }
    if (
      typeof importedSettings.syncInterval === "number" &&
      importedSettings.syncInterval >= 1 &&
      importedSettings.syncInterval <= 1440
    ) {
      validatedSettings.syncInterval = importedSettings.syncInterval;
    }
    if (typeof importedSettings.enableSharedSnippets === "boolean") {
      validatedSettings.enableSharedSnippets =
        importedSettings.enableSharedSnippets;
    }
    if (Array.isArray(importedSettings.configuredSources)) {
      validatedSettings.configuredSources = importedSettings.configuredSources;
    }

    return validatedSettings;
  }
}
