/**
 * CloudAdapter factory and registry
 * Centralized management of cloud storage adapters
 */

import type { CloudAdapter, CloudProvider, CloudAdapterFactory } from '../../shared/types.js';
import { GoogleDriveAdapter } from './google-drive-adapter.js';
import { DropboxAdapter } from './dropbox-adapter.js';
import { OneDriveAdapter } from './onedrive-adapter.js';
import { LocalFilesystemAdapter } from './local-filesystem-adapter.js';

/**
 * Factory class for creating cloud adapters
 */
export class CloudAdapterFactoryImpl implements CloudAdapterFactory {
  private static instance: CloudAdapterFactoryImpl;
  private adapters = new Map<CloudProvider, () => CloudAdapter>();

  private constructor() {
    this.registerAdapters();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CloudAdapterFactoryImpl {
    if (!CloudAdapterFactoryImpl.instance) {
      CloudAdapterFactoryImpl.instance = new CloudAdapterFactoryImpl();
    }
    return CloudAdapterFactoryImpl.instance;
  }

  /**
   * Create a cloud adapter for the specified provider
   */
  createAdapter(provider: CloudProvider): CloudAdapter {
    const adapterFactory = this.adapters.get(provider);
    
    if (!adapterFactory) {
      throw new Error(`Unsupported cloud provider: ${provider}`);
    }
    
    return adapterFactory();
  }

  /**
   * Get list of supported providers
   */
  getSupportedProviders(): CloudProvider[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a provider is supported
   */
  isProviderSupported(provider: CloudProvider): boolean {
    return this.adapters.has(provider);
  }

  /**
   * Register a custom adapter
   */
  registerAdapter(provider: CloudProvider, factory: () => CloudAdapter): void {
    this.adapters.set(provider, factory);
  }

  /**
   * Unregister an adapter
   */
  unregisterAdapter(provider: CloudProvider): void {
    this.adapters.delete(provider);
  }

  /**
   * Register built-in adapters
   */
  private registerAdapters(): void {
    this.adapters.set('google-drive', () => new GoogleDriveAdapter());
    this.adapters.set('dropbox', () => new DropboxAdapter());
    this.adapters.set('onedrive', () => new OneDriveAdapter());
    this.adapters.set('local-filesystem', () => new LocalFilesystemAdapter());
    
    // Local storage is handled by the extension's built-in storage
    this.adapters.set('local', () => new LocalStorageAdapter());
  }
}

/**
 * Local storage adapter (no cloud sync)
 */
class LocalStorageAdapter implements CloudAdapter {
  readonly provider = 'local' as const;

  async initialize(): Promise<void> {
    // No initialization needed for local storage
  }

  async isAuthenticated(): Promise<boolean> {
    return true; // Local storage is always "authenticated"
  }

  async authenticate(): Promise<any> {
    return {
      provider: this.provider,
      accessToken: 'local',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    };
  }

  async uploadSnippets(): Promise<void> {
    // No-op for local storage
  }

  async downloadSnippets(): Promise<any[]> {
    return []; // Local snippets are managed by ExtensionStorage
  }

  async syncSnippets(localSnippets: any[]): Promise<any[]> {
    return localSnippets; // Return local snippets unchanged
  }

  async deleteSnippets(): Promise<void> {
    // No-op for local storage
  }

  async getSyncStatus(): Promise<any> {
    return {
      provider: this.provider,
      lastSync: new Date(),
      isOnline: true,
      hasChanges: false
    };
  }
}

/**
 * Convenience function to get the factory instance
 */
export function getCloudAdapterFactory(): CloudAdapterFactory {
  return CloudAdapterFactoryImpl.getInstance();
}

/**
 * Convenience function to create an adapter
 */
export function createCloudAdapter(provider: CloudProvider): CloudAdapter {
  return getCloudAdapterFactory().createAdapter(provider);
}

/**
 * Export adapter classes for direct use if needed
 */
export { GoogleDriveAdapter, DropboxAdapter, OneDriveAdapter };

/**
 * Export types
 */
export type { CloudAdapter, CloudProvider, CloudAdapterFactory };