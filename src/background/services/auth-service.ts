/**
 * Authentication Service for Cloud Providers
 * Handles authentication flows for all cloud providers
 */

import { ExtensionStorage } from "../../shared/storage.js";
import type {
  CloudAdapter,
  CloudProvider,
  CloudCredentials,
} from "../../shared/types.js";
import { ERROR_MESSAGES } from "../../shared/constants.js";

export class AuthenticationService {
  /**
   * Authenticate with a cloud provider using the provided adapter
   */
  static async authenticate(adapter: CloudAdapter): Promise<CloudCredentials> {
    if (!adapter) {
      throw new Error("No cloud provider configured");
    }

    try {
      const credentials = await adapter.authenticate();
      await adapter.initialize(credentials);
      await ExtensionStorage.setCloudCredentials(credentials);

      return credentials;
    } catch (error) {
      console.error("Authentication failed:", error);
      throw new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }
  }

  /**
   * Check if currently authenticated with a cloud provider
   */
  static async isAuthenticated(adapter: CloudAdapter | null): Promise<boolean> {
    if (!adapter) {
      // If no current adapter, consider it not authenticated for now.
      // In a multi-scope setup, we might check if any adapter is authenticated.
      return false;
    }

    return adapter.isAuthenticated();
  }

  /**
   * Initialize adapter with stored credentials if available
   */
  static async initializeWithStoredCredentials(
    adapter: CloudAdapter,
    provider: CloudProvider,
  ): Promise<boolean> {
    try {
      const credentials = await ExtensionStorage.getCloudCredentials();
      if (credentials && credentials.provider === provider) {
        await adapter.initialize(credentials);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to initialize with stored credentials:", error);
      return false;
    }
  }

  /**
   * Disconnect from cloud provider by clearing credentials
   */
  static async disconnect(): Promise<void> {
    try {
      await ExtensionStorage.clearCloudCredentials();
    } catch (error) {
      console.error("Failed to disconnect:", error);
      throw error;
    }
  }
}
