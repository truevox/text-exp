/**
 * Options page script for Collaborative Text Expander
 * Handles extension settings and configuration
 */

import { SettingsMessages, SnippetMessages, SyncMessages } from '../shared/messaging.js';
import { ExtensionStorage } from '../shared/storage.js';
import type { ExtensionSettings } from '../shared/types.js';
import { DEFAULT_SETTINGS, CLOUD_PROVIDERS } from '../shared/constants.js';

/**
 * Options page application class
 */
class OptionsApp {
  private settings: ExtensionSettings = DEFAULT_SETTINGS;
  private syncManager: any = null; // Will be imported dynamically

  // DOM elements
  private elements = {
    // General settings
    enabledCheckbox: document.getElementById('enabledCheckbox') as HTMLInputElement,
    caseSensitiveCheckbox: document.getElementById('caseSensitiveCheckbox') as HTMLInputElement,
    notificationsCheckbox: document.getElementById('notificationsCheckbox') as HTMLInputElement,
    triggerDelaySlider: document.getElementById('triggerDelaySlider') as HTMLInputElement,
    triggerDelayValue: document.getElementById('triggerDelayValue') as HTMLElement,

    // Local filesystem sources
    setupLocalSourcesButton: document.getElementById('setupLocalSourcesButton') as HTMLButtonElement,
    scopedSourcesList: document.getElementById('scopedSourcesList') as HTMLElement,
    syncAllSourcesButton: document.getElementById('syncAllSourcesButton') as HTMLButtonElement,
    refreshSourcesButton: document.getElementById('refreshSourcesButton') as HTMLButtonElement,

    // Cloud sync settings
    cloudProviderSelect: document.getElementById('cloudProviderSelect') as HTMLSelectElement,
    autoSyncCheckbox: document.getElementById('autoSyncCheckbox') as HTMLInputElement,
    syncIntervalSlider: document.getElementById('syncIntervalSlider') as HTMLInputElement,
    syncIntervalValue: document.getElementById('syncIntervalValue') as HTMLElement,
    
    // Cloud status
    cloudStatus: document.getElementById('cloudStatus') as HTMLElement,
    statusIndicator: document.getElementById('statusIndicator') as HTMLElement,
    statusTitle: document.getElementById('statusTitle') as HTMLElement,
    statusDetails: document.getElementById('statusDetails') as HTMLElement,
    connectButton: document.getElementById('connectButton') as HTMLButtonElement,

    // Sync actions
    syncNowButton: document.getElementById('syncNowButton') as HTMLButtonElement,
    forceUploadButton: document.getElementById('forceUploadButton') as HTMLButtonElement,
    forceDownloadButton: document.getElementById('forceDownloadButton') as HTMLButtonElement,

    // Collaboration
    sharedSnippetsCheckbox: document.getElementById('sharedSnippetsCheckbox') as HTMLInputElement,
    teamCodeInput: document.getElementById('teamCodeInput') as HTMLInputElement,

    // Data management
    totalSnippets: document.getElementById('totalSnippets') as HTMLElement,
    storageUsed: document.getElementById('storageUsed') as HTMLElement,
    lastSync: document.getElementById('lastSync') as HTMLElement,
    clearLocalButton: document.getElementById('clearLocalButton') as HTMLButtonElement,
    resetAllButton: document.getElementById('resetAllButton') as HTMLButtonElement,

    // Advanced
    debugCheckbox: document.getElementById('debugCheckbox') as HTMLInputElement,
    viewLogsButton: document.getElementById('viewLogsButton') as HTMLButtonElement,

    // Header actions
    exportButton: document.getElementById('exportButton') as HTMLButtonElement,
    importButton: document.getElementById('importButton') as HTMLButtonElement,
    importFileInput: document.getElementById('importFileInput') as HTMLInputElement,

    // Status banner
    statusBanner: document.getElementById('statusBanner') as HTMLElement,
    statusText: document.querySelector('.status-text') as HTMLElement,
    statusClose: document.querySelector('.status-close') as HTMLButtonElement,

    // Footer
    versionNumber: document.getElementById('versionNumber') as HTMLElement,
    helpLink: document.getElementById('helpLink') as HTMLElement,
    feedbackLink: document.getElementById('feedbackLink') as HTMLElement,
    privacyLink: document.getElementById('privacyLink') as HTMLElement,
  };

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the options page
   */
  private async initialize(): Promise<void> {
    try {
      this.setupEventListeners();
      await this.loadSettings();
      await this.updateUI();
      await this.updateDataStats();
      await this.refreshScopedSources();
      this.updateVersion();
      this.handleAnchorNavigation();
    } catch (error) {
      console.error('Failed to initialize options page:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // General settings
    this.elements.enabledCheckbox.addEventListener('change', () => this.saveSettings());
    this.elements.caseSensitiveCheckbox.addEventListener('change', () => this.saveSettings());
    this.elements.notificationsCheckbox.addEventListener('change', () => this.saveSettings());
    
    this.elements.triggerDelaySlider.addEventListener('input', () => {
      this.updateTriggerDelayValue();
      this.saveSettings();
    });

    // Local filesystem sources
    this.elements.setupLocalSourcesButton.addEventListener('click', () => this.handleSetupLocalSources());
    this.elements.syncAllSourcesButton.addEventListener('click', () => this.handleSyncAllSources());
    this.elements.refreshSourcesButton.addEventListener('click', () => this.refreshScopedSources());

    // Cloud settings
    this.elements.cloudProviderSelect.addEventListener('change', () => this.handleProviderChange());
    this.elements.autoSyncCheckbox.addEventListener('change', () => this.saveSettings());
    
    this.elements.syncIntervalSlider.addEventListener('input', () => {
      this.updateSyncIntervalValue();
      this.saveSettings();
    });

    // Cloud actions
    this.elements.connectButton.addEventListener('click', () => this.handleConnect());
    this.elements.syncNowButton.addEventListener('click', () => this.handleSyncNow());
    this.elements.forceUploadButton.addEventListener('click', () => this.handleForceUpload());
    this.elements.forceDownloadButton.addEventListener('click', () => this.handleForceDownload());

    // Collaboration
    this.elements.sharedSnippetsCheckbox.addEventListener('change', () => this.saveSettings());
    this.elements.teamCodeInput.addEventListener('change', () => this.saveSettings());

    // Data management
    this.elements.clearLocalButton.addEventListener('click', () => this.handleClearLocal());
    this.elements.resetAllButton.addEventListener('click', () => this.handleResetAll());

    // Advanced
    this.elements.debugCheckbox.addEventListener('change', () => this.saveSettings());
    this.elements.viewLogsButton.addEventListener('click', () => this.handleViewLogs());

    // Header actions
    this.elements.exportButton.addEventListener('click', () => this.handleExport());
    this.elements.importButton.addEventListener('click', () => this.handleImport());
    this.elements.importFileInput.addEventListener('change', () => this.handleFileImport());

    // Status banner
    this.elements.statusClose.addEventListener('click', () => this.hideStatus());

    // Footer links
    this.elements.helpLink.addEventListener('click', (e) => this.handleExternalLink(e, 'help'));
    this.elements.feedbackLink.addEventListener('click', (e) => this.handleExternalLink(e, 'feedback'));
    this.elements.privacyLink.addEventListener('click', (e) => this.handleExternalLink(e, 'privacy'));
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      this.settings = await SettingsMessages.getSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = DEFAULT_SETTINGS;
    }
  }

  /**
   * Update UI with current settings
   */
  private async updateUI(): Promise<void> {
    // General settings
    this.elements.enabledCheckbox.checked = this.settings.enabled;
    this.elements.caseSensitiveCheckbox.checked = this.settings.caseSensitive;
    this.elements.notificationsCheckbox.checked = this.settings.showNotifications;
    this.elements.triggerDelaySlider.value = this.settings.triggerDelay.toString();
    this.updateTriggerDelayValue();

    // Cloud settings
    this.elements.cloudProviderSelect.value = this.settings.cloudProvider;
    this.elements.autoSyncCheckbox.checked = this.settings.autoSync;
    this.elements.syncIntervalSlider.value = this.settings.syncInterval.toString();
    this.updateSyncIntervalValue();

    // Collaboration
    this.elements.sharedSnippetsCheckbox.checked = this.settings.enableSharedSnippets;

    // Update cloud status
    await this.updateCloudStatus();
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      const newSettings: Partial<ExtensionSettings> = {
        enabled: this.elements.enabledCheckbox.checked,
        caseSensitive: this.elements.caseSensitiveCheckbox.checked,
        showNotifications: this.elements.notificationsCheckbox.checked,
        triggerDelay: parseInt(this.elements.triggerDelaySlider.value),
        cloudProvider: this.elements.cloudProviderSelect.value as any,
        autoSync: this.elements.autoSyncCheckbox.checked,
        syncInterval: parseInt(this.elements.syncIntervalSlider.value),
        enableSharedSnippets: this.elements.sharedSnippetsCheckbox.checked,
      };

      await SettingsMessages.updateSettings(newSettings);
      this.settings = { ...this.settings, ...newSettings };
      
      this.showStatus('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  /**
   * Handle cloud provider change
   */
  private async handleProviderChange(): Promise<void> {
    await this.saveSettings();
    await this.updateCloudStatus();
  }

  /**
   * Update cloud status display
   */
  private async updateCloudStatus(): Promise<void> {
    const provider = this.settings.cloudProvider;
    
    if (provider === 'local') {
      this.elements.statusIndicator.className = 'status-indicator online';
      this.elements.statusTitle.textContent = 'Local Storage';
      this.elements.statusDetails.textContent = 'Using local storage only';
      this.elements.connectButton.style.display = 'none';
    } else {
      // For cloud providers, check connection status
      try {
        // This would check actual connection status
        const isConnected = false; // Placeholder
        
        if (isConnected) {
          this.elements.statusIndicator.className = 'status-indicator online';
          this.elements.statusTitle.textContent = 'Connected';
          this.elements.statusDetails.textContent = `Connected to ${CLOUD_PROVIDERS[provider].name}`;
          this.elements.connectButton.textContent = 'Disconnect';
        } else {
          this.elements.statusIndicator.className = 'status-indicator offline';
          this.elements.statusTitle.textContent = 'Not Connected';
          this.elements.statusDetails.textContent = `Connect to ${CLOUD_PROVIDERS[provider].name}`;
          this.elements.connectButton.textContent = 'Connect';
        }
        
        this.elements.connectButton.style.display = 'block';
      } catch (error) {
        this.elements.statusIndicator.className = 'status-indicator offline';
        this.elements.statusTitle.textContent = 'Connection Error';
        this.elements.statusDetails.textContent = 'Failed to check connection status';
        this.elements.connectButton.style.display = 'block';
      }
    }
  }

  /**
   * Handle connect/disconnect button
   */
  private async handleConnect(): Promise<void> {
    try {
      const isConnected = this.elements.connectButton.textContent === 'Disconnect';
      
      if (isConnected) {
        // Disconnect
        await this.handleDisconnect();
      } else {
        // Connect
        await this.handleAuthenticate();
      }
      
      await this.updateCloudStatus();
    } catch (error) {
      console.error('Connection failed:', error);
      this.showStatus(`Connection failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle authentication
   */
  private async handleAuthenticate(): Promise<void> {
    // This would trigger authentication flow
    this.showStatus('Authentication not implemented yet', 'warning');
  }

  /**
   * Handle disconnect
   */
  private async handleDisconnect(): Promise<void> {
    // This would clear credentials and disconnect
    this.showStatus('Disconnect not implemented yet', 'warning');
  }

  /**
   * Handle sync now
   */
  private async handleSyncNow(): Promise<void> {
    try {
      this.elements.syncNowButton.disabled = true;
      this.elements.syncNowButton.textContent = 'Syncing...';
      
      await SyncMessages.syncSnippets();
      await this.updateDataStats();
      
      this.showStatus('Sync completed successfully', 'success');
    } catch (error) {
      console.error('Sync failed:', error);
      this.showStatus(`Sync failed: ${error.message}`, 'error');
    } finally {
      this.elements.syncNowButton.disabled = false;
      this.elements.syncNowButton.textContent = 'Sync Now';
    }
  }

  /**
   * Handle force upload
   */
  private async handleForceUpload(): Promise<void> {
    if (!confirm('This will overwrite cloud data with local data. Continue?')) {
      return;
    }

    try {
      this.elements.forceUploadButton.disabled = true;
      this.showStatus('Force uploading...', 'info');
      
      // Implementation would go here
      this.showStatus('Force upload not implemented yet', 'warning');
    } catch (error) {
      console.error('Force upload failed:', error);
      this.showStatus(`Force upload failed: ${error.message}`, 'error');
    } finally {
      this.elements.forceUploadButton.disabled = false;
    }
  }

  /**
   * Handle force download
   */
  private async handleForceDownload(): Promise<void> {
    if (!confirm('This will overwrite local data with cloud data. Continue?')) {
      return;
    }

    try {
      this.elements.forceDownloadButton.disabled = true;
      this.showStatus('Force downloading...', 'info');
      
      // Implementation would go here
      this.showStatus('Force download not implemented yet', 'warning');
    } catch (error) {
      console.error('Force download failed:', error);
      this.showStatus(`Force download failed: ${error.message}`, 'error');
    } finally {
      this.elements.forceDownloadButton.disabled = false;
    }
  }

  /**
   * Update data statistics
   */
  private async updateDataStats(): Promise<void> {
    try {
      const snippets = await SnippetMessages.getSnippets();
      const storageUsage = await ExtensionStorage.getStorageUsage();
      const lastSync = await ExtensionStorage.getLastSync();

      this.elements.totalSnippets.textContent = snippets.length.toString();
      this.elements.storageUsed.textContent = this.formatBytes(storageUsage.local + storageUsage.sync);
      this.elements.lastSync.textContent = lastSync ? 
        this.formatRelativeTime(lastSync) : 'Never';
    } catch (error) {
      console.error('Failed to update data stats:', error);
    }
  }

  /**
   * Handle clear local data
   */
  private async handleClearLocal(): Promise<void> {
    if (!confirm('This will delete all local snippets and settings. This action cannot be undone. Continue?')) {
      return;
    }

    try {
      await ExtensionStorage.clearAll();
      await this.loadSettings();
      await this.updateUI();
      await this.updateDataStats();
      
      this.showStatus('Local data cleared successfully', 'success');
    } catch (error) {
      console.error('Failed to clear local data:', error);
      this.showStatus('Failed to clear local data', 'error');
    }
  }

  /**
   * Handle reset all settings
   */
  private async handleResetAll(): Promise<void> {
    if (!confirm('This will reset all settings to defaults. Continue?')) {
      return;
    }

    try {
      await SettingsMessages.updateSettings(DEFAULT_SETTINGS);
      this.settings = DEFAULT_SETTINGS;
      await this.updateUI();
      
      this.showStatus('Settings reset to defaults', 'success');
    } catch (error) {
      console.error('Failed to reset settings:', error);
      this.showStatus('Failed to reset settings', 'error');
    }
  }

  /**
   * Handle view logs
   */
  private handleViewLogs(): void {
    // Open browser console or logs page
    this.showStatus('Debug logs available in browser console', 'info');
    console.log('Text Expander Debug Information:');
    console.log('Settings:', this.settings);
    console.log('User Agent:', navigator.userAgent);
    console.log('Extension ID:', chrome.runtime.id);
  }

  /**
   * Handle data export
   */
  private async handleExport(): Promise<void> {
    try {
      const exportData = await ExtensionStorage.exportData();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `text-expander-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showStatus('Data exported successfully', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showStatus('Export failed', 'error');
    }
  }

  /**
   * Handle data import
   */
  private handleImport(): void {
    this.elements.importFileInput.click();
  }

  /**
   * Handle file import
   */
  private async handleFileImport(): Promise<void> {
    const file = this.elements.importFileInput.files?.[0];
    if (!file) return;

    try {
      const content = await this.readFileAsText(file);
      await ExtensionStorage.importData(content);
      
      await this.loadSettings();
      await this.updateUI();
      await this.updateDataStats();
      
      this.showStatus('Data imported successfully', 'success');
    } catch (error) {
      console.error('Import failed:', error);
      this.showStatus(`Import failed: ${error.message}`, 'error');
    }
  }

  /**
   * Handle external links
   */
  private handleExternalLink(e: Event, type: string): void {
    e.preventDefault();
    
    const urls = {
      help: 'https://example.com/help',
      feedback: 'https://example.com/feedback',
      privacy: 'https://example.com/privacy'
    };
    
    const url = urls[type as keyof typeof urls];
    if (url) {
      chrome.tabs.create({ url });
    }
  }

  /**
   * Handle setup of local filesystem sources
   */
  private async handleSetupLocalSources(): Promise<void> {
    try {
      this.elements.setupLocalSourcesButton.disabled = true;
      this.elements.setupLocalSourcesButton.textContent = '⏳ Setting up folders...';
      
      // Check if File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        throw new Error('File System Access API not supported in this browser');
      }
      
      const scopes: ('personal' | 'team' | 'org')[] = ['personal', 'team', 'org'];
      let setupCount = 0;
      
      for (const scope of scopes) {
        try {
          this.showStatus(`Please select your ${scope} snippets folder...`, 'info');
          
          const directoryHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents',
            id: `puffpuffpaste-${scope}-snippets`
          });

          // Send the directory handle to the service worker
          const response = await chrome.runtime.sendMessage({
            type: 'ADD_LOCAL_FILESYSTEM_SOURCE',
            scope,
            directoryHandle
          });

          if (response.success) {
            setupCount++;
            this.showStatus(`✅ Added ${scope} source: ${directoryHandle.name}`, 'success');
          } else {
            throw new Error(response.error || `Failed to add ${scope} source`);
          }
          
        } catch (error: any) {
          if (error.name === 'AbortError') {
            this.showStatus(`⏭️ Skipped ${scope} folder selection`, 'info');
            continue;
          }
          console.error(`Failed to setup ${scope} source:`, error);
          this.showStatus(`❌ Failed to setup ${scope} source: ${error.message}`, 'error');
        }
      }
      
      if (setupCount > 0) {
        this.showStatus(`Successfully set up ${setupCount} local folder source(s)!`, 'success');
        await this.refreshScopedSources();
      } else {
        this.showStatus('No local folder sources were set up', 'warning');
      }
      
    } catch (error) {
      console.error('Setup local sources error:', error);
      this.showStatus('Failed to setup local sources: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    } finally {
      this.elements.setupLocalSourcesButton.disabled = false;
      this.elements.setupLocalSourcesButton.textContent = '📁 Setup Local Folder Sources';
    }
  }

  /**
   * Handle sync all scoped sources
   */
  private async handleSyncAllSources(): Promise<void> {
    try {
      this.elements.syncAllSourcesButton.disabled = true;
      this.elements.syncAllSourcesButton.textContent = '⏳ Syncing...';
      
      const response = await chrome.runtime.sendMessage({ 
        type: 'SYNC_ALL_SCOPED_SOURCES' 
      });
      
      if (response.success) {
        const snippetCount = response.data?.length || 0;
        this.showStatus(`Successfully synced ${snippetCount} snippets from all sources!`, 'success');
        await this.refreshScopedSources();
        await this.updateDataStats();
      } else {
        throw new Error(response.error || 'Failed to sync sources');
      }
    } catch (error) {
      console.error('Sync all sources error:', error);
      this.showStatus('Failed to sync sources: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
    } finally {
      this.elements.syncAllSourcesButton.disabled = false;
      this.elements.syncAllSourcesButton.textContent = '🔄 Sync All Sources';
    }
  }

  /**
   * Refresh scoped sources display
   */
  private async refreshScopedSources(): Promise<void> {
    try {
      // Get scoped sources status
      const statusResponse = await chrome.runtime.sendMessage({ 
        type: 'GET_SCOPED_SYNC_STATUS' 
      });
      
      if (statusResponse.success) {
        this.updateScopedSourcesList(statusResponse.data);
      }
    } catch (error) {
      console.error('Failed to refresh scoped sources:', error);
    }
  }

  /**
   * Update scoped sources list display
   */
  private updateScopedSourcesList(statusData: any): void {
    const container = this.elements.scopedSourcesList;
    container.innerHTML = '';
    
    if (!statusData || Object.keys(statusData).length === 0) {
      container.innerHTML = `
        <div class="no-sources">
          <p>No local folder sources configured yet.</p>
          <p>Click "Setup Local Folder Sources" to get started.</p>
        </div>
      `;
      return;
    }
    
    // Group by scope
    const scopes = ['personal', 'team', 'org'];
    
    scopes.forEach(scope => {
      const scopeSources = Object.entries(statusData).filter(([key, data]: [string, any]) => 
        data.scope === scope
      );
      
      if (scopeSources.length > 0) {
        const scopeSection = document.createElement('div');
        scopeSection.className = 'scope-section';
        
        const scopeHeader = document.createElement('h4');
        scopeHeader.className = 'scope-header';
        scopeHeader.textContent = scope.charAt(0).toUpperCase() + scope.slice(1);
        scopeSection.appendChild(scopeHeader);
        
        scopeSources.forEach(([key, data]: [string, any]) => {
          const sourceItem = document.createElement('div');
          sourceItem.className = 'source-item';
          
          const lastSyncText = data.lastSync 
            ? this.formatRelativeTime(new Date(data.lastSync))
            : 'Never';
          
          sourceItem.innerHTML = `
            <div class="source-info">
              <div class="source-name">${data.name}</div>
              <div class="source-details">
                ${data.snippetCount} snippets • Last sync: ${lastSyncText}
              </div>
            </div>
            <div class="source-priority priority-${scope}">
              ${scope.charAt(0).toUpperCase()}
            </div>
          `;
          
          scopeSection.appendChild(sourceItem);
        });
        
        container.appendChild(scopeSection);
      }
    });
  }

  /**
   * Update trigger delay value display
   */
  private updateTriggerDelayValue(): void {
    const value = parseInt(this.elements.triggerDelaySlider.value);
    this.elements.triggerDelayValue.textContent = `${value}ms`;
  }

  /**
   * Update sync interval value display
   */
  private updateSyncIntervalValue(): void {
    const value = parseInt(this.elements.syncIntervalSlider.value);
    this.elements.syncIntervalValue.textContent = `${value} minutes`;
  }

  /**
   * Update version number
   */
  private updateVersion(): void {
    const manifest = chrome.runtime.getManifest();
    this.elements.versionNumber.textContent = manifest.version;
  }

  /**
   * Show status message
   */
  private showStatus(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.elements.statusBanner.className = `status-banner ${type}`;
    this.elements.statusText.textContent = message;
    this.elements.statusBanner.classList.remove('hidden');
    
    // Auto-hide success messages
    if (type === 'success') {
      setTimeout(() => this.hideStatus(), 3000);
    }
  }

  /**
   * Hide status message
   */
  private hideStatus(): void {
    this.elements.statusBanner.classList.add('hidden');
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Handle anchor navigation from URL hash
   */
  private handleAnchorNavigation(): void {
    const hash = window.location.hash;
    if (hash) {
      const targetId = hash.substring(1); // Remove the # symbol
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        // Scroll to the element with smooth behavior
        targetElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
        
        // Add a highlight effect to draw attention
        targetElement.style.transition = 'background-color 0.5s ease';
        targetElement.style.backgroundColor = '#e3f2fd';
        
        // Remove the highlight after 2 seconds
        setTimeout(() => {
          targetElement.style.backgroundColor = '';
        }, 2000);
      }
    }
  }

  /**
   * Format relative time
   */
  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} days ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Read file as text
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

// Initialize options page when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new OptionsApp();
  });
} else {
  new OptionsApp();
}