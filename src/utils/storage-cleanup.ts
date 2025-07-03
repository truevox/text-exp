/**
 * Storage cleanup utilities for removing invalid sources after local filesystem removal
 */

import { ExtensionStorage } from '../shared/storage.js';
import type { ExtensionSettings, ScopedSource } from '../shared/types.js';

export class StorageCleanup {
  /**
   * Clean up any stored local filesystem sources from user storage
   * This removes sources that are no longer valid after local filesystem support was removed
   */
  static async clearInvalidSources(): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = [];
    let cleaned = 0;

    try {
      // Get current settings
      const settings = await ExtensionStorage.getSettings();
      
      // Clean configured sources
      if (settings.configuredSources) {
        const validSources = settings.configuredSources.filter(source => {
          if (source.provider === 'local-filesystem') {
            cleaned++;
            console.log(`Removing invalid local filesystem source: ${source.displayName}`);
            return false;
          }
          return true;
        });

        // Update settings if we removed any sources
        if (validSources.length !== settings.configuredSources.length) {
          await ExtensionStorage.updateSettings({
            configuredSources: validSources
          });
          console.log(`Cleaned ${cleaned} invalid configured sources`);
        }
      }

      // Clean any stored scoped sources
      const scopedSources = await ExtensionStorage.getScopedSources();
      if (scopedSources && scopedSources.length > 0) {
        const validScopedSources = scopedSources.filter(source => {
          if (source.provider === 'local-filesystem') {
            cleaned++;
            console.log(`Removing invalid scoped source: ${source.displayName}`);
            return false;
          }
          return true;
        });

        // Update scoped sources if we removed any
        if (validScopedSources.length !== scopedSources.length) {
          await ExtensionStorage.setScopedSources(validScopedSources);
          console.log(`Cleaned ${cleaned} invalid scoped sources`);
        }
      }

      // Clean any stored local filesystem handles or permissions
      try {
        await chrome.storage.local.remove([
          'localFilesystemHandles',
          'localFilesystemPermissions',
          'localSources',
          'directoryHandles',
          'fileSystemHandles'
        ]);
        console.log('Removed local filesystem storage keys');
      } catch (error) {
        console.log('No local filesystem storage keys to remove');
      }

      return { cleaned, errors };
    } catch (error) {
      const errorMsg = `Failed to clean storage: ${error.message}`;
      console.error(errorMsg, error);
      errors.push(errorMsg);
      return { cleaned, errors };
    }
  }

  /**
   * Validate all configured sources and remove any that are invalid
   */
  static async validateAndCleanSources(): Promise<{ valid: number; invalid: number; errors: string[] }> {
    const errors: string[] = [];
    let valid = 0;
    let invalid = 0;

    try {
      const settings = await ExtensionStorage.getSettings();
      
      if (!settings.configuredSources) {
        return { valid: 0, invalid: 0, errors };
      }

      const validSources = settings.configuredSources.filter(source => {
        // Check if provider is still supported
        const supportedProviders = ['google-drive', 'dropbox', 'onedrive', 'local'];
        if (!supportedProviders.includes(source.provider)) {
          invalid++;
          console.log(`Removing source with unsupported provider: ${source.provider}`);
          return false;
        }

        // Check if source has required fields
        if (!source.scope || !source.displayName) {
          invalid++;
          console.log(`Removing source with missing required fields:`, source);
          return false;
        }

        valid++;
        return true;
      });

      // Update if we found invalid sources
      if (invalid > 0) {
        await ExtensionStorage.updateSettings({
          configuredSources: validSources
        });
        console.log(`Validation complete: ${valid} valid, ${invalid} invalid sources cleaned`);
      }

      return { valid, invalid, errors };
    } catch (error) {
      const errorMsg = `Failed to validate sources: ${error.message}`;
      console.error(errorMsg, error);
      errors.push(errorMsg);
      return { valid, invalid, errors };
    }
  }

  /**
   * Get cleanup status and recommendations
   */
  static async getCleanupStatus(): Promise<{
    needsCleanup: boolean;
    invalidSources: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    let invalidSources = 0;
    
    try {
      const settings = await ExtensionStorage.getSettings();
      
      // Check for local filesystem sources
      if (settings.configuredSources) {
        const localFsSources = settings.configuredSources.filter(s => s.provider === 'local-filesystem');
        invalidSources += localFsSources.length;
        
        if (localFsSources.length > 0) {
          recommendations.push(`Remove ${localFsSources.length} local filesystem sources`);
        }
      }

      // Check for orphaned storage keys
      const storage = await chrome.storage.local.get([
        'localFilesystemHandles',
        'localFilesystemPermissions',
        'localSources'
      ]);
      
      const orphanedKeys = Object.keys(storage).length;
      if (orphanedKeys > 0) {
        recommendations.push(`Clean ${orphanedKeys} orphaned storage keys`);
      }

      return {
        needsCleanup: invalidSources > 0 || orphanedKeys > 0,
        invalidSources,
        recommendations
      };
    } catch (error) {
      console.error('Failed to get cleanup status:', error);
      return {
        needsCleanup: false,
        invalidSources: 0,
        recommendations: ['Error checking cleanup status']
      };
    }
  }
}