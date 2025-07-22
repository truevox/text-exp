/**
 * Add Snippet page - simplified version using existing popup editor
 */

import { ComprehensiveSnippetEditor } from '../ui/components/comprehensive-snippet-editor.js';
import { ExtensionStorage } from '../shared/storage.js';
import type { SnippetEditResult } from '../ui/components/comprehensive-snippet-editor.js';
import type { TierStorageSchema } from '../types/snippet-formats.js';

class AddSnippetPage {
  private editor: ComprehensiveSnippetEditor | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.initializeEditor();
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize Add Snippet page:', error);
      this.showError('Failed to initialize page. Please refresh and try again.');
    }
  }

  private async initializeEditor(): Promise<void> {
    const container = document.getElementById('snippet-editor-container');
    if (!container) return;

    // Check if storage is configured
    if (!(await this.isStorageConfigured())) {
      container.innerHTML = `
        <div class="error">
          <h3>Storage not configured</h3>
          <p>Please configure at least one storage source in the extension options before creating snippets.</p>
          <button type="button" class="btn btn-primary" onclick="chrome.runtime.openOptionsPage()">Open Options</button>
        </div>
      `;
      return;
    }

    try {
      // Create default TierStorageSchema for new snippet
      const defaultTierData: TierStorageSchema = {
        schema: "priority-tier-v1",
        tier: "priority-0",
        snippets: [],
        metadata: {
          version: "1.0.0",
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          owner: "user@example.com",
          description: "Default appdata store",
        },
      };

      this.editor = new ComprehensiveSnippetEditor({
        tierData: defaultTierData,
        mode: "create",
        enableContentTypeConversion: true,
        validateDependencies: true,
        autoFocus: true,
        compact: false,
        // For now, disable multi-store selector since it's complex
        showStoreSelector: false,
        onSave: async (result: SnippetEditResult) => {
          await this.handleSnippetSave(result);
        },
        onError: (error: Error) => {
          this.showError("Editor error: " + error.message);
        },
        onContentChange: (_content: string) => {
          // Handle content change if needed
        },
      });

      await this.editor.init(container);
      
    } catch (error) {
      console.error('Failed to initialize editor:', error);
      container.innerHTML = '<div class="error">Failed to initialize editor. Please refresh and try again.</div>';
    }
  }

  private async isStorageConfigured(): Promise<boolean> {
    try {
      const settings = await ExtensionStorage.getSettings();
      
      // Check if we have at least the default appdata store or configured sources
      const hasDefaultStore = await this.checkDefaultStore();
      const hasCustomStores = settings.configuredSources && settings.configuredSources.length > 0;
      
      return hasDefaultStore || hasCustomStores;
    } catch (error) {
      console.error('Error checking storage configuration:', error);
      return false;
    }
  }

  private async checkDefaultStore(): Promise<boolean> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DEFAULT_STORE_STATUS'
      });
      return response?.storeInfo?.isAvailable || false;
    } catch (error) {
      console.error('Error checking default store:', error);
      return false;
    }
  }

  private async handleSnippetSave(result: SnippetEditResult): Promise<void> {
    console.log('🔍 [SAVE-DEBUG] handleSnippetSave called with result:', result);
    
    if (!result.success || !result.snippet) {
      const errorMsg = result.errors && result.errors.length > 0 
        ? result.errors.join(', ')
        : 'Failed to create snippet';
      this.showError(errorMsg);
      return;
    }

    console.log('🔍 [SAVE-DEBUG] Snippet to save:');
    console.log('  - ID:', result.snippet.id);
    console.log('  - Trigger:', result.snippet.trigger);
    console.log('  - Content:', result.snippet.content ? `"${result.snippet.content.substring(0, 100)}..."` : '(empty/undefined)');
    console.log('  - Content length:', result.snippet.content?.length || 0);
    console.log('  - Content type:', result.snippet.contentType);

    try {
      // Send message to background to save snippet to default store
      const saveResponse = await chrome.runtime.sendMessage({
        type: 'SAVE_SNIPPET',
        snippet: result.snippet,
        stores: ['/drive.appstore'] // Save to default store for now
      });

      if (saveResponse.success) {
        this.showSuccess('Snippet created successfully!');
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        throw new Error(saveResponse.error || 'Failed to save snippet');
      }

    } catch (error) {
      console.error('Failed to save snippet:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showError('Failed to create snippet: ' + errorMsg);
    }
  }

  private setupEventListeners(): void {
    const cancelButton = document.getElementById('cancel-button');
    const saveButton = document.getElementById('save-button');

    cancelButton?.addEventListener('click', () => {
      window.close();
    });

    // The save button is handled by the editor itself
    saveButton?.addEventListener('click', async () => {
      if (this.editor) {
        await this.editor.save();
      }
    });

    // Close page on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      }
    });
  }

  private showError(message: string): void {
    this.showMessage(message, 'error');
  }

  private showSuccess(message: string): void {
    this.showMessage(message, 'success');
  }

  private showMessage(message: string, type: 'error' | 'success'): void {
    // Remove any existing messages
    const existingMessages = document.querySelectorAll('.error, .success');
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    messageDiv.textContent = message;

    // Insert at the top of main content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.insertBefore(messageDiv, mainContent.firstChild);
    }

    // Auto-remove error messages after 5 seconds
    if (type === 'error') {
      setTimeout(() => {
        messageDiv.remove();
      }, 5000);
    }
  }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AddSnippetPage();
});
